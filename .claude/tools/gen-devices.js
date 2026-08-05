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

/* תוויות המפרט בעברית, בסדר שבו הן מוצגות. שדה ריק נשמט מהטבלה ולא מוצג ריק. */
var SPEC_LABELS = [
  ['screen_size', 'גודל מסך'], ['screen_type', 'סוג מסך'], ['resolution', 'רזולוציה'],
  ['refresh_rate', 'קצב רענון'], ['brightness', 'בהירות'], ['chip', 'מעבד'],
  ['cpu', 'ליבות CPU'], ['gpu', 'ליבות GPU'], ['ram', 'זיכרון RAM'],
  ['storage_offered', 'נפחי אחסון'], ['camera_main', 'מצלמה ראשית'],
  ['camera_extra', 'מצלמות נוספות'], ['zoom', 'זום'], ['camera_front', 'מצלמה קדמית'],
  ['video', 'וידאו'], ['battery', 'סוללה'], ['charging_wired', 'טעינה חוטית'],
  ['charging_wireless', 'טעינה אלחוטית'], ['dimensions', 'מידות'], ['weight', 'משקל'],
  ['sim', 'SIM'], ['esim', 'eSIM'], ['water_resistance', 'עמידות למים ואבק'],
  ['colors_manufacturer', 'צבעים אצל היצרן'], ['box_contents', 'תכולת האריזה'],
  ['model_numbers', 'מספרי דגם']
];
function val(v) { return Array.isArray(v) ? v.join(', ') : v; }

/* מחרוזות לטיניות בהקשר RTL מסודרות מחדש על ידי אלגוריתם ה-bidi. iPhone 17 Pro Max הופך
 * ל-Pro Max iPhone 17, ומידה הופכת סדר ספרות. אין רגקס שתופס את זה, ולכן העטיפה כאן. */
function ltr(s) { return '<bdo dir="ltr">' + esc(s) + '</bdo>'; }

function buildMain(d, openTag) {
  var S = d.spec, C = d.commercial, E = d.editorial || {};
  var srcDefault = (d.spec_source && d.spec_source.default) || {};
  var atDate = srcDefault.at ? srcDefault.at.split('-').reverse().join('/') : null;

  /* --- שורות המפרט: רק שדות שיש בהם ערך --- */
  var rows = SPEC_LABELS.map(function (p) {
    var v = val(S[p[0]]);
    if (v === null || v === undefined || v === '') return null;
    return '        <tr><th scope="row">' + esc(p[1]) + '</th><td>' + esc(v) + '</td></tr>';
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
  '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + wa('היי, אשמח לבדוק מחיר ומלאי של ' + d.name) + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">בדיקת מחיר ומלאי ב-WhatsApp</a></div>\n' +
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
  '          <caption>מה שצריך לברר לפני קנייה. שדה שמופיע בהדגשה נטויה עדיין לא עודכן, וכדאי לשאול עליו.</caption>\n' +
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
  '      <table class="cmp">\n' +
  '        <caption>המפרט כפי שהיצרן מפרסם אותו. ' + (rows.length) + ' שדות.</caption>\n' +
  '        <thead><tr><th scope="col">שדה</th><th scope="col">' + esc(d.name) + '</th></tr></thead>\n' +
  '        <tbody>\n' + rows.join('\n') + '\n        </tbody>\n' +
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
   * Product בלי offers חוקי לגמרי, פשוט לא זכאי לתוצאות עשירות של מוצר. */
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

var made = 0, skipped = [];
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

  var mS = h.indexOf('<main id="main"'), mE = h.indexOf('</main>');
  var openTag = h.slice(mS, h.indexOf('>', mS) + 1);
  h = h.slice(0, mS) + buildMain(d, openTag) + h.slice(mE);

  var out = path.join(PROTO, 'phones', d.slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, h);

  /* מעטפת ה-sw: השוואה למחרוזת המצוטטת, אחרת עמוד אב נבלע בבן שלו */
  var swPath = path.join(PROTO, 'sw.js'), entry = "'/phones/" + d.slug + "/'";
  var sw = fs.readFileSync(swPath, 'utf8');
  if (sw.indexOf(entry) < 0) fs.writeFileSync(swPath, sw.replace('const SHELL = [', 'const SHELL = [' + entry + ', '));

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

  var missing = [];
  Object.keys(d.commercial).forEach(function (k) { if (d.commercial[k] === null) missing.push(k); });
  ['sigal', 'baruch'].forEach(function (w) { if (d.recommendation[w].status !== 'approved') missing.push('המלצת ' + w); });
  if (d.launch_year === null) missing.push('launch_year');

  console.log('✓ phones/' + d.slug + '/  ' + (d.status === 'review' ? '[טסטים בלבד]' : '') );
  console.log('   מפרט: ' + Object.keys(d.spec).filter(function (k) { return d.spec[k] !== null; }).length + ' שדות · חסר מאופק: ' + missing.length + ' (' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '…' : '') + ')');
  made++;
});

if (skipped.length) console.log('\nדולג: ' + skipped.join(', '));
console.log('\n' + made + ' עמודי מכשיר נוצרו. הרצה: node .claude/preflight.js');
