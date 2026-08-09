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

/* תאריך הקומיט האחרון לכל קובץ, במעבר אחד על ההיסטוריה במקום קריאה לכל קובץ */
function lastModMap() {
  var map = {};
  try {
    var log = cp.execSync('git log --format=%cs --name-only --diff-filter=AM -- prototype',
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    var date = null;
    log.split('\n').forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (/^\d{4}-\d{2}-\d{2}$/.test(line)) { date = line; return; }
      var rel = line.replace(/^prototype\//, '');
      if (/\.html$/.test(rel) && !map[rel] && date) map[rel] = date;
    });
  } catch (e) {
    console.error('⚠ לא ניתן לקרוא היסטוריית גיט: ' + e.message);
  }
  return map;
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
  if (/^compare\//.test(rel)) return { p: '0.6', f: 'monthly' };
  if (/^guides\//.test(rel)) return { p: '0.7', f: 'monthly' };
  return { p: '0.8', f: 'monthly' };
}

var mods = lastModMap();
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
console.log('\nהרצה: node .claude/preflight.js');
