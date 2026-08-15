#!/usr/bin/env node
/* PHONE GAT — מפיץ את הצ'אט ל-21 עמודי התוכן.
 *
 *   node .claude/tools/gen-bot.js
 *
 * הבוט ישב בדף הבית בלבד, אחד מתוך 76 עמודים. מי שנחת מגוגל על המדריך ל-eSIM הוא בדיוק
 * מי שיש לו שאלה על eSIM, ולא הייתה לו דרך לשאול אותה. המחולל הזה מוסיף אותו לעמודים
 * שכבר נמצאים באינדקס התוכן: 13 עמודי השירות, 8 המדריכים ומדריך התקלות.
 *
 * **למה קובץ חיצוני ולא הטמעה, כמו שאר המסגרת המשותפת.** ה-IIFE של הצ'אט הוא 780 שורות
 * וכ-52KB. הטמעה ב-21 עמודים הייתה מוסיפה כ-1.1MB לריפו ומבטיחה דריפט בין העותקים. הבוט
 * ממילא כבר מושך שלושה קבצים חיצוניים (bot-facts, bot-content, devices-public), ולכן
 * קובץ רביעי עקבי עם מה שקיים ולא חריגה ממנו. **index.html נשאר מקור האמת**, כאן רק
 * גוזרים ממנו, ובדיקה 31 מוודאת שהשניים לא נפרדו.
 *
 * ה-CSS נגזר לפי סלקטור ולא לפי סימון, כי כללי הצ'אט מפוזרים בגיליון: .pg-fab-wrap יושב
 * בשורה 1638 והדריסות של .pg-chip ליעד מגע יושבות ב-2539.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var SRC = path.join(PROTO, 'index.html');
var src = fs.readFileSync(SRC, 'utf8');

function between(s, a, b, what) {
  var i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0 || j < i) { console.error('✗ לא נמצא הסימון של ' + what); process.exit(1); }
  return s.slice(i, j + b.length);
}
var htmlBlock = between(src, '<!-- bot:html:start', '<!-- bot:html:end -->', 'המרקאפ');
var jsBlock = between(src, '/* bot:js:start', '/* bot:js:end */', 'הסקריפט');

/* ---- CSS ----
 * הגרסה הראשונה גזרה לפי pg- בלבד, וזה השאיר כשל חי: המרקאפ של הצ'אט משתמש גם ב-wa-ico
 * (הלוגו של WhatsApp), ו-.wa-ico{border-radius:22%;flex:none;object-fit:contain} נזרק.
 * התוצאה ב-21 עמודי התוכן הייתה לוגו מרובע עם פינות חדות בתוך שורת flex בלי flex:none.
 * לכן נאספות גם המחלקות שבאמת מופיעות במרקאפ, ולא רק אלה ששמן מתחיל ב-pg. */
var markupClasses = (function () {
  var set = {};
  function add(list) { (list || []).forEach(function (c) { if (c && !/^pg-/.test(c)) set[c] = 1; }); }
  (htmlBlock.match(/class="([^"]+)"/g) || []).forEach(function (m) { add(m.slice(7, -1).split(/\s+/)); });
  /* **וגם מחלקות שנוצרות ב-JS.** wa-ico לא מופיע במרקאפ הסטטי בכלל, הוא נכתב בתוך
     מחרוזת בקוד, ולכן איסוף מה-HTML בלבד החמיץ אותו והלוגו יצא מרובע ב-21 עמודים.
     זו בדיוק משפחת "מחלקה שנוצרת ב-JS" שבדיקה 16 בפריפלייט קיימת בגללה. */
  (jsBlock.match(/class="([^"]+)"|className\s*=\s*['"]([^'"]+)['"]/g) || []).forEach(function (m) {
    add(m.replace(/^[^=]*=\s*['"]?/, '').replace(/['"]$/, '').split(/\s+/));
  });
  return Object.keys(set);
})();
function touchesChat(sel) {
  if (/(^|[\s,>+~])[.#]pg-|#pg[A-Z]/.test(sel)) return true;
  for (var i = 0; i < markupClasses.length; i++) {
    var c = markupClasses[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\.' + c + '(?![\\w-])').test(sel)) return true;
  }
  return false;
}
function chatCss(s) {
  var styles = s.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
  var out = [];
  styles.forEach(function (blk) {
    var css = blk.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '');
    /* כללים ברמה העליונה */
    css.replace(/@media[^{]+\{((?:[^{}]|\{[^{}]*\})*)\}/g, function (m, inner, off) {
      var head = m.slice(0, m.indexOf('{') + 1);
      var keep = [];
      inner.replace(/([^{}]+)\{([^{}]*)\}/g, function (r, sel, body) {
        if (touchesChat(sel)) keep.push(sel.trim() + '{' + body + '}');
        return r;
      });
      if (keep.length) out.push(head + keep.join('') + '}');
      return m;
    });
    var flat = css.replace(/@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ');
    flat.replace(/([^{}]+)\{([^{}]*)\}/g, function (r, sel, body) {
      if (touchesChat(sel)) out.push(sel.trim() + '{' + body + '}');
      return r;
    });
  });
  return out.join('\n');
}
var cssBlock = chatCss(src);
if (cssBlock.length < 2000) { console.error('✗ ה-CSS שנגזר קצר מדי (' + cssBlock.length + '), הסלקטורים השתנו?'); process.exit(1); }

/* ---- כתיבת הקבצים החיצוניים ---- */
/* חותמת על הגוף עצמו, כדי שבדיקה 31 תוכל לתפוס עריכה ידנית של הקבצים הנגזרים.
   בלעדיה אפשר היה לשנות את chat.css או להוסיף קוד ל-chat.js והפריפלייט נשאר ירוק. */
var crypto = require('crypto');
/* צורה קנונית זהה בשני הצדדים: בלי הבדלי סופי שורה ובלי רווח בסוף. בלעדיה החותמת
   נשברת לבד ברגע ש-git ממיר סופי שורה בצ'קאאוט, ואז השער צועק על קובץ תקין. */
function canon(s) { return String(s).replace(/\r\n/g, '\n').replace(/\s+$/, ''); }
function stamp(body) {
  return '/* נגזר אוטומטית מ-index.html על ידי gen-bot.js. אל תערוך. */\n' +
         '/* sha1:' + crypto.createHash('sha1').update(canon(body)).digest('hex').slice(0, 16) + ' */\n';
}
fs.writeFileSync(path.join(PROTO, 'chat.css'), stamp(cssBlock) + cssBlock + '\n');
fs.writeFileSync(path.join(PROTO, 'chat.js'), stamp(jsBlock) + jsBlock + '\n');

/* ---- העמודים שמקבלים את הצ'אט: אותם 21 שבאינדקס התוכן ---- */
function inIndex(url) {
  if (/^\/guides\/.+\//.test(url)) return true;
  if (url === '/phone-problems/') return true;
  if (/^\/[a-z0-9-]+-kiryat-gat\/$/.test(url)) return true;
  return false;
}
function urlOf(rel) {
  if (rel === 'index.html') return '/';
  if (/\/index\.html$/.test(rel)) return '/' + rel.replace(/\/index\.html$/, '') + '/';
  return '/' + rel;
}
function walk(d, o) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
    var p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o); else if (/\.html$/.test(e.name)) o.push(p);
  });
  return o;
}
var LINK = '<link rel="stylesheet" href="/chat.css">';
var SCRIPT = '<script src="/chat.js" defer></script>';
var done = 0, skipped = 0;
walk(PROTO, []).forEach(function (f) {
  var rel = path.relative(PROTO, f).split(path.sep).join('/');
  if (!inIndex(urlOf(rel))) { skipped++; return; }
  var s = fs.readFileSync(f, 'utf8');

  /* הסרת גרסה קודמת, כדי שהרצה חוזרת תחליף ולא תוסיף עותק */
  s = s.replace(/<!-- bot:html:start[\s\S]*?<!-- bot:html:end -->\s*/g, '')
       .replace(new RegExp('\\s*' + LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
       .replace(new RegExp('\\s*' + SCRIPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');

  if (s.indexOf('</head>') < 0 || s.indexOf('</body>') < 0) {
    console.error('✗ ' + rel + ': אין head או body'); process.exit(1);
  }
  s = s.replace('</head>', '  ' + LINK + '\n</head>');
  /* המרקאפ לפני </body>, והסקריפט אחריו ב-defer, כדי שלא יחסום ציור */
  s = s.replace('</body>', htmlBlock + '\n' + SCRIPT + '\n</body>');
  fs.writeFileSync(f, s);
  done++;
});

console.log('✓ chat.css: ' + Math.round(cssBlock.length / 1024) + ' KB · chat.js: ' +
  Math.round(jsBlock.length / 1024) + ' KB');
console.log('✓ הצ\'אט הוטמע ב-' + done + ' עמודי תוכן (' + skipped + ' דולגו)');
