/* מחולל: קרוסלת המבצעים בעמודי הנחיתה.
 *
 * WHAT: copies the home page's deals-and-benefits carousel, with its offers working, onto the pages
 * people actually land on. Run it again after editing the carousel on the home page and every copy
 * catches up.
 *
 * WHY A GENERATOR AND NOT 23 EDITS: there is no build step here, so each page carries its own copy of
 * the chrome. Seven pieces have to travel together and one of them is 63KB of CSS that draws the
 * slides. Pasting that by hand 23 times guarantees the copies drift, which is exactly what happened
 * to the nav three times in one day before gen-nav.js existed. Everything below is lifted from
 * index.html AT RUN TIME, so this file can never become a second source of truth.
 *
 * THE SEVEN PIECES:
 *   1. <section id="deals">                     the markup, 6 slides            38KB
 *   2. its CSS dependency closure               ~440 rules, 24 keyframes        63KB
 *   3. the coupon popup markup (#pgCpnOv)       13 ids the controller needs      3KB
 *   4. the popup's CSS                          included in the same closure
 *   5. PGQR                                     the QR generator                11KB
 *   6. the carousel controller                                                   6KB
 *   7. the coupon controller                                                    11KB
 *
 * Pieces 3 to 5 are the ones a naive markup copy drops. The coupon controller opens with
 * `if(!ov)return`, so without the popup markup it exits SILENTLY and the four offer buttons do
 * nothing at all: no error, no console warning, nothing to see. preflight has no JS parser and would
 * not catch it either.
 *
 * RE-RUNNABLE: each inserted region is fenced with pg-deals:*:start / pg-deals:*:end markers, so a
 * second run replaces instead of adding a second copy. `node add-deals.js --remove` takes it all out
 * again, which matters because this port has already been reverted once.
 *
 * IDEMPOTENT BY DESIGN, and it refuses rather than guesses: a missing anchor, an anchor that matches
 * twice, or a page whose own CSS disagrees with the home page all stop the run.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'prototype');
const HOME = path.join(ROOT, 'index.html');

/* ---------------------------------------------------------------- the pages
 * The 26 people land on: 21 service and region pages plus 5 hubs, of 74.
 * Deliberately NOT the 20 device pages, 15 comparisons or 8 guides, which are reached after arriving.
 * Adding those would put the carousel on 66 of 71, which is not a selection.
 * accessibility.html and privacy.html cannot take it at all, they carry no header. */
const SERVICE = ['charging-port-repair-kiryat-gat', 'face-id-repair-kiryat-gat',
  'galaxy-a-battery-replacement-kiryat-gat', 'galaxy-a-screen-replacement-kiryat-gat',
  'iphone-repair-kiryat-gat', 'mobile-phone-repair-kiryat-gat', 'phone-back-glass-repair-kiryat-gat',
  'phone-battery-replacement-kiryat-gat', 'phone-camera-repair-kiryat-gat', 'phone-repair-beer-tuvia',
  'phone-repair-har-hevron', 'phone-repair-hof-ashkelon', 'phone-repair-kiryat-malachi',
  'phone-repair-lachish', 'phone-repair-mate-yehuda', 'phone-repair-shafir', 'phone-repair-yoav',
  'phone-screen-replacement-kiryat-gat', 'phone-speaker-microphone-repair-kiryat-gat',
  'redmi-repair-kiryat-gat', 'xiaomi-repair-kiryat-gat'];
const HUBS = ['phone-problems', 'phones', 'compare', 'contact', 'phones/compare'];
const PAGES = SERVICE.concat(HUBS);

/* ---------------------------------------------------------------- lifting from index.html */
function balanced(src, from, openRe, closeTag) {
  let depth = 0;
  for (const m of src.slice(from).matchAll(openRe)) {
    if (m[0] === closeTag) { if (--depth === 0) return src.slice(from, from + m.index + closeTag.length); }
    else depth++;
  }
  throw new Error('unbalanced ' + closeTag + ' from offset ' + from);
}

function at(src, needle, what) {
  const n = src.split(needle).length - 1;
  if (n !== 1) throw new Error(what + ': expected exactly one "' + needle + '", found ' + n);
  return src.indexOf(needle);
}

/* the whole <script> block that contains a given marker */
function scriptBlock(src, needle, what) {
  const i = at(src, needle, what);
  const open = src.lastIndexOf('<script', i);
  const close = src.indexOf('</script>', i);
  if (open < 0 || close < 0) throw new Error(what + ': no enclosing script block');
  return src.slice(open, close + 9);
}

/* ---------------------------------------------------------------- the CSS closure
 * The slides are illustrated in pure CSS across 145 class names, so choosing rules by eye would
 * quietly drop half the drawing. This walks the dependency graph instead: every rule whose selector
 * mentions a name used in the markup, then every @keyframes those rules animate, repeated until
 * nothing new appears. */
function parseCss(src) {
  const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const rules = [];
  (function walk(css, media) {
    let i = 0;
    while (i < css.length) {
      const at2 = css.indexOf('@', i), brace = css.indexOf('{', i);
      if (brace < 0) break;
      if (at2 >= 0 && at2 < brace) {
        let d = 0, j = css.indexOf('{', at2), k = j;
        for (; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}') { if (--d === 0) break; } }
        const head = css.slice(at2, j).trim(), body = css.slice(j + 1, k);
        if (/^@media/.test(head)) walk(body, media ? media + ' and ' + head.replace(/^@media\s*/, '') : head);
        else rules.push({ sel: head, body, media, atrule: true });
        i = k + 1;
      } else {
        const close = css.indexOf('}', brace);
        if (close < 0) break;
        rules.push({ sel: css.slice(i, brace).trim(), body: css.slice(brace + 1, close), media, atrule: false });
        i = close + 1;
      }
    }
  })(styles, null);
  return rules;
}

function namesIn(markup) {
  const classes = new Set();
  [...markup.matchAll(/class="([^"]+)"/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && classes.add(c)));
  return { classes, ids: new Set([...markup.matchAll(/id="([^"]+)"/g)].map(m => m[1])) };
}

/* Classes that only ever exist AFTER a controller runs, so they appear nowhere in the markup.
 *
 * This is not a detail. The pause button is built in JS, and `.car-pause` is the only name in its
 * seven CSS rules, so a markup-only closure misses every one of them: the button came across as an
 * unstyled 9px block showing BOTH the play and the pause icon at once. The coupon themes survived the
 * same trap purely by luck, because `.t-olive .pg-cpn-hd` also names a class that IS in the markup.
 * Luck is not a mechanism, so the JS is read for names too. */
function namesInJs(js) {
  const classes = new Set(), ids = new Set();
  [...js.matchAll(/className\s*=\s*['"]([^'"]+)['"]/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && classes.add(c)));
  [...js.matchAll(/classList\.(?:add|remove|toggle)\(\s*['"]([^'"]+)['"]/g)].forEach(m => classes.add(m[1]));
  /* markup built as a string, e.g. innerHTML='<svg class="ic-pause">' */
  [...js.matchAll(/class=\\?["']([a-zA-Z0-9 _-]+)\\?["']/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && classes.add(c)));
  [...js.matchAll(/id=\\?["']([a-zA-Z0-9_-]+)\\?["']/g)].forEach(m => ids.add(m[1]));
  return { classes, ids };
}

function mergeNames(a, b) {
  return { classes: new Set([...a.classes, ...b.classes]), ids: new Set([...a.ids, ...b.ids]) };
}

/* Seeding from JS cuts the other way for generic names. The coupon controller toggles `open`, `ok`,
 * `done` and `paused`, and a bare `.open{...}` lifted from the home page would land on the nav
 * panels, which gen-nav also opens with `.open`. So a JS-derived name is only trusted when no target
 * page uses it. The component-scoped rules (`.pg-cpn-ov.t-olive .pg-cpn-hd`) arrive anyway through
 * the markup names, so nothing real is lost. */
function filterJsNames(jsNames, markupNames, pageClasses) {
  const kept = new Set(), dropped = [];
  for (const c of jsNames.classes) {
    if (markupNames.classes.has(c)) continue;
    if (pageClasses.has(c)) { dropped.push(c); continue; }
    kept.add(c);
  }
  return { names: { classes: kept, ids: new Set() }, dropped };
}

/* animation shorthand keywords, so timing functions are not mistaken for keyframe names */
const KF_NOISE = /^(none|infinite|alternate|alternate-reverse|forwards|backwards|both|linear|ease|ease-in|ease-out|ease-in-out|normal|reverse|paused|running|steps|cubic-bezier|step-start|step-end)$/;

function closure(rules, names) {
  const { classes, ids } = names;
  const touches = sel => {
    for (const c of classes) if (sel.includes('.' + c)) return true;
    for (const i of ids) if (sel.includes('#' + i)) return true;
    return false;
  };
  const picked = new Set(), kfWanted = new Set();
  let grew = true, rounds = 0;
  while (grew && rounds < 8) {
    grew = false; rounds++;
    rules.forEach((r, idx) => {
      if (picked.has(idx) || r.atrule || !touches(r.sel)) return;
      picked.add(idx); grew = true;
      [...r.body.matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)].forEach(a =>
        a[1].split(',').forEach(part => part.trim().split(/\s+/).forEach(tok => {
          if (/^[a-zA-Z_][\w-]*$/.test(tok) && !KF_NOISE.test(tok)) kfWanted.add(tok);
        })));
    });
  }
  const kfIdx = [];
  rules.forEach((r, idx) => {
    if (r.atrule && /^@keyframes/.test(r.sel) && kfWanted.has(r.sel.replace(/^@keyframes\s+/, '').trim())) kfIdx.push(idx);
  });
  return { picked: [...picked].sort((a, b) => a - b), kfIdx, rounds };
}

const norm = s => s.replace(/\s+/g, ' ').trim();
const ruleKey = r => (r.media ? norm(r.media) + ' || ' : '') + norm(r.sel);

/* Re-emit in source order, restoring each rule's @media wrapper and grouping neighbours that share
 * one, so the result reads like the original instead of repeating @media a hundred times. */
function emitCss(rules, idxs) {
  const out = [];
  let open = null;
  for (const i of idxs) {
    const r = rules[i];
    if (r.media !== open) {
      if (open) out.push('}');
      if (r.media) out.push(r.media + '{');
      open = r.media;
    }
    out.push(r.sel + '{' + r.body + '}');
  }
  if (open) out.push('}');
  return out.join('\n');
}

/* ---------------------------------------------------------------- inherited context
 * A dependency closure can carry rules. It cannot carry what the section INHERITS from the page
 * around it, and this section inherits its typeface: nothing inside it declares one, so on the home
 * page it takes the sans from body. Every content page carries
 *     h1,h2,h3,h4{...font-family:var(--serif);font-weight:500}
 * which the home page does not have at all, so the ported carousel came out in the editorial serif at
 * weight 500. That serif is right for prose in main and wrong for a promotional module, and the
 * headline is the first thing anyone reads.
 *
 * It comes down to two global heading rules that differ between the two kinds of page:
 *     index.html      h1,h2,h3    {line-height:1.15;font-weight:800}                  sans by inheritance
 *     content pages   h1,h2,h3,h4 {line-height:1.18;font-weight:500;font-family:serif}
 *
 * Those font declarations are gone now. On 15.8.2026 the editorial serif was retired and every page
 * states the same heading rule as index.html, so the reset had become a restatement of the default.
 * Verified by re-running the computed-style diff against the home page: still zero differences.
 *
 * What remains is not redundant. /phones/compare/ deliberately sets main .btn{white-space:normal} so
 * Hebrew labels can wrap, and that outranks the site's .btn, so the carousel's buttons broke onto two
 * lines there and nowhere else. If a page ever again styles something this section inherits, the fix
 * belongs here, scoped by id so it outranks an element-level rule and touches nothing outside. */
const CONTEXT_RESET = [
  '/* ב-/phones/compare/ יש main .btn{white-space:normal} במכוון, כדי שתוויות עבריות ישברו לשתי שורות.',
  '   הכלל גובר על .btn של האתר, ולכן כפתורי הקרוסלה נשברו שם ולא בשאר העמודים. */',
  '#deals .btn{white-space:nowrap}'
].join('\n');

/* ---------------------------------------------------------------- path rewriting
 * The home page sits at the root, so `logos/cellcom.png` resolves. Every target page sits one
 * directory down, where the same string becomes /<page>/logos/cellcom.png and 404s. A missing image
 * does not throw, so this would ship as a carousel with holes where the photos are and nothing in
 * the console. Root-relative is also the idiom the subpages already use for /logo-mark.png. */
const ABS = /^(https?:|\/\/|\/|data:|#|mailto:|tel:|javascript:|\{)/;
function rootRelative(text) {
  let n = 0;
  const fix = u => { if (ABS.test(u.trim()) || !u.trim()) return u; n++; return '/' + u.trim(); };
  let out = text
    .replace(/\b(src|href|poster)="([^"]*)"/g, (m, a, u) => a + '="' + fix(u) + '"')
    /* srcset is comma separated and each entry may carry a descriptor */
    .replace(/\bsrcset="([^"]*)"/g, (m, v) => 'srcset="' + v.split(',').map(part => {
      const bits = part.trim().split(/\s+/);
      if (!bits[0]) return part;
      bits[0] = fix(bits[0]);
      return bits.join(' ');
    }).join(', ') + '"')
    .replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, u) => 'url(' + q + fix(u) + q + ')')
    /* the two offer photos live in the OFFERS map, not in markup */
    .replace(/\bimg:'([^']+)'/g, (m, u) => "img:'" + fix(u) + "'");
  return { text: out, n };
}

/* ---------------------------------------------------------------- write helpers */
function eolOf(text) {
  return (text.match(/\r\n/g) || []).length > (text.match(/(?<!\r)\n/g) || []).length ? '\r\n' : '\n';
}

/* Fence every inserted region so a second run replaces it and --remove can take it out cleanly.
 * Same convention as gen-nav.js, for the same reason: a hand-editable copy in 23 files drifts. */
const fence = (name, body, eol) =>
  '<!-- pg-deals:' + name + ':start  נוצר על ידי .claude/tools/add-deals.js. אל תערוך ידנית. -->' + eol +
  body + eol +
  '<!-- pg-deals:' + name + ':end -->';

function stripFence(text, name) {
  const re = new RegExp('[ \\t]*<!-- pg-deals:' + name + ':start[\\s\\S]*?pg-deals:' + name + ':end -->[ \\t]*(\\r?\\n)?', 'g');
  return text.replace(re, '');
}

function insertBefore(text, anchor, block, what, rel, eol) {
  const n = text.split(anchor).length - 1;
  if (n !== 1) throw new Error(rel + ': ' + what + ' anchor matched ' + n + ' times');
  return text.replace(anchor, block + eol + eol + anchor);
}

/* ---------------------------------------------------------------- main */
function main() {
  const remove = process.argv.includes('--remove');
  /* --only=<page> runs a single page. The first port of this section went out to 23 files at once and
   * had to be reverted from all 23; proving it on one page first costs one run. */
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
  const home = fs.readFileSync(HOME, 'utf8');

  /* --- lift --- */
  const deals = balanced(home, at(home, '<section id="deals"', 'deals section'), /<section\b|<\/section>/g, '</section>');
  const popup = balanced(home, at(home, '<div class="pg-cpn-ov"', 'coupon popup'), /<div\b|<\/div>/g, '</div>');
  const qrJs = scriptBlock(home, 'root.PGQR=PGQR;', 'PGQR');
  const carJs = scriptBlock(home, "var root=document.getElementById('deals')", 'carousel controller');
  const cpnJs = scriptBlock(home, "var ov=document.getElementById('pgCpnOv')", 'coupon controller');

  const homeRules = parseCss(home);
  const markupNames = namesIn(deals + popup);

  /* every class any target page uses, so a generic JS-derived name can be refused */
  const pageClasses = new Set();
  PAGES.forEach(rel => {
    const s = fs.readFileSync(path.join(ROOT, rel.replace(/\//g, path.sep), 'index.html'), 'utf8');
    [...s.matchAll(/class="([^"]+)"/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && pageClasses.add(c)));
  });
  const jsFilter = filterJsNames(namesInJs(carJs + cpnJs), markupNames, pageClasses);
  const cl = closure(homeRules, mergeNames(markupNames, jsFilter.names));

  /* sanity: the pieces the controllers reach for must actually be in what we are moving */
  const needIds = ['pgCpnOv', 'pgCpnX', 'pgCpnDev', 'pgCpnTitle', 'pgCpnDesc', 'pgCpnPrice', 'pgCpnCopy',
    'pgCpnCode', 'pgCpnCopied', 'pgCpnQrBox', 'pgCpnQr', 'pgCpnGo', 'pgCpnFine'];
  const missing = needIds.filter(id => !popup.includes('id="' + id + '"'));
  if (missing.length) throw new Error('coupon popup markup is missing: ' + missing.join(', '));
  if (!/class="car-track"/.test(deals) || !/class="car-vp"/.test(deals) || !/class="car-dots"/.test(deals))
    throw new Error('carousel markup is missing a part the controller queries');
  const slides = (deals.match(/<article class="slide/g) || []).length;
  if (!slides) throw new Error('no slides found in the deals section');
  assertNoEmDashInProse(deals, 'deals section');
  assertNoEmDashInProse(popup, 'coupon popup');

  /* An id arriving on a page that already uses it makes getElementById answer with the wrong element,
   * and nothing throws. Both controllers address their parts by id, so this has to be clean. */
  const incomingIds = [...namesIn(deals + popup).ids];

  /* --- rewrite paths --- */
  const css = emitCss(homeRules, cl.picked.concat(cl.kfIdx));
  const R = {
    deals: rootRelative(deals), css: rootRelative(css), popup: rootRelative(popup),
    cpnJs: rootRelative(cpnJs), carJs: rootRelative(carJs), qrJs: rootRelative(qrJs)
  };
  const rewrites = Object.values(R).reduce((n, r) => n + r.n, 0);

  console.log('lifted from index.html:');
  console.log('  section markup   ' + kb(deals) + '   ' + slides + ' slides, ' +
    (deals.match(/data-pg-coupon=/g) || []).length + ' coupon buttons');
  console.log('  CSS closure      ' + kb(css) + '   ' + cl.picked.length + ' rules + ' + cl.kfIdx.length +
    ' keyframes (' + cl.rounds + ' passes)');
  console.log('  popup markup     ' + kb(popup));
  console.log('  PGQR             ' + kb(qrJs));
  console.log('  carousel JS      ' + kb(carJs));
  console.log('  coupon JS        ' + kb(cpnJs));
  console.log('  paths made root-relative: ' + rewrites);
  console.log('  class names seeded from JS: ' + [...jsFilter.names.classes].join(', '));
  if (jsFilter.dropped.length)
    console.log('  refused (target pages use them): ' + jsFilter.dropped.join(', '));
  console.log('');

  let done = 0, removed = 0;
  const list = only ? PAGES.filter(p => p === only) : PAGES;
  if (only && !list.length) throw new Error('--only=' + only + ' is not one of the 23 target pages');
  for (const rel of list) {
    const file = path.join(ROOT, rel.replace(/\//g, path.sep), 'index.html');
    const before = fs.readFileSync(file, 'utf8');
    const eol = eolOf(before);

    /* always strip first: that is what makes a re-run replace instead of stack */
    let t = before;
    ['css', 'section', 'js'].forEach(n => { t = stripFence(t, n); });
    const had = t.length !== before.length;

    if (remove) {
      if (had) { write(file, t, before, rel); removed++; console.log('  ' + rel + ': removed'); }
      continue;
    }

    const clash = incomingIds.filter(id => t.includes('id="' + id + '"'));
    if (clash.length) throw new Error(rel + ': id already in use on this page: ' + clash.join(', '));

    /* per-page CSS safety: drop rules the page already has, and STOP if any of them disagrees.
     * .btn, .cookie and .a11y-reset are shared chrome that every page already styles. Re-emitting an
     * identical rule is dead weight; re-emitting a DIFFERENT one would restyle every button on the
     * page, and nothing about the carousel would look wrong while it happened. */
    const theirs = new Map();
    parseCss(t).forEach(r => { if (!r.atrule) theirs.set(ruleKey(r), norm(r.body)); });
    const keep = [], conflicts = [];
    cl.picked.forEach(i => {
      const r = homeRules[i], k = ruleKey(r);
      if (!theirs.has(k)) { keep.push(i); return; }
      if (theirs.get(k) !== norm(r.body)) conflicts.push(k);
    });
    if (conflicts.length) throw new Error(rel + ': page disagrees with index.html on ' +
      conflicts.length + ' rule(s), first is ' + conflicts[0] + '. Reconcile before porting.');
    const pageCss = rootRelative(emitCss(homeRules, keep.concat(cl.kfIdx))).text + '\n' + CONTEXT_RESET;

    const cssBlock = fence('css', '<style>' + eol + pageCss + eol + '</style>', eol);
    const secBlock = fence('section', R.deals.text.split(/\r?\n/).join(eol), eol);
    const jsBlock = fence('js', [R.popup.text, R.qrJs.text, R.cpnJs.text, R.carJs.text]
      .join(eol).split(/\r?\n/).join(eol), eol);

    t = insertBefore(t, '</head>', cssBlock, 'css', rel, eol);
    /* just before the closing call to action: the reader has the information by then, and the offer
     * is the reason to act now. contact/ has no cta section, so it goes last inside main. */
    const secAnchor = t.includes('<section class="cta"') ? '<section class="cta"' : '</main>';
    t = insertBefore(t, secAnchor, secBlock, 'section', rel, eol);
    t = insertBefore(t, '</body>', jsBlock, 'js', rel, eol);

    write(file, t, before, rel);
    done++;
    console.log('  ' + rel + (had ? ': refreshed' : ': added') + '   +' + kb(t) .trim()+ ' page total, ' +
      keep.length + ' rules (' + (cl.picked.length - keep.length) + ' already there)');
  }

  console.log('');
  if (remove) console.log('carousel removed from ' + removed + ' pages');
  else console.log('carousel on ' + done + ' pages, all seven pieces, lifted from index.html');
}

function kb(s) { return String(Math.round(s.length / 1024) + 'KB').padStart(6); }

/* This project has mixed CRLF and LF per file with autocrlf on, so writing the wrong terminator turns
 * the whole file into a diff, about 4000 lines of noise around a real change. */
function write(file, after, before, rel) {
  const loneCR = s => (s.match(/\r(?!\n)/g) || []).length;
  if (loneCR(after) !== loneCR(before)) throw new Error(rel + ': line terminators damaged');
  fs.writeFileSync(file, after, 'utf8');
}

/* The em dash guard belongs on the markup only, and it has to mirror what check 13 actually counts:
 * that check strips <script>, <style> and HTML comments first, because index.html carries 59 em
 * dashes in English code comments that were deliberately left alone. A blanket count over the whole
 * file would therefore fail on every page for a reason the rule does not care about, which is how an
 * earlier version of this guard managed to be wrong on all 23. */
function assertNoEmDashInProse(markup, what) {
  const prose = markup.replace(/<!--[\s\S]*?-->/g, '');
  if (prose.includes('—')) throw new Error(what + ' carries an em dash in text a reader sees (check 13)');
}

main();
