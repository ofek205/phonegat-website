/* PHONE GAT — גזירת תכונות מדידות מתוך מחרוזות המפרט.
 *
 * למה מודול ולמה לא בתוך מחולל: שלושה מחוללים צריכים את אותן גזירות. gen-finder.js לניקוד
 * השאלון, gen-compare.js לגודל ההבדל בטבלה, והכלי ב-/phones/compare/. עותק שני של פרסר
 * שמפענח עברית הוא הדבר הכי שביר שיש כאן, וכבר ראינו את המחיר שלו ארבע פעמים בשבוע הזה
 * (.hub, .chip, .cmp, ואלגוריתם ההשוואה).
 *
 * העיקרון בכל פונקציה: **null אינו אפס.** שדה שהיצרן לא מפרסם מוחזר null, ומי שמשתמש בו
 * חייב להחליט מה לעשות עם זה. הפונקציות לא מנחשות.
 *
 * המלכודת שהמודול הזה נולד ממנה, ושווה לקרוא לפני שנוגעים: הפרסר הראשון של הזום לקח את
 * המקסימום מכל מקדם ב-X שמופיע בשורה, והחזיר מספרים בטוחים ושגויים. iPhone 17 יצא 4x
 * מ"טווח אופטי 4x" כשהזום שלו 2x, iPhone 17 Pro יצא 16x מ"טווח 16x" במקום 4x, ו-S26 Ultra
 * יצא 10x מ"איכות אופטית 10x" במקום 5x. היצרנים מפרסמים שלושה דברים באותה שורה: זום אופטי,
 * "איכות אופטית", וטווח. רק הראשון הוא עדשה.
 */
'use strict';

function num(s, re) {
  if (s === null || s === undefined) return null;
  var m = String(s).match(re);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

/* אינצ׳ים */
function inches(spec) { return num(spec.screen_size, /([\d.]+)\s*אינץ/); }

/* גרמים */
function grams(spec) { return num(spec.weight, /([\d.]+)\s*גרם/); }

/* נפחי אחסון ב-GB, ממוין. TB מומר. */
function storageGB(spec) {
  var out = (spec.storage_offered || []).map(function (x) {
    var m = String(x).match(/(\d+)\s*(GB|TB)/i);
    if (!m) return null;
    return m[2].toUpperCase() === 'TB' ? parseInt(m[1], 10) * 1024 : parseInt(m[1], 10);
  }).filter(function (x) { return x !== null; });
  return out.sort(function (a, b) { return a - b; });
}

/* שעות וידאו, כפי שאפל וסמסונג מפרסמות */
function battHours(spec) { return num(spec.battery, /עד\s*(\d+)\s*שעות/); }

/* mAh, כפי ששיאומי וסמסונג מפרסמות. אפל אינה מפרסמת mAh, ולכן null אצלה אינו חסר אלא נכון. */
function battMah(spec) { return num(spec.battery, /([\d,]+)\s*mAh/i); }

/* המקדם האופטי בלבד, מהצירוף "זום אופטי" או "טלפוטו אופטי" ועד הפסיק.
 * מחזיר מספר, או 'yes' כשהיצרן אומר אופטי בלי מקדם (למשל "טלפוטו אופטי 60 מ״מ"),
 * או 0 כשהוא אומר דיגיטלי בלבד או שאין טלפוטו, או null כשאין שורת זום. */
function opticalZoom(spec) {
  if (spec.zoom === null || spec.zoom === undefined) return null;
  var z = String(spec.zoom);
  if (!/(זום|טלפוטו)\s*אופטי/.test(z)) return 0;
  var m = z.match(/(?:זום|טלפוטו)\s*אופטי[^,]*/);
  var f = m ? (m[0].match(/([\d.]+)x/g) || []).map(parseFloat) : [];
  return f.length ? Math.max.apply(null, f) : 'yes';
}

/* עדשה רחבה במיוחד. נגזר מ-12/12 כי מי שאין לו אומר את זה במפורש. */
function ultraWide(spec) {
  var blob = (spec.camera_extra || '') + ' ' + (spec.camera_main || '');
  if (/אין עדשה רחבה/.test(blob)) return 0;
  return /רחבה במיוחד/.test(blob) ? 1 : 0;
}

/* חריץ זיכרון. זיהוי חיובי בלבד: אפל וסמסונג אינן מפרסמות "אין הרחבה",
 * ולכן היעדר הנתון אינו הוכחה להיעדר החריץ, והתשובה היא null ולא 0. */
function sdCard(spec) {
  if (spec.storage_expandable === null || spec.storage_expandable === undefined) return null;
  return /^אין/.test(spec.storage_expandable) ? 0 : 1;
}

/* שנת סיום עדכוני אבטחה. רק סמסונג נוקבת בתאריך, ולכן null בשאר אינו חסר. */
function updateYear(spec) { return num(spec.security_updates, /(\d{4})/); }

/* ---------------------------------------------------------------- הפרשים
 * מה נחשב "הבדל גדול". שימושי גם לסיכום בראש עמוד השוואה וגם לאורך הקו בטבלה.
 *
 * DELTAS מגדיר, לכל שדה שאפשר להשוות במספרים: איך שולפים, איך מנסחים את ההפרש, וכמה
 * ההפרש צריך להיות כדי שיהיה שווה אזכור. הרף הוא החלטה, והוא כתוב במקום אחד כדי שיהיה
 * אפשר לטעון נגדו. שדה שאין בו מספר בשני הצדדים פשוט לא נכנס.
 */
/* `more` הוא הניסוח הנייטרלי של "למי יש יותר", ולא של "מי טוב יותר".
 *
 * הגרסה הראשונה קראה לשדה הזה leader והחזירה "לטובת X". במשקל זה יצא "הפרש של 27 גרם לטובת
 * iPhone 17 Pro Max", והוא הכבד מהשניים. כלומר הכלי הכריז מנצח, ובכיוון ההפוך. כל האזור בנוי
 * על זה שאין הכרזת מנצח, ולכן מה שמוחזר הוא מי גדול יותר במספר, והניסוח אומר בדיוק את זה. */
var DELTAS = [
  { key: 'weight', label: 'משקל', get: grams, unit: 'גרם', min: 12, more: 'כבד יותר',
    phrase: function (a, b) { return 'הפרש של ' + Math.abs(a - b).toFixed(0) + ' גרם'; } },
  { key: 'screen_size', label: 'גודל מסך', get: inches, unit: 'אינץ׳', min: 0.3, more: 'מסך גדול יותר',
    phrase: function (a, b) { return a.toFixed(2).replace(/\.?0+$/, '') + ' מול ' + b.toFixed(2).replace(/\.?0+$/, '') + ' אינץ׳'; } },
  { key: 'storage_offered', label: 'אחסון מקסימלי', get: function (s) { var g = storageGB(s); return g.length ? g[g.length - 1] : null; }, unit: 'GB', min: 128, more: 'אחסון גדול יותר',
    phrase: function (a, b) { return gb(a) + ' מול ' + gb(b); } },
  { key: 'battery_hours', label: 'שעות וידאו', get: battHours, unit: 'שעות', min: 4, more: 'יותר שעות וידאו',
    phrase: function (a, b) { return a + ' מול ' + b + ' שעות'; } },
  { key: 'battery_mah', label: 'קיבולת סוללה', get: battMah, unit: 'mAh', min: 400, more: 'קיבולת גדולה יותר',
    phrase: function (a, b) { return a + ' מול ' + b + ' mAh'; } },
  { key: 'zoom', label: 'זום אופטי', get: function (s) { var z = opticalZoom(s); return typeof z === 'number' ? z : null; }, unit: 'x', min: 1, more: 'זום אופטי גדול יותר',
    phrase: function (a, b) { return a + 'x מול ' + b + 'x'; } }
];
function gb(n) { return n >= 1024 ? (n / 1024) + 'TB' : n + 'GB'; }

/* מחזיר את ההפרשים המשמעותיים בין שני מכשירים, מהגדול לקטן ביחס לרף שלו. */
function deltas(specA, specB) {
  var out = [];
  DELTAS.forEach(function (d) {
    var a = d.get(specA), b = d.get(specB);
    if (a === null || b === null || a === b) return;
    var gap = Math.abs(a - b);
    if (gap < d.min) return;
    out.push({
      key: d.key, label: d.label, a: a, b: b, gap: gap,
      /* עוצמה יחסית לרף, כדי שהפרש של 60 גרם ידורג מול הפרש של 3 אינץ׳ באותה סקאלה */
      strength: gap / d.min,
      phrase: d.phrase(a, b),
      more: d.more,                       /* הניסוח הנייטרלי: "כבד יותר", לא "טוב יותר" */
      higher: a > b ? 'a' : 'b'           /* מי גדול יותר במספר. לא מי מנצח. */
    });
  });
  return out.sort(function (x, y) { return y.strength - x.strength; });
}

/* אחוז לאורך הקו בטבלה: הקטן מקבל את היחס, הגדול מקבל 100. */
function ratioPair(a, b) {
  if (a === null || b === null || (!a && !b)) return null;
  var hi = Math.max(a, b);
  if (!hi) return null;
  return { a: Math.round((a / hi) * 100), b: Math.round((b / hi) * 100) };
}

/* שדה מפרט → פונקציית שליפה, לשימוש כשרוצים קו יחסי בשורה מסוימת בטבלה */
var NUMERIC_BY_FIELD = {
  weight: grams,
  screen_size: inches,
  battery: function (s) { var h = battHours(s); return h !== null ? h : battMah(s); },
  storage_offered: function (s) { var g = storageGB(s); return g.length ? g[g.length - 1] : null; },
  zoom: function (s) { var z = opticalZoom(s); return typeof z === 'number' ? z : null; }
};

module.exports = {
  num: num, inches: inches, grams: grams, storageGB: storageGB,
  battHours: battHours, battMah: battMah, opticalZoom: opticalZoom,
  ultraWide: ultraWide, sdCard: sdCard, updateYear: updateYear,
  deltas: deltas, ratioPair: ratioPair, gb: gb,
  NUMERIC_BY_FIELD: NUMERIC_BY_FIELD, DELTAS: DELTAS
};
