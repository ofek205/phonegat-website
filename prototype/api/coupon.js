/* PHONE GAT — sequential coupon numbers.
 *
 * POST /api/coupon  {"offer":"screen"}  ->  {"n":42,"seq":true}
 *
 * Hands out an ascending number per offer so the shop can see how many coupons
 * were issued. Redis INCR is atomic, so two visitors at the same moment get 42
 * and 43 — never 42 twice.
 *
 * Zero dependencies on purpose: Upstash is reached over its REST API with the
 * global fetch, so the project stays free of package.json / node_modules.
 *
 * Ship-safe: with no env vars configured this returns 503 and the client falls
 * back to a local SP-9xxx code. Adding the env vars later starts real
 * sequencing with no redeploy.
 */

/* Only these offers get a counter. Without an allowlist anyone could POST
   arbitrary names and litter the database with junk keys. */
var OFFERS = { screen: 1, kb: 1, idf: 1 };

/* Read through the allowlist without the prototype chain. A plain object literal
   inherits from Object.prototype, so OFFERS['toString'], OFFERS['constructor'],
   OFFERS['__proto__'] and every other built-in all come back truthy, which let
   POST {"offer":"toString"} past the check and INCR a junk key, the exact thing
   the allowlist above exists to prevent. */
function isOffer(name) {
  return Object.prototype.hasOwnProperty.call(OFFERS, name);
}

/* Abuse cap. Inflating the counter would destroy the one metric this whole
   server exists to provide, so it matters more here than typical rate limits. */
var MAX_PER_IP_PER_HOUR = 5;

function env() {
  var url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token: token };
}

/* Upstash REST: /<cmd>/<arg>/<arg> ... -> {"result":<value>} */
function redis(cfg, parts) {
  var path = parts.map(encodeURIComponent).join('/');
  return fetch(cfg.url + '/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token },
    cache: 'no-store'
  }).then(function (r) {
    if (!r.ok) throw new Error('upstash ' + r.status);
    return r.json();
  }).then(function (j) { return j.result; });
}

/* The rate-limit key, and therefore the only thing protecting the counter.
 *
 * x-forwarded-for is a list the client can start: anything it sends arrives at the
 * FRONT, and the platform appends what it actually saw. Reading [0] let a caller
 * pick its own bucket by varying the header, so 5-per-hour was never reached.
 * The last entry is the one written by the closest proxy we trust, and x-real-ip
 * is set by the platform rather than forwarded, so it goes first. */
function clientIp(req) {
  var real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  var xf = req.headers['x-forwarded-for'];
  if (xf) {
    var hops = String(xf).split(',');
    return hops[hops.length - 1].trim();
  }
  return 'unknown';
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve({}); }
  }
  return new Promise(function (resolve) {
    var raw = '';
    req.on('data', function (c) { raw += c; if (raw.length > 2000) raw = raw.slice(0, 2000); });
    req.on('end', function () { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  /* A cached counter response would hand the same number to different people. */
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  var cfg = env();
  if (!cfg) return res.status(503).json({ error: 'counter_unconfigured' });

  var body = await readBody(req);
  var offer = typeof body.offer === 'string' ? body.offer : '';
  if (!isOffer(offer)) return res.status(400).json({ error: 'unknown_offer' });

  try {
    /* Rate limit first, so a flood is rejected before it can consume numbers. */
    var ipKey = 'pg:cpn:rl:' + clientIp(req);
    var hits = await redis(cfg, ['INCR', ipKey]);
    if (hits === 1) await redis(cfg, ['EXPIRE', ipKey, '3600']);
    if (hits > MAX_PER_IP_PER_HOUR) return res.status(429).json({ error: 'rate_limited' });

    var n = await redis(cfg, ['INCR', 'pg:cpn:seq:' + offer]);
    return res.status(200).json({ n: n, seq: true });
  } catch (e) {
    /* Counter unreachable — let the client issue its local fallback code. */
    return res.status(503).json({ error: 'counter_unavailable' });
  }
};
