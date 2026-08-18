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
/* קידומת _ = טיוטה מקומית, לא עמוד חי. הסינון הזה חייב לקרות כאן ולא רק ב-CONTENT_PAGES:
 * הבדיקות סורקות את תיקיית העבודה, ובתיקייה הזאת עובדים כמה chats במקביל. ב-2.8.2026 קובץ טיוטה
 * לא-מגורסן של סשן אחר (_kbpreview.html) הפיל את בדיקת ה-canonical וחסם דחיפה של סשן אחר לגמרי. */
function isDraft(name) { return name.charAt(0) === '_'; }

/* הסריקה רקורסיבית לכל עומק, ולא רמה אחת. הגרסה הקודמת ירדה בדיוק רמה אחת, וזה הספיק לעמודי
 * השירות אבל לא לרמה שמתחתיהם. כל עמוד עמוק בשתיים (phones/all/, phones/<דגם>/,
 * compare/<השוואה>/, guides/<מדריך>/, upcoming-phones/<דגם>/) היה נופל מחוץ לכל הבדיקות כאן.
 * זו אותה תקלה שההערה למעלה מתארת, רמה אחת מתחת: הדף נראה גמור, ובשקט אין לו שומר סביבה,
 * גידור GTM, canonical, תפריט נגישות ובאנר קוקיז. נמצא ב-4.8.2026 בתכנון אזור המכשירים,
 * לפני שנוצר הדף הראשון, ולכן הפעם לפני התקלה ולא אחריה.
 *
 * עמוד = כל קובץ html מתחת ל-prototype, ולא רק index.html בתיקייה. Vercel מגיש את התיקייה
 * כמו שהיא, ולכן כל קובץ html שם הוא כתובת שגולש יכול להגיע אליה, כלומר משהו שצריך להיבדק.
 * יורדים גם לתיקייה שאין בה index.html: תיקיית אב (guides/) יכולה להיות ריקה בזמן שהבנים
 * שלה הם עמודים. תיקיית נכסים (problems/, logos/, layers/) לא תתרום כלום, כי אין בה html.
 * קישור סימבולי מדווח כ-isSymbolicLink ולא כ-isDirectory, ולכן הרקורסיה לא יכולה להיתקע. */
var pagesDir = P('prototype'), pageFiles = [];
(function collectPages(dir, prefix) {
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) {
    if (!prefix) warn('לא ניתן לקרוא את תיקיית prototype לסריקת דפים');
    return;
  }
  entries.forEach(function (e) {
    if (isDraft(e.name)) return;
    if (e.isFile()) { if (/\.html$/.test(e.name)) pageFiles.push(prefix + e.name); return; }
    if (!e.isDirectory() || e.name === 'api') return;
    collectPages(path.join(dir, e.name), prefix + e.name + '/');
  });
})(pagesDir, '');

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
/* טיוטות _ כבר סוננו ב-pageFiles, ולכן כאן נשאר רק להוציא את הדפים המשפטיים */
var CONTENT_PAGES = pageFiles.filter(function (f) { return LEGAL_PAGES.indexOf(f) < 0; });
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

/* nav.main is written by hand into every page, and index.html is the reference for its values.
 * It drifted, was corrected across 7 pages, drifted again to 64, and was corrected again, and in
 * between four newly created pages arrived already carrying the old values. Nothing was watching it,
 * because the nav check above compares the LABELS and not the rule that sizes them. */
var refNavCss = (ref.match(/^nav\.main\{[^}]*\}/m) || [''])[0];

var f_h1 = [], f_alt = [], f_lang = [], f_marks = [], f_skip = [], f_main = [],
    f_nav = [], f_footer = [], f_btn = [], f_bar = [], f_navcss = [];

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

  /* אותו תפריט, אותה מידה. הבדיקה למעלה משווה את התוויות, ולכן עמוד יכול לשאת את אותם קישורים
   * בדיוק במשקל וגודל אחרים, וזה מה שקרה: אותו תפריט נראה קל וצפוף פחות תלוי באיזה עמוד עומדים.
   * ההשוואה היא לכלל השלם של index.html ולא לשלושה ערכים, כי כל ערך שיתווסף שם צריך להתפשט גם כאן. */
  var navCss = (s.match(/^nav\.main\{[^}]*\}/m) || [''])[0];
  if (refNavCss && navCss && navCss !== refNavCss) {
    var got = (navCss.match(/gap:[^;}]+|font-weight:[^;}]+|font-size:[^;}]+/g) || []).join(' ');
    f_navcss.push(f + ' (' + got + ')');
  }

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
verdict(f_navcss,'מידת הניווט זהה בכל דף',          'nav.main לא תואם ל-index.html', false);
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
  /* וגם קופי שחי בתוך <script>. הכלי ב-/phones/compare/ בונה את כל הטקסט שלו ב-JS:
     29 משפטי ההסבר, הודעות המצב, הודעות השגיאה ותוויות הכפתורים. כולם עברו כאן בלי
     להיבדק, כי השורות שמעל מסירות את כל ה-script לפני הספירה, וכך מקף ארוך בגילוי
     הנאות של מכשיר ייחוס שרד 32 בדיקות. זה לא פספוס נקודתי אלא חור מבני בשער.
     נספרות מחרוזות ליטרל בלבד, והערות קוד בתוך ה-script יורדות קודם, מאותה סיבה
     שהערות HTML יורדות: שם המקף מותר. */
  var js = (s.match(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n')
             .replace(/\/\*[\s\S]*?\*\//g, ' ')
             .replace(/^[ \t]*\/\/.*$/gm, ' ');
  var strings = (js.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g) || []).join('\n');
  var n = countAll(text, /—/g) + countAll(attrs, /—/g) + countAll(ld, /—/g) + countAll(strings, /—/g);
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
    /* קודם מצמצמים לבלוקי ה-style, ורק עליהם מריצים את הסריקה. הגרסה הקודמת סרקה את כל
     * ה-HTML, כולל אלפי הסוגרים של ה-JavaScript ה-inline, ו-[^{}]+ נאלץ לעבור עליהם שוב
     * ושוב. נמדד על 76 העמודים: 92.35 שניות מול 0.67, פי 138, עם תוצאה **זהה בייט בבייט**
     * בכל 76 הקבצים (533 מחלקות בשתי הדרכים). זה היה 92% מזמן הפריפלייט כולו.
     * אם אין בלוק style, למשל כשמעבירים CSS נקי, נשארים עם המקור כמו שהוא. */
    var css = (src.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    if (css) src = css;
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
  /* גם גיליונות חיצוניים מקומיים. הצ'אט עבר ל-chat.css, ובלי זה כל 21 העמודים דיווחו
   * על עשר מחלקות בלי CSS בזמן שהכלל קיים, וזו אזהרה שתמיד דולקת ולכן נהיית רעש. */
  (s.match(/<link[^>]+rel="stylesheet"[^>]*>/gi) || []).forEach(function (tag) {
    var href = (tag.match(/href="(\/[^"]+\.css)"/) || [])[1];
    if (!href) return;
    try { styles += '\n' + fs.readFileSync(path.join(pagesDir, href.replace(/^\//, '')), 'utf8'); }
    catch (e) { /* בדיקה 24 מדווחת על קובץ חסר */ }
  });
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

/* ---------- 19. הסקריפטים של הפרויקט בכלל נטענים ----------
 * new-page.js עלה ל-main כשהוא לא נטען בכלל. החלפת מחרוזת גורפת הכניסה לוכסן לא מוברח לתוך
 * ליטרל של רגקס, הליטרל נסגר בלוכסן הראשון, ומה שאחריו נקרא כדגלי רגקס. שגיאת תחביר בשורה
 * הראשונה, כלומר הפיגום לא היה מייצר אף עמוד. אף בדיקה לא הריצה אותו, ולכן זה התגלה במקרה.
 * vm.Script מהדר בלי להריץ, ולכן הבדיקה בטוחה גם לסקריפטים שכותבים קבצים. */
(function () {
  var vm = require('vm');
  /* סריקה רקורסיבית ולא רשימה קבועה של שתי תיקיות. הרשימה הקבועה החמיצה את .claude/tools
   * לגמרי, כלומר את ארבעת המחוללים ואת lib/, שהם הקוד שרץ הכי הרבה בפרויקט. הוכח בשחזור:
   * שגיאת תחביר שנשתלה ב-gen-devices.js עברה, והבדיקה דיווחה "הכול תקין".
   * מה שהבדיקה הזאת כן תופסת הוא שגיאות תחביר בלבד. באג סמנטי בקוד תקין, כמו ארגומנט
   * שלישי ל-replace, אינו נתפס כאן אלא בבדיקה 21. */
  var broken = [], checked = 0;
  (function walk(d) {
    var names;
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    names.forEach(function (e) {
      if (e.name === 'node_modules' || e.name.charAt(0) === '.' && e.name !== '.claude') return;
      var full = path.join(d, e.name);
      if (e.isDirectory()) return walk(full);
      if (!/\.js$/.test(e.name)) return;
      try { new vm.Script(fs.readFileSync(full, 'utf8'), { filename: full }); checked++; }
      catch (err) { broken.push(path.relative(P('.'), full) + ': ' + err.message.slice(0, 60)); }
    });
  })(P('.claude'));
  if (broken.length) bad('סקריפטים שלא נטענים: ' + broken.join(' · ') + ' — שגיאת תחביר, הכלי לא ירוץ בכלל');
  else if (checked) ok(checked + ' סקריפטים של הפרויקט נטענים');
})();

/* ---------- 21. רכיב שיש לו HTML חייב שיהיה לו גם ה-CSS ----------
 * זה הכשל שחזר בפרויקט הזה חמש פעמים: .hub פעמיים, .chip, .cmp, וכפתור ההירו. אין שלב
 * build, ולכן כל עמוד נושא עותק משלו של ה-CSS, ורכיב שמועתק בלי הכלל שלו נראה שבור בלי
 * להיכשל בשום דבר. שום בדיקה קודמת לא כיסתה את זה: 10 בודקת את תפריט הנגישות בלבד.
 *
 * ומה שהוליד את הבדיקה עכשיו: סקריפט הזריק כלל CSS לתוך h.replace כארגומנט שלישי במקום
 * לחבר אותו במחרוזת. replace מקבל שניים, ולכן כל בלוק ה-CSS האמיתי נזרק בשקט מ-12 עמודי
 * מכשיר. הקוד תקין תחבירית, ולכן בדיקה 19 לא יכלה לתפוס. מה שתפס היה מקרי לגמרי.
 *
 * הכלל: אם ה-HTML משתמש ברכיב, ה-CSS שלו חייב להיות באותו קובץ. */
(function () {
  var PAIRS = [
    /* הבדיקה על האלמנט ולא על המקטע: יכול להיות ghero בלי כפתור, ואז הכלל מיותר */
    { when: /class="[^"]*\bbtn-hero\b/,  need: '.btn-hero{white-space:normal',
      why: 'כפתור ההירו גולש מהעמודה בלי הכלל הזה' },
    { when: /class="[^"]*\bcmp-spec\b/,  need: '.cmp-spec .grp th{',
      why: 'כותרות הקטגוריה בטבלת המפרט חוזרות לעיצוב ברירת המחדל' },
    { when: /class="[^"]*\bhub\b/,       need: '.hub li',
      why: 'רשימת המרכז מאבדת את קו השערה ואת המספור' }
  ];
  var miss = [];
  CONTENT_PAGES.forEach(function (f) {
    var s = readPage(f); if (!s) return;
    /* ה-HTML נבדק בלי ה-style, אחרת סלקטור בתוך גיליון הסגנונות נספר כשימוש ברכיב */
    var html = s.replace(/<style[\s\S]*?<\/style>/g, ' ');
    PAIRS.forEach(function (p) {
      if (p.when.test(html) && s.indexOf(p.need) < 0) miss.push(f + ': ' + p.need + ' (' + p.why + ')');
    });
  });
  if (miss.length) bad('רכיב בלי ה-CSS שלו: ' + miss.join(' · '));
  else ok('כל רכיב שמופיע בעמוד נושא איתו את ה-CSS שלו');
})();

/* ---------- 22. לכל שדה מפרט ריק יש הערה שאומרת למה ----------
 * זו אחת משבע הבדיקות ש-D0.8 מגדיר, והיא לא הייתה קיימת. הכלל היה כתוב ב-_rules ולא נאכף,
 * וזה איפשר שלושה ממצאים שונים באודיט, כולם מאותו שורש: null נקרא כ"לא".
 *
 *   · מדריך ה-eSIM כתב "שני דגמי רדמי נוט 14 אינם תומכים" על שדה שהוא null.
 *   · השאלון העניש ארבעה דגמי סמסונג על עדשה רחבה שיש להם, כי היעדר תיוג נקרא כהיעדר עדשה.
 *   · 25 תאים בעמודי ההשוואה אמרו "לא מפורסם אצל היצרן" על נתון שכן מפורסם, בשדה אחר.
 *
 * ההערה היא מה שמפריד בין "היצרן לא מפרסם" לבין "עוד לא בדקנו", ובלעדיה שתי המשמעויות
 * נראות אותו דבר לכל מי שקורא את הקובץ אחר כך.
 *
 * ובנוסף: כל שדה שמופיע ב-_spec_groups חייב להתקיים במפורש, גם כ-null. שדה חסר לגמרי
 * אינו יכול לשאת הערה, ולכן undefined הוא חור שהבדיקה הזאת לא הייתה רואה. */
(function () {
  var raw;
  try { raw = fs.readFileSync(path.join(pagesDir, 'devices.json'), 'utf8'); } catch (e) { return; }
  var db;
  try { db = JSON.parse(raw); } catch (e) { bad('devices.json אינו נפרס: ' + e.message.slice(0, 60)); return; }
  if (!db.devices || !db._spec_groups) return;

  var fields = [];
  db._spec_groups.groups.forEach(function (g) { g[1].forEach(function (p) { fields.push(p[0]); }); });

  var missing = [], noNote = [], checked = 0;
  db.devices.forEach(function (d) {
    var src = d.spec_source || {};
    fields.forEach(function (f) {
      if (!(f in d.spec)) { missing.push(d.slug + '.' + f); return; }
      checked++;
      if (d.spec[f] === null && !(src[f] && src[f].note)) noNote.push(d.slug + '.' + f);
    });
  });

  var probs = [];
  if (missing.length) probs.push(missing.length + ' שדות חסרים לגמרי מ-spec (' + missing.slice(0, 4).join(', ') +
    (missing.length > 4 ? '…' : '') + ') — שדה שאינו קיים אינו יכול לשאת הערת מקור');
  if (noNote.length) probs.push(noNote.length + ' שדות ריקים בלי הערה (' + noNote.slice(0, 4).join(', ') +
    (noNote.length > 4 ? '…' : '') + ') — בלי הערה אי אפשר לדעת אם היצרן לא מפרסם או שעוד לא בדקנו, וכותב עלול לכתוב "אינו תומך"');
  if (probs.length) bad('מקורות המפרט: ' + probs.join(' · '));
  else ok(checked + ' שדות מפרט נבדקו: לכל שדה ריק יש הערה שאומרת למה');
})();

/* ---------- 23. devices.json והעמודים המחוללים מסונכרנים ----------
 * שתי בדיקות מ-D0.8 שלא היו קיימות, ושתיהן על אותו פער: המאגר הוא מקור האמת, אבל מה
 * שמוגש הוא HTML שנכתב בהרצה קודמת. עריכה של devices.json בלי הרצת המחולל מייצרת אתר
 * שמציג נתון ישן בזמן שהקובץ מציג חדש, ואין שום סימן לכך.
 *
 * זה לא תרחיש תיאורטי: בסשן אחד נערך devices.json שבע פעמים, וכל שכחה אחת של המחולל
 * הייתה משאירה עמוד שסותר את המאגר בלי אזהרה.
 *
 * הבדיקה משווה ערכי מפרט אמיתיים מול הטקסט בעמוד. התגיות מוסרות קודם, כי ltrRuns עוטפת
 * ריצות לטיניות ב-bdo ולכן indexOf על ה-HTML הגולמי היה נכשל על כל ערך מעורב.
 *
 * ובנוסף, ההגנה על ההמלצות: טיוטה של סיגל או ברוך לא מגיעה ל-HTML. זה נאכף היום במחולל
 * בלבד, כלומר שינוי אחד שם היה מפיל אותה בלי שאף אחד ידע. */
(function () {
  var db;
  try { db = JSON.parse(fs.readFileSync(path.join(pagesDir, 'devices.json'), 'utf8')); } catch (e) { return; }
  if (!db.devices) return;

  function textOf(html) {
    return html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ');
  }
  var stale = [], leaked = [], pagesSeen = 0, valsSeen = 0;

  db.devices.forEach(function (d) {
    if (d.status === 'draft') return;
    /* מכשיר ייחוס הוא דגם שאיננו מוכרים, והוא במאגר רק כדי להשוות אליו.
       עמוד משלו היה אומר ללקוח שאנחנו מוכרים אותו, ולכן היעדרו הוא הכוונה. */
    if (d.status === 'reference') return;
    var html = readPage('phones/' + d.slug + '/index.html');
    if (!html) { stale.push(d.slug + ': אין עמוד'); return; }
    pagesSeen++;
    var txt = textOf(html);

    /* ערכי מפרט קצרים בלבד. ערך ארוך עלול להישבר בין תגיות בדרכים שקשה לנרמל,
     * וקצרים מספיקים לגמרי כדי לזהות שהעמוד נבנה מגרסה אחרת של הקובץ. */
    Object.keys(d.spec).forEach(function (f) {
      var v = d.spec[f];
      if (typeof v !== 'string' || v.length < 3 || v.length > 60) return;
      valsSeen++;
      if (txt.indexOf(v.replace(/\s+/g, ' ')) < 0) stale.push(d.slug + '.' + f + ' ("' + v.slice(0, 28) + '")');
    });

    /* המלצה שאינה approved לא מופיעה בעמוד */
    ['sigal', 'baruch'].forEach(function (who) {
      var r = (d.recommendation || {})[who];
      if (!r || !r.text || r.status === 'approved') return;
      var probe = String(r.text).replace(/\s+/g, ' ').slice(0, 40);
      if (probe.length > 12 && txt.indexOf(probe) >= 0) leaked.push(d.slug + '.' + who + ' (' + r.status + ')');
    });
  });

  var probs = [];
  if (stale.length) probs.push(stale.length + ' ערכים בעמוד אינם תואמים ל-devices.json (' +
    stale.slice(0, 3).join(', ') + (stale.length > 3 ? '…' : '') + ') — כנראה נערך המאגר ולא הורץ gen-devices.js');
  if (leaked.length) probs.push('טיוטת המלצה הגיעה ל-HTML: ' + leaked.join(', ') + ' — רק status approved מותר בעמוד');
  if (probs.length) bad('סנכרון המאגר: ' + probs.join(' · '));
  else ok(pagesSeen + ' עמודי מכשיר מסונכרנים עם devices.json (' + valsSeen + ' ערכים), ואין טיוטת המלצה בהם');
})();

/* ---------- 24. קישור פנימי שמצביע לעמוד שלא קיים ----------
 * 38 עמודים שמקשרים זה לזה בלי שלב build, כלומר כל קישור נכתב ביד או מחולל, ואף אחד לא
 * מאמת אותו. שינוי slug או עמוד שנדחה להמשך משאיר 404 שנראה בסדר גמור בקוד.
 *
 * זה כמעט קרה: /phones/ הוחזק בכוונה עד ש-D2 נבנה, בדיוק כי שלושת המסלולים שלו היו
 * מצביעים לעמודים שלא קיימים. ההחזקה ההיא הייתה החלטה של אדם שזכר, ולא בדיקה.
 *
 * נבדקים רק קישורים שורשיים. יחסיים נדירים כאן, ומי שכן משתמש בהם מכוסה בבדיקה 17. */
(function () {
  function target(u) {
    if (u === '/') return path.join(pagesDir, 'index.html');
    var c = u.replace(/^\//, '').replace(/\/$/, '');
    if (/\.html$/.test(c)) return path.join(pagesDir, c);
    /* לא כל קישור שורשי הוא עמוד. גיליון סגנון, סקריפט או JSON הם קובץ אמיתי, וההנחה
     * שכל יעד הוא תיקייה עם index.html דיווחה על /chat.css כשבור ב-21 עמודים. */
    var asFile = path.join(pagesDir, c);
    if (/\.[a-z0-9]{2,5}$/i.test(c) && fs.existsSync(asFile)) return asFile;
    return path.join(pagesDir, c, 'index.html');
  }
  var dead = {}, checked = 0, seen = 0;
  pageFiles.concat(LEGAL_PAGES).forEach(function (f) {
    var s = readPage(f); if (!s) return;
    seen++;
    var body = s.replace(/<script[\s\S]*?<\/script>/g, ' ');
    var m, re = /href="(\/[^"#?]*)"/g;
    while ((m = re.exec(body)) !== null) {
      var u = m[1];
      if (/\.(jpg|jpeg|png|webp|svg|ico|xml|json|js|txt|pdf)$/i.test(u)) continue;
      checked++;
      if (!fs.existsSync(target(u))) (dead[u] = dead[u] || []).push(f);
    }
  });
  var keys = Object.keys(dead);
  if (keys.length) {
    bad('קישורים ליעד שלא קיים: ' + keys.slice(0, 5).map(function (u) {
      return u + ' (מ-' + dead[u].length + ' עמודים)';
    }).join(' · ') + (keys.length > 5 ? ' ועוד ' + (keys.length - 5) : '') + ' — 404 למי שילחץ');
  } else ok(checked + ' קישורים פנימיים ב-' + seen + ' עמודים, כולם מצביעים לעמוד קיים');
})();

/* ---------- 25. שני עמודים שאומרים כמעט אותו דבר ----------
 * גוגל מסווג עמודים שנבדלים רק בשם הדגם או בשם העיר כ-doorway pages, ואז לא רק שהם לא
 * מדורגים, הם מושכים למטה את כל האתר. זה הסיכון המרכזי של כל תוכנית ההרחבה, והוא גדל
 * ככל שמוסיפים עוד עמוד מאותה תבנית.
 *
 * הבדיקה מודדת חפיפה של רצפי חמש מילים בין כל שני עמודים. הסף 70% הוא רחב בכוונה: הוא
 * נועד לתפוס שכפול ולא דמיון. למדידה, ארבעת עמודי גל 3 שנבנו מאותה תבנית ובאותו יום
 * הגיעו ל-18% לכל היותר, וחמשת עמודי השירות הוותיקים ל-26%.
 *
 * שני דברים מוצאים מהמדידה בכוונה:
 *   · טבלאות. טבלה שחוזרת היא מבנה ולא כתיבה, ובדיוק ההשמטה הזאת כבר תפחה דוח פעם אחת.
 *   · הדר, פוטר וניווט. הם זהים בכל עמוד מעצם ההגדרה, ואין שלב build שיוציא אותם. */
(function () {
  function body(h) {
    var m = h.match(/<main[\s\S]*?<\/main>/);
    if (!m) return '';
    return m[0].replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<table[\s\S]*?<\/table>/g, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function grams(s) {
    var w = s.split(' ').filter(Boolean), o = new Set();
    for (var i = 0; i + 5 <= w.length; i++) o.add(w.slice(i, i + 5).join(' '));
    return o;
  }
  var g = {}, names = [];
  CONTENT_PAGES.forEach(function (f) {
    var s = readPage(f); if (!s) return;
    var t = body(s);
    /* עמוד קצר מדי מייצר אחוזים חסרי משמעות */
    if (t.split(' ').length < 120) return;
    g[f] = grams(t); names.push(f);
  });
  var worst = null, over = [];
  for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) {
    var a = g[names[i]], b = g[names[j]], sh = 0;
    a.forEach(function (x) { if (b.has(x)) sh++; });
    var pct = Math.round(sh / Math.min(a.size, b.size) * 100);
    if (!worst || pct > worst.pct) worst = { pct: pct, pair: names[i] + ' ↔ ' + names[j] };
    if (pct >= 70) over.push(names[i] + ' ↔ ' + names[j] + ' (' + pct + '%)');
  }
  if (over.length) bad('עמודים שכמעט זהים: ' + over.join(' · ') + ' — גוגל מסווג את זה כ-doorway ומוריד את כל האתר');
  else if (worst) ok('אין שכפול בין עמודים. הגבוה ביותר: ' + worst.pct + '% (' + worst.pair.replace(/\/index\.html/g, '') + '), הסף 70%');
})();

/* ---------- 26. עמוד שאף אחד לא מקשר אליו ----------
 * בדיקה 24 מוודאת שקישור מצביע לעמוד קיים. היא לא מוודאת שלעמוד יש למי להצביע אליו,
 * וזה חור שהתגלה ביום שבו נבנו 15 עמודים: שבעה מהם היו תלויים בקישור נכנס יחיד, וחמישה
 * מהם באותו משפט בודד. מישהו שיערוך את המשפט הזה מנתק חמישה עמודים בבת אחת, ושום בדיקה
 * לא הייתה נכשלת.
 *
 * נספרים רק קישורים מתוך <main>. קישורי הדר, פוטר וניווט זהים בכל עמוד ולכן אינם מעידים
 * על כלום: הם הופכים עמוד לנגיש, לא למקושר.
 *
 * הכיול: אפס הוא יתום ונכשל. אחד הוא שביר ומקבל אזהרה, כי עמוד חדש לגיטימי מתחיל שם. */
(function () {
  /* דף הבית ועמודי החובה מגיעים מהפוטר בכל עמוד, ולכן אינם נמדדים כאן */
  var EXEMPT = ['index.html', 'privacy.html', 'accessibility.html', 'contact/index.html'];
  var inb = {};
  CONTENT_PAGES.forEach(function (f) {
    if (EXEMPT.indexOf(f.replace(/\\/g, '/')) >= 0) return;
    inb[f] = 0;
  });
  CONTENT_PAGES.forEach(function (from) {
    var s = readPage(from); if (!s) return;
    var m = s.match(/<main[\s\S]*?<\/main>/); if (!m) return;
    var body = m[0].replace(/<script[\s\S]*?<\/script>/g, ' ');
    Object.keys(inb).forEach(function (to) {
      if (to === from) return;
      var url = '/' + to.replace(/\\/g, '/').replace(/index\.html$/, '');
      if (body.indexOf('href="' + url + '"') >= 0) inb[to]++;
    });
  });
  var orphans = [], fragile = [];
  Object.keys(inb).forEach(function (f) {
    var n = f.replace(/[\\\/]index\.html$/, '');
    if (inb[f] === 0) orphans.push(n);
    else if (inb[f] === 1) fragile.push(n);
  });
  if (orphans.length) {
    bad('עמודים שאף עמוד אחר לא מקשר אליהם מתוך התוכן: ' + orphans.join(', ') +
      ' — גוגל מגיע אליהם רק דרך הסייטמאפ, ומבקר לא מגיע אליהם בכלל');
  } else if (fragile.length) {
    warn('עמודים עם קישור נכנס יחיד: ' + fragile.join(', ') +
      ' — עריכה אחת במקום שממנו הם מקושרים מנתקת אותם');
  } else {
    ok(Object.keys(inb).length + ' עמודים, ולכל אחד לפחות שני קישורים נכנסים מתוך התוכן');
  }
})();

/* ---------- 27. עמוד שמדבר על העתיד ומתיישן ----------
 * עמוד כמו /upcoming-phones/ אומר לקורא מה המצב היום, ולכן הוא נכון רק כל עוד מישהו
 * בדק אותו. עמוד כזה לא נשבר כשהוא מתיישן, הוא פשוט הופך למטעה, ואין שום סימן חיצוני.
 *
 * הפתרון: העמוד נושא <time id="pg-checked" datetime="YYYY-MM-DD">, והבדיקה הזאת חוסמת
 * העלאה כשהתאריך ישן מ-90 יום. זה גנרי בכוונה, כך שכל עמוד עתידי שנשען על טריות
 * יקבל את אותו שער בלי לגעת כאן.
 *
 * הכיול: 90 יום נכשל, 75 מזהיר כדי שיהיה זמן לטפל, ותאריך עתידי נכשל כי הוא תמיד טעות. */
(function () {
  var MAX = 90, WARN_AT = 75;
  var found = 0, stale = [], soon = [], future = [], broken = [];
  var now = new Date();

  CONTENT_PAGES.forEach(function (f) {
    var src = readPage(f); if (!src) return;
    var m = src.match(/<time[^>]+id="pg-checked"[^>]*>/);
    if (!m) return;
    found++;
    var d = (m[0].match(/datetime="(\d{4}-\d{2}-\d{2})"/) || [])[1];
    if (!d) { broken.push(f + ' (אין datetime תקין)'); return; }
    var age = Math.floor((now - new Date(d + 'T00:00:00')) / 86400000);
    if (age < 0) future.push(f + ' (' + d + ')');
    else if (age > MAX) stale.push(f + ' (' + d + ', לפני ' + age + ' יום)');
    else if (age > WARN_AT) soon.push(f + ' (' + d + ', לפני ' + age + ' יום)');
  });

  if (broken.length) bad('תגית pg-checked בלי datetime תקין: ' + broken.join(', ') +
    ' — בלי תאריך קריא אין מה לאכוף, והשער פתוח בשקט');
  if (future.length) bad('תאריך בדיקה עתידי: ' + future.join(', ') +
    ' — תאריך שעוד לא הגיע הוא תמיד טעות הקלדה, והוא משתיק את השער לחודשים');
  if (stale.length) {
    bad('עמודים שמדברים על ההווה ולא נבדקו מעל ' + MAX + ' יום: ' + stale.join(', ') +
      ' — העמוד לא נשבר, הוא הפך למטעה. לבדוק את התוכן ולעדכן את pg-checked');
  } else if (soon.length) {
    warn('מתקרב לפקיעה: ' + soon.join(', ') + ' — יש עוד זמן, אבל שווה לבדוק עכשיו');
  } else if (found) {
    ok(found + ' עמודים תלויי טריות, כולם נבדקו בתוך ' + MAX + ' הימים האחרונים');
  }
})();

/* ---------- 28. Product שגוגל תדחה ----------
 * schema.org לא דורש offers, ולכן Product בלי מחיר תקין תחבירית ובדיקה 9 מאשרת אותו. גוגל
 * דורשת אחד מתוך offers, review ו-aggregateRating, ומה שקורה בפועל אינו התעלמות אלא שגיאה
 * קריטית ב-Search Console. ב-13.8.2026 הגיע מייל על 21 עמודי המכשיר, כלומר כל אחד מהם.
 * ההערה במחולל הבטיחה "לא זכאי לתוצאות עשירות", וזה היה חצי נכון.
 *
 * ישות מקוננת תחת about או mainEntity פטורה: שם היא ההקשר של המאמר ולא הישות הראשית של
 * הדף, ולכן אינה מועמדת ל-snippet. זה מה שעמודי ההשוואה עושים, ונכון שיישאר.
 *
 * ⚠ הפתרון לכשל כאן אינו aggregateRating. אין ביקורות מוצר לדגמים האלה, וסימון ביקורות
 * מומצא הוא הפרת מדיניות שגוררת ענישה ידנית. בלי מחיר אמיתי, לא לפלוט Product. */
(function () {
  var offenders = [];
  function inspect(node, nested, file) {
    if (Object.prototype.toString.call(node) === '[object Array]') {
      node.forEach(function (n) { inspect(n, nested, file); });
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node['@type'] === 'Product' && !nested) {
      var has = function (k) { return Object.prototype.hasOwnProperty.call(node, k); };
      if (!has('offers') && !has('aggregateRating') && !has('review')) {
        offenders.push(file + (node.name ? ' (' + node.name + ')' : ''));
      }
    }
    Object.keys(node).forEach(function (k) {
      if (k === '@context' || k === '@type') return;
      /* about / mainEntity מורידים את הישות מדרגת "הישות של הדף" */
      inspect(node[k], nested || k === 'about' || k === 'mainEntity', file);
    });
  }
  pageFiles.forEach(function (f) {
    var src;
    try { src = fs.readFileSync(path.join(pagesDir, f), 'utf8'); } catch (e) { return; }
    var blocks = src.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g) || [];
    blocks.forEach(function (b) {
      var body = b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
      var j;
      try { j = JSON.parse(body); } catch (e) { return; }   /* בדיקה 9 מדווחת על שבור */
      inspect(j, false, f);
    });
  });
  if (offenders.length) {
    bad('ישות Product בלי offers, review או aggregateRating: ' + offenders.join(', ') +
      ' — גוגל מדווחת על זה כשגיאה קריטית ב-Search Console, לא כאי-זכאות. בלי מחיר אמיתי לא לפלוט Product כלל');
  } else {
    ok('אין ישות Product שגוגל תדחה');
  }
})();

/* ---------- 29. bot-facts.json: הקובץ שהעוזר בצ'אט קורא ----------
 * צ'אט אינו נסרק סטטית, ולכן שום בדיקה כאן לא יכולה להוכיח שהבוט עונה נכון. אבל
 * **הקובץ שהוא קורא כן נסרק**, וזה מכסה את שתי התקלות המסוכנות באמת:
 *
 *   1. שדה שאסור לבוט לנקוב בו הגיע לקובץ. מחיר הוא החלטת בעלים נעולה, ומלאי מלא
 *      ב-12 מ-24 בלבד, כלומר תשובה ממנו היא הבטחה בשם המותג על סמך נתון חלקי.
 *   2. מישהו הוסיף דגם ל-devices.json ולא הריץ את gen-devices.js. אז הבוט מכיר קטלוג
 *      ישן, ממשיך לעבוד, ופשוט לא יודע שהדגם קיים. אין לזה שום סימן חיצוני.
 *
 * הבדיקה גם מוודאת שלכל דגם נמכר יש שלושת שדות האמון, כי null בהם מנתב לאדם, ואם כולם
 * null הבוט מנתב תמיד ואין לו טעם. */
(function () {
  var raw, facts;
  try { raw = read('prototype/bot-facts.json'); } catch (e) {
    warn('bot-facts.json חסר — העוזר בצ\'אט יאבד את נתוני הקטלוג וינתב לאדם בכל שאלה על דגם');
    return;
  }
  try { facts = JSON.parse(raw); } catch (e) {
    bad('bot-facts.json שבור: ' + e.message.slice(0, 60) + ' — הבוט לא יקבל שום נתון');
    return;
  }
  var list = (facts && facts.devices) || [];
  if (!list.length) { bad('bot-facts.json ריק מדגמים'); return; }

  /* אסור בקובץ, כל אחד מסיבה אחרת. ראו את ההערה ב-gen-devices.js. */
  var FORBIDDEN = ['price', 'colors_stocked', 'stock', 'storage_stocked',
                   'importer_name', 'recommendation', 'commercial', 'editorial'];
  var leaked = FORBIDDEN.filter(function (k) { return raw.indexOf('"' + k + '"') >= 0; });
  if (leaked.length) {
    bad('bot-facts.json מכיל שדה אסור: ' + leaked.join(', ') +
      ' — הבוט עלול לנקוב בנתון שאין לו אישור לנקוב בו');
  } else { ok('bot-facts.json בלי שדות אסורים (' + FORBIDDEN.length + ' נבדקו)'); }

  /* סנכרון מול המקור. סופרים באותו סינון שהמחולל מסנן בו. */
  var srcCount = null;
  try {
    var src = JSON.parse(read('prototype/devices.json'));
    srcCount = (src.devices || []).filter(function (d) { return d.status !== 'draft'; }).length;
  } catch (e) { /* בדיקה 23 כבר מטפלת ב-devices.json שבור */ }
  /* ספירה בלבד אינה מספיקה: עריכת תנאי האחריות ב-devices.json בלי הרצת המחולל משאירה
   * את המספר זהה, והבוט ממשיך להגיש את הנוסח הישן **בלי שום סימן**. לכן טביעת אצבע על
   * התוכן עצמו, ולא רק על הכמות. */
  (function () {
    var src;
    try { src = JSON.parse(read('prototype/devices.json')); } catch (e) { return; }
    function fp(d, fromFacts) {
      var c = fromFacts ? d : (d.commercial || {}), e = fromFacts ? d : (d.editorial || {});
      var ref = fromFacts ? d.kind === 'reference' : d.status === 'reference';
      return [d.slug, d.name, d.name_he || d.name, d.brand, ref ? 1 : 0,
        ref ? '' : (c.warranty_by || ''), ref ? '' : (typeof c.warranty_months === 'number' ? c.warranty_months : ''),
        ref ? '' : (c.service_terms || ''), ref ? '' : (c.payments || ''), ref ? '' : (c.data_transfer || ''),
        (e.good_for || []).join('|'), (e.less_for || []).join('|'),
        JSON.stringify(d.spec || {})].join('');
    }
    var a = (src.devices || []).filter(function (d) { return d.status !== 'draft'; }).map(function (d) { return fp(d, false); }).sort().join('');
    var b = list.map(function (d) { return fp(d, true); }).sort().join('');
    if (a !== b) {
      bad('bot-facts.json אינו תואם את התוכן של devices.json — הבוט מגיש נוסח ישן. ' +
        'הרץ node .claude/tools/gen-devices.js');
    } else { ok('bot-facts.json תואם את devices.json גם בתוכן ולא רק בכמות'); }
  })();

  if (srcCount !== null && srcCount !== list.length) {
    bad('bot-facts.json מחזיק ' + list.length + ' דגמים ו-devices.json מחזיק ' + srcCount +
      ' — הרץ node .claude/tools/gen-devices.js, אחרת הבוט עובד מול קטלוג ישן בשקט');
  } else if (srcCount !== null) {
    ok('bot-facts.json מסונכרן עם devices.json (' + list.length + ' דגמים)');
  }

  /* שלושת שדות האמון, שהם הליבה של v1 */
  var missing = list.filter(function (d) {
    return d.kind === 'sold' && (!d.warranty_by || !d.payments || !d.data_transfer);
  }).map(function (d) { return d.slug; });
  if (missing.length) {
    warn('דגמים נמכרים בלי אחריות/תשלומים/העברת נתונים: ' + missing.join(', ') +
      ' — הבוט ינתב לאדם בשאלות האלה');
  } else { ok('לכל הדגמים הנמכרים יש אחריות, תשלומים והעברת נתונים'); }

  /* מכשיר ייחוס אינו נמכר, ולכן תנאי מסחר עליו הם טעות ולא נתון חסר */
  var refWithTerms = list.filter(function (d) {
    return d.kind === 'reference' && (d.warranty_by || d.payments || d.warranty_months);
  }).map(function (d) { return d.slug; });
  if (refWithTerms.length) {
    bad('מכשיר ייחוס עם תנאי מסחר: ' + refWithTerms.join(', ') +
      ' — אנחנו לא מוכרים אותו, ולכן אין לו אחריות ואין לו תשלומים');
  } else {
    ok(list.filter(function (d) { return d.kind === 'reference'; }).length +
      ' מכשירי ייחוס, אף אחד בלי תנאי מסחר');
  }

  /* הרתמה מחלצת את אזור התשובות מ-index.html ומריצה אותו ב-vm מול כל 24 הדגמים כפול כל
   * השדות, כלומר 624 צירופים, ובודקת שאין מחיר, שאין מספר מחוץ לשדה המקור, ושדגם ייחוס
   * נושא גילוי נאות בכל אזכור. היא מורצת מכאן ולא מתועדת כהמלצה, כי כלל שרק מתועד נשחק:
   * הערות המקף הארוך במדריך נוקו לאפס ב-30 ביולי וחזרו ל-22 למחרת. */
  (function () {
    var harness = P('.claude/tools/bot-harness.js');
    if (!fs.existsSync(harness)) { warn('bot-harness.js חסר — שכבת התשובות של הבוט לא נבדקת'); return; }
    /* שתי רתמות ולא אחת. bot-harness מאמת את **בוני התשובות**, ו-bot-flow-harness את
     * **הניתוב** אליהם. הראשונה הייתה ירוקה לגמרי בזמן שארבע מחמש שאלות דגם נחטפו
     * לזרימות ולא הגיעו לבונים בכלל, כי היא קוראת להם ישירות ולא דרך handle(). */
    var flow = P('.claude/tools/bot-flow-harness.js');
    if (fs.existsSync(flow)) {
      var rf = require('child_process').spawnSync(process.execPath, [flow, ROOT], { encoding: 'utf8' });
      var of = ((rf.stdout || '') + (rf.stderr || '')).trim();
      if (rf.status === 0) {
        var mf = of.match(/(\d+)\/(\d+) שאלות נחתו/);
        ok('ניתוב הבוט: ' + (mf ? mf[1] + '/' + mf[2] : '?') + ' שאלות נחתות במקום הנכון');
      } else {
        bad('ניתוב הבוט נכשל: ' + of.split('\n').filter(function (l) { return l.indexOf('✗') >= 0; })
          .join(' · ').slice(0, 300));
      }
    } else { warn('bot-flow-harness.js חסר — ניתוב השאלות אינו נבדק'); }

    var r = require('child_process').spawnSync(process.execPath, [harness, ROOT], { encoding: 'utf8' });
    var out = ((r.stdout || '') + (r.stderr || '')).trim();
    if (r.status === 0) {
      var m = out.match(/נבדקו (\d+) צירופים/);
      ok('שכבת התשובות של הבוט: ' + (m ? m[1] : '?') + ' צירופים של דגם כפול שדה עוברים');
    } else {
      bad('שכבת התשובות של הבוט נכשלה: ' + out.split('\n').filter(function (l) { return l.indexOf('✗') >= 0; })
        .join(' · ').slice(0, 300));
    }
  })();
})();

/* ---------- 30. כל סקריפט inline בעמודים מתקמפל ----------
 * בדיקה 19 מהדרת את סקריפטי הכלים ב-.claude, וזו האחות שלה לצד הלקוח. אין build ואין
 * linter בפרויקט, ולכן שגיאת תחביר בסקריפט inline **נשלחת לפרודקשן בשקט**: ה-HTML נטען,
 * העמוד נראה תקין, והפיצ'ר פשוט מת. אף בדיקה כאן לא הייתה תופסת את זה, וזה נמצא בפועל.
 *
 * vm.Script מהדר ולא מריץ, ולכן אין שום סיכון בהרצה מכאן.
 * JSON-LD מדולג (בדיקה 9 מטפלת בו), וסקריפט עם src אינו קוד של העמוד. */
(function () {
  var vm = require('vm');
  var broken = [], count = 0, filesWith = 0;
  pageFiles.forEach(function (f) {
    var s = readPage(f); if (!s) return;
    var re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi, m, i = 0, any = false;
    while ((m = re.exec(s)) !== null) {
      var attrs = m[1] || '', body = m[2] || '';
      if (/\bsrc\s*=/.test(attrs)) continue;
      if (/type\s*=\s*["']?application\/ld\+json/i.test(attrs)) continue;
      if (!body.trim()) continue;
      i++; count++; any = true;
      var line = s.slice(0, m.index).split('\n').length;
      try { new vm.Script(body, { filename: f + ':script' + i }); }
      catch (e) { broken.push(f + ' סקריפט ' + i + ' (שורה ~' + line + '): ' + e.message.slice(0, 70)); }
    }
    if (any) filesWith++;
  });
  if (broken.length) {
    bad('סקריפט inline עם שגיאת תחביר: ' + broken.join(' · ') +
      ' — העמוד ייטען, ייראה תקין, והפיצ\'ר יהיה מת');
  } else if (count) {
    ok(count + ' סקריפטים inline ב-' + filesWith + ' עמודים מתקמפלים');
  }
})();

/* ---------- 31. chat.js ו-chat.css לא נפרדו מ-index.html ----------
 * הצ'אט נגזר מ-index.html ל-21 עמודי תוכן דרך שני קבצים חיצוניים. index.html הוא מקור
 * האמת, ואם מישהו יערוך שם את הבוט בלי להריץ את gen-bot.js, 21 העמודים ימשיכו להריץ
 * גרסה ישנה **בלי שום סימן**: הצ'אט ייפתח, יענה, ופשוט לא יידע את מה שנוסף.
 * זה הכשל שהמחולל מזמין, ולכן הוא נסגר כאן ולא בהמלצה. */
(function () {
  var idx, js, css;
  try { idx = read('prototype/index.html'); } catch (e) { return; }
  var hasSrc = idx.indexOf('/* bot:js:start') >= 0;
  try { js = read('prototype/chat.js'); css = read('prototype/chat.css'); }
  catch (e) {
    if (hasSrc) warn('chat.js או chat.css חסרים — הרץ node .claude/tools/gen-bot.js');
    return;
  }
  if (!hasSrc) { bad('חסר הסימון bot:js:start ב-index.html, ואי אפשר לגזור ממנו'); return; }
  var a = idx.indexOf('/* bot:js:start'), b = idx.indexOf('/* bot:js:end */');
  var want = idx.slice(a, b + '/* bot:js:end */'.length);
  /* משווים אחרי נרמול רווחים, כי סופי שורה משתנים בין הקבצים */
  function norm(s) { return s.replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim(); }
  if (norm(js).indexOf(norm(want)) < 0) {
    bad('chat.js אינו תואם ל-index.html — 21 עמודי התוכן מריצים גרסה ישנה של הבוט. ' +
      'הרץ node .claude/tools/gen-bot.js');
  } else { ok('chat.js תואם למקור ב-index.html'); }

  /* הבדיקה הקודמת השוותה את chat.js בהכלה בלבד, ואת chat.css לא השוותה כלל: אפשר היה
   * להוסיף קוד ל-chat.js או לשנות את chat.css והפריפלייט נשאר ירוק. החותמת שהמחולל
   * כותב על הגוף סוגרת את שניהם, כי כל עריכה ידנית משנה את הגוף ולא את החותמת. */
  var crypto = require('crypto'), tampered = [];
  [['chat.js', js], ['chat.css', css]].forEach(function (pair) {
    var body = pair[1].replace(/^[\s\S]*?\/\* sha1:([0-9a-f]+) \*\/\r?\n/, '');
    var m = pair[1].match(/\/\* sha1:([0-9a-f]+) \*\//);
    if (!m) { tampered.push(pair[0] + ' (בלי חותמת, הרץ gen-bot.js)'); return; }
    /* אותה צורה קנונית שב-gen-bot.js, אחרת המרת סופי שורה בצ'קאאוט שוברת את החותמת */
    var got = crypto.createHash('sha1').update(body.replace(/\r\n/g, '\n').replace(/\s+$/, '')).digest('hex').slice(0, 16);
    if (got !== m[1]) tampered.push(pair[0] + ' (נערך ידנית)');
  });
  if (tampered.length) {
    bad('קובץ נגזר שאינו תואם לחותמת שלו: ' + tampered.join(', ') +
      ' — הרץ node .claude/tools/gen-bot.js במקום לערוך אותו');
  } else { ok('chat.js ו-chat.css תואמים לחותמת שלהם'); }

  /* ומהכיוון השני: כלל pg- שנוסף ל-index.html ולא הגיע ל-chat.css */
  var idxCss = (idx.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  var missCss = [];
  (idxCss.match(/(^|\})\s*(\.pg-[a-z0-9-]+)\s*\{/g) || []).forEach(function (m2) {
    var sel = (m2.match(/\.pg-[a-z0-9-]+/) || [])[0];
    if (sel && css.indexOf(sel) < 0 && missCss.indexOf(sel) < 0) missCss.push(sel);
  });
  if (missCss.length) {
    bad('כללי pg- שקיימים ב-index.html ולא ב-chat.css: ' + missCss.slice(0, 6).join(', ') +
      ' — עמודי התוכן יציגו את הצ\'אט בלי העיצוב הזה');
  } else { ok('כל כללי ה-pg- מ-index.html קיימים ב-chat.css'); }

  /* **נוכחות אינה זהות.** הבדיקה מעל מוודאת שהסלקטור קיים, ולא שהגוף שלו זהה. זה נמצא
   * בפועל: סשן אחר הוסיף env(safe-area-inset-bottom) למיקום ה-FAB ב-index.html ולא הריץ
   * את המחולל, ולכן תיקון המובייל חי בדף הבית ולא ב-20 עמודי התוכן, וכל השערים היו
   * ירוקים. אותה טעות של נוכחות מול תוכן שכבר תוקנה בבדיקה 29 ובבדיקה 32. */
  function rules(src) {
    var out = {}, rx = /([^{}]+)\{([^{}]*)\}/g, m2;
    var css2 = (src.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n') || src;
    /* **הערות יורדות לפני הפירסור, בדיוק כמו ב-gen-bot.js.** שני הצדדים חייבים להיקרא
     * באותה צורה, אחרת השער משווה תפוחים לתפוזים. זה קרה: אחרי ש-gen-bot התחיל להסיר
     * הערות, הבדיקה עדיין קראה את index.html איתן, והכריזה על דריפט ב-.pg-ad-cta
     * ששני העותקים שלו זהים תו בתו. הסיבה היא שהפירסור כאן הוא רגקס ולא מנתח CSS,
     * ולכן טקסט בתוך הערה נספר כסלקטור. */
    css2 = css2.replace(/\/\*[\s\S]*?\*\//g, ' ');
    css2.replace(/@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ').replace(rx, function (r, sel, body) {
      sel = sel.trim();
      if (/(^|[\s,>+~])\.pg-/.test(sel)) out[sel] = body.replace(/\s+/g, '');
      return r;
    });
    return out;
  }
  var inIdx = rules(idx), inCss = rules(css), drift = [];
  Object.keys(inIdx).forEach(function (sel) {
    if (inCss[sel] !== undefined && inCss[sel] !== inIdx[sel]) drift.push(sel);
  });
  if (drift.length) {
    bad('כללי pg- שהגוף שלהם שונה בין index.html ל-chat.css: ' + drift.slice(0, 5).join(', ') +
      ' — עמודי התוכן מקבלים עיצוב ישן. הרץ node .claude/tools/gen-bot.js');
  } else { ok('גוף כללי ה-pg- זהה בין index.html ל-chat.css'); }

  /* כל עמוד שאמור לשאת את הצ'אט באמת נושא אותו.
   *
   * **זה השער שתופס סדר הרצה שגוי של המחוללים.** gen-devices ו-gen-compare כותבים את
   * עמוד המכשיר וההשוואה במלואם מתבנית, ולכן הרצה שלהם אחרי gen-bot מוחקת את הצ'אט
   * מ-31 עמודים בלי שום שגיאה. הרשימה כאן באה מ-bot-pages.js, אותו קובץ שהמחולל מזריק
   * לפיו, ולכן מחיקה כזאת מפילה את הפריפלייט במקום להגיע לאוויר בשקט. */
  var carriesChat = require('./tools/bot-pages.js');
  var missing = [];
  CONTENT_PAGES.forEach(function (f) {
    var url = f === 'index.html' ? '/' : '/' + f.replace(/\/index\.html$/, '') + '/';
    if (!carriesChat(url)) return;
    var s = readPage(f); if (!s) return;
    if (s.indexOf('id="pgFab"') < 0 || s.indexOf('/chat.js') < 0) missing.push(f);
  });
  if (missing.length) {
    bad('עמודים שאמורים לשאת את הצ\'אט ואינם נושאים אותו: ' + missing.join(', ') +
        '. אם זה קרה אחרי gen-devices או gen-compare, הם דרסו את העמודים: הרץ gen-bot.js אחרון');
  } else { ok('הצ\'אט קיים בכל עמודי התוכן שאמורים לשאת אותו'); }
})();

/* ---------- 32. bot-content.json מיושן מול העמודים ----------
 * זה קרה בפועל, ולא בתיאוריה: אחרי rebase על origin/main אחד מ-21 העמודים המאונדקסים
 * השתנה, מספר המקטעים נשאר 193 בדיוק, והבוט המשיך לצטט את הנוסח הישן. ספירה לא תופסת
 * את זה, ולכן המחולל שומר טביעת אצבע של ה-main של כל עמוד וכאן משווים אותה מחדש.
 * הצ'אט עצמו לא נשבר במקרה כזה, הוא פשוט מצטט טקסט שלא קיים יותר בעמוד. */
(function () {
  var raw;
  try { raw = read('prototype/bot-content.json'); } catch (e) { return; }
  var c; try { c = JSON.parse(raw); } catch (e) { bad('bot-content.json שבור'); return; }
  if (!c.src) { warn('bot-content.json בלי טביעות אצבע — הרץ node .claude/tools/gen-bot-content.js'); return; }
  var crypto = require('crypto'), stale = [], missing = [];
  Object.keys(c.src).forEach(function (url) {
    var rel = url === '/' ? 'index.html' : url.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
    var s;
    try { s = read('prototype/' + rel); } catch (e) { missing.push(url); return; }
    var mm = s.match(/<main[\s\S]*?<\/main>/i);
    if (!mm) { missing.push(url); return; }
    /* אותה צורה קנונית שב-gen-bot-content.js. סוף שורה אינו שינוי תוכן, ובלי הנרמול
       העמודים שעל הדיסק ב-CRLF דיווחו כמיושנים מול אותו טקסט בדיוק. */
    var h = crypto.createHash('sha1').update(mm[0].replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
    if (h !== c.src[url]) stale.push(url);
  });
  /* **וגם הכיוון ההפוך.** ההשוואה למעלה רצה על העמודים שנמצאים באינדקס, ולכן עמוד שנפל
   * ממנו לגמרי אינו ב-src והיא לא מסתכלת עליו בכלל. זה קרה בפועל: /guides/first-day-checklist/
   * נעדר מהאינדקס החי בזמן שהעמוד קיים, מחזיר 200 ומייצר שלושה מקטעים תקינים. הבוט פשוט
   * לא יודע שהמדריך הזה קיים, ואין לזה שום סימן. */
  var shouldIndex = [];
  CONTENT_PAGES.forEach(function (f) {
    var url = f === 'index.html' ? '/' : '/' + f.replace(/\/index\.html$/, '') + '/';
    if (/^\/guides\/.+\//.test(url) || url === '/phone-problems/' || /^\/[a-z0-9-]+-kiryat-gat\/$/.test(url)) {
      if (!c.src[url]) shouldIndex.push(url);
    }
  });
  if (shouldIndex.length) {
    bad('עמודים שאמורים להיות באינדקס התוכן ואינם: ' + shouldIndex.join(', ') +
      ' — הבוט לא יודע שהם קיימים. הרץ node .claude/tools/gen-bot-content.js');
  } else { ok('כל עמודי התוכן שאמורים להיות באינדקס נמצאים בו'); }

  if (missing.length) bad('bot-content.json מפנה לעמודים שאינם: ' + missing.join(', '));
  if (stale.length) {
    bad('bot-content.json מיושן מול ' + stale.length + ' עמודים: ' + stale.slice(0, 4).join(', ') +
      (stale.length > 4 ? ' ועוד' : '') + ' — הבוט מצטט נוסח שלא קיים יותר. ' +
      'הרץ node .claude/tools/gen-bot-content.js');
  } else if (!missing.length) {
    ok('bot-content.json מסונכרן עם ' + Object.keys(c.src).length + ' העמודים המאונדקסים');
  }
})();


/* ---------- 33. aria-current מצביע על העמוד שבו הוא נמצא ----------
 * המחוללים בונים עמוד חדש בכך שהם מעתיקים עמוד קיים ומחליפים את ה-main. הניווט נוסע
 * איתו כמו שהוא, ובתוכו aria-current="page" שכבר מסומן על העמוד ששימש כתבנית. התוצאה:
 * 42 עמודי השוואה הכריזו ש-/guides/official-vs-parallel-import/ הוא העמוד הנוכחי,
 * ו-11 עמודים הכריזו את זה על /phones/galaxy-a07/.
 *
 * זו תקלת נגישות ולא רק חוסר דיוק: קורא מסך מכריז "העמוד הנוכחי" על קישור שמוביל
 * למקום אחר, כלומר משקר למי שסומך עליו כדי לדעת איפה הוא נמצא.
 *
 * gen-nav.js מתקן את זה כשהוא רץ, אבל רק אם הוא רץ אחרי שאר המחוללים. סדר הרצה אינו
 * דבר שאפשר לזכור, ולכן הבדיקה כאן ולא בהערה. */
(function () {
  var wrong = [];
  pageFiles.forEach(function (rel) {
    var s;
    try { s = read('prototype/' + rel); } catch (e) { return; }
    /* שתי צורות ולא אחת. עמוד בתיקייה נמצא בכתובת עם לוכסן, אבל קובץ .html בשורש
       נמצא בכתובת שכוללת את הסיומת: privacy.html מוגש כ-/privacy.html, וכל 78 העמודים
       מקשרים אליו כך בפוטר. גרסה קודמת גזרה ממנו /privacy/, כלומר כתובת שאינה קיימת,
       ולכן העמוד שסימן את *עצמו* נכון נספר כשגוי. */
    var selves = rel === 'index.html' ? ['/']
      : /index\.html$/.test(rel) ? ['/' + rel.replace(/index\.html$/, '')]
      : ['/' + rel, '/' + rel.replace(/\.html$/, '/')];
    var re = /<a[^>]*aria-current="page"[^>]*>/g, m;
    while ((m = re.exec(s)) !== null) {
      var href = (m[0].match(/href="([^"]*)"/) || [])[1];
      if (!href) continue;
      if (selves.indexOf(href) < 0) wrong.push(rel + ' → ' + href);
    }
  });
  if (wrong.length) {
    bad(wrong.length + ' עמודים מסמנים aria-current על קישור שאינו הם עצמם (' +
      wrong.slice(0, 3).join(', ') + (wrong.length > 3 ? ' ועוד' : '') +
      ') — קורא מסך יכריז "העמוד הנוכחי" על מקום אחר. הרץ node .claude/tools/gen-nav.js אחרי שאר המחוללים');
  } else {
    ok(pageFiles.length + ' עמודים: aria-current מצביע על העמוד עצמו, או שאינו קיים');
  }
})();

/* ---------- 34. קרוסלת המבצעים לא נעלמה מעמוד שהיא הייתה בו ----------
 * **זה קרה, ובשקט מוחלט.** ב-16.8.2026 הרצת gen-devices כתבה מחדש את 21 עמודי המכשיר
 * מהתבנית שלהם, ו-373 השורות של הקרוסלה נעלמו מכולם. אף בדיקה לא הרגישה, כי הקרוסלה אינה
 * חלק מהמסגרת שנבדקת בעמוד, ומה שנשאר בעמוד היה תקין לגמרי בפני עצמו. גילינו זאת רק כי
 * מישהו הסתכל בגודל ה-diff.
 *
 * ספירה של עמודים עם קרוסלה לא הייתה תופסת: 19 עמודי ההשוואה נושאים את ה-CSS שלה ולא את
 * המקטע, וזה תקין. לכן ההשוואה היא מול הרשימה ש-add-deals עצמו כתב בהרצה האחרונה, כלומר
 * מול מה שבאמת הושם, ולא מול כלל שמנחשים אותו כאן מחדש. */
(function () {
  var man;
  try { man = JSON.parse(read('.claude/deals-pages.json')); }
  catch (e) { warn('אין .claude/deals-pages.json — הרץ node .claude/tools/add-deals.js'); return; }
  var lost = (man.pages || []).filter(function (rel) {
    var s; try { s = read('prototype/' + rel + '/index.html'); } catch (e) { return false; }
    return s.indexOf('pg-deals:section:start') < 0;
  });
  if (lost.length) {
    bad('קרוסלת המבצעים נעלמה מ-' + lost.length + ' עמודים שהיא הייתה בהם: ' + lost.slice(0, 6).join(', ') +
        (lost.length > 6 ? ' ועוד' : '') +
        '. gen-devices ו-gen-compare כותבים עמוד שלם מתבנית: הרץ add-deals.js אחריהם, ואז gen-nav ו-gen-bot');
  } else { ok('קרוסלת המבצעים קיימת בכל ' + (man.pages || []).length + ' העמודים שהיא הושמה בהם'); }
})();

/* ---------- 35. chat.css שומר על סדר המקור של index.html ----------
 * **זה קרה, וזה עלה ל-75 עמודים.** gen-bot.js אסף קודם את כל שאילתות המדיה ואחר כך את
 * כללי הבסיס, ולכן ב-chat.css כל ה-@media ישבו בראש הקובץ והבסיס אחריהם. אותה ספציפיות,
 * הבסיס מאוחר יותר, ולכן שאילתות המדיה מתו: הפאנל הופיע ככרטיס דסקטופ במקום גיליון תחתון
 * במובייל, וכל כללי prefers-reduced-motion הפסיקו לפעול, כלומר אנימציות רצו למי שביקש
 * במפורש להפחית תנועה. בדף הבית הכול עבד, כי שם ה-CSS מוטמע במקור.
 *
 * בדיקה 31 השוותה נוכחות ותוכן של כללים והייתה ירוקה לגמרי, כי הגופים אכן זהים.
 * **CSS הוא רגיש לסדר, ולכן השוואת תוכן בלי השוואת סדר אינה מספיקה.** */
(function () {
  var css, src;
  try { css = read('prototype/chat.css'); src = read('prototype/index.html'); }
  catch (e) { return; }

  /* רשימת חתימות מסודרת: כל כלל מקבל את שאילתת המדיה שמעליו, את הסלקטור ואת הגוף */
  function ordered(text, isSheet) {
    var blocks = isSheet ? [text] : (text.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [])
      .map(function (b) { return b.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''); });
    var list = [];
    function flat(txt, head) {
      txt.replace(/([^{}]+)\{([^{}]*)\}/g, function (r, sel, body) {
        var s = sel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
        if (s) list.push(head + '|' + s + '|' + body.replace(/\s+/g, ' ').trim());
        return r;
      });
    }
    blocks.forEach(function (b) {
      var re = /@media[^{]+\{((?:[^{}]|\{[^{}]*\})*)\}/g, m, last = 0;
      while ((m = re.exec(b))) {
        flat(b.slice(last, m.index), '');
        flat(m[1], m[0].slice(0, m[0].indexOf('{')).replace(/\s+/g, ''));
        last = m.index + m[0].length;
      }
      flat(b.slice(last), '');
    });
    return list;
  }

  var wanted = ordered(css, true), have = ordered(src, false);
  var pos = {}, i;
  for (i = 0; i < have.length; i++) if (pos[have[i]] === undefined) pos[have[i]] = i;

  var prev = -1, breaks = [];
  for (i = 0; i < wanted.length; i++) {
    var p = pos[wanted[i]];
    if (p === undefined) continue;      /* בדיקה 31 כבר אוכפת התאמת תוכן */
    if (p < prev) breaks.push(wanted[i].split('|').slice(0, 2).join(' ').slice(0, 60));
    else prev = p;
  }
  if (breaks.length) {
    bad('chat.css לא שומר על סדר המקור של index.html ב-' + breaks.length + ' כללים: ' +
        breaks.slice(0, 4).join(' · ') + (breaks.length > 4 ? ' ועוד' : '') +
        '. CSS רגיש לסדר, ולכן כלל שהוזז אחורה מת בשקט בכל עמודי התוכן. הרץ gen-bot.js');
  } else { ok('chat.css שומר על סדר המקור של index.html (' + wanted.length + ' כללים)'); }
})();

/* ---------- 36. הבוט לא נוקב במחיר בשום מחרוזת ----------
 * הכלל הזה נאכף על שכבת הדגמים (הרתמה, 720 צירופים) ועל שכבת התוכן (gen-bot-content
 * משמיט 37 מקטעים בגלל אזכור מחיר), **ומעולם לא על 18 הכוונות שנכתבו ביד.** שם בדיוק
 * ישב מחיר: כוונת "מבצע" אמרה "מגן זכוכית מסך כולל הדבקה ב-9 ₪". המחיר לגיטימי בעמוד,
 * ולא בפי הבוט, כי בשיחה אין את ההקשר ואת התאריך. זו בדיוק ההנמקה שכתובה כבר
 * ב-gen-bot-content.js, ורק שכבה אחת לא כוסתה.
 * מעוגן בספרה: "שקל" לבדו הוא גם ש+קל. ראו את אותה הנמקה בשתי הרתמות. */
(function () {
  var src;
  try { src = read('prototype/index.html'); } catch (e) { return; }
  var a = src.indexOf('/* bot:js:start'), b = src.indexOf('/* bot:js:end */');
  if (a < 0 || b < 0) { warn('סימני bot:js לא נמצאו, לא נבדק מחיר בבוט'); return; }
  var code = src.slice(a, b);
  var PRICE = /₪|\bNIS\b|\d[\d,.]*\s*(?:שקל|שקלים|ש"ח)/;
  var re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g, m, hits = [], n = 0;
  while ((m = re.exec(code))) {
    var s = m[1] !== undefined ? m[1] : m[2];
    n++;
    if (PRICE.test(s)) hits.push(s.slice(0, 70));
  }
  if (hits.length) {
    bad('הבוט נוקב במחיר ב-' + hits.length + ' מחרוזות: ' + hits.join(' · ') +
        '. מחיר לגיטימי בעמוד ולא בשיחה, כי אין בה הקשר ואין תאריך');
  } else { ok('אין מחיר באף אחת מ-' + n + ' מחרוזות הבוט'); }
})();

/* ---------- 37. נגישות הצ'אט: יעדי מגע, טבעות פוקוס, וגופן שלא מזמין זום ----------
 * חמישה ממצאים מסקירת ה-QA, שכולם קדמו לבוט אבל התפשטו איתו: הוא עבר מעמוד אחד ל-76.
 * כולם נמדדו בדפדפן, וכולם כאן כדי שלא יחזרו בעריכה עתידית של הגיליון.
 *
 * למה זה בדיקת CSS ולא בדיקת דפדפן: אין כאן דפדפן ללא ראש, והרתמה רצה מול DOM מדומה
 * בלי גיליונות סגנון בכלל. הצהרה בגיליון היא מה שאפשר לאכוף, והמדידה בדפדפן היא מה
 * שקבע את הערכים. */
(function () {
  var css;
  try { css = read('prototype/chat.css'); } catch (e) { return; }
  var idx; try { idx = read('prototype/index.html'); } catch (e) { return; }
  var problems = [];

  function ruleOf(sel) {
    var esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = css.match(new RegExp('(^|\\})\\s*' + esc + '\\s*\\{([^}]*)\\}'));
    return m ? m[2] : null;
  }
  /* יעד מגע 44px. הפקד החשוב ביותר בבועה, כפתור ההמרה, נמדד 34px. */
  var cta = ruleOf('.pg-cta a,.pg-cta button');
  if (!cta || !/min-height:\s*44px/.test(cta)) problems.push('לכפתורי ה-CTA בבועות אין min-height:44px');
  var x = ruleOf('.pg-head .x');
  if (!x || !/width:\s*44px/.test(x) || !/box-sizing:\s*border-box/.test(x)) {
    problems.push('לכפתור הסגירה בהדר אין יעד 44px ב-border-box');
  }
  /* מתחת ל-16px, Safari באייפון מגדיל את כל העמוד בנגיעה בשדה */
  var inp = ruleOf('.pg-input input');
  if (!inp || !/font-size:\s*16px/.test(inp)) problems.push('לשדה הקלט אין font-size:16px, ואייפון יזום את העמוד');
  /* טבעת פוקוס לכל פקד, ולא רק לשדה הקלט */
  ['.pg-chip', '.pg-cta button', '.pg-send', '.pg-fab', '.pg-head .x', '.pg-foot a'].forEach(function (s) {
    if (css.indexOf(s + ':focus-visible') < 0) problems.push('אין :focus-visible ל-' + s);
  });
  /* ה-FAB חייב להיות מעל הפאנל, אחרת ה-X שלו מבטיח סגירה וההקשה נוחתת על שליחה */
  var fw = ruleOf('.pg-fab-wrap'), pn = ruleOf('.pg-panel');
  var zf = fw && (fw.match(/z-index:\s*(\d+)/) || [])[1];
  var zp = pn && (pn.match(/z-index:\s*(\d+)/) || [])[1];
  if (!zf || !zp || Number(zf) <= Number(zp)) {
    problems.push('z-index של ה-FAB (' + zf + ') אינו מעל זה של הפאנל (' + zp + ')');
  }
  /* והפאנל חייב להיות בר-פוקוס, אחרת קורא מסך במגע לא מכריז שנפתח דיאלוג */
  if (!/id="pgPanel"[^>]*tabindex="-1"/.test(idx)) problems.push('ל-#pgPanel אין tabindex="-1", והפוקוס לא נכנס לדיאלוג במגע');

  if (problems.length) {
    bad('נגישות הצ\'אט: ' + problems.join(' · '));
  } else {
    ok('נגישות הצ\'אט: יעדי מגע 44px, טבעות פוקוס לכל פקד, גופן קלט 16px, וה-FAB מעל הפאנל');
  }
})();

/* ---------- 38. המייל מהצ'אט מובדל מהמייל מטופס "צרו קשר" ----------
 * שניהם הולכים לאותה תיבה דרך אותו Web3Forms. הטופס שולח "פנייה חדשה מאתר פון גת"
 * והצ'אט שלח "פנייה מהצ׳אט - פון גת", ובסריקה מהירה בטלפון שניהם נקראים
 * "פנייה ... פון גת". ברוך וסיגל לא יכלו לדעת עם מה הם מתעסקים לפני שפתחו.
 * ההבדל חייב לשבת בתחילת הנושא, שהוא מה שנראה בשורת התיבה, וגם בראש גוף ההודעה. */
(function () {
  var home, contact;
  try { home = read('prototype/index.html'); contact = read('prototype/contact/index.html'); }
  catch (e) { return; }
  var chatSubj = (home.match(/subject:'([^']*)'/) || [])[1];
  var formSubj = (contact.match(/name="subject"\s+value="([^"]*)"/) || [])[1];
  var problems = [];
  if (!chatSubj) problems.push('לא נמצא נושא המייל של הצ\'אט');
  if (!formSubj) problems.push('לא נמצא נושא המייל של הטופס');
  if (chatSubj && formSubj) {
    if (chatSubj === formSubj) problems.push('שני הנושאים זהים');
    /* מבדיל בתחילת השורה, ולא באמצעה */
    if (chatSubj.indexOf('צ׳אט') !== 0 && chatSubj.indexOf('[צ׳אט]') !== 0) {
      problems.push('נושא המייל מהצ\'אט אינו נפתח במזהה הצ\'אט: "' + chatSubj + '"');
    }
    if (formSubj.indexOf('צ׳אט') >= 0) problems.push('נושא הטופס מזכיר צ\'אט, וזה מבלבל בכיוון ההפוך');
  }
  /* וגם בראש הגוף, כי מי שקורא בתצוגה מקדימה רואה את השורה הראשונה */
  if (!/var L=\['המקור: העוזר בצ׳אט/.test(home)) {
    problems.push('גוף המייל אינו נפתח בשורת מקור');
  }
  if (problems.length) bad('מייל הצ\'אט: ' + problems.join(' · '));
  else ok('המייל מהצ\'אט מובדל מהטופס בנושא ובשורה הראשונה של הגוף');
})();

/* ---------- אותו עמוד מפרט, שני תמלולים ----------
 *
 * שני דגמים שהמפרט שלהם נלקח מאותו עמוד, ושדה שבו ערך אחד מוכל בשני. זו החתימה של תמלול
 * שנפרד ולא של הבדל: עמוד אחד יכול לומר 6.3 מול 6.9 באלכסון, אבל הוא לא יכול לומר
 * "ProMotion, עד 120Hz" על דגם אחד ו"ProMotion, קצב רענון משתנה עד 120Hz" על השני.
 *
 * ארבעה מקרים כאלה נמצאו ב-17.8.2026, וכולם הופיעו בכלי ההשוואה כהבדל: קצב רענון ותכולת
 * אריזה בין iPhone 17 Pro ל-Pro Max, הפוקוס האוטומטי במצלמה הקדמית בין Galaxy S26 ל-S26+,
 * וצמצם המצלמה הקדמית בין שני האייפונים. כלומר האתר אמר ללקוח שיש הבדל כשאין.
 *
 * הכלה אמיתית מותרת דרך _same_page_ok, מפורשות ועם נימוק. אפל מציעה 2TB ב-Pro Max בלבד. */
(function () {
  var dbPath = P('prototype/devices.json'), dev;
  try { dev = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { warn('devices.json אינו נקרא, בדיקת התמלול דולגה'); return; }
  var allow = dev._same_page_ok || {};
  var list = (dev.devices || []).filter(function (d) { return d.slug; });
  var flat = function (v) { return Array.isArray(v) ? v.join(', ') : v; };
  var clean = function (v) { return String(v).replace(/\s+/g, ' ').trim(); };
  function srcOf(d, key) {
    var ss = d.spec_source || {}, e = ss[key];
    if (e && e.src) return e.src;
    /* src:null נרשם במפורש כ"אין מקור", ואז אין עמוד משותף להשוות מולו */
    if (e && Object.prototype.hasOwnProperty.call(e, 'src')) return null;
    return (ss.default && ss.default.src) || null;
  }
  /* שתי חתימות של תמלול שנפרד, ולא של הבדל:
   *
   * הכלה: צד אחד הוא בדיוק תת-מחרוזת של השני, כלומר משהו נשמט. כך נמצא צמצם המצלמה
   * הקדמית שנשמט אצל ה-Pro Max.
   *
   * אותם מספרים, וכל מילה של צד אחד קיימת גם בשני: כך נמצא "ProMotion, עד 120Hz" מול "ProMotion, קצב
   * רענון משתנה עד 120Hz". שימו לב שהכלה לבדה מפספסת את זה, כי המילים החסרות נמצאות
   * באמצע המשפט ולא בקצה, וזו הסיבה שהתנאי השני קיים בכלל: הגרסה הראשונה של השער בדקה
   * הכלה בלבד ולא תפסה את המקרה שהוליד אותה.
   *
   * המדד אינו אחוז דמיון אלא הכלה מלאה של מילים, כי אחוז דמיון של 0.6 דחה את מקרה
   * ה-ProMotion עצמו (0.5 בלבד), ואחוז נמוך יותר היה מתחיל לתפוס ניסוחים שונים באמת.
   *
   * דרישת זהות המספרים היא מה שמונע רעש: 6.3 מול 6.9 אינץ׳ הם הבדל אמיתי שעמוד אחד יכול
   * לומר על שני דגמים, ושם המספרים שונים ולכן השדה אינו נבדק. */
  function looksLikeSameFact(a, b) {
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
    var na = (a.match(/[\d.]+/g) || []), nb = (b.match(/[\d.]+/g) || []);
    if (na.length !== nb.length) return false;
    for (var i = 0; i < na.length; i++) { if (parseFloat(na[i]) !== parseFloat(nb[i])) return false; }
    var split = function (s) { return s.replace(/[.,:()׳״'"\u2013-]/g, ' ').split(/\s+/).filter(Boolean); };
    var ta = {}, tb = {}, all = {};
    split(a).forEach(function (t) { ta[t] = 1; all[t] = 1; });
    split(b).forEach(function (t) { tb[t] = 1; all[t] = 1; });
    /* תת-קבוצה, ולא אחוז דמיון. מדד דמיון של 0.6 דחה בדיוק את המקרה שהשער נבנה בשבילו,
       כי שלוש המילים שנוספו באמצע המשפט מורידות אותו ל-0.5. */
    var subset = function (x, y) { return Object.keys(x).every(function (t) { return !!y[t]; }); };
    return subset(ta, tb) || subset(tb, ta);
  }
  var keys = {};
  list.forEach(function (d) { Object.keys(d.spec || {}).forEach(function (k) { keys[k] = 1; }); });
  var hits = [], usedAllow = {};
  for (var i = 0; i < list.length; i++) {
    for (var j = i + 1; j < list.length; j++) {
      (function (A, B) {
        Object.keys(keys).forEach(function (k) {
          var va = flat(A.spec[k]), vb = flat(B.spec[k]);
          if (va === null || va === undefined || vb === null || vb === undefined || va === vb) return;
          var sa = srcOf(A, k), sb = srcOf(B, k);
          if (!sa || !sb || sa !== sb) return;
          var ca = clean(va), cb = clean(vb);
          if (!looksLikeSameFact(ca, cb)) return;
          var id = A.slug + '|' + B.slug + '|' + k;
          if (allow[id]) { usedAllow[id] = 1; return; }
          hits.push(k + ' ב-' + A.slug + ' מול ' + B.slug);
        });
      })(list[i], list[j]);
    }
  }
  /* שער על השער: רשומת היתר שאינה נתפסת יותר היא רשומה שמשתיקה משהו אחר, או שכבר תוקן */
  var stale = Object.keys(allow).filter(function (k) { return k !== '_' && !usedAllow[k]; });
  if (hits.length) {
    bad(hits.length + ' שדות תומללו בשני ניסוחים מאותו עמוד מפרט, וכלי ההשוואה מציג אותם כהבדל: ' + hits.slice(0, 4).join(' · '));
  } else if (stale.length) {
    warn('רשומות ב-_same_page_ok שאינן נתפסות יותר, ולכן משתיקות משהו אחר או שכבר תוקנו: ' + stale.join(', '));
  } else {
    ok('אין שדה שתומלל בשני ניסוחים מאותו עמוד מפרט (' + list.length + ' דגמים)');
  }
})();

/* ---------- 39. טענות שהבעלים החליט להוריד ----------
 * "הסניף הראשון והיחיד של סלקום בקרית גת" היא טענת בלעדיות, והנוסח המאושר הוא
 * "משווק מורשה סלקום". ההחלטה נקבעה פעם אחת, יושמה חלקית, והאתר סתר את עצמו: הכותרת
 * ותיאור המטא כבר אמרו "משווק מורשה" בזמן שהשאלות הנפוצות, ה-JSON-LD ותשובת הבוט
 * המשיכו לטעון בלעדיות. **החלטה שלא נאכפת חוזרת**, במיוחד כשהיא פזורה בכמה מקומות.
 *
 * "חינם" אינו נבדק כאן, למרות שהוא אסור: ארבעה מחמשת המופעים באתר יושבים בתוך ציטוטי
 * ביקורות של לקוחות, ובהן אסור לגעת. שער שלא יודע להבדיל היה נכשל על טקסט לגיטימי,
 * וזה שער שמכבים אחרי פעם אחת. */
(function () {
  var BANNED = [
    ['הסניף הראשון והיחיד של סלקום', 'משווק מורשה סלקום', 'טענת בלעדיות שהבעלים החליט להוריד'],
    ['הסניף היחיד של סלקום', 'משווק מורשה סלקום', 'אותה טענה בניסוח מקוצר']
  ];
  var found = [];
  pageFiles.forEach(function (rel) {
    var s;
    try { s = read('prototype/' + rel); } catch (e) { return; }
    BANNED.forEach(function (b) {
      var n = s.split(b[0]).length - 1;
      if (n) found.push(rel + ': "' + b[0] + '" × ' + n + ' (' + b[2] + ', במקומו: "' + b[1] + '")');
    });
  });
  if (found.length) bad('נוסח שהוסר חזר: ' + found.join(' · '));
  else ok('הנוסח על סלקום הוא "משווק מורשה" בכל ' + pageFiles.length + ' העמודים');
})();

/* ---------- 40. מילים שאסורות בקופי שאנחנו כותבים ----------
 * שלושה כללים מ-CLAUDE.md שלא היה להם שער, ולכן הם התגלו במדידה ידנית ולא בהעלאה:
 *   "חינם"      מזלזל במותג. במקומו "ללא עלות" או "בלי לשלם".
 *   "וואטסאפ"   השם נכתב באנגלית.
 *   ו' כפולה    "וותק" ו"וותיק" בראש מילה.
 *
 * **שלוש ההחרגות הן מה שהופך את זה לשער שאפשר לחיות איתו:**
 *
 * 1. **ציטוטי לקוחות.** ארבעה מחמשת המופעים של "חינם" באתר יושבים בתוך ביקורות
 *    אמיתיות, ואסור לגעת בהן. שלושת מערכי הביקורות עטופים ב-pg-reviews:start,
 *    והאזור מנוכה לפני הבדיקה. בלי זה השער נכשל על טקסט לגיטימי, וזה שער שמכבים.
 *
 * 2. **ו' כפולה אחרי תחילית היא נכונה.** 87 מ-88 המופעים באתר הם "הוותיקה"
 *    ו"הוותיק", וזו הצורה התקנית: ו' בראש מילה נכפלת כשמצטרפת תחילית. רק "וותק"
 *    בראש ביטוי היה שגוי, מופע אחד, בשורת "ותק, אמון ושירות אישי". לכן הבדיקה
 *    דורשת גבול מילה לפני, ולא סתם את הרצף.
 *
 * 3. **הערות קוד.** בקובץ יש הערות שמסבירות את התיקונים האלה ומצטטות את המילים
 *    האסורות. הן אינן נראות לקורא, ולכן יורדות לפני הבדיקה, בדיוק כמו בבדיקה 13. */
(function () {
  var HE = '֐-׿';
  var BANNED = [
    /* בלי גבול שמאלי, בכוונה. הצורה שבאמת מופיעה בטקסט היא "בחינם" עם תחילית, ולכן
       דרישת גבול הפכה את הכלל למת: החזרתי את "ובחינם" לקופי והשער נשאר ירוק, וגם
       ההחרגה של הביקורות נראתה מיותרת כי לא היה מה להחריג. "חינם" הוא רצף ייחודי
       שאינו תת-מחרוזת של מילה אחרת, ולכן אין צורך בגבול. */
    { re: /חינם/, what: 'חינם', instead: 'ללא עלות' },
    { re: /וואטסאפ/, what: 'וואטסאפ', instead: 'WhatsApp' },
    { re: new RegExp('(^|[^' + HE + '])וות[קיכ]'), what: 'ו\' כפולה בראש מילה', instead: 'ותק / ותיק' }
  ];
  var found = [];
  pageFiles.forEach(function (rel) {
    var s;
    try { s = read('prototype/' + rel); } catch (e) { return; }
    /* ציטוטי לקוחות, הערות HTML והערות JS יורדים. מה שנשאר הוא מה שאנחנו כתבנו. */
    s = s.replace(/\/\* pg-reviews:start[\s\S]*?pg-reviews:end \*\//g, ' ')
         .replace(/<!--[\s\S]*?-->/g, ' ')
         .replace(/\/\*[\s\S]*?\*\//g, ' ');
    BANNED.forEach(function (b) {
      if (b.re.test(s)) {
        var m = s.match(new RegExp('.{0,24}' + b.re.source.replace(/^\(\^\|\[\^[^\]]*\]\)/, '') + '.{0,24}'));
        found.push(rel + ': ' + b.what + ' (במקומו: ' + b.instead + ')' +
          (m ? ' — ' + m[0].replace(/\s+/g, ' ').trim() : ''));
      }
    });
  });
  if (found.length) {
    bad('מילים אסורות בקופי: ' + found.slice(0, 5).join(' · ') + (found.length > 5 ? ' ועוד ' + (found.length - 5) : ''));
  } else {
    ok('אין מילים אסורות בקופי שאנחנו כותבים, ב-' + pageFiles.length + ' עמודים (ציטוטי לקוחות מוחרגים)');
  }
})();

/* ---------- שלילה במפרט לא הופכת לתכונה ----------
 *
 * traits.js גוזר תכונות ממחרוזות מפרט בעברית, וזה החלק השביר של האזור הזה. ב-17.8.2026
 * התגלה ש-opticalZoom החזיר 'yes', כלומר "יש זום אופטי", לשני דגמים שהמפרט שלהם אומר
 * "אין זום אופטי": הצירוף שהבדיקה החיובית מחפשת מוכל בתוך השלילה. בשאלון הם קיבלו בזכות
 * זה ארבע נקודות על "לצלם מרחוק", והנימוק שהוצג ללקוח היה המשפט השולל עצמו.
 *
 * מה שהסתיר את זה: עשרה דגמים נוספים בלי טלפוטו כתובים "אין עדשת טלפוטו", והם כן חזרו 0.
 * כלומר אותה פונקציה נתנה עשר תשובות נכונות ושתיים שגויות, ואי אפשר היה לראות את זה
 * מהתוצאה בלי לקרוא את המחרוזת שלצידה.
 *
 * הבדיקה כאן היא הכלל ולא המקרה, והיא חלה על שלושת השדות התלת-מצביים, שבהם null אינו 0
 * ולכן אין ברירת מחדל להישען עליה. */
(function () {
  var T, dev;
  try { T = require(path.join(__dirname, 'tools', 'lib', 'traits.js')); }
  catch (e) { warn('traits.js אינו נטען, בדיקת השלילה דולגה'); return; }
  try { dev = JSON.parse(fs.readFileSync(P('prototype/devices.json'), 'utf8')); }
  catch (e) { warn('devices.json אינו נקרא, בדיקת השלילה דולגה'); return; }
  var CASES = [
    { field: 'zoom', label: 'זום אופטי', neg: /אין\s*(?:זום|טלפוטו)\s*אופטי/, get: T.opticalZoom },
    { field: 'storage_expandable', label: 'חריץ זיכרון', neg: /^\s*אין/, get: T.sdCard },
    { field: 'camera_extra', label: 'עדשה רחבה במיוחד', neg: /אין עדשה רחבה/, get: T.ultraWide }
  ];
  var negBad = [], negChecked = 0;
  (dev.devices || []).filter(function (d) { return d.slug; }).forEach(function (d) {
    CASES.forEach(function (c) {
      var raw = d.spec ? d.spec[c.field] : null;
      if (raw === null || raw === undefined) return;
      var txt = Array.isArray(raw) ? raw.join(', ') : String(raw);
      if (!c.neg.test(txt)) return;
      negChecked++;
      var v = c.get(d.spec);
      /* השלילה מפורשת, ולכן הערך הנגזר חייב להיות 0. לא null, ובוודאי לא ערך חיובי. */
      if (v !== 0) negBad.push(d.slug + '.' + c.field + ' אומר שאין ' + c.label + ', והגזירה מחזירה ' + JSON.stringify(v));
    });
  });
  if (negBad.length) {
    bad('שלילה במפרט נגזרה לתכונה קיימת: ' + negBad.join(' · ') +
        ' — השאלון מנקד לפי הגזירה, ולכן זו המלצה שגויה ללקוח');
  } else if (negChecked) {
    ok(negChecked + ' שדות ששוללים תכונה נגזרים לאפס, ולא לערך חיובי');
  }
})();

/* ---------- 40. כל עמוד קיים בכתובת אחת בלבד ----------
 * **נמדד ב-GSC ב-17.8.2026.** דוח האינדוקס הראה 20 עמודים "נסרק אך לא נכלל באינדקס",
 * וכל עשרים הכתובות היו **ללא לוכסן בסוף**. הסיבה: Vercel הגיש כל עמוד גם ב-/path וגם
 * ב-/path/, שתיהן 200 ובלי הפניה ביניהן. גוגל סרק את שתיהן, כיבד את הקנוניקל שמצביע על
 * הגרסה עם הלוכסן, ולכן לא כלל את השנייה, אבל היא נשארה בדוח ובזבזה תקציב סריקה.
 * נראה כמו בעיית תוכן והיה הגדרת שרת.
 *
 * `trailingSlash: true` מחזיר 308 מהצורה הקצרה לארוכה. הבדיקה כאן על ההגדרה **וגם** על
 * הקישורים: קישור פנימי בלי לוכסן היה שולח כל קליק דרך הפניה מיותרת. */
(function () {
  var vj;
  try { vj = JSON.parse(read('prototype/vercel.json')); }
  catch (e) { bad('vercel.json שבור או חסר: ' + e.message); return; }
  var problems = [];
  if (vj.trailingSlash !== true) {
    problems.push('אין "trailingSlash": true, ולכן כל עמוד יוגש בשתי כתובות');
  }
  var noSlash = {}, total = 0;
  pageFiles.forEach(function (rel) {
    var s;
    try { s = read('prototype/' + rel); } catch (e) { return; }
    (s.match(/href="(\/[^"#?]*)"/g) || []).forEach(function (h) {
      var u = h.slice(6, -1);
      total++;
      if (u === '/' || /\.[a-z0-9]{2,5}$/i.test(u)) return;
      if (u.slice(-1) !== '/') noSlash[u] = (noSlash[u] || 0) + 1;
    });
  });
  var k = Object.keys(noSlash);
  if (k.length) {
    problems.push(k.length + ' יעדים פנימיים בלי לוכסן, שכל קליק אליהם עובר דרך הפניה: ' +
      k.slice(0, 4).join(', ') + (k.length > 4 ? ' ועוד' : ''));
  }
  if (problems.length) bad('כתובות: ' + problems.join(' · '));
  else ok('כל עמוד בכתובת אחת: trailingSlash מוגדר, ו-' + total + ' קישורים פנימיים נגמרים בלוכסן');
})();

/* ---------- בדיקה 77: הרשימות ממוינות מהחדש לישן, ולכל דגם יש שדה launch ----------
 *
 * שתי הרשימות בעמוד הכלי ממוינות לפי תאריך ההכרזה. הבורר נבנה ב-gen-compare, ובורר העץ
 * נבנה בצד הלקוח מ-devices-public.json לפי הסדר שבקובץ.
 *
 * למה זה צריך שער: הסדר הוא היחיד מהשניים שאין לו סימן חיצוני כשהוא נשבר. שדה launch מסונן
 * מ-devices-public.json על ידי רשימת ההיתר של השדות הציבוריים, ולכן הסדר בקובץ הזה הוא
 * הנתון עצמו ולא נגזרת שאפשר לחשב מחדש ממנו. דגם שיתווסף ל-devices.json בלי launch ייפול
 * לסוף הרשימה, דגם שיתווסף בלי הרצה מחדש של gen-devices ישב במקום שרירותי, ובשני המקרים
 * העמוד ייראה תקין לגמרי.
 *
 * תאריך עתידי נכשל ולא מזהיר: הוא תמיד טעות הקלדה, והוא מקפיא דגם בראש הרשימה לתמיד. אותו
 * נימוק כמו בבדיקה 27 על חותמת הטריות.
 */
(function () {
  var db, pub, T;
  try { db = JSON.parse(read('prototype/devices.json')); }
  catch (e) { bad('devices.json שבור: ' + e.message); return; }
  try { pub = JSON.parse(read('prototype/devices-public.json')); }
  catch (e) { bad('devices-public.json שבור: ' + e.message); return; }
  try { T = require(require('path').join(__dirname, 'tools', 'lib', 'traits.js')); }
  catch (e) { bad('traits.js לא נטען: ' + e.message); return; }
  if (typeof T.newestFirst !== 'function') { bad('traits.js אינו מייצא newestFirst'); return; }

  var problems = [];
  var now = new Date(), cap = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  var noField = [], badFmt = [], future = [], nulls = [];
  db.devices.forEach(function (d) {
    if (!('launch' in d)) { noField.push(d.slug); return; }
    if (d.launch === null) {
      nulls.push(d.slug);
      /* null מותר, אבל חייב לבוא עם הסבר, אחרת מישהו יחפש שוב את מה שכבר חיפשנו */
      if (!d.launch_note) problems.push(d.slug + ' הוא null בלי launch_note שמסביר למה');
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(d.launch))) { badFmt.push(d.slug + '=' + d.launch); return; }
    if (String(d.launch) > cap) future.push(d.slug + '=' + d.launch);
  });
  if (noField.length) problems.push(noField.length + ' דגמים בלי שדה launch כלל: ' + noField.slice(0, 4).join(', '));
  if (badFmt.length) problems.push('פורמט שאינו YYYY-MM: ' + badFmt.slice(0, 4).join(', '));
  if (future.length) problems.push('תאריך עתידי, שמקפיא את הדגם בראש הרשימה: ' + future.join(', '));

  /* הסדר בקובץ הציבורי חייב להיות בדיוק מה ש-newestFirst נותן על devices.json */
  var want = db.devices.filter(function (d) { return d.status !== 'draft'; })
    .sort(T.newestFirst).map(function (d) { return d.slug; });
  var got = (pub.devices || pub).map(function (d) { return d.slug; });
  if (want.length !== got.length) {
    problems.push('devices-public.json מכיל ' + got.length + ' דגמים ו-devices.json ' + want.length);
  } else {
    for (var i = 0; i < want.length; i++) {
      if (want[i] !== got[i]) {
        problems.push('devices-public.json אינו ממוין מהחדש לישן: במקום ' + (i + 1) +
          ' יש ' + got[i] + ' ואמור להיות ' + want[i] + '. הרץ gen-devices.js');
        break;
      }
    }
  }

  if (problems.length) bad('מיון הדגמים: ' + problems.join(' · '));
  else ok('הרשימות ממוינות מהחדש לישן: ' + (db.devices.length - nulls.length) + ' דגמים מתוארכים, ' +
    nulls.length + ' בלי תאריך ועם הסבר, וסדר devices-public.json תואם');
})();

/* ---------- 41. אורך הכותרת ----------
 * גוגל חותך כותרת ארוכה ומחליף אותה בטקסט משלו, שנלקח מהעמוד. כלומר הכותרת שנכתבה
 * בקפידה פשוט אינה מוצגת, ואין לזה שום סימן חיצוני: העמוד מדורג, נלחץ, והכותרת אחרת.
 *
 * ב-17.8.2026 היו 16 כאלה, וכולן מאותה צורה: שם עברי, שם אנגלי בסוגריים, וזנב שמסביר
 * מה יש בעמוד. הזנב הוא מה שקוצר, כי בשם יש מילת חיפוש ובזנב אין.
 *
 * 60 הוא הסף המקובל בעברית, ומעל 75 הקיצוץ כמעט ודאי. אזהרה בין השניים ונפילה מעל,
 * כי כותרת אחת שגדלה בשלושה תווים אינה סיבה לחסום העלאה. */
(function () {
  var over = [], warn = [];
  pageFiles.forEach(function (rel) {
    var s;
    try { s = read('prototype/' + rel); } catch (e) { return; }
    var t = (s.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
    if (!t) return;
    t = t.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    if (t.length > 75) over.push(rel + ' (' + t.length + ')');
    else if (t.length > 60) warn.push(rel + ' (' + t.length + ')');
  });
  if (over.length) {
    bad(over.length + ' כותרות מעל 75 תווים, ולכן גוגל יחליף אותן בטקסט משלו: ' +
      over.slice(0, 4).join(', ') + (over.length > 4 ? ' ועוד' : '') +
      '. הכותרת של עמוד מכשיר יושבת ב-devices.json תחת seo.title');
  } else if (warn.length) {
    warns.push(warn.length + ' כותרות בין 60 ל-75 תווים, בטווח שגוגל עלול לחתוך: ' +
      warn.slice(0, 4).join(', ') + (warn.length > 4 ? ' ועוד' : ''));
  } else {
    ok(pageFiles.length + ' כותרות, כולן עד 60 תווים');
  }
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
