#!/usr/bin/env node
/* ============================================================================
 * gen-guide-tables.js — הטבלאות במדריכים שמצהירות על הקטלוג, נגזרות מ-devices.json
 *
 * למה זה קיים: שני מדריכים החזיקו טבלאות שנכתבו ביד ומצהירות על כלל הקטלוג, והן התיישנו
 * בשקט בכל דגם שנוסף. ב-18.8.2026, כשהמאגר הגיע ל-78 דגמים ו-21 נמכרים, זה נראה כך:
 *
 *   first-phone-for-kid   הכותרת אומרת "דירוג העמידות של הדגמים שאנחנו מוכרים", ובגוף
 *                         העמוד "אספנו את הדירוג של כל דגם שאנחנו מוכרים". בטבלה היו 11
 *                         דגמים, וחסרו עשרה. שורת ה-IP64 החסירה את A27, שורת ה-IP54 את
 *                         A07, ולא הייתה שורה בכלל ל-IP69K.
 *
 *   how-much-storage      טבלה עם 17 דגמים מתוך 21, והערה מתחתיה שאומרת "ב-5 דגמים בלבד
 *                         מתוך 17". בנוסף, שורות של אייפון אמרו "היצרן אינו מציין" בזמן
 *                         שאפל כן מצהירה במפורש שאין הרחבה. ובאותו עמוד גם "12 הדגמים",
 *                         כלומר שלושה מספרים שונים לאותו דבר.
 *
 * טבלה שמצהירה על שלמות היא הדבר היחיד באתר שאסור לכתוב ביד, כי הצהרת השלמות היא בדיוק מה
 * שנשבר, ואין לה שום סימן חיצוני. הכלל נרשם ב-_rules.no_catalogue_superlatives.
 *
 * המחולל בר-הרצה חוזרת: כל טבלה עטופה בסימני התחלה וסוף, והרצה שנייה מחליפה את מה שביניהם.
 * הוא מסרב לרוץ אם סימן חסר, כי טבלה שלא התעדכנה גרועה מקריסה.
 *
 * מה שנשאר ביד בכוונה: טבלת "אחסון זמין" ב-how-much-storage. הנתון הזה אינו ב-devices.json
 * כלל, כי הוא נקרא מעמודי סמסונג ישראל ואינו שדה מפרט. הפרוזה סביב הטבלאות גם היא ביד,
 * והיא נוסחה כך שאינה נוקבת במספרים, כדי שהמספרים יחיו במקום אחד בלבד.
 * ========================================================================== */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var T = require(path.join(__dirname, 'lib', 'traits.js'));
var db = JSON.parse(fs.readFileSync(path.join(PROTO, 'devices.json'), 'utf8'));

/* רק מה שאנחנו מוכרים. מכשיר ייחוס אינו בקטלוג, ואין לו עמוד לקשר אליו. */
var SOLD = db.devices.filter(function (d) { return d.status !== 'reference' && d.status !== 'draft'; })
  .sort(T.newestFirst);

var esc = function (s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
/* שם עברי אם יש, וקישור לעמוד המכשיר. bdo רק על שם לטיני, כי הוא מתהפך ב-RTL. */
function devLink(d) {
  var he = d.name_he || d.name;
  var label = /^[\x00-\x7F\s]+$/.test(he) ? '<bdo dir="ltr">' + esc(he) + '</bdo>' : esc(he);
  return '<a href="/phones/' + d.slug + '/">' + label + '</a>';
}
/* "א, ב ו-ג" בעברית. ו-ג בלי מקף כשהמילה מתחילה באות, ועם מקף כשהיא מתחילה בלטינית או בספרה. */
function joinHe(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  var last = items[items.length - 1];
  var rest = items.slice(0, -1).join(', ');
  /* המקף נקבע לפי התו הראשון של התווית הגלויה, אחרי הסרת תגיות */
  var plain = last.replace(/<[^>]*>/g, '');
  var dash = /^[A-Za-z0-9]/.test(plain) ? 'ו-' : 'ו';
  return rest + ' ' + dash + last;
}

/* מספר במילים, לצורות כמו "בשישה". רק עד עשרים, כי מעבר לזה ספרה קריאה יותר בעברית
   ואין לנו מקטע שדורש את זה. נופל לספרה אם אין מילה. */
var WORDS_M = ['אפס', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה',
  'תשעה', 'עשרה', 'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר',
  'שבעה עשר', 'שמונה עשר', 'תשעה עשר', 'עשרים'];
function word(n) { return WORDS_M[n] || String(n); }

/* מחליף מקטע פרוזה בין סימנים. בניגוד ל-replaceBlock, כאן אין הזחה ואין שורות. */
function replaceSpan(file, mark, text) {
  var p = path.join(PROTO, file);
  var s2 = fs.readFileSync(p, 'utf8');
  var start = '<!-- gen-guide-tables:' + mark + ':start -->';
  var end = '<!-- gen-guide-tables:' + mark + ':end -->';
  var i = s2.indexOf(start), j = s2.indexOf(end);
  if (i < 0 || j < 0) {
    console.error('✗ ' + file + ': סימני "' + mark + '" חסרים. מספר שלא התעדכן גרוע מקריסה, ולכן עצירה.');
    process.exit(1);
  }
  if (j < i) { console.error('✗ ' + file + ': סימן הסוף של "' + mark + '" לפני ההתחלה'); process.exit(1); }
  fs.writeFileSync(p, s2.slice(0, i + start.length) + text + s2.slice(j));
}

function replaceBlock(file, mark, body) {
  var p = path.join(PROTO, file);
  var s = fs.readFileSync(p, 'utf8');
  var nl = /\r\n/.test(s) ? '\r\n' : '\n';
  var start = '<!-- gen-guide-tables:' + mark + ':start -->';
  var end = '<!-- gen-guide-tables:' + mark + ':end -->';
  var i = s.indexOf(start), j = s.indexOf(end);
  if (i < 0 || j < 0) {
    console.error('✗ ' + file + ': סימני "' + mark + '" חסרים. טבלה שלא התעדכנה גרועה מקריסה, ולכן עצירה.');
    console.error('  צריך לעטוף את הטבלה ב-' + start + ' ו-' + end);
    process.exit(1);
  }
  if (j < i) { console.error('✗ ' + file + ': סימן הסוף לפני סימן ההתחלה'); process.exit(1); }
  var out = s.slice(0, i + start.length) + nl + body.split('\n').join(nl) + nl + '      ' + s.slice(j);
  fs.writeFileSync(p, out);
  return true;
}

/* ---------------------------------------------------------------- 1. דירוג IP
 *
 * הקיבוץ הוא לפי מה שהיצרן מפרסם, ולכן שורה יכולה לשאת יותר מדירוג אחד, כמו
 * "IP68, IP69, IP69K". הסדר יורד, מהמגן ביותר לפחות, כי כך הקורא סורק אותו.
 *
 * הפירוש בעמודה השנייה הוא טקסט עריכותי לכל דירוג, והוא נשמר כאן ולא בקובץ הנתונים, כי הוא
 * הסבר שלנו ולא נתון של היצרן.
 */
var IP_MEANS = {
  'IP69K': 'טבילה, וגם ריסוס במים בלחץ',
  'IP69': 'טבילה, וגם ריסוס במים בלחץ',
  'IP68': 'עומד בשיקוע במים',
  'IP67': 'שיקוע במטר מים לחצי שעה',
  'IP66': 'סילון מים, לא טבילה',
  'IP65': 'סילון מים חלש, לא טבילה',
  'IP64': 'התזה מכל כיוון, לא טבילה',
  'IP54': 'התזה בלבד',
  'IP53': 'התזה בלבד'
};
/* מתחת ל-IP67 אין הבטחה לשיקוע. זה הגבול שהמדריך בנוי עליו. */
var IMMERSION_FROM = 67;

function ipTokens(d) {
  var v = String((d.spec && d.spec.water_resistance) || '');
  var m = v.match(/IP\d+K?/g);
  return m ? m.filter(function (x, i, a) { return a.indexOf(x) === i; }) : [];
}
function ipRank(tokens) {
  var best = 0;
  tokens.forEach(function (t) {
    var n = parseInt(t.replace(/[^\d]/g, ''), 10);
    if (/K$/.test(t)) n += 0.5;
    if (n > best) best = n;
  });
  return best;
}

var ipGroups = {};
var noRating = [];
SOLD.forEach(function (d) {
  var t = ipTokens(d);
  if (!t.length) { noRating.push(d); return; }
  var key = t.join(', ');
  (ipGroups[key] = ipGroups[key] || []).push(d);
});
var ipKeys = Object.keys(ipGroups).sort(function (a, b) {
  return ipRank(b.split(', ')) - ipRank(a.split(', '));
});
if (!ipKeys.length) { console.error('✗ אין אף דגם עם דירוג IP. משהו שבור בנתונים.'); process.exit(1); }

var ipRows = ipKeys.map(function (k) {
  var toks = k.split(', ');
  /* הפירוש נלקח מהדירוג הגבוה שבשורה ולא מהראשון שהיצרן כתב. השורה "IP68, IP69, IP69K"
     אמרה "עומד בשיקוע במים", שזה הפירוש של IP68, בזמן שכל הנקודה של IP69K היא שהוא גם
     ריסוס בלחץ. הסדר שהיצרן פרסם בו אינו הסדר שממנו נגזרת המשמעות. */
  var top = toks.slice().sort(function (a, b) { return ipRank([b]) - ipRank([a]); })[0];
  var means = IP_MEANS[top];
  if (!means) {
    console.error('✗ אין פירוש לדירוג "' + top + '". הוסף אותו ל-IP_MEANS בראש המחולל, ' +
      'כי עמודה ריקה בטבלה גרועה משורה חסרה.');
    process.exit(1);
  }
  var label = toks.map(function (t) { return '<bdo dir="ltr">' + esc(t) + '</bdo>'; }).join(', ');
  return '          <tr><th scope="row">' + label + '</th><td>' + esc(means) + '</td><td>' +
    joinHe(ipGroups[k].map(devLink)) + '</td></tr>';
});
var ipBody = [
  '      <table class="cmp">',
  '        <caption>דירוג העמידות של ' + SOLD.length + ' הדגמים שאנחנו מוכרים, לפי מה שהיצרן מפרסם</caption>',
  '        <thead><tr><th scope="col">דירוג</th><th scope="col">מה זה אומר בפועל</th><th scope="col">הדגמים</th></tr></thead>',
  '        <tbody>'
].concat(ipRows).concat([
  '        </tbody>',
  '      </table>'
]).join('\n');

/* ------------------------------------------------------- 2. נפחים והרחבה בכרטיס
 *
 * שתי עמודות מהנתונים: storage_offered ו-storage_expandable. ההבדל בין "אין" לבין "היצרן
 * אינו מציין" נשמר, כי הוא ההבדל בין יצרן שאמר שאין לבין יצרן ששתק, ובעמוד שכל עניינו
 * ללמד את הקורא לקרוא מפרט זה בדיוק מה שחשוב.
 */
/* ⚠ בלי \b אחרי המילה העברית. גבול מילה ב-JS מוגדר על [A-Za-z0-9_], ואותיות עברית
   נמצאות מחוץ לקבוצה, ולכן /אין\b/ אינו נתפס אף פעם. עם \b כל 21 השורות
   נפלו לענף הלא נכון והמונה אמר 21 במקום 6. */
function expandCell(d) {
  var v = d.spec ? d.spec.storage_expandable : null;
  if (v == null || v === '') return '<i>היצרן אינו מציין</i>';
  if (/^\s*(אין|ללא)/.test(String(v))) return '<i>אין</i>';
  return esc(v);
}
var stRows = SOLD.map(function (d) {
  var offered = d.spec && d.spec.storage_offered;
  var cell = Array.isArray(offered) ? offered.map(esc).join(' · ') : (offered ? esc(offered) : '<i>היצרן אינו מציין</i>');
  var he = d.name_he || d.name;
  var label = /^[\x00-\x7F\s]+$/.test(he) ? '<bdo dir="ltr">' + esc(he) + '</bdo>' : esc(he);
  return '          <tr><th scope="row">' + label + '</th><td>' + cell + '</td><td>' + expandCell(d) + '</td></tr>';
});
var stBody = [
  '      <table class="cmp">',
  '        <caption>נפחי אחסון והרחבה בכרטיס ב-' + SOLD.length + ' הדגמים שאנחנו מוכרים, לפי מה שהיצרן מפרסם.</caption>',
  '        <thead><tr><th scope="col">דגם</th><th scope="col">נפחים</th><th scope="col">כרטיס זיכרון</th></tr></thead>',
  '        <tbody>'
].concat(stRows).concat([
  '        </tbody>',
  '      </table>'
]).join('\n');

/* --------------------------------------------------------------- 3. המספרים בפרוזה
 *
 * שתי הערות נוקבות במספר, ולכן הן נגזרות גם הן. שאר הפרוזה בשני העמודים נוסחה כך שאינה
 * נוקבת במספרים בכלל, וזה מכוון: מספר בפרוזה הוא עותק שני של נתון, והוא נפרד ממנו בשקט.
 */
var withSlot = SOLD.filter(function (d) {
  var v = d.spec ? d.spec.storage_expandable : null;
  return v != null && v !== '' && !/^\s*(אין|ללא)/.test(String(v));
});
var below = SOLD.filter(function (d) { return ipRank(ipTokens(d)) < IMMERSION_FROM; });

/* ------------------------------------------------------ 3. מספרים בפרוזה
 *
 * חמישה מספרים שהיו קפואים בטקסט, וכל אחד מהם תיאר את הקטלוג. הם נגזרים כאן ולא נכתבים,
 * מאותו נימוק שהטבלאות נגזרות: הם היו נכונים ביום שנכתבו ולא ביום שאחריו.
 *
 * eSIM נמדד לפי מה שהיצרן מפרסם, וההצהרה "אין תמיכה ב-eSIM" נחשבת לשלילה ולא לשתיקה.
 * זה חשוב בעמוד eSIM עצמו, שכל עניינו ללמד את הקורא להבחין בין השניים.
 */
var esimYes = SOLD.filter(function (d) {
  var v = String((d.spec && d.spec.esim) || '');
  return v && !/^\s*(אין|ללא|לא)/.test(v);
});

replaceSpan('guides/first-phone-for-kid/index.html', 'kidstat', SOLD.length + ' דגמים נבדקו');
replaceSpan('guides/first-phone-for-kid/index.html', 'kidslot', 'ב' + word(withSlot.length));
replaceSpan('guides/how-much-storage/index.html', 'storeslot', 'ב-' + withSlot.length + ' בלבד');
replaceSpan('guides/how-much-storage/index.html', 'storestat', SOLD.length + ' דגמים בטבלה');
['esimshort', 'esimlong', 'esimbody'].forEach(function (m) {
  replaceSpan('guides/esim-israel/index.html', m, esimYes.length + ' מ-' + SOLD.length);
});

replaceBlock('guides/first-phone-for-kid/index.html', 'ip', ipBody);
replaceBlock('guides/how-much-storage/index.html', 'storage', stBody);

/* ההערה שמונה כמה דגמים נושאים חריץ */
(function () {
  var p = path.join(PROTO, 'guides/how-much-storage/index.html');
  var s = fs.readFileSync(p, 'utf8');
  var re = /(<!-- gen-guide-tables:slotcount:start -->)[\s\S]*?(<!-- gen-guide-tables:slotcount:end -->)/;
  if (!re.test(s)) {
    console.error('✗ how-much-storage: סימני slotcount חסרים');
    process.exit(1);
  }
  s = s.replace(re, '$1ב-' + withSlot.length + ' דגמים בלבד מתוך ' + SOLD.length + '$2');
  fs.writeFileSync(p, s);
})();

console.log('✓ first-phone-for-kid: טבלת IP, ' + ipKeys.length + ' רמות ו-' + SOLD.length + ' דגמים' +
  (noRating.length ? ' (' + noRating.length + ' בלי דירוג, אינם בטבלה)' : ''));
console.log('  ' + ipKeys.map(function (k) { return k + '=' + ipGroups[k].length; }).join('  '));
console.log('✓ how-much-storage: טבלת נפחים, ' + SOLD.length + ' דגמים, ' + withSlot.length + ' עם חריץ');
console.log('✓ esim-israel: ' + esimYes.length + ' מ-' + SOLD.length + ' תומכים ב-eSIM');
console.log('✓ first-phone-for-kid: הסטטיסטיקה והמספר בפרוזה נגזרו');
console.log('  ' + below.length + ' דגמים מתחת ל-IP' + IMMERSION_FROM + ', כלומר בלי הבטחה לשיקוע');
console.log('');
console.log('הרצה: node .claude/preflight.js');
