#!/usr/bin/env node
/* ============================================================================
 * gen-upcoming.js — עמודי הדגמים שעוד לא יצאו, מתוך .claude/data/upcoming.json
 *
 * נוצר ב-24.9.2026 לבקשת אופק: עמודים לדגמים שעוד לא בחנויות, כדי להופיע בחיפושים
 * עליהם. שלושה מהם הם שמועות בלבד, ואחד הוכרז רשמית ועוד לא נמכר.
 *
 * שני כללים מכתיבים את כל המבנה כאן, ושניהם נאכפים בקוד ולא בזיכרון:
 *
 *   1. כל שמועה עם מקור. בלי מי, קישור ותאריך, המחולל עוצר. שמועה בלי מקור היא בדיוק מה
 *      שהעמוד /upcoming-phones/ מבטיח ללקוחות שלא נכתוב, והדרך לכבד את ההבטחה הזאת בעמוד
 *      שכולו שמועות היא שכל שמועה תישא את שם מי שאמר אותה.
 *
 *   2. לא מבטיחים כלום, הוחלט עם אופק באותו יום, כדי שלא תהיה חשיפה לתביעה. אין מחיר, אין
 *      מועד בשמנו, ואין "נעדכן אתכם". המחולל סורק את כל הטקסט ועוצר על מילות הבטחה.
 *      והצהרת אי-ההתחייבות נכתבת על ידי המחולל עצמו, בראש העמוד ובסופו, כדי שאף עמוד
 *      לא ייצא בלעדיה.
 *
 * הבעלות: כל מה שבתוך <main> בעמודים האלה, שני בלוקי ה-JSON-LD (Article ו-BreadcrumbList),
 * ה-title והתיאורים ב-head, והמקטע "הדגמים שבדרך" בעמוד /upcoming-phones/. שאר העמוד,
 * כלומר המסגרת, הגיע מ-new-page.js ונשאר שלו.
 *
 * בר-הרצה חוזרת. מסרב לרוץ אם עמוד או סימן חסרים.
 * ========================================================================== */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var DATA = path.join(ROOT, '.claude', 'data', 'upcoming.json');
var SITE = 'https://www.phonegat.co.il';

var data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
var errors = [];
function fail(m) { errors.push(m); }

var esc = function (s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function dayHe(iso) { var p = iso.split('-'); return (+p[2]) + ' ב' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
/* במקורות מוצג חודש ושנה ולא יום. יום מדויק על כתבת סיכום שמתעדכנת כל הזמן הוא דיוק מדומה. */
function monthHe(iso) { var p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
function wa(text) { return 'https://wa.me/97286812050?text=' + encodeURIComponent(text); }

var STATUS = {
  official: 'רשמי, לפי אפל',
  rumor: 'שמועה',
  conflict: 'שמועות סותרות',
  weak: 'שמועה חלשה',
  unknown: 'לא ידוע'
};

/* ---------------------------------------------------------------- אימות */
var ISO = /^\d{4}-\d{2}-\d{2}$/;
var today = new Date().toISOString().slice(0, 10);
function checkSrc(where, s, mustApple) {
  if (!s) { fail(where + ': אין מקור'); return; }
  ['who', 'outlet', 'url', 'date'].forEach(function (k) { if (!s[k]) fail(where + ': במקור חסר ' + k); });
  if (s.url && !/^https:\/\//.test(s.url)) fail(where + ': קישור המקור אינו https');
  if (s.date && !ISO.test(s.date)) fail(where + ': תאריך המקור אינו YYYY-MM-DD');
  if (s.date && s.date > today) fail(where + ': תאריך מקור עתידי, ' + s.date);
  if (mustApple && s.url && !/^https:\/\/www\.apple\.com\//.test(s.url)) fail(where + ': מידע "רשמי" חייב מקור ב-apple.com');
}
data.pages.forEach(function (pg) {
  var W = pg.slug;
  ['slug', 'kind', 'name', 'name_he', 'checked', 'published', 'title', 'description', 'h1', 'sub', 'wa'].forEach(function (k) {
    if (!pg[k]) fail(W + ': חסר ' + k);
  });
  if (pg.kind !== 'rumor' && pg.kind !== 'announced') fail(W + ': kind לא מוכר, ' + pg.kind);
  if (pg.checked && (!ISO.test(pg.checked) || pg.checked > today)) fail(W + ': checked לא תקין או עתידי');
  if (pg.title && pg.title.length > 60) fail(W + ': title של ' + pg.title.length + ' תווים, מעל 60');
  (pg.official || []).forEach(function (o, i) { checkSrc(W + '.official[' + i + ']', o.src, true); });
  (pg.timing || []).concat(pg.rumors || []).forEach(function (r, i) {
    if (!STATUS[r.status]) fail(W + ': status לא מוכר, ' + r.status);
    if (r.status === 'official') fail(W + ': שמועה מסומנת official. מידע רשמי שייך ל-official');
    checkSrc(W + '.rumor[' + i + ']', r.src, false);
  });
  if (pg.kind === 'announced') checkSrc(W + '.specs_src', pg.specs_src, true);
  if (pg.kind === 'rumor' && !(pg.rumors || []).length) fail(W + ': עמוד שמועות בלי שמועות');

  /* הכלל של אופק: שום הבטחה. והכללים של האתר: בלי מקף ארוך, בלי מחיר, בלי "חינם". */
  var txt = JSON.stringify(pg);
  var BAN = [
    [/נעדכן|נודיע|יתעדכן|נשמור לכם|מובטח לכם/, 'מילת הבטחה'],
    [/—/, 'מקף ארוך'],
    [/₪|\$\s?\d|\d\s?דולר/, 'מחיר'],
    [/חינם/, '"חינם"'],
    [/וואטסאפ/, '"וואטסאפ" בעברית'],
    [/[֐-׿]-ƒ\//, 'אות עברית במקף לפני ƒ/, שמוצגת הפוך']
  ];
  BAN.forEach(function (b) { var m = txt.match(b[0]); if (m) fail(W + ': ' + b[1] + ' ("' + m[0] + '")'); });
});
if (errors.length) {
  console.error('✗ gen-upcoming: ' + errors.length + ' בעיות, לא נכתב אף עמוד:');
  errors.forEach(function (e) { console.error('   ' + e); });
  process.exit(1);
}

/* ---------------------------------------------------------------- בנייה */
function srcHtml(s) {
  return '<span class="aside"> מקור: <a href="' + esc(s.url) + '" rel="nofollow noopener" target="_blank">' +
    esc(s.who === s.outlet ? s.outlet : s.who + ', ' + s.outlet) + '</a>, ' + esc(monthHe(s.date)) + '.</span>';
}

var DISCLAIM_RUMOR = function (pg) {
  return [
    'כל מה שכתוב בעמוד הזה על ' + pg.name_he + ' הוא שמועה: דיווחים של אנליסטים, של כלי תקשורת ושל מדליפים, שאפל לא אישרה. חלק מהן יתבררו כנכונות וחלק לא, וכבר קרה ששמועה נפוצה לא התממשה. ליד כל שמועה כתוב מי אמר אותה ומתי, כדי שתוכלו לשפוט בעצמכם.',
    'אנחנו לא מתחייבים לשום דבר לגבי הדגם הזה: לא למועד, לא למפרט, לא למחיר ולא לזמינות אצלנו. העמוד הזה אינו הצעה למכירה ואינו הזמנה מוקדמת.'
  ];
};
var DISCLAIM_ANNOUNCED = function (pg) {
  return [
    'הנתונים בעמוד הזה מעמוד המפרט הרשמי של אפל, בגרסה הבינלאומית. אפל ישראל עוד לא פרסמה את ' + pg.name_he + ', והגרסה שתימכר בישראל, אם תימכר, עשויה להיות שונה. התאריכים בעמוד הם מה שאפל פרסמה לגבי מדינות אחרות, ולא התחייבות לגבי ישראל.',
    'אנחנו לא מתחייבים לשום דבר לגבי הדגם הזה: לא למועד, לא למחיר ולא לזמינות אצלנו. העמוד הזה אינו הצעה למכירה ואינו הזמנה מוקדמת.'
  ];
};
var FINE = 'המידע בעמוד נאסף מפרסומים פומביים ומוצג כפי שפורסם במקור. מה שמסומן כשמועה אינו מאומת ואינו מידע רשמי של אפל, וכל פרט עשוי להשתנות. אין בעמוד התחייבות מכל סוג, וההחלטה אם לקנות עכשיו או לחכות היא שלכם.';

function section(id, h, inner) {
  return '<section class="block" id="' + id + '" aria-labelledby="h-' + id + '">\n  <div class="wrap box">\n' +
    '    <h2 id="h-' + id + '">' + esc(h) + '</h2>\n' + inner + '  </div>\n</section>\n\n';
}
function linksHtml(ls) {
  if (!ls || !ls.length) return '';
  return '    <ul>\n' + ls.map(function (l) { return '      <li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>'; }).join('\n') + '\n    </ul>\n';
}

function buildMain(pg) {
  var rumor = pg.kind === 'rumor';
  var o = '<main id="main" role="main" tabindex="-1">\n' +
    '<!-- gen-upcoming: נכתב מ-.claude/data/upcoming.json. אל תערוך כאן, ההרצה הבאה תדרוס. -->\n\n';

  /* hero */
  o += '<section class="ghero" aria-labelledby="gh">\n  <div class="wrap">\n    <div class="inner">\n' +
    '      <h1 id="gh">' + esc(pg.h1) + '</h1>\n' +
    '      <p class="sub">' + esc(pg.sub) + '</p>\n' +
    '      <div class="hcta"><a class="btn btn-wa btn-hero" href="' + esc(wa(pg.wa)) + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" decoding="async">שאלו אותנו ב-WhatsApp</a></div>\n' +
    '      <p class="meta">\n' +
    '        <span>נבדק לאחרונה <time id="pg-checked" datetime="' + pg.checked + '">' + dayHe(pg.checked) + '</time></span>\n' +
    (pg.tags || []).map(function (t) { return '        <span>' + esc(t) + '</span>\n'; }).join('') +
    '      </p>\n    </div>\n  </div>\n</section>\n\n';

  /* הצהרה, לפני כל תוכן */
  o += '<section class="rules" aria-labelledby="rules-h">\n  <div class="wrap">\n    <div class="box">\n' +
    '      <h2 id="rules-h">לפני שקוראים</h2>\n' +
    (rumor ? DISCLAIM_RUMOR(pg) : DISCLAIM_ANNOUNCED(pg)).map(function (p) { return '      <p>' + esc(p) + '</p>\n'; }).join('') +
    (rumor ? '      <ol>\n' +
      '        <li><b>רשמי, לפי אפל:</b> אפל פרסמה את זה.</li>\n' +
      '        <li><b>שמועה:</b> דיווח של אנליסט, כלי תקשורת או מדליף, שלא אושר.</li>\n' +
      '        <li><b>שמועות סותרות:</b> שני מקורות טוענים דברים שונים על אותו נושא.</li>\n' +
      '        <li><b>שמועה חלשה:</b> מקור בלי היסטוריה מבוססת, לפי כלי התקשורת שציטט אותו.</li>\n' +
      '      </ol>\n' : '') +
    '    </div>\n  </div>\n</section>\n\n';

  /* מה ידוע רשמית */
  if ((pg.official || []).length) {
    o += section('official', pg.official_h || 'מה ידוע בוודאות',
      pg.official.map(function (x) {
        return '    <p><b>' + STATUS.official + ':</b> ' + esc(x.text) + srcHtml(x.src) + '</p>\n' + linksHtml(x.links);
      }).join(''));
  }

  /* מפרט רשמי, רק לדגם שהוכרז */
  if (!rumor && (pg.specs || []).length) {
    o += '<section class="block" id="specs" aria-labelledby="h-specs">\n  <div class="wrap box">\n' +
      '    <h2 id="h-specs">' + esc(pg.specs_h || 'המפרט הרשמי') + '</h2>\n' +
      (pg.specs_lead ? '    <p class="lead">' + esc(pg.specs_lead) + '</p>\n' : '') +
      '    <div class="cmp-wrap" tabindex="0" role="region" aria-labelledby="h-specs">\n' +
      '      <table class="cmp">\n' +
      '        <caption>המפרט של ' + esc(pg.name) + ' לפי אפל</caption>\n' +
      '        <thead><tr><th scope="col">מה</th><th scope="col">לפי אפל</th></tr></thead>\n        <tbody>\n' +
      pg.specs.map(function (r) { return '          <tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('\n') +
      '\n        </tbody>\n      </table>\n    </div>\n' +
      '    <p>' + srcHtml(pg.specs_src) + '</p>\n' +
      '  </div>\n</section>\n\n';
  }
  if (!rumor && (pg.notes || []).length) {
    o += section('notes', pg.notes_h, '    <ul>\n' + pg.notes.map(function (n) { return '      <li>' + esc(n) + '</li>'; }).join('\n') + '\n    </ul>\n');
  }

  /* מועד */
  if ((pg.timing || []).length) {
    o += section('timing', pg.timing_h,
      (pg.timing_lead ? '    <p class="lead">' + esc(pg.timing_lead) + '</p>\n' : '') +
      pg.timing.map(function (t) {
        return '    <p><b>' + STATUS[t.status] + ':</b> ' + esc(t.claim) + (t.note ? ' ' + esc(t.note) : '') + srcHtml(t.src) + '</p>\n';
      }).join(''));
  }

  /* טבלת השמועות */
  if ((pg.rumors || []).length) {
    o += '<section class="block" id="rumors" aria-labelledby="h-rumors">\n  <div class="wrap box">\n' +
      '    <h2 id="h-rumors">' + esc(pg.rumors_h) + '</h2>\n' +
      (pg.rumors_lead ? '    <p class="lead">' + esc(pg.rumors_lead) + '</p>\n' : '') +
      '    <div class="cmp-wrap" tabindex="0" role="region" aria-labelledby="h-rumors">\n' +
      '      <table class="cmp">\n' +
      '        <caption>שמועות על ' + esc(pg.name) + ', עם המקור של כל אחת. אף אחת מהן לא אושרה על ידי אפל.</caption>\n' +
      '        <thead><tr><th scope="col">נושא</th><th scope="col">מה נטען</th><th scope="col">מי אמר ומתי</th><th scope="col">מצב</th></tr></thead>\n        <tbody>\n' +
      pg.rumors.map(function (r) {
        return '          <tr><th scope="row">' + esc(r.topic) + '</th><td>' + esc(r.claim) + (r.note ? ' ' + esc(r.note) : '') +
          '</td><td><a href="' + esc(r.src.url) + '" rel="nofollow noopener" target="_blank">' +
          esc(r.src.who === r.src.outlet ? r.src.outlet : r.src.who + ', ' + r.src.outlet) + '</a>, ' + esc(monthHe(r.src.date)) +
          '</td><td>' + STATUS[r.status] + '</td></tr>';
      }).join('\n') +
      '\n        </tbody>\n      </table>\n    </div>\n  </div>\n</section>\n\n';
  }

  /* מה לא ידוע */
  if ((pg.unknown || []).length) {
    o += section('unknown', 'מה עוד לא ידוע',
      '    <p class="lead">אלה דברים שאין עליהם היום מידע אמין, ולכן גם אנחנו לא יודעים אותם.</p>\n' +
      '    <ul>\n' + pg.unknown.map(function (u) { return '      <li>' + esc(u) + '</li>'; }).join('\n') + '\n    </ul>\n');
  }

  /* לחכות או לקנות */
  if ((pg.wait || []).length) {
    o += section('wait', pg.wait_h, pg.wait.map(function (w) { return '    <p>' + esc(w) + '</p>\n'; }).join('') + linksHtml(pg.links));
  }

  /* שאר הדגמים שבדרך. בלי זה לכל עמוד היה קישור נכנס יחיד, מהרכזת, ועריכה אחת שם הייתה
     מנתקת אותו מהאתר. הפריפלייט הזהיר על זה ב-24.9.2026. */
  var sibs = data.pages.filter(function (x) { return x.slug !== pg.slug; });
  if (sibs.length) {
    o += section('more', 'עוד דגמים שבדרך', '    <ul>\n' + sibs.map(function (x) {
      return '      <li><a href="/upcoming-phones/' + x.slug + '/">' + esc(x.name_he) + '</a>: ' +
        (x.kind === 'rumor' ? 'שמועות, לא מאומת' : 'הוכרז רשמית, עוד לא בחנויות') + '</li>';
    }).join('\n') + '\n    </ul>\n');
  }

  /* המקורות, כל אחד פעם אחת */
  var seen = {}, srcs = [];
  function add(s) { if (s && !seen[s.url]) { seen[s.url] = 1; srcs.push(s); } }
  (pg.official || []).forEach(function (x) { add(x.src); });
  add(pg.specs_src);
  (pg.timing || []).forEach(function (x) { add(x.src); });
  (pg.rumors || []).forEach(function (x) { add(x.src); });
  o += section('sources', 'המקורות',
    '    <p class="lead">כל המקורות שהעמוד מבוסס עליהם, בתאריך הבדיקה שבראש העמוד.</p>\n' +
    '    <ol>\n' + srcs.map(function (s) {
      return '      <li><a href="' + esc(s.url) + '" rel="nofollow noopener" target="_blank">' + esc(s.outlet) + '</a></li>';
    }).join('\n') + '\n    </ol>\n');

  /* CTA והצהרה סוגרת */
  o += '<section class="cta" aria-labelledby="cta-h">\n  <div class="wrap">\n' +
    '    <h2 id="cta-h">יש לכם שאלה?</h2>\n' +
    '    <p>אפשר לשאול אותנו על כל דגם, גם על כאלה שעוד לא יצאו, ולהשוות מול מה שכבר יש. אנחנו ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n' +
    '    <div class="row">\n' +
    '      <a class="btn btn-wa" href="' + esc(wa(pg.wa)) + '"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">שלחו הודעה ב-WhatsApp</a>\n' +
    '      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
    '      <a class="btn btn-teal" href="/phones/">כל המכשירים</a>\n' +
    '    </div>\n' +
    '    <p class="fine">' + esc(FINE) + '</p>\n' +
    '  </div>\n</section>\n\n</main>';
  return o;
}

function setMeta(s, re, val, what, file) {
  if (!re.test(s)) { console.error('✗ ' + file + ': לא נמצא ' + what); process.exit(1); }
  return s.replace(re, function (m, a, b) { return a + esc(val) + b; });
}

var written = 0;
data.pages.forEach(function (pg) {
  var rel = 'upcoming-phones/' + pg.slug + '/index.html';
  var file = path.join(PROTO, rel);
  if (!fs.existsSync(file)) {
    console.error('✗ ' + rel + ' לא קיים. צור אותו קודם עם new-page.js --from upcoming-phones/index.html');
    process.exit(1);
  }
  var s = fs.readFileSync(file, 'utf8');
  var nl = /\r\n/.test(s) ? '\r\n' : '\n';
  var a = s.indexOf('<main'), b = s.indexOf('</main>');
  if (a < 0 || b < 0) { console.error('✗ ' + rel + ': אין <main>'); process.exit(1); }
  s = s.slice(0, a) + buildMain(pg).split('\n').join(nl) + s.slice(b + '</main>'.length);

  var url = SITE + '/upcoming-phones/' + pg.slug + '/';
  s = setMeta(s, /(<title>)[^<]*(<\/title>)/, pg.title, 'title', rel);
  s = setMeta(s, /(<meta name="description" content=")[^"]*(")/, pg.description, 'description', rel);
  s = setMeta(s, /(<meta property="og:title" content=")[^"]*(")/, pg.title, 'og:title', rel);
  s = setMeta(s, /(<meta property="og:description" content=")[^"]*(")/, pg.description, 'og:description', rel);
  s = setMeta(s, /(<meta name="twitter:title" content=")[^"]*(")/, pg.title, 'twitter:title', rel);
  s = setMeta(s, /(<meta name="twitter:description" content=")[^"]*(")/, pg.description, 'twitter:description', rel);

  /* JSON-LD: Article במקום TechArticle, תאריכים מהנתונים, ופירורי לחם בשלוש רמות */
  var found = { art: 0, bc: 0 };
  s = s.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, function (m, open, body, close) {
    var j;
    try { j = JSON.parse(body); } catch (e) { return m; }
    if (j['@type'] === 'TechArticle' || j['@type'] === 'Article') {
      found.art++;
      j['@type'] = 'Article';
      j.headline = pg.h1;
      j.description = pg.description;
      j.datePublished = pg.published;
      j.dateModified = pg.checked;
      j['@id'] = url + '#article';
      j.mainEntityOfPage = { '@type': 'WebPage', '@id': url };
      return open + nl + JSON.stringify(j) + nl + close;
    }
    if (j['@type'] === 'BreadcrumbList') {
      found.bc++;
      j.itemListElement = [
        { '@type': 'ListItem', position: 1, name: 'פון גת', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'מתי יוצא הדגם הבא', item: SITE + '/upcoming-phones/' },
        { '@type': 'ListItem', position: 3, name: pg.h1, item: url }
      ];
      return open + nl + JSON.stringify(j) + nl + close;
    }
    return m;
  });
  if (found.art !== 1 || found.bc !== 1) {
    console.error('✗ ' + rel + ': ציפיתי ל-Article אחד ול-BreadcrumbList אחד, נמצאו ' + found.art + ' ו-' + found.bc);
    process.exit(1);
  }
  fs.writeFileSync(file, s);
  written++;
  console.log('✓ ' + rel + '  ' + (pg.kind === 'rumor' ? (pg.rumors.length + ' שמועות') : (pg.specs.length + ' שורות מפרט רשמי')) +
    ', נבדק ' + pg.checked);
});

/* ---------------------------------------------------------------- המקטע בעמוד הרכזת */
(function () {
  var file = path.join(PROTO, 'upcoming-phones/index.html');
  var s = fs.readFileSync(file, 'utf8');
  var nl = /\r\n/.test(s) ? '\r\n' : '\n';
  var START = '<!-- gen-upcoming:hub:start -->', END = '<!-- gen-upcoming:hub:end -->';
  var i = s.indexOf(START), j = s.indexOf(END);
  if (i < 0 || j < 0) { console.error('✗ upcoming-phones/index.html: סימני gen-upcoming:hub חסרים'); process.exit(1); }
  var LABEL = { rumor: 'שמועות, לא מאומת', announced: 'הוכרז רשמית, עוד לא בחנויות' };
  var body = [
    '<section class="block" id="coming" aria-labelledby="h-coming">',
    '  <div class="wrap box">',
    '    <h2 id="h-coming">הדגמים שבדרך</h2>',
    '    <p class="lead">לכל דגם של אפל שהוכרז או שמדברים עליו, ועוד לא בחנויות, יש עמוד נפרד. בעמודי השמועות כל טענה מופיעה עם המקור והתאריך שלה ובסימון ברור שאינה מאומתת. אף אחד מהעמודים האלה אינו התחייבות מצדנו.</p>',
    '    <ul>'
  ].concat(data.pages.map(function (pg) {
    return '      <li><a href="/upcoming-phones/' + pg.slug + '/">' + esc(pg.name_he) + '</a>: ' + LABEL[pg.kind] + '</li>';
  })).concat(['    </ul>', '  </div>', '</section>']).join(nl);
  s = s.slice(0, i + START.length) + nl + body + nl + s.slice(j);
  fs.writeFileSync(file, s);
  console.log('✓ upcoming-phones/index.html: מקטע "הדגמים שבדרך" עם ' + data.pages.length + ' קישורים');
})();
console.log('\n' + written + ' עמודים. הרצה: node .claude/preflight.js');
