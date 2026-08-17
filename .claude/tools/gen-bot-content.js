#!/usr/bin/env node
/* PHONE GAT — אינדקס התוכן של האתר, בשביל העוזר בצ'אט.
 *
 *   node .claude/tools/gen-bot-content.js
 *
 * הבוט ידע עד היום שני דברים בלבד: 24 הדגמים מ-bot-facts.json, ו-18 כוונות שנכתבו ביד.
 * שמונת המדריכים, 13 עמודי השירות ומדריך התקלות היו בלתי נראים לו לגמרי, למרות שהם התוכן
 * שהאתר נבנה בשבילו. הקובץ הזה מחבר אותו אליהם.
 *
 * **הוא לא מאנדקס את כל האתר, וזו החלטה.** ראו את inIndex למטה: אינדוקס גורף החזיר 593
 * מקטעים שמהם 56% היו כפילות של מה שהבוט כבר יודע. כאן נשארו 193.
 *
 * שלוש החלטות נוספות שמעצבות אותו:
 *
 * 1. **רק <main>.** המסגרת המשותפת, ניווט ופוטר, חוזרת ב-74 עמודים. אילו נכנסה לאינדקס
 *    כל שאילתה הייתה מתאימה לכל עמוד, כלומר רעש טהור.
 *
 * 2. **מקטע ולא עמוד.** היחידה היא כותרת h2/h3 והטקסט עד הבאה, כי זו התשובה שהקורא צריך.
 *    עמוד שלם כתשובה הוא הפניה, לא תשובה.
 *
 * 3. **מקטע שמזכיר מחיר נשמט.** הבוט לא נוקב במחיר בשום נתיב, וציטוט מילה במילה מהאתר
 *    היה עוקף את הכלל דרך הדלת האחורית: בדף הבית באמת כתוב "מגן מסך כולל הדבקה רק 9 ₪".
 *    המחיר הזה לגיטימי בעמוד ולא בפי הבוט, כי בשיחה אין את ההקשר ואת התאריך.
 */
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');

/* מחיר נכתב עם מספר, וזה מה שמבדיל אותו.
   "שקל" לבדו הוא גם ש+קל: בפרוזה של גלקסי S26+ כתוב "וזה מה שקל לפספס", והשומר הקודם
   תפס את זה כמחיר והפיל שדה שלם. גבול עברי לא עוזר כאן, כי זו אותה מילה בדיוק.
   ₪ ו-NIS חד-משמעיים ולכן אינם דורשים ספרה.
   ליטרל ולא new RegExp עם מחרוזת, כדי שלא תהיה בריחה כפולה של הבקסלאשים. */
var PRICE = /₪|\bNIS\b|\d[\d,.]*\s*(?:שקל|שקלים|ש"ח)/;

function walk(d, o) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
    var p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o); else if (/\.html$/.test(e.name)) o.push(p);
  });
  return o;
}
/* רכיבים שיושבים בתוך <main> ואינם תוכן: כפתור ה-WhatsApp, שורת הקרדיט והתאריך,
 * וכיתובי תמונה שהם היום טקסט פלייסהולדר. בלי הסינון הזה הם נשאבים לציטוט, ותשובה על
 * אחריות נגמרה ב"שאלו אותנו ב-WhatsApp נכתב על ידי ברוך אדלשטיין טכנאי ראשי". */
function stripChrome(s) {
  return s.replace(/<div class="hcta"[\s\S]*?<\/div>/gi, ' ')
          .replace(/<p class="meta"[\s\S]*?<\/p>/gi, ' ')
          .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
          .replace(/<a [^>]*class="[^"]*\bbtn\b[^"]*"[\s\S]*?<\/a>/gi, ' ');
}
function strip(s) {
  return stripChrome(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
          .replace(/&[a-z]+;/gi, ' ')
          .replace(/\s+/g, ' ').trim();
}
/* כתובת קנונית, בצורה שבה הקישורים באתר נכתבים */
function urlOf(rel) {
  if (rel === 'index.html') return '/';
  if (/\/index\.html$/.test(rel)) return '/' + rel.replace(/\/index\.html$/, '') + '/';
  return '/' + rel;
}

/* מה נכנס לאינדקס, ומה נשאר בחוץ.
 *
 * המדידה על כל האתר החזירה 593 מקטעים, ומהם **335, כלומר 56%, היו עמודי מכשיר ועמודי
 * השוואה**. שניהם נגזרים מ-devices.json, בדיוק כמו bot-facts.json שהבוט כבר קורא. זו לא
 * רק השמנה של הקובץ: זה יוצר שני נתיבי תשובה מתחרים לאותה שאלה, אחד מובנה ומדויק ואחד
 * מעורפל, והמעורפל ינצח לפעמים. תשובה על אחריות של גלקסי A56 חייבת לבוא מהשדה ולא
 * מפסקה שמזכירה אותו.
 *
 * מה שנשאר הוא מה שהבוט באמת לא יודע, וזה גם מה שלקוח באמת שואל:
 *   13 עמודי השירות     תיקון מסך, סוללה, שקע טעינה, Face ID, מצלמה, רמקול
 *   8 המדריכים          eSIM, אחסון, אחריות בישראל, יבוא מקביל, יום ראשון, טלפון לילד
 *   מדריך התקלות        "הטלפון לא נדלק", "לא נטען", "נפל למים"
 *
 * מה שנשאר בחוץ מלבד המכשירים וההשוואות:
 *   עמודי יישוב         חמישה עמודים כמעט זהים. כל שאילתה הייתה מתאימה לחמישתם.
 *   דף הבית             שיווק, ו-18 הכוונות שנכתבו ביד כבר מכסות אותו.
 *   שערים ו"צרו קשר"    רשימות קישורים, לא תוכן.
 *   דגמים בדרך          מתיישן במהירות, ובדיקה 27 שומרת עליו דווקא בגלל זה. */
function inIndex(url) {
  if (/^\/guides\/.+\//.test(url)) return true;          /* מדריך, לא השער */
  if (url === '/phone-problems/') return true;
  if (/^\/[a-z0-9-]+-kiryat-gat\/$/.test(url)) return true;  /* 13 עמודי השירות */
  return false;
}

var files = walk(PROTO, []).filter(function (f) {
  var b = path.basename(f);
  /* שני העמודים המשפטיים אינם תוכן שנשאלים עליו, וקידומת _ היא טיוטה מקומית */
  return !/^(accessibility|privacy)\.html$/.test(b) && b.charAt(0) !== '_';
});

var sections = [], skippedPrice = 0, noMain = [], pages = 0, pageList = [], pageIx = {}, skippedPage = 0, srcHash = {};
/* **ספריית כל העמודים, ולא רק המאונדקסים.**
 * האינדקס מחזיק 20 עמודים בכוונה, כי אינדוקס גורף כפל את מה שהבוט כבר יודע. אבל כשאין
 * תשובה, ההצעה "יש לנו עמוד בדיוק על זה" שווה הרבה יותר מ"לא הבנתי", וגם עמוד שאינו
 * באינדקס יכול להיות העמוד הנכון: עמוד מכשיר, עמוד השוואה, עמוד יישוב.
 * לכן שם וכתובת לכל 78 העמודים, בערך 6KB, בלי גוף הטקסט. */
var dir = [];
files.forEach(function (f) {
  var html = fs.readFileSync(f, 'utf8');
  var rel = path.relative(PROTO, f).split(path.sep).join('/');
  var mm = html.match(/<main[\s\S]*?<\/main>/i);
  if (!mm) { noMain.push(rel); return; }
  var url = urlOf(rel);
  var title = strip((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');

  /* הספרייה נבנית לכל עמוד, מאונדקס או לא. הכותרת נחתכת בקו האנכי הראשון, כי הזנב
     ("| פון גת", "| מסך, סוללה וטעינה") הוא תבנית SEO ולא שם שאומרים ללקוח.
     ה-h1 נשמר בנפרד כשהוא שונה, כי לפעמים הוא הניסוח שאדם באמת יחפש. */
  var h1 = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  var shortT = title.split('|')[0].trim() || title;
  if (shortT) dir.push(h1 && h1 !== shortT ? { u: url, t: shortT, h: h1 } : { u: url, t: shortT });

  if (!inIndex(url)) { skippedPage++; return; }
  pages++;
  srcHash[url] = crypto.createHash('sha1').update(mm[0]).digest('hex').slice(0, 16);

  /* פיצול לפי h2/h3, ושמירת הכותרת עצמה יחד עם הטקסט שאחריה */
  var chunks = mm[0].split(/(<h[23][^>]*>[\s\S]*?<\/h[23]>)/i);
  var heading = '';
  chunks.forEach(function (c) {
    if (/^<h[23]/i.test(c)) { heading = strip(c); return; }
    var text = strip(c);
    if (text.length < 80) return;
    if (PRICE.test(text) || PRICE.test(heading)) { skippedPrice++; return; }
    /* הכתובת והכותרת חוזרות בכל מקטע של אותו עמוד, ולכן הן מנורמלות לטבלת עמודים
       והמקטע מחזיק אינדקס בלבד. 593 מקטעים על 74 עמודים, כלומר החיסכון משמעותי. */
    var pi = pageIx[url];
    if (pi === undefined) { pi = pageIx[url] = pageList.length; pageList.push({ u: url, t: title }); }
    /* חיתוך ל-600 תווים. החציון הוא 347 ורק הזנב חורג, ולכן ההתאמה כמעט לא נפגעת,
       והתצוגה ממילא מראה כ-200. מקטע ארוך מזה הוא עמוד שלם ולא תשובה. */
    sections.push({ p: pi, h: heading || title, t: text.length > 600 ? text.slice(0, 600) : text });
  });
});

var out = {
  _: 'נגזר אוטומטית מעמודי האתר על ידי gen-bot-content.js. אל תערוך. נקרא על ידי העוזר בצ\'אט.',
  /* טביעת אצבע של ה-main של כל עמוד מאונדקס, כדי שבדיקה 32 תוכל לתפוס אינדקס מיושן.
     זה נמצא בפועל: עמוד השתנה ב-main, מספר המקטעים נשאר 193, והתוכן היה ישן בשקט. */
  src: srcHash,
  pages: pageList,
  /* ספריית כל העמודים, בשביל ההצעה "יש לנו עמוד בדיוק על זה" כשאין תשובה */
  dir: dir,
  sections: sections
};
var file = path.join(PROTO, 'bot-content.json');
fs.writeFileSync(file, JSON.stringify(out) + '\n');

/* שער: מחיר לא נכנס לאינדקס, בשום צורה */
var raw = JSON.stringify(out);
if (PRICE.test(raw)) {
  console.error('✗ bot-content.json מכיל אזכור מחיר — הבוט מצטט מילה במילה, ולכן זה יגיע לשיחה');
  process.exit(1);
}
var kb = Math.round(Buffer.byteLength(raw, 'utf8') / 1024);
console.log('✓ bot-content.json: ' + sections.length + ' מקטעים מ-' + pages + ' עמודים, ' + kb + ' KB' +
  (skippedPrice ? ', ' + skippedPrice + ' נשמטו בגלל אזכור מחיר' : '') +
  (noMain.length ? ', ' + noMain.length + ' בלי <main>' : '') + ', ' + skippedPage + ' עמודים מחוץ לאינדקס בכוונה');
