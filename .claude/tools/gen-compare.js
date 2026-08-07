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
var db = JSON.parse(fs.readFileSync(path.join(PROTO, 'devices.json'), 'utf8'));
if (!db._comparisons || !db._comparisons.pairs) { console.error('✗ אין _comparisons ב-devices.json'); process.exit(1); }
if (!db._spec_groups || !db._spec_groups.groups) { console.error('✗ אין _spec_groups ב-devices.json'); process.exit(1); }
var GROUPS = db._spec_groups.groups;
var only = process.argv[2];
var src = fs.readFileSync(path.join(PROTO, SOURCE), 'utf8');

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function wa(t) { return 'https://wa.me/97286812050?text=' + encodeURIComponent(t); }
function ltr(s) { return '<bdo dir="ltr">' + esc(s) + '</bdo>'; }
function val(v) { return Array.isArray(v) ? v.join(', ') : v; }
function D(slug) { return db.devices.filter(function (d) { return d.slug === slug; })[0]; }
function swap(h, re, to, what, who) {
  if (!re.test(h)) { console.error('✗ ' + who + ': לא נמצא ' + what); process.exit(1); }
  return h.replace(re, to);
}

/* אותה עובדה בשני ניסוחים אינה הבדל. הנרמול כאן קיים כדי לתפוס את זה ולהתריע, לא כדי
 * להסתיר: עמוד שאומר "יש הבדל" כשאין הוא שקר, והתיקון הוא ב-devices.json. קרה בפועל
 * ב-5.8.2026 בין "שמונה ליבות, עד 2.2GHz" ל-"8 ליבות, עד 2.2GHz". */
var NUMWORDS = { 'שמונה': '8', 'עשר': '10', 'תשע': '9', 'שבע': '7', 'שש': '6', 'חמש': '5', 'ארבע': '4', 'שלוש': '3', 'שתיים': '2' };
function normalise(s) {
  if (s === null || s === undefined) return null;
  s = String(val(s));
  Object.keys(NUMWORDS).forEach(function (w) { s = s.split(w).join(NUMWORDS[w]); });
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

function buildTable(a, b, d) {
  var byGroup = {}, order = [];
  d.rows.forEach(function (r) {
    if (!byGroup[r.group]) { byGroup[r.group] = []; order.push(r.group); }
    byGroup[r.group].push(r);
  });
  /* "לא מפורסם" ולא מקף ולא רווח: שדה שהיצרן לא מפרסם אינו אפס, וקורא צריך לדעת
   * שההיעדר הוא של המידע ולא של התכונה. */
  function cell(v) {
    return v === null
      ? '<td><i>לא מפורסם אצל היצרן</i></td>'
      : '<td>' + esc(v) + '</td>';
  }
  /* קו יחסי לשורה שיש בה מספר בשני הצדדים.
   *
   * זה מה שהופך את הטבלה מרשימה לקריאה: 167 גרם מול 214 גרם הם שני מספרים שצריך להחסיר,
   * ושני קווים באורך שונה הם הבדל שרואים. הקו הוא 2px, בלי רקע ובלי מסגרת, כלומר בדיוק
   * מה שמערכת העיצוב קוראת לו "קו שערה ורווח במקום קופסה".
   *
   * הרוחב יושב במשתנה CSS ולא ב-inline style של width, כדי שאפשר יהיה לכבות אותו ב-media
   * אחד אם יתברר שהוא מפריע, בלי לגעת ב-HTML המחולל. */
  function bars(fieldKey, a, b) {
    var fn = T.NUMERIC_BY_FIELD[fieldKey];
    if (!fn) return null;
    var r = T.ratioPair(fn(a.spec), fn(b.spec));
    if (!r) return null;
    return r;
  }
  var bodies = order.map(function (gname) {
    return '        <tbody>\n' +
      '          <tr class="grp"><th colspan="2" scope="rowgroup">' + esc(gname) + '</th></tr>\n' +
      byGroup[gname].map(function (r) {
        var bar = bars(r.key, a, b);
        /* aria-hidden על הקו: הוא חזרה חזותית על המספר שכבר נמצא בתא, וקורא מסך שיקרא
         * אותו פעמיים לא יקבל שום מידע נוסף. */
        function withBar(td, side) {
          if (!bar) return td;
          return td.replace('</td>', '<span class="dbar" style="--w:' + bar[side] + '%" aria-hidden="true"></span></td>');
        }
        return '          <tr class="fld"><th colspan="2" scope="rowgroup">' + esc(r.label) + '</th></tr>\n' +
          '          <tr><th scope="row">' + ltr(a.name) + '</th>' + withBar(cell(r.a), 'a') + '</tr>\n' +
          '          <tr><th scope="row">' + ltr(b.name) + '</th>' + withBar(cell(r.b), 'b') + '</tr>';
      }).join('\n') + '\n        </tbody>';
  }).join('\n');

  return '    <div class="cmp-wrap" tabindex="0" role="region" aria-labelledby="cmp-h">\n' +
    '      <table class="cmp cmp-spec cmp-vs">\n' +
    '        <caption>' + d.rows.length + ' שדות שבהם יש הבדל, מתוך המפרט שהיצרנים מפרסמים. ' +
    d.same + ' שדות נוספים זהים בשני הדגמים ואינם מופיעים כאן.</caption>\n' +
    bodies + '\n      </table>\n    </div>\n';
}

function buildMain(p, a, b, d, openTag) {
  var url = PROD + 'compare/' + p.slug + '/';
  var waPick = wa('היי, אני מתלבט בין ' + a.name + ' ל-' + b.name + '. אשמח לעזרה בבחירה');

  var s = openTag + '\n\n' +
    '<section class="ghero" aria-labelledby="h1">\n  <div class="wrap">\n    <div class="inner">\n' +
    '      <h1 id="h1">' + esc(p.h1) + '</h1>\n' +
    '      <p class="sub">' + esc(p.lede) + '</p>\n' +
    '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + waPick + '">' +
    '<img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">עזרו לי לבחור</a></div>\n' +
    '      <p class="meta">\n' +
    '        <span>' + d.rows.length + ' שדות שונים</span>\n' +
    '        <span>' + d.same + ' שדות זהים</span>\n' +
    '        <span>המפרטים מאתרי היצרנים</span>\n' +
    '        <span>בלי הכרזת מנצח</span>\n' +
    '      </p>\n    </div>\n  </div>\n</section>\n\n' +

    /* שני המכשירים, קישור לעמוד המלא של כל אחד. הרכיב .hub, אותו רכיב של מרכז המכשירים. */
    '<section class="block" id="devices" aria-labelledby="h-dev">\n  <div class="wrap box">\n' +
    '    <h2 id="h-dev">שני המכשירים</h2>\n' +
    '    <p class="lead">בעמוד הזה רק ההבדלים. המפרט המלא של כל דגם, ומה שכתבנו עליו, נמצאים בעמוד שלו.</p>\n' +
    '      <ul class="hub">\n' +
    /* כאן לא חוזרים על המפרט. הטבלה נמצאת מיד למטה, וכשמשווים שני דגמים באותו גודל מסך
     * התוצאה הייתה "מסך 6.3 אינץ׳" פעמיים זה מתחת לזה, ועוד פעם בפסקה הפותחת. */
    [a, b].map(function (x) {
      return '        <li><a href="/phones/' + x.slug + '/"><b>' + ltr(x.name) + '</b>' +
        '<span>' + esc(x.brand) + ' · המפרט המלא, ומה שכתבנו על הדגם</span></a></li>';
    }).join('\n') + '\n      </ul>\n' +
    '  </div>\n</section>\n\n' +

    /* "ההבדלים הגדולים" — הבלוק שהופך את העמוד מטבלה למשהו שקרא את הטבלה.
     *
     * מחושב מ-traits.js: לכל שדה שאפשר להשוות במספרים יש רף, וההפרשים מדורגים לפי כמה הם
     * עוברים אותו. הניסוח אומר מי גדול יותר ולא מי טוב יותר, ולכן משקל מופיע כ"כבד יותר".
     *
     * ואם אין אף הפרש מעל הרף, הבלוק אומר את זה במקום להיעלם. שני דגמים שנבדלים רק בזיכרון
     * ובמעבד הם מקרה אמיתי (A56 מול A36), וזו תשובה שימושית יותר מרשימה ריקה. */
    (function () {
      var ds = T.deltas(a.spec, b.spec).slice(0, 4);
      var nm = function (side) { return side === 'a' ? (a.name_he || a.name) : (b.name_he || b.name); };
      if (!ds.length) {
        return '<section class="block" id="gaps" aria-labelledby="gaps-h">\n  <div class="wrap box">\n' +
          '    <h2 id="gaps-h">ההבדלים הגדולים</h2>\n' +
          /* "גדול" ולא "אין בכלל": בין A56 ל-A36 יש הפרש של 3 גרם, כלומר קיים ומתחת לרף.
           * ניסוח שאומר "אין הבדל מדיד" בזמן שבטבלה מתחתיו מצוירים קווים הוא ניסוח שקורא
           * ישים עליו את האצבע. */
          '    <p class="lead">בין שני הדגמים האלה <b>אין הבדל מדיד גדול</b>: המסך, המשקל, האחסון והסוללה קרובים או זהים, וזה מה שהקווים בטבלה למטה מראים. מה שכן שונה ביניהם, כמו זיכרון או מעבד, אינו דבר שאפשר למתוח עליו קו.</p>\n' +
          '  </div>\n</section>\n\n';
      }
      return '<section class="block" id="gaps" aria-labelledby="gaps-h">\n  <div class="wrap box">\n' +
        '    <h2 id="gaps-h">ההבדלים הגדולים</h2>\n' +
        '    <p class="lead">' + (ds.length === 1
          ? 'מתוך ' + d.rows.length + ' השדות השונים, יש <b>הבדל אחד</b> שאפשר למדוד במספרים.'
          : 'מתוך ' + d.rows.length + ' השדות השונים, אלה <b>' + ds.length + ' ההבדלים הגדולים</b> שאפשר למדוד במספרים.') +
        ' השאר מופיעים בטבלה.</p>\n' +
        '    <ul class="gaps">\n' +
        ds.map(function (x) {
          return '      <li><b>' + esc(x.label) + '</b><span>' + esc(x.phrase) + '</span>' +
            '<em>' + esc(nm(x.higher)) + ': ' + esc(x.more) + '</em></li>';
        }).join('\n') + '\n    </ul>\n' +
        '    <p class="aside">"גדול יותר" אינו "טוב יותר". מסך גדול שוקל יותר, וסוללה גדולה תופסת נפח. מה מכריע אצלכם, זה בדיוק מה שנעבור עליו יחד.</p>\n' +
        '  </div>\n</section>\n\n';
    })() +

    '<section class="block" id="table" aria-labelledby="cmp-h">\n  <div class="wrap box">\n' +
    '    <h2 id="cmp-h">מה שונה ביניהם</h2>\n' +
    '    <p class="lead">רק השדות שבהם שני הדגמים לא זהים. ' + d.same +
    ' שדות נוספים זהים בשניהם, ולכן אין טעם להציג אותם.</p>\n' +
    buildTable(a, b, d) +
    '  </div>\n</section>\n\n' +

    '<section class="block" id="who" aria-labelledby="h-who">\n  <div class="wrap box">\n' +
    '    <h2 id="h-who">למי עדיף כל אחד</h2>\n' +
    '    <div class="two">\n' +
    [[a, p.for_a], [b, p.for_b]].map(function (pair) {
      return '      <div class="col">\n' +
        '        <h3>' + ltr(pair[0].name) + '</h3>\n        <ul class="ticks">\n' +
        pair[1].map(function (t) { return '          <li>' + esc(t) + '</li>'; }).join('\n') +
        '\n        </ul>\n' +
        '        <p class="aside"><a href="/phones/' + pair[0].slug + '/">המפרט המלא של ' +
        esc(pair[0].name_he || pair[0].name) + '</a></p>\n      </div>';
    }).join('\n') + '\n    </div>\n  </div>\n</section>\n\n' +

    '<section class="rules" aria-labelledby="h-bl">\n  <div class="wrap">\n    <div class="box">\n' +
    '      <h2 id="h-bl">השורה התחתונה</h2>\n' +
    '      <div class="prose"><p>' + esc(p.bottom_line) + '</p></div>\n' +
    '    </div>\n  </div>\n</section>\n\n' +

    '<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
    '    <h2 id="cta-h">עדיין מתלבטים?</h2>\n' +
    '    <p>שני המכשירים אצלנו בחנות. תגידו לנו מה חשוב לכם, ונעבור על זה יחד. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n' +
    '    <div class="row">\n' +
    '      <a class="btn btn-wa" href="' + waPick + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">עזרו לי לבחור</a>\n' +
    '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
    '      <a class="btn btn-teal" href="/compare/">כל ההשוואות</a>\n' +
    '    </div>\n' +
    '    <p class="fine">הייעוץ והליווי בבחירה ללא עלות וללא התחייבות.</p>\n' +
    '  </div>\n</section>\n\n';
  return s;
}

function schema(p, a, b, url) {
  return [
    { '@context': 'https://schema.org', '@type': 'Article',
      headline: p.h1, description: p.description,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      about: [a, b].map(function (x) { return { '@type': 'Product', name: x.name, brand: { '@type': 'Brand', name: x.brand } }; }),
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
  return '/* .hub — נשלף מ-guides/index.html בזמן החילול. עותק אחד, ואין מה לסחוף. */\n' + block;
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
  '.two{display:grid;gap:2.2rem;margin-top:1.6rem}',
  '@media(min-width:820px){.two{grid-template-columns:1fr 1fr;gap:3rem}}',
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
  'html.a11y-invert .dbar,html.a11y-contrast .dbar{background:currentColor;opacity:1}'
].join('\n') + '\n' + hubCss();

/* .chip נשלף ממדריך התקלות, המקום שבו הרכיב נולד. אותו שיקול כמו ב-.hub: עותק שני של כלל
 * עיצוב מתפצל בשקט. הרכיב שם הוא בדיוק מה שמערכת העיצוב מבקשת ולא צ׳יפ מקובע: בלי רקע, בלי
 * מסגרת, radius אפס, וקו תחתון שמסמן בחירה. גם aria-pressed כבר שם, וזה הדפוס הנכון למתג. */
function chipCss() {
  var g = fs.readFileSync(path.join(PROTO, 'phone-problems/index.html'), 'utf8');
  var want = [/^\.chip\{font-family:inherit[^}]*\}/m, /^\.chip:hover\{[^}]*\}/m, /^\.chip\[aria-pressed="true"\]\{[^}]*\}/m];
  var got = want.map(function (re) {
    var m = g.match(re);
    if (!m) { console.error('✗ לא נמצא כלל .chip במדריך התקלות (' + re + '). הרכיב נולד שם, ואם הוא זז צריך לעדכן את המחולל.'); process.exit(1); }
    return m[0];
  });
  return '/* .chip — נשלף מ-phone-problems/index.html בזמן החילול. עותק אחד. */\n' + got.join('\n');
}

var TOOL_CSS = [
  chipCss(),
  '/* 12 מתגי דגם. גריד ולא מסנן דביק: המסנן במדריך התקלות מחזיק ארבעה צ׳יפים בפס דביק,',
  '   ושנים עשר בפס כזה היו 3 שורות של כרום דביק מעל כותרת של 64px. במקום זה הגריד רגיל,',
  '   ורק שורת הסיכום דביקה. auto-fill עם מינימום 9.5rem נותן שתי עמודות ב-375px. */',
  '.dpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.2rem 1.4rem;margin-top:1.6rem;list-style:none;padding:0}',
  '.dpick li{border-top:1px solid var(--line)}',
  '.dpick .chip{display:block;width:100%;text-align:start;padding-block:.95rem;font-size:1.02rem;border-bottom:0}',
  '.dpick .chip[aria-pressed="true"]{border-bottom:0}',
  '/* הסימן שנבחר: מקף לפני השם, ולא רקע צבוע. אין משטחים מלאים במערכת הזאת. */',
  '.dpick .chip::before{content:"";display:inline-block;inline-size:1.1rem;border-block-start:2px solid transparent;vertical-align:.35em;margin-inline-end:.5rem;transition:border-color .2s}',
  '.dpick .chip[aria-pressed="true"]::before{border-block-start-color:var(--teal)}',
  '/* שורת הסיכום. sticky מתחת לכותרת האתר (66px) ולא fixed, ולכן אין התנגשות עם סרגל',
  '   המובייל של 70px ואין צורך בפינוי. */',
  '.dstate{position:sticky;inset-block-start:66px;z-index:70;background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-block-end:1px solid var(--line);padding-block:.9rem;margin-block-start:1.8rem;display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem}',
  '.dstate p{margin:0;color:var(--ink-soft);font-size:1rem}',
  '.dstate b{color:var(--ink-strong);font-weight:700}',
  '.dstate button{margin-inline-start:auto}',
  '/* btn-sm הוא 36px, ונמדד 36x117 ב-375px. יעד מגע חייב 44px, וה-padding הוא שנושא אותו',
  '   ולא min-height: גובה מוצהר נאכל על ידי המסגרת ותיבת השורה ויוצא 43. זה בדיוק הדפוס',
  '   שהצ׳קליסט מתאר לגבי .cookie .btn-sm, שגם הוא עוקף padding כללי במקום לשנות אותו. */',
  '.dstate .btn-sm{padding-block:.78rem}',
  '.dempty{margin-top:1.8rem;border-block-start:1px solid var(--line);padding-block-start:1.4rem;color:var(--ink-soft);line-height:1.8}'
].join('\n');

function toolMain(openTag, index, order, pairCount) {
  var live = db.devices.filter(function (d) { return d.status !== 'draft'; }).sort(function (a, b) {
    return a.brand === b.brand ? 0 : (a.brand < b.brand ? -1 : 1);
  });
  var waPick = wa('היי, אני מתלבט בין כמה דגמים ואשמח לעזרה בבחירה');
  /* \\u003c ולא <: מחרוזת שמכילה סוגר סקריפט בתוך <script> סוגרת אותו, וזו תקלה שמפילה
   * את כל ה-JS בעמוד בשקט. אין כאן סוגרים כאלה, וזו חגורה. */
  var json = function (o) { return JSON.stringify(o).replace(/</g, '\\u003c'); };

  return openTag + '\n\n' +
  '<section class="ghero" aria-labelledby="h1">\n  <div class="wrap">\n    <div class="inner">\n' +
  '      <h1 id="h1">השוואת מכשירים</h1>\n' +
  '      <p class="sub">בחרו שני דגמים, או שלושה, והטבלה תציג רק את השדות שבהם הם באמת שונים. הנתונים מאתרי היצרנים.</p>\n' +
  '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + waPick + '">' +
  '<img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">עזרו לי לבחור</a></div>\n' +
  '      <p class="meta">\n        <span>' + live.length + ' דגמים</span>\n        <span>' + pairCount + ' זוגות</span>\n' +
  '        <span>רק מה שונה</span>\n        <span>בלי מחיר, כי הוא משתנה</span>\n      </p>\n    </div>\n  </div>\n</section>\n\n' +

  '<section class="block" id="pick" aria-labelledby="pick-h">\n  <div class="wrap box">\n' +
  '    <h2 id="pick-h">בחרו דגמים</h2>\n' +
  '    <p class="lead">עד שלושה. הטבלה מתעדכנת מיד, ואין צורך ללחוץ על כלום.</p>\n' +
  '    <ul class="dpick" id="dpick">\n' +
  live.map(function (d) {
    return '      <li><button type="button" class="chip" data-slug="' + esc(d.slug) + '" aria-pressed="false">' +
      ltr(d.name) + '</button></li>';
  }).join('\n') + '\n    </ul>\n' +
  '    <div class="dstate">\n' +
  '      <p id="dstate" role="status">בחרו שני דגמים כדי לראות את ההבדלים.</p>\n' +
  '      <button type="button" class="btn btn-teal btn-sm" id="dclear" hidden>נקו את הבחירה</button>\n' +
  '    </div>\n' +
  '    <div id="dout" aria-live="polite">\n' +
  /* מצב ריק בתוך ה-HTML ולא רק ב-JS: העמוד noindex, אבל מי שנכנס בלי JavaScript חייב
   * לקבל משהו שאומר לו לאן ללכת, ולא אזור ריק. */
  '      <p class="dempty">אחרי שתבחרו, כאן תופיע טבלה עם השדות השונים בלבד. אם JavaScript כבוי, ' +
  '<a href="/compare/">מרכז ההשוואות</a> מכיל את ההשוואות המוכנות בלי צורך בכלי.</p>\n' +
  '    </div>\n  </div>\n</section>\n\n' +

  '<section class="block" id="how" aria-labelledby="how-h">\n  <div class="wrap box">\n' +
  '    <h2 id="how-h">איך הכלי מחשב את ההבדלים</h2>\n' +
  '    <div class="prose">\n' +
  '      <p>רשימת השדות השונים בכל זוג מחושבת מראש, מאותו קוד שבונה את עמודי ההשוואה הקבועים. לכן הכלי והעמודים לא יכולים להגיד שני דברים שונים על אותם שני דגמים.</p>\n' +
  '      <p>שדה שאף אחד מהיצרנים אינו מפרסם אינו נחשב הבדל ואינו מוצג. שדה שרק יצרן אחד מפרסם כן מוצג, והצד השני מסומן כלא מפורסם ולא כאפס.</p>\n' +
  '      <p>אין כאן מחיר ואין הכרזה מי טוב יותר. את המחיר תקבלו מאיתנו כי הוא משתנה, ואת ההחלטה נעבור איתכם.</p>\n' +
  '    </div>\n' +
  '    <p class="aside"><a href="/compare/">ההשוואות המוכנות</a> כוללות גם פסקה על מה שונה ולמי עדיף כל אחד. <a href="/phones/">כל המכשירים</a> עם המפרט המלא.</p>\n' +
  '  </div>\n</section>\n\n' +

  '<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
  '    <h2 id="cta-h">רוצים לראות אותם ביד?</h2>\n' +
  '    <p>המכשירים אצלנו בחנות, ואפשר להחזיק ולהשוות. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n' +
  '    <div class="row">\n' +
  '      <a class="btn btn-wa" href="' + waPick + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">עזרו לי לבחור</a>\n' +
  '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
  '      <a class="btn btn-teal" href="/compare/">ההשוואות המוכנות</a>\n' +
  '    </div>\n' +
  '    <p class="fine">הייעוץ והליווי בבחירה ללא עלות וללא התחייבות.</p>\n' +
  '  </div>\n</section>\n\n' +

  '<script>\n' +
  '/* כלי ההשוואה. אין כאן חישוב הבדלים: PAIRS מכיל את התוצאה של diffSpec מהמחולל, כלומר\n' +
  '   שמות השדות שנמצאו שונים בכל זוג. הערכים נשלפים מ-devices.json בזמן ריצה. כך ההחלטה\n' +
  '   "מה שונה" חיה במקום אחד בלבד, ואי אפשר שהכלי והעמוד הקבוע יגידו דברים שונים. */\n' +
  '(function(){\n' +
  '  "use strict";\n' +
  '  var PAIRS=' + json(index) + ';\n' +
  '  var ORDER=' + json(order) + ';\n' +
  '  var MAX=3, sel=[], DB=null;\n' +
  '  var wrap=document.getElementById("dpick"), out=document.getElementById("dout"),\n' +
  '      state=document.getElementById("dstate"), clear=document.getElementById("dclear");\n' +
  '  if(!wrap||!out) return;\n' +
  '  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}\n' +
  '  function ltr(s){return \'<bdo dir="ltr">\'+esc(s)+"</bdo>";}\n' +
  '  function dev(sl){for(var i=0;i<DB.devices.length;i++){if(DB.devices[i].slug===sl)return DB.devices[i];}return null;}\n' +
  '  function keysFor(a,b){var p=PAIRS[a+"|"+b]||PAIRS[b+"|"+a];return p?{k:p.k?p.k.split("|"):[],s:p.s}:null;}\n' +
  '  function val(v){return Array.isArray(v)?v.join(", "):v;}\n' +
  '\n' +
  '  function render(){\n' +
  '    var names=sel.map(function(s){var d=dev(s);return d?(d.name_he||d.name):s;});\n' +
  '    if(sel.length<2){\n' +
  '      state.innerHTML=sel.length?"נבחר "+esc(names[0])+". בחרו עוד אחד לפחות.":"בחרו שני דגמים כדי לראות את ההבדלים.";\n' +
  '      clear.hidden=!sel.length;\n' +
  '      out.innerHTML=\'<p class="dempty">אחרי שתבחרו, כאן תופיע טבלה עם השדות השונים בלבד. \'+\n' +
  '        \'אם JavaScript כבוי, <a href="/compare/">מרכז ההשוואות</a> מכיל את ההשוואות המוכנות.</p>\';\n' +
  '      return;\n' +
  '    }\n' +
  '    clear.hidden=false;\n' +
  '    /* שדה שונה בין שלושה אם ורק אם הוא שונה באחד הזוגות. איחוד קבוצות, לא אלגוריתם חדש. */\n' +
  '    var set={}, same=null, missingPair=false;\n' +
  '    for(var i=0;i<sel.length;i++){for(var j=i+1;j<sel.length;j++){\n' +
  '      var p=keysFor(sel[i],sel[j]);\n' +
  '      if(!p){missingPair=true;continue;}\n' +
  '      p.k.forEach(function(k){set[k]=1;});\n' +
  '      if(sel.length===2) same=p.s;\n' +
  '    }}\n' +
  '    if(missingPair){out.innerHTML=\'<p class="dempty">לא הצלחנו לחשב את ההשוואה הזאת. <a href="/compare/">ההשוואות המוכנות</a> זמינות תמיד.</p>\';return;}\n' +
  '    var diff=ORDER.filter(function(r){return set[r[1]];});\n' +
  '    state.innerHTML="<b>"+names.map(esc).join(" מול ")+"</b> · "+diff.length+" שדות שונים"+\n' +
  '      (same!==null?" · "+same+" זהים":"");\n' +
  '\n' +
  '    var ds=sel.map(dev), cat=null, html="", bodyOpen=false;\n' +
  '    diff.forEach(function(r){\n' +
  '      if(r[0]!==cat){ if(bodyOpen) html+="</tbody>"; cat=r[0];\n' +
  '        html+=\'<tbody><tr class="grp"><th colspan="2" scope="rowgroup">\'+esc(cat)+"</th></tr>"; bodyOpen=true; }\n' +
  '      html+=\'<tr class="fld"><th colspan="2" scope="rowgroup">\'+esc(r[1])+"</th></tr>";\n' +
  '      ds.forEach(function(d){\n' +
  '        var v=d?val(d.spec[r[2]]):null;\n' +
  '        var cell=(v===null||v===undefined||v==="")?"<td><i>לא מפורסם אצל היצרן</i></td>":"<td>"+esc(v)+"</td>";\n' +
  '        html+=\'<tr><th scope="row">\'+ltr(d.name)+"</th>"+cell+"</tr>";\n' +
  '      });\n' +
  '    });\n' +
  '    if(bodyOpen) html+="</tbody>";\n' +
  '    out.innerHTML=\'<div class="cmp-wrap" tabindex="0" role="region" aria-label="טבלת ההבדלים">\'+\n' +
  '      \'<table class="cmp cmp-spec cmp-vs"><caption>\'+diff.length+" שדות שבהם יש הבדל"+\n' +
  '      (same!==null?", ו-"+same+" שדות נוספים זהים ואינם מופיעים כאן":"")+".</caption>"+html+"</table></div>"+\n' +
  '      \'<p class="aside">\'+ds.map(function(d){return \'<a href="/phones/\'+d.slug+\'/">המפרט המלא של \'+esc(d.name_he||d.name)+"</a>";}).join(" · ")+"</p>";\n' +
  '  }\n' +
  '\n' +
  '  wrap.addEventListener("click",function(e){\n' +
  '    var b=e.target.closest?e.target.closest(".chip"):null;\n' +
  '    if(!b||!DB) return;\n' +
  '    var sl=b.getAttribute("data-slug"), at=sel.indexOf(sl);\n' +
  '    if(at>=0) sel.splice(at,1);\n' +
  '    else { if(sel.length>=MAX) sel.shift(); sel.push(sl); }\n' +
  '    Array.prototype.forEach.call(wrap.querySelectorAll(".chip"),function(c){\n' +
  '      c.setAttribute("aria-pressed", sel.indexOf(c.getAttribute("data-slug"))>=0?"true":"false");\n' +
  '    });\n' +
  '    render();\n' +
  '  });\n' +
  '  clear.addEventListener("click",function(){\n' +
  '    sel=[];\n' +
  '    Array.prototype.forEach.call(wrap.querySelectorAll(".chip"),function(c){c.setAttribute("aria-pressed","false");});\n' +
  '    render(); wrap.querySelector(".chip").focus();\n' +
  '  });\n' +
  '\n' +
  '  fetch("/devices.json",{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){\n' +
  '    DB=d; render();\n' +
  '  }).catch(function(){\n' +
  '    out.innerHTML=\'<p class="dempty">לא ניתן לטעון את נתוני המכשירים. <a href="/compare/">ההשוואות המוכנות</a> עובדות בלי הכלי.</p>\';\n' +
  '  });\n' +
  '})();\n' +
  '</scr' + 'ipt>\n\n';
}

var made = 0, swGrew = false;
db._comparisons.pairs.forEach(function (p) {
  if (only && p.slug !== only) return;
  var a = D(p.a), b = D(p.b);
  if (!a || !b) { console.error('✗ ' + p.slug + ': דגם חסר'); process.exit(1); }
  var url = PROD + 'compare/' + p.slug + '/';
  var h = src;

  h = swap(h, /<title>[\s\S]*?<\/title>/, '<title>' + esc(p.title) + '</title>', '<title>', p.slug);
  h = swap(h, /(<meta name="description" content=")[^"]*(">)/, '$1' + esc(p.description) + '$2', 'description', p.slug);
  h = swap(h, /(<link rel="canonical" href=")[^"]*(">)/, '$1' + url + '$2', 'canonical', p.slug);
  h = swap(h, /(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(p.title) + '$2', 'og:title', p.slug);
  h = swap(h, /(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(p.description) + '$2', 'og:description', p.slug);
  h = swap(h, /(<meta property="og:url" content=")[^"]*(">)/, '$1' + url + '$2', 'og:url', p.slug);
  h = swap(h, /(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + esc(p.title) + '$2', 'twitter:title', p.slug);
  h = swap(h, /(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + esc(p.description) + '$2', 'twitter:desc', p.slug);

  /* מוחקים קודם, מזריקים אחר כך. אותה מלכודת שהפילה את פירורי הלחם של עמודי המכשיר:
   * הבלוק החדש מוזרק במקום Product, שיושב לפני ה-BreadcrumbList של המקור, ולכן מחיקה
   * אחרי ההזרקה מוחקת את החדש. שום בדיקה לא תופסת את זה כי מספר הרמות זהה. */
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\s*/, '');
  if (!/"@type":"Product"/.test(h)) { console.error('✗ ' + p.slug + ': לא נמצא בלוק Product להחלפה'); process.exit(1); }
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>/,
    schema(p, a, b, url).map(function (o) { return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>'; }).join('\n'));
  /* חגורה: אם סדר ההזרקה יישבר שוב, זה ייפול כאן ולא ישקוט */
  if (h.indexOf('"name":"השוואות"') < 0) { console.error('✗ ' + p.slug + ': פירור הלחם אינו מצביע ל-/compare/'); process.exit(1); }
  /* Product ברמת העמוד, כלומר בלוק שנפתח בו. בתוך about של ה-Article יש Product מקונן לכל
   * אחד משני הדגמים, וזה נכון ומכוון, ולכן הבדיקה עוגנת ל-@context שפותח בלוק. */
  if (/\{"@context":"https:\/\/schema\.org","@type":"Product"/.test(h)) {
    console.error('✗ ' + p.slug + ': נשאר Product ברמת העמוד. עמוד השוואה אינו מוצר'); process.exit(1);
  }

  var CSS_ANCHOR = '.ghero .btn-hero{white-space:normal;text-align:center}';
  if (h.indexOf(CSS_ANCHOR) < 0) { console.error('✗ ' + p.slug + ': לא נמצא עוגן ה-CSS'); process.exit(1); }
  h = h.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' + CSS);

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
if (!only) {
  var hubDir = path.join(PROTO, 'compare');
  var hubPath = path.join(hubDir, 'index.html');
  var pairs = db._comparisons.pairs;
  var hubUrl = PROD + 'compare/';
  var hubTitle = 'השוואות מכשירים: ' + pairs.length + ' השוואות אמיתיות בין דגמים | פון גת';
  var hubDesc = 'השוואות בין דגמים שנמכרים אצלנו, לפי המפרט שהיצרנים מפרסמים. רק מה שונה, בלי הכרזת מנצח, ובלי מפרט מומצא. פון גת קרית גת.';

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
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: pairs.map(function (p, i) {
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
    '      <p class="sub">' + pairs.length + ' השוואות, כולן בין דגמים שיש לנו בחנות. בכל אחת רק השדות שבהם שני הדגמים באמת שונים, לפי המפרט שהיצרן מפרסם. אין כאן הכרזת מנצח, כי חנות שמכריזה מנצח מוכרת את המנצח.</p>\n' +
    '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + wa('היי, אני מתלבט בין שני דגמים ואשמח לעזרה') + '">' +
    '<img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">עזרו לי לבחור</a></div>\n' +
    '      <p class="meta">\n        <span>המפרטים מאתרי היצרנים</span>\n        <span>רק מה שונה</span>\n' +
    '        <span>בלי הכרזת מנצח</span>\n        <span>ייעוץ ללא עלות</span>\n      </p>\n    </div>\n  </div>\n</section>\n\n' +

    '<section class="block" id="list" aria-labelledby="h-list">\n  <div class="wrap box">\n' +
    '    <h2 id="h-list">ההשוואות</h2>\n' +
    '    <p class="lead">אם ההשוואה שאתם מחפשים אינה כאן, שלחו לנו את שני הדגמים ונעבור עליהם איתכם.</p>\n' +
    '      <ul class="hub">\n' +
    pairs.map(function (p) {
      var a = D(p.a), b = D(p.b);
      var d = diffSpec(a, b, p.slug);
      return '        <li><a href="/compare/' + p.slug + '/"><b>' + esc((a.name_he || a.name) + ' מול ' + (b.name_he || b.name)) + '</b>' +
        '<span>' + d.rows.length + ' שדות שונים · ' + d.same + ' זהים</span></a></li>';
    }).join('\n') + '\n      </ul>\n' +
    '    <p class="aside">הזוג שאתם מחפשים אינו כאן? <a href="/phones/compare/">בכלי ההשוואה</a> אפשר לבחור כל שני דגמים מתוך השנים עשר, או שלושה.</p>\n' +
    '    <p class="aside">ואם הדגם עצמו לא אצלנו באתר, <a href="' + wa('היי, אשמח להשוואה בין שני דגמים שלא מופיעים באתר') + '">שלחו לנו את שני הדגמים ב-WhatsApp</a>.</p>\n' +
    '  </div>\n</section>\n\n' +

    '<section class="block" id="how" aria-labelledby="h-how">\n  <div class="wrap box">\n' +
    '    <h2 id="h-how">איך בנויות ההשוואות כאן</h2>\n' +
    '    <div class="prose">\n' +
    '      <p>כל הנתונים בטבלאות מגיעים מאתר היצרן, וליד כל טבלה כתוב מאיזה עמוד ומאיזה תאריך. שדה שהיצרן לא מפרסם מסומן כלא מפורסם, ולא מנוחש ולא נשלף מאתר אחר.</p>\n' +
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
  console.log('✓ /compare/ נבנה: ' + pairs.length + ' השוואות ברשימה וב-ItemList');

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
  var live = db.devices.filter(function (d) { return d.status !== 'draft'; }).map(function (d) { return d.slug; });
  var index = {}, n = 0;
  for (var i = 0; i < live.length; i++) {
    for (var j = i + 1; j < live.length; j++) {
      var a = D(live[i]), b = D(live[j]);
      var d = diffSpec(a, b, live[i] + '|' + live[j]);
      index[live[i] + '|' + live[j]] = { k: d.rows.map(function (r) { return r.label; }).join('|'), s: d.same };
      n++;
    }
  }
  /* התוויות ולא המפתחות, כי התווית היא מה שמוצג ומה שמקבץ. גם שומר על סדר הקטגוריות. */
  var order = [];
  GROUPS.forEach(function (g) { g[1].forEach(function (f) { order.push([g[0], f[1], f[0]]); }); });

  var url = PROD + 'compare/';                       /* canonical לעמוד הסטטי, לא לעצמו */
  var toolUrl = PROD + 'phones/compare/';
  var title = 'השוואת מכשירים: בחרו שני דגמים | פון גת';
  var desc = 'כלי להשוואה בין שני דגמים או שלושה, מתוך המכשירים שיש לנו. רק השדות שבהם הם באמת שונים.';
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
  if (!/"@type":"Product"/.test(h)) { console.error('✗ tool: לא נמצא בלוק Product להחלפה'); process.exit(1); }
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>/,
    '<script type="application/ld+json">\n' + JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'דף הבית', item: PROD },
        { '@type': 'ListItem', position: 2, name: 'מכשירים', item: PROD + 'phones/' },
        { '@type': 'ListItem', position: 3, name: 'השוואת מכשירים', item: toolUrl }
      ]
    }) + '\n</script>');

  var CSS_ANCHOR = '.ghero .btn-hero{white-space:normal;text-align:center}';
  if (h.indexOf(CSS_ANCHOR) < 0) { console.error('✗ tool: לא נמצא עוגן ה-CSS'); process.exit(1); }
  h = h.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' + CSS + '\n' + TOOL_CSS);

  var mS = h.indexOf('<main id="main"'), mE = h.indexOf('</main>');
  var openTag = h.slice(mS, h.indexOf('>', mS) + 1);
  h = h.slice(0, mS) + toolMain(openTag, index, order, n) + h.slice(mE);

  var out = path.join(PROTO, 'phones', 'compare', 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);
  console.log('✓ phones/compare/ נבנה: ' + n + ' זוגות מחושבים מראש, ' + order.length + ' שדות');

  var swPath = path.join(PROTO, 'sw.js'), sw = fs.readFileSync(swPath, 'utf8');
  if (sw.indexOf("'/phones/compare/'") < 0) { fs.writeFileSync(swPath, sw.replace('const SHELL = [', "const SHELL = ['/phones/compare/', ")); swGrew = true; }
  try {
    var sp = path.join(PROTO, 'services.json'), svc = JSON.parse(fs.readFileSync(sp, 'utf8'));
    if (!svc.existing.filter(function (x) { return x.url === '/phones/compare/'; }).length) {
      svc.existing.push({ url: '/phones/compare/', name: 'כלי ההשוואה', status: 'review' });
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
