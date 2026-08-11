#!/usr/bin/env node
/* PHONE GAT — מחולל השאלון ב-/phones/find-my-phone/  (D4)
 *
 *   node .claude/tools/gen-finder.js
 *
 * ============================================================================
 * העיקרון שקבע את כל העמוד: השאלות נגזרו מהנתונים, ולא הנתונים מהשאלות.
 * ============================================================================
 *
 * שאלון "איזה מכשיר מתאים לי" נכתב בדרך כלל לפי מה שנחמד לשאול, ואז מסננים איך שיוצא. כאן
 * נמדד קודם אילו תכונות בכלל נגזרות מ-12 הדגמים, והשאלות נבנו רק סביב מה שהמאגר תומך בו.
 * המדידה (6.8.2026) העלתה שלוש מגבלות אמיתיות, וכל אחת מהן שינתה את העמוד:
 *
 *   1. **מחיר.** אין. הוחלט ב-6.8 שאין מחירון באתר, כי הוא משתנה. שאלון בלי סינון תקציב
 *      נשמע חסר, אבל האלטרנטיבה היא להמציא. לכן שדה התקציב **נאסף ואינו מסנן**: הוא עובר
 *      לתוך הודעת ה-WhatsApp, כדי שברוך וסיגל יענו עליו במחירים אמיתיים. העמוד אומר את זה
 *      במפורש ולא מסתיר.
 *
 *   2. **סוללה מתפרסמת ביחידות שונות.** אפל מפרסמת שעות בלבד (5 דגמים), שיאומי mAh בלבד
 *      (3 דגמים), סמסונג את שניהם (4). **אין יחידה אחת שמכסה את 12.** דירוג לפי שעות היה
 *      מוציא בשקט את כל דגמי שיאומי, ולפי mAh את כל דגמי אפל. שאלון שמסתיר חצי מהמאגר לפי
 *      יחידת מדידה הוא שקר בהשמטה. לכן הדירוג נעשה **בתוך כל קבוצת יחידה בנפרד**, והעמוד
 *      מסביר למה.
 *
 *   3. **תאריך סיום לעדכוני אבטחה מתפרסם רק אצל סמסונג** (4 דגמים מ-12). זה נתון אמיתי
 *      וחשוב, ולכן הוא שאלה, אבל עם התווית הנכונה: לא "מי מתעדכן יותר" אלא "מי נוקב בתאריך".
 *
 * תכונות שנגזרות מ-12 מתוך 12 ולכן מותרות בלי הסתייגות: מערכת הפעלה, גודל מסך, משקל,
 * עדשה רחבה במיוחד, נפחי אחסון. חריץ זיכרון מזוהה **חיובית בלבד**: אפל וסמסונג אינן מפרסמות
 * "אין הרחבה", ולכן היעדר הנתון אינו הוכחה להיעדר החריץ.
 *
 * הגזירה יושבת כאן, בצד המחולל, ולא בדפדפן. אותו שיקול כמו בכלי ההשוואה: פענוח מחרוזות
 * מפרט בעברית ב-JS של העמוד היה עותק שני של לוגיקה, והוא היה שובר בשקט ברגע שניסוח בדגם
 * אחד ישתנה. כאן, אם ערך לא נפרש, המחולל **נופל** ואומר איזה דגם ואיזה שדה.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var PROD = 'https://www.phonegat.co.il/';
var SOURCE = 'phones/iphone-17/index.html';   /* מסגרת + ה-CSS של .cmp-spec */

var db = JSON.parse(fs.readFileSync(path.join(PROTO, 'devices.json'), 'utf8'));
var src = fs.readFileSync(path.join(PROTO, SOURCE), 'utf8');

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function wa(t) { return 'https://wa.me/97286812050?text=' + encodeURIComponent(t); }
function ltr(s) { return '<bdo dir="ltr">' + esc(s) + '</bdo>'; }
function swap(h, re, to, what) {
  if (!re.test(h)) { console.error('✗ finder: לא נמצא ' + what); process.exit(1); }
  return h.replace(re, to);
}
function json(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }

/* ---------------------------------------------------------------- גזירת התכונות
 *
 * כל הגזירות באות מ-lib/traits.js ואף אחת אינה נכתבת כאן שוב.
 *
 * הקובץ הזה החזיק עד 7.8.2026 עותק פרטי של num, פענוח הזום, זיהוי העדשה הרחבה וחריץ הזיכרון,
 * למרות שהתיעוד ב-traits.js מצהיר שהוא אחד משלושת הצרכנים שלו. שני העותקים הסכימו, ולכן שום
 * בדיקה לא תפסה — עד שהתברר שהם מסכימים גם על באג: העדשה הרחבה הייתה בינארית בשניהם, ולכן
 * התיקון היה צריך לקרות פעמיים ואיש לא היה יודע שהשני קיים. זה בדיוק מה ש-traits.js נוצר למנוע. */
var T = require('./lib/traits.js');

var live = db.devices.filter(function (d) { return d.status !== 'draft' && d.status !== 'reference' && d.status !== 'reference'; });
var fail = [];
var TRAITS = live.map(function (d) {
  var S = d.spec;
  var inch = T.inches(S);
  var grams = T.grams(S);
  var gb = T.storageGB(S);

  if (inch === null) fail.push(d.slug + '.screen_size');
  if (grams === null) fail.push(d.slug + '.weight');
  if (!gb.length) fail.push(d.slug + '.storage_offered');

  /* optX: מספר, או 'yes' כשהיצרן אומר אופטי בלי מקדם, או 0 כשהוא אומר דיגיטלי בלבד,
   * או null כשאין שורת זום. uw ו-sd תלת-מצביים מאותה סיבה. null אינו "אין", ולכן אינו
   * מעניש ואינו מתגמל. הנימוקים לשלוש הגזירות האלה יושבים ב-traits.js. */
  var optX = T.opticalZoom(S), zt = S.zoom || '';
  var uw = T.ultraWide(S);
  var sd = T.sdCard(S);

  return {
    slug: d.slug, name: d.name, name_he: d.name_he || d.name, brand: d.brand,
    ios: /^iOS/.test(d.os || '') ? 1 : 0,
    inch: inch, grams: grams,
    optX: optX, zoomTxt: S.zoom || null, uw: uw, sd: sd,
    minGB: Math.min.apply(null, gb), maxGB: Math.max.apply(null, gb),
    hrs: T.battHours(S),
    mah: T.battMah(S),
    updYear: T.updateYear(S)
  };
});
if (fail.length) {
  console.error('✗ תכונות שלא נגזרו, והשאלון לא ייבנה על ניחוש: ' + fail.join(', '));
  process.exit(1);
}

/* סוללה: דירוג בתוך כל קבוצת יחידה בנפרד, כי אין יחידה שמכסה את כולם.
 * "חזק" = השליש העליון של הקבוצה שלו. "חלש" = השליש התחתון. השאר ניטרלי.
 * דגם שמפרסם את שתי היחידות נכנס לשתי הקבוצות, ומספיק שאחת מהן תסמן אותו. */
function tercile(vals) {
  var s = vals.slice().sort(function (a, b) { return a - b; });
  var n = s.length;
  return { lo: s[Math.floor(n / 3)], hi: s[Math.ceil(n * 2 / 3) - 1] };
}
var hT = tercile(TRAITS.filter(function (t) { return t.hrs !== null; }).map(function (t) { return t.hrs; }));
var mT = tercile(TRAITS.filter(function (t) { return t.mah !== null; }).map(function (t) { return t.mah; }));
TRAITS.forEach(function (t) {
  var strong = (t.hrs !== null && t.hrs >= hT.hi) || (t.mah !== null && t.mah >= mT.hi);
  var weak = (t.hrs !== null && t.hrs <= hT.lo && t.mah === null) ||
             (t.mah !== null && t.mah <= mT.lo && t.hrs === null);
  t.batt = strong ? 1 : (weak ? -1 : 0);
  /* המחרוזת שתוצג כנימוק היא הערך של היצרן ולא פירוש שלנו */
  /* רווח לפני mAh, כמו בכל יחידה אחרת באתר. בלעדיו השאלון היה המקום היחיד שכותב 5500mAh
   * בזמן שכל 28 העמודים האחרים כותבים 5500 mAh, וזה בדיוק סוג האי-עקביות שנוצרת כשמחרוזת
   * נבנית בקוד במקום להיקרא מהמאגר. */
  t.battTxt = t.hrs !== null ? ('עד ' + t.hrs + ' שעות וידאו') : (t.mah !== null ? (t.mah + ' mAh') : null);
});

console.log('סוללה, ספי שליש: שעות ≥' + hT.hi + ' חזק, ≤' + hT.lo + ' חלש · mAh ≥' + mT.hi + ' חזק, ≤' + mT.lo + ' חלש');
console.log('  חזקים: ' + TRAITS.filter(function (t) { return t.batt === 1; }).map(function (t) { return t.slug; }).join(', '));
console.log('  חלשים: ' + TRAITS.filter(function (t) { return t.batt === -1; }).map(function (t) { return t.slug; }).join(', '));

/* ---------------------------------------------------------------------- העמוד */
var url = PROD + 'phones/find-my-phone/';
var title = 'איזה מכשיר מתאים לי? שאלון קצר | פון גת';
/* "מכשיר מושלם" הוחלף, למרות שהוא הופיע בשלילה ("בלי הכרזה על"). ביקורת הכתיבה מסמנת את
 * המילה ולא את המשמעות, והיא צודקת לגבי המחרוזת. סימון אדום שידוע כשגוי מאמן להתעלם
 * מסימונים אדומים, ולכן עדיף לנסח מחדש מלאלף את הכלי לזהות שלילה. */
var desc = 'שבע שאלות, ובסוף שלושה דגמים שכדאי לבדוק, מתוך המכשירים שיש לנו. ההתאמה לפי המפרט של היצרן, ובלי להכריז על דגם אחד שמתאים לכולם.';

var h = src;
h = swap(h, /<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>', '<title>');
h = swap(h, /(<meta name="description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'description');
h = swap(h, /(<link rel="canonical" href=")[^"]*(">)/, '$1' + url + '$2', 'canonical');
h = swap(h, /(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(title) + '$2', 'og:title');
h = swap(h, /(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'og:desc');
h = swap(h, /(<meta property="og:url" content=")[^"]*(">)/, '$1' + url + '$2', 'og:url');
h = swap(h, /(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + esc(title) + '$2', 'twitter:title');
h = swap(h, /(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'twitter:desc');

/* השאלון כן מאונדקס: "איזה טלפון לקנות" הוא חיפוש אמיתי, והעמוד עונה עליו גם בלי למלא. */
h = h.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="index,follow">');

h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\s*/, '');
if (!/"@type":"Product"/.test(h)) { console.error('✗ finder: לא נמצא בלוק Product להחלפה'); process.exit(1); }
h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>/,
  ['<script type="application/ld+json">\n' + json({
    '@context': 'https://schema.org', '@type': 'WebPage', name: 'איזה מכשיר מתאים לי',
    description: desc, url: url, publisher: { '@id': PROD + '#business' }
  }) + '\n</script>',
   '<script type="application/ld+json">\n' + json({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: PROD },
      { '@type': 'ListItem', position: 2, name: 'מכשירים', item: PROD + 'phones/' },
      { '@type': 'ListItem', position: 3, name: 'איזה מכשיר מתאים לי', item: url }
    ]
  }) + '\n</script>'].join('\n'));
if (h.indexOf('"name":"מכשירים"') < 0) { console.error('✗ finder: פירור הלחם אינו מצביע ל-/phones/'); process.exit(1); }

var CSS_ANCHOR = '.ghero .btn-hero{white-space:normal;text-align:center}';
if (h.indexOf(CSS_ANCHOR) < 0) { console.error('✗ finder: לא נמצא עוגן ה-CSS'); process.exit(1); }

/* .hub נשלף מ-guides/index.html, המקום שבו הרכיב נולד. אותו לקח שלמדנו שלוש פעמים. */
function hubCss() {
  var g = fs.readFileSync(path.join(PROTO, 'guides/index.html'), 'utf8');
  var s = g.indexOf('.hub{list-style:none');
  if (s < 0) { console.error('✗ finder: לא נמצא ה-CSS של .hub'); process.exit(1); }
  var e = g.indexOf('\n\n', s);
  return g.slice(s, e < 0 ? s + 1400 : e);
}

var CSS = [
  '/* ===== השאלון ===== */',
  'fieldset{min-inline-size:0}',   /* ברירת המחדל היא min-content, ואז #fs-os לא מתכווץ וגולש 97px ב-200% */
  '.qwrap .btn,.qres .btn{white-space:normal}',
  '/* fieldset ולא div עם role: זה טופס אמיתי, והקבוצה של רדיו היא בדיוק מה ש-fieldset+legend',
  '   נועדו לו. הדפדפן וקורא המסך מקבלים את הקישור בין השאלה לתשובות בלי ARIA בכלל. */',
  '.qs{margin-top:2rem;display:grid;gap:0}',
  '.q{border-block-start:1px solid var(--line);padding-block:1.7rem;margin:0;border-inline:0;border-block-end:0}',
  '.q legend{padding:0;font-family:var(--serif);font-weight:400;font-size:clamp(1.18rem,2.1vw,1.42rem);color:var(--ink-strong);line-height:1.35}',
  '.q .why{margin:.5rem 0 0;color:var(--ink-soft);font-size:1rem;line-height:1.7;max-width:60ch}',
  '.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.1rem 1.6rem;margin-top:1.1rem}',
  '/* הרדיו עצמו מוסתר חזותית אך נשאר במיקוד ובעץ הנגישות. התווית היא יעד המגע, ולכן היא',
  '   זו שמקבלת 44px דרך padding. focus-visible יורש מהאינפוט כדי שניווט מקלדת ייראה. */',
  '.opts label{display:flex;align-items:baseline;gap:.6rem;padding-block:.85rem;cursor:pointer;line-height:1.6;border-block-start:1px solid var(--line)}',
  '.opts label:first-child,.opts label:nth-child(2){border-block-start:0}',
  '@media(max-width:640px){.opts label:nth-child(2){border-block-start:1px solid var(--line)}}',
  '.opts input{margin:0;flex:none;inline-size:1.05rem;block-size:1.05rem;accent-color:var(--teal);align-self:center}',
  '.opts label:has(input:checked){color:var(--ink-strong);font-weight:600}',
  '.opts input:focus-visible{outline:2px solid var(--teal);outline-offset:3px}',
  '/* התקציב: dir=ltr כי מספר בעברית מסודר מחדש על ידי אלגוריתם ה-bidi ו-3200 היה נראה הפוך */',
  '.budget{margin-block-start:1.1rem;display:flex;flex-wrap:wrap;gap:.7rem;align-items:center}',
  '.budget input{font-family:inherit;font-size:1.05rem;padding:.7rem .9rem;border:1px solid var(--ink-soft);border-radius:0;background:none;color:var(--ink-strong);min-inline-size:11rem;direction:ltr;text-align:start}',
  '.budget input:focus-visible{outline:2px solid var(--teal);outline-offset:2px}',
  '.err{margin:.7rem 0 0;color:#b03a2b;font-weight:600;font-size:1rem}',
  '/* המונה הרץ. sticky מתחת לכותרת האתר, כי בשאלון של שבע שאלות הוא נגלל מהמסך בדיוק',
  '   כשהוא הופך למעניין. בלי רקע צבוע: קו שערה למעלה ולמטה ורווח, כמו כל דבר אחר כאן. */',
  '@media print{html[class*="a11y-"] :is(header.site,nav.mbar,main,footer.site){filter:none !important}html[class*="a11y-text-"]{font-size:16px !important}}',
  '.q legend .req{font-family:var(--font);font-size:.98rem;font-weight:400;color:var(--ink-soft);margin-inline-start:.4rem}',
  '.qcount{position:sticky;inset-block-start:66px;z-index:60;margin:1.6rem 0 0;padding-block:.85rem;border-block:1px solid var(--line);background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-family:var(--serif);font-size:clamp(1.1rem,1.9vw,1.32rem);color:var(--ink-strong)}',
  '@media(max-width:980px){.qcount,.dstate{inset-block-start:0}}',   /* ההדר אינו דביק כאן, ולכן היסט של 66px היה משאיר רווח ריק */
  '.dhint{margin-block-start:1.5rem;border-block-start:1px solid var(--line);padding-block-start:1.3rem;color:var(--ink-soft);line-height:1.8}',
  '.q[data-bad="1"] legend{color:#b03a2b}',
  '.qgo{margin-block-start:2.2rem;display:flex;flex-wrap:wrap;gap:.9rem;align-items:center}',
  '.qgo .fine{margin:0}',
  '/* btn-sm הוא 36px ונמדד 36x112. יעד מגע צריך 44, וה-padding נושא אותו ולא min-height:',
  '   גובה מוצהר נאכל על ידי המסגרת ותיבת השורה ויוצא 43. אותו דפוס כמו .cookie .btn-sm. */',
  '.qgo .btn-sm{padding-block:.78rem}',
  '/* תווית התקציב נמדדה 30px. היא לא פסקה רצה אלא תווית של שדה, ולחיצה עליה ממקדת את',
  '   השדה, ולכן היא יעד מגע לכל דבר וצריכה 44px כמו כל השאר. */',
  '.budget label{display:inline-flex;align-items:center;min-block-size:44px}',
  '/* התוצאה. אותו .hub של מרכז המכשירים, ולכן דגם מומלץ נראה כמו דגם ברשימה ולא כמו כרטיס. */',
  '.res{margin-block-start:1.9rem}',
  '.res .hub b{font-size:clamp(1.18rem,2.1vw,1.45rem)}',
  '.why-list{list-style:none;margin:.45rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:.2rem .9rem;color:var(--ink-soft);font-size:1rem}',
  '.why-list li{position:relative;padding-inline-start:.85rem}',
  '.why-list li::before{content:"";position:absolute;inset-block-start:.72em;inset-inline-start:0;inline-size:.45rem;border-block-start:1px solid var(--teal)}',
  '.res-note{margin-block-start:1.5rem;border-block-start:1px solid var(--line);padding-block-start:1.2rem;color:var(--ink-soft);line-height:1.8}',
  hubCss()
].join('\n');
h = h.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' + CSS);

/* ------------------------------------------------------------------ השאלות
 * כל שאלה נושאת את השדה שהיא נשענת עליו, וכל אפשרות נושאת את הניקוד שלה. הטבלה הזאת היא
 * מקור האמת גם לשאלון וגם לנימוקים שיוצגו, ולכן אין דרך שהעמוד יגיד סיבה שאינה בטבלה. */
var QUESTIONS = [
  { id: 'os', q: 'איזו מערכת הפעלה?',
    why: 'זו השאלה שהכי קשה לשנות אחר כך. אפליקציות שקניתם לא עוברות בין המערכות, ולכן היא ראשונה.',
    req: true,
    opts: [['ios', 'אייפון'], ['and', 'אנדרואיד'], ['any', 'לא משנה לי']] },
  { id: 'size', q: 'איזה גודל מכשיר?',
    why: 'מתחת ל-6.4 אינץ׳ נחשב קומפקטי, ומעל 6.5 מסך גדול. בין השניים ההפרש מורגש ביד יותר מבמפרט.',
    req: true,
    opts: [['small', 'קומפקטי, שנכנס ליד אחת'], ['big', 'גדול, לצפייה וקריאה'], ['any', 'לא משנה לי']] },
  { id: 'weight', q: 'רגישים למשקל?',
    why: 'ההפרש בין הקל לכבד בעמוד הזה הוא 64 גרם, וזה מורגש בכיס אחרי כמה שעות.',
    req: false,
    opts: [['light', 'כן, עד 190 גרם'], ['any', 'לא, זה לא מטריד אותי']] },
  { id: 'cam', q: 'מה חשוב לכם במצלמה?',
    why: 'זום אופטי הוא עדשה נפרדת, ולא הגדלה של התמונה. עדשה רחבה במיוחד היא מה שמכניס חדר שלם או קבוצה לפריים.',
    req: false,
    opts: [['zoom', 'לצלם מרחוק'], ['wide', 'לצלם קבוצות ונופים'], ['main', 'רק ראשית טובה'], ['any', 'לא מצלם הרבה']] },
  { id: 'store', q: 'כמה אחסון?',
    why: 'מי שמצלם וידאו ולא מפנה לענן מגיע לתקרה. חריץ זיכרון קיים רק בחלק מהדגמים, ורק אצל היצרנים שמפרסמים אותו.',
    req: false,
    opts: [['128', '128GB יספיקו לי'], ['256', 'אני צריך 256GB ומעלה'], ['sd', 'אני רוצה חריץ זיכרון'], ['any', 'לא בדקתי']] },
  { id: 'batt', q: 'כמה חשובה הסוללה?',
    why: 'שווה לדעת: היצרנים לא מפרסמים באותה יחידה. אפל נוקבת בשעות וידאו, שיאומי ב-mAh, וסמסונג בשניהם. לכן הדירוג כאן נעשה בתוך כל יחידה בנפרד, ובפועל השאלה הזאת מזיזה בעיקר את הקצוות.',
    req: false,
    opts: [['high', 'זה הדבר הראשון שחשוב לי'], ['any', 'יום שימוש רגיל מספיק']] },
  { id: 'upd', q: 'חשוב לכם שהיצרן ינקוב בתאריך לעדכוני אבטחה?',
    why: 'מ-12 הדגמים בעמוד, רק דגמי סמסונג נוקבים בתאריך סיום מדויק. אפל ושיאומי לא מפרסמות תאריך, וזה לא אומר שהעדכונים נפסקים, אלא שאין התחייבות כתובה.',
    req: false,
    opts: [['yes', 'כן, אני מחזיק מכשיר הרבה שנים'], ['any', 'לא קריטי לי']] }
];

function optsHtml(q) {
  return q.opts.map(function (o, i) {
    var id = 'q-' + q.id + '-' + o[0];
    return '        <label for="' + id + '"><input type="radio" id="' + id + '" name="' + q.id + '" value="' + o[0] + '"' +
      (q.req ? ' aria-required="true"' : '') + '>' + esc(o[1]) + '</label>';
  }).join('\n');
}

var waGeneric = wa('היי, מלאתי את השאלון באתר ואשמח לעזרה בבחירה');
var openTag = h.slice(h.indexOf('<main id="main"'), h.indexOf('>', h.indexOf('<main id="main"')) + 1);

var main = openTag + '\n\n' +
'<section class="ghero" aria-labelledby="h1">\n  <div class="wrap">\n    <div class="inner">\n' +
'      <h1 id="h1">איזה מכשיר מתאים לי</h1>\n' +
'      <p class="sub">שבע שאלות, ובסוף שלושה דגמים שכדאי לבדוק. ההתאמה נעשית מול המפרט שהיצרן מפרסם, ולכן ליד כל דגם כתוב למה הוא הותאם.</p>\n' +
'      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + waGeneric + '">' +
'<img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">מעדיפים פשוט לדבר</a></div>\n' +
'      <p class="meta">\n        <span>' + live.length + ' דגמים במאגר</span>\n        <span>7 שאלות</span>\n' +
'        <span>שלוש תוצאות, לא אחת</span>\n        <span>ללא עלות</span>\n      </p>\n    </div>\n  </div>\n</section>\n\n' +

/* §16: טופס לכל דבר. form עם novalidate, ולידציה משלנו בעברית, שגיאה עם role=alert. */
'<section class="block" id="quiz" aria-labelledby="quiz-h">\n  <div class="wrap box">\n' +
'    <h2 id="quiz-h">השאלון</h2>\n' +
'    <p class="lead">שתי השאלות הראשונות נדרשות, השאר לא. אין כאן שליחה לשרת ואין שמירה: הכל מחושב במכשיר שלכם.</p>\n' +
'    <form id="qform" novalidate>\n' +
'      <div class="qs">\n' +
QUESTIONS.map(function (q) {
  return '        <fieldset class="q" id="fs-' + q.id + '">\n' +
    '          <legend>' + esc(q.q) + (q.req ? ' <span class="req">(נדרש)</span>' : '') + '</legend>\n' +
    '          <p class="why">' + q.why + '</p>\n' +
    '          <div class="opts">\n' + optsHtml(q) + '\n          </div>\n' +
    '        </fieldset>';
}).join('\n') + '\n' +
'        <fieldset class="q" id="fs-budget">\n' +
'          <legend>תקציב, אם יש לכם סכום בראש</legend>\n' +
'          <p class="why">השדה הזה <b>אינו מסנן שום דבר</b>, ולא מפני שהוא לא חשוב. אין מחירון באתר כי המחירים משתנים, ולכן מה שתכתבו כאן פשוט ייכנס להודעה שתשלחו לנו, ונענה עליו במחיר אמיתי.</p>\n' +
'          <div class="budget">\n' +
'            <label for="q-budget">שקלים</label>\n' +
'            <input type="text" id="q-budget" name="budget" inputmode="numeric" autocomplete="off" dir="ltr" placeholder="2500">\n' +
'          </div>\n' +
'        </fieldset>\n' +
'      </div>\n' +
'      <p class="qcount" id="qcount" role="status" aria-live="polite"></p>\n' +
'      <p class="err" id="qerr" role="alert" hidden></p>\n' +
'      <div class="qgo">\n' +
'        <button type="submit" class="btn btn-teal" id="qsubmit">הראו לי מה מתאים</button>\n' +
'        <button type="reset" class="btn btn-teal btn-sm" id="qreset">התחלה מחדש</button>\n' +
'      </div>\n' +
'    </form>\n' +
'    <div class="res" id="qres" aria-live="polite"></div>\n' +
'  </div>\n</section>\n\n' +

/* D4.3 — תוכן סטטי שעומד בפני עצמו. בלי זה העמוד רזה, וגם מי שלא ממלא צריך לקבל משהו. */
'<section class="block" id="how" aria-labelledby="how-h">\n  <div class="wrap box">\n' +
'    <h2 id="how-h">איך אנחנו בוחרים מכשיר בחנות</h2>\n' +
'    <div class="prose">\n' +
'      <p>השאלון עושה מה שאנחנו עושים בשיחה, רק מהר יותר: מצמצם מתוך כל הדגמים לשלושה שכדאי להסתכל עליהם. אין דגם אחד שמתאים לכולם, ולכן הוא לא מכריז על אחד. יש מכשיר שמתאים למה שחשוב לכם, ולכן ליד כל תוצאה כתוב למה היא הותאמה, ואפשר לא להסכים.</p>\n' +
'      <p>ההתאמה נשענת רק על מה שהיצרן מפרסם. שדה שהיצרן לא מפרסם אינו נחשב לחסרון ואינו מוריד ניקוד, כי היעדר מידע אינו היעדר תכונה. זו הסיבה שבשאלת האחסון החריץ מזוהה רק כשהוא קיים במפרט: אפל וסמסונג לא כותבות "אין הרחבה", ולכן שתיקה אינה תשובה.</p>\n' +
'      <p>שתי שאלות שהשאלון לא ישאל. הראשונה היא מחיר, כי אין מחירון באתר והוא משתנה. השנייה היא מה יש במלאי הרגע, כי מלאי משתנה מהר יותר מאתר. שתיהן שאלות טובות, ואת שתיהן נענה בשיחה.</p>\n' +
'    </div>\n' +
'    <p class="aside">מעדיפים להשוות בעצמכם? <a href="/phones/compare/">כלי ההשוואה</a> מציג שני דגמים או שלושה זה מול זה, ו<a href="/compare/">מרכז ההשוואות</a> מכיל השוואות מוכנות עם הסבר.</p>\n' +
'  </div>\n</section>\n\n' +

'<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
'    <h2 id="cta-h">לא בטוחים? זה בסדר</h2>\n' +
'    <p>אפשר גם לדלג על השאלון ופשוט לספר לנו מה חשוב לכם. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n' +
'    <div class="row">\n' +
'      <a class="btn btn-wa" href="' + waGeneric + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">דברו איתנו ב-WhatsApp</a>\n' +
'      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
'      <a class="btn btn-teal" href="/phones/">כל המכשירים</a>\n' +
'    </div>\n' +
'    <p class="fine">הייעוץ והליווי בבחירה ללא עלות וללא התחייבות.</p>\n' +
'  </div>\n</section>\n\n' +

'<script>\n' +
'/* השאלון. הניקוד כאן, התכונות מהמחולל. אין פענוח מחרוזות מפרט בדפדפן: TRAITS הוא התוצאה\n' +
'   של הגזירה בצד המחולל, שנופלת בקול אם ערך לא נפרש. כך העמוד לא יכול להמציא סיבה. */\n' +
'(function(){\n' +
'  "use strict";\n' +
'  var T=' + json(TRAITS) + ';\n' +
'  var form=document.getElementById("qform"), res=document.getElementById("qres"), err=document.getElementById("qerr");\n' +
'  var counter=document.getElementById("qcount");\n' +
'  if(!form||!res||!counter) return;\n' +
'  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}\n' +
'  function ltr(s){return \'<bdo dir="ltr">\'+esc(s)+"</bdo>";}\n' +
'  function val(n){var e=form.querySelector(\'input[name="\'+n+\'"]:checked\');return e?e.value:null;}\n' +
'\n' +
'  /* כל כלל מחזיר ניקוד וגם את הנימוק, מאותו מקום. נימוק בלי ניקוד או להפך אינו אפשרי. */\n' +
'  function score(t,a){\n' +
'    var pts=0, why=[];\n' +
'    if(a.os==="ios"){ if(t.ios){pts+=6;why.push("iOS");} else return null; }\n' +
'    if(a.os==="and"){ if(!t.ios){pts+=6;why.push("אנדרואיד");} else return null; }\n' +
'    if(a.size==="small"){ if(t.inch<=6.4){pts+=4;why.push(t.inch+" אינץ׳");} else pts-=3; }\n' +
'    if(a.size==="big"){ if(t.inch>=6.5){pts+=4;why.push(t.inch+" אינץ׳");} else pts-=3; }\n' +
'    if(a.weight==="light"){ if(t.grams<=190){pts+=3;why.push(t.grams+" גרם");} else pts-=2; }\n' +
'    if(a.cam==="zoom"){\n' +
'      /* מדרגים לפי המקדם האופטי שהיצרן פרסם. אין כאן שום טענה על מבנה העדשה: 2x של אפל\n' +
'         הוא חיתוך חיישן ו-4x הוא עדשה, והמקדם מפריד ביניהם בלי שנצטרך לטעון את זה. */\n' +
'      var x=t.optX;\n' +
'      if(x===null){ /* אין שורת זום אצל היצרן. לא מעניש ולא מתגמל. */ }\n' +
'      else if(x===0) pts-=4;\n' +
'      else if(x==="yes"){ pts+=4; why.push((t.zoomTxt||"").split(",")[0]); }\n' +
'      else if(x>=3){ pts+=6; why.push("זום אופטי "+x+"x"); }\n' +
'      else { pts+=2; why.push("זום אופטי "+x+"x"); }\n' +
'    }\n' +
'    /* uw ו-sd תלת-מצביים, ולכן null נבדק בנפרד מ-0 בשניהם. הגרסה הראשונה איחדה אותם\n' +
'       לאותו עונש, ומכיוון ש-uw היה גם בינארי, ארבעת דגמי הגלקסי נענשו 9 נקודות על עדשה\n' +
'       רחבה שיש להם: סמסונג פשוט לא כותבת "רחבה במיוחד" אלא רזולוציה וצמצם. נמדד: S26 Ultra\n' +
'       יצא שווה ל-A56 הבסיסי ומאחורי Xiaomi 15. שתיקה של היצרן אינה תשובה שלילית. */\n' +
'    if(a.cam==="wide"){ if(t.uw===1){pts+=5;why.push("עדשה רחבה במיוחד");} else if(t.uw===0) pts-=4; }\n' +
'    if(a.store==="256"){ if(t.minGB>=256){pts+=4;why.push("מתחיל ב-"+t.minGB+"GB");} else if(t.maxGB>=256){pts+=1;} else pts-=3; }\n' +
'    if(a.store==="128"){ if(t.minGB<=128){pts+=2;why.push("קיים ב-"+t.minGB+"GB");} }\n' +
'    if(a.store==="sd"){ if(t.sd===1){pts+=6;why.push("חריץ זיכרון");} else if(t.sd===0) pts-=5; }\n' +
'    if(a.batt==="high"){ if(t.batt===1){pts+=4;if(t.battTxt)why.push(t.battTxt);} else if(t.batt===-1){pts-=3;} }\n' +
'    if(a.upd==="yes"){ if(t.updYear){pts+=4;why.push("עדכונים עד "+t.updYear);} else pts-=2; }\n' +
'    return {pts:pts,why:why};\n' +
'  }\n' +
'\n' +
'  /* run(validate) — אותו מסלול לשני הטריגרים.\n' +
'     שליחה מריצה ולידציה, ושינוי תשובה מריץ בלי ולידציה. הסיבה: השאלון צריך להרגיש שהוא\n' +
'     מצטמצם תוך כדי, ולא שהוא מחשב בסוף. אבל שגיאה שמופיעה לפני שהמשתמש בכלל סיים לענות\n' +
'     היא נדנוד, ולכן הודעת השגיאה קשורה לשליחה בלבד. */\n' +
'  function run(validate){\n' +
'    var a={os:val("os"),size:val("size"),weight:val("weight"),cam:val("cam"),store:val("store"),batt:val("batt"),upd:val("upd")};\n' +
'    /* המונה הרץ. זה מה שנותן את התחושה שמשהו קורה: 12 דגמים שהופכים ל-5 בזמן שעונים. */\n' +
'    var viable=T.map(function(t){return score(t,a)?1:0;}).reduce(function(x,y){return x+y;},0);\n' +
'    var answered=["os","size","weight","cam","store","batt","upd"].filter(function(k){return a[k];}).length;\n' +
'    /* המונה אומר את מה שקורה באמת, וזה לא מה שכתוב בו בגרסה הראשונה.\n' +
'\n' +
'       הגרסה ההיא אמרה "X מתוך 12 עונים על מה שסימנתם עד כה", והמספר נתקע על 5 ולא זז יותר.\n' +
'       הסיבה: רק שאלת מערכת ההפעלה מסננת. כל השאר מדרגות ולא מוציאות אף דגם, וזו החלטה\n' +
'       מכוונת, כי שאלון שמעלים דגמים מסתיר מהלקוח את מה שיש בחנות. מונה שמראה מספר קפוא\n' +
'       ומבטיח סינון הוא מונה שמשקר, ולכן הוא מנוסח עכשיו לפי מה שהוא באמת מודד. */\n' +
'    if(!answered) counter.textContent = T.length+" דגמים במאגר. ענו על שתי השאלות הראשונות ונתחיל לדרג";\n' +
'    else if(!a.size) counter.textContent = viable+" "+(a.os==="ios"?"דגמי אייפון":(a.os==="and"?"דגמי אנדרואיד":"דגמים במאגר"))+". עוד שאלה אחת ונדרג אותם";\n' +
'    else counter.textContent = "מדרג "+viable+" דגמים לפי "+answered+" התשובות שסימנתם";\n' +
'\n' +
'    /* ולידציה בעברית, ומיקוד לשאלה הראשונה שחסרה. aria-invalid על הקבוצה ולא על רדיו בודד.\n' +
'       רצה רק בשליחה: סימון שדה כשגוי לפני שהמשתמש הגיע אליו הוא נדנוד ולא עזרה. */\n' +
'    if(!a.os||!a.size){\n' +
'      if(!validate){ res.innerHTML=\'<p class="dhint">עוד שאלה או שתיים, ונציג שלושה דגמים עם הסבר למה כל אחד.</p>\'; return; }\n' +
'      var missing=[];\n' +
'      [["os","איזו מערכת הפעלה"],["size","איזה גודל מכשיר"]].forEach(function(p){\n' +
'        var fs=document.getElementById("fs-"+p[0]);\n' +
'        if(!a[p[0]]){ missing.push(p[1]); fs.setAttribute("data-bad","1"); fs.setAttribute("aria-invalid","true"); }\n' +
'        else { fs.removeAttribute("data-bad"); fs.removeAttribute("aria-invalid"); }\n' +
'      });\n' +
'      err.hidden=false;\n' +
'      err.textContent = missing.length===1 ? ("צריך לענות על השאלה: "+missing[0]+".") : ("צריך לענות על שתי השאלות הראשונות: "+missing.join(", ")+".");\n' +
'      res.innerHTML="";\n' +
'      var first=document.querySelector(\'.q[data-bad="1"] input\');\n' +
'      if(first) first.focus();\n' +
'      return;\n' +
'    }\n' +
'    Array.prototype.forEach.call(document.querySelectorAll(".q"),function(fs){fs.removeAttribute("data-bad");fs.removeAttribute("aria-invalid");});\n' +
'    err.hidden=true;\n' +
'\n' +
'    var ranked=T.map(function(t){var s=score(t,a);return s?{t:t,s:s}:null;})\n' +
'      .filter(Boolean).sort(function(x,y){return y.s.pts-x.s.pts;});\n' +
'    if(!ranked.length){\n' +
'      /* כתובת הקישור מוצבת כמאפיין ולא נבנית בתוך מחרוזת HTML. בדיקה 3 ב-preflight סורקת\n' +
'         מאפייני קישור במקור העמוד, ושרשור מחרוזות השאיר שם פתיחת מאפיין חתוכה שנראתה כמו\n' +
'         נתיב יחסי. הבדיקה צדקה בצורה, והצבה כמאפיין גם פשוט קוד נקי יותר. */\n' +
'      res.innerHTML=\'<p class="res-note">התשובות שלכם לא הותאמו לאף דגם שיש לנו באתר, וזה קורה. \'+\n' +
'        \'<a class="qwa">ספרו לנו מה חיפשתם</a> ונבדוק מה אפשר להזמין.</p>\';\n' +
'      res.querySelector(".qwa").href=' + json(waGeneric) + ';\n' +
'      return;\n' +
'    }\n' +
'    var top=ranked.slice(0,3);\n' +
'    var txt="היי, מלאתי את השאלון באתר. יצא לי: "+top.map(function(r){return r.t.name;}).join(", ")+\n' +
'      ". אשמח לדעת מה המחיר ומה במלאי";\n' +
'    var b=(document.getElementById("q-budget").value||"").trim();\n' +
'    if(b) txt+=". התקציב שלי בסביבות "+b+" שקלים";\n' +
'    var link="https://wa.me/97286812050?text="+encodeURIComponent(txt);\n' +
'\n' +
'    res.innerHTML=\'<h3>שלושה דגמים שכדאי לבדוק</h3>\'+\n' +
'      \'<ul class="hub">\'+top.map(function(r){\n' +
'        return \'<li><a href="/phones/\'+r.t.slug+\'/"><b>\'+ltr(r.t.name)+"</b>"+\n' +
'          \'<span>\'+esc(r.t.brand)+"</span></a>"+\n' +
'          (r.s.why.length?\'<ul class="why-list">\'+r.s.why.map(function(w){return "<li>"+esc(w)+"</li>";}).join("")+"</ul>":"")+\n' +
'          "</li>";\n' +
'      }).join("")+"</ul>"+\n' +
'      \'<p class="res-note">אלה שלושה להתחיל מהם, ולא פסק דין. \'+\n' +
'      (ranked.length>3?("עוד "+(ranked.length-3)+" דגמים הותאמו במידה פחותה, ו"):"ו")+\n' +
'      \'<a class="qall">כל הדגמים</a> נמצאים כאן עם המפרט המלא. \'+\n' +
'      \'<a class="qwa">שלחו לנו את התוצאה ב-WhatsApp</a> ונגיד מה המחיר ומה במלאי.</p>\';\n' +
'    res.querySelector(".qall").href="/phones/";\n' +
'    res.querySelector(".qwa").href=link;\n' +
'    if(validate) res.scrollIntoView({block:"nearest"});\n' +
'  }\n' +
'\n' +
'  /* שינוי תשובה מריץ בלי ולידציה ובלי גלילה, שליחה מריצה עם שניהם. הכפתור נשאר כי הוא\n' +
'     הפעולה המפורשת למי שמנווט במקלדת, וכי הוא מה שמפעיל את הודעות השגיאה. */\n' +
'  form.addEventListener("change",function(){ run(false); });\n' +
'  form.addEventListener("submit",function(e){ e.preventDefault(); run(true); });\n' +
'  form.addEventListener("reset",function(){\n' +
'    res.innerHTML=""; err.hidden=true;\n' +
'    Array.prototype.forEach.call(document.querySelectorAll(".q"),function(f){f.removeAttribute("data-bad");f.removeAttribute("aria-invalid");});\n' +
'    setTimeout(function(){ run(false); },0);\n' +
'  });\n' +
'  run(false);\n' +
'})();\n' +
'</scr' + 'ipt>\n\n';

h = h.slice(0, h.indexOf('<main id="main"')) + main + h.slice(h.indexOf('</main>'));

var out = path.join(PROTO, 'phones', 'find-my-phone', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, h);
console.log('✓ phones/find-my-phone/ נבנה: ' + QUESTIONS.length + ' שאלות, ' + TRAITS.length + ' דגמים במאגר');

var swPath = path.join(PROTO, 'sw.js'), sw = fs.readFileSync(swPath, 'utf8');
if (sw.indexOf("'/phones/find-my-phone/'") < 0) {
  sw = sw.replace('const SHELL = [', "const SHELL = ['/phones/find-my-phone/', ");
  var m = sw.match(/const CACHE = 'pg-v(\d+)'/);
  if (m) sw = sw.replace(m[0], "const CACHE = 'pg-v" + (parseInt(m[1], 10) + 1) + "'");
  fs.writeFileSync(swPath, sw);
  console.log('✓ sw.js: הכתובת נכנסה למעטפת ושם המטמון עלה');
}
try {
  var sp = path.join(PROTO, 'services.json'), svc = JSON.parse(fs.readFileSync(sp, 'utf8'));
  if (!svc.existing.filter(function (x) { return x.url === '/phones/find-my-phone/'; }).length) {
    svc.existing.push({ url: '/phones/find-my-phone/', name: 'שאלון התאמה', status: 'review' });
    fs.writeFileSync(sp, JSON.stringify(svc, null, 2) + '\n');
  }
} catch (e) { console.error('⚠ לא ניתן לעדכן services.json'); }
