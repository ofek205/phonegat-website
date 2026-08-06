#!/usr/bin/env node
/* PHONE GAT — מחולל עמודי מכשיר מתוך prototype/devices.json.
 *
 *   node .claude/tools/gen-devices.js            כל המכשירים שאינם draft
 *   node .claude/tools/gen-devices.js iphone-17  אחד
 *
 * למה מחולל ולא שלב build: אין build בפרויקט הזה וזו החלטה מכוונת. הסקריפט רץ מקומית, וה-HTML
 * שהוא מייצר מקומט לגיט ומוגש סטטי. כך מתקיימים שלושה אילוצים יחד: מקור אמת אחד, אין שלב build
 * בפריסה, וכל התוכן קיים ב-HTML גם עם JavaScript מכובה (§9 ב-pg-new-content-page).
 *
 * שלוש הגנות שהסקריפט אוכף, ולא רק מתעד:
 *   1. אין Offer, אין availability ואין price ב-Schema כשאין מחיר אמיתי. Product בלי offers חוקי
 *      לגמרי, פשוט לא זכאי לתוצאות עשירות של מוצר, וזה עדיף על מחיר שגוי שנשלח לגוגל.
 *   2. המלצה של סיגל או ברוך נכנסת אך ורק כאשר status הוא approved. טיוטה לא מגיעה ל-HTML.
 *   3. שדה מסחרי ריק מוצג בנוסח החלופי מ-_placeholder_copy ולא כמספר ולא כרווח לבן.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var SOURCE = 'guides/official-vs-parallel-import/index.html';  /* המסגרת + ה-CSS של הטבלה */
var PROD = 'https://www.phonegat.co.il/';

var db = JSON.parse(fs.readFileSync(path.join(PROTO, 'devices.json'), 'utf8'));
var PH = db._placeholder_copy;
var only = process.argv[2];
var src = fs.readFileSync(path.join(PROTO, SOURCE), 'utf8');

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function wa(t) { return 'https://wa.me/97286812050?text=' + encodeURIComponent(t); }

/* המפרט מקובץ לקטגוריות ולא כרשימה שטוחה של 24 שורות. 24 שורות רצופות הן קיר שאף אחד
 * לא קורא, ולכן זה הדפוס המקובל בגיליון מפרט. כל קטגוריה היא tbody משלה עם כותרת שמשתרעת
 * על שתי העמודות ונושאת scope="rowgroup", כלומר קורא מסך יודע לאיזו קבוצה כל שורה שייכת
 * ולא רק מה התווית שלה. קטגוריה שכל שדותיה ריקים נשמטת כולה. */
/* הטבלה עצמה עברה ל-devices.json תחת _spec_groups, כי gen-compare.js קורא אותה גם. עותק שני
 * שלה בקובץ אחר היה נסחף, והתוצאה הייתה אותו שדה עם תווית אחרת בגיליון המפרט ובטבלת ההשוואה. */
if (!db._spec_groups || !db._spec_groups.groups) {
  console.error('✗ אין _spec_groups ב-devices.json. בלעדיו אין תוויות למפרט.');
  process.exit(1);
}
var SPEC_GROUPS = db._spec_groups.groups;
function val(v) { return Array.isArray(v) ? v.join(', ') : v; }
function E_BODY(d) { return JSON.stringify(d.editorial || {}); }

/* מחרוזות לטיניות בהקשר RTL מסודרות מחדש על ידי אלגוריתם ה-bidi. iPhone 17 Pro Max הופך
 * ל-Pro Max iPhone 17, ומידה הופכת סדר ספרות. אין רגקס שתופס את זה, ולכן העטיפה כאן. */
function ltr(s) { return '<bdo dir="ltr">' + esc(s) + '</bdo>'; }

function buildMain(d, openTag) {
  var S = d.spec, C = d.commercial, E = d.editorial || {};
  var srcDefault = (d.spec_source && d.spec_source.default) || {};
  var atDate = srcDefault.at ? srcDefault.at.split('-').reverse().join('/') : null;

  /* --- שורות המפרט, מקובצות. רק שדות שיש בהם ערך, וקטגוריה ריקה נשמטת כולה --- */
  var specCount = 0;
  var groups = SPEC_GROUPS.map(function (g) {
    var rs = g[1].map(function (p) {
      var v = val(S[p[0]]);
      if (v === null || v === undefined || v === '') return null;
      specCount++;
      return '          <tr><th scope="row">' + esc(p[1]) + '</th><td>' + esc(v) + '</td></tr>';
    }).filter(Boolean);
    if (!rs.length) return null;
    return '        <tbody>\n' +
      '          <tr class="grp"><th colspan="2" scope="rowgroup">' + esc(g[0]) + '</th></tr>\n' +
      rs.join('\n') + '\n        </tbody>';
  }).filter(Boolean);

  /* --- עובדות מסחריות: ערך אמיתי או הנוסח החלופי, לעולם לא ריק --- */
  var facts = [
    ['מחיר', C.price, PH.price],
    ['מלאי', C.stock, PH.stock],
    ['נפחים בחנות', val(C.storage_stocked), val(S.storage_offered) ? 'אצל היצרן: ' + val(S.storage_offered) : PH.stock],
    ['צבעים בחנות', val(C.colors_stocked), PH.colors],
    ['יבוא', [C.import_official ? 'רשמי' : null, C.import_parallel ? 'מקביל' : null].filter(Boolean).join(' ו') || null, 'לבדיקת מסלולי היבוא הזמינים'],
    ['אחריות', C.warranty_months ? C.warranty_months + ' חודשים' + (C.warranty_by ? ', ' + C.warranty_by : '') : null, PH.warranty],
    ['תשלומים', C.payments, 'לבדיקת פריסת תשלומים']
  ].map(function (f) {
    var real = f[1] !== null && f[1] !== undefined && f[1] !== '';
    return '        <tr><th scope="row">' + esc(f[0]) + '</th><td>' +
      (real ? esc(f[1]) : '<em>' + esc(f[2]) + '</em>') + '</td></tr>';
  }).join('\n');

  var out = openTag + '\n\n' +
  '<section class="ghero" aria-labelledby="gh">\n' +
  '  <div class="wrap">\n' +
  '    <div class="inner">\n' +
  '      <h1 id="gh">' + ltr(d.name) + '</h1>\n' +
  (E.what_matters ? '      <p class="sub">' + esc(E.what_matters) + '</p>\n' : '') +
  '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + wa('היי, אשמח לבדוק מחיר ומלאי של ' + d.name) + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">בדיקת מחיר ומלאי</a></div>\n' +
  '      <p class="meta">\n' +
  '        <span>' + esc(d.brand) + (d.os ? ', ' + esc(d.os) : '') + '</span>\n' +
  (atDate ? '        <span>מפרט נבדק ב' + esc(atDate) + '</span>\n' : '') +
  '        <span>מעבדה במקום, יותר מ-30 שנה</span>\n' +
  '        <span>ליווי לפני הקנייה ואחריה</span>\n' +
  '      </p>\n' +
  '    </div>\n' +
  '  </div>\n' +
  '</section>\n\n' +

  /* --- עובדות מסחריות + פלייסהולדר לתמונה --- */
  '<section class="prob" id="buy" style="--nc:var(--teal)" aria-labelledby="h-buy">\n' +
  '  <div class="wrap row">\n' +
  '    <figure class="fig">\n' +
  '      <div class="ph"><svg viewBox="0 0 200 200" aria-hidden="true"><g transform="translate(100 100)"><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#1878A8"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#e0913f" transform="rotate(90)"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#63a244" transform="rotate(180)"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#7D3169" transform="rotate(270)"/></g></svg><span>תמונה: ' + esc(d.name) + ' על דלפק המעבדה, המכשיר בשליש האמצעי של הגובה. ' + esc(PH.images) + '</span></div>\n' +
  '    </figure>\n' +
  '    <div class="txt">\n' +
  '      <h2 id="h-buy">מחיר, מלאי ואחריות</h2>\n' +
  '      <p class="intro">הנתונים המסחריים משתנים לפי מלאי ולפי מסלול היבוא, ולכן אנחנו לא מציגים כאן מספר שעלול להיות לא מעודכן. שלחו הודעה ונענה עם המצב האמיתי באותו רגע.</p>\n' +
  '      <div class="cmp-wrap" role="region" aria-labelledby="h-buy" tabindex="0">\n' +
  '        <table class="cmp">\n' +
  /* הכיתוב הזה אמר "עדיין לא עודכן" על כל שדה בהדגשה. לגבי המחיר זה הפסיק להיות נכון
   * ב-6.8.2026, כשהוחלט שאין מחירון באתר: הוא לא ממתין לעדכון, הוא לא יופיע. עמוד שמרמז
   * שמחיר בדרך מטעה. שאר השדות כן ימולאו, ולכן הכיתוב מפריד בין השניים. */
  '          <caption>מה שצריך לברר לפני קנייה. שדה בהדגשה נטויה נמסר בשיחה ולא באתר, והמחיר לא יופיע כאן בכלל מפני שהוא משתנה.</caption>\n' +
  '          <thead><tr><th scope="col">מה</th><th scope="col">' + esc(d.name) + '</th></tr></thead>\n' +
  '          <tbody>\n' + facts + '\n          </tbody>\n' +
  '        </table>\n' +
  '      </div>\n' +
  '      <div class="lab">\n' +
  '        <p>מה ההבדל בין יבוא רשמי למקביל, ומי נותן את האחריות בכל אחד מהם: <a href="/guides/official-vs-parallel-import/">המדריך המלא</a>.</p>\n' +
  '        <a class="btn btn-wa" href="' + wa('היי, אשמח לבדוק זמינות של ' + d.name) + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="24" height="24" loading="lazy" decoding="async">שלחו הודעה</a>\n' +
  '      </div>\n' +
  '    </div>\n' +
  '  </div>\n' +
  '</section>\n\n';

  /* --- למי מתאים ולמי פחות --- */
  if (E.good_for || E.less_for) {
    out += '<section class="block" id="fit" aria-labelledby="h-fit">\n' +
    '  <div class="wrap box">\n' +
    '    <h2 id="h-fit">למי המכשיר הזה מתאים</h2>\n' +
    (E.good_for ? '    <ul class="checks">\n' + E.good_for.map(function (x) { return '      <li>' + esc(x) + '</li>'; }).join('\n') + '\n    </ul>\n' : '') +
    (E.less_for ? '    <h3>ולמי הוא פחות מתאים</h3>\n    <ul class="mistakes">\n' + E.less_for.map(function (x) { return '      <li>' + esc(x) + '</li>'; }).join('\n') + '\n    </ul>\n' : '') +
    '  </div>\n</section>\n\n';
  }

  /* --- מה הנתונים אומרים בשימוש יומיומי --- */
  if (E.daily_benefits && E.daily_benefits.length) {
    out += '<section class="block" id="daily" aria-labelledby="h-daily">\n' +
    '  <div class="wrap box">\n' +
    '    <h2 id="h-daily">מה המפרט אומר בשימוש יומיומי</h2>\n' +
    '    <p class="lead">אותם נתונים, מתורגמים למה שמרגישים ביד.</p>\n' +
    '    <ul class="checks">\n' +
    E.daily_benefits.map(function (p) { return '      <li><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</li>'; }).join('\n') +
    '\n    </ul>\n  </div>\n</section>\n\n';
  }

  /* --- המלצה אישית: אך ורק כשאושרה --- */
  ['sigal', 'baruch'].forEach(function (who) {
    var r = (d.recommendation || {})[who];
    if (!r || r.status !== 'approved' || !r.text) return;
    var title = who === 'sigal' ? 'ההמלצה של סיגל' : 'הטיפ של ברוך';
    out += '<section class="block" id="rec-' + who + '" aria-labelledby="h-rec-' + who + '">\n' +
    '  <div class="wrap box">\n    <h2 id="h-rec-' + who + '">' + title + '</h2>\n' +
    '    <div class="prose"><p>' + esc(r.text) + '</p></div>\n  </div>\n</section>\n\n';
  });

  /* --- המפרט --- */
  out += '<section class="block" id="spec" aria-labelledby="h-spec">\n' +
  '  <div class="wrap box">\n' +
  '    <h2 id="h-spec">מפרט טכני מלא</h2>\n' +
  '    <div class="cmp-wrap" role="region" aria-labelledby="h-spec" tabindex="0">\n' +
  '      <table class="cmp cmp-spec">\n' +
  '        <caption>המפרט כפי שהיצרן מפרסם אותו, ' + specCount + ' שדות ב-' + groups.length + ' קטגוריות.</caption>\n' +
  '        <thead><tr><th scope="col">שדה</th><th scope="col">' + esc(d.name) + '</th></tr></thead>\n' +
  groups.join('\n') + '\n' +
  '      </table>\n' +
  '    </div>\n' +
  '    <p class="sources">המפרט מבוסס על נתוני היצרן' +
    (srcDefault.src ? ', מתוך <a href="' + esc(srcDefault.src) + '" rel="nofollow noopener" target="_blank">עמוד המפרט הרשמי</a>' : '') +
    (atDate ? ', ונבדק לאחרונה בתאריך ' + esc(atDate) : '') +
  '. זמינות גרסאות, צבעים, נפחים ותכולת האריזה עשויה להשתנות, וגם בין מסלולי יבוא. ' +
  (S.model_numbers ? '' : 'מספר הדגם המדויק תלוי בגרסה שהגיעה לחנות, ואפשר לבקש לראות אותו לפני הקנייה.') +
  '</p>\n  </div>\n</section>\n\n';

  /* --- CTA --- */
  out += '<section class="cta" aria-labelledby="cta-h">\n' +
  '  <div class="wrap">\n' +
  '    <h2 id="cta-h">רוצים לראות אותו ביד?</h2>\n' +
  '    <p>אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00. אפשר לבוא להחזיק את המכשיר, ולשאול כל שאלה לפני שמחליטים.</p>\n' +
  '    <div class="row">\n' +
  '      <a class="btn btn-wa" href="' + wa('היי, אשמח לבדוק מחיר ומלאי של ' + d.name) + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">בדיקת מחיר ומלאי</a>\n' +
  '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
  '      <a class="btn btn-teal" href="/phones/">כל המכשירים</a>\n' +
  '    </div>\n' +
  '    <p class="fine">הייעוץ לפני קנייה ללא עלות וללא התחייבות.</p>\n' +
  '  </div>\n' +
  '</section>\n\n';
  return out;
}

/* ---------- schema ---------- */
function buildSchema(d, url) {
  var S = d.spec, C = d.commercial;
  var product = {
    '@context': 'https://schema.org', '@type': 'Product',
    '@id': url + '#product',
    name: d.name,
    brand: { '@type': 'Brand', name: d.brand },
    category: 'טלפון סלולרי',
    description: d.seo && d.seo.description ? d.seo.description : undefined,
    operatingSystem: d.os || undefined,
    url: url
  };
  /* ⛔ אין Offer, אין price ואין availability בלי מחיר ומלאי אמיתיים שמוצגים בעמוד.
   * Product בלי offers חוקי לגמרי, פשוט לא זכאי לתוצאות עשירות של מוצר.
   *
   * מ-6.8.2026 התנאי הזה לא ייתקיים לעולם, וזו החלטה ולא חוסר: אין מחירון באתר, כי המחיר
   * משתנה כל הזמן. התוצאה, שאומרים אותה בקול ולא מגלים בדיעבד: עמודי המכשיר לא יהיו זכאים
   * לתוצאות עשירות של מוצר בגוגל. Offer דורש price, וגם AggregateOffer דורש lowPrice.
   * הבלוק נשאר כאן ולא נמחק, כי אם ההחלטה תשתנה זה מה שצריך לעבוד. */
  if (C.price && C.stock) {
    product.offers = { '@type': 'Offer', priceCurrency: 'ILS', price: String(C.price),
                       availability: 'https://schema.org/InStock', url: url };
  }
  var crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'פון גת', item: PROD },
      { '@type': 'ListItem', position: 2, name: 'מכשירים', item: PROD + 'phones/' },
      { '@type': 'ListItem', position: 3, name: d.name, item: url }
    ]
  };
  return [product, crumbs];
}

/* ---------- כתיבת דף ---------- */
function swap(h, re, to, label, slug) {
  if (!re.test(h)) { console.error('✗ ' + slug + ': לא נמצא ' + label + ' — המסגרת ב-' + SOURCE + ' השתנתה'); process.exit(1); }
  return h.replace(re, to);
}

var made = 0, skipped = [], swGrew = false;

/* סדר הרשימה ב-/phones/.
 *
 * בלי זה הסדר הוא סדר ההוספה ל-devices.json, כלומר לפי היום שבו נכתב כל דגם. בעמוד עם שנים
 * עשר דגמים זה נראה כך: אייפון 17, גלקסי S26 אולטרה, רדמי נוט 14 פרו, אייפון 17 פרו. מותגים
 * משורגים באקראי, וזו רשימה שאף אחד לא סידר. גם הסכימה של ItemList נגזרת מאותו סדר.
 *
 * ממוין ולא מסודר ביד ב-JSON, כי כל דגם חדש היה דורש להזיז אותו למקום הנכון וזה נשכח. שלוש
 * מדרגות: מותג, קו המוצר בתוך המותג, ואז הדור מהחדש לישן ובתוך אותו דור מהחזק לבסיסי. */
var BRAND_ORDER = ['Apple', 'Samsung', 'Xiaomi'];
function lineRank(n) {
  if (/^Galaxy S/.test(n)) return 0;
  if (/^Galaxy A/.test(n)) return 1;
  if (/^Galaxy Z/.test(n)) return 2;
  if (/^Redmi/.test(n)) return 1;      /* Xiaomi לפני Redmi */
  return 0;
}
function tierRank(n) {
  if (/Pro Max|Ultra/.test(n)) return 0;
  if (/Pro\b|\+/.test(n)) return 1;
  if (/\de\b/.test(n)) return 3;       /* iPhone 17e הוא דגם הכניסה של הדור */
  return 2;
}
function generation(n) {
  var m = n.match(/\d+/g);
  return m ? Math.max.apply(null, m.map(Number)) : 0;
}
function hubOrder(a, b) {
  var ba = BRAND_ORDER.indexOf(a.brand), bb = BRAND_ORDER.indexOf(b.brand);
  if (ba < 0) ba = BRAND_ORDER.length;                 /* מותג חדש נופל לסוף ולא לראש */
  if (bb < 0) bb = BRAND_ORDER.length;
  if (ba !== bb) return ba - bb;
  var la = lineRank(a.name), lb = lineRank(b.name);
  if (la !== lb) return la - lb;
  var ga = generation(a.name), gb = generation(b.name);
  if (ga !== gb) return gb - ga;                       /* הדור החדש קודם */
  return tierRank(a.name) - tierRank(b.name);
}
db.devices.forEach(function (d) {
  if (only && d.slug !== only) return;
  if (d.status === 'draft' && !only) { skipped.push(d.slug + ' (draft)'); return; }
  var url = PROD + 'phones/' + d.slug + '/';
  var title = (d.seo && d.seo.title) || (d.name + ' | פון גת');
  var desc = (d.seo && d.seo.description) || '';
  var h = src;

  h = swap(h, /<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>', '<title>', d.slug);
  h = swap(h, /(<meta name="description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'description', d.slug);
  h = swap(h, /(<link rel="canonical" href=")[^"]*(">)/, '$1' + url + '$2', 'canonical', d.slug);
  h = swap(h, /(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(title) + '$2', 'og:title', d.slug);
  h = swap(h, /(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'og:description', d.slug);
  h = swap(h, /(<meta property="og:url" content=")[^"]*(">)/, '$1' + url + '$2', 'og:url', d.slug);
  h = swap(h, /(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + esc(title) + '$2', 'twitter:title', d.slug);
  h = swap(h, /(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + esc(desc) + '$2', 'twitter:desc', d.slug);

  /* Article של המדריך יוצא, Product ו-BreadcrumbList נכנסים. FAQPage יוצא: אין FAQ בעמוד מכשיר.
   *
   * הסדר כאן קריטי, ולא היה נכון בגרסה הראשונה. הבלוקים החדשים מוזרקים במקום Article, שיושב
   * לפני ה-BreadcrumbList של המקור. לכן מחיקת "ה-BreadcrumbList" אחרי ההזרקה מחקה את החדש
   * ולא את הישן, והעמוד יצא עם פירורי הלחם של מדריך היבוא: בית › מדריכים › יבוא מקביל.
   * שום בדיקה לא תפסה את זה, כי מספר הרמות היה זהה. מוחקים קודם, מזריקים אחר כך. */
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\s*/, '');
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?<\/script>\s*/, '');
  var blocks = buildSchema(d, url).map(function (o) {
    return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>';
  }).join('\n');
  if (!/"@type":"Article"/.test(h)) { console.error('✗ ' + d.slug + ': לא נמצא בלוק Article להחלפה'); process.exit(1); }
  h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"Article"[\s\S]*?<\/script>/, blocks);
  /* חגורה: אם משהו בסדר הזה יישבר שוב, זה ייפול כאן ולא ישקוט */
  if (h.indexOf('"name":"מכשירים"') < 0) { console.error('✗ ' + d.slug + ': פירור הלחם אינו מצביע ל-/phones/'); process.exit(1); }

  /* ה-CSS של כותרות הקטגוריה מוזרק כאן ולא יושב בעמוד המקור, כי המקור הוא מדריך והטבלה
   * שלו אינה מקובצת. CSS שלא בשימוש בעמוד המקור הוא בדיוק מה שנוטה להיסחף. */
  var CSS_ANCHOR = '@media(max-width:640px){.cmp{min-width:520px}.cmp tbody th{width:8.5rem}}';
  if (h.indexOf(CSS_ANCHOR) < 0) { console.error('✗ ' + d.slug + ': לא נמצא עוגן ה-CSS של הטבלה'); process.exit(1); }
  h = h.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' +
    '/* כותרת קטגוריה בגיליון מפרט: קו כבד מעליה במקום רקע צבוע, ותווית קטנה בסאנס כמו שאר\n' +
    '   התוויות הקטנות בדף. 1.02rem ולא .86rem, כי rem נפתר מול 16px בשורש בזמן שהגוף 18px,\n' +
    '   ולכן תווית שנלקחת מרפרנס אנגלי יוצאת קטנה מדי בעברית. */\n' +
    '.cmp-spec .grp th{border-top:2px solid var(--ink-strong);padding-block:1.6rem .55rem;font-family:var(--font);font-weight:700;font-size:1.02rem;letter-spacing:.07em;color:var(--ink-strong);text-align:start;width:auto}\n' +
    '.cmp-spec tbody:first-of-type .grp th{border-top:0;padding-block-start:1rem}\n' +
    '/* הכלל הכללי נותן קו תחתון לשורה האחרונה בכל tbody. עם קיבוץ יש כמה tbody, ולכן הקו\n' +
    '   הזה היה מוכפל מול הקו הכבד של הקטגוריה הבאה. נשאר רק בסוף הטבלה. */\n' +
    '.cmp-spec tbody:not(:last-of-type) tr:last-child th,.cmp-spec tbody:not(:last-of-type) tr:last-child td{border-bottom:0}\n' +
    '/* טבלה בתוך פריט flex או grid: ה-min-width של פריט כזה הוא auto, ולכן טבלה עם\n' +
    '   min-width:560px מותחת את העמודה ומגלישה את כל הדף. נמדדה גלישה של 157px ב-375px.\n' +
    '   במדריך זה לא קרה, כי שם הטבלה יושבת בבלוק ולא בשורה, ולכן זה לא נתפס שם.\n' +
    '   min-width:0 מחזיר לפריט את הרשות להצטמצם, והטבלה גוללת בתוך האזור שלה כמתוכנן. */\n' +
    '.prob .txt{min-width:0}\n' +
    '.cmp-wrap{max-width:100%}\n' +
    '/* תווית ארוכה בכפתור ההירו גלשה ב-375px תחת הגדלת טקסט: 420px תווית מול 375px מסך.\n' +
    '   כפתור שנשבר לשתי שורות עדיף על דף שגולש הצידה, ולכן מותר לו. */\n' +
    '.ghero .btn-hero{white-space:normal;text-align:center}');

  var mS = h.indexOf('<main id="main"'), mE = h.indexOf('</main>');
  var openTag = h.slice(mS, h.indexOf('>', mS) + 1);
  h = h.slice(0, mS) + buildMain(d, openTag) + h.slice(mE);

  var out = path.join(PROTO, 'phones', d.slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);

  /* מעטפת ה-sw: השוואה למחרוזת המצוטטת, אחרת עמוד אב נבלע בבן שלו */
  var swPath = path.join(PROTO, 'sw.js'), entry = "'/phones/" + d.slug + "/'";
  var sw = fs.readFileSync(swPath, 'utf8');
  if (sw.indexOf(entry) < 0) {
    fs.writeFileSync(swPath, sw.replace('const SHELL = [', 'const SHELL = [' + entry + ', '));
    swGrew = true;   /* שם המטמון יעלה פעם אחת בסוף ההרצה, לא פעם לכל דגם */
  }

  /* רישום בפאנל הסקירה. זה לא נוחות, זה הדרך שבה אופק רואה עמוד חדש בסביבת הבדיקות: הפאנל
   * קורא מ-services.json, ולכן עמוד שלא רשום שם פשוט לא קיים מבחינת סקירה. ב-5.8.2026נוצרו
   * /phones/ ועמוד מכשיר ואף אחד מהם לא נרשם, והם לא הופיעו. רישום ידני היה נשכח שוב, ולכן
   * הסקריפט עושה את זה בעצמו. */
  var svcPath = path.join(PROTO, 'services.json');
  try {
    var svc = JSON.parse(fs.readFileSync(svcPath, 'utf8'));
    svc.existing = svc.existing || [];
    var pageUrl = '/phones/' + d.slug + '/';
    var row = svc.existing.filter(function (p) { return p.url === pageUrl; })[0];
    if (row) { row.name = d.name_he || d.name; row.status = d.status; }
    else { svc.existing.push({ url: pageUrl, name: d.name_he || d.name, status: d.status }); }
    fs.writeFileSync(svcPath, JSON.stringify(svc, null, 2) + '\n');
  } catch (e) { console.error('⚠ ' + d.slug + ': לא ניתן לעדכן services.json — הוסף ידנית'); }

  /* המחיר יצא מרשימת "חסר מאופק". הוא null בכוונה מ-6.8.2026, ולספור אותו כחוסר פירושו
   * שהדוח יבקש לנצח משהו שהוחלט שלא יגיע. במקום זה: התרעה אם מישהו כן מילא אותו, כי זה
   * מחזיר Offer עם מחיר לסכימה בסתירה להחלטה, ושולח לגוגל מספר שעלול להיות מיושן. */
  if (d.commercial.price !== null && d.commercial.price !== undefined && d.commercial.price !== '') {
    console.error('⚠ ' + d.slug + ': commercial.price מולא (' + d.commercial.price + '), בסתירה להחלטה מ-6.8.2026 שאין מחירון באתר. ' +
      'זה מחזיר Offer עם מחיר לסכימה. אם ההחלטה שונתה, עדכן את _rules ב-devices.json.');
  }
  var missing = [];
  Object.keys(d.commercial).forEach(function (k) { if (k !== 'price' && d.commercial[k] === null) missing.push(k); });
  ['sigal', 'baruch'].forEach(function (w) { if (d.recommendation[w].status !== 'approved') missing.push('המלצת ' + w); });
  if (d.launch_year === null) missing.push('launch_year');

  /* הצורה העברית של שם הדגם חייבת להופיע בגוף העמוד ולא רק ב-title. בישראל מחפשים
   * "אייפון 17" יותר מ-iPhone 17, וב-5.8.2026 שני עמודים יצאו עם אפס מופעים בגוף. האודיט
   * תפס את זה בדיעבד, וכאן זה נתפס בזמן החילול. */
  if (d.name_he && (E_BODY(d).indexOf(d.name_he) < 0)) {
    console.error('⚠ ' + d.slug + ': השם העברי "' + d.name_he + '" לא מופיע בגוף העמוד. בישראל מחפשים אותו יותר מהלטיני. הוסף אותו ל-editorial.what_matters.');
  }
  console.log('✓ phones/' + d.slug + '/  ' + (d.status === 'review' ? '[טסטים בלבד]' : '') );
  console.log('   מפרט: ' + Object.keys(d.spec).filter(function (k) { return d.spec[k] !== null; }).length + ' שדות · חסר מאופק: ' + missing.length + ' (' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '…' : '') + ')');
  made++;
});

if (skipped.length) console.log('\nדולג: ' + skipped.join(', '));

/* ---------- רענון רשימת המכשירים ב-/phones/ ----------
 * הרשימה שם נגזרת מ-devices.json, אבל המרכז אינו מחולל בכל הרצה, ולכן דגם שנוסף אחרי
 * שהמרכז נבנה לא הופיע בו. ב-5.8.2026 המרכז הציג מכשיר אחד בזמן שהיו שלושה. אותו היגיון
 * כמו הרישום ב-services.json: מה שאפשר לגזור, נגזר, ולא נזכר. */
if (!only) {
  var hubPath = path.join(PROTO, 'phones', 'index.html');
  try {
    var hub = fs.readFileSync(hubPath, 'utf8');
    var live = db.devices.filter(function (x) { return x.status !== 'draft'; }).sort(hubOrder);
    var items = live.map(function (x) {
      var bits = [x.brand];
      if (x.spec.screen_size) bits.push('מסך ' + x.spec.screen_size);
      if (x.spec.chip) bits.push(x.spec.chip);
      if (x.spec.storage_offered) bits.push(x.spec.storage_offered.join(' / '));
      return '        <li><a href="/phones/' + x.slug + '/"><b><bdo dir="ltr">' + esc(x.name) +
             '</bdo></b><span>' + esc(bits.join(' · ')) + '</span></a></li>';
    }).join('\n');
    /* \r?\n ולא \n.
     *
     * הקבצים ב-prototype מעורבי סופי שורות בכוונה: המחולל כותב את הבלוקים שלו ב-LF, והשאר
     * CRLF. כל עריכה בכלי טקסט הופכת את הקובץ כולו ל-CRLF, ואז \n מפסיק להתאים כאן. זה קרה
     * ב-6.8.2026, וזו הייתה תקלה שקטה מהסוג הגרוע: המחולל הדפיס אזהרה אחת והמשיך, ורשימת
     * הדגמים ב-/phones/ נשארה עם אחד עשר דגמים בזמן שהעמודים היו שנים עשר.
     * לכן גם הכשל כאן הוא שגיאה קשה ולא אזהרה. רשימה מיושנת גרועה מקריסה. */
    var re = /(<section class="block" id="devices"[\s\S]*?<ul class="hub">\r?\n)[\s\S]*?(\r?\n      <\/ul>)/;
    if (!re.test(hub)) {
      console.error('✗ לא נמצאה רשימת המכשירים ב-/phones/. ' +
        'סופי השורות בקובץ אולי הומרו, או שהמבנה השתנה. רשימה שלא התעדכנה גרועה מקריסה, ולכן עצירה.');
      process.exit(1);
    } else {
      hub = hub.replace(re, '$1' + items + '$2');
      /* גם השורה שמונה אותם, אחרת היא אומרת מספר אחר ממה שמוצג */
      var leadRe = /<p class="lead">[^<]*<\/p>(\r?\n\s*)<ul class="hub">/;
      if (!leadRe.test(hub)) { console.error('✗ לא נמצאה שורת המונה ב-/phones/'); process.exit(1); }
      hub = hub.replace(leadRe,
        '<p class="lead">' + (live.length === 1
          ? 'עמוד ראשון באוויר. הדגמים הנוספים נכנסים בימים הקרובים.'
          : live.length + ' דגמים, ונוסיף עוד.') +
        ' לכל דגם עמוד עם המפרט המלא מאתר היצרן, ומה הנתונים אומרים בשימוש יומיומי.</p>$1<ul class="hub">');
      /* ItemList ב-schema חייב להישאר תואם למה שמוצג */
      var il = { '@context': 'https://schema.org', '@type': 'ItemList',
        itemListElement: live.map(function (x, i) {
          return { '@type': 'ListItem', position: i + 1, name: x.name,
                   url: PROD + 'phones/' + x.slug + '/' }; }) };
      hub = hub.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"ItemList"[\s\S]*?<\/script>/,
        '<script type="application/ld+json">\n' + JSON.stringify(il) + '\n</script>');
      fs.writeFileSync(hubPath, hub);
      console.log('✓ /phones/ עודכן: ' + live.length + ' מכשירים ברשימה וב-ItemList');
    }
  } catch (e) { console.error('⚠ לא ניתן לעדכן את /phones/ — ' + e.message); }
}

/* הכתובת נכנסה למעטפת, ועכשיו חייב לעלות גם שם המטמון. בלי זה מבקר חוזר נשאר עם המעטפת
 * הישנה שלו לנצח, כי activate מוחק רק מטמונים בשם אחר. זה היה צעד ידני, נשכח בהרצה של
 * 5.8.2026 שהוסיפה שלוש כתובות, ולכן הוא כאן. עולה פעם אחת להרצה ולא פעם לכל דגם. */
if (swGrew) {
  var swP = path.join(PROTO, 'sw.js'), swSrc = fs.readFileSync(swP, 'utf8');
  var m = swSrc.match(/const CACHE = 'pg-v(\d+)'/);
  if (!m) console.error('⚠ לא נמצא שם המטמון ב-sw.js — העלה ידנית, אחרת מבקר חוזר לא יקבל את העמודים החדשים');
  else {
    var next = 'pg-v' + (parseInt(m[1], 10) + 1);
    fs.writeFileSync(swP, swSrc.replace(m[0], "const CACHE = '" + next + "'"));
    console.log('✓ sw.js: המעטפת גדלה, שם המטמון עלה ל-' + next);
  }
}

console.log('\n' + made + ' עמודי מכשיר נוצרו. הרצה: node .claude/preflight.js');
