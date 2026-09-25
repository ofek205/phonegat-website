#!/usr/bin/env node
/* gen-sitemap.js — כותב את sitemap.xml מהעמודים שבאמת קיימים.
 *
 * למה מחולל: הסייטמאפ נכתב ביד, והוא פיגר. הוא מנה 10 כתובות בזמן שהאתר החזיק
 * 63 עמודים, כלומר 53 עמודים שנבנו בעמל לא קיבלו את הסיגנל המפורש לגוגל.
 * עמוד נכנס לסייטמאפ אוטומטית מרגע שהוא קיים, ולכן אין מה לשכוח.
 *
 * ההגדרה של "עמוד חי" זהה בדיוק לזו של בדיקה 18 בפריפלייט: אין בו noindex,
 * ושמו אינו מתחיל בקו תחתון. אילו היו שתי הגדרות הן היו נפרדות בשלב כלשהו,
 * והבדיקה הייתה מתלוננת על מה שהמחולל בדיוק כתב.
 *
 * lastmod נלקח מגיט ולא מזמן ההרצה. תאריך שמתעדכן בכל הרצה הוא תאריך שקרי,
 * וגוגל לומד להתעלם מסייטמאפ שכל הכתובות בו משתנות יחד בלי שהתוכן השתנה.
 *
 * ועדיין לא מספיק לקחת את הקומיט האחרון שנגע בקובץ. כל עמוד נושא עותק משלו של המסגרת,
 * ולכן שורה אחת בתפריט נכתבת ל-77 קבצים, וכולם "משתנים" באותו יום. זה קרה ב-13.9 וב-24.9:
 * פעמיים תוך 11 יום כל הכתובות בסייטמאפ קפצו יחד, ובפעם השנייה השינוי בעמוד רגיל היה
 * שורת התפריט וסקריפט מדידה, בלי מילה אחת של תוכן.
 *
 * לכן התאריך הוא היום שבו השינוי האחרון בתוכן נכנס לשרשרת הראשית (landingDates), ולא
 * היום שבו הוא נכתב: ענף שחיכה חמישה שבועות מתפרסם ביום המיזוג. תוכן הוא: הכותרת, התיאור, והטקסט
 * והקישורים שבתוך <main>, בלי קרוסלת המבצעים (שהיא מסגרת שמחולל אחר כותב לתוך main),
 * בלי סקריפטים, בלי style ובלי הערות. שינוי מחלקה או עיצוב שלא הזיז אף מילה לא נחשב.
 * ההגדרה היא contentKey() למטה, ובמקום אחד בלבד.
 */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var BASE = 'https://www.phonegat.co.il/';

function pages() {
  var out = [];
  (function walk(dir, rel) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (e.name !== 'api') walk(p, r); }
      else if (/\.html$/.test(e.name)) out.push(r);
    });
  })(PROTO, '');
  return out;
}

var crypto = require('crypto');

/* מונים שמחולל אחר כותב לתוך main של הרבה עמודים, ומשתנים בלי שהעמוד השתנה. בלי הרשימה
 * הזאת, הוספת דגם אחד ל-devices.json הזיזה את התאריך של 21 עמודי המכשיר, כי בכל אחד מהם
 * כתוב כמה דגמים הכלי מחזיק. זה נמצא ב-25.9.2026: אחרי שהמסגרת כבר לא נספרה, זה היה הדבר
 * היחיד שהחזיק את עמודי המכשיר ב-24.9.
 *
 * הרשימה מפורשת ולא כלל כללי כמו "התעלם ממספרים", כי מספרים הם בדיוק התוכן של עמוד
 * מכשיר: מחיר, נפח, סוללה. מונה חדש מהסוג הזה נוסף כאן בשמו, עם המחולל שכותב אותו. */
var CROSS_PAGE_COUNTERS = [
  /* gen-devices.js, בכל עמוד מכשיר, מתחת לכפתור ההשוואה */
  /הכלי מחזיק \d+ דגמים/g
];

/* מה נחשב תוכן. כל מה שמחוץ לזה הוא מסגרת, ושינוי בו לא מזיז את lastmod. */
function contentKey(html) {
  var src = String(html).replace(/\r/g, '');
  var title = (src.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  var desc = (src.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || '';
  var main = (src.match(/<main[\s\S]*?<\/main>/) || [])[0];
  if (!main) {
    /* עמוד בלי main: הגוף בלי הדר, ניווט ופוטר */
    main = ((src.match(/<body[\s\S]*?<\/body>/) || [])[0] || src)
      .replace(/<header[\s\S]*?<\/header>/g, '').replace(/<nav[\s\S]*?<\/nav>/g, '')
      .replace(/<footer[\s\S]*?<\/footer>/g, '');
  }
  main = main
    .replace(/<!-- pg-deals:section:start[\s\S]*?pg-deals:section:end -->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  var hrefs = (main.match(/href="[^"]*"/g) || []).join(' ');
  var text = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  CROSS_PAGE_COUNTERS.forEach(function (re) {
    text = text.replace(re, function (m) { return m.replace(/\d+/, 'N'); });
  });
  /* רק אותיות וספרות. שינוי שלא הוסיף, מחק או החליף אף אות או ספרה הוא פיסוק או רווח, ולא
     תוכן. נמצא כך: ב-24.9 תוקנה בתבנית הקלדה של תו אחד, "מפרט נבדק ב09/08" הפך ל"ב-09/08",
     וזה לבדו החזיק 16 עמודי מכשיר באותו יום. הקישורים עדיין מושווים במדויק, למעלה. */
  text = text.replace(/[^\p{L}\p{N}]+/gu, '');
  return crypto.createHash('sha1').update(title + '\n' + desc + '\n' + text + '\n' + hrefs).digest('hex');
}

/* תהליך git cat-file אחד לכל ההרצה. תהליך לכל גרסה היה עולה כדקה על Windows, ורוב
   העמודים דורשים רק כמה גרסאות אחורה עד שנמצא השינוי האחרון בתוכן. */
function blobReader(cwd) {
  var p = cp.spawn('git', ['cat-file', '--batch'], { cwd: cwd });
  var buf = Buffer.alloc(0), queue = [];
  p.stdout.on('data', function (chunk) { buf = Buffer.concat([buf, chunk]); drain(); });
  function drain() {
    while (queue.length) {
      var nl = buf.indexOf(10);
      if (nl < 0) return;
      var head = buf.slice(0, nl).toString();
      var m = head.match(/^\S+ \S+ (\d+)$/);
      if (!m) { buf = buf.slice(nl + 1); queue.shift()(null); continue; }
      var size = Number(m[1]);
      if (buf.length < nl + 1 + size + 1) return;
      var body = buf.slice(nl + 1, nl + 1 + size).toString('utf8');
      buf = buf.slice(nl + 1 + size + 1);
      queue.shift()(body);
    }
  }
  return {
    get: function (sha) { return new Promise(function (res) { queue.push(res); p.stdin.write(sha + '\n'); }); },
    close: function () { p.stdin.end(); }
  };
}

var ZERO = /^0+$/;
/* --why=<rel> מדפיס איזה קומיט קבע את התאריך של עמוד אחד. לאבחון, לא משנה את הפלט. */
var WHY = (process.argv.find(function (a) { return a.indexOf('--why=') === 0; }) || '').slice(6);

/* היום שבו כל קומיט נכנס לשרשרת הראשית של הענף, ולא היום שבו הוא נכתב.
 *
 * ההבדל נמצא ב-25.9.2026: ענף ריכוז החזיק קופי לעמודי השירות מ-18.8, והוא הגיע לאתר רק
 * ב-25.9. לפי תאריך הקומיט העמודים האלה "השתנו" חמישה שבועות לפני שמישהו ראה את השינוי.
 * גוגל צריך את היום שבו התוכן התפרסם, והקרוב ביותר לזה שגיט יודע הוא היום שבו הקומיט נכנס
 * לשרשרת הראשית: קומיט שנדחף ישירות נכנס בתאריך שלו, וקומיט שהגיע במיזוג נכנס בתאריך המיזוג.
 *
 * מעבר על השרשרת מהישן לחדש. כל קומיט בשרשרת "מושך" את כל מה שמגיע ממנו ועוד לא נחת, וכל
 * מה שנמשך נוחת בתאריך שלו. 519 קומיטים, ולכן זה מעבר אחד בזיכרון ולא קריאה לכל קומיט. */
function landingDates() {
  var land = {};
  try {
    var parents = {};
    cp.execSync('git rev-list --parents HEAD', { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n').forEach(function (l) { var p = l.trim().split(' '); if (p[0]) parents[p[0]] = p.slice(1); });
    var chain = cp.execSync('git log --first-parent --format=%H%x09%cs HEAD',
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n').filter(Boolean).map(function (l) { return l.split('\t'); }).reverse();
    chain.forEach(function (fc) {
      var stack = [fc[0]];
      while (stack.length) {
        var c = stack.pop();
        if (land[c]) continue;
        land[c] = fc[1];
        (parents[c] || []).forEach(function (p) { if (!land[p]) stack.push(p); });
      }
    });
  } catch (e) {
    console.error('⚠ לא ניתן לחשב תאריכי כניסה, נופל לתאריך הקומיט: ' + e.message);
  }
  return land;
}

/* התאריך של הקומיט האחרון ששינה את התוכן, לכל עמוד.
 *
 * git log --raw נותן לכל קומיט את ה-blob שלפניו ואת ה-blob שאחריו, ולכן ההשוואה היא מול
 * הגרסה שהקומיט באמת שינה, ולא מול הקומיט הקודם בזמן. ההבדל חשוב כשכמה ענפים נוגעים באותו
 * קובץ במקביל: הקודם בזמן יכול להיות מענף אחר, וההשוואה אליו הייתה ממציאה שינוי. */
async function lastModMap() {
  var map = {}, stats = { content: 0, created: 0, skippedChrome: 0 };
  var log;
  try {
    log = cp.execSync('git log --format=C%x09%H%x09%cs --raw --no-abbrev --no-renames --diff-filter=AM -- prototype',
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error('⚠ לא ניתן לקרוא היסטוריית גיט: ' + e.message);
    return { map: map, stats: stats };
  }
  var landing = landingDates();
  /* rel -> [{land, date, old, neu}] */
  var changes = {}, sha = null, date = null;
  log.split('\n').forEach(function (line) {
    if (line.indexOf('C\t') === 0) { var p = line.split('\t'); sha = p[1]; date = p[2].trim(); return; }
    var m = line.match(/^:\d+ \d+ ([0-9a-f]+) ([0-9a-f]+) [AM]\tprototype\/(.+\.html)$/);
    if (!m || !date) return;
    (changes[m[3]] = changes[m[3]] || []).push({ sha: sha, land: landing[sha] || date, date: date, old: m[1], neu: m[2] });
  });
  /* החדש לפי תאריך הכניסה ראשון. הלוג ממוין לפי תאריך הקומיט, וקומיט ישן שנכנס מאוחר היה
     נבדק אחרי קומיטים שנכנסו לפניו, והמעבר היה עוצר על אחד מהם. */
  Object.keys(changes).forEach(function (rel) {
    changes[rel].sort(function (x, y) { return x.land < y.land ? 1 : x.land > y.land ? -1 : (x.date < y.date ? 1 : x.date > y.date ? -1 : 0); });
  });

  var reader = blobReader(ROOT), keys = {};
  function keyOf(sha) {
    if (ZERO.test(sha)) return Promise.resolve(null);
    if (keys[sha] !== undefined) return Promise.resolve(keys[sha]);
    return reader.get(sha).then(function (body) { return (keys[sha] = body === null ? null : contentKey(body)); });
  }
  try {
    for (var rel of Object.keys(changes)) {
      var list = changes[rel];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (ZERO.test(c.old)) { map[rel] = c.land; stats.created++; break; }
        var ko = await keyOf(c.old), kn = await keyOf(c.neu);
        if (ko !== kn) { map[rel] = c.land; stats.content++; if (WHY && rel === WHY) console.log('  ' + rel + ': ' + c.sha.slice(0, 8) + ' נכתב ' + c.date + ', נכנס ' + c.land); break; }
        stats.skippedChrome++;
      }
    }
  } finally { reader.close(); }

  /* שינוי שעוד לא קומט: אם התוכן בעותק העבודה שונה מזה שב-HEAD, התאריך הוא היום */
  try {
    var dirty = cp.execSync('git status --porcelain -- prototype', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map(function (l) { return (l.match(/^.. prototype\/(.+\.html)$/) || [])[1]; }).filter(Boolean);
    for (var d of dirty) {
      var now = contentKey(fs.readFileSync(path.join(PROTO, d), 'utf8'));
      var head = null;
      try {
        head = contentKey(cp.execSync('git show HEAD:prototype/' + d,
          { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
      } catch (e) {}
      if (now !== head) map[d] = today();
    }
  } catch (e) {}
  return { map: map, stats: stats };
}

/* עמוד חדש שעוד לא קומט אינו בהיסטוריה. הוא מקבל את התאריך של היום, וזה נכון:
   זה באמת המועד שבו הוא נוצר. */
function today() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function url(rel) {
  return BASE + rel.replace(/index\.html$/, '').replace(/^\.\//, '');
}

/* עדיפות ותדירות לפי סוג העמוד. גוגל מתייחס לשניהם כרמז חלש בלבד, ולכן זה
   נשאר פשוט ומוסבר ולא מכויל יתר על המידה. */
function rank(rel) {
  if (rel === 'index.html') return { p: '1.0', f: 'weekly' };
  if (/^(accessibility|privacy)\.html$/.test(rel)) return { p: '0.3', f: 'yearly' };
  if (rel === 'contact/index.html') return { p: '0.9', f: 'monthly' };
  if (/^(phones|guides|compare)\/index\.html$/.test(rel)) return { p: '0.8', f: 'weekly' };
  if (/^phones\/[^/]+\/index\.html$/.test(rel)) return { p: '0.7', f: 'monthly' };
  /* עמודי המכשיר של אוזניות ושעון, כמו של טלפון. הכלים שבאותה תיקייה נשארים כמו שהיו. */
  if (/^(headphones|watches)\/(?!compare\/)[^/]+\/index\.html$/.test(rel)) return { p: '0.7', f: 'monthly' };
  if (/^compare\//.test(rel)) return { p: '0.6', f: 'monthly' };
  if (/^guides\//.test(rel)) return { p: '0.7', f: 'monthly' };
  return { p: '0.8', f: 'monthly' };
}

(async function () {
var lm = await lastModMap();
var mods = lm.map;
var all = pages();
var skipped = [];

var live = all.filter(function (rel) {
  var base = path.basename(rel);
  if (base.charAt(0) === '_') { skipped.push(rel + ' (מתחיל בקו תחתון)'); return false; }
  var src = fs.readFileSync(path.join(PROTO, rel), 'utf8');
  if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(src)) {
    skipped.push(rel + ' (noindex)');
    return false;
  }
  return true;
});

/* סדר יציב: לפי עדיפות יורדת ואז לפי כתובת. סייטמאפ שמשנה סדר בכל הרצה
   מייצר דיף רועש שקשה לקרוא בו מה באמת השתנה. */
live.sort(function (a, b) {
  var ra = rank(a), rb = rank(b);
  if (ra.p !== rb.p) return parseFloat(rb.p) - parseFloat(ra.p);
  return url(a) < url(b) ? -1 : 1;
});

var body = live.map(function (rel) {
  var r = rank(rel);
  return '  <url>\n' +
    '    <loc>' + url(rel) + '</loc>\n' +
    '    <lastmod>' + (mods[rel] || today()) + '</lastmod>\n' +
    '    <changefreq>' + r.f + '</changefreq>\n' +
    '    <priority>' + r.p + '</priority>\n' +
    '  </url>';
}).join('\n');

var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n';

var out = path.join(PROTO, 'sitemap.xml');
var before = fs.existsSync(out) ? (fs.readFileSync(out, 'utf8').match(/<loc>/g) || []).length : 0;
fs.writeFileSync(out, Buffer.from(xml, 'utf8'));

console.log('✓ sitemap.xml: ' + live.length + ' כתובות (היו ' + before + ')');
console.log('  ' + all.length + ' עמודי HTML נסרקו, ' + skipped.length + ' לא נכנסו');
skipped.forEach(function (s) { console.log('    · ' + s); });
var noGit = live.filter(function (r) { return !mods[r]; }).length;
if (noGit) console.log('  ' + noGit + ' עמודים עוד לא בהיסטוריית גיט וקיבלו את תאריך היום');
console.log('  lastmod: ' + lm.stats.content + ' מהשינוי האחרון בתוכן, ' + lm.stats.created + ' מיום היצירה, ' +
  lm.stats.skippedChrome + ' קומיטים של מסגרת בלבד דולגו');
console.log('\nהרצה: node .claude/preflight.js');
})();
