#!/usr/bin/env node
/* PHONE GAT — אודיט קופי: מודד את סימני הכתיבה המכונית במקום להעריך אותם.
 *
 *   node .claude/tools/copy-audit.js                       כל דפי התוכן
 *   node .claude/tools/copy-audit.js guides/index.html     דף אחד
 *   node .claude/tools/copy-audit.js --kw "יבוא מקביל,יבואן רשמי" <דף>
 *
 * למה כלי ולא בדיקה ב-preflight: אלה סיגנלים ולא כשלים. שבע פסקאות שנפתחות ב-<b> הן תקלה,
 * אחת היא כתיבה. המספר הוא מה שמעיד, ורק אדם יכול להכריע. preflight אוכף מה שבינארי
 * (מקף ארוך, "וואטסאפ", "חינם"); זה מציף מה שדורש עין.
 *
 * הרשימה ב-§7 של pg-new-content-page נכתבה אחרי שמדריך התקלות עבר שתי סבבי תיקון כשהוא
 * כבר "גמור". הכלי הזה קיים כדי שהסבב הזה יקרה לפני, ולא אחרי.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');

var args = process.argv.slice(2);
var kwArg = '';
var ki = args.indexOf('--kw');
if (ki > -1) { kwArg = args[ki + 1] || ''; args.splice(ki, 2); }
var LEGAL = ['privacy.html', 'accessibility.html'];

function findPages(dir, prefix, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (e.name.charAt(0) === '_') return;
    if (e.isFile()) { if (/\.html$/.test(e.name)) out.push(prefix + e.name); return; }
    if (!e.isDirectory() || e.name === 'api') return;
    findPages(path.join(dir, e.name), prefix + e.name + '/', out);
  });
  return out;
}
var pages = args.length ? args : findPages(PROTO, '', []).filter(function (f) {
  return LEGAL.indexOf(f) < 0 && f !== 'index.html';
});

/* ---------- חילוץ הטקסט שהקורא רואה ---------- */
function readerText(html) {
  var m = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  return m.replace(/<script[\s\S]*?<\/script>/g, ' ')
          .replace(/<style[\s\S]*?<\/style>/g, ' ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ')
          .replace(/\s+/g, ' ').trim();
}
function mainHtml(html) {
  return html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<!--[\s\S]*?-->/g, '');
}
/* מדד אורך המשפט נמדד על פרוזה בלבד. תא בטבלה ופריט ברשימה אינם משפטים ואין בהם נקודה,
 * ולכן המפצל מדביק עשרה תאים לאחד ומדווח על "משפט של 55 מילים" שלא קיים. קרה בטבלת
 * ההשוואה הראשונה, ובעמודי המפרט זה היה הופך את המדד הזה לחסר תועלת לגמרי. */
/* כמו proseText אבל עם הרשימות. בעמוד מכשיר "למי זה מתאים" הוא רשימה, והוא חלק מהגוף שנכתב
 * ביד. מה שיוצא מכאן הוא כל מה שאדם כתב, בלי טבלת המפרט ובלי רשימות ניווט, ששתיהן מציגות
 * ערכים ולא כותבות פרוזה.
 *
 * .hub יוצא במפורש. הוא רשימת הניווט של מרכז המכשירים ומרכז ההשוואות, ובה כל שורה מתארת
 * דגם אחר. הבדיקה על נתון שחוזר שלוש פעמים דיווחה שם "256GB×9", וזה תשעה דגמים שונים שכל
 * אחד מהם מציע 256GB, כלומר בדיוק מה שצריך לקרות. לספור את זה כחזרה זה להפוך את הבדיקה
 * לרעש בעמוד היחיד שבו היא לא רלוונטית. .checks ‏.mistakes ו-.ticks כן נספרים, כי אלה
 * רשימות שנכתבו ביד. */
function writtenText(html) {
  return mainHtml(html).replace(/<table[\s\S]*?<\/table>/g, ' ')
    .replace(/<ul class="hub"[\s\S]*?<\/ul>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function proseText(html) {
  var m = mainHtml(html).replace(/<table[\s\S]*?<\/table>/g, ' ')
                        .replace(/<(ul|ol)[\s\S]*?<\/\1>/g, ' ');
  return m.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
          .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ')
          .replace(/\s+/g, ' ').trim();
}

/* מילות פונקציה שאין טעם למנות: הן תמיד יובילו את הטבלה ואינן מעידות על כלום */
var STOP = ('של את זה הוא היא הם הן על עם אל כל לא גם או אם כי אבל אז מה מי איך כמה יש אין' +
  ' אני אתה אתם אנחנו הכי יותר פחות עוד רק כבר אחרי לפני בין תוך כדי אשר כאשר לכן אלא' +
  ' היה הייתה היו יהיה כמו כן ולא וגם וזה שהוא שזה שלא בו בה בהם אותו אותה להיות').split(/\s+/);

function words(t) {
  return t.split(/[^֐-׿a-zA-Z0-9׳״'-]+/).filter(function (w) { return w.length > 1; });
}
function sentences(t) {
  return t.split(/(?<=[.!?:])\s+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; });
}
function ngrams(ws, n) {
  var out = {};
  for (var i = 0; i + n <= ws.length; i++) {
    var g = ws.slice(i, i + n).join(' ');
    out[g] = (out[g] || 0) + 1;
  }
  return out;
}
function top(obj, min, limit) {
  return Object.keys(obj).filter(function (k) { return obj[k] >= min; })
    .sort(function (a, b) { return obj[b] - obj[a] || a.localeCompare(b); })
    .slice(0, limit).map(function (k) { return { k: k, n: obj[k] }; });
}
function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }

/* ---------- הסימנים מ-§7 ---------- */
var TICS = {
  'בדיוק': /בדיוק/g,
  'מדובר ב': /מדובר ב/g,
  'חדשות טובות': /חדשות טובות/g,
  'חשוב לציין': /חשוב לציין|יש לציין|ראוי לציין/g,
  'הייפ (מושלם/מהפכני/מדהים/הטוב ביותר)': /מושלם|מהפכני|מדהים|הטוב ביותר|פורץ דרך/g,
  'בסופו של דבר': /בסופו של דבר|בשורה התחתונה/g,
  /* גבול שמאלי מפורש ולא \b: גבול מילה ב-JS מוגדר על [A-Za-z0-9_] ולכן אינו עובד ליד
     עברית, והתבנית הזאת לא נתפסה אף פעם. הגבול נחוץ כאן כי "ללא" מכיל "לא". */
  'לא X אלא Y': /(?:^|[^\u0590-\u05FF])לא [^.,;]{1,28} אלא(?![\u0590-\u05FF])/g,
  'כלומר': /כלומר/g,
  'למעשה': /למעשה|בפועל/g
};
/* מודאליות: חזרה על אותה צורת המלצה היא מה שמייצר את התחושה של תבנית */
/* בלי \b, ובכוונה. גבול מילה ב-JS אינו עובד ליד עברית, ולכן ששת אלה לא נתפסו אף פעם.
   ובעברית גם לא רוצים גבול שמאלי: התחיליות נדבקות למילה, ו"שכדאי" ו"וכדאי" הן אותה
   מודאליות בדיוק, שזה מה שהבדיקה באה לספור. */
var MODALS = { 'כדאי': /כדאי/g, 'שווה': /שווה/g, 'חשוב': /חשוב/g, 'אפשר': /אפשר/g, 'צריך': /צריך/g, 'יש ל': /יש ל/g };

var C = { r: '[31m', y: '[33m', g: '[32m', d: '[2m', b: '[1m', x: '[0m' };
var flagCount = 0;
function flag(level, msg) {
  flagCount += (level === 'r' ? 1 : 0);
  console.log('    ' + C[level] + (level === 'r' ? '✗' : level === 'y' ? '!' : '✓') + C.x + ' ' + msg);
}

var KW = kwArg ? kwArg.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

pages.forEach(function (rel) {
  var full = path.join(PROTO, rel);
  var html;
  try { html = fs.readFileSync(full, 'utf8'); } catch (e) { console.log('דילוג: ' + rel); return; }
  var mh = mainHtml(html), t = readerText(html);
  var ws = words(t), ss = sentences(proseText(html));

  console.log('\n' + C.b + '━━ ' + rel + C.x + '  ' + C.d + ws.length + ' מילים · ' +
    ss.length + ' משפטי פרוזה' + C.x);

  /* --- אורך משפט --- */
  var lens = ss.map(function (s) { return words(s).length; });
  var avg = Math.round(lens.reduce(function (a, b) { return a + b; }, 0) / (lens.length || 1) * 10) / 10;
  var long = ss.map(function (s, i) { return { s: s, n: lens[i] }; })
               .filter(function (o) { return o.n > 30; }).sort(function (a, b) { return b.n - a.n; });
  console.log('  ' + C.b + 'קצב' + C.x);
  flag(avg >= 10 && avg <= 19 ? 'g' : 'y', 'אורך משפט ממוצע: ' + avg + ' מילים' +
    (avg > 19 ? '  (מעל 19 קורא כמו טקסט מתורגם)' : avg < 10 ? '  (מתחת ל-10 קורא קטוע)' : ''));
  if (long.length) {
    flag(long.length > 3 ? 'y' : 'g', long.length + ' משפטים מעל 30 מילים');
    long.slice(0, 2).forEach(function (o) { console.log('      ' + C.d + o.n + ': ' + o.s.slice(0, 88) + '…' + C.x); });
  } else flag('g', 'אין משפט מעל 30 מילים');

  /* --- הסימנים --- */
  console.log('  ' + C.b + 'סימני כתיבה מכונית' + C.x);
  var bLead = (mh.match(/<p[^>]*>\s*<b>/g) || []).length;
  flag(bLead >= 4 ? 'r' : bLead >= 2 ? 'y' : 'g', 'פסקאות פרוזה שנפתחות ב-<b>: ' + bLead +
    C.d + '  (רשימות הן רכיב האתר ולא נספרות. 4 ומעלה = תבנית)' + C.x);
  var heads = [];
  (mh.match(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/g) || []).forEach(function (x) {
    heads.push(x.replace(/<[^>]+>/g, '').trim());
  });
  var qh = heads.filter(function (x) { return /\?$/.test(x); });
  var faqZone = /id="faq"|id="h-faq"/.test(mh);
  flag(qh.length > (faqZone ? 6 : 2) ? 'y' : 'g', 'כותרות שהן שאלה: ' + qh.length + ' מתוך ' + heads.length +
    C.d + (faqZone ? '  (מקטע FAQ קיים, שם זה תקין)' : '') + C.x);
  Object.keys(TICS).forEach(function (name) {
    var n = (t.match(TICS[name]) || []).length;
    if (!n) return;
    var per1000 = pct(n, ws.length) * 10;
    var bad = (name === 'לא X אלא Y' && n >= 3) || (name.indexOf('הייפ') === 0 && n >= 1) || n >= 6;
    flag(bad ? 'r' : n >= 3 ? 'y' : 'g', name + ': ' + n + C.d + '  (' + (Math.round(per1000 * 10) / 10) + ' ל-1000 מילים)' + C.x);
  });

  /* --- חזרתיות מודאלית --- */
  var mods = Object.keys(MODALS).map(function (k) { return { k: k, n: (t.match(MODALS[k]) || []).length }; })
    .filter(function (o) { return o.n; }).sort(function (a, b) { return b.n - a.n; });
  if (mods.length) {
    var worst = mods[0];
    flag(worst.n >= 8 ? 'r' : worst.n >= 5 ? 'y' : 'g', 'חזרה על צורת המלצה: ' +
      mods.map(function (o) { return o.k + '×' + o.n; }).join(' · ') +
      C.d + '  (אותה צורה 5 פעמים ומעלה מרגישה תבנית)' + C.x);
  }

  /* --- ביטויים חוזרים --- */
  console.log('  ' + C.b + 'חזרתיות' + C.x);
  var rep4 = top(ngrams(ws, 4), 2, 6);
  flag(rep4.length >= 4 ? 'y' : 'g', 'רצפים של 4 מילים שחוזרים: ' + rep4.length);
  rep4.forEach(function (o) { console.log('      ' + C.d + o.n + '× "' + o.k + '"' + C.x); });

  /* --- אותו נתון בשלושה מקומות ---
   * המבנה של עמוד מכשיר הוא שלושה מקטעים שכולם עוסקים באותו דגם: "מה חשוב לדעת", "למי זה
   * מתאים", ו"מה זה אומר ביומיום". התוצאה הצפויה היא שהנתון הבולט של המכשיר נכתב שלוש פעמים,
   * ואדם לא חוזר על אותו מספר שלוש פעמים בעמוד אחד. זה נמצא שלוש פעמים ברצף בעמודים שונים
   * לפני שהפך לבדיקה: 37 שעות באייפון פרו מקס, פברואר 2033 בגלקסי S26, ושש שנות עדכונים
   * ב-A56. הרצף החוזר תפס את זה, אבל כשורה אחת מתוך שש ואי אפשר להבחין בה.
   * נמדד על טקסט הפרוזה והרשימות ובלי טבלת המפרט, כי הטבלה היא המקום שבו הנתון אמור להופיע. */
  var nums = {};
  /* חייבת להיות יחידה, או חודש ושנה. מספר עירום נספר בהרצה הראשונה והתוצאה הייתה "17"×8
   * באייפון 17 פרו מקס, כלומר שם הדגם. חזרה על שם הדגם היא בדיוק מה שצריך לקרות בעמוד שלו. */
  (writtenText(html).match(/\d[\d,.]*\s*(?:mAh|GB|TB|MP|Hz|W\b|ppi|ניט|גרם|שעות|דקות|אינץ׳|מ״מ)|(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{4}/g) || [])
    .forEach(function (t) { t = t.trim().replace(/\s+/g, ' '); nums[t] = (nums[t] || 0) + 1; });
  var rep3 = top(nums, 3, 6);
  flag(rep3.length ? 'r' : 'g', rep3.length
    ? 'אותו נתון חוזר שלוש פעמים ומעלה: ' + rep3.map(function (o) { return '"' + o.k + '"×' + o.n; }).join(' · ') +
      C.d + '  (הטבלה מציגה, הגוף מסביר. שלוש פעמים זו חזרה, לא הסבר)' + C.x
    : 'אין נתון שחוזר שלוש פעמים בגוף');

  /* --- פתיחות פסקה --- */
  var opens = {};
  (mh.match(/<p[^>]*>([\s\S]*?)<\/p>/g) || []).forEach(function (p) {
    var txt = p.replace(/<[^>]+>/g, '').trim();
    var w1 = words(txt)[0];
    if (w1) opens[w1] = (opens[w1] || 0) + 1;
  });
  var dupOpen = top(opens, 3, 4);
  flag(dupOpen.length ? 'y' : 'g', dupOpen.length ? 'מילת פתיחה חוזרת בפסקאות: ' +
    dupOpen.map(function (o) { return '"' + o.k + '"×' + o.n; }).join(' · ') : 'אין מילת פתיחה שחוזרת 3 פעמים');

  /* --- מילים תוכניות שכיחות: גם תיק וגם stuffing --- */
  var freq = {};
  ws.forEach(function (w) { if (STOP.indexOf(w) < 0) freq[w] = (freq[w] || 0) + 1; });
  var t5 = top(freq, 1, 6);
  console.log('      ' + C.d + 'שכיחות: ' + t5.map(function (o) { return o.k + '×' + o.n; }).join(' · ') + C.x);

  /* --- מילות מפתח --- */
  if (KW.length) {
    console.log('  ' + C.b + 'מילות מפתח' + C.x);
    var title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    var desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    var h1 = ((mh.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '');
    KW.forEach(function (k) {
      var n = (t.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      var dens = pct(n * words(k).length, ws.length);
      var where = [];
      if (title.indexOf(k) > -1) where.push('title');
      if (desc.indexOf(k) > -1) where.push('desc');
      if (h1.indexOf(k) > -1) where.push('h1');
      if (heads.some(function (x) { return x.indexOf(k) > -1; })) where.push('h2/h3');
      var lvl = n === 0 ? 'r' : dens > 2.5 ? 'r' : dens > 1.6 ? 'y' : 'g';
      flag(lvl, '"' + k + '": ' + n + ' בגוף · צפיפות ' + dens + '%' +
        C.d + ' · ' + (where.length ? where.join(', ') : 'לא בכותרות') +
        (dens > 2.5 ? '  ← צפיפות גבוהה מדי' : '') + C.x);
    });
  }
});

console.log('\n' + (flagCount ? C.r + C.b + flagCount + ' סימנים אדומים — דורשים קריאה' + C.x
                              : C.g + C.b + 'אין סימנים אדומים' + C.x));
console.log(C.d + 'הכלי מודד. ההכרעה על ניסוח היא של אדם שקורא את הדף מקצה לקצה בישיבה אחת.' + C.x);
