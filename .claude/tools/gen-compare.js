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
/* עברית מבחינה בין יחיד, זוגי ורבים, והמחולל הדפיס "1 שדות זהים".
 * שלושה מקומות מרנדרים את אותו מספר, ולכן פונקציה אחת ולא שלוש מחרוזות. */
function sameTxt(n){ return n === 1 ? 'שדה אחד זהה' : (n === 2 ? 'שני שדות זהים' : n + ' שדות זהים'); }
function sameMoreTxt(n){ return n === 1 ? 'שדה אחד נוסף זהה' : (n === 2 ? 'שני שדות נוספים זהים' : n + ' שדות נוספים זהים'); }
function D(slug) { return db.devices.filter(function (d) { return d.slug === slug; })[0]; }
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
      /* ltrRuns ולא esc, מאותה סיבה שבעמודי המכשיר: bidi הפך את סדר המספרים בתא. */
      : '<td>' + BIDI.ltrRuns(v) + '</td>';
  }
  /* קו יחסי לשורה שיש בה מספר בשני הצדדים.
   *
   * זה מה שהופך את הטבלה מרשימה לקריאה: 167 גרם מול 214 גרם הם שני מספרים שצריך להחסיר,
   * ושני קווים באורך שונה הם הבדל שרואים. הקו הוא 2px, בלי רקע ובלי מסגרת, כלומר בדיוק
   * מה שמערכת העיצוב קוראת לו "קו שערה ורווח במקום קופסה".
   *
   * הרוחב יושב במשתנה CSS ולא ב-inline style של width, כדי שאפשר יהיה לכבות אותו ב-media
   * אחד אם יתברר שהוא מפריע, בלי לגעת ב-HTML המחולל. */
  /* ratioField ולא ratioPair: היא בודקת שהיחידות זהות לפני שהיא מחזירה יחס. ראו את ההערה
   * ליד NUMERIC_BY_FIELD ב-traits.js — כאן הקו הציג 1% מול 100% כי הוא השווה שעות ל-mAh. */
  function bars(fieldKey, a, b) {
    return T.ratioField(fieldKey, a.spec, b.spec);
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
    sameMoreTxt(d.same) + ' בשני הדגמים ואינם מופיעים כאן.</caption>\n' +
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
    '        <span>' + sameTxt(d.same) + '</span>\n' +
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
      /* מכשיר ייחוס אין לו עמוד, ולכן אין למה לקשר. פריט ולא קישור, והטקסט
         אומר במפורש שאיננו מוכרים אותו. */
      if (x.status === 'reference') {
        return '        <li><span class="noown"><b>' + ltr(x.name) + '</b>' +
          '<span>' + esc(x.brand) + ' · לא נמכר אצלנו, מופיע כאן להשוואה</span></span></li>';
      }
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
        '    <p class="aside">"גדול יותר" אינו "טוב יותר". מסך גדול שוקל יותר, וסוללה גדולה תופסת נפח. מה מכריע אצלכם? זה בדיוק מה שנעבור עליו יחד.</p>\n' +
        '  </div>\n</section>\n\n';
    })() +

    '<section class="block" id="table" aria-labelledby="cmp-h">\n  <div class="wrap box">\n' +
    '    <h2 id="cmp-h">מה שונה ביניהם</h2>\n' +
    '    <p class="lead">רק השדות שבהם שני הדגמים לא זהים. ' + sameMoreTxt(d.same) +
    ' בשניהם, ולכן אין טעם להציג אותם.</p>\n' +
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
        (pair[0].status === 'reference' ? ''
          : '        <p class="aside"><a href="/phones/' + pair[0].slug + '/">המפרט המלא של ' +
            esc(pair[0].name_he || pair[0].name) + '</a></p>') + '\n      </div>';
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
  /* .noown נכתב כאן ולא נשלף, כי הוא נולד בעמוד ההשוואה ואינו קיים בשום מקום
     אחר: פריט של מכשיר ייחוס, שאין לו עמוד ולכן אין לאן ללחוץ. */
  return '/* .hub — נשלף מ-guides/index.html בזמן החילול. עותק אחד, ואין מה לסחוף. */\n' + block +
    '\n.hub .noown{display:block;color:var(--ink-soft)}\n.hub .noown b{color:var(--ink-strong)}';
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


/* המותגים בסדר קבוע, וכל מותג עם הלוגו שלו במידות שנמדדו. הלוגואים נמחקו ב-eb07517 כשהכלי
   כבר לא היה קיים ולכן איש לא הפנה אליהם, ושוחזרו מגיט יחד איתו. */
var BRAND_LOGO = { Apple: ['apple', 15, 18], Samsung: ['samsung', 34, 12], Xiaomi: ['xiaomi', 16, 16] };

var TOOL_CSS = [
  chipCss(),
  /* הכלי המתקדם: בורר תאים, מיקוד קטגוריה, טבלה מוקפאת בשני צירים והסבר לכל שדה.
     הועבר לכאן ב-15.8.2026 אחרי שנבנה ביד בתוך העמוד המיוצר ונמחק בהרצת מחולל.
     כל עוד הוא חי כאן, הרצה חוזרת משחזרת אותו במקום למחוק אותו. */
  ".picker{position:sticky;top:66px;z-index:80;background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}\n@media(max-width:980px){\n.picker{top:0}\n}\n.picker .row{display:flex;align-items:baseline;gap:1.4rem;flex-wrap:wrap;padding-block:.85rem}\n.picker .lbl{font-weight:800;font-size:1.06rem;color:var(--ink-strong)}\n.picker .tabs{display:flex;flex-wrap:wrap;gap:1.3rem}\n.picker .hint{font-size:.94rem;color:var(--ink-soft);margin-inline-start:auto}\n@media(max-width:760px){\n.picker{position:relative}\n.picker .row{flex-direction:column;align-items:stretch;flex-wrap:nowrap;gap:.15rem;\r\n    padding-block:.45rem;overflow:visible}\n.picker .lbl{flex:none;display:flex;align-items:center;justify-content:space-between;gap:.6rem}\n.picker .lbl::after{content:attr(data-pos);font-family:var(--mono);font-size:.86rem;\r\n    font-weight:400;letter-spacing:.06em;color:var(--ink-soft)}\n.picker .tabs{flex:none;flex-wrap:nowrap;overflow-x:auto;gap:1.25rem;scrollbar-width:none;\r\n    -webkit-overflow-scrolling:touch;scroll-padding-inline:14px}\n.picker .tabs::-webkit-scrollbar{display:none}\n.picker .hint{display:none}\n.picker.can-scroll::after{content:\"\";position:absolute;inset-block-end:.45rem;height:44px;\r\n    inset-inline-start:0;width:34px;\r\n    background:linear-gradient(to left,rgba(255,255,255,0),rgba(255,255,255,.96));\r\n    pointer-events:none;z-index:1}\n}\n.cmp-wrap{margin-top:1.8rem;overflow-x:auto;-webkit-overflow-scrolling:touch}\n.cmp-wrap:focus-visible{outline:2px solid var(--teal);outline-offset:4px}\n.cmp-spec .grp th{border-top:2px solid var(--ink-strong);padding-block:1.6rem .55rem;font-family:var(--font);font-weight:700;font-size:1.02rem;letter-spacing:.07em;color:var(--ink-strong);text-align:start;width:auto}\n.cmp-spec tbody:first-of-type .grp th{border-top:0;padding-block-start:1rem}\n.cmp-wrap{max-width:100%}\n.cmp-vs .grp+.fld th{border-top:0}\n.dstate{position:sticky;inset-block-start:66px;z-index:70;background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-block-end:1px solid var(--line);padding-block:.9rem;margin-block-start:1.8rem;display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem}\n@media(max-width:980px){\n.qcount,.dstate{inset-block-start:0}\n}\n.dstate p{margin:0;color:var(--ink-soft);font-size:1rem}\n.dstate b{color:var(--ink-strong);font-weight:700}\n.dstate button{margin-inline-start:auto}\n.dstate .btn-sm{padding-block:.78rem}\n.dstate .btn-teal{background:none;color:var(--teal-d);border:1px solid var(--line)}\n.dstate .btn-teal:hover{background:#f2f6f8;border-color:var(--teal-d)}\n.dempty{margin-top:1.8rem;border-block-start:1px solid var(--line);padding-block-start:1.4rem;color:var(--ink-soft);line-height:1.8}\n.dslots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.6rem;margin-block-start:1.5rem;list-style:none;padding:0}\n.dslot{border:1px solid var(--line);border-radius:6px;min-height:66px;display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem}\n.dslot .lbl{font-family:var(--mono);font-size:.86rem;letter-spacing:.06em;color:var(--ink-soft);display:block}\n.dslot .nm{font-weight:700;color:var(--ink-strong);font-size:1.02rem;line-height:1.35;display:block}\n.dslot.empty{border-style:dashed}\n.dslot.empty .nm{font-weight:500;color:var(--ink-soft)}\n.dslot .drop{margin-inline-start:auto;background:none;border:0;cursor:pointer;color:var(--ink-soft);font-size:1.25rem;line-height:1;padding:.8rem;border-radius:6px;min-inline-size:44px}\n.dslot .drop:hover{color:var(--teal-d);background:#f2f6f8}\n@media(max-width:720px){\n.dslots{grid-template-columns:1fr}\n.dslot{min-height:58px}\n}\n.dbrand{font-family:var(--mono);font-size:.98rem;letter-spacing:.08em;color:var(--ink-strong);margin-block:1.7rem .1rem;padding-block-end:.45rem;border-block-end:1px solid var(--ink-strong)}\n.dbrand{display:flex;align-items:center;gap:.55rem}\n.blogo{display:inline-block;width:auto;flex:none}\n.cmp-grid thead .blogo-apple{height:14px}\n.cmp-grid thead .blogo-samsung{height:10px}\n.cmp-grid thead .blogo-xiaomi{height:13px}\n.cmp-grid thead th{white-space:nowrap}\n.cmp-grid thead th .blogo{display:inline-block;vertical-align:-.12em;margin-inline-end:.4rem}\n.dfocus{display:flex;flex-wrap:wrap;gap:.5rem;margin-block-start:1.5rem;align-items:center}\n.dfocus .fl{font-size:.98rem;color:var(--ink-soft);margin-inline-end:.15rem}\n.dfocus button{font-family:inherit;font-size:.98rem;font-weight:600;color:var(--ink);background:none;border:1px solid var(--line);border-radius:999px;padding:.75rem 1.05rem;cursor:pointer;transition:border-color .2s,color .2s,background .2s}\n.dfocus button:hover{border-color:var(--teal-d);color:var(--teal-d)}\n.dfocus button[aria-pressed=\"true\"]{background:var(--teal);border-color:var(--teal);color:#fff}\n.cmp-grid{width:100%;min-width:0;border-collapse:collapse;text-align:start}\n.cmp-grid th,.cmp-grid td{border-block-start:1px solid var(--line);padding:.9rem 1.05rem;vertical-align:top;line-height:1.7;text-align:start}\n.cmp-grid thead th{border-block-start:0;border-block-end:2px solid var(--ink-strong);font-family:var(--font);font-weight:700;font-size:1.02rem;padding-block:0 .7rem}\n.cmp-grid tbody th[scope=\"row\"]{font-family:var(--font);font-weight:700;color:var(--ink-strong);position:sticky;inset-inline-start:0;background:#fff;z-index:1;min-width:9rem}\n.cmp-grid td{color:var(--ink-soft)}\n.cmp-grid .grp th{border-block-start:2px solid var(--ink-strong);padding-block:1.5rem .5rem;font-family:var(--mono);font-size:.98rem;letter-spacing:.08em;color:var(--ink-strong);background:#fff}\n.cmp-grid tbody:first-of-type .grp th{border-block-start:0;padding-block-start:.9rem}\n.cmp-grid td i{font-style:italic}\n@media(max-width:720px){\n.cmp-grid th,.cmp-grid td{padding:.8rem .5rem}\n.cmp-grid tbody th[scope=\"row\"]{min-width:5.5rem;max-inline-size:5.5rem}\n}\n.cmp-wrap{overflow-x:visible}\n.cmp-grid thead th{position:sticky;inset-block-start:146px;z-index:2;background:#fff}\n@media(max-width:980px){\n.cmp-grid thead th{inset-block-start:80px}\n}\n@media(max-width:900px){\n.cmp-wrap{overflow-x:auto}\n.cmp-grid thead th{position:static}\n.cmp-grid thead th:not(:first-child),.cmp-grid td{min-width:6.5rem}\n}\n.cmp-grid .mean td{border-block-start:0;padding-block:0 1rem;color:var(--ink-soft);font-size:.98rem;line-height:1.7}\n.cmp-grid .mean b{color:var(--teal-d);font-weight:700}\n.cmp-grid .mean span{display:inline-block;max-inline-size:78ch}\n.cmp-grid tr.mean{display:none}\n.cmp-grid tr.mean.open{display:table-row}\n@media(hover:hover) and (pointer:fine){\n.cmp-grid tr.vrow:hover>*{background:#f6fafb}\n}\n.cmp-grid .fx{font:inherit;color:inherit;background:none;border:0;padding:0;text-align:start;cursor:pointer;display:inline-flex;align-items:center;gap:.45rem;min-height:44px}\n.cmp-grid .fx::after{content:\"?\";display:inline-grid;place-items:center;inline-size:1.2rem;block-size:1.2rem;border:1px solid var(--line);border-radius:50%;font-family:var(--mono);font-size:.8rem;font-weight:700;color:var(--ink-soft);flex:none;transition:background .15s,border-color .15s,color .15s}\n.cmp-grid .fx:hover::after,.cmp-grid .fx[aria-expanded=\"true\"]::after{background:var(--teal);border-color:var(--teal);color:#fff}\n.cmp-grid .fx:focus-visible{outline:2px solid var(--teal);outline-offset:3px}\n.cmp-grid td.na{color:var(--ink-soft)}\n.cmp-grid td.na span[aria-hidden]{font-family:var(--mono);font-size:1.1rem;opacity:.55}\n.dslot.sc0{border-inline-start:3px solid var(--teal)}\n.dslot.sc1{border-inline-start:3px solid var(--purple)}\n.dslot.sc2{border-inline-start:3px solid var(--orange)}\n.cmp-grid thead th.sc0,.cmp-grid thead th.sc1,.cmp-grid thead th.sc2{border-block-end-width:3px}\n.cmp-grid thead th.sc0{border-block-end-color:var(--teal)}\n.cmp-grid thead th.sc1{border-block-end-color:var(--purple)}\n.cmp-grid thead th.sc2{border-block-end-color:var(--orange)}\n.cmp-grid .vch{display:inline-block;border:1px solid var(--line);border-radius:4px;padding:.1rem .5rem;margin:0 0 .3rem .35rem;font-size:.98rem;line-height:1.6;white-space:nowrap}\n.cmp-grid .nv{font-family:var(--mono);font-size:1.3rem;font-weight:700;color:var(--ink-strong);line-height:1.25}\n.cmp-grid .fx::after{content:none}\n.cmp-grid .fxi{display:inline-grid;place-items:center;inline-size:1.2rem;block-size:1.2rem;border:1px solid var(--line);border-radius:50%;font-family:var(--mono);font-size:.8rem;font-weight:700;font-style:normal;color:var(--ink-soft);flex:none;transition:background .15s,border-color .15s,color .15s}\n.cmp-grid .fxi:hover,.cmp-grid .fx:focus-visible .fxi{background:var(--teal);border-color:var(--teal);color:#fff}\n.minfo{position:absolute;z-index:80;max-inline-size:min(34rem,88vw);background:#fff;border:1px solid var(--ink-strong);border-radius:8px;box-shadow:var(--shadow-sm);padding:.85rem 1rem;color:var(--ink);font-size:.98rem;line-height:1.7}\n.minfo b{color:var(--teal-d);font-weight:700}\n.minfo::before{content:\"\";position:absolute;left:var(--ax,16px);inset-block-start:-6px;inline-size:10px;block-size:10px;background:#fff;border-inline-start:1px solid var(--ink-strong);border-block-start:1px solid var(--ink-strong);transform:rotate(45deg)}\n.cmp-wrap{background:#fcfcfd;border:1px solid var(--line);border-radius:10px;padding:.2rem 1.1rem 1.1rem}\n.cmp-grid thead th,.cmp-grid tbody th[scope=\"row\"],.cmp-grid .grp th{background:#fcfcfd}\n@media(max-width:900px){\n.cmp-wrap{padding:.2rem .55rem .55rem;border-radius:8px}\n}\n.dslots.two{grid-template-columns:repeat(2,minmax(0,1fr))}\n.dadd{grid-column:1/-1;justify-self:start;font-family:inherit;font-size:.98rem;font-weight:600;color:var(--teal-d);background:none;border:1px dashed var(--line);border-radius:6px;padding:.7rem 1.1rem;cursor:pointer;min-height:44px}\n.dadd:hover{border-color:var(--teal-d);background:#f2f6f8}\n.dfocus .sep{margin-inline-start:.35rem}\n.dfocus .sep::before{content:\"\";display:inline-block;inline-size:.85rem;block-size:.85rem;border:1px solid var(--ink-soft);border-radius:3px;margin-inline-end:.5rem;vertical-align:-.04em;transition:background .2s,border-color .2s}\n.dfocus .sep[aria-pressed=\"true\"]{background:none;color:var(--ink);border-color:var(--line)}\n.dfocus .sep[aria-pressed=\"true\"]::before{background:var(--teal);border-color:var(--teal)}\n.dfocus .sep:hover{border-color:var(--teal-d);color:var(--teal-d)}\nfooter .fl{list-style:none;padding:0;margin:0;display:grid;gap:.45rem}\n@media(max-width:820px){\nfooter .fl a{display:inline-flex;align-items:center;min-height:44px}\nfooter .fl a bdo{font-size:1.3rem;font-weight:700;letter-spacing:.02em}\n}\nhtml.a11y-contrast-high :is(header.site,.picker,main,footer.site){filter:contrast(1.35)}\nhtml.a11y-contrast-invert :is(header.site,.picker,main,footer.site){filter:invert(1) hue-rotate(180deg)}\nhtml.a11y-contrast-mono :is(header.site,.picker,main,footer.site){filter:grayscale(1) contrast(1.08)}"
  ,
  /* גילוי נאות על מכשיר שאיננו מוכרים. קו בצד ולא משטח צבוע, כמו כל הערה במערכת הזאת:
     המילים נושאות את המשקל ולא רקע. .noown כבר מעוצב ומגיע מעמודי ההשוואה הכתובים. */
  '.dnote{margin:1.4rem 0 0;border-inline-start:3px solid var(--orange);padding-inline-start:1.1rem;color:var(--ink-soft);line-height:1.75}'
].join('\n');

function toolMain(openTag, index, order, pairCount) {
  /* כולל מכשירי ייחוס: דגמים שאיננו מוכרים, שקיימים כדי שאפשר יהיה להשוות אליהם. הם מסומנים
     בבורר ונושאים גילוי נאות, כי לקוח שרואה דגם ברשימה שלנו מניח שאנחנו מוכרים אותו, וזו בדיוק
     הטעות שקרתה פעם ב-galaxy-a56 וב-xiaomi-15. */
  var live = db.devices.filter(function (d) { return d.status !== 'draft'; }).sort(function (a, b) {
    return a.brand === b.brand ? 0 : (a.brand < b.brand ? -1 : 1);
  });
  var sellable = live.filter(function (d) { return d.status !== 'reference'; });
  /* מקובצים לפי מותג, כמו בכלי המקורי. הסדר נקבע ב-BRAND_LOGO ולא לפי א-ב, כדי שאפל תהיה
     ראשונה ושהוספת מותג רביעי תהיה החלטה מפורשת ולא תוצאה של מיון. מותג בלי לוגו עדיין מופיע,
     אחרת דגם שנוסף למאגר היה נעלם מהבורר בשקט. */
  var brands = Object.keys(BRAND_LOGO).map(function (b) {
    return { brand: b, items: live.filter(function (d) { return d.brand === b; }) };
  }).filter(function (g) { return g.items.length; });
  live.forEach(function (d) {
    if (!BRAND_LOGO[d.brand] && !brands.some(function (g) { return g.brand === d.brand; })) {
      brands.push({ brand: d.brand, items: live.filter(function (x) { return x.brand === d.brand; }) });
    }
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
  '    <p class="lead">שניים להשוואה, ואפשר להוסיף שלישי. הטבלה מתעדכנת ברגע שבוחרים, ולכל שדה יש הסבר מה ההבדל אומר.</p>\n' +
  /* התאים נבנים ב-JS. hidden כאן ולא display:none, כדי שלפני שנבחר משהו לא תהיה רשימה ריקה. */
  '    <ul class="dslots" id="dslots" hidden></ul>\n' +
  '    <div id="dpick">\n' +
  brands.map(function (b) {
    var L = BRAND_LOGO[b.brand] || null;
    return '      <p class="dbrand">' + (L ? '<img class="blogo blogo-' + L[0] + '" src="/logos/' + L[0] +
      '.png" alt="" width="' + L[1] + '" height="' + L[2] + '" loading="lazy" decoding="async">' : '') +
      esc(b.brand) + '</p>\n      <ul class="dpick">\n' +
      b.items.map(function (d) {
        return '        <li><button type="button" class="chip" data-slug="' + esc(d.slug) +
          '" aria-pressed="false">' + ltr(d.name) + '</button></li>';
      }).join('\n') + '\n      </ul>';
  }).join('\n') + '\n    </div>\n' +
  '    <div class="dstate">\n' +
  '      <p id="dstate" role="status">בחרו שני דגמים כדי לראות את ההבדלים.</p>\n' +
  '      <button type="button" class="btn btn-teal btn-sm" id="dclear" hidden>נקו את הבחירה</button>\n' +
  '    </div>\n' +
  /* פאנל אחד שכל סימני השדות חולקים, ומחוץ ל-#dout כדי שרינדור מחדש לא ימחק אותו. */
  '    <div class="minfo" id="minfo" role="status" hidden></div>\n' +
  /* לא aria-live: render() מחליף את כל תת-העץ, ואזור חי כאן היה מקריא את הטבלה כולה
   * בכל לחיצה. #dstate מכריז את הסיכום במקום. */
  '    <div id="dout">\n' +
  '      <p class="dempty">אחרי שתבחרו, כאן תופיע טבלה עם השדות השונים בלבד. אם JavaScript כבוי, ' +
  '<a href="/compare/">מרכז ההשוואות</a> מכיל את ההשוואות המוכנות בלי צורך בכלי.</p>\n' +
'    </div>\n  </div>\n</section>\n\n' +

  '<section class="block" id="how" aria-labelledby="how-h">\n  <div class="wrap box">\n' +
  '    <h2 id="how-h">איך הכלי מחשב את ההבדלים</h2>\n' +
  '    <div class="prose">\n' +
  '      <p>רשימת השדות השונים בכל זוג מחושבת מראש, מאותו קוד שבונה את עמודי ההשוואה הקבועים. לכן הכלי והעמודים לא יכולים להגיד שני דברים שונים על אותם שני דגמים.</p>\n' +
  '      <p>שדה שאף אחד מהיצרנים אינו מפרסם אינו נחשב הבדל ואינו מוצג. שדה שרק יצרן אחד מפרסם כן מוצג, והצד השני מסומן כלא מפורסם ולא כאפס.</p>\n' +
  '      <p>אין כאן מחיר ואין הכרזה מי טוב יותר. את המחיר תקבלו מאיתנו כי הוא משתנה, ועל ההחלטה נעבור איתכם.</p>\n' +
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
  "/* כלי ההשוואה. אין כאן חישוב הבדלים: PAIRS מכיל את התוצאה של diffSpec מהמחולל, כלומר\n   שמות השדות שנמצאו שונים בכל זוג. הערכים נשלפים מ-devices.json בזמן ריצה. כך ההחלטה\n   \"מה שונה\" חיה במקום אחד בלבד, ואי אפשר שהכלי והעמוד הקבוע יגידו דברים שונים. */\n(function(){\n  \"use strict\";\n  \n  \n  var PAIRS=" + json(index) + 
  ";\n  var ORDER=" + json(order) + 
  ";\n  /* MAX is the ceiling; slots is what is actually on screen. Three at once muddled the\n     comparison, so two is the default and the third is asked for. */\n  var MAX=3, slots=2, sel=[], DB=null, focus=null, means=false;\n  /* One sentence per field, keyed by the spec key. Written once and reused across all 136 pairs.\n     It says what the difference MEANS, never who wins: the page declares no winner, and several of\n     these exist precisely to stop a bigger number reading as a better one. */\n  /* Fields where the leading figure may be set in display size. Deliberately short: cpu, gpu, ram,\n     the camera megapixels and the battery hours are all excluded, because each of those carries an\n     explanation saying the number is not comparable, and typesetting it large would argue the\n     opposite of the sentence beneath it. */\n  var NUMOK={screen_size:1,weight:1,brightness:1,security_updates:1};\n  var MEANS={\"screen_size\":\"ההפרש נמדד באלכסון. מסך גדול יותר נוח לקריאה ולסרטונים, וקטן יותר נכנס לכיס ומאפשר שימוש ביד אחת.\",\"screen_type\":\"ב-OLED כל פיקסל מאיר בעצמו, ולכן השחור עמוק והניגודיות גבוהה. LCD עובד בתאורה אחורית אחידה, והחלפה שלו זולה יותר אם המסך נשבר.\",\"resolution\":\"מספר הפיקסלים, וה-ppi הוא הצפיפות שלהם. מעל כ-400 קשה להבחין בפיקסל בודד במרחק שימוש רגיל.\",\"refresh_rate\":\"כמה פעמים בשנייה המסך מתרענן. 120Hz נראה חלק יותר בגלילה וגם צורך יותר סוללה, ולכן רוב המכשירים מורידים אותו לבד כשאין תנועה.\",\"brightness\":\"ניט הוא מדד בהירות, והמספר הזה הוא שיא לרגעים קצרים בשמש. הוא לא הבהירות שתראו בשימוש רגיל בבית.\",\"chip\":\"המעבד קובע בעיקר כמה המכשיר ירגיש מהיר בעוד שלוש שנים. כמעט כל שבב חדש מריץ היום בלי בעיה את מה שרוב האנשים עושים.\",\"cpu\":\"מספר הליבות אינו בר השוואה בין יצרנים. שש ליבות של אפל ועשר של אנדרואיד הן ארכיטקטורות שונות, ולא אותו דבר בכמות אחרת.\",\"gpu\":\"רלוונטי בעיקר למשחקים כבדים ולעריכת וידאו. בגלילה, במצלמה וברשתות חברתיות זה לא מורגש.\",\"ram\":\"זיכרון העבודה קובע כמה אפליקציות נשארות פתוחות ברקע בלי להיטען מחדש. אפל מסתדרת עם פחות בגלל האופן שבו iOS מנהל אותו, ולכן אין טעם להשוות את המספר מול אנדרואיד.\",\"storage_offered\":\"ברוב המכשירים הנפח אינו ניתן לשינוי אחרי הקנייה, ולכן זו ההחלטה שהכי כדאי לא לחסוך בה.\",\"storage_expandable\":\"האם אפשר להוסיף כרטיס זיכרון. ברוב המכשירים החדשים כבר לא.\",\"camera_main\":\"מגה-פיקסל הוא כמות ולא איכות. גודל החיישן, הצמצם ועיבוד התמונה משפיעים על התוצאה יותר מהמספר הזה.\",\"camera_extra\":\"עדשות נוספות, לרוב רחבה במיוחד לנופים או מקרו לצילום מקרוב.\",\"zoom\":\"זום אופטי מקרב בעדשה עצמה ושומר על האיכות. זום דיגיטלי חותך את התמונה ומגדיל אותה, ולכן האיכות יורדת.\",\"camera_front\":\"המצלמה הקדמית, לסלפי ולשיחות וידאו.\",\"video\":\"רזולוציית הצילום וקצב הפריימים. 60 פריימים נראה חלק יותר, ותופס בערך פי שניים מקום.\",\"battery\":\"היצרנים מודדים אחרת: אפל בשעות וידאו ואנדרואיד ב-mAh, ולכן אי אפשר להשוות ביניהם ישירות. בפועל התוצאה תלויה בעיקר בבהירות המסך ובאיכות הקליטה.\",\"charging_wired\":\"מהירות הטעינה בכבל. שווה לבדוק אם המטען שנדרש למהירות הזאת מגיע באריזה.\",\"charging_wireless\":\"טעינה על משטח בלי כבל. איטית יותר מטעינה בכבל, וגם מחממת יותר.\",\"dimensions\":\"הרוחב הוא מה שקובע אם המכשיר נוח ביד, יותר מהגובה.\",\"weight\":\"הבדל של כ-20 גרם ומעלה מורגש אחרי כמה שעות של החזקה ביד.\",\"water_resistance\":\"IP68 נמדד בטבילה בתנאי מעבדה, ולא בים או בבריכה. האחריות של היצרן אינה מכסה נזקי נוזלים, וגם אצלנו זה התיקון היחיד שאין עליו אחריות.\",\"colors_manufacturer\":\"הצבעים שהיצרן מייצר. לא כולם מגיעים לארץ, ולא כולם זמינים בכל נפח.\",\"sim\":\"eSIM הוא קו דיגיטלי בלי כרטיס פיזי. במכשיר שיש בו eSIM בלבד שווה לוודא מול המפעיל שלכם שהוא תומך, לפני הקנייה.\",\"esim\":\"כמה קווים דיגיטליים אפשר להחזיק במכשיר במקביל.\",\"connectivity\":\"5G, Wi-Fi ובלוטות׳. ההבדלים כאן מורגשים בעיקר למי שמעביר קבצים גדולים או משתמש באביזרים חדשים.\",\"box_contents\":\"מה מגיע באריזה. בחלק מהמכשירים כבר אין מטען, אלא כבל בלבד.\",\"security_updates\":\"כמה שנים היצרן מתחייב לעדכוני אבטחה. זה מה שקובע כמה זמן בטוח להשתמש במכשיר, ולא מתי הוא מפסיק לעבוד.\",\"model_numbers\":\"מספר הדגם מזהה את הגרסה. גרסאות שונות של אותו דגם מגיעות לפעמים עם מפרט שונה בשווקים שונים.\"};\n  var wrap=document.getElementById(\"dpick\"), out=document.getElementById(\"dout\"),\n      state=document.getElementById(\"dstate\"), clear=document.getElementById(\"dclear\");\n  if(!wrap||!out) return;\n  function esc(s){return String(s).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\");}\n  function ltr(s){return '<bdo dir=\"ltr\">'+esc(s)+\"</bdo>\";}\n  var RUN=/[A-Za-z0-9][A-Za-z0-9.,:%\\/+–\\-]*(?:[ ]+[A-Za-z0-9][A-Za-z0-9.,:%\\/+–\\-]*)*/g;\n  function ltrRuns(raw) {\n    if (raw === null || raw === undefined) return '';\n    var s = String(raw), out = '', last = 0, m;\n    RUN.lastIndex = 0;\n    while ((m = RUN.exec(s)) !== null) {\n      var run = m[0];\n      /* פיסוק בסוף הריצה הוא של המשפט העברי ולא של הריצה, ולכן הוא נשאר בחוץ */\n      var core = run.replace(/[.,:\\s]+$/, '');\n      var tail = run.slice(core.length);\n      out += esc(s.slice(last, m.index));\n      if (/[A-Za-z]/.test(core)) out += '<bdo dir=\"ltr\">' + esc(core) + '</bdo>' + esc(tail);\n      else out += esc(run);\n      last = m.index + run.length;\n    }\n    return out + esc(s.slice(last));\n  }\n  \n  function dev(sl){for(var i=0;i<DB.devices.length;i++){if(DB.devices[i].slug===sl)return DB.devices[i];}return null;}\n  function keysFor(a,b){var p=PAIRS[a+\"|\"+b]||PAIRS[b+\"|\"+a];return p?{k:p.k?p.k.split(\"|\"):[],s:p.s}:null;}\n  function val(v){return Array.isArray(v)?v.join(\", \"):v;}\n\n  /* מדידה. הכלי לא מדד כלום עד 15.8.2026, ולכן לא היה אפשר לומר אם מישהו משתמש בו.\n     דוחף ל-dataLayer ישירות ולא דרך track(): track מוגדר בדפי תוכן אחרים ולא כאן, ועותק שלו\n     כאן היה מקור אמת שני. GTM לא נטען מחוץ לפרודקשן, אבל ה-dataLayer כן, ולכן החיווט בדיק. */\n  function push(ev,d){try{window.dataLayer=window.dataLayer||[];var o={event:ev};for(var k in d)o[k]=d[k];window.dataLayer.push(o);}catch(e){}}\n  var SLOT=[\"א׳\",\"ב׳\",\"ג׳\"];\n  function d0(id){return id?document.getElementById(id):null;}\n  /* The panel: one element, placed under whichever marker asked for it. Document coordinates, so\n     it travels with the page and needs no repositioning on scroll. */\n  var panel=document.getElementById(\"minfo\"), infoFor=null;\n  var canHover=false; try{canHover=window.matchMedia(\"(hover:hover) and (pointer:fine)\").matches;}catch(e){}\n  function hideInfo(){ if(!panel) return; panel.hidden=true; infoFor=null; }\n  function showInfo(btn,on){\n    if(!panel) return;\n    if(!on){ hideInfo(); return; }\n    var key=btn.getAttribute(\"data-mean\"); if(!MEANS[key]) return;\n    panel.innerHTML='<b>מה זה אומר</b> '+esc(MEANS[key]);\n    panel.hidden=false;\n    var r=(btn.querySelector(\".fxi\")||btn).getBoundingClientRect();\n    var top=r.bottom+window.scrollY+8;\n    /* anchored to the marker, then pulled back inside the viewport if it would hang off the edge */\n    panel.style.insetInlineStart=\"auto\"; panel.style.insetInlineEnd=\"auto\";\n    panel.style.left=\"0px\"; panel.style.top=top+\"px\";\n    var w=panel.offsetWidth;\n    var left=Math.min(Math.max(8,r.right-w),document.documentElement.clientWidth-w-8);\n    panel.style.left=left+\"px\";\n    var arrow=Math.min(Math.max(10,r.left+r.width/2-left-5),w-20);\n    panel.style.setProperty(\"--ax\",arrow+\"px\");\n    infoFor=btn;\n  }\n  /* Hover is scoped to the marker itself, not the whole label: hovering the label would open a\n     panel at every field the pointer crosses on its way down the column. And hover is only ever an\n     addition, never the only way in, since a phone has no hover and a keyboard has no pointer. */\n  if(canHover){\n    out.addEventListener(\"pointerover\",function(e){var i=e.target.closest&&e.target.closest(\".fxi\"); if(i) showInfo(i.closest(\".fx\"),true);});\n    out.addEventListener(\"pointerout\",function(e){var i=e.target.closest&&e.target.closest(\".fxi\"); if(i&&i.closest(\".fx\")===infoFor) hideInfo();});\n  }\n  out.addEventListener(\"focusin\",function(e){var b=e.target.closest&&e.target.closest(\".fx\"); if(b) showInfo(b,true);});\n  out.addEventListener(\"focusout\",function(e){var b=e.target.closest&&e.target.closest(\".fx\"); if(b&&b===infoFor) hideInfo();});\n  document.addEventListener(\"keydown\",function(e){ if(e.key===\"Escape\") hideInfo(); });\n  document.addEventListener(\"click\",function(e){ if(infoFor&&!(e.target.closest&&(e.target.closest(\".fx\")||e.target.closest(\"#minfo\")))) hideInfo(); });\n  function catsOf(rows){var out=[],m={};rows.forEach(function(r){if(!m[r[0]]){m[r[0]]=1;out.push(r[0]);}});return out;}\n  function syncChips(){Array.prototype.forEach.call(wrap.querySelectorAll(\".chip\"),function(c){\n    var i=sel.indexOf(c.getAttribute(\"data-slug\"));\n    c.setAttribute(\"aria-pressed\", i>=0?\"true\":\"false\");\n    c.classList.remove(\"sc0\",\"sc1\",\"sc2\");\n    if(i>=0) c.classList.add(\"sc\"+i);});}\n  /* the selection is the whole state, so it belongs in the URL. replaceState and not pushState:\n     every chip press would otherwise become a back-button step. */\n  function syncURL(){try{history.replaceState(null,\"\",sel.length?\"?d=\"+sel.join(\",\"):location.pathname);}catch(e){}}\n  function fromURL(){try{var m=/[?&]d=([^&]+)/.exec(location.search);if(!m)return [];\n    return decodeURIComponent(m[1]).split(\",\").filter(function(s){return !!dev(s);}).slice(0,MAX);}catch(e){return [];}}\n\n  function renderSlots(){\n    var box=document.getElementById(\"dslots\"); if(!box) return;\n    box.hidden=false; box.className=\"dslots\"+(slots<3?\" two\":\"\"); var html=\"\";\n    for(var i=0;i<slots;i++){\n      var sl=sel[i], d=sl?dev(sl):null;\n      html+=d\n        ? '<li class=\"dslot sc'+i+'\"><span><span class=\"lbl\">מכשיר '+SLOT[i]+'</span><span class=\"nm\">'+ltr(d.name)+'</span></span>'+\n          '<button type=\"button\" class=\"drop\" data-drop=\"'+esc(sl)+'\" aria-label=\"הסרת '+esc(d.name_he||d.name)+' מההשוואה\">&times;</button></li>'\n        : '<li class=\"dslot empty\"><span><span class=\"lbl\">מכשיר '+SLOT[i]+'</span><span class=\"nm\">'+(i<2?\"בחרו דגם\":\"אפשר גם שלישי\")+'</span></span></li>';\n    }\n    if(slots<MAX) html+='<li><button type=\"button\" class=\"dadd\" data-add=\"1\">הוסיפו מכשיר שלישי</button></li>';\n    box.innerHTML=html;\n  }\n\n  function render(){\n    var names=sel.map(function(s){var d=dev(s);return d?(d.name_he||d.name):s;});\n    renderSlots(); syncURL();\n    if(sel.length<2){\n      focus=null;\n      state.innerHTML=sel.length?\"נבחר \"+esc(names[0])+\". בחרו עוד אחד לפחות.\":\"בחרו שני דגמים כדי לראות את ההבדלים.\";\n      clear.hidden=!sel.length;\n      out.innerHTML='<p class=\"dempty\">אחרי שתבחרו שני דגמים, כאן תופיע טבלה עם השדות שבהם הם שונים, '+\n        'ומתחת לכל שדה הסבר מה ההבדל אומר בפועל.</p>';\n      return;\n    }\n    clear.hidden=false;\n    /* שדה שונה בין שלושה אם ורק אם הוא שונה באחד הזוגות. איחוד קבוצות, לא אלגוריתם חדש. */\n    var set={}, same=null, missingPair=false;\n    for(var i=0;i<sel.length;i++){for(var j=i+1;j<sel.length;j++){\n      var p=keysFor(sel[i],sel[j]);\n      if(!p){missingPair=true;continue;}\n      p.k.forEach(function(k){set[k]=1;});\n      if(sel.length===2) same=p.s;\n    }}\n    if(missingPair){out.innerHTML='<p class=\"dempty\">לא הצלחנו לחשב את ההשוואה הזאת. <a href=\"/compare/\">ההשוואות המוכנות</a> זמינות תמיד.</p>';return;}\n    var diff=ORDER.filter(function(r){return set[r[1]];});\n    var cats=catsOf(diff);\n    /* a focus left over from the previous pair may not exist in this one */\n    if(focus && cats.indexOf(focus)<0) focus=null;\n    var shown=focus?diff.filter(function(r){return r[0]===focus;}):diff;\n    state.innerHTML=\"<b>\"+names.map(esc).join(\" מול \")+\"</b> · \"+diff.length+\" שדות שונים\"+\n      (same!==null?\" · \"+same+\" זהים\":\"\");\n\n    var fh='<div class=\"dfocus\"><span class=\"fl\">מה חשוב לכם:</span>'+\n      '<button type=\"button\" data-cat=\"\" aria-pressed=\"'+(focus?\"false\":\"true\")+'\">הכל ('+diff.length+')</button>';\n    cats.forEach(function(c){\n      var n=0; diff.forEach(function(r){if(r[0]===c)n++;});\n      fh+='<button type=\"button\" data-cat=\"'+esc(c)+'\" aria-pressed=\"'+(focus===c?\"true\":\"false\")+'\">'+esc(c)+' ('+n+')</button>';\n    });\n    fh+='<button type=\"button\" class=\"sep\" data-means=\"1\" aria-pressed=\"'+(means?\"true\":\"false\")+'\">כל ההסברים</button></div>';\n\n    var ds=sel.map(dev), cat=null, body=\"\", bodyOpen=false, span=ds.length+1;\n    /* גילוי נאות. מי שקורא השוואה צריך לדעת שלכותב יש אינטרס בצד אחד, וזו בדיוק הסיבה\n       שדגם שאיננו מוכרים מסומן ולא מוסתר. אותו כלל שעמודי ההשוואה הכתובים כבר מקיימים. */\n    var refs=ds.filter(function(d){return d&&d.own===false;});\n    var disc=refs.length?'<p class=\"dnote\">'+\n      (refs.length===1?'את ':'את ')+refs.map(function(d){return esc(d.name_he||d.name);}).join(' ואת ')+\n      (refs.length===1?' איננו מוכרים':' איננו מוכרים')+', והוא כאן כדי שאפשר יהיה להשוות אליו. את המפרט לקחנו מאתר היצרן.</p>':'';\n    shown.forEach(function(r){\n      if(r[0]!==cat){ if(bodyOpen) body+=\"</tbody>\"; cat=r[0];\n        body+='<tbody><tr class=\"grp\"><th colspan=\"'+span+'\" scope=\"colgroup\">'+esc(cat)+\"</th></tr>\"; bodyOpen=true; }\n      var mid=\"m-\"+r[2];\n      body+='<tr class=\"vrow\"><th scope=\"row\">'+(MEANS[r[2]]\n        ? '<button type=\"button\" class=\"fx\" aria-describedby=\"'+mid+'d\" data-mean=\"'+esc(r[2])+'\">'+esc(r[1])+'<span class=\"fxi\" aria-hidden=\"true\">i</span></button>'+\n          '<span class=\"a11y-sr\" id=\"'+mid+'d\">'+esc(MEANS[r[2]])+'</span>'\n        : esc(r[1]))+\"</th>\";\n      ds.forEach(function(d){\n        var raw=d?d.spec[r[2]]:null;\n        var isEmpty=raw===null||raw===undefined||raw===\"\"||(Array.isArray(raw)&&!raw.length);\n        if(isEmpty){\n          body+='<td class=\"na\"><span aria-hidden=\"true\">\\u2013</span><span class=\"a11y-sr\">לא מפורסם אצל היצרן</span></td>';\n        } else if(Array.isArray(raw)){\n          body+=\"<td>\"+raw.map(function(x){return '<span class=\"vch\">'+ltrRuns(x)+\"</span>\";}).join(\"\")+\"</td>\";\n        } else {\n          /* the figure is given size only when whitespace follows it, so a value like 2622x1206 is\n             left as one run rather than being split at the first number */\n          var m=NUMOK[r[2]]?/^\\s*([0-9]+(?:[.,][0-9]+)?)(\\s+)([\\s\\S]+)$/.exec(String(raw)):null;\n          body+=m?'<td><b class=\"nv\">'+esc(m[1])+\"</b>\"+esc(m[2])+ltrRuns(m[3])+\"</td>\"\n                 :\"<td>\"+ltrRuns(raw)+\"</td>\";\n        }\n      });\n      body+=\"</tr>\";\n      if(means&&MEANS[r[2]]) body+='<tr class=\"mean open\" id=\"'+mid+'\"><td colspan=\"'+span+'\"><span><b>מה זה אומר</b> '+esc(MEANS[r[2]])+'</span></td></tr>';\n    });\n    if(bodyOpen) body+=\"</tbody>\";\n    /* the mark is decorative here: the device name sits right beside it, so alt stays empty */\n    var LOGO={Apple:[\"apple\",12,14],Samsung:[\"samsung\",29,10],Xiaomi:[\"xiaomi\",13,13]};\n    var head='<thead><tr><th scope=\"col\">שדה</th>'+ds.map(function(d,i){\n      var b=LOGO[d.brand];\n      var mark=b?'<img class=\"blogo blogo-'+b[0]+'\" src=\"/logos/'+b[0]+'.png\" alt=\"\" width=\"'+b[1]+'\" height=\"'+b[2]+'\" loading=\"lazy\" decoding=\"async\">':\"\";\n      return '<th scope=\"col\" class=\"sc'+i+'\">'+mark+ltr(d.name)+\"</th>\";}).join(\"\")+\"</tr></thead>\";\n\n    var cap=focus\n      ? \"מציג את \"+esc(focus)+\" בלבד, \"+shown.length+\" שדות מתוך \"+diff.length+\" שבהם יש הבדל.\"\n      : diff.length+\" שדות שבהם יש הבדל\"+(same!==null?\", ו-\"+same+\" שדות נוספים זהים ואינם מופיעים כאן\":\"\")+\".\";\n\n    var msg=\"היי, אני משווה בין \"+names.join(\" ל\")+\" ואשמח לעזרה בבחירה\";\n    var share='<div class=\"dshare\">'+\n      '<a class=\"btn btn-wa\" href=\"https://wa.me/97286812050?text='+encodeURIComponent(msg)+'\">'+\n      '<img class=\"wa-ico\" src=\"/whatsapp-logo.png\" alt=\"\" width=\"26\" height=\"26\" loading=\"lazy\" decoding=\"async\">שלחו לנו את ההשוואה</a>'+\n      '<button type=\"button\" class=\"btn btn-teal\" id=\"dcopy\">העתקת קישור להשוואה</button>'+\n      '<span class=\"ok\" id=\"dcopied\" role=\"status\"></span></div>';\n\n    /* גם ה-slug עובר esc. הוא מגיע מנתון שאנחנו מפיקים ולא מקלט משתמש, ולכן זה לא\n       מנוצל היום, אבל גרש כפול ב-slug היה שובר את המאפיין ומזריק HTML. */\n    out.innerHTML=fh+disc+'<div class=\"cmp-wrap\" tabindex=\"0\" role=\"region\" aria-label=\"טבלת ההבדלים\">'+\n      '<table class=\"cmp cmp-grid\"><caption'+(focus?\"\":' class=\"a11y-sr\"')+\">\"+cap+\"</caption>\"+head+body+\"</table></div>\"+share+\n      '<p class=\"aside\">'+ds.map(function(d){\n        /* own===false הוא מכשיר ייחוס: אין לו עמוד מכשיר, ולכן קישור אליו הוא 404.\n           הוא מסומן .noown, אותו סימון שעמודי ההשוואה הכתובים כבר משתמשים בו. */\n        return d.own===false\n          ? '<span class=\"noown\">'+esc(d.name_he||d.name)+' — איננו מוכרים אותו</span>'\n          : '<a href=\"/phones/'+esc(d.slug)+'/\">המפרט המלא של '+esc(d.name_he||d.name)+\"</a>\";\n      }).join(\" · \")+\"</p>\";\n  }\n\n\n  wrap.addEventListener(\"click\",function(e){\n    var b=e.target.closest?e.target.closest(\".chip\"):null;\n    if(!b||!DB) return;\n    var sl=b.getAttribute(\"data-slug\"), at=sel.indexOf(sl);\n    if(at>=0) sel.splice(at,1);\n    else { if(sel.length>=slots) sel.shift(); sel.push(sl); }\n    push(\"cmp_pick\",{device:sl,action:at>=0?\"remove\":\"add\",selected:sel.length});\n    syncChips();\n    render();\n  });\n  /* the slot drops its own device, and the category chips and copy button live inside markup that\n     render() replaces, so both are delegated rather than bound per element */\n  var slotBox=document.getElementById(\"dslots\");\n  if(slotBox) slotBox.addEventListener(\"click\",function(e){\n    if(e.target.closest&&e.target.closest(\"[data-add]\")){slots=MAX;renderSlots();return;}\n    var b=e.target.closest?e.target.closest(\".drop\"):null; if(!b) return;\n    var at=sel.indexOf(b.getAttribute(\"data-drop\"));\n    if(at>=0){sel.splice(at,1);syncChips();render();}\n  });\n  out.addEventListener(\"click\",function(e){\n    if(!e.target.closest) return;\n    var fx=e.target.closest(\".fx\");\n    if(fx){ var opening=fx!==infoFor; if(opening) push(\"cmp_explain\",{field:fx.getAttribute(\"data-mean\")||\"\"}); showInfo(fx,opening); return; }\n    var mb=e.target.closest(\"[data-means]\");\n    if(mb){means=!means;render();return;}\n    var f=e.target.closest(\".dfocus button\");\n    if(f){var c=f.getAttribute(\"data-cat\");focus=c||null;push(\"cmp_focus\",{category:focus||\"all\"});render();return;}\n    var waBtn=e.target.closest(\".dshare a[href*=\\\"wa.me\\\"]\");\n    if(waBtn){ push(\"cmp_share_whatsapp\",{devices:sel.join(\",\")}); return; }\n    if(e.target.closest(\"#dcopy\")){\n      push(\"cmp_copy_link\",{devices:sel.join(\",\")});\n      var note=document.getElementById(\"dcopied\");\n      var url=location.href;\n      var done=function(){if(note)note.textContent=\"הקישור הועתק\";};\n      var fail=function(){if(note)note.textContent=\"לא הצלחנו להעתיק. אפשר להעתיק מהכתובת למעלה.\";};\n      try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,fail); else fail(); }catch(err){fail();}\n    }\n  });\n  clear.addEventListener(\"click\",function(){\n    sel=[]; slots=2;\n    Array.prototype.forEach.call(wrap.querySelectorAll(\".chip\"),function(c){c.setAttribute(\"aria-pressed\",\"false\");});\n    render(); wrap.querySelector(\".chip\").focus();\n  });\n\n  /* הקובץ הציבורי ולא devices.json. הפרטי מכיל _rules, _candidates_findings, spec_source,\n     commercial ו-recommendation: החלטות עסקיות עם תאריכים, מחקר מתחרים, ומקום לציטוטים של\n     ברוך וסיגל לפני אישור פרסום. הגידור של \"רק approved נכנס\" חי במחולל ה-HTML ולא בקובץ\n     ה-JSON, ולכן בקשת GET אחת הייתה מחזירה טיוטה. gen-devices.js גוזר קובץ ציבורי עם\n     ארבעת השדות שהקוד כאן באמת קורא, ולא יותר. */\n  fetch(\"/devices-public.json\",{cache:\"no-store\"}).then(function(r){return r.json();}).then(function(d){\n    DB=d;\n    /* a link like ?d=iphone-17,galaxy-s26 arrives before the data does, so the slugs can only\n       be resolved here, once dev() has something to resolve them against */\n    var pre=fromURL(); if(pre.length){sel=pre; if(sel.length>2) slots=MAX; syncChips();}\n    render();\n  }).catch(function(){\n    out.innerHTML='<p class=\"dempty\">לא ניתן לטעון את נתוני המכשירים. <a href=\"/compare/\">ההשוואות המוכנות</a> עובדות בלי הכלי.</p>';\n  });\n})();" +
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
  /* מכשירי ייחוס נכנסים גם הם לזוגות מאז 15.8.2026. אילו היו מופיעים בבורר בלי להיכנס לכאן,
     בחירה בהם הייתה נופלת ל"לא הצלחנו לחשב את ההשוואה הזאת" — כלומר תקלה שנראית כמו באג
     ולא כמו החלטה. 24 מכשירים הם 276 זוגות במקום 210. */
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
  /* אותה סיבה כמו למעלה: עמוד המכשיר ששימש כתבנית כבר אינו נושא Product ברמת העמוד. */
  var toolCrumbs = '<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: PROD },
      { '@type': 'ListItem', position: 2, name: 'מכשירים', item: PROD + 'phones/' },
      { '@type': 'ListItem', position: 3, name: 'השוואת מכשירים', item: toolUrl }
    ]
  }) + '\n</script>';
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Product"[\s\S]*?<\/script>\s*/, '');
  if (h.indexOf('</head>') < 0) { console.error('✗ tool: לא נמצא </head> להזרקת הסכימה'); process.exit(1); }
  h = h.replace('</head>', toolCrumbs + '\n</head>');

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
