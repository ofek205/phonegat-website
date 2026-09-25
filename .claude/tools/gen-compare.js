#!/usr/bin/env node
/* PHONE GAT — מחולל עמודי השוואה מתוך prototype/devices.json › _comparisons.
 *
 *   node .claude/tools/gen-compare.js                              כל הזוגות
 *   node .claude/tools/gen-compare.js iphone-17-vs-galaxy-s26      אחד
 *
 * למה מחולל: אותה סיבה כמו gen-devices.js. אין build בפרויקט, ולכן ה-HTML נוצר מקומית ומקומט.
 *
 * שתי החלטות שהמחולל אוכף:
 *
 *   1. הטבלה מציגה רק שדות שבהם שני הדגמים שונים, ואומרת כמה שדות זהים. השוואה שמציגה
 *      עשרים ושבעה שדות מתוכם עשרים זהים היא לא השוואה, היא גיליון מפרט כפול.
 *
 *   2. שתי עמודות, לא שלוש. כל שדה הוא tbody עם כותרת שמשתרעת, ובתוכו שורה לכל מכשיר.
 *      זו לא בחירה אסתטית אלא תוצאה של מדידה ב-375px, ראה MEASURED למטה.
 *
 * MEASURED, 5.8.2026, רוחב מכל 351px, טקסט המפרט האמיתי מ-devices.json:
 *   שלוש עמודות זה לצד זה  →  עמודת ערך של 76px, והתא הגרוע נשבר ל-16 שורות.
 *   שתי עמודות זה לצד זה   →  עמודת ערך של 91px, והתא הגרוע נשבר ל-9 שורות.
 *   הצורה שנבחרה          →  עמודת ערך של 215px, והתא הגרוע נשבר ל-8 שורות, אפס גלישה.
 *   טבלה בלי גלישה ברוחב מלא של התוכן הייתה דורשת 2162px, כלומר שש מסכים של גלילה הצידה.
 * המסקנה: עם מחרוזות מפרט בעברית, עמודה לכל מכשיר לא עובדת בטלפון. גם לא שתיים.
 * הצורה הזאת גם לא נשברת כשמשווים שלושה או ארבעה דגמים, כי מכשיר הוא שורה ולא עמודה.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var PROD = 'https://www.phonegat.co.il/';
/* המסגרת נלקחת מעמוד מכשיר ולא מהמדריך, כי בעמוד מכשיר ה-CSS של .cmp-spec כבר מוזרק. */
var SOURCE = 'phones/iphone-17/index.html';

var T = require(path.join(__dirname, 'lib', 'traits.js'));
var BIDI = require(path.join(__dirname, 'lib', 'bidi.js'));
/* מצב שעונים, נוסף ב-24.9.2026: node gen-compare.js --watches בונה את /watches/compare/ מתוך
   prototype/watches.json, באותו קוד ובאותו עיצוב כמו כלי הטלפונים. השעונים בקובץ נפרד ולא ב-
   devices.json בכוונה: כל צרכן של devices.json, השאלון, טבלאות המדריכים, הבוט והניווט, מניח
   טלפון, ושעון שהיה נכנס לשם היה מופיע בטבלת עמידות למים של טלפונים לילדים. במצב הזה לא נבנים
   עמודי השוואה קבועים ולא מרכז השוואות, רק הכלי. */
/* מ-24.9.2026 יש שתי קטגוריות כאלה, שעונים ואוזניות, ולכן המצב הפך לטבלה: כל מה שנבדל בין
   הקטגוריות הוא טקסט, והוא כתוב כאן פעם אחת. הקוד למטה שואל "האם זו קטגוריה" (CAT) ולוקח
   ממנה את המילים. קטגוריה שלישית היא רשומה נוספת כאן, ולא עוד ענף if בכל מקום. */
var CATS = {
  watches: {
    flag: '--watches', file: 'watches.json', pub: 'watches-public.json', path: 'watches/compare/',
    title: 'השוואת שעונים חכמים: אפל, סמסונג וגרמין | פון גת',
    desc: 'כלי להשוואה בין שעונים חכמים של אפל, סמסונג וגרמין, עם המפרט מאתרי היצרנים. רק השדות שבהם הם באמת שונים.',
    h1: 'השוואת שעונים חכמים',
    asub: 'שעוני Apple Watch, Galaxy Watch וגרמין, והמפרט של כל אחד מאתר היצרן. לפני הכול בדקו את השורה "עובד עם": Apple Watch עובד רק עם אייפון, שעוני Galaxy רק עם אנדרואיד, ושעוני גרמין עם שניהם.',
    crumb: 'השוואת שעונים', link: 'לכלי השעונים', ask: 'להשוות שעונים חכמים',
    slot: 'שעון', third: 'הוסיפו שעון שלישי', plural: 'השעונים', them: 'שני השעונים',
    waPick: 'היי, אני מתלבט בין כמה שעונים חכמים ואשמח לעזרה בבחירה',
    how: 'רשימת השדות השונים בכל זוג מחושבת מראש, מתוך המפרט שפרסם היצרן. אפל, סמסונג וגרמין מודדות סוללה בדרכים שונות, ולכן בשורה הזאת מופיע מה שכל יצרן כתב, כפי שהוא.',
    loadErr: 'לא ניתן לטעון את נתוני השעונים. נסו לרענן את העמוד.',
    tab: 'שעונים חכמים', card: 'בין Apple Watch, Galaxy Watch וגרמין', noun: 'שעונים חכמים', own: 'משלהם', any: 'כל שני שעונים', hubH: 'השוואות שעונים חכמים', hubLead: 'Apple Watch, Galaxy Watch וגרמין, עם המפרט מאתרי היצרנים.'
  },
  headphones: {
    flag: '--headphones', file: 'headphones.json', pub: 'headphones-public.json', path: 'headphones/compare/',
    title: 'השוואת אוזניות: AirPods ו-Galaxy Buds | פון גת',
    desc: 'כלי להשוואה בין אוזניות AirPods של אפל ו-Galaxy Buds של סמסונג, עם המפרט מאתרי היצרנים. רק השדות שבהם הן באמת שונות.',
    h1: 'השוואת אוזניות',
    asub: 'אוזניות AirPods ו-Galaxy Buds, והמפרט של כל דגם מאתר היצרן. לפני הכול בדקו את השורה "עובד עם": חלק מהתכונות עובדות רק עם טלפון של אותו יצרן.',
    crumb: 'השוואת אוזניות', link: 'לכלי האוזניות', ask: 'להשוות אוזניות',
    slot: 'דגם', third: 'הוסיפו דגם שלישי', plural: 'האוזניות', them: 'שני הדגמים',
    waPick: 'היי, אני מתלבט בין כמה אוזניות ואשמח לעזרה בבחירה',
    how: 'רשימת השדות השונים בכל זוג מחושבת מראש, מתוך המפרט שפרסם היצרן. אפל וסמסונג מודדות זמן האזנה בתנאים שונים, ולכן בשורה הזאת מופיע מה שכל יצרן כתב, כפי שהוא.',
    loadErr: 'לא ניתן לטעון את נתוני האוזניות. נסו לרענן את העמוד.',
    tab: 'אוזניות', card: 'בין AirPods ל-Galaxy Buds', noun: 'אוזניות', own: 'משלהן', any: 'כל שני דגמים', hubH: 'השוואות אוזניות', hubLead: 'AirPods ו-Galaxy Buds, עם המפרט מאתרי היצרנים.'
  }
};
var CAT = null;
Object.keys(CATS).forEach(function (k) { CATS[k].key = k; if (process.argv.indexOf(CATS[k].flag) >= 0) CAT = CATS[k]; });
/* קטגוריות שהקובץ שלהן כבר קיים. כלי הטלפונים ומרכז ההשוואות מקשרים רק אליהן. */
var CAT_LIVE = Object.keys(CATS).map(function (k) { return CATS[k]; })
  .filter(function (c) { return fs.existsSync(path.join(PROTO, c.file)); });
var db = JSON.parse(fs.readFileSync(path.join(PROTO, CAT ? CAT.file : 'devices.json'), 'utf8'));
if (!db._comparisons || !db._comparisons.pairs) { console.error('✗ אין _comparisons ב-devices.json'); process.exit(1); }
if (!db._spec_groups || !db._spec_groups.groups) { console.error('✗ אין _spec_groups ב-devices.json'); process.exit(1); }
var GROUPS = db._spec_groups.groups;
var only = CAT ? null : process.argv[2];
var src = fs.readFileSync(path.join(PROTO, SOURCE), 'utf8');

/* גם מירכאות: esc נכנס גם לתוך מאפיינים (data-cat, data-q, alt), ושם " סוגר את הערך */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function wa(t) { return 'https://wa.me/97286812050?text=' + encodeURIComponent(t); }
function ltr(s) { return '<bdo dir="ltr">' + esc(s) + '</bdo>'; }
function val(v) { return Array.isArray(v) ? v.join(', ') : v; }
/* עברית מבחינה בין יחיד, זוגי ורבים, והמחולל הדפיס "1 שדות זהים".
 * שלושה מקומות מרנדרים את אותו מספר, ולכן פונקציה אחת ולא שלוש מחרוזות. */
function sameTxt(n){ return n === 0 ? 'אין שדות זהים' : n === 1 ? 'שדה אחד זהה' : (n === 2 ? 'שני שדות זהים' : n + ' שדות זהים'); }
function sameMoreTxt(n){ return n === 1 ? 'שדה אחד נוסף זהה' : (n === 2 ? 'שני שדות נוספים זהים' : n + ' שדות נוספים זהים'); }
function D(slug) { return db.devices.filter(function (d) { return d.slug === slug; })[0]; }
/* עמוד המכשיר של דגם, או null כשאין לו. טלפון שאינו ייחוס: /phones/<slug>/. אוזניות ושעון, מאז
   25.9.2026: רק דגם שיש לו page במאגר, או גרסה שמופיעה ב-page.variants של דגם אחר, כי AirPods 5
   עם הנרתיק האלחוטי מתואר בעמוד של AirPods 5. gen-devices.js בונה את העמודים האלה. */
var PAGE_OF = {};
if (CAT) db.devices.forEach(function (x) {
  if (!x.page) return;
  PAGE_OF[x.slug] = x.slug;
  (x.page.variants || []).forEach(function (s) { PAGE_OF[s] = x.slug; });
});
/* התמונה הקטנה בכרטיס שבהדר, מ-25.9.2026 (אופק). רק דגם שאנחנו מוכרים ויש לו תמונה: טלפון
   עם media.hero, או שעון ואוזניות שהעמוד שלהם נושא media. דגם ייחוס נשאר בלי תמונה, וזה גם
   מבדיל בינו לבין מה שבחנות. alt הוא השם העברי (name_he), לא ריק: השם שליד התמונה הוא
   הלטיני, והשם העברי הוא מה שמחפשים ומה שקורא מסך צריך לשמוע. */
function thumbSrc(x) {
  if (!CAT) return photoSrc(x);
  var pg = PAGE_OF[x.slug] && D(PAGE_OF[x.slug]);
  if (!pg || !pg.page.media || !pg.page.media.hero) return null;
  var src = '/' + CAT.key + '/img/' + pg.slug + '-288.webp';
  if (!fs.existsSync(path.join(PROTO, src.slice(1)))) { console.error('✗ ' + x.slug + ': ' + src + ' חסר'); process.exit(1); }
  return src;
}
function thumbAlt(x) { return esc(x.name_he || x.name); }
function thumb(x) {
  var s = thumbSrc(x);
  return s ? '<img class="cv-img" src="' + s + '" alt="' + thumbAlt(x) + '" width="288" height="384" decoding="async">' : '';
}
function pageHref(x) {
  if (!CAT) return x.status === 'reference' ? null : '/phones/' + x.slug + '/';
  return PAGE_OF[x.slug] ? '/' + CAT.key + '/' + PAGE_OF[x.slug] + '/' : null;
}

/* התמונה של הדגם ברשימת "שני המכשירים". נגזרת מ-media שב-devices.json, בדיוק כמו בעמוד
 * המכשיר, ולא מנוסחת כאן מחדש: שתי נוסחאות לאותו נתיב נפרדות זו מזו בשקט ברגע שמידה משתנה.
 *
 * מכשיר ייחוס מגיע לכאן בלי media.hero ולכן מקבל מחרוזת ריקה, וזה מכוון (החלטת אופק,
 * 16.8.2026): אנחנו לא מוכרים אותו, אין לו עמוד, והוא מוצג כשורת טקסט בלבד.
 *
 * ה-288 בלבד ולא srcset: הרוחב כאן קבוע ב-CSS על 4.6rem, כלומר כ-74 פיקסל, ולכן 288
 * מכסה גם 3x. srcset עם מידה אחת הוא רעש. */
function photoSrc(x) {
  var m = x.media || {};
  if (!m.hero) return null;
  var src = '/phones/img/' + x.slug + '-288.webp';
  if (!fs.existsSync(path.join(PROTO, src.replace(/^\//, '')))) {
    console.error('✗ ' + x.slug + ': ' + src + ' חסר, אף שיש media.hero.');
    process.exit(1);
  }
  return src;
}
function hasPhoto(x) { return !!photoSrc(x); }
function photo(x) {
  var src = photoSrc(x);
  return src ? '<img src="' + src + '" width="288" height="384" alt="' +
    esc((x.media && x.media.alt) || x.name) + '" loading="lazy" decoding="async">' : '';
}
function swap(h, re, to, what, who) {
  if (!re.test(h)) { console.error('✗ ' + who + ': לא נמצא ' + what); process.exit(1); }
  return h.replace(re, to);
}

/* אותה עובדה בשני ניסוחים אינה הבדל. הנרמול כאן קיים כדי לתפוס את זה ולהתריע, לא כדי
 * להסתיר: עמוד שאומר "יש הבדל" כשאין הוא שקר, והתיקון הוא ב-devices.json. קרה בפועל
 * ב-5.8.2026 בין "שמונה ליבות, עד 2.2GHz" ל-"8 ליבות, עד 2.2GHz". */
var NUMWORDS = { 'שמונה': '8', 'עשר': '10', 'תשע': '9', 'שבע': '7', 'שש': '6', 'חמש': '5', 'ארבע': '4', 'שלוש': '3', 'שתיים': '2' };
/* ההחלפה חייבת גבול מילה עברי. הגרסה הראשונה עשתה split/join גורף, ו"עשר" הוא תת-מחרוזת של
 * "עשרים" בעוד "שלוש" הוא תת-מחרוזת של "שלושים": normalise('עשרים דקות') החזיר '10ים דקות'.
 * כלומר המנגנון שנבנה כדי לתפוס "אותה עובדה בשני ניסוחים" היה קורס בדיוק במקרה שהוא נועד לו,
 * ומכריז הבדל בין שני צדדים שאומרים את אותו דבר. הבאג היה רדום כי המילים האלה מופיעות היום
 * רק ב-editorial, שאינו מנורמל. */
var HE = 'א-ת';
function normalise(s) {
  if (s === null || s === undefined) return null;
  s = String(val(s));
  Object.keys(NUMWORDS).forEach(function (w) {
    s = s.replace(new RegExp('(^|[^' + HE + '])' + w + '(?![' + HE + '])', 'g'), '$1' + NUMWORDS[w]);
  });
  return s.replace(/^(הקלטה ב-|הקלטה |עד )/, '')
    .replace(/[.,:()׳״'"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

var softDiffs = [];
/* מחזיר { rows, sameCount, missingCount } */
function diffSpec(a, b, pairSlug) {
  var rows = [], same = 0, missing = 0;
  GROUPS.forEach(function (g) {
    g[1].forEach(function (f) {
      var key = f[0], label = f[1];
      var va = val(a.spec[key]), vb = val(b.spec[key]);
      var ea = va === null || va === undefined, eb = vb === null || vb === undefined;
      if (ea && eb) return;                      /* אף אחד מהיצרנים לא מפרסם. לא שדה ולא הבדל */
      if (!ea && !eb) {
        if (va === vb) { same++; return; }
        if (normalise(va) === normalise(vb)) {
          same++;
          softDiffs.push(pairSlug + ' · ' + label + ':  "' + va + '"  /  "' + vb + '"');
          return;
        }
      } else { missing++; }
      rows.push({ group: g[0], key: key, label: label, a: ea ? null : va, b: eb ? null : vb });
    });
  });
  return { rows: rows, same: same, missing: missing };
}

var MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function dayHe(iso) { var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ב' + MONTHS_HE[+p[1] - 1] + ' ' + p[0] : String(iso); }
/* לכל אחד משני הדגמים: המקורות של השדות שבטבלה, מקובצים לפי כתובת. שדה שמקורו מאגר ולא היצרן
   נושא kind שאומר את זה, ולכן הקורא רואה את זה כאן ולא רק מי שפותח את הקובץ. */
function sourcesLine(a, b, d) {
  /* מקובץ לפי תאריך הבדיקה, וכל תאריך נאמר פעם אחת. תאריך ליד כל מקור היה חוזר ארבע עד שש
     פעמים באותה שורה, וה-copy-audit סימן את זה בכל עמודי ההשוואה. כשכל התאריכים באותה שנה,
     השנה נכתבת רק בתאריך האחרון, כמו שכותבים בעברית "ב-9, ב-10 וב-16 באוגוסט 2026". */
  var byDate = {}, dates = [];
  [a, b].forEach(function (x) {
    var S = x.spec_source || {}, seen = {};
    d.rows.forEach(function (r) {
      var v = x.spec[r.key];
      if (v === null || v === undefined) return;
      var src = S[r.key] && S[r.key].src ? S[r.key] : S['default'];
      if (!src || !src.src || !/^https:\/\//.test(src.src) || seen[src.src]) return;
      seen[src.src] = 1;
      var at = src.at || '';
      if (!byDate[at]) { byDate[at] = []; dates.push(at); }
      var g = byDate[at], last = g[g.length - 1];
      if (!last || last.x !== x) g.push(last = { x: x, links: [] });
      last.links.push({ src: src.src, kind: src.kind || 'אתר היצרן' });
    });
  });
  if (!dates.length) return '';
  dates.sort();
  var years = {}; dates.forEach(function (at) { years[at.slice(0, 4)] = 1; });
  var oneYear = Object.keys(years).length === 1;
  /* שני מקורות מאותו סוג לאותו דגם: התווית פעם אחת, עם שני קישורים */
  function linksOf(list) {
    var kinds = [], by = {};
    list.forEach(function (l) { if (!by[l.kind]) { by[l.kind] = []; kinds.push(l.kind); } by[l.kind].push(l.src); });
    return kinds.map(function (k) {
      var u = by[k];
      if (u.length === 1) return '<a href="' + esc(u[0]) + '" rel="noopener">' + esc(k) + '</a>';
      return esc(k) + ' (' + u.map(function (x, i) { return '<a href="' + esc(x) + '" rel="noopener">עמוד ' + (i + 1) + '</a>'; }).join(', ') + ')';
    }).join(', ');
  }
  var parts = dates.map(function (at, i) {
    var day = at ? at.split('-').reverse().map(function (x) { return String(+x); }).join('.') : '';
    return (at ? 'נבדקו ב-' + day + ': ' : '') + byDate[at].map(function (o) {
      return '<b>' + ltr(o.x.name) + '</b>, ' + linksOf(o.links);
    }).join('; ');
  });
  return '    <p class="aside">המקורות. ' + parts.join('. ') + '.</p>\n';
}

/* ── השוואות קרובות ──────────────────────────────────────────────
 * עד 17.8.2026 עמוד השוואה קישר לשני המכשירים שלו ולשער, ולשום דבר אחר. כלומר קורא
 * שסיים להחליט בין אייפון 17 לאייפון 17 פרו, ועכשיו תוהה לגבי הפרו מקס, היה צריך
 * לחזור לשער ולחפש. 19 העמודים היו 19 קצוות מבודדים.
 *
 * הקרבה נמדדת בדגם משותף, ולא בניחוש: זוג שחולק מכשיר עם הזוג הזה הוא בהגדרה הצעד
 * הבא של אותו קורא. הכיוון "מי שקרא את א׳ יקרא את ב׳" סימטרי, ולכן הקישור הדדי מעצמו.
 *
 * ל-iphone-16-vs-iphone-17e אין שכן משותף כלל, ולכן יש נפילה למותג. בלעדיה העמוד היחיד
 * שהמנגנון נבנה בשבילו היה נשאר בדיוק כפי שהיה. */
function nearPairs(p) {
  var pairs = db._comparisons.pairs;
  var mine = [p.a, p.b];
  function shares(q) { return [q.a, q.b].filter(function (x) { return mine.indexOf(x) >= 0; }); }
  var near = pairs.filter(function (q) { return q.slug !== p.slug && shares(q).length; });
  if (!near.length) {
    /* אותו מותג בשני הצדדים. פחות הדוק מדגם משותף, אבל עדיין אותו קורא. */
    var brands = mine.map(function (s) { var x = D(s); return x ? x.brand : null; }).filter(Boolean);
    near = pairs.filter(function (q) {
      if (q.slug === p.slug) return false;
      return [q.a, q.b].some(function (s) { var x = D(s); return x && brands.indexOf(x.brand) >= 0; });
    });
  }
  return near.slice(0, 4);
}

/* עמוד השוואה קבוע בעיצוב ח׳ (24.9.2026), אותה שפה כמו הכלי. שני הבדלים מהכלי, בכוונה:
   1. כל התוכן ב-HTML. גוגל קורא את העמוד בלי JavaScript, ולכן התחומים, הקווים והטקסט הכתוב נבנים כאן.
      "מה חשוב לכם" מתווסף מעל זה ב-page.client.js, ועמוד בלי JS מציג פשוט את כל התחומים.
   2. בלי משפט ההסבר מתחת לכל שדה. הוא זהה בכל העמודים, ו-33 עמודים עם אותן 29 פסקאות נראים לגוגל
      כמו עמוד אחד עם שמות מוחלפים. הטקסט הייחודי של כל זוג (lede, למי עדיף, angle, השורה התחתונה) נשאר. */
var PAGE_CLIENT = fs.readFileSync(path.join(__dirname, 'compare-tool', 'page.client.js'), 'utf8').replace(/\r/g, '');
/* שדות שיש להם מספר באותה יחידה בשני הצדדים, ואיזה DELTAS מודד אותם. זהה למפה שבכלי. */
var BAR_DELTA = { screen_size: 'screen_size', weight: 'weight', storage_offered: 'storage_offered', battery: 'battery_hours', zoom: 'zoom' };
function tdefOf(k) { return TDEF.filter(function (t) { return t.key === k; })[0] || null; }
function fmtN(v, f) {
  if (f === 'gb') return v >= 1024 ? (v / 1024) + 'TB' : v + 'GB';
  if (f === 'dec') return String(Math.round(v * 100) / 100);
  return String(Math.round(v));
}
function gapChip(x, t) {
  var hi = Math.max(x.a, x.b), lo = Math.min(x.a, x.b);
  if (lo === 0 && t.zero) return t.zero + ' באחד מהם';
  if (lo > 0 && (hi / lo >= 2 || t.each)) { var r = hi / lo; return 'פי ' + (r < 10 ? Math.round(r * 10) / 10 : Math.round(r)); }
  return 'הפרש ' + fmtN(x.gap, t.fmt) + (t.fmt === 'gb' ? '' : t.unit);
}
/* ההבדלים הגדולים לעמוד קבוע, באותם כללים כמו bigGaps בכלי: לכל קבוצה כרטיס אחד (שעות וידאו לפני mAh),
   ו-mAh יורד כשהוא מצביע הפוך משעות הווידאו של אותו יצרן. עד התיקון העמוד הציג את שניהם. */
function pickGaps(a, b) {
  var all = T.deltas(a.spec, b.spec), best = {};
  all.forEach(function (x) {
    var t = tdefOf(x.key); x.grp = t ? t.group : x.key; x.pri = t ? t.pri : 0;
    var c = best[x.grp]; if (!c || x.pri < c.pri || (x.pri === c.pri && x.strength > c.strength)) best[x.grp] = x;
  });
  var H = T.DELTAS.filter(function (d) { return d.key === 'battery_hours'; })[0];
  return all.filter(function (x) {
    if (best[x.grp] !== x) return false;
    if (x.key !== 'battery_mah' || !H) return true;
    var ha = H.get(a.spec), hb = H.get(b.spec);
    if (typeof ha !== 'number' || typeof hb !== 'number' || ha === hb) return true;
    return (ha > hb ? 'a' : 'b') === x.lead;
  }).sort(function (p, q) { return q.strength - p.strength; }).slice(0, 3);
}
function bigNum(v, t) {
  if (v === 0 && t.zero) return '<span class="cv-big cv-big-w">' + esc(t.zero) + '</span>';
  var u = t.fmt === 'gb' ? '' : t.unit.trim();
  return '<span class="cv-big">' + ltr(fmtN(v, t.fmt)) + (u ? '<small>' + esc(u) + '</small>' : '') + '</span>';
}
function fillBar(w) {
  return '<span class="cv-track" aria-hidden="true"><span class="cv-fill" style="width:' + Math.max(0, Math.min(100, Math.round(w))) + '%"></span></span>';
}
function dimsOf(x) {
  var m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*[0-9]/.exec(String(val(x.spec.dimensions || '')));
  return m ? { h: +m[1], w: +m[2] } : null;
}
function diffCount(n) { return n === 1 ? 'הבדל אחד' : n + ' הבדלים'; }
function sameTail(n) { return n === 0 ? ', ואין שדות זהים' : n === 1 ? ', ושדה אחד זהה' : n === 2 ? ', ושני שדות זהים' : ', ו-' + n + ' שדות זהים'; }

/* hero_cta אופציונלי על הזוג. בלי השדה ההדר החדש נשאר כמו שהוא, כולל כפתור cv-hwa.
   כשיש שדה, נוספת שורת הזמנה וכפתורי WhatsApp ושיחה בתוך .hcta, מעל הכרטיסים.
   הקישור הוא waPick של העמוד, לא הנוסח הישן. המיקרו-טקסט אופציונלי. */
function heroBlock(p, waPick) {
  var c = p.hero_cta;
  if (!c) return '';
  var label = c.wa_label || 'עזרו לי לבחור';
  var invite = c.invite ? '<p class="sub cta-line">' + esc(c.invite) + '</p>' : '';
  var call = c.call
    ? '<a class="btn btn-call btn-hero" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>'
    : '';
  var micro = c.micro ? '<p class="meta">' + esc(c.micro) + '</p>' : '';
  return '    <div class="hcta">' + invite +
    '<a class="btn btn-wa btn-hero" href="' + waPick + '">' +
    '<img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">' + esc(label) + '</a>' +
    call + micro + '</div>\n';
}

/* רק בהדר הכהה, ורק בעמוד שיש לו hero_cta. לא נוגע ב-.ghero של שאר האתר. */
var HERO_CTA_CSS = '.cv-top .hcta{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem;margin-top:1rem}\n' +
  '.cv-top .hcta .cta-line{flex:1 0 100%;margin:0;max-width:40rem;color:rgba(255,255,255,.92);font-size:1.02rem;line-height:1.55}\n' +
  '.cv-top .hcta .btn-call{background:transparent;color:#fff;border:1.5px solid var(--teal)}\n' +
  '.cv-top .hcta .btn-call:hover{background:var(--teal);color:#fff}\n' +
  '.cv-top .hcta>.meta{flex:1 0 100%;margin:0;color:rgba(255,255,255,.78)}';

function buildMain(p, a, b, d, openTag) {
  var waMsg = 'היי, אשמח לעזרה בבחירה בין ' + a.name + ' לבין ' + b.name + '.';
  var waPick = wa(waMsg);
  var nmHe = function (x) { return x.name_he || x.name; };
  var year = function (x) { return x.launch ? String(x.launch).slice(0, 4) : ''; };
  var toolHref = '/' + (CAT ? CAT.path : 'phones/compare/') + '?d=' + a.slug + ',' + b.slug;

  /* ---------- ההדר הכהה: הכותרת, שני הכרטיסים, ומשווים גם */
  var card = function (x, i) {
    var inner = thumb(x) + '<span class="cv-dot" aria-hidden="true"></span><span class="cv-ct"><span class="cv-nm">' + ltr(x.name) + '</span>' +
      '<span class="cv-meta">' + esc(x.brand) + (year(x) ? ' · הוכרז ב-' + year(x) : '') + '</span></span>';
    /* מכשיר ייחוס: אין לו עמוד, ולכן אין קישור. הטקסט אומר במפורש שאיננו מוכרים אותו. */
    if (x.status === 'reference') return '        <div class="cv-card" data-slot="' + i + '">' + inner + '<span class="cv-act">לא נמכר אצלנו</span></div>\n';
    var ph = pageHref(x);
    if (ph) return '        <a class="cv-card" data-slot="' + i + '" href="' + ph + '">' + inner + '<span class="cv-act">המפרט המלא</span></a>\n';
    /* שעון או אוזניות בלי עמוד מכשיר: הכרטיס מוביל לכלי, עם הזוג כבר בחור. */
    return '        <a class="cv-card" data-slot="' + i + '" href="' + toolHref + '">' + inner + '<span class="cv-act">כל השדות</span></a>\n';
  };
  /* השוואות שחולקות דגם עם הזוג הזה. השם העברי בקישור, כי כך מחפשים בגוגל. */
  var near = nearPairs(p).slice(0, 4);
  var nearHtml = near.map(function (q) {
    var qa = D(q.a), qb = D(q.b);
    if (!qa || !qb) return '';
    return '<a class="cv-sa" href="/compare/' + q.slug + '/">' + BIDI.ltrRuns(nmHe(qa)) + ' מול ' + BIDI.ltrRuns(nmHe(qb)) + '</a>';
  }).join('');
  var top = '<div class="cv-app">\n<section class="cv-top" aria-labelledby="h1">\n  <div class="wrap">\n' +
    '    <h1 id="h1">' + esc(p.h1) + '</h1>\n' +
    '    <p class="cv-sub">' + esc(p.lede) + '</p>\n' +
    heroBlock(p, waPick) +
    '    <div class="cv-cards" data-pg-data>\n' + card(a, 0) +
    '        <span class="cv-vs2" aria-hidden="true">מול</span>\n' + card(b, 1) + '    </div>\n' +
    '    <div class="cv-sug">' + (nearHtml ? '<span class="cv-sl">משווים גם:</span>' + nearHtml : '') +
    '<a class="cv-sa" href="' + toolHref + '">להחליף דגם בכלי ההשוואה</a>' +
    '<a class="btn btn-wa cv-hwa" href="' + waPick + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">עזרו לי לבחור</a></div>\n' +
    '  </div>\n</section>\n';

  /* ---------- מה זהה */
  var changed = {}; d.rows.forEach(function (r) { changed[r.key] = 1; });
  var same = [];
  GROUPS.forEach(function (g) { g[1].forEach(function (f) {
    var va = a.spec[f[0]], vb = b.spec[f[0]];
    if (changed[f[0]] || va === null || va === undefined || vb === null || vb === undefined) return;
    var v = String(val(va));
    same.push(v.length <= 22 ? f[1] + ': ' + v : f[1]);
  }); });
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12l5 5 9-10"></path></svg>';
  /* התגיות רק כשהן מסכימות עם הספירה של diffSpec, אחרת המספר והתגיות אומרים שני דברים */
  var sameHtml = same.length === d.same && same.length
    ? '    <ul class="cv-same" data-pg-data aria-label="זהים בשניהם">' + same.slice(0, 5).map(function (t) { return '<li>' + CHECK + BIDI.ltrRuns(t) + '</li>'; }).join('') +
      (same.length > 5 ? '<li>ועוד ' + (same.length - 5) + '</li>' : '') + '</ul>\n'
    : '';
  var refs = [a, b].filter(function (x) { return x.status === 'reference'; });
  var disc = refs.length
    ? '    <p class="dnote">את ' + refs.map(function (x) { return esc(nmHe(x)); }).join(' ואת ') + ' איננו מוכרים, ' +
      (refs.length === 1 ? 'והוא כאן כדי שאפשר יהיה להשוות אליו' : 'והם כאן כדי שאפשר יהיה להשוות אליהם') + '. המקור של כל שדה מופיע בסוף הרשימה.</p>\n'
    : '';

  /* ---------- ההבדלים הגדולים במספרים. מחושב מ-traits.js, אותם רפים כמו בכלי. */
  var bigs = '';
  if (!CAT) {
    var ds = pickGaps(a, b);
    if (ds.length) {
      bigs = '    <h2 class="cv-h2" id="gaps-h">ההבדלים הגדולים במספרים</h2>\n' +
        '    <ul data-pg-data class="cv-top3' + (ds.length < 3 ? ' n' + ds.length : '') + '">\n' + ds.map(function (x) {
          var t = tdefOf(x.key), mx = Math.max(x.a, x.b) || 1, lead = x.lead === 'a' ? a : b;
          return '      <li class="cv-t"><div class="cv-th"><b>' + esc(x.label) + '</b><span class="cv-gap">' + BIDI.ltrRuns(gapChip(x, t)) + '</span></div>' +
            '<div class="cv-tv"><div class="cv-a">' + bigNum(x.a, t) + fillBar(100 * x.a / mx) + '<span class="cv-tn">' + ltr(a.name) + '</span></div>' +
            '<div class="cv-b">' + bigNum(x.b, t) + fillBar(100 * x.b / mx) + '<span class="cv-tn">' + ltr(b.name) + '</span></div></div>' +
            '<p class="cv-lead">' + esc(nmHe(lead)) + ': ' + esc(x.leadMore) + '</p></li>';
        }).join('\n') + '\n    </ul>\n' +
        '    <p class="aside">"גדול יותר" אינו "טוב יותר". ' +
        (ds.some(function (x) { return /^(screen_size|weight|battery_hours|battery_mah)$/.test(x.key); }) ? 'מסך גדול שוקל יותר, וסוללה גדולה תופסת נפח.' : 'מספר גבוה יותר במפרט לא תמיד מורגש ביום-יום.') + '</p>\n';
    }
  }

  /* ---------- התחומים */
  var byGroup = {}, order = [];
  d.rows.forEach(function (r) { if (!byGroup[r.group]) { byGroup[r.group] = []; order.push(r.group); } byGroup[r.group].push(r); });
  /* בקטגוריה, קו רק לשדה שהכלי מאשר (_numok), כדי שהעמוד והכלי יציירו אותו דבר */
  var barsOf = function (k) { if (CAT && !(db._numok || {})[k]) return null; return T.ratioField(k, a.spec, b.spec); };
  var anyBar = d.rows.some(function (r) { return !!barsOf(r.key); });
  var small = function (k) {
    var dk = BAR_DELTA[k]; if (CAT || !dk) return false;
    var def = T.DELTAS.filter(function (x) { return x.key === dk; })[0]; if (!def) return false;
    var va = def.get(a.spec), vb = def.get(b.spec);
    var gap = typeof va === 'number' && typeof vb === 'number' ? Math.abs(va - vb) : -1;
    return gap > 0 && gap < def.min;
  };
  var cell = function (x, v, side, bar) {
    return '<div class="cv-v cv-' + side + '"><span class="a11y-sr">' + esc(x.name) + ': </span>' +
      (v === null ? '<span class="cv-na">לא מפורסם אצל היצרן</span>' : '<span class="cv-val">' + BIDI.ltrRuns(v) + '</span>') +
      (bar ? fillBar(bar[side]) : '') + '</div>';
  };
  var sizeHtml = function () {
    if (CAT) return '';
    var da = dimsOf(a), db2 = dimsOf(b); if (!da || !db2) return '';
    var fig = function (x, side) { return '<figure class="cv-' + side + '"><span class="cv-ol" aria-hidden="true" style="width:' + x.w + 'px;height:' + x.h + 'px"></span><figcaption>' + ltr(x.h + ' × ' + x.w) + ' מ״מ</figcaption></figure>'; };
    return '<div class="cv-size">' + fig(da, 'a') + fig(db2, 'b') + '<p>שניהם באותו קנה מידה, גובה ורוחב בלי עובי. מה שמורגש ביד הוא בעיקר המשקל והעובי.</p></div>';
  };
  var groups = order.map(function (g, gi) {
    var rows = byGroup[g];
    return '      <section class="cv-grp" data-cat="' + esc(g) + '" data-n="' + rows.length + '" aria-labelledby="g-' + gi + '"><div class="cv-gh"><h3 id="g-' + gi + '">' + esc(g) + '</h3><span>' + diffCount(rows.length) + '</span></div>' +
      (rows.some(function (r) { return r.key === 'dimensions'; }) ? sizeHtml() : '') +
      rows.map(function (r) {
        var bar = barsOf(r.key);
        return '<div class="cv-r"><div class="cv-rl"><span>' + esc(r.label) + '</span>' + (small(r.key) ? '<span class="cv-small">הבדל קטן</span>' : '') + '</div>' +
          cell(a, r.a, 'a', bar) + cell(b, r.b, 'b', bar) + '</div>';
      }).join('') + '</section>\n';
  }).join('');

  var res = '<section class="block cv-res" id="table" aria-labelledby="cmp-h">\n  <div class="wrap">\n' + disc +
    '    <p class="cv-count">' + diffCount(d.rows.length) + sameTail(d.same) + '</p>\n' + sameHtml + bigs +
    '    <h2 class="cv-h2" id="cmp-h">מה שונה ביניהם</h2>\n' +
    '    <p class="cv-lead2">רק השדות שבהם שני הדגמים לא זהים, לפי תחום.</p>\n' +
    /* ריק ומוסתר עד ש-page.client.js בונה בו את הכפתורים. בלי JS אין כפתור שלא עושה כלום. */
    '    <div class="cv-prio" id="cvprio" hidden></div>\n' +
    (anyBar ? '    <p class="cv-legend">קו ארוך יותר הוא מספר גדול יותר, לא בהכרח טוב יותר.</p>\n' : '') +
    /* כותרת העמודות, דביקה מעל התחומים. aria-hidden: קורא מסך מקבל את שם הדגם בתוך כל תא. */
    '    <div class="cv-table">\n' +
    '    <div class="cv-bar" id="cvbar" aria-hidden="true" data-pg-data><div class="cv-bi"><span class="cv-bc">' + diffCount(d.rows.length) + '</span>' +
    '<span class="cv-bn cv-a"><span class="cv-dot"></span>' + ltr(a.name) + '</span><span class="cv-bn cv-b"><span class="cv-dot"></span>' + ltr(b.name) + '</span></div></div>\n' +
    '    <div id="cvgroups" data-pg-data>\n' + groups + '    </div>\n    </div>\n' +
    sourcesLine(a, b, d) +
    '  </div>\n</section>\n\n';

  /* ---------- הטקסט הכתוב של הזוג: למי עדיף, הזווית הייחודית, השורה התחתונה */
  var who = '<section class="block" id="who" aria-labelledby="h-who">\n  <div class="wrap">\n' +
    '    <h2 id="h-who" class="cv-h2">למי עדיף כל אחד</h2>\n' +
    '    <div class="two">\n' +
    [[a, p.for_a, 'a'], [b, p.for_b, 'b']].map(function (pair) {
      return '      <div class="col cv-' + pair[2] + '">\n' +
        '        <h3><span class="cv-dot" aria-hidden="true"></span>' + ltr(pair[0].name) + '</h3>\n        <ul class="ticks">\n' +
        pair[1].map(function (t) { return '          <li>' + esc(t) + '</li>'; }).join('\n') + '\n        </ul>\n' +
        (!pageHref(pair[0]) ? ''
          : '        <p class="aside"><a href="' + pageHref(pair[0]) + '">המפרט המלא של ' + esc(nmHe(pair[0])) + '</a></p>') + '\n      </div>';
    }).join('\n') + '\n    </div>\n  </div>\n</section>\n\n';
  var angle = p.angle && p.angle_h
    ? '<section class="block" id="angle" aria-labelledby="h-angle">\n  <div class="wrap">\n' +
      '    <h2 id="h-angle" class="cv-h2">' + esc(p.angle_h) + '</h2>\n' +
      p.angle.map(function (t) { return '    <p class="cv-prose">' + esc(t) + '</p>\n'; }).join('') + '  </div>\n</section>\n\n'
    : '';
  var bottom = '<section class="block" id="bottom" aria-labelledby="h-bl">\n  <div class="wrap">\n' +
    '    <h2 id="h-bl" class="cv-h2">השורה התחתונה</h2>\n' +
    '    <p class="cv-prose">' + esc(p.bottom_line) + '</p>\n' +
    '    <div class="cv-wa"><div class="cv-wt"><b>רוצים שנעבור על זה איתכם?</b><span>ההודעה כבר מוכנה עם שני הדגמים, ותחום שתסמנו ב"מה חשוב לכם" ייכנס אליה. אפשר לערוך אותה לפני השליחה.</span>' +
    '<span class="cv-bubble" id="cvwatext">' + esc(waMsg) + '</span></div><div class="cv-wb">' +
    '<a class="btn btn-wa" id="cvwa" href="' + waPick + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">שליחה ב-WhatsApp</a></div></div>\n' +
    '  </div>\n</section>\n</div>\n\n';

  var cta = '<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
    '    <h2 id="cta-h">עדיין מתלבטים?</h2>\n' +
    (function () {
      /* not_in_store ומכשיר ייחוס: בלי זה התבנית הבטיחה "שני המכשירים אצלנו בחנות" גם על דגם שעוד לא
         הגיע, וגם על דגם שאיננו מוכרים בכלל */
      var away = [a, b].filter(function (x) { return x.commercial && x.commercial.not_in_store; });
      var ref = [a, b].filter(function (x) { return x.status === 'reference'; });
      var mine = [a, b].filter(function (x) { return x.status !== 'reference'; });
      var nmOf = function (x) { return esc(nmHe(x)); };
      var lead = CAT ? 'רוצים לדעת אם ' + CAT.plural + ' האלה אצלנו?'
        : ref.length === 2 ? 'שני הדגמים האלה אינם נמכרים אצלנו.'
        : ref.length === 1 ? 'את ' + nmOf(mine[0]) + ' אנחנו מוכרים, ואת ' + nmOf(ref[0]) + ' לא.'
        : !away.length ? 'שני המכשירים אצלנו בחנות.'
        : away.length === 2 ? 'שני הדגמים עוד לא בחנות, ואין לנו מועד הגעה.'
        : nmOf(away[0]) + ' עוד לא בחנות, ואין לנו מועד הגעה.';
      return '    <p>' + lead + ' תגידו לנו מה חשוב לכם, ונעבור על זה יחד. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n';
    })() +
    '    <div class="row">\n' +
    '      <a class="btn btn-wa" href="' + waPick + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">עזרו לי לבחור</a>\n' +
    '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
    '      <a class="btn btn-teal" href="/compare/">כל ההשוואות</a>\n' +
    '    </div>\n' +
    '    <p class="fine">הייעוץ והליווי בבחירה ללא עלות וללא התחייבות.</p>\n' +
    '  </div>\n</section>\n\n';

  var script = '<script>\n(function(){\n"use strict";\nvar PG={a:' + JSON.stringify(a.name).replace(/</g, '\\u003c') + ',b:' + JSON.stringify(b.name).replace(/</g, '\\u003c') +
    ',slug:' + JSON.stringify(p.slug) + '};\n' + PAGE_CLIENT + '\npgComparePage();\n})();\n</scr' + 'ipt>\n\n';

  return openTag + '\n\n' + top + res + who + angle + bottom + cta + script;
}

function schema(p, a, b, url) {
  return [
    { '@context': 'https://schema.org', '@type': 'Article',
      headline: p.h1, description: p.description,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      /* Thing ולא Product, ולא בגלל דיוק סמנטי אלא בגלל שגיאה אמיתית ב-Search Console.
       *
       * ב-24.8.2026 הגיע מייל "יש לציין offers, review, או aggregateRating" על האתר, וכל 38
       * הישויות שנמצאו היו כאן: Product חשוף עם name ו-brand בתוך about של המאמר. ההנחה
       * שישות מקוננת תחת about פטורה מהדרישה הזאת הייתה שגויה. גוגל בודקת כל ישות Product
       * בדף, בלי קשר למקום שלה בעץ.
       *
       * ושלושת השדות שהיא מבקשת אסורים כאן, כל אחד מסיבה אחרת:
       *   offers          חצי מהדגמים בעמודי ההשוואה הם מכשירי ייחוס שאיננו מוכרים, ואיננו
       *                   מפרסמים מחירים בכלל. offers היה אומר ללקוח שאנחנו מוכרים אותם.
       *   review          אין לנו ביקורות לכל דגם.
       *   aggregateRating 537 הביקורות הן על העסק ולא על מכשיר. לתלות אותן בדגם זו המצאה,
       *                   וזו הפרת מדיניות שגוררת ענישה ידנית.
       *
       * ולכן הפתרון היחיד הוא לא להצהיר Product. Thing נושא את השם וגם את הקישור לעמוד
       * המכשיר, שהוא סיגנל טוב יותר מ-brand שהיה כאן. מכשיר ייחוס נשאר בלי url, כי אין לו
       * עמוד, בדיוק כמו ה-.noown ברשימה. */
      about: [a, b].map(function (x) {
        var o = { '@type': 'Thing', name: x.name };
        if (x.status !== 'reference' && !CAT) o.url = PROD + 'phones/' + x.slug + '/';
        return o;
      }),
      publisher: { '@id': PROD + '#business' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'דף הבית', item: PROD },
        { '@type': 'ListItem', position: 2, name: 'השוואות', item: PROD + 'compare/' },
        { '@type': 'ListItem', position: 3, name: p.h1, item: url }
      ] }
  ];
}

/* ה-CSS של .hub נשלף מ-guides/index.html, המקום שבו הרכיב נולד, ולא מועתק לכאן.
 *
 * זו הפעם השלישית שה-CSS של הרכיב הזה לא נסע יחד עם ה-HTML שלו. פעם ראשונה: /phones/ קיבל
 * את הרשימה בלי העיצוב, והדגמים הוצגו כטקסט שטוח. פעם שנייה: אותו דבר בעמודי ההשוואה, כי
 * עמוד המקור כאן הוא עמוד מכשיר ואין בו .hub בכלל. בשתי הפעמים preflight תפס, ובשתי הפעמים
 * התיקון היה העתקה נוספת של אותו בלוק. העתק שלישי היה מבטיח שאחד מהשלושה יסחף.
 *
 * שליפה מהמקור פותרת את זה מעצם המבנה: יש עותק אחד, ומי שיערוך אותו שם יראה את השינוי בכל
 * העמודים בהרצה הבאה. אם הבלוק לא נמצא, זו שגיאה קשה ולא אזהרה, כי הרשימה היא הניווט. */
function hubCss() {
  var g = fs.readFileSync(path.join(PROTO, 'guides/index.html'), 'utf8');
  var s = g.indexOf('.hub{list-style:none');
  if (s < 0) { console.error('✗ לא נמצא ה-CSS של .hub ב-guides/index.html. הרכיב נולד שם, ואם הוא זז צריך לעדכן את המחולל.'); process.exit(1); }
  var e = g.indexOf('\n\n', s);
  var block = g.slice(s, e < 0 ? s + 1400 : e);
  var rules = (block.match(/^\.hub|^@media[^{]*\{\.hub/gm) || []).length;
  if (rules < 6) { console.error('✗ ה-CSS של .hub נשלף חלקי: ' + rules + ' כללים בלבד'); process.exit(1); }
  /* .noown נכתב כאן ולא נשלף, כי הוא נולד בעמוד ההשוואה ואינו קיים בשום מקום
     אחר: פריט של מכשיר ייחוס, שאין לו עמוד ולכן אין לאן ללחוץ. */
  return '/* .hub — נשלף מ-guides/index.html בזמן החילול. עותק אחד, ואין מה לסחוף. */\n' + block +
    '\n.hub .noown{display:block;color:var(--ink-soft)}\n.hub .noown b{color:var(--ink-strong)}' +
    /* .hub.pics — עמודת תמונה שלישית, ורק בעמוד ההשוואה.
     *
     * .hub עצמו משותף עם /phones/ ועם /guides/, ושם הוא נשאר רשימה של טקסט בהחלטת אופק
     * (16.8.2026): ברשימה של 21 שורות תמונונת קטנה מדי מכדי לעזור. כאן מדובר בשני מכשירים
     * בדיוק, שהעמוד כולו עוסק בהשוואה ביניהם, ולכן התמונה עושה את העבודה שהיא אמורה לעשות.
     * הכיתה היא מה שמפריד בין שני המקרים בלי לשכפל את הרכיב.
     *
     * 4.6rem הוא כ-74 פיקסל, ולכן קובץ ה-288 מכסה גם מסך 3x בלי שכבה נוספת.
     * grid-row של התמונה זהה לזה של המספר, כדי שהיא תתפרס על שתי השורות ולא תדחוף אותן. */
    '\n.hub.pics a{grid-template-columns:2.7rem 4.6rem 1fr}' +
    '\n.hub.pics img{grid-row:1/span 2;width:4.6rem;height:auto;aspect-ratio:3/4;object-fit:contain;' +
    'border:1px solid var(--line);background:#fff;align-self:center}' +
    /* מכשיר ייחוס נשאר בלי תמונה, בהחלטת אופק. הוא ממילא .noown ולא <a>, ולכן הוא לא
       משתמש בגריד הזה בכלל, ואין כאן שורה שנשארת עם עמודה ריקה. */
    '\n@media(max-width:560px){.hub.pics a{grid-template-columns:2.7rem 3.4rem 1fr}.hub.pics img{width:3.4rem}}' +
    /* .hub.near — בלי המספור.
     * ב-.hub המספר 01, 02, 03 הוא אינדקס של רשימה מלאה ומסודרת, וזה נכון בשער שמציג את כל
     * 19 ההשוואות. בבלוק "השוואות קרובות" יש ארבע מתוכן, שנבחרו לפי דגם משותף ולא לפי דירוג,
     * ומספר סידורי היה אומר לקורא שיש כאן סדר עדיפות שאין. */
    '\n.hub.near a{grid-template-columns:1fr}' +
    '\n.hub.near a::before{content:none}';
}

/* ה-CSS של עמוד ההשוואה. מוזרק כאן ולא יושב בעמוד המקור, כי המקור הוא עמוד מכשיר ואין בו
 * שתי עמודות "למי עדיף" ואין בו שורת שדה בתוך קטגוריה. CSS שלא בשימוש במקור נסחף. */
var CSS = [
  '/* עמוד השוואה. שורת שדה בתוך קטגוריה: קו שערה ותווית קטנה, בלי רקע צבוע ובלי מסגרת,',
  '   כמו כל התוויות הקטנות בדף. הקטגוריה מעליה נשארת עם הקו הכבד. */',
  '.cmp-vs .fld th{border-top:1px solid var(--line);padding-block:1.15rem .3rem;font-family:var(--font);font-weight:700;font-size:1.02rem;letter-spacing:.02em;color:var(--ink-strong);text-align:start;width:auto}',
  '.cmp-vs .grp+.fld th{border-top:0}',
  '/* שם המכשיר בשורה הוא כותרת שורה, ולכן הוא צר וקבוע. 7.5rem = 120px, ומשאיר לערך את השאר.',
  '   נמדד: עמודת ערך של 215px ב-375px, והתא הגרוע נשבר ל-8 שורות במקום 16 בטבלה של שלוש עמודות. */',
  '.cmp-vs tbody th[scope=row]{width:7.5rem;font-weight:700;color:var(--ink)}',
  '.cmp-vs td i{font-style:italic;color:var(--ink-soft)}',
  '/* אין min-width: הטבלה הזאת לא צריכה לגלול הצידה, וזו כל הנקודה בצורה שנבחרה. */',
  '.cmp-vs{min-width:0}',
  '@media(max-width:640px){.cmp-vs{min-width:0}.cmp-vs tbody th[scope=row]{width:6.2rem}}',
  '/* שתי עמודות "למי עדיף". נערמות בטלפון, כי שתי רשימות זו ליד זו ב-375px זה שתי עמודות',
  '   של 160px ואף אחת מהן לא נקראת. */',
  '@media print{html[class*="a11y-"] :is(header.site,nav.mbar,main,footer.site){filter:none !important}html[class*="a11y-text-"]{font-size:16px !important}}',
  'main .btn{white-space:normal}',   /* nowrap הוא ברירת המחדל של .btn, והוא גולש בהגדלת טקסט ל-200% */
  '.two{display:grid;gap:2.2rem;margin-top:1.6rem}',
  '@media(min-width:820px){.two{grid-template-columns:1fr 1fr;gap:3rem}}',
  '.two .col p.aside{margin-block:.55rem}',
  '.two .col p.aside a{display:inline-block;padding-block:12px}',   /* 20.8 → 44.8. הפסקה הזאת מכילה רק את הקישור, ולכן אין ריווח שורות שנפגע */
  '.two .col h3{font-family:var(--serif);font-weight:400;font-size:clamp(1.22rem,2.2vw,1.5rem);margin:0 0 .2rem;padding-block-end:.7rem;border-bottom:2px solid var(--ink-strong)}',
  '.ticks{list-style:none;margin:0;padding:0}',
  '.ticks li{border-bottom:1px solid var(--line);padding-block:1rem;line-height:1.75}',
  '.ticks li:last-child{border-bottom:0}',
  '/* ===== ההבדלים הגדולים ===== */',
  '/* שורות בקו שערה ולא כרטיסים. שלוש עמודות בדסקטופ, נערם בטלפון. */',
  '.gaps{list-style:none;margin:1.7rem 0 0;padding:0}',
  '.gaps li{border-block-start:1px solid var(--line);padding-block:1.15rem;display:grid;gap:.15rem .9rem;align-items:baseline}',
  '@media(min-width:700px){.gaps li{grid-template-columns:11rem 1fr auto}}',
  '.gaps b{font-family:var(--serif);font-weight:400;font-size:clamp(1.12rem,1.9vw,1.3rem);color:var(--ink-strong)}',
  '.gaps span{color:var(--ink);line-height:1.7}',
  '/* "מי גדול יותר" בסאנס קטן ומרוסן. זה נתון ולא פסק דין, ולכן לא מודגש ולא צבוע חזק. */',
  '.gaps em{font-style:normal;font-size:1rem;color:var(--ink-soft)}',
  '/* ===== הקו היחסי בטבלה ===== */',
  '/* 2px, בצבע המבטא, באורך יחסי לערך הגדול בשורה. בלי רקע ובלי מסגרת ובלי radius:',
  '   שני מספרים דורשים חיסור, שני קווים באורך שונה נקראים במבט אחד. */',
  '.dbar{display:block;block-size:2px;inline-size:var(--w,0);min-inline-size:2px;max-inline-size:100%;background:var(--teal);margin-block-start:.5rem;opacity:.75}',
  '/* בהיפוך צבעים ובניגודיות גבוהה הקו לוקח את צבע הטקסט, אחרת הוא נעלם */',
  /* שמות המחלקות כאן היו a11y-invert ו-a11y-contrast, ותפריט הנגישות לא מוסיף אף אחד מהם:
     הוא מוסיף a11y-contrast-high, a11y-contrast-invert ו-a11y-contrast-mono. הכלל מעולם לא
     תאם ל-DOM, ולכן פסי ההשוואה נשארו ב-opacity נמוך ובצבע המקורי בכל שלושת מצבי הניגודיות,
     ב-21 עמודים. בדיקה 17 מוודאת שכללי ההשפעה קיימים ולא שהסלקטור שלהם תואם למחלקה שנוספת
     בפועל, ולכן היא אישרה אותו. זו אחת המגבלות שהצהרת הנגישות מונה. */
  'html.a11y-contrast-high .dbar,html.a11y-contrast-invert .dbar,html.a11y-contrast-mono .dbar{background:currentColor;opacity:1}'
].join('\n') + '\n' + hubCss();

/* ה-details של השאלות הנפוצות נשלף מדף הבית, אותו שיקול כמו ב-.hub: עותק שני של כלל עיצוב
 * מתפצל בשקט. רק התחילית מוחלפת, כדי שהמקטע "איך זה עובד" כאן ייראה בדיוק כמו כל אקורדיון
 * אחר באתר. אם המראה של השאלות הנפוצות ישתנה, הכלי ילך אחריו בהרצה הבאה. */
function detailsCss() {
  var g = fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8');
  var got = g.match(/\.faq (?:details|summary)[^{}]*\{[^}]*\}/g) || [];
  if (got.length < 5) {
    console.error('✗ נמצאו רק ' + got.length + ' כללי details בשאלות הנפוצות. הרכיב נולד שם, ואם הוא זז צריך לעדכן את המחולל.');
    process.exit(1);
  }
  return '/* האקורדיון — נשלף מ-index.html בזמן החילול. עותק אחד. */\n' +
    got.map(function (r) { return r.replace(/^\.faq /, '.dhow '); }).join('\n');
}

/* ============================================ המסגרת של הכלי
 *
 * עמוד שהוא כלי ולא מאמר. עד 16.8.2026 הוא נפתח ב-.ghero, אותו hero עריכותי שכל עמוד תוכן
 * נושא: כותרת ענקית במרכז, כותרת משנה, וכפתור. הוא לבדו תפס מסך שלם, ולכן הדבר היחיד שאפשר
 * היה לעשות בעמוד היה מתחת לקו הקיפול. כאן ההיררכיה הפוכה: כותרת נמוכה, שלושה צעדים שאומרים
 * מה לעשות, ומיד הקונסולה עם התאים הריקים והרשימה.
 *
 * הצ׳יפים אינם .chip. הרכיב הזה נולד במדריך התקלות כמתג טקסט בתוך משפט, ושם הוא נכון. כאן
 * הוא רשימת בחירה של 24 פריטים, כלומר יעד מגע. השאלה של הכלי הזה היא רק אם הוא נבחר,
 * ולכן .dchip הוא גלולה עם מסגרת, 44 פיקסלים, וצבע שמתאים לתא ולעמודה בטבלה.
 * (הלקח: השאילה הקודמת גם השתיקה את עצמה. chipCss שלף שלושה כללים מתוך ארבעה, החמיץ את
 * ההשלמה .chip{color:var(--ink)…}, ולכן העותק המאוחר החזיר את הצ׳יפים לאפור בלי קו תחתון,
 * כלומר לרשימת טקסט בלי סימן שאפשר ללחוץ עליה. אף בדיקה לא תפסה זאת.)
 */
/* ה-CSS של הכלי יושב בקובץ משלו מאז גרסה ח׳ (24.9.2026). השער בסוף buildTool ממשיך לבדוק
   שאף שם שמוגדר בו אינו מוגדר כבר בגיליון המשותף. */
var APP_CSS = fs.readFileSync(path.join(__dirname, 'compare-tool', 'tool.css'), 'utf8').replace(/\r/g, '');


/* המותגים בסדר קבוע, וכל מותג עם הלוגו שלו במידות שנמדדו. הלוגואים נמחקו ב-eb07517 כשהכלי
   כבר לא היה קיים ולכן איש לא הפנה אליהם, ושוחזרו מגיט יחד איתו. */
var BRAND_LOGO = {
  /* הוגדלו ב-17.8.2026. הטקסט שלצידם הוא 15.7 פיקסל, ולוגו של 12 נראה כמו רעש.

     סמסונג נמוך מהשאר וגם רחב מהם, כי הקובץ שלו הוא סמל מילה בלי מסגרת. עד 17.8.2026 הוא
     היה האליפסה הכחולה מ-1993 עם האותיות חתוכות ממנה בלבן, והאותיות שם היו 28 אחוז מגובה
     הקובץ, כלומר 5.1 פיקסל בגובה 18. אי אפשר היה לקרוא אותן, וגם לא הייתה מידה שתתקן את זה:
     אותיות בגובה 9 היו דורשות אליפסה של 32 פיקסל, פי שניים מגובה השורה.

     מאז שהקובץ צמוד לדיו, המידה כאן היא גובה האותיות ממש, ולכן היא מכוילת מול הטקסט שלצידה
     ולא מנוחשת: 14 מול טקסט של 15.7 בבורר, ו-13 מול 16.3 בראש הטבלה, שזה גם בדיוק גובה
     האותיות של Nothing שם. שאר המותגים נשארים גבוהים יותר במידה כי הם צורות ולא אותיות,
     וצורה נקראת גם קטנה יותר. */
  Apple: ['apple', 17, 20], Samsung: ['samsung', 96, 14], Xiaomi: ['xiaomi', 19, 20],
  /* שלושת אלה נוספו ב-16.8.2026, אחרי שאופק סיפק את הקבצים. כל אחד דרש טיפול: הקובץ של
     גוגל היה JPEG בשם png, כלומר רקע לבן אטום, והכיל את המילה Pixel לצד הסמל; של OnePlus
     הכיל בלוק אדום עם המילה חתוכה; ושל Nothing היה לבן על שחור. כולם נחתכו לסמל עצמו,
     הרקע הלבן הוסר, ו-Nothing הופך לשחור על שקוף, שזו הצורה הרשמית שלו על רקע בהיר. */
  Google: ['google', 20, 20], Nothing: ['nothing', 84, 15], OnePlus: ['oneplus', 20, 20]
};

/* אותם קבצים במידות של ראש הטבלה, שקטנות יותר. עד 16.8.2026 הטבלה נשאה עותק משלה של
   המפה הזאת, כתוב ביד בתוך ה-JS, וכך מותג חדש היה מקבל לוגו בבורר ולא בטבלה. */
var BRAND_LOGO_CELL = {
  /* הוגדלו ב-17.8.2026, ובאותה מידה שה-CSS של ראש הטבלה קובע, כדי שלא ייווצר קיפוץ פריסה
     בין הרגע שהמידות נקראות מהמאפיין לרגע שהכלל חל. */
  Apple: ['apple', 14, 17], Samsung: ['samsung', 89, 13], Xiaomi: ['xiaomi', 16, 17],
  Google: ['google', 17, 17], Nothing: ['nothing', 73, 13], OnePlus: ['oneplus', 17, 17]
};

/* שם המותג בעברית, בשביל הסינון בלבד. השמות העבריים של הדגמים כבר מכילים "אייפון" ו"גלקסי",
   ולכן חסר רק שם החברה עצמה: מי שהקליד "סמסונג" קיבל רשימה ריקה. אלה האיותים שהאתר כבר
   משתמש בהם, ולא תעתיק שהומצא כאן. ל-OnePlus ול-Nothing אין איות עברי באתר, ולכן אין להם
   רשומה: תעתיק שאיש לא כותב אינו עוזר לחיפוש, והוא מחייב אותנו לאיות שלא בחרנו. */
var BRAND_HE = { Apple: 'אפל', Samsung: 'סמסונג', Xiaomi: 'שיאומי', Google: 'גוגל' };

/* ============================================ שכבת הפרשנות של הכלי
 *
 * עמוד השוואה כתוב אומר שני דברים שהטבלה אינה אומרת: מה ההבדל הגדול, ולמי מתאים כל אחד.
 * את שניהם כתבנו ביד ל-19 הזוגות שיש להם עמוד. הכלי מכסה 276 זוגות, ולכן שם אין מי שיכתוב,
 * והוא הציג טבלה ותו לא: תשובה מדויקת לשאלה "במה הם נבדלים", ושתיקה על "מה זה אומר לי".
 *
 * הרפים ושמות השדות באים מ-T.DELTAS ואינם נכתבים כאן שוב, כי אותם רפים עצמם מזינים את 19
 * העמודים הכתובים, ושני מקורות אמת היו מאפשרים לכלי ולעמוד להגיד שני דברים על אותו זוג.
 * מה שנכתב כאן הוא רק הניסוח: איך מעצבים את המספר, ואיזה שימוש בפועל היתרון הזה משרת.
 * "אם אתם" ולא "עדיף לכם", כי הכלי אינו מכריז מנצח וגם אינו מכריז מה חשוב ללקוח.
 *
 * שדה חדש ב-DELTAS בלי רשומה כאן מפיל את המחולל בכוונה. בלעדי זה הוא היה נכנס לרשימת
 * ההבדלים ונעדר מ"למי מתאים", כלומר הכלי היה מודד משהו בלי לדעת לומר למה הוא נוגע.
 */
var TFMT = {
  /* low ו-lowMore אינם כאן יותר: הקוטביות היא תכונה של השדה והיא יושבת ב-DELTAS,
     כדי שהעמוד הכתוב לא יוכל לומר עליה משהו אחר. כאן נשאר רק הניסוח. */
  weight:          { fmt: 'int', unit: ' גרם', gap: true,
                     who: 'אם חשוב שהמכשיר יהיה קל ביד' },
  screen_size:     { fmt: 'dec', unit: ' אינץ׳', who: 'אם אתם קוראים וצופים בסרטונים' },
  storage_offered: { fmt: 'gb',  unit: '', who: 'אם אתם מצלמים הרבה ולא רוצים למחוק' },
  /* שעות וידאו ו-mAh מודדים את אותה תכונה בשתי שיטות מדידה, ולכן הם קבוצה אחת. בלי זה
     זוג כמו Galaxy S26 מול Galaxy A17 היה מציג שתי שורות סוללה שמצביעות על דגמים הפוכים,
     ושתיהן פותחות באותו משפט "אם אתם מחוץ לבית כל היום". החזק מבין השניים נכנס, וזה תמיד
     יהיה זה שההפרש בו גדול יותר ביחס לרף שלו. */
  /* pri קובע בתוך הקבוצה, לפני העוצמה. שעות וידאו הן מדידת סיבולת של היצרן ו-mAh הוא
     קירוב של קיבולת, ולכן כששני היצרנים מפרסמים את שתיהן, השעות הן התשובה. בלי זה
     ההפרש היחסי הכריע, ובעשרה זוגות mAh ניצח וזיכה את הדגם שיש לו פחות שעות: ב-
     galaxy-s26-plus מול redmi-note-15 הפרשנות זיכתה את הרדמי על 6000 מול 4900 mAh,
     ושורת הסוללה מיד מתחתיה אמרה 31 שעות מול 24 לטובת הסמסונג. */
  battery_hours:   { fmt: 'int', unit: ' שעות', group: 'batt', pri: 1, who: 'אם אתם מחוץ לבית כל היום' },
  battery_mah:     { fmt: 'int', unit: ' mAh', group: 'batt', pri: 2, who: 'אם אתם מחוץ לבית כל היום' },
  /* 12 מהדגמים מחזירים 0 בזום, כלומר "יש שורת זום ואין בה עדשה". "5x מול 0x" היה נקרא
     כמו מפרט, ולכן האפס מנוסח במילים. */
  zoom:            { fmt: 'dec', unit: 'x', each: true, zero: 'אין זום אופטי',
                     who: 'אם אתם מצלמים דברים רחוקים' }
};
var TDEF = T.DELTAS.map(function (d) {
  var f = TFMT[d.key];
  if (!f) {
    console.error('✗ tool: לשדה ' + d.key + ' אין ניסוח ב-TFMT. שדה שנמדד בלי ניסוח נכנס לרשימת ההבדלים ונעדר מ"למי מתאים".');
    process.exit(1);
  }
  return { key: d.key, label: d.label, min: d.min, more: d.more, fmt: f.fmt, unit: f.unit,
           each: !!f.each, gap: !!f.gap, low: !!d.low, lowMore: d.lowMore || d.more,
           group: f.group || d.key, pri: f.pri || 0, zero: f.zero || null, who: f.who };
});
/* המספרים לכל דגם, פעם אחת. sd, uw ו-upd אינם הפרשים על סקאלה אלא תלת-מצביים, ולכן הם
   נשלחים לצד הרשימה ולא בתוכה: null הוא "היצרן אינו מפרסם" ואינו 0. */
function traitsOf(x) {
  var t = {};
  T.DELTAS.forEach(function (d) { t[d.key] = d.get(x.spec); });
  t.sd = T.sdCard(x.spec); t.uw = T.ultraWide(x.spec); t.upd = T.updateYear(x.spec);
  return t;
}

/* האקורדיון של "איך זה עובד" נשלף מ-index.html, והשאר ב-tool.css */
var TOOL_CSS = [fs.readFileSync(path.join(__dirname, 'compare-tool', 'frame.css'), 'utf8').replace(/\r/g, ''), detailsCss(), APP_CSS].join('\n');

/* ההסברים לשדות של טלפון. עד 24.9.2026 הם ישבו בתוך מחרוזת ה-JS של הכלי, והועברו לקובץ נתונים
   בלי שינוי במילה. לשעונים ולאוזניות ההסברים ב-_means של קובץ הנתונים שלהם. */
var PHONE_MEANS = JSON.parse(fs.readFileSync(path.join(__dirname, 'compare-tool', 'means-phones.json'), 'utf8'));
var TOOL_CLIENT = fs.readFileSync(path.join(__dirname, 'compare-tool', 'tool.client.js'), 'utf8').replace(/\r/g, '');

function toolMain(openTag, index, order, pairCount) {
  /* כולל מכשירי ייחוס: דגמים שאיננו מוכרים, שקיימים כדי שאפשר יהיה להשוות אליהם. הם נושאים גילוי נאות
     בתוצאה, כי לקוח שרואה דגם ברשימה שלנו מניח שאנחנו מוכרים אותו. */
  /* מקובץ לפי מותג, ובתוך כל מותג מהחדש לישן. הסדר בין המותגים נקבע ב-BRAND_LOGO ולא כאן. */
  var live = db.devices.filter(function (d) { return d.status !== 'draft'; }).sort(function (a, b) {
    if (a.brand !== b.brand) return a.brand < b.brand ? -1 : 1;
    return T.newestFirst(a, b);
  });
  var brands = Object.keys(BRAND_LOGO).map(function (b) {
    return { brand: b, items: live.filter(function (d) { return d.brand === b; }) };
  }).filter(function (g) { return g.items.length; });
  /* מותג בלי לוגו עדיין מופיע, אחרת דגם שנוסף למאגר היה נעלם מהבורר בשקט */
  live.forEach(function (d) {
    if (!BRAND_LOGO[d.brand] && !brands.some(function (g) { return g.brand === d.brand; })) {
      brands.push({ brand: d.brand, items: live.filter(function (x) { return x.brand === d.brand; }) });
    }
  });

  /* המספרים לכל דגם. הדפדפן מקבל אותם ולא את הפרסר, כי פרסר של מפרט עברי הוא הדבר השביר כאן.
     ההבדלים המספריים מוגדרים ב-traits.js על שדות של טלפון, ולכן בקטגוריה הם ריקים. */
  var TRAITS = {};
  if (!CAT) live.forEach(function (d) { TRAITS[d.slug] = traitsOf(d); });
  var MEANS = CAT ? db._means : PHONE_MEANS;
  if (!MEANS) { console.error('✗ ' + (CAT ? CAT.key : 'phones') + ': אין הסברים לשדות'); process.exit(1); }
  /* שדה בהשוואה בלי הסבר אינו תקלה, אבל שדה שמוסבר ואינו קיים הוא שם ששונה בצד אחד בלבד */
  var orderKeys = order.map(function (r) { return r[2]; });
  var orphan = Object.keys(MEANS).filter(function (k) { return orderKeys.indexOf(k) < 0; });
  if (orphan.length) { console.error('✗ tool: הסבר לשדה שאינו קיים: ' + orphan.join(', ')); process.exit(1); }
  var READY = (db._comparisons.pairs || []).map(function (p) { return [p.a, p.b]; });
  var CFG = {
    pub: '/' + (CAT ? CAT.pub : 'devices-public.json'),
    /* טלפון: כל דגם שאינו ייחוס. שעון ואוזניות: רק דגם שיש לו page בקובץ הציבורי, כי לשאר אין עמוד. */
    specLinks: !CAT,
    /* בלי לוכסן בהתחלה: הקליינט כותב href="/' + pageBase, כדי שבדיקת הנתיבים היחסיים תראה נתיב שורשי */
    pageBase: (CAT ? CAT.key : 'phones') + '/',
    /* השרטוט בקנה מידה והקווים נשענים על שדות של טלפון */
    outline: !CAT,
    bars: !CAT,
    pairErr: CAT ? 'לא הצלחנו לחשב את ההשוואה הזאת. נסו לבחור שוב.'
      : 'לא הצלחנו לחשב את ההשוואה הזאת. <a href="/compare/">ההשוואות המוכנות</a> זמינות תמיד.',
    loadErr: CAT ? CAT.loadErr
      : 'לא ניתן לטעון את נתוני המכשירים. <a href="/compare/">ההשוואות המוכנות</a> עובדות בלי הכלי.',
    /* "רוב" בטלפונים: חלק מהשדות מגיעים ממאגרי מפרט, ועמודי ההשוואה אומרים את אותו הדבר */
    src: CAT ? 'המפרט לקוח מאתרי היצרנים.' : 'רוב המפרטים לקוחים מאתרי היצרנים.'
  };
  var waPick = wa(CAT ? CAT.waPick : 'היי, אני מתלבט בין כמה דגמים ואשמח לעזרה בבחירה');
  /* מתג הקטגוריות. nav ולא tablist: אלה שלושה עמודים, לא פאנלים באותו עמוד. המחלקה catsw נשארת,
     כי בלוק המדידה מסמן לפיה entry_point=switch. */
  var catSwitch = '<nav class="catsw" aria-label="מעבר בין כלי השוואה">' +
    [{ path: 'phones/compare/', tab: 'טלפונים' }].concat(CAT_LIVE).map(function (c) {
      var here = CAT ? c.path === CAT.path : c.path === 'phones/compare/';
      return '<a href="/' + c.path + '"' + (here ? ' aria-current="page"' : '') + '>' + esc(c.tab) + '</a>';
    }).join('') + '</nav>';
  /* < ולא <: מחרוזת שמכילה סוגר סקריפט בתוך <script> סוגרת אותו */
  var json = function (o) { return JSON.stringify(o).replace(/</g, '\\u003c'); };
  /* הכרטיס נכתב גם כאן ולא רק ב-JS, כדי שהמסגרת תיראה לפני שהנתונים נטענים. renderCards מחליף אותו. */
  var card = function (i) {
    return '        <button type="button" class="dopen cv-card empty" data-slot="' + i + '" aria-expanded="false" aria-controls="cvpick">' +
      '<span class="cv-dot" aria-hidden="true"></span><span class="cv-ct"><span class="cv-nm">בחרו דגם</span>' +
      '<span class="cv-meta">צד ' + ['א׳', 'ב׳', 'ג׳'][i] + '</span></span><span class="cv-act">בחירה</span></button>\n';
  };

  return openTag + '\n\n<div class="cv-app">\n' +
  '<section class="cv-top" aria-labelledby="h1">\n  <div class="wrap">\n' +
  '    <div class="cv-row1">\n      <h1 id="h1">' + esc(CAT ? CAT.h1 : 'השוואת מכשירים') + '</h1>\n      ' + catSwitch + '\n    </div>\n' +
  '    <p class="cv-sub">' + esc(CAT ? CAT.asub : 'המכשירים שיש לנו בחנות, וגם כמה שאיננו מוכרים והם כאן רק כדי שיהיה מול מה להשוות. המפרט לקוח מאתרי היצרנים.') + '</p>\n' +
  '    <div class="cv-cards">\n' + card(0) +
  '        <button type="button" class="cv-flip" id="cvflip" aria-label="מול, החלפת צדדים" title="החלפת צדדים" disabled>מול<svg class="cv-swap" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 7h11l-3-3M17 17H6l3 3"></path></svg></button>\n' + card(1) +
  /* הצד השלישי, מוסתר עד שמבקשים אותו. ההסרה היא כפתור אח ולא בתוך הכרטיס, כי כפתור בתוך כפתור אינו HTML תקין. */
  '        <span class="cv-vs3" id="cvvs3" aria-hidden="true" hidden>מול</span>\n' +
  '        <div class="cv-c3" id="cvc3" hidden>\n' + card(2) +
  '          <button type="button" class="cv-drop" id="cvdrop" aria-label="הסרת הדגם השלישי מההשוואה">&times;</button>\n        </div>\n' +
  '    </div>\n' +
  '    <button type="button" class="cv-add" id="cvadd" hidden>+ הוספת דגם שלישי</button>\n' +
  '    <p class="cv-sug" id="cvsug" hidden></p>\n' +
  '  </div>\n</section>\n' +
  /* הפס הלבן עם שני השמות. hidden עד שיש זוג. */
  '<section class="block" id="pick" aria-label="ההשוואה">\n  <div class="wrap">\n' +
  '    <div class="cv-pick" id="cvpick" role="region" aria-labelledby="cvpick-h" hidden>\n' +
  '      <div class="cv-ph">\n        <h2 id="cvpick-h">בחירת דגם</h2>\n' +
  '        <div class="dfind">\n' +
  '          <svg class="dfico" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2"></circle>' +
  '<path d="M13.4 13.4 18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>\n' +
  '          <label class="a11y-sr" for="dq">סינון לפי שם דגם</label>\n' +
  '          <input id="dq" type="search" autocomplete="off" placeholder="סינון לפי שם" aria-describedby="dqh">\n' +
  '          <span class="a11y-sr" id="dqh" role="status"></span>\n' +
  '        </div>\n' +
  '        <button type="button" class="cv-x" aria-label="סגירת הבורר">&times;</button>\n' +
  '      </div>\n' +
  '      <div class="cv-list" id="dpick" role="group" aria-labelledby="cvpick-h">\n' +
  brands.map(function (b) {
    var L = BRAND_LOGO[b.brand] || null;
    return '        <div class="dgrp">\n          <p class="dbrand">' + (L ? '<img class="blogo blogo-' + L[0] + '" src="/logos/' + L[0] +
      '.png" alt="" width="' + L[1] + '" height="' + L[2] + '" loading="lazy" decoding="async">' : '') +
      esc(b.brand) + '</p>\n          <ul class="dpick">\n' +
      b.items.map(function (d) {
        /* data-q מחזיק שם לועזי, שם עברי ומותג יחד, ולכן גם "אייפון" וגם iphone מסננים */
        return '            <li><button type="button" class="dchip" data-slug="' + esc(d.slug) +
          '" data-q="' + esc(d.name + ' ' + (d.name_he || '') + ' ' + d.brand + ' ' + (BRAND_HE[d.brand] || '')) +
          '" aria-pressed="false">' + ltr(d.name) + '</button></li>';
      }).join('\n') + '\n          </ul>\n        </div>';
  }).join('\n') + '\n      </div>\n' +
  '      <p class="dnone" id="dnone" hidden>אין דגם בשם הזה. נקו את הסינון כדי לראות את כל הרשימה.</p>\n' +
  '    </div>\n' +
  /* לא aria-live: render מחליף את כל תת-העץ. ההכרזה על "מה חשוב לכם" יושבת ב-#cvstatus. */
  '    <div id="dout">\n' +
  (CAT
    ? '      <p class="dempty">כאן יופיעו ההבדלים. הכלי צריך JavaScript כדי לעבוד.</p>\n'
    : '      <p class="dempty">כאן יופיעו ההבדלים. אם JavaScript כבוי, ' +
      '<a href="/compare/">מרכז ההשוואות</a> מכיל את ההשוואות המוכנות בלי צורך בכלי.</p>\n') +
  '    </div>\n  </div>\n</section>\n</div>\n\n' +

  /* השוואות מוכנות בקטגוריה, כקישורים סטטיים. הכלי noindex,follow, ולכן גוגל עוקב אחריהם. */
  (CAT && (db._comparisons.pairs || []).length
    ? '<section class="block" id="ready" aria-labelledby="ready-h">\n  <div class="wrap box">\n' +
      '    <h2 id="ready-h">השוואות מוכנות</h2>\n' +
      '    <ul class="hub">\n' + db._comparisons.pairs.map(function (p) {
        return '      <li><a href="/compare/' + p.slug + '/"><b>' + esc(p.h1) + '</b></a></li>';
      }).join('\n') + '\n    </ul>\n' +
      '  </div>\n</section>\n\n'
    : '') +

  '<section class="block" id="how" aria-labelledby="how-h">\n  <div class="wrap box dhow">\n' +
  '    <h2 id="how-h" class="a11y-sr">איך הכלי עובד</h2>\n' +
  '    <details>\n      <summary>איך הכלי מחשב את ההבדלים</summary>\n' +
  (CAT
    ? '      <p>' + esc(CAT.how) + '</p>\n'
    : '      <p>רשימת השדות השונים בכל זוג מחושבת מראש, מאותו קוד שבונה את עמודי ההשוואה הקבועים. לכן הכלי והעמודים לא יכולים להגיד שני דברים שונים על אותם שני דגמים.</p>\n') +
  '      <p>שדה שאף אחד מהיצרנים אינו מפרסם אינו נחשב הבדל ואינו מוצג. שדה שרק יצרן אחד מפרסם כן מוצג, והצד השני מסומן כלא מפורסם.</p>\n' +
  '      <p>"מה חשוב לכם" מסדר את התחומים ואינו מסתיר אף הבדל: מה שלא בחרתם מתקפל תחת כפתור אחד.</p>\n' +
  '    </details>\n' +
  '    <details>\n      <summary>למה אין כאן מחיר, ואין הכרזה מי טוב יותר</summary>\n' +
  '      <p>המחיר משתנה, ולכן תקבלו אותו מאיתנו. וההחלטה מה עדיף תלויה במה שחשוב לכם, ולכן הכלי מראה את ההבדלים בלי להכריז על מנצח. על ההחלטה נעבור איתכם.</p>\n' +
  '    </details>\n' +
  '    <p class="aside"><a href="/compare/">ההשוואות המוכנות</a> כוללות גם פסקה על מה שונה ולמי עדיף כל אחד. ' + (CAT ? '' : '<a href="/phones/">כל המכשירים</a> עם המפרט המלא.') + '</p>\n' +
  '  </div>\n</section>\n\n' +

  '<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
  /* בכלי קטגוריה איננו יודעים אילו דגמים בחנות. שאלה, לא הבטחה. */
  (CAT
    ? '    <h2 id="cta-h">רוצים לדעת מה יש אצלנו?</h2>\n' +
      '    <p>שאלו אותנו אילו מ' + CAT.plural + ' האלה יש בחנות, ונעבור איתכם על מה שחשוב לכם. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n'
    : '    <h2 id="cta-h">רוצים לראות אותם ביד?</h2>\n' +
      '    <p>המכשירים אצלנו בחנות, ואפשר להחזיק ולהשוות. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n') +
  '    <div class="row">\n' +
  '      <a class="btn btn-wa" href="' + waPick + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">עזרו לי לבחור</a>\n' +
  '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
  '      <a class="btn btn-teal" href="/compare/">ההשוואות המוכנות</a>\n' +
  '    </div>\n' +
  '    <p class="fine">הייעוץ והליווי בבחירה ללא עלות וללא התחייבות.</p>\n' +
  '  </div>\n</section>\n\n' +

  /* הנתונים לפני הקוד. PAIRS נכתב כליטרל ולא כמחרוזת ל-JSON.parse, וזו בחירה שנמדדה ב-18.8.2026. */
  '<script>\n(function(){\n"use strict";\n' +
  'var PAIRS=' + json(index) + ';\n' +
  'var ORDER=' + json(order) + ';\n' +
  'var TRAITS=' + json(TRAITS) + ';\n' +
  'var TDEF=' + json(CAT ? [] : TDEF) + ';\n' +
  'var MEANS=' + json(MEANS) + ';\n' +
  'var READY=' + json(READY) + ';\n' +
  'var CFG=' + json(CFG) + ';\n' +
  TOOL_CLIENT + '\npgCompareMain();\n})();\n' +
  '</scr' + 'ipt>\n\n';
}

var made = 0, swGrew = false;
db._comparisons.pairs.forEach(function (p) {
  if (only && p.slug !== only) return;
  var a = D(p.a), b = D(p.b);
  if (!a || !b) { console.error('✗ ' + p.slug + ': דגם חסר'); process.exit(1); }
  var url = PROD + 'compare/' + p.slug + '/';
  var h = src;

  /* meta_description, כשיש, מחליף רק את תגיות ה-meta. שדה description נשאר
     ב-Article JSON-LD, כדי ששינוי CTR לא ישנה את הסכימה. */
  var metaDesc = p.meta_description || p.description;
  h = swap(h, /<title>[\s\S]*?<\/title>/, '<title>' + esc(p.title) + '</title>', '<title>', p.slug);
  h = swap(h, /(<meta name="description" content=")[^"]*(">)/, '$1' + esc(metaDesc) + '$2', 'description', p.slug);
  h = swap(h, /(<link rel="canonical" href=")[^"]*(">)/, '$1' + url + '$2', 'canonical', p.slug);
  h = swap(h, /(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(p.title) + '$2', 'og:title', p.slug);
  h = swap(h, /(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(metaDesc) + '$2', 'og:description', p.slug);
  h = swap(h, /(<meta property="og:url" content=")[^"]*(">)/, '$1' + url + '$2', 'og:url', p.slug);
  h = swap(h, /(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + esc(p.title) + '$2', 'twitter:title', p.slug);
  h = swap(h, /(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + esc(metaDesc) + '$2', 'twitter:desc', p.slug);

  /* מוחקים קודם, מזריקים אחר כך. אותה מלכודת שהפילה את פירורי הלחם של עמודי המכשיר:
   * הבלוק החדש מוזרק במקום Product, שיושב לפני ה-BreadcrumbList של המקור, ולכן מחיקה
   * אחרי ההזרקה מוחקת את החדש. שום בדיקה לא תופסת את זה כי מספר הרמות זהה. */
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\s*/, '');
  /* עמודי המכשיר חדלו לשאת Product ברמת העמוד: גוגל דורשת offers, review או aggregateRating,
   * ואין מחירון באתר, ולכן הישות נפלטת רק כשיש מחיר. המחולל הזה נשען על קיומו של אותו בלוק
   * כיעד להחלפה, ולכן הוא נפל על כל זוג. ההזרקה אינה תלויה בו יותר: אם הוא קיים הוא מוסר,
   * ובכל מקרה הסכימה נכנסת לפני </head>. */
  var cmpSchema = schema(p, a, b, url)
    .map(function (o) { return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>'; }).join('\n');
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>\s*/, '');
  if (h.indexOf('</head>') < 0) { console.error('✗ ' + p.slug + ': לא נמצא </head> להזרקת הסכימה'); process.exit(1); }
  h = h.replace('</head>', cmpSchema + '\n</head>');
  /* חגורה: אם סדר ההזרקה יישבר שוב, זה ייפול כאן ולא ישקוט */
  if (h.indexOf('"name":"השוואות"') < 0) { console.error('✗ ' + p.slug + ': פירור הלחם אינו מצביע ל-/compare/'); process.exit(1); }
  /* Product ברמת העמוד, כלומר בלוק שנפתח בו. בתוך about של ה-Article יש Product מקונן לכל
   * אחד משני הדגמים, וזה נכון ומכוון, ולכן הבדיקה עוגנת ל-@context שפותח בלוק. */
  if (/\{"@context":"https:\/\/schema\.org","@type":"Product"/.test(h)) {
    console.error('✗ ' + p.slug + ': נשאר Product ברמת העמוד. עמוד השוואה אינו מוצר'); process.exit(1);
  }

  var CSS_ANCHOR = '.ghero .btn-hero{white-space:normal;text-align:center}';
  if (h.indexOf(CSS_ANCHOR) < 0) { console.error('✗ ' + p.slug + ': לא נמצא עוגן ה-CSS'); process.exit(1); }
  /* אותו גיליון כמו הכלי, כדי ששני המקומות ייראו כמו מוצר אחד */
  h = h.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' + CSS + '\n' + APP_CSS + (p.hero_cta ? '\n' + HERO_CTA_CSS : ''));

  var d = diffSpec(a, b, p.slug);
  if (!d.rows.length) { console.error('✗ ' + p.slug + ': אין אף שדה שונה. אין מה להשוות'); process.exit(1); }

  var mS = h.indexOf('<main id="main"'), mE = h.indexOf('</main>');
  var openTag = h.slice(mS, h.indexOf('>', mS) + 1);
  h = h.slice(0, mS) + buildMain(p, a, b, d, openTag) + h.slice(mE);

  var out = path.join(PROTO, 'compare', p.slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);

  var swPath = path.join(PROTO, 'sw.js'), entry = "'/compare/" + p.slug + "/'";
  var sw = fs.readFileSync(swPath, 'utf8');
  if (sw.indexOf(entry) < 0) { fs.writeFileSync(swPath, sw.replace('const SHELL = [', 'const SHELL = [' + entry + ', ')); swGrew = true; }

  var svcPath = path.join(PROTO, 'services.json');
  try {
    var svc = JSON.parse(fs.readFileSync(svcPath, 'utf8'));
    svc.existing = svc.existing || [];
    var pageUrl = '/compare/' + p.slug + '/';
    var name = (a.name_he || a.name) + ' מול ' + (b.name_he || b.name);
    var row = svc.existing.filter(function (x) { return x.url === pageUrl; })[0];
    if (row) { row.name = name; row.status = 'review'; }
    else { svc.existing.push({ url: pageUrl, name: name, status: 'review' }); }
    fs.writeFileSync(svcPath, JSON.stringify(svc, null, 2) + '\n');
  } catch (e) { console.error('⚠ ' + p.slug + ': לא ניתן לעדכן services.json'); }

  made++;
  console.log('✓ compare/' + p.slug + '/  [טסטים בלבד]');
  console.log('   ' + d.rows.length + ' שדות שונים · ' + d.same + ' זהים' +
    (d.missing ? ' · ' + d.missing + ' שדות שרק אחד היצרנים מפרסם' : ''));
});

if (softDiffs.length) {
  console.error('\n⚠ שדות שנחשבו זהים רק אחרי נרמול. זו אי-עקביות בניסוח ב-devices.json, לא הבדל בין המכשירים.');
  console.error('  לאחד את הניסוח, אחרת השוואה עתידית תדווח על הבדל שאינו קיים:');
  softDiffs.forEach(function (s) { console.error('  · ' + s); });
}

/* ------------------------------------------------------- מרכז ההשוואות */
if (!only && !CAT) {
  var hubDir = path.join(PROTO, 'compare');
  var hubPath = path.join(hubDir, 'index.html');
  var pairs = db._comparisons.pairs;
  var hubUrl = PROD + 'compare/';
  /* כמה מההשוואות כוללות דגם שאיננו מוכרים. עד 18.8.2026 העמוד הצהיר "כולן בין דגמים שיש
     לנו בחנות", וזה היה נכון עד שנוספו השוואות מול מכשירי ייחוס, ומאז זה היה לא נכון בשלוש
     מתוך 19. הספירה נגזרת מהנתונים כדי שהמשפט יתקן את עצמו, ולא יישאר משפט קשיח ליד מספר
     דינמי כמו שהיה. */
  var refSlugs = {}, allSlugs = {};
  db.devices.forEach(function (d) {
    allSlugs[d.slug] = 1;
    if (d.status === 'reference') refSlugs[d.slug] = 1;
  });
  /* שער: שני הצדדים של כל זוג חייבים להיות slug מוכר. בלעדיו טעות בשם השדה מחזירה אפס
     בשקט, וזה קרה לי: ניגשתי ל-p[0] במקום ל-p.a, הספירה יצאה אפס, המשפט השגוי נשאר בעמוד,
     וההרצה דיווחה הצלחה. ספירה שיכולה לצאת אפס בטעות חייבת שער, לא תיקון. */
  pairs.forEach(function (p) {
    if (!allSlugs[p.a] || !allSlugs[p.b]) {
      console.error('✗ זוג השוואה עם צד שאינו slug מוכר: ' + JSON.stringify([p.a, p.b]) +
        ' (' + (p.slug || 'בלי slug') + '). אם מבנה _comparisons.pairs השתנה, עדכן את הספירה כאן.');
      process.exit(1);
    }
  });
  var refPairs = pairs.filter(function (p) { return refSlugs[p.a] || refSlugs[p.b]; }).length;
  /* נקבה, כי "השוואות" נקבה. מעל עשר נופל לספרות במקום להמציא מילים ארוכות. */
  var FEM = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
  var refWord = refPairs <= 10 ? FEM[refPairs] : String(refPairs);
  /* השוואות השעונים נבנות במצב --watches מ-watches.json, ומוצגות כאן במקטע משלהן כדי שיהיה
     אליהן קישור מתוך תוכן ולא רק מהתפריט. נקרא מהקובץ ולא מועתק, כדי שלא ייפרד. הספירה בכותרת
     כוללת אותן: עד 24.9.2026 הכותרת אמרה 22 כשהעמוד הציג 27. */
  var catPairs = CAT_LIVE.map(function (c) {
    var j = JSON.parse(fs.readFileSync(path.join(PROTO, c.file), 'utf8'));
    return { cat: c, pairs: (j._comparisons && j._comparisons.pairs) || [] };
  }).filter(function (x) { return x.pairs.length; });
  var wp = [].concat.apply([], catPairs.map(function (x) { return x.pairs; }));
  var hubTitle = (wp.length ? 'השוואות טלפונים, שעונים ואוזניות: ' : 'השוואות מכשירים: ') + (pairs.length + wp.length) + ' השוואות | פון גת';
  var hubDesc = (refPairs
    ? 'השוואות בין דגמים, לפי המפרט שהיצרנים מפרסמים. חלקן מול דגם שאיננו מוכרים, כדי שיהיה מול מה להשוות.'
    : 'השוואות בין דגמים שנמכרים אצלנו, לפי המפרט שהיצרנים מפרסמים.') +
    ' רק מה שונה, בלי הכרזת מנצח, ובלי מפרט מומצא. פון גת קרית גת.';

  /* המרכז נבנה מעמוד השוואה כדי לרשת ממנו את ה-CSS, כולל .hub */
  var hh = fs.readFileSync(path.join(PROTO, 'compare', pairs[0].slug, 'index.html'), 'utf8');
  hh = hh.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(hubTitle) + '</title>');
  hh = hh.replace(/(<meta name="description" content=")[^"]*(">)/, '$1' + esc(hubDesc) + '$2');
  hh = hh.replace(/(<link rel="canonical" href=")[^"]*(">)/, '$1' + hubUrl + '$2');
  hh = hh.replace(/(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(hubTitle) + '$2');
  hh = hh.replace(/(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(hubDesc) + '$2');
  hh = hh.replace(/(<meta property="og:url" content=")[^"]*(">)/, '$1' + hubUrl + '$2');
  hh = hh.replace(/(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + esc(hubTitle) + '$2');
  hh = hh.replace(/(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + esc(hubDesc) + '$2');

  hh = hh.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\s*/, '');
  var hubSchema = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'השוואות מכשירים', description: hubDesc,
      url: hubUrl, publisher: { '@id': PROD + '#business' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: PROD },
      { '@type': 'ListItem', position: 2, name: 'השוואות', item: hubUrl }
    ] },
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: pairs.concat(wp).map(function (p, i) {
      return { '@type': 'ListItem', position: i + 1, name: p.h1, url: PROD + 'compare/' + p.slug + '/' };
    }) }
  ];
  hh = hh.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Article"[\s\S]*?<\/script>/,
    hubSchema.map(function (o) { return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>'; }).join('\n'));

  var mS2 = hh.indexOf('<main id="main"'), mE2 = hh.indexOf('</main>');
  var openTag2 = hh.slice(mS2, hh.indexOf('>', mS2) + 1);
  var hubMain = openTag2 + '\n\n' +
    '<section class="ghero" aria-labelledby="h1">\n  <div class="wrap">\n    <div class="inner">\n' +
    '      <h1 id="h1">השוואות בין דגמים</h1>\n' +
    '      <p class="sub">' + (wp.length ? (function () {
      /* "22 השוואות טלפונים, 5 של שעונים חכמים ו-6 של אוזניות" */
      var parts = [pairs.length + ' השוואות טלפונים'].concat(catPairs.map(function (x) { return x.pairs.length + ' של ' + x.cat.noun; }));
      return parts.slice(0, -1).join(', ') + ' ו-' + parts[parts.length - 1];
    })() : pairs.length + ' השוואות') +
    (refPairs
      ? '. ב' + refWord + ' מ' + (wp.length ? 'השוואות הטלפונים' : 'הן') + ' אחד הדגמים אינו נמכר אצלנו, והוא שם רק כדי שיהיה מול מה להשוות'
      : ', כולן בין ' + (wp.length ? 'טלפונים' : 'דגמים') + ' שיש לנו בחנות') +
    '. בכל אחת רק השדות שבהם שני הדגמים באמת שונים, לפי המפרט שהיצרן מפרסם. אין כאן הכרזת מנצח, כי חנות שמכריזה מנצח מוכרת את המנצח.</p>\n' +
    '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + wa('היי, אני מתלבט בין שני דגמים ואשמח לעזרה') + '">' +
    '<img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">עזרו לי לבחור</a></div>\n' +
    '      <p class="meta">\n        <span>המפרטים מאתרי היצרנים</span>\n        <span>רק מה שונה</span>\n' +
    '        <span>בלי הכרזת מנצח</span>\n        <span>ייעוץ ללא עלות</span>\n      </p>\n    </div>\n  </div>\n</section>\n\n' +

    /* כרטיסי הקטגוריות. קישורי עוגן לאותו עמוד, לא עמודים חדשים. רכיב .hub הקיים, בלי CSS חדש. */
    '<section class="block" id="cats" aria-labelledby="h-cats">\n  <div class="wrap box">\n' +
    '    <h2 id="h-cats">לפי קטגוריה</h2>\n' +
    '      <ul class="hub">\n' +
    '        <li><a href="#list"><b>השוואות טלפונים</b><span>' + pairs.length + ' השוואות בין הדגמים שבאתר</span></a></li>\n' +
    catPairs.map(function (x) {
      return '        <li><a href="#' + x.cat.key + '"><b>' + esc(x.cat.hubH) + '</b><span>' + x.pairs.length + ' השוואות ' + esc(x.cat.card) + '</span></a></li>\n';
    }).join('') +
    '      </ul>\n' +
    '  </div>\n</section>\n\n' +

    '<section class="block" id="list" aria-labelledby="h-list">\n  <div class="wrap box">\n' +
    '    <h2 id="h-list">השוואות טלפונים</h2>\n' +
    '    <p class="lead">אם ההשוואה שאתם מחפשים אינה כאן, שלחו לנו את שני הדגמים ונעבור עליהם איתכם.</p>\n' +
    '      <ul class="hub">\n' +
    pairs.map(function (p) {
      var a = D(p.a), b = D(p.b);
      var d = diffSpec(a, b, p.slug);
      return '        <li><a href="/compare/' + p.slug + '/"><b>' + esc((a.name_he || a.name) + ' מול ' + (b.name_he || b.name)) + '</b>' +
        '<span>' + d.rows.length + ' שדות שונים · ' + sameTxt(d.same) + '</span></a></li>';
    }).join('\n') + '\n      </ul>\n' +
    /* "מתוך השנים עשר" קפא כאן מאז שהיו 12 דגמים, והכלי מחזיק היום יותר מ-80. המספר הוסר ב-24.9.2026
       ולא עודכן, כי מספר בפרוזה הוא עותק שני של נתון שחי במאגר. */
    '    <p class="aside">הזוג שאתם מחפשים אינו כאן? <a href="/phones/compare/">בכלי ההשוואה</a> אפשר לבחור כל שני דגמים מהמאגר, או שלושה.</p>\n' +
    '    <p class="aside">ואם הדגם עצמו לא אצלנו באתר, <a href="' + wa('היי, אשמח להשוואה בין שני דגמים שלא מופיעים באתר') + '">שלחו לנו את שני הדגמים ב-WhatsApp</a>.</p>\n' +
    '  </div>\n</section>\n\n' +

    /* מקטע לכל קטגוריה, מ-catPairs שנקרא למעלה. ה-id הוא מפתח הקטגוריה, ולכן לשעונים הוא נשאר watches */
    catPairs.map(function (x) {
      var c = x.cat;
      return '<section class="block" id="' + c.key + '" aria-labelledby="h-' + c.key + '">\n  <div class="wrap box">\n' +
        '    <h2 id="h-' + c.key + '">' + esc(c.hubH) + '</h2>\n' +
        '    <p class="lead">' + esc(c.hubLead) + ' <a href="/' + c.path + '">' + c.link.replace(/^ל/, 'ב') + '</a> אפשר לבחור ' + c.any + '.</p>\n' +
        '      <ul class="hub">\n' +
        x.pairs.map(function (p) {
          return '        <li><a href="/compare/' + p.slug + '/"><b>' + esc(p.h1) + '</b></a></li>';
        }).join('\n') + '\n      </ul>\n' +
        '  </div>\n</section>\n\n';
    }).join('') +

    '<section class="block" id="how" aria-labelledby="h-how">\n  <div class="wrap box">\n' +
    '    <h2 id="h-how">איך בנויות ההשוואות כאן</h2>\n' +
    '    <div class="prose">\n' +
    '      <p>הנתונים בטבלאות מגיעים מאתר היצרן, ומתחת לכל טבלה כתוב מאיזה עמוד ומאיזה תאריך. כשהיצרן אינו מפרסם נתון פיזי קבוע, כמו משקל או בהירות, הוא נלקח לפעמים ממאגר מפרטים מוכר, וזה כתוב באותה שורה. שדה שאין לו מקור מסומן כלא מפורסם, ולא מנוחש.</p>\n' +
    '      <p>הטבלה מציגה רק שדות שבהם שני הדגמים שונים. אם עשרים שדות זהים בשניהם, אין טעם להציג אותם, וההצגה שלהם רק מסתירה את מה שכן שונה. מספר השדות הזהים מופיע בכל עמוד.</p>\n' +
    '      <p>בכל השוואה יש מקטע "למי עדיף כל אחד", ואין בשום עמוד קביעה מי המכשיר הטוב יותר. גם אין מחירים בטבלאות. את המחיר תקבלו מאיתנו, והוא משתנה.</p>\n' +
    '    </div>\n' +
    '    <p class="aside"><a href="/phones/">כל המכשירים עם המפרט המלא</a>, ו<a href="/guides/official-vs-parallel-import/">המדריך על יבוא רשמי מול מקביל</a>.</p>\n' +
    '  </div>\n</section>\n\n' +

    '<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
    '    <h2 id="cta-h">מתלבטים בין שני דגמים?</h2>\n' +
    '    <p>תגידו לנו בין מה למה, ומה חשוב לכם. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n' +
    '    <div class="row">\n' +
    '      <a class="btn btn-wa" href="' + wa('היי, אני מתלבט בין שני דגמים ואשמח לעזרה') + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">עזרו לי לבחור</a>\n' +
    '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
    '      <a class="btn btn-teal" href="/phones/">כל המכשירים</a>\n' +
    '    </div>\n' +
    '    <p class="fine">הייעוץ והליווי בבחירה ללא עלות וללא התחייבות.</p>\n' +
    '  </div>\n</section>\n\n';

  hh = hh.slice(0, mS2) + hubMain + hh.slice(mE2);
  fs.writeFileSync(hubPath, hh);
  console.log('✓ /compare/ נבנה: ' + pairs.length + ' השוואות טלפונים ו-' + wp.length + ' של שאר הקטגוריות, ברשימה וב-ItemList');

  var swPath2 = path.join(PROTO, 'sw.js'), sw2 = fs.readFileSync(swPath2, 'utf8');
  if (sw2.indexOf("'/compare/'") < 0) { fs.writeFileSync(swPath2, sw2.replace('const SHELL = [', "const SHELL = ['/compare/', ")); swGrew = true; }
  try {
    var svc2 = JSON.parse(fs.readFileSync(path.join(PROTO, 'services.json'), 'utf8'));
    if (!svc2.existing.filter(function (x) { return x.url === '/compare/'; }).length) {
      svc2.existing.push({ url: '/compare/', name: 'מרכז ההשוואות' });
      fs.writeFileSync(path.join(PROTO, 'services.json'), JSON.stringify(svc2, null, 2) + '\n');
    }
  } catch (e) {}

  buildTool();
}
if (CAT) buildTool();

/* ============================================ D3.1 — הכלי ב-/phones/compare/
 *
 * הבעיה ההנדסית כאן אינה הממשק אלא הכפילות. חישוב ההבדלים חי ב-diffSpec, ב-Node. כלי שמריץ
 * את אותו חישוב בדפדפן פירושו עותק שני של האלגוריתם, ומתוך השבוע הזה כבר יש שלוש דוגמאות
 * למה שקורה לעותק שני: ה-CSS של .hub לא נסע שלוש פעמים, וטבלת התוויות כמעט התפצלה. עותק
 * שני של האלגוריתם היה גרוע יותר מכולם, כי הוא לא נראה: הכלי היה מציג הבדל שהעמוד הסטטי
 * לא מציג, ואף בדיקה לא הייתה תופסת את זה.
 *
 * הפתרון: המחולל מחשב מראש את כל 66 הזוגות, ומטמיע **רק את שמות השדות שנמצאו שונים**.
 * הערכים עצמם נשלפים מ-devices.json בזמן ריצה, כמו שהפאנל שולף services.json. כלומר
 * ההחלטה מה שונה נשארת במקום אחד, והדפדפן רק מציג את התוצאה שלה.
 *
 * שלושה מכשירים נתמכים בלי חישוב חדש: שדה שונה בין שלושה אם ורק אם הוא שונה באחד הזוגות,
 * ולכן איחוד של שלוש קבוצות מוטמעות נותן את התשובה המדויקת. זו אריתמטיקה של קבוצות ולא
 * אלגוריתם. זה עובד רק מפני שהפריסה היא מכשיר-כשורה: עמודה לכל מכשיר הייתה נשברת בשלושה.
 */
function buildTool() {
  /* מכשירי ייחוס נכנסים גם הם לזוגות מאז 15.8.2026. אילו היו מופיעים בבורר בלי להיכנס לכאן,
     בחירה בהם הייתה נופלת ל"לא הצלחנו לחשב את ההשוואה הזאת" — כלומר תקלה שנראית כמו באג
     ולא כמו החלטה. 24 מכשירים הם 276 זוגות במקום 210. */
  var live = db.devices.filter(function (d) { return d.status !== 'draft'; }).map(function (d) { return d.slug; });
  /* התוויות ולא המפתחות, כי התווית היא מה שמוצג ומה שמקבץ. גם שומר על סדר הקטגוריות. */
  var order = [];
  GROUPS.forEach(function (g) { g[1].forEach(function (f) { order.push([g[0], f[1], f[0]]); }); });
  /* המדד שומר אינדקסים לתוך order ולא תוויות. תווית עברית היא כעשרה תווים, ומספר הזוגות
     גדל ריבועית במספר הדגמים: ב-24 דגמים המדד היה 77KB וב-30 הוא 117KB, וכ-50 דגמים היו
     מגיעים ל-370KB בעמוד אחד. האינדקס הוא גם מה שהלקוח באמת צריך, כי הוא המקום בשורה. */
  var LABEL_IX = {};
  order.forEach(function (r, i) { LABEL_IX[r[1]] = i; });
  var missingLabel = [];
  GROUPS.forEach(function (g) { g[1].forEach(function (f) { if (LABEL_IX[f[1]] === undefined) missingLabel.push(f[1]); }); });
  if (missingLabel.length) { console.error('✗ tool: תוויות בלי אינדקס: ' + missingLabel.join(', ')); process.exit(1); }
  /* המדד נכתב לעמוד כליטרל של אובייקט, ולא כמחרוזת ל-JSON.parse. זו בחירה נמדדת.
     מול 3003 זוגות ו-328KB, ב-18.8.2026: ליטרל 2.3ms מול JSON.parse 3.0ms בקימפול ובהרצה,
     והמחרוזת ל-JSON.parse גדולה ב-23KB אחרי הבריחה. כלומר האופטימיזציה שמקובלת למבני
     נתונים גדולים מזיקה כאן, כי V8 מקמפל ליטרלים היטב והבריחה עולה יותר ממה שהיא חוסכת.
     נמדד ונדחה. אל תמיר בלי למדוד מחדש.

     ובאותה מדידה, על משקל העמוד: 679KB על הדיסק אינם מה שעובר בקו. Vercel מגיש brotli,
     והורדה אמיתית היא 124KB. מה שגדל ריבועית הוא המקור, לא התעבורה. */
  var index = {}, n = 0;
  for (var i = 0; i < live.length; i++) {
    for (var j = i + 1; j < live.length; j++) {
      var a = D(live[i]), b = D(live[j]);
      var d = diffSpec(a, b, live[i] + '|' + live[j]);
      index[live[i] + '|' + live[j]] = { k: d.rows.map(function (r) { return LABEL_IX[r.label]; }).join('.'), s: d.same };
      n++;
    }
  }

  var url = PROD + 'compare/';                       /* canonical לעמוד הסטטי, לא לעצמו */
  var TOOL_PATH = CAT ? CAT.path : 'phones/compare/';
  var toolUrl = PROD + TOOL_PATH;
  var title = CAT ? CAT.title : 'השוואת מכשירים: בחרו שני דגמים | פון גת';
  var desc = CAT
    ? CAT.desc
    : 'כלי להשוואה בין שני דגמים או שלושה, מתוך המכשירים שיש לנו. רק השדות שבהם הם באמת שונים.';
  var h = src;

  h = swap(h, /<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>', '<title>', 'tool');
  h = swap(h, /(<meta name="description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'description', 'tool');
  /* canonical לעצמו, ו-noindex. התוכנית ביקשה canonical ל-/compare/, ובדיקה 6 ב-preflight
   * פסלה את זה בצדק: canonical לדף אחר יחד עם noindex הם שני סיגנלים סותרים. ה-canonical
   * אומר "אנדקס את הכתובת ההיא במקום", וה-noindex אומר "אל תאנדקס בכלל", וגוגל ממליץ
   * במפורש לא לשלב ביניהם. השילוב ההגיוני היה מתאים אם הכלי היה עותק של /compare/, והוא
   * לא: שם רשימה של שמונה השוואות מוכנות, וכאן בורר. תוכן אחר שלא רוצים לאנדקס, ולכן
   * noindex,follow עם canonical לעצמו. */
  h = swap(h, /(<link rel="canonical" href=")[^"]*(">)/, '$1' + toolUrl + '$2', 'canonical', 'tool');
  h = swap(h, /(<meta property="og:url" content=")[^"]*(">)/, '$1' + toolUrl + '$2', 'og:url', 'tool');
  h = swap(h, /(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(title) + '$2', 'og:title', 'tool');
  h = swap(h, /(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'og:desc', 'tool');
  h = swap(h, /(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + esc(title) + '$2', 'twitter:title', 'tool');
  h = swap(h, /(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'twitter:desc', 'tool');
  /* החלפה ולא הוספה מותנית. בהרצה הראשונה התנאי "אם אין robots" דילג, כי לעמוד המקור כבר
   * יש <meta name="robots" content="index,follow">. התוצאה: כלי שמצהיר index עם canonical
   * לדף אחר, וזה מה שבדיקה 6 תפסה. תנאי שמדלג בשקט גרוע מהיעדר תנאי. */
  if (/<meta name="robots"[^>]*>/.test(h)) {
    h = h.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,follow">');
  } else {
    h = h.replace(/(<link rel="canonical")/, '<meta name="robots" content="noindex,follow">\n  $1');
  }
  if (h.indexOf('content="noindex,follow"') < 0) { console.error('✗ tool: noindex לא נכנס'); process.exit(1); }

  /* אין Product ואין Article: זה כלי ולא תוכן. נשאר BreadcrumbList וה-#business. */
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\s*/, '');
  /* אותה סיבה כמו למעלה: עמוד המכשיר ששימש כתבנית כבר אינו נושא Product ברמת העמוד. */
  var toolCrumbs = '<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: PROD },
      { '@type': 'ListItem', position: 2, name: 'מכשירים', item: PROD + 'phones/' },
      { '@type': 'ListItem', position: 3, name: CAT ? CAT.crumb : 'השוואת מכשירים', item: toolUrl }
    ]
  }) + '\n</script>';
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>\s*/, '');
  if (h.indexOf('</head>') < 0) { console.error('✗ tool: לא נמצא </head> להזרקת הסכימה'); process.exit(1); }
  h = h.replace('</head>', toolCrumbs + '\n</head>');

  /* שער התנגשות שמות. .dbar נבחר כאן כשם למסגרת של הקונסולה, והוא כבר היה תפוס בגיליון
   * המשותף כפס ההשוואה בטבלה, בגובה שני פיקסלים. התוצאה: שורת הכותרת של הכלי נמעכה לשני
   * פיקסלים, המחולל רץ בירוק, והפריפלייט אישר. שם שמוגדר פעמיים אינו נראה בשום בדיקה
   * קיימת, כי שתי ההגדרות תקינות כל אחת בפני עצמה. לכן זה נבדק כאן, לפני ההזרקה. */
  /* השם שכלל *מגדיר* הוא זה שבסוף הסלקטור, ולא כל שם שמופיע בו. אבות הם הקשר: ב-
   * ‎.cmp-grid thead .blogo-google הכלל מגדיר את .blogo-google ונשען על .cmp-grid שכבר קיים,
   * וזה תקין. ב-.dapp .dhead הכלל מגדיר את .dhead, וזה מה שהשער בודק. ב-.dslots.two,
   * ה-two מסייג את .dslots ולכן העוגן הוא .dslots, ורק הוא נבדק: מרכיב נתלה על השם
   * הראשון שבו, וסייג שבא אחריו אינו הגדרה חדשה אלא וריאנט של אותו רכיב. */
  /* רשימת היתר מפורשת, ולא היוריסטיקה. אלה רכיבים שהעמוד הזה עצמו מרנדר, והם מוגדרים
   * בגיליון המשותף כי גם עמודי ההשוואה הכתובים משתמשים בהם. דריכה עליהם כאן היא עקיפה
   * מכוונת בהקשר אחד, לא הגדרה שנייה של אותו רכיב, וזה ההבדל שהשער אינו יכול לראות לבד.
   * כל שם שנוסף לכאן הוא החלטה שצריך להצדיק, וזו בדיוק הסיבה שזו רשימה ולא כלל חכם. */
  var SHARED_OVERRIDE = {
    '.cmp-wrap': 'מיכל הטבלה. הגלילה האופקית מבוטלת בטלפון כדי שהטבלה תיכנס למסך'
  };
  var mine = {}, clash = [];
  APP_CSS.split('\n').forEach(function (line) {
    var re = /(?:^|[{}])\s*([^{}@\n]+)\{/g, m;
    while ((m = re.exec(line)) !== null) {
      m[1].split(',').forEach(function (sel) {
        var parts = sel.replace(/[>+~]/g, ' ').trim().split(/\s+/);
        var subject = parts[parts.length - 1] || '';
        var anchor = (subject.match(/\.[a-z][a-z0-9-]*/g) || [])[0];
        if (anchor) mine[anchor] = 1;
      });
    }
  });
  /* ⚠ ה-script יורד מעמוד המקור לפני הבדיקה. השער שואל "האם השם הזה כבר **מוגדר**",
   * וסלקטור בתוך JS הוא **שימוש** ולא הגדרה. ב-13.9.2026 נוסף לעמודים בלוק מדידה
   * שכתוב בו closest('button.dopen') ו-closest('button.dchip'), והשער נפל עליו
   * והפסיק לבנות את הכלי. מדידה שקוראת מחלקה אינה מגדירה אותה מחדש, ואין כאן שום
   * התנגשות. אותה טעות בדיוק כמו בדיקה 31, שהשוותה CSS בלי להסיר הערות קודם. */
  var srcNoJs = src.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  Object.keys(mine).forEach(function (c) {
    if (SHARED_OVERRIDE[c]) return;
    var re = new RegExp('\\' + c + '(?![a-z0-9-])');
    if (re.test(CSS) || re.test(srcNoJs)) clash.push(c);
  });
  /* שער על השער: שם ברשימת ההיתר שאינו מוגדר בגיליון המשותף אינו עקיפה אלא שם חדש
   * שהתחפש לאחת, ואז ההיתר מסתיר בדיוק את מה שהשער בא לתפוס. */
  Object.keys(SHARED_OVERRIDE).forEach(function (c) {
    var re = new RegExp('\\' + c + '(?![a-z0-9-])');
    if (!re.test(CSS) && !re.test(src)) {
      console.error('✗ tool: ' + c + ' נמצא ברשימת ההיתר אך אינו מוגדר בגיליון המשותף. ' +
        'עקיפה של שם שאינו קיים היא שם חדש, ויש להסיר אותו מהרשימה.');
      process.exit(1);
    }
  });
  if (clash.length) {
    console.error('✗ tool: השמות ' + clash.join(', ') + ' כבר מוגדרים בגיליון המשותף או בעמוד המקור. ' +
      'שם שמוגדר פעמיים נראה תקין בשתי ההגדרות ונשבר רק במסך.');
    process.exit(1);
  }

  var CSS_ANCHOR = '.ghero .btn-hero{white-space:normal;text-align:center}';
  if (h.indexOf(CSS_ANCHOR) < 0) { console.error('✗ tool: לא נמצא עוגן ה-CSS'); process.exit(1); }
  h = h.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' + CSS + '\n' + TOOL_CSS);

  var mS = h.indexOf('<main id="main"'), mE = h.indexOf('</main>');
  var openTag = h.slice(mS, h.indexOf('>', mS) + 1);
  h = h.slice(0, mS) + toolMain(openTag, index, order, n) + h.slice(mE);

  /* מצב קטגוריה: הקוד בדפדפן זהה לשלושת הכלים, וההבדלים עוברים כנתונים ב-CFG ולא כהחלפות טקסט.
     עד 24.9.2026 היו כאן שמונה החלפות בתוך קוד מיוצר, וכל שינוי בכלי חייב לעדכן אותן. */
  if (CAT) {
    /* הקובץ הציבורי: רק מה שהכלי קורא, כמו devices-public.json */
    var pub = { _: 'נגזר מ-' + CAT.file + ' על ידי gen-compare.js ' + CAT.flag + '. אל תערוך ביד.',
      devices: db.devices.filter(function (d) { return d.status !== 'draft'; }).sort(T.newestFirst).map(function (d) {
        var o = { slug: d.slug, name: d.name, name_he: d.name_he || d.name, brand: d.brand, spec: d.spec };
        if (d.launch) o.launch = d.launch;
        /* ה-slug של העמוד, כדי שהכלי יקשר אליו. לא נתיב, כמו img בקובץ של הטלפונים. */
        if (PAGE_OF[d.slug]) o.page = PAGE_OF[d.slug];
        /* דגל ולא נתיב, כמו בקובץ של הטלפונים. הכלי בונה את הנתיב מ-page. */
        if (thumbSrc(d)) o.img = 1;
        return o;
      }) };
    fs.writeFileSync(path.join(PROTO, CAT.pub), JSON.stringify(pub) + '\n');
  }

  var out = path.join(PROTO, TOOL_PATH, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);
  console.log('✓ ' + TOOL_PATH + ' נבנה: ' + n + ' זוגות מחושבים מראש, ' + order.length + ' שדות');

  var swPath = path.join(PROTO, 'sw.js'), sw = fs.readFileSync(swPath, 'utf8');
  if (sw.indexOf("'/" + TOOL_PATH + "'") < 0) { fs.writeFileSync(swPath, sw.replace('const SHELL = [', "const SHELL = ['/" + TOOL_PATH + "', ")); swGrew = true; }
  try {
    var sp = path.join(PROTO, 'services.json'), svc = JSON.parse(fs.readFileSync(sp, 'utf8'));
    if (!svc.existing.filter(function (x) { return x.url === '/' + TOOL_PATH; }).length) {
      svc.existing.push({ url: '/' + TOOL_PATH, name: CAT ? CAT.crumb : 'כלי ההשוואה', status: 'review' });
      fs.writeFileSync(sp, JSON.stringify(svc, null, 2) + '\n');
    }
  } catch (e) {}
}

if (swGrew) {
  var swP = path.join(PROTO, 'sw.js'), swSrc = fs.readFileSync(swP, 'utf8');
  var m = swSrc.match(/const CACHE = 'pg-v(\d+)'/);
  if (!m) console.error('⚠ לא נמצא שם המטמון ב-sw.js — העלה ידנית');
  else {
    var next = 'pg-v' + (parseInt(m[1], 10) + 1);
    fs.writeFileSync(swP, swSrc.replace(m[0], "const CACHE = '" + next + "'"));
    console.log('✓ sw.js: המעטפת גדלה, שם המטמון עלה ל-' + next);
  }
}

console.log('\n' + made + ' עמודי השוואה נוצרו. הרצה: node .claude/preflight.js');
