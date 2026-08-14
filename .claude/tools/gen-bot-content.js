#!/usr/bin/env node
/* PHONE GAT — אינדקס התוכן של האתר, בשביל העוזר בצ'אט.
 *
 *   node .claude/tools/gen-bot-content.js
 *
 * הבוט ידע עד היום שני דברים בלבד: 24 הדגמים מ-bot-facts.json, ו-18 כוונות שנכתבו ביד.
 * שמונת המדריכים, 13 עמודי השירות וחמשת עמודי היישוב היו בלתי נראים לו לגמרי. הקובץ הזה
 * הוא מה שמחבר אותו לתוכן שכבר קיים באתר.
 *
 * שלוש החלטות שמעצבות אותו:
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
var fs = require('fs'), path = require('path');
var ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');

var HE = '\\u0590-\\u05FF';
/* גבול עברי ולא \b, שהוא ASCII: "שקל" נמצא בתוך "משקל" ובתוך "שוקל" */
var PRICE = new RegExp('₪|(?<![' + HE + '])(שקל|שקלים|ש"ח)(?![' + HE + '])');

function walk(d, o) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
    var p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o); else if (/\.html$/.test(e.name)) o.push(p);
  });
  return o;
}
function strip(s) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
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

var files = walk(PROTO, []).filter(function (f) {
  var b = path.basename(f);
  /* שני העמודים המשפטיים אינם תוכן שנשאלים עליו, וקידומת _ היא טיוטה מקומית */
  return !/^(accessibility|privacy)\.html$/.test(b) && b.charAt(0) !== '_';
});

var sections = [], skippedPrice = 0, noMain = [], pages = 0, pageList = [], pageIx = {};
files.forEach(function (f) {
  var html = fs.readFileSync(f, 'utf8');
  var rel = path.relative(PROTO, f).split(path.sep).join('/');
  var mm = html.match(/<main[\s\S]*?<\/main>/i);
  if (!mm) { noMain.push(rel); return; }
  pages++;
  var title = strip((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  var url = urlOf(rel);

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
  pages: pageList,
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
  (noMain.length ? ', ' + noMain.length + ' עמודים בלי <main>' : ''));
