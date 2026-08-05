#!/usr/bin/env node
/* PHONE GAT — scaffold a new content page that already meets the standard.
 *
 *   node .claude/skills/pg-new-content-page/scripts/new-page.js \
 *     --slug screen-repair \
 *     --title "החלפת מסך לאייפון ולגלקסי: מה חשוב לדעת | פון גת" \
 *     --desc  "כמה זמן לוקח, מה ההבדל בין מקורי לתחליפי, ומתי שווה לתקן." \
 *     --h1    "החלפת מסך: מה חשוב לדעת לפני שמחליפים"
 *
 * It does NOT invent a template. It reads the newest existing content page and reuses its chrome,
 * so the scaffold can never drift from what actually ships: the environment guard, the GTM gating,
 * the accessibility menu with all ten effect rules, the cookie banner, the service worker, the
 * header and footer, the skip link, the buttons. Those are the fourteen things a hand-written page
 * silently omits.
 *
 * What it leaves you: an empty <main> with a hero and one section stub. Write the content, then run
 * preflight.
 */
'use strict';
var fs = require('fs'), path = require('path');

var ROOT = path.resolve(__dirname, '..', '..', '..', '..');   /* repo root */
var PROTO = path.join(ROOT, 'prototype');
/* ---------- args ---------- */
var args = {};
process.argv.slice(2).forEach(function (a, i, all) {
  if (a.indexOf('--') === 0) args[a.slice(2)] = all[i + 1];
});
var need = ['slug', 'title', 'desc', 'h1'];
var missing = need.filter(function (k) { return !args[k]; });
if (missing.length) {
  console.error('חסרים ארגומנטים: ' + missing.map(function (m) { return '--' + m; }).join(', '));
  console.error('\nדוגמה:\n  node ' + path.relative(ROOT, __filename) +
    ' --slug screen-repair --title "…" --desc "…" --h1 "…"');
  process.exit(1);
}
/* slug מקונן מותר: phones/all, phones/iphone-17, guides/how-to-choose-a-phone.
 * נוסף ב-5.8.2026 לקראת אזור המכשירים, שכל הכתובות שלו עמוקות בשתי רמות. הרגקס הקודם דרש
 * מקטע אחד, ולכן החלופה היחידה הייתה כתיבת HTML ביד, כלומר בדיוק מה ש-§0 בסקיל אוסר ומה
 * שיצר את 14 הפערים במדריך התקלות.
 *
 * העומק עצמו לא דורש שום התאמה אחרת: toRoot למטה הופך כל נתיב יחסי לשורשי־מוחלט (/logo.png)
 * ולא ל-../, ולכן הוא נכון באותה מידה בכל רמה. הנתיבים, ה-canonical, מעטפת ה-sw ותיקיית
 * התמונות כולם נגזרים מ-args.slug ומטפלים בלוכסן מעצמם.
 *
 * הגבולות שכן צריך לאכוף: בלי לוכסן בהתחלה או בסוף, בלי לוכסן כפול, ובלי נקודות. slug מגיע
 * לתוך path.join ואל תוך כתובת ציבורית, ולכן ".." שם הוא כתיבה מחוץ ל-prototype. */
if (!/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(args.slug)) {
  console.error('slug חייב להיות אנגלית קטנה עם מקפים, ואפשר לקנן בלוכסן: ' + args.slug);
  console.error('תקין:   screen-repair · phones/all · phones/iphone-17 · guides/how-to-choose-a-phone');
  console.error('פסול:   /phones · phones/ · phones//all · phones/../x · Phones/All');
  process.exit(1);
}
var DEPTH = args.slug.split('/').length;
if (process.argv.indexOf('--flat') > -1 && DEPTH > 1) {
  console.error('--flat לא יכול לקבל slug מקונן: ' + args.slug);
  console.error('הכתובת השטוחה היא slug.html אחד, ואין לה איפה להחזיק היררכיה.');
  process.exit(1);
}

/* המקור שממנו נלקחת המסגרת. ברירת המחדל היא המדריך, שהוא מימוש הייחוס של התקן.
 * --from <file> מצביע על עמוד אחר, וזה הכרחי לעמודי השירות: הרכיבים שלהם (פירורי לחם, כרטיסי
 * סימפטום, בדיקת ההתאמה, הפלייסהולדר) נולדו בעמוד האייפון ואינם קיימים במדריך. בלי זה העמוד
 * השני היה נבנה בהעתקה ידנית, כלומר בדיוק הסדק שהסקריפט הזה קיים כדי למנוע.
 *
 * המשמעות התפעולית: תקן קודם את עמוד המקור, ורק אחר כך פגם ממנו. פגם שנשאר במקור משוכפל הלאה. */
var SOURCE = args.from || 'phone-problems/index.html';

/* --flat מייצר את התבנית הישנה (slug.html). ברירת המחדל היא תיקייה עם index.html, כך שהכתובת היא
 * /slug/ ולא /slug.html — כך אושר מבנה ה-URL לעמודי השירות. המחיר: כל נתיב יחסי שהמסגרת נושאת
 * חייב להפוך לשורשי, אחרת הוא נפתר לתוך תיקיית העמוד. זה קורה ב-toRoot למטה. */
var FLAT = process.argv.indexOf('--flat') > -1;
var outName = FLAT ? args.slug + '.html' : args.slug + '/index.html';
var outPath = path.join(PROTO, outName);
if (fs.existsSync(outPath)) { console.error(outName + ' כבר קיים — לא דורס.'); process.exit(1); }
/* בעמוד עומק התמונות נשארות בנתיב שורשי אחד ולא נכפלות בכל תיקיית עמוד */
var IMGDIR = FLAT ? args.slug : 'img/' + args.slug;

var src;
try { src = fs.readFileSync(path.join(PROTO, SOURCE), 'utf8'); }
catch (e) { console.error('לא נמצא ' + SOURCE + ' — ממנו נלקחת המסגרת.'); process.exit(1); }

var PROD = 'https://www.phonegat.co.il/';
var url = PROD + (FLAT ? outName : args.slug + '/');
var today = new Date().toISOString().slice(0, 10);
var h = src;

/* ---------- head: metadata ---------- */
function swap(re, to, label) {
  if (!re.test(h)) { console.error('לא נמצא ' + label + ' — המסגרת ב-' + SOURCE + ' השתנתה, עדכן את הסקריפט.'); process.exit(1); }
  h = h.replace(re, to);
}
swap(/<title>[\s\S]*?<\/title>/, '<title>' + args.title + '</title>', '<title>');
swap(/(<meta name="description" content=")[^"]*(">)/, '$1' + args.desc + '$2', 'meta description');
swap(/(<link rel="canonical" href=")[^"]*(">)/, '$1' + url + '$2', 'canonical');
swap(/(<meta property="og:title" content=")[^"]*(">)/, '$1' + args.title + '$2', 'og:title');
swap(/(<meta property="og:description" content=")[^"]*(">)/, '$1' + args.desc + '$2', 'og:description');
swap(/(<meta property="og:url" content=")[^"]*(">)/, '$1' + url + '$2', 'og:url');
swap(/(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + args.title + '$2', 'twitter:title');
swap(/(<meta name="twitter:description" content=")[^"]*(">)/, '$1' + args.desc + '$2', 'twitter:description');

/* ---------- schema ----------
 * TechArticle is rewritten for this page. FAQPage is dropped: it must mirror text that is actually
 * on the page, and there is no text yet. The #business block stays exactly as it is — preflight
 * requires the entity to be defined here, not merely referenced. */
h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"TechArticle"[\s\S]*?<\/script>/,
  '<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'TechArticle',
    '@id': url + '#article',
    headline: args.h1, description: args.desc, inLanguage: 'he-IL',
    datePublished: today, dateModified: today,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: 'ברוך אדלשטיין', jobTitle: 'טכנאי ראשי', worksFor: { '@id': PROD + '#business' } },
    publisher: { '@id': PROD + '#business' },
    image: PROD + 'og-home.jpg'
  }) + '\n</script>');

h = h.replace(/<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?<\/script>\s*/, '');

h = h.replace(/(\{"@type":"ListItem","position":2,"name":")[^"]*(","item":")[^"]*(")/,
  '$1' + args.h1.slice(0, 40) + '$2' + url + '$3');

/* ---------- nav: this page becomes the current one ---------- */
/* the slashes in the href must be escaped, or the literal closes at the first one and
   "phone-problems" is parsed as regex flags — the script would not even load */
h = h.replace(/<a href="\/phone-problems\/" aria-current="page">([^<]*)<\/a>/,
  '<a href="/phone-problems/">$1</a>');
/* הניווט נשאר תשעה פריטים, בדיוק כמו בכל שאר הדפים.
 * הגרסה הקודמת הוסיפה פריט עשירי עם תווית חתוכה ל-18 תווים, וזה יצר שלוש תקלות בבת אחת:
 * מילה קטועה באמצע ("תיקון אייפון בקריי"), הדר שנשבר לשתי שורות בין 981px ל-1100px, וכשהגופן
 * התחלף מגופן הנפילה ל-Assistant ההדר התכווץ מ-92px ל-66px ומשך את כל הדף מעלה: CLS של 0.578
 * מול סף "גרוע" של 0.25 בגוגל.
 * קישור פנימי לעמוד החדש מגיע מהתוכן, לא מהתפריט. */

/* ---------- main: emptied to a working skeleton ---------- */
var mainStart = h.indexOf('<main id="main"');
var mainEnd = h.indexOf('</main>');
if (mainStart < 0 || mainEnd < 0) { console.error('לא נמצא <main> — עדכן את הסקריפט.'); process.exit(1); }
var openTag = h.slice(mainStart, h.indexOf('>', mainStart) + 1);

var skeleton = openTag + '\n\n' +
'<section class="ghero" aria-labelledby="gh">\n' +
'  <div class="wrap">\n' +
'    <div class="inner">\n' +
'      <h1 id="gh">' + args.h1 + '</h1>\n' +
'      <p class="sub">TODO פתיחה: מה הקורא מקבל כאן, בקול של ברוך וסיגל. משקל 300, עד ~54 תווים לשורה.</p>\n' +
'      <div class="hcta"><a class="btn btn-wa btn-hero" href="https://wa.me/97286812050?text=' +
        encodeURIComponent('היי, קראתי את ' + args.h1 + ' ואשמח להתייעץ') + '"><img class="wa-ico" src="whatsapp-logo.png" alt="" width="26" height="26" decoding="async">שאלו אותנו ב-WhatsApp</a></div>\n' +
'      <p class="meta">\n' +
'        <span>נכתב על ידי <b>ברוך אדלשטיין</b>, טכנאי ראשי בפון גת</span>\n' +
'        <span>עודכן ב' + ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][new Date().getMonth()] + ' ' + new Date().getFullYear() + '</span>\n' +
'        <span>אבחון ללא עלות</span>\n' +
'        <span>אחריות בכתב על תיקונים</span>\n' +
'      </p>\n' +
'    </div>\n' +
'  </div>\n' +
'</section>\n\n' +
'<!-- One section stub. Duplicate it per topic. The photo placeholder stays until a real 3:4 photo\n' +
'     exists; the caption describes the shot to take and the alt is already written, so dropping the\n' +
'     image in later is mechanical. Every CTA gets its own ?text= so GTM can segment it. -->\n' +
'<section class="prob" id="TODO-slug" style="--nc:var(--teal)" aria-labelledby="h-TODO-slug">\n' +
'  <div class="wrap row">\n' +
'    <figure class="fig">\n' +
'      <!-- כשתגיע התמונה: <picture>\n' +
'             <source type="image/webp" sizes="(max-width:900px) 92vw, 53vw" srcset="' + IMGDIR + '/TODO-700.webp 700w, ' + IMGDIR + '/TODO.webp 1086w">\n' +
'             <source type="image/jpeg" sizes="(max-width:900px) 92vw, 53vw" srcset="' + IMGDIR + '/TODO-700.jpg 700w, ' + IMGDIR + '/TODO.jpg 1086w">\n' +
'             <img src="' + IMGDIR + '/TODO.jpg" alt="TODO תיאור ענייני" width="1086" height="1448" loading="lazy" decoding="async">\n' +
'           </picture> -->\n' +
'      <div class="ph"><svg viewBox="0 0 200 200" aria-hidden="true"><g transform="translate(100 100)"><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#1878A8"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#e0913f" transform="rotate(90)"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#63a244" transform="rotate(180)"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#7D3169" transform="rotate(270)"/></g></svg><span>תמונה: TODO מה מצולם</span></div>\n' +
'    </figure>\n' +
'    <div class="txt">\n' +
'      <h2 id="h-TODO-slug">TODO כותרת המקטע</h2>\n' +
'      <p class="intro">TODO פתיחה. אם תוסיף FAQPage schema בהמשך, התשובה שם חייבת להיות הטקסט הזה בדיוק.</p>\n' +
'      <h3>מה כדאי לנסות לבד</h3>\n' +
'      <ol class="steps"><li>TODO שלב.</li></ol>\n' +
'      <div class="lab">\n' +
'        <p>TODO איפה עובר הגבול שממנו זו עבודה לטכנאי.</p>\n' +
'        <a class="btn btn-wa" href="https://wa.me/97286812050?text=' + encodeURIComponent('היי, אשמח לבדיקה') + '"><img class="wa-ico" src="whatsapp-logo.png" alt="" width="24" height="24" loading="lazy" decoding="async">שלחו הודעה</a>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'</section>\n\n' +
'<section class="cta" aria-labelledby="cta-h">\n' +
'  <div class="wrap">\n' +
'    <h2 id="cta-h">TODO שאלת סגירה</h2>\n' +
'    <p>TODO. אנחנו כאן ברחבת תשרי 2 בקרית גת, ראשון עד חמישי 9:00–18:30 ושישי 9:00–13:00.</p>\n' +
'    <div class="row">\n' +
'      <a class="btn btn-wa" href="https://wa.me/97286812050"><img class="wa-ico" src="whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">שלחו הודעה ב-WhatsApp</a>\n' +
'      <a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>\n' +
'      <a class="btn btn-teal" href="/#services">כל השירותים שלנו</a>\n' +
'    </div>\n' +
'    <p class="fine">האבחון וההצעה אצלנו ללא עלות וללא התחייבות.</p>\n' +
'  </div>\n' +
'</section>\n\n';

h = h.slice(0, mainStart) + skeleton + h.slice(mainEnd);

/* ---------- נתיבים שורשיים לעמוד עומק ----------
 * המסגרת נכתבה לדף שיושב בשורש, ולכן כולה נתיבים יחסיים: whatsapp-logo.png, index.html, sw.js.
 * מתוך תיקייה כל אחד מהם נפתר לתיקייה עצמה. התמונות מחזירות 404 וזה נראה מיד; הרישום של
 * ה-service worker נכשל בשקט ומצמצם את ה-scope לתיקייה אחת, כלומר PWA שבור בלי סימן על המסך.
 * בדיקה 14 ב-preflight תופסת את שניהם אם משהו כאן יפספס. */
function toRoot(s) {
  var SKIP = /^(?:\/|#|https?:|mailto:|tel:|data:|\?|javascript:)/;
  s = s.replace(/\b(src|href)="([^"]+)"/g, function (m, a, v) {
    return SKIP.test(v) ? m : a + '="/' + v + '"';
  });
  /* srcset הוא רשימה: כל כתובת בה צריכה טיפול נפרד */
  s = s.replace(/\bsrcset="([^"]+)"/g, function (m, v) {
    return 'srcset="' + v.split(',').map(function (part) {
      var t = part.trim(); if (!t) return t;
      return SKIP.test(t) ? t : '/' + t;
    }).join(', ') + '"';
  });
  s = s.replace(/url\((['"]?)(?!\/|https?:|data:)([^)'"]+)\1\)/g, 'url($1/$2$1)');
  /* ה-scope נגזר מנתיב הקובץ, ולכן נאמר במפורש */
  s = s.replace(/register\((['"])\/?sw\.js\1([^)]*)\)/, "register('/sw.js',{scope:'/'})");
  return s;
}
if (!FLAT) h = toRoot(h);

/* page-specific analytics: keep the helper, drop the guide's own events */
h = h.replace(/\n\s*pgTrack\('guide_device'[^;]*;/g, '');
/* \r? בכל מקום: הקבצים כאן שמורים ב-CRLF, והגרסה הקודמת שציפתה ל-LF בלבד לא התאימה ולא
 * הסירה כלום. הכשל היה שקט לגמרי, ולכן כל חמשת העמודים נשאו את מעקב הקריאה של המדריך
 * ושלחו guide_section_read מעמוד שירות. ה-swap הצמוד דווקא הצליח, כי הוא מסתיים בנקודה
 * ופסיק ולא בירידת שורה, וזה מה שהסווה את התקלה. */
h = h.replace(/\r?\n\s*\/\* Which symptoms were actually read[\s\S]*?\r?\n  \}\)\(\);/, '');

if (!FLAT) fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, h);

/* ---------- register the page ---------- */
var notes = [];

/* לא נוגעים ב-sitemap. עמוד נכנס אליו רק אחרי אישור לפרודקשן, ולכן זו פעולה של ההשקה
 * ולא של הפיגום. --sitemap מוסיף במפורש למי שיודע שהוא בשלב הזה. */
if (args.sitemap) {
var smPath = path.join(PROTO, 'sitemap.xml');
try {
  var sm = fs.readFileSync(smPath, 'utf8');
  if (sm.indexOf(url) < 0) {
    sm = sm.replace(/<\/urlset>/, '  <url>\n    <loc>' + url + '</loc>\n    <lastmod>' + today +
      '</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>');
    fs.writeFileSync(smPath, sm);
    notes.push('נוסף ל-sitemap.xml');
  }
} catch (e) { notes.push('⚠ לא ניתן לעדכן sitemap.xml — הוסף ידנית'); }
} else { notes.push("לא נוסף ל-sitemap (מצטרף בהשקה, או --sitemap)"); }

var swPath = path.join(PROTO, 'sw.js');
/* בעמוד עומק מה שמאוחסן הוא הכתובת שהדפדפן מבקש (/slug/), לא נתיב הקובץ */
var shellEntry = FLAT ? './' + outName : '/' + args.slug + '/';
/* ההשוואה היא למחרוזת המצוטטת ולא למחרוזת החלקית. עמוד אב נבלע בבן שלו: '/guides/' הוא
 * תת-מחרוזת של '/guides/official-vs-parallel-import/', ולכן אחרי שהבן נוסף, האב דולג בשקט
 * ולא נכנס למעטפת מעולם. קרה ב-5.8.2026 בדיוק כך, ובלי הודעת שגיאה. */
try {
  var sw = fs.readFileSync(swPath, 'utf8');
  if (sw.indexOf("'" + shellEntry + "'") < 0) {
    sw = sw.replace(/(const SHELL = \[)/, "$1'" + shellEntry + "', ");
    fs.writeFileSync(swPath, sw);
    notes.push('נוסף למעטפת ה-service worker');
  } else { notes.push('כבר במעטפת ה-service worker'); }
} catch (e) { notes.push('⚠ לא ניתן לעדכן sw.js — הוסף ידנית'); }

/* ---------- report ---------- */
console.log('\n✓ נוצר prototype/' + outName + '  (המסגרת הועתקה מ-' + SOURCE + ')');
notes.forEach(function (n) { console.log('  ' + n); });
console.log('\nמה שכבר בפנים: שומר PG_PROD · GTM מגודר · תפריט נגישות · באנר קוקיז ·');
console.log('service worker · canonical · ישות #business · דילוג לתוכן · כפתורי האתר · הפוטר המלא');
console.log('\nמה שנשאר לך:');
var step = 0, S = function () { return '  ' + (++step) + '. '; };
console.log(S() + 'להחליף כל TODO ב-<main>');
/* פירורי הלחם שהועתקו הם שתי רמות (בית › הדף). עמוד עמוק צריך את האמצע, ואת השם העברי של
 * ההורה הסקריפט לא יכול לדעת. הוא לא ממציא, ולכן הוא אומר. */
if (DEPTH > 1) {
  console.log(S() + 'פירורי לחם: הועתקו ' + 2 + ' רמות, ולעמוד הזה צריך ' + (DEPTH + 1) + '.');
  console.log('     להוסיף את ' + args.slug.split('/').slice(0, -1).join(' › ') +
    ' גם ב-JSON-LD (BreadcrumbList) וגם ב-<nav> שבדף.');
}
console.log(S() + 'להוסיף קישור לדף הזה מ-index.html (הניווט שם לא מתעדכן לבד)');
/* התמונות של עמוד עומק יושבות ב-prototype/img/<slug>/ ולא בתיקיית העמוד, ולכן זה מה שצריך
 * להעביר ל-prep-images. הגרסה הקודמת הדפיסה את ה-slug לבד והצביעה על תיקייה שלא קיימת. */
console.log(S() + 'תמונות 3:4 →  node .claude/skills/pg-new-content-page/scripts/prep-images.js ' + IMGDIR);
console.log(S() + 'עדכון שני התאריכים ב-accessibility.html');
console.log(S() + 'node .claude/preflight.js  ואז  node .claude/ship.js stage\n');
