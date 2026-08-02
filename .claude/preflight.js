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
/* דפים שטוחים בשורש, ובנוסף עמודי שירות שיושבים כתיקייה עם index.html כדי לקבל כתובת עם לוכסן
 * סוגר (/iphone-repair-kiryat-gat/). הסריקה חייבת לרדת רמה אחת: readdirSync שטוח היה משאיר כל עמוד
 * כזה מחוץ לכל הבדיקות כאן, וזו בדיוק התקלה שבגללה הקובץ הזה נכתב מלכתחילה. */
var pagesDir = P('prototype'), pageFiles = [];
try {
  fs.readdirSync(pagesDir, { withFileTypes: true }).forEach(function (e) {
    if (e.isFile() && /\.html$/.test(e.name)) { pageFiles.push(e.name); return; }
    if (!e.isDirectory() || e.name === 'api') return;
    /* תיקיית נכסים (problems/, logos/) אינה עמוד; עמוד הוא תיקייה שיש בה index.html */
    if (fs.existsSync(path.join(pagesDir, e.name, 'index.html'))) pageFiles.push(e.name + '/index.html');
  });
} catch (e) { warn('לא ניתן לקרוא את תיקיית prototype לסריקת דפים'); }

/* עמוד עומק = כל עמוד שאינו בשורש. הנתיבים היחסיים שלו נפתרים אחרת, ולכן יש לו בדיקה משלו */
function isDeep(f) { return f.indexOf('/') > -1; }
function baseName(f) { return f.slice(f.lastIndexOf('/') + 1); }

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

/* canonical בכל דף תוכן, לא רק בדף הבית.
 * שלוש שכבות. הראשונה הייתה כאן מההתחלה, ושתי האחרות נולדו באודיט של 2.8.2026:
 * privacy.html ו-accessibility.html ישבו בסייטמאפ, מאונדקסים, בלי שום תגית canonical, והבדיקה
 * לא ראתה אותם כי היא בדקה רק דפים שכבר יש בהם תגית. תגית שמצביעה לדף אחר גרועה עוד יותר
 * מהיעדרה, כי הדף מוסר לגוגל במפורש שהוא עותק של משהו אחר. */
function pageUrl(f) {
  if (f === 'index.html') return 'https://' + PROD_HOST + '/';
  return 'https://' + PROD_HOST + '/' + f.replace(/\/index\.html$/, '/');
}
var badCanon = [], noCanon = [], notSelf = [];
pageFiles.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
  var c = src.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  if (!c) { noCanon.push(f); return; }
  if (c[1].indexOf(PROD_HOST) < 0) { badCanon.push(f + ' (' + c[1] + ')'); return; }
  if (c[1] !== pageUrl(f)) notSelf.push(f + ' → ' + c[1]);
});
if (badCanon.length) bad('canonical לא מצביע לפרודקשן: ' + badCanon.join(', '));
if (noCanon.length) bad('דפים בלי canonical: ' + noCanon.join(', ') +
    ' — בלי התגית גוגל בוחר לבד איזו כתובת היא המקורית');
if (notSelf.length) bad('canonical שמצביע לדף אחר: ' + notSelf.join(', ') +
    ' — הדף מצהיר בעצמו שהוא עותק, ולכן לא יאונדקס');
if (!badCanon.length && !noCanon.length && !notSelf.length && pageFiles.length) {
  ok('canonical בכל דף, מצביע לפרודקשן ולדף עצמו');
}

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

/* ---------- 10. מסגרת משותפת: הרכיבים שדף חדש שוכח ----------
 * אין שלב build, ולכן כל דף נושא עותק משלו של השומר, של תפריט הנגישות ושל באנר הקוקיז.
 * ככה נוצר הבאג המקורי: מדריך התקלות נבנה בלי PG_PROD ובלי תפריט נגישות, ואף בדיקה לא תפסה.
 * הבדיקות כאן הופכות שכחה כזאת לכשל גלוי במקום לפער שקט.
 *
 * דפי תוכן בלבד — לא privacy/accessibility, שהם מסמכים משפטיים קצרים ולא צריכים את הווידג'טים.
 * הרשימה נגזרת מהתיקייה ולא כתובה קשיח, אחרת דף חדש לא נבדק עד שמישהו יזכור לרשום אותו כאן. */
var LEGAL_PAGES = ['privacy.html', 'accessibility.html'];
var CONTENT_PAGES = pageFiles.filter(function (f) {
  return LEGAL_PAGES.indexOf(f) < 0 && baseName(f).charAt(0) !== '_';   /* _ = טיוטה מקומית */
});
var missingA11y = [], missingCookie = [], missingSW = [];
CONTENT_PAGES.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
  /* תפריט ההתאמות הוא דרישה רגולטורית, לא נוחות */
  if (src.indexOf('id="a11yTrigger"') < 0 || src.indexOf("var KEY='pg_a11y_v1'") < 0) missingA11y.push(f);
  /* בלי באנר, מי שנוחת מגוגל נשאר ב-denied ואין לו איך לאשר — הדף עיוור ב-GA4 */
  if (src.indexOf('id="cookieOk"') < 0) missingCookie.push(f);
  /* דף נחיתה הוא לעיתים הדף הראשון והיחיד שנפתח; בלי רישום כאן אין PWA בכלל */
  /* עמוד עומק חייב לרשום בנתיב שורשי (ראו בדיקה 14), ולכן שתי הצורות תקינות */
  if (!/register\((['"])\/?sw\.js\1/.test(src)) missingSW.push(f);
});
if (missingA11y.length) {
  bad('אין תפריט נגישות בדפים: ' + missingA11y.join(', ') +
      ' — תפריט ההתאמות נדרש בתקנות, ודף בלי כפתור מחייב את המשתמש לעבור לדף אחר כדי להגדיל טקסט');
} else ok('תפריט הנגישות קיים בכל דפי התוכן');
if (missingCookie.length) {
  bad('אין באנר קוקיז בדפים: ' + missingCookie.join(', ') +
      ' — מי שנוחת שם מחיפוש נשאר ב-analytics_storage denied ואין לו דרך לאשר, כלומר התנועה לא נמדדת');
} else ok('באנר הקוקיז קיים בכל דפי התוכן');
if (missingSW.length) {
  warn('אין רישום service worker בדפים: ' + missingSW.join(', ') + ' — מבקר שנוחת שם לא יקבל את האפליקציה');
} else ok('ה-service worker נרשם בכל דפי התוכן');

/* ---------- 11. התקן לכל דף: נגישות, מבנה, מסגרת, מובייל ----------
 * כל בדיקה כאן היא דבר שנשכח בדף אמיתי פעם אחת. הן זולות, סטטיות, וחלות אוטומטית על כל דף
 * חדש בתיקייה — כדי שהתקן יהיה מצב של הקוד ולא כוונה שצריך לזכור. */
function readPage(f) { try { return fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return null; } }
var ref = readPage('index.html') || '';

/* חתימת הניווט והפוטר של דף הבית — המסגרת המשותפת חייבת להיראות זהה בכל דף */
function navLabels(src) {
  var nav = (src.match(/<nav class="main"[\s\S]*?<\/nav>/) || [''])[0];
  return (nav.match(/>[^<>]+<\/a>/g) || []).map(function (s) { return s.slice(1, -4).trim(); });
}
var refNav = navLabels(ref).join('|');

var f_h1 = [], f_alt = [], f_lang = [], f_marks = [], f_skip = [], f_main = [],
    f_nav = [], f_footer = [], f_btn = [], f_bar = [];

CONTENT_PAGES.forEach(function (f) {
  var s = readPage(f); if (!s) return;

  /* כותרת ראשית אחת בדיוק — יותר מאחת מפצלת את נושא הדף בעיני גוגל */
  var h1 = (s.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) f_h1.push(f + ' (' + h1 + ')');

  /* alt לכל תמונה. alt="" מותר ונכון לדקורציה, חסר לגמרי אינו */
  var imgs = s.match(/<img\b[^>]*>/g) || [];
  var noAlt = imgs.filter(function (t) { return !/\salt=/.test(t); }).length;
  if (noAlt) f_alt.push(f + ' (' + noAlt + ' מתוך ' + imgs.length + ')');

  if (!/<html lang="he" dir="rtl">/.test(s)) f_lang.push(f);

  if (!/role="banner"/.test(s) || !/role="main"/.test(s) || !/role="contentinfo"/.test(s)) f_marks.push(f);

  /* הדילוג חייב להיות לוגי; left פיזי מציב אותו בצד הלא נכון ב-RTL */
  var skip = (s.match(/\.skip\{[^}]*\}/) || [''])[0];
  if (!/class="skip"/.test(s) || !/inset-inline-start/.test(skip)) f_skip.push(f);

  if (!/<main[^>]*tabindex="-1"/.test(s)) f_main.push(f);

  if (f !== 'index.html') {
    /* the page's own entry is an addition, not a mismatch — compare the rest */
    var mine = navLabels(s).filter(function (l) { return refNav.split('|').indexOf(l) > -1; }).join('|');
    if (mine !== refNav) f_nav.push(f);
  }

  if (f !== 'index.html') {
    if (!/facebook\.com\/phonegat/.test(s) || !/instagram\.com\/phonegat/.test(s) ||
        !/id="pwaCta"/.test(s) || !/סימן מסחר של סלקום/.test(s)) f_footer.push(f);
  }

  /* כפתורים: אותה צורה בכל האתר. גלולה בדף אחד ומלבן באחר נקרא כשני אתרים */
  var btn = (s.match(/^\.btn\{[^}]*\}/m) || [''])[0];
  if (!/border-radius:4px/.test(btn) || !/font-weight:700/.test(btn)) f_btn.push(f);

  /* הסרגל התחתון 70px; padding קטן ממנו מסתיר את סוף כל גלילה */
  /* only the value inside the ≤820px query counts — above that the bar is display:none, so the
     desktop base value is irrelevant and matching it first produced a phantom failure */
  var pad = (s.match(/@media\(max-width:820px\)\{[\s\S]{0,400}?body\{padding-block-end:calc\((\d+)px/) || [])[1];
  if (pad && +pad < 70) f_bar.push(f + ' (' + pad + 'px)');
});

function verdict(list, okMsg, badMsg, fatal) {
  if (!list.length) { ok(okMsg); return; }
  (fatal ? bad : warn)(badMsg + ': ' + list.join(', '));
}
verdict(f_h1,    'כותרת h1 אחת בכל דף',            'יותר מ-h1 אחת, או אפס', true);
verdict(f_alt,   'לכל התמונות יש alt',              'תמונות בלי alt', true);
verdict(f_lang,  'lang="he" dir="rtl" בכל דף',      'חסר lang/dir נכון', true);
verdict(f_marks, 'תגיות נחיתה בכל דף',              'חסרות תגיות נחיתה (banner/main/contentinfo)', true);
verdict(f_skip,  'קישור דילוג לוגי בכל דף',          'קישור דילוג חסר או משתמש ב-left פיזי', true);
verdict(f_main,  'main הוא יעד דילוג תקין',          'main בלי tabindex="-1"', true);
verdict(f_nav,   'הניווט זהה בכל הדפים',            'הניווט לא תואם ל-index.html', false);
verdict(f_footer,'הפוטר מלא בכל דפי התוכן',         'בפוטר חסר רשתות/כפתור אפליקציה/ויתור סימנים', false);
verdict(f_btn,   'הכפתורים בצורת האתר בכל דף',      'הכפתורים לא תואמים ל-index.html (4px/700)', false);
verdict(f_bar,   'התוכן מפנה את הסרגל התחתון',      'padding קטן מגובה הסרגל (70px)', false);

/* ---------- 12. הצהרות שיוצרות חשיפה משפטית ----------
 * שלושתן קרו. כל אחת עלתה בתיקון של דקה אחרי שנמצאה, ואפס אם נתפסת כאן. */
var claimFails = [];
pageFiles.forEach(function (f) {
  var s = readPage(f); if (!s) return;
  /* הבטחה גורפת שהדף עצמו מכחיש בהמשך */
  if (/אחריות על כל תיקון/.test(s)) claimFails.push(f + ': "אחריות על כל תיקון" גורף — נזקי נוזלים ללא אחריות');
  /* התניה בתקנון שלא מפורסם */
  if (/בכפוף לתקנון/.test(s) && !fs.existsSync(path.join(pagesDir, 'terms.html'))) {
    claimFails.push(f + ': "בכפוף לתקנון" ואין terms.html לקשר אליו');
  }
  /* מוסכמת המותג */
  if (/וואטסאפ/.test(s)) claimFails.push(f + ': "וואטסאפ" בעברית — המותג נכתב WhatsApp');
});
if (claimFails.length) bad('הצהרות בעייתיות: ' + claimFails.join(' · '));
else ok('אין הצהרות גורפות, תקנון רפאים או שם מותג בעברית');

/* ---------- 13. מקף ארוך בטקסט שהקורא רואה ----------
 * המקף הארוך (—) הוא הסימן הבולט ביותר לטקסט שנכתב במכונה, כי בעברית אף אחד לא מקליד אותו ביד.
 * הוא נוקה ידנית מכל הטקסט הגלוי ב-30/07 — ותוך יממה חזרו 22 מופעים להערות הקוד של אותו דף.
 * מסמך לא מחזיק כלל כזה; רק בדיקה מחזיקה.
 *
 * נבדק רק מה שקורא או זחלן רואה: טקסט, alt/title/content, ומחרוזות JSON-LD. הערות קוד לא נבדקות
 * במכוון — ב-index.html יש 59 מופעים בהערות אנגלית שהוחלט לא לגעת בהן, כדי לא להתנגש בסשן מקביל.
 *
 * מקף בינוני (–) בטווחים הוא טיפוגרפיה נכונה ולא נגזר ממנו כלום: א׳–ה׳, 9:00–18:30. */
var EM = '—';
var dashFails = [];
pageFiles.forEach(function (f) {
  var s = readPage(f); if (!s) return;
  /* מחרוזות JSON-LD נספרות, שאר ה-script וה-style יורדים יחד עם הערות ה-HTML */
  var ld = (s.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');
  var visible = s.replace(/<script[\s\S]*?<\/script>/gi, '')
                 .replace(/<style[\s\S]*?<\/style>/gi, '')
                 .replace(/<!--[\s\S]*?-->/g, '');
  /* טקסט חופשי + הערכים של התכונות שהקורא או גוגל רואים */
  var attrs = (visible.match(/(?:alt|title|content|aria-label|placeholder)="[^"]*"/gi) || []).join('\n');
  var text = visible.replace(/<[^>]+>/g, ' ');
  var n = countAll(text, /—/g) + countAll(attrs, /—/g) + countAll(ld, /—/g);
  if (n) dashFails.push(f + ' (' + n + ')');
});
if (dashFails.length) {
  bad('מקף ארוך (' + EM + ') בטקסט גלוי: ' + dashFails.join(', ') +
      ' — הסימן הבולט ביותר לטקסט שנכתב במכונה. פסיק, נקודה או נקודתיים במקומו');
} else ok('אין מקף ארוך בטקסט שהקורא רואה');

/* ---------- 14. עמוד עומק: נתיבים שורשיים בלבד ----------
 * כל האתר נכתב בנתיבים יחסיים (whatsapp-logo.png, index.html). עמוד שיושב ב-/slug/index.html
 * פותר כל אחד מהם לתיקייה של עצמו ומקבל 404. התמונות פשוט לא נטענות, וזה נראה מיד;
 * register('sw.js') לעומת זאת נכשל בשקט ומצמצם את ה-scope של ה-service worker לתיקייה אחת,
 * כלומר PWA שבור בלי שום סימן על המסך. לכן זו בדיקה ולא כלל במסמך. */
var pathFails = [], swFails = [];
CONTENT_PAGES.filter(isDeep).forEach(function (f) {
  var s = readPage(f); if (!s) return;
  var bad1 = [];
  (s.match(/\b(?:src|href)="([^"]+)"/g) || []).forEach(function (m) {
    var v = m.slice(m.indexOf('"') + 1, -1);
    if (/^(?:\/|#|https?:|mailto:|tel:|data:|\?)/.test(v)) return;
    if (bad1.indexOf(v) < 0) bad1.push(v);
  });
  if (bad1.length) pathFails.push(f + ': ' + bad1.slice(0, 4).join(', ') + (bad1.length > 4 ? ' ועוד ' + (bad1.length - 4) : ''));
  /* ה-scope נגזר מנתיב הקובץ, ולכן חייב להיות שורשי במפורש */
  if (/register\((['"])(?!\/)/.test(s)) swFails.push(f);
});
if (pathFails.length) {
  bad('נתיבים יחסיים בעמוד עומק: ' + pathFails.join(' · ') +
      ' — נפתרים לתוך תיקיית העמוד ומחזירים 404. נתיב שורשי (/…) בלבד');
} else ok('כל הנתיבים בעמודי העומק שורשיים');
if (swFails.length) {
  bad("ה-service worker נרשם בנתיב יחסי ב: " + swFails.join(', ') +
      " — ה-scope מצטמצם לתיקיית העמוד וה-PWA נשבר בשקט. register('/sw.js',{scope:'/'})");
} else ok('ה-service worker נרשם בנתיב שורשי');

/* ---------- 17. כללי ההשפעה של תפריט הנגישות קיימים בפועל ----------
 * בדיקה 10 מוודאת שהכפתור קיים. היא לא מוודאת שהוא עושה משהו, וזה בדיוק מה שנשבר:
 * המדריך העתיק את html.a11y-text-150 body אבל לא את html.a11y-text-150 עצמו, ולכן שורש הדף
 * נשאר 16px וכל מה שמוגדר ב-rem או ב-clamp לא זז. 12 מתוך 15 אלמנטים לא הגיבו ל-150%,
 * הכפתור הצהיר על הגדלה ולא סיפק אותה, וזו דרישה רגולטורית.
 *
 * ספירת שמות המחלקות לא הייתה תופסת את זה, כי השם מופיע בשתי הצורות. לכן ההשוואה היא על
 * הסלקטור המלא. נבדקים רק כללי המנוע (html.a11y-X ו-html.a11y-X body); כללים שמכוונים לרכיב
 * ספציפי מושמטים, כי לגיטימי שרכיב קיים בדף אחד ולא באחר. */
(function () {
  var engine = /(^|\})\s*(html\.a11y-[a-z0-9-]+(?: body)?)\s*\{/g, m, refRules = [];
  while ((m = engine.exec(ref))) if (refRules.indexOf(m[2]) < 0) refRules.push(m[2]);
  if (!refRules.length) { warn('לא נמצאו כללי a11y ב-index.html להשוואה'); return; }
  /* שכבה שנייה: אף מחלקת השפעה לא נשמטה כליל. */
  /* שכבה שלישית: הכלל לא רק קיים, הוא גם מחיל את אותו דבר.
   *
   * זה הפער שהאודיט מצא, והשכבות הקודמות לא תפסו אותו: html.a11y-readable-font הוגדר בדף
   * הבית על "body, body *" עם important, ובמדריך ובחמשת עמודי השירות רק על "body". הכפתור
   * החליף את גופן הטקסט והשאיר את הכותרות בסריף, כלומר עבד חלקית, וזה גרוע מפקד שלא עובד.
   *
   * השוואה לפי מפתח הסלקטור לא עוזרת כאן, כי דווקא הסלקטור הוא מה שהשתנה. לכן ההשוואה היא
   * לפי שם המחלקה: אוספים לכל מחלקה את כל כללי המנוע שלה, מנרמלים, ומשווים כמקשה אחת.
   *
   * "כלל מנוע" = סלקטור שאין בו מחלקה נוספת מלבד ה-a11y עצמה. כללים שמכוונים לרכיב ספציפי
   * (למשל .pg-fab שקיים רק בדף הבית) מושמטים, אחרת כל דף היה נופל על הבדל לגיטימי. */
  /* סורק כל כלל בגיליון ומסנן. הגרסה הקודמת דרשה } לפני הסלקטור, ומכיוון שההתאמה בולעת
   * את הסוגר, כלל שיושב מיד אחרי כלל אחר נדלג עליו. זה נתן חיובי שגוי על שישה דפים תקינים. */
  function engineRulesByClass(src) {
    var out = {}, rx = /([^{}]+)\{([^{}]*)\}/g, mm;
    while ((mm = rx.exec(src))) {
      var sel = mm[1].trim();
      if (sel.indexOf('html.a11y-') !== 0) continue;
      var cls = sel.match(/html\.(a11y-[a-z0-9-]+)/)[1];
      var rest = sel.replace(/html\.a11y-[a-z0-9-]+/g, '');
      if (/\.[a-z]/i.test(rest)) continue;               /* מכוון לרכיב, לא כלל מנוע */
      (out[cls] = out[cls] || []).push((sel + '{' + mm[2] + '}').replace(/\s+/g, ''));
    }
    Object.keys(out).forEach(function (k) { out[k] = out[k].sort().join(''); });
    return out;
  }
  var refEngine = engineRulesByClass(ref);
  var refNames = [];
  (ref.match(/html\.a11y-[a-z0-9-]+/g) || []).forEach(function (c) { if (refNames.indexOf(c) < 0) refNames.push(c); });
  var gaps = [];
  CONTENT_PAGES.forEach(function (f) {
    if (f === 'index.html') return;
    var s = readPage(f); if (!s) return;
    if (s.indexOf('id="a11yTrigger"') < 0) return;      /* דף בלי הווידג'ט אינו מבטיח כלום */
    var missing = refRules.filter(function (sel) {
      return !new RegExp('(^|\\})\\s*' + sel.replace(/[-]/g, '\\-') + '\\s*\\{').test(s);
    });
    var absent = refNames.filter(function (c) { return s.indexOf(c) < 0; });
    /* המחלקה קיימת, אבל מחילה משהו אחר ממה שדף הבית מחיל */
    var mine = engineRulesByClass(s), differs = [];
    Object.keys(refEngine).forEach(function (cls) {
      if (mine[cls] !== undefined && mine[cls] !== refEngine[cls]) differs.push('html.' + cls + ' (מחיל אחרת)');
    });
    var all = missing.concat(absent.map(function (c) { return c + ' (נעדרת לגמרי)'; })).concat(differs);
    if (all.length) gaps.push(f + ': ' + all.join(', '));
  });
  if (gaps.length) {
    bad('לתפריט הנגישות חסרים כללי השפעה: ' + gaps.join(' · ') +
        ' — הכפתור קיים ולא עושה כלום. בקרה שמציגה מצב ולא מחילה אותו גרועה מהיעדר בקרה');
  } else ok('כללי ההשפעה של תפריט הנגישות קיימים בכל דף (' + refRules.length + ')');
})();

/* ---------- 16. מחלקה ב-HTML שאין לה שום כלל CSS ----------
 * ארבעה פגמים בעמוד האייפון נבעו כולם מאותו שורש: ה-HTML הפנה למחלקה שלא קיימת בגיליון, או
 * שקיימת רק בהקשר אחר. cta-btns לא היה מוגדר בכלל, ו-btn-call מוגדר רק בתוך .cta ולכן בהירו
 * הכפתור יצא בלי רקע ובלי מסגרת. שום דבר לא נשבר, לא הייתה שגיאה, והדף פשוט נראה רע.
 *
 * אין build ואין linter, ולכן זו הבדיקה היחידה שיכולה לתפוס את המשפחה הזאת. מחלקות שמוזכרות
 * ב-JS מסוננות, כי הן נוספות בזמן ריצה ולגיטימי שלא יהיה להן כלל סטטי. */
var classFails = [];
CONTENT_PAGES.forEach(function (f) {
  var s = readPage(f); if (!s) return;
  var styles = (s.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
  var scripts = (s.match(/<script[\s\S]*?<\/script>/g) || []).join('\n');
  var body = s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  var used = {};
  (body.match(/\sclass="([^"]+)"/g) || []).forEach(function (m) {
    m.slice(8, -1).trim().split(/\s+/).forEach(function (c) { if (c) used[c] = 1; });
  });
  var orphans = Object.keys(used).filter(function (c) {
    if (new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(styles)) return false;
    if (scripts.indexOf(c) > -1) return false;          /* נוספת או נבדקת בזמן ריצה */
    return true;
  });
  if (orphans.length) classFails.push(f + ': ' + orphans.join(', '));
});
if (classFails.length) {
  warn('מחלקות בלי כלל CSS: ' + classFails.join(' · ') +
       ' — הדף לא נשבר ולא מדווח שגיאה, הוא פשוט מוצג בלי העיצוב שהתכוונו לו');
} else ok('לכל מחלקה ב-HTML יש כלל CSS');

/* ---------- 15. קניבליזציה: h1 ו-title ייחודיים בין העמודים ----------
 * חמישה עמודי שירות באותה עיר הם המקרה הקלאסי שבו גוגל בוחר עמוד אחד ומתעלם מהשאר.
 * האפיון קובע ביטוי מרכזי אחד לכל עמוד; זו הבדיקה שהכלל לא יישחק בעריכה מאוחרת. */
(function () {
  var seenH1 = {}, seenTitle = {}, dupes = [];
  CONTENT_PAGES.forEach(function (f) {
    var s = readPage(f); if (!s) return;
    var h1 = ((s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    var ti = ((s.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    if (h1) { if (seenH1[h1]) dupes.push('h1 זהה ב-' + seenH1[h1] + ' וב-' + f); else seenH1[h1] = f; }
    if (ti) { if (seenTitle[ti]) dupes.push('title זהה ב-' + seenTitle[ti] + ' וב-' + f); else seenTitle[ti] = f; }
  });
  if (dupes.length) bad('תוכן כפול בין עמודים: ' + dupes.join(' · ') + ' — גוגל יבחר אחד ויתעלם מהשאר');
  else ok('h1 ו-title ייחודיים בכל עמוד');
})();

/* תאריך ביקורת הנגישות מול הדף החדש ביותר: הצהרה שמכסה "כל הדפים" ומתוארכת לפני
 * הדף האחרון מצהירה על כיסוי שאין לה, וזה הדבר הקל ביותר להצביע עליו בתביעה */
(function () {
  var st = readPage('accessibility.html'); if (!st) return;
  var m = st.match(/תאריך עריכת ביקורת הנגישות האחרונה:\s*<span[^>]*>(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) { warn('לא נמצא תאריך ביקורת בהצהרת הנגישות'); return; }
  var audit = new Date(+m[3], +m[2] - 1, +m[1]);
  var newest = 0, newestFile = '';
  CONTENT_PAGES.forEach(function (f) {
    try { var t = fs.statSync(path.join(pagesDir, f)).mtime.getTime();
          if (t > newest) { newest = t; newestFile = f; } } catch (e) {}
  });
  /* יום חסד: עריכה קטנה באותו יום אינה מחייבת ביקורת מחדש */
  if (newest - audit.getTime() > 36 * 3600 * 1000) {
    warn('תאריך ביקורת הנגישות (' + m[1] + '/' + m[2] + '/' + m[3] + ') מקדים את ' + newestFile +
         ' — ההצהרה מכסה "כל הדפים", ולכן היא מצהירה על כיסוי שאין לה');
  } else ok('תאריך ביקורת הנגישות מעודכן מול הדפים');
})();

/* ---------- 18. הסייטמאפ מול הדפים שבאמת חיים ----------
 * חמשת עמודי השירות עלו לאוויר ב-31.7, מוגדרים index,follow ומקושרים מדף הבית, ונשארו מחוץ
 * לסייטמאפ. איש לא שגה: הפיגום ב-new-page.js בכוונה לא מוסיף עמוד לסייטמאפ, כי עמוד מצטרף
 * אליו רק בהשקה, ואף אחד לא חזר לעשות את זה אחריה. נמצא רק באודיט ידני ב-2.8.
 *
 * אזהרה ולא כישלון: עמוד טרי שנוצר בפיגום אמור לשבת מחוץ לסייטמאפ עד שיאושר, וכישלון כאן היה
 * חוסם את הפיתוח שלו מהרגע הראשון. הכיוון ההפוך, כתובת בסייטמאפ שאין לה עמוד, הוא כן כישלון:
 * הוא שולח את גוגל ל-404. */
(function () {
  var smPath = path.join(pagesDir, 'sitemap.xml'), sm;
  try { sm = fs.readFileSync(smPath, 'utf8'); } catch (e) { warn('אין sitemap.xml'); return; }
  var locs = (sm.match(/<loc>([^<]+)<\/loc>/g) || []).map(function (l) { return l.slice(5, -6); });

  /* עמוד נחשב "חי" רק אם הוא מזמין אינדוקס. noindex בכוונה אינו חוסר */
  var live = pageFiles.filter(function (f) {
    var src;
    try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return false; }
    return !/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(src) && baseName(f).charAt(0) !== '_';
  });
  var missing = live.filter(function (f) { return locs.indexOf(pageUrl(f)) < 0; });
  var ghosts = locs.filter(function (u) {
    return live.map(pageUrl).indexOf(u) < 0;
  });

  if (ghosts.length) {
    bad('כתובות בסייטמאפ שאין להן עמוד: ' + ghosts.join(', ') + ' — גוגל יישלח ל-404');
  }
  if (missing.length) {
    warn('עמודים מאונדקסים שאינם בסייטמאפ: ' + missing.join(', ') +
         ' — גוגל ימצא אותם דרך קישורים, אבל הסיגנל המפורש חסר. אם העמוד עוד לא הושק, זה תקין');
  }
  if (!ghosts.length && !missing.length) ok('הסייטמאפ מכיל בדיוק את ' + live.length + ' הדפים החיים');
})();

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
