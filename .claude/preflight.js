#!/usr/bin/env node
/* PHONE GAT — בדיקות טרום-העלאה.
 *
 *   node .claude/preflight.js
 *
 * יוצא בקוד 1 אם משהו נשבר, כדי שאפשר יהיה לשרשר לפני push.
 *
 * כל בדיקה כאן קיימת בגלל תקלה אמיתית שקרתה או שמתועדת ב-CLAUDE.md כמלכודת.
 * אין תלויות npm בכוונה — הפרויקט נשאר בלי package.json.
 */
'use strict';
var fs = require('fs'), path = require('path');

/* ארגומנט אופציונלי = שורש חלופי, כדי שאפשר יהיה לבדוק את הבדיקות עצמן על עותק שבור */
var ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
var P = function (rel) { return path.join(ROOT, rel); };
var read = function (rel) { return fs.readFileSync(P(rel), 'utf8'); };

var PROD_HOST = 'www.phonegat.co.il';
var fails = [], warns = [], passes = [];
var ok = function (m) { passes.push(m); };
var bad = function (m) { fails.push(m); };
var warn = function (m) { warns.push(m); };

var html, vercel, serverCoupon;
try { html = read('prototype/index.html'); }
catch (e) { console.error('לא נמצא prototype/index.html'); process.exit(1); }
try { vercel = read('prototype/vercel.json'); } catch (e) { vercel = null; }
try { serverCoupon = read('prototype/api/coupon.js'); } catch (e) { serverCoupon = null; }

/* ---------- עוזרים ---------- */

/* מחלץ את גוף האובייקט שאחרי סמן פתיחה, בספירת סוגריים — עמיד לשינויי עיצוב קוד */
function objectAfter(src, marker) {
  var i = src.indexOf(marker);
  if (i < 0) return null;
  var start = src.indexOf('{', i);
  if (start < 0) return null;
  var depth = 0, inStr = null, j;
  for (j = start; j < src.length; j++) {
    var c = src[j], prev = src[j - 1];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return src.slice(start + 1, j); }
  }
  return null;
}

/* מפתחות ברמה הראשונה בלבד */
function topKeys(body) {
  var keys = [], depth = 0, inStr = null, buf = '', i;
  for (i = 0; i < body.length; i++) {
    var c = body[i], prev = body[i - 1];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '{' || c === '[') { depth++; continue; }
    if (c === '}' || c === ']') { depth--; continue; }
    if (depth === 0) {
      if (c === ':') { var m = buf.match(/([A-Za-z_$][\w$]*)\s*$/); if (m) keys.push(m[1]); buf = ''; }
      else if (c === ',') buf = '';
      else buf += c;
    }
  }
  return keys;
}

function countAll(src, re) { var m = src.match(re); return m ? m.length : 0; }

/* ---------- 1. כל בלוקי ה-JSON-LD מתפרשים ---------- */
var ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g) || [];
var faqSchemaCount = null, ldBroken = 0;
if (!ldBlocks.length) bad('לא נמצא אף בלוק JSON-LD — נתוני ה-schema של גוגל נעלמו');
ldBlocks.forEach(function (block, idx) {
  var body = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  try {
    var j = JSON.parse(body);
    (Array.isArray(j) ? j : [j]).forEach(function (o) {
      if (o && o['@type'] === 'FAQPage') faqSchemaCount = (o.mainEntity || []).length;
    });
  } catch (e) {
    ldBroken++;
    bad('בלוק JSON-LD #' + (idx + 1) + ' לא תקין (' + e.message + ') — גוגל יתעלם מכל ה-schema בבלוק');
  }
});
if (ldBlocks.length && !ldBroken) ok(ldBlocks.length + ' בלוקי JSON-LD תקינים');

/* ---------- 2. מספר שאלות ה-FAQ תואם לסכמה ---------- */
var faqSection = html.match(/<section id="faq"[\s\S]*?<\/section>/);
if (!faqSection) {
  warn('לא נמצא מקטע ה-FAQ — לא ניתן להשוות לסכמה');
} else {
  var visible = countAll(faqSection[0], /<details/g);
  if (faqSchemaCount === null) {
    bad('יש ' + visible + ' שאלות בדף אבל אין סכמת FAQPage — הכוכבים בגוגל ייעלמו');
  } else if (visible !== faqSchemaCount) {
    bad('אי-התאמה ב-FAQ: ' + visible + ' שאלות בדף מול ' + faqSchemaCount +
        ' בסכמה — גוגל יראה תוכן שלא קיים בדף (או להיפך)');
  } else {
    ok('FAQ מסונכרן: ' + visible + ' שאלות בדף ובסכמה');
  }
}

/* ---------- 3. המלכודת מ-CLAUDE.md: מבצע בלקוח שאינו ברשימת ההיתר בשרת ---------- */
var clientOffersBody = objectAfter(html, 'var OFFERS={');
var clientOffers = clientOffersBody ? topKeys(clientOffersBody) : [];
var serverOffers = [];
if (serverCoupon) {
  var so = objectAfter(serverCoupon, 'var OFFERS');
  if (so) serverOffers = topKeys(so);
}
if (!clientOffers.length) warn('לא זוהו מבצעי קופון בלקוח — ייתכן ששונה מבנה הקוד');
else if (!serverOffers.length) warn('לא זוהתה רשימת ההיתר ב-api/coupon.js');
else {
  var missing = clientOffers.filter(function (k) { return serverOffers.indexOf(k) < 0; });
  if (missing.length) {
    bad('מבצע "' + missing.join('", "') + '" קיים בלקוח אך חסר ברשימת ההיתר ב-api/coupon.js — ' +
        'השרת יחזיר 400, הלקוח ייפול בשקט לטווח 9xxx, והמבצע לא ייספר בכלל (אין שגיאה גלויה למשתמש)');
  } else {
    ok('מבצעי הקופון מסונכרנים בין הלקוח לשרת (' + clientOffers.join(', ') + ')');
  }
  /* קידומת כפולה תגרום לשני מבצעים להתנגש באותו מרחב מספרים */
  var prefixes = {}, dupPrefix = [];
  (clientOffersBody.match(/prefix:'([A-Z]{2}-)'/g) || []).forEach(function (m) {
    var p = m.match(/'([A-Z]{2}-)'/)[1];
    if (prefixes[p]) dupPrefix.push(p); else prefixes[p] = 1;
  });
  if (dupPrefix.length) bad('קידומת קופון כפולה: ' + dupPrefix.join(', ') + ' — שני מבצעים יתנגשו באותו מספור');
  else ok('קידומות הקופון ייחודיות');

  /* מפתח localStorage כפול = מבצע אחד ידרוס את הקוד של האחר */
  var lsKeys = {}, dupLs = [];
  (clientOffersBody.match(/key:'([\w]+)'/g) || []).forEach(function (m) {
    var k = m.match(/'([\w]+)'/)[1];
    if (lsKeys[k]) dupLs.push(k); else lsKeys[k] = 1;
  });
  if (dupLs.length) bad('מפתח localStorage כפול: ' + dupLs.join(', ') + ' — מבצע אחד ידרוס את הקוד של האחר');
  else ok('מפתחות ה-localStorage ייחודיים');
}

/* טריגר בדף שמצביע למבצע שלא קיים */
var triggers = (html.match(/data-pg-coupon="([^"]*)"/g) || []).map(function (m) {
  return m.match(/"([^"]*)"/)[1];
}).filter(function (v) { return v !== ''; });
var unknownTrig = triggers.filter(function (t) { return clientOffers.indexOf(t) < 0; });
if (unknownTrig.length) bad('כפתור מצביע למבצע שלא מוגדר: ' + unknownTrig.join(', '));
else if (triggers.length) ok('כל כפתורי הקופון מצביעים למבצעים קיימים');

/* ---------- 4. הגנות סביבת הטסטים לא הוסרו בטעות ---------- */
if (html.indexOf('window.PG_PROD') < 0) {
  bad('מזהה הסביבה (PG_PROD) נעלם — בדיקות ב-staging יזהמו את GA4, ישלחו מיילים אמיתיים ויבזבזו מספרי קופון');
} else {
  ok('מזהה הסביבה קיים');
  var gtmLine = html.match(/<script>if\(window\.PG_PROD[^\n]*/);
  if (!gtmLine) bad('GTM לא מוגן ב-PG_PROD — תנועת בדיקות תיספר ב-GA4 כלקוחות אמיתיים');
  else ok('GTM נטען רק בפרודקשן');
  if (!/if\(!window\.PG_PROD\)return Promise\.resolve\(null\)/.test(html))
    bad('מונה הקופונים לא מוגן — בדיקה תבזבז מספר קופון אמיתי ותשבש את המדד');
  else ok('מונה הקופונים מוגן מבדיקות');
}

/* ---------- 5. כתובות: canonical לפרודקשן, אין localhost שנשכח ---------- */
var canon = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
if (!canon) bad('אין תג canonical');
else if (canon[1].indexOf(PROD_HOST) < 0) bad('canonical לא מצביע ל-' + PROD_HOST + ' (' + canon[1] + ')');
else ok('canonical מצביע לפרודקשן');

var ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/);
if (ogUrl && ogUrl[1].indexOf(PROD_HOST) < 0) bad('og:url לא מצביע ל-' + PROD_HOST + ' (' + ogUrl[1] + ')');

var strayLocal = html.match(/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)[:\/][^\s"'<>]*/g);
if (strayLocal) bad('נשארה כתובת מקומית בקוד: ' + strayLocal.slice(0, 3).join(', '));
else ok('אין כתובות localhost בקוד');

/* ---------- 6. vercel.json תקין ומכיל noindex לסביבות טסט ---------- */
if (!vercel) warn('לא נמצא prototype/vercel.json');
else {
  try {
    var vj = JSON.parse(vercel);
    ok('vercel.json תקין');
    var hasNoindex = JSON.stringify(vj).indexOf('X-Robots-Tag') > -1;
    if (!hasNoindex) warn('אין כלל X-Robots-Tag — כתובת ה-staging עלולה להיכנס לאינדקס של גוגל');
    else ok('יש noindex לסביבות טסט ב-vercel.json');
  } catch (e) {
    bad('vercel.json לא תקין (' + e.message + ') — הפריסה כולה תיכשל');
  }
}

/* ---------- 7. שלמות בסיסית של תגי accordion ---------- */
var opens = countAll(html, /<details(?=[\s>])/g), closes = countAll(html, /<\/details>/g);
if (opens !== closes) bad('תגי details לא מאוזנים: ' + opens + ' נפתחו, ' + closes + ' נסגרו');
else ok('תגי details מאוזנים (' + opens + ')');

/* ---------- 8. כל דף שטוען GTM חייב לגדר אותו ----------
 * המדריך נוצר כקובץ נפרד עם head משלו, ולכן קיבל GTM לא מגודר בלי שאף בדיקה תפסה את זה.
 * בדיקה 4 מסתכלת רק על index.html; זו סורקת כל דף, כדי שהדף הבא לא יחזור על התקלה. */
var pagesDir = P('prototype'), pageFiles = [];
try {
  pageFiles = fs.readdirSync(pagesDir).filter(function (f) { return /\.html$/.test(f); });
} catch (e) { warn('לא ניתן לקרוא את תיקיית prototype לסריקת דפים'); }

var ungated = [], guardless = [], scanned = 0;
pageFiles.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
  if (src.indexOf('googletagmanager.com/gtm.js') < 0) return;   /* אין GTM, אין מה לגדר */
  scanned++;
  if (src.indexOf('window.PG_PROD=') < 0) guardless.push(f);
  if (!/if\(window\.PG_PROD\|\|location\.search/.test(src)) ungated.push(f);
});
if (guardless.length) {
  bad('דפים ללא מזהה סביבה: ' + guardless.join(', ') +
      ' — כל אחד מהם טוען GTM ואין לו PG_PROD להיתלות בו');
}
if (ungated.length) {
  bad('GTM לא מגודר בדפים: ' + ungated.join(', ') +
      ' — ביקור בדיקה בהם ייספר ב-GA4 כלקוח אמיתי, וזה נתון שאי אפשר להחזיר');
}
if (scanned && !ungated.length && !guardless.length) {
  ok('כל ' + scanned + ' הדפים שטוענים GTM מגודרים ב-PG_PROD');
}

/* canonical בכל דף תוכן, לא רק בדף הבית */
var badCanon = [];
pageFiles.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
  var c = src.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  if (c && c[1].indexOf(PROD_HOST) < 0) badCanon.push(f + ' (' + c[1] + ')');
});
if (badCanon.length) bad('canonical לא מצביע לפרודקשן: ' + badCanon.join(', '));
else if (pageFiles.length) ok('כל ה-canonical מצביעים לפרודקשן');

/* ---------- 9. JSON-LD תקין בכל דף, לא רק בדף הבית ----------
 * בדיקה 1 בודקת את index.html בלבד. משהוסיפו schema למדריך, בלוק שבור שם היה עובר בשקט
 * וגוגל היה מתעלם מכל ה-schema של הדף. */
var ldTotal = 0, ldBadPages = [];
pageFiles.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
  var blocks = src.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g) || [];
  blocks.forEach(function (b, i) {
    var body = b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    try { JSON.parse(body); ldTotal++; }
    catch (e) { ldBadPages.push(f + ' #' + (i + 1) + ' (' + e.message.slice(0, 40) + ')'); }
  });
});
if (ldBadPages.length) bad('JSON-LD שבור: ' + ldBadPages.join(', ') + ' — גוגל יתעלם מכל ה-schema בבלוק');
else if (ldTotal) ok(ldTotal + ' בלוקי JSON-LD תקינים בכל הדפים');

/* מפרסם שמוזכר ב-@id אך לא מוגדר באותו דף — הפניה שגוגל לא בהכרח תפתור */
var unresolved = [];
pageFiles.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
  var refs = src.match(/"(?:publisher|worksFor)":\{"@id":"([^"]+)"\}/g) || [];
  refs.forEach(function (r) {
    var id = r.match(/"@id":"([^"]+)"/)[1];
    /* מוגדר = אותו @id מופיע גם עם name לידו */
    if (src.indexOf('"@id":"' + id + '","name"') < 0) unresolved.push(f + ' -> ' + id);
  });
});
if (unresolved.length) warn('ישות מוזכרת אך לא מוגדרת באותו דף: ' + unresolved.join(', '));
else if (pageFiles.length) ok('כל ההפניות ל-@id נפתרות בתוך הדף');

/* ---------- דוח ---------- */
console.log('\n[1mבדיקות טרום-העלאה — PHONE GAT[0m\n');
passes.forEach(function (m) { console.log('  [32m✓[0m ' + m); });
warns.forEach(function (m) { console.log('  [33m![0m ' + m); });
fails.forEach(function (m) { console.log('  [31m✗[0m ' + m); });
console.log('');
if (fails.length) {
  console.log('[31m[1m' + fails.length + ' בדיקות נכשלו — לא להעלות לפרודקשן[0m\n');
  process.exit(1);
}
console.log('[32m[1mהכול תקין' + (warns.length ? ' (' + warns.length + ' אזהרות)' : '') + '[0m\n');
