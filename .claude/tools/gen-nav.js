#!/usr/bin/env node
/* gen-nav.js — כותב את הניווט הראשי, ה-CSS וה-JS שלו, לכל עמודי האתר.
 *
 * למה מחולל ולא עריכה ידנית: אין שלב build, וכל עמוד נושא עותק משלו של הניווט.
 * בדיקה בפריפלייט משווה את תוויות הניווט בכל עמוד מול index.html, ולכן שינוי
 * ידני בקובץ אחד שובר את כל השאר. כאן זה נכתב פעם אחת ומופץ ל-59 קבצים.
 *
 * למה זה נבנה בכלל: הניווט הישן החזיק 10 מקומות, ששה מהם עוגנים למקטעים בדף
 * הבית, ושלושה עמודים בלבד מתוך 50 עמודי התוכן היו נגישים ממנו.
 *
 * רשימת המכשירים נגזרת מ-devices.json ולא נכתבת כאן, כדי שדגם חדש לא ייעלם
 * מהתפריט בשקט. דגם שאינו ברשימת הסדר מפיל את המחולל בכוונה.
 *
 * ⚠ הקבצים מעורבי סופי שורה. ההוספה נעשית עם סוף השורה שקיים בפועל בכל קובץ,
 * כי קריאה וכתיבה מחדש מנרמלת הכול והופכת שינוי קטן לדיף של אלפי שורות.
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var db = JSON.parse(fs.readFileSync(path.join(PROTO, 'devices.json'), 'utf8'));

/* ── סדר המכשירים בתפריט ────────────────────────────────────────────
 * מדורג מלמעלה למטה בתוך כל מותג. הרשימה מפורשת ולא נגזרת ממחיר, כי מחיר
 * אינו במאגר בכוונה. דגם שאינו כאן עוצר את המחולל. */
var DEVICE_ORDER = {
  'אייפון': ['iphone-17-pro-max', 'iphone-17-pro', 'iphone-17', 'iphone-17e', 'iphone-16'],
  'גלקסי': ['galaxy-s26-ultra', 'galaxy-s26-plus', 'galaxy-s26', 'galaxy-a57', 'galaxy-a56', 'galaxy-a37', 'galaxy-a36', 'galaxy-a17'],
  'שיאומי': ['xiaomi-15', 'redmi-note-15', 'redmi-note-14-pro', 'redmi-note-14']
};

function deviceItems() {
  var bySlug = {};
  db.devices.forEach(function (d) { bySlug[d.slug] = d; });
  var placed = {};
  var cols = Object.keys(DEVICE_ORDER).map(function (brand) {
    var items = DEVICE_ORDER[brand].map(function (slug) {
      var d = bySlug[slug];
      if (!d) { fail('דגם ' + slug + ' מופיע בסדר התפריט ואינו במאגר'); }
      placed[slug] = 1;
      return { href: '/phones/' + slug + '/', label: d.name.replace(/\s*5G$/, '') };
    });
    return { head: brand, items: items };
  });
  var missing = db.devices.filter(function (d) {
    return d.status !== 'draft' && !placed[d.slug];
  }).map(function (d) { return d.slug; });
  if (missing.length) {
    fail('דגמים שאינם בתפריט: ' + missing.join(', ') +
      '\n  הוסף אותם ל-DEVICE_ORDER. זה נכשל בכוונה, כדי שדגם חדש לא ייעלם מהניווט.');
  }
  return cols;
}

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }

/* ── מבנה הניווט ────────────────────────────────────────────────────
 * type:'link' פריט יחיד. type:'drop' תפריט נפתח עם עמודות ושורת סיכום. */
function structure() {
  return [
    {
      type: 'drop', id: 'nd-devices', label: 'מכשירים',
      cols: deviceItems(),
      all: [
        { href: '/phones/', label: 'כל המכשירים' },
        { href: '/compare/', label: 'השוואות בין דגמים' },
        /* כלי ההשוואה, שונה מ-/compare/ שהוא ריכוז ההשוואות הכתובות. נשכח
           בגרסה הראשונה של הניווט ואותר בביקורת כיסוי מול הדיסק. */
        { href: '/phones/compare/', label: 'השוואת מכשירים' },
        { href: '/phones/find-my-phone/', label: 'איזה מכשיר מתאים לי' }
      ]
    },
    {
      type: 'drop', id: 'nd-repairs', label: 'תיקונים',
      cols: [
        {
          head: 'לפי תקלה', items: [
            { href: '/phone-screen-replacement-kiryat-gat/', label: 'החלפת מסך' },
            { href: '/phone-battery-replacement-kiryat-gat/', label: 'החלפת סוללה' },
            { href: '/charging-port-repair-kiryat-gat/', label: 'שקע טעינה' },
            { href: '/phone-camera-repair-kiryat-gat/', label: 'מצלמה' },
            { href: '/phone-speaker-microphone-repair-kiryat-gat/', label: 'רמקול ומיקרופון' },
            { href: '/phone-back-glass-repair-kiryat-gat/', label: 'גב אחורי' },
            { href: '/face-id-repair-kiryat-gat/', label: 'Face ID' }
          ]
        },
        {
          head: 'לפי מותג', items: [
            { href: '/iphone-repair-kiryat-gat/', label: 'תיקון אייפון' },
            { href: '/galaxy-a-screen-replacement-kiryat-gat/', label: 'מסך גלקסי A' },
            { href: '/galaxy-a-battery-replacement-kiryat-gat/', label: 'סוללה גלקסי A' },
            { href: '/redmi-repair-kiryat-gat/', label: 'תיקון רדמי נוט' },
            { href: '/xiaomi-repair-kiryat-gat/', label: 'שיאומי ופוקו' }
          ]
        }
      ],
      all: [
        { href: '/mobile-phone-repair-kiryat-gat/', label: 'מעבדת הסלולר' },
        { href: '/phone-problems/', label: 'מדריך תקלות' }
      ]
    },
    {
      type: 'drop', id: 'nd-guides', label: 'מדריכים',
      cols: [
        {
          head: null, items: [
            { href: '/guides/esim-israel/', label: 'eSIM בישראל' },
            { href: '/guides/how-much-storage/', label: 'כמה אחסון צריך' },
            { href: '/guides/official-vs-parallel-import/', label: 'יבוא מקביל או רשמי' }
          ]
        },
        {
          head: null, items: [
            { href: '/guides/phone-warranty-israel/', label: 'אחריות על טלפון' },
            { href: '/guides/new-or-previous-generation/', label: 'הדגם החדש או הקודם' },
            { href: '/guides/first-day-checklist/', label: 'מה לבדוק ביום הראשון' },
            { href: '/guides/first-phone-for-kid/', label: 'טלפון ראשון לילד' }
          ]
        }
      ],
      all: [{ href: '/guides/', label: 'כל המדריכים' }]
    },
    {
      type: 'drop', id: 'nd-areas', label: 'אזורי שירות',
      cols: [
        {
          head: null, items: [
            { href: '/mobile-phone-repair-kiryat-gat/', label: 'קריית גת' },
            { href: '/phone-repair-kiryat-malachi/', label: 'קריית מלאכי' },
            { href: '/phone-repair-lachish/', label: 'מועצה אזורית לכיש' },
            { href: '/phone-repair-yoav/', label: 'מועצה אזורית יואב' },
            { href: '/phone-repair-shafir/', label: 'מועצה אזורית שפיר' },
            { href: '/phone-repair-beer-tuvia/', label: 'מועצה אזורית באר טוביה' }
          ]
        }
      ],
      all: []
    },
    { type: 'link', href: '/#deals', label: 'מבצעים' },
    {
      type: 'drop', id: 'nd-about', label: 'פון גת',
      cols: [
        {
          head: null, items: [
            { href: '/#team', label: 'מי אנחנו' },
            { href: '/#reviews', label: 'ביקורות' },
            { href: '/#services', label: 'שירותים' }
          ]
        },
        {
          head: null, items: [
            { href: '/#press', label: 'כתבו עלינו' },
            { href: '/#map', label: 'מיקום' },
            { href: '/#faq', label: 'שאלות נפוצות' }
          ]
        }
      ],
      all: []
    },
    { type: 'link', href: '/contact/', label: 'צרו קשר' }
  ];
}

/* ── בניית ה-HTML ───────────────────────────────────────────────── */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildNav(selfHref) {
  function a(it) {
    var cur = it.href === selfHref ? ' aria-current="page"' : '';
    return '<a href="' + it.href + '"' + cur + '>' + esc(it.label) + '</a>';
  }
  var parts = structure().map(function (n) {
    if (n.type === 'link') return '      ' + a(n);
    var cols = n.cols.map(function (c) {
      return '            <div class="ncol">' +
        (c.head ? '<p class="nhead">' + esc(c.head) + '</p>' : '') +
        c.items.map(a).join('') + '</div>';
    }).join('\n');
    var all = n.all.length
      ? '\n          <div class="nall">' + n.all.map(a).join('') + '</div>'
      : '';
    /* העמודות עטופות ב-.nrow ולא יושבות ישירות בפאנל. פאנל ממוקם absolute הוא
       shrink-to-fit, ופריט שדורש flex-basis:100% גורם לו להתכווץ לרוחב עמודה
       אחת ולערום את כולן לגובה 941 פיקסלים. ההפרדה מונעת את זה. */
    return '      <div class="ndrop">\n' +
      '        <button type="button" class="ntrig" id="' + n.id + '-t" aria-expanded="false" aria-controls="' + n.id + '">' + esc(n.label) + '</button>\n' +
      '        <div class="npanel" id="' + n.id + '" role="group" aria-labelledby="' + n.id + '-t">\n' +
      '          <div class="nrow">\n' + cols + '\n          </div>' + all + '\n' +
      '        </div>\n' +
      '      </div>';
  });
  return '<nav class="main" id="nav" aria-label="ניווט ראשי">\n' + parts.join('\n') + '\n    </nav>';
}

/* ── CSS ─────────────────────────────────────────────────────────
 * הכללים הבסיסיים קודם והמדיה אחריהם. מדיה קוורי אינה מוסיפה ספציפיות,
 * ולכן כלל בסיס שנכתב אחריה מנצח אותה. זה כבר קרה פעם בפרויקט. */
var CSS_A = '/* ==== gen-nav:css:start ==== */';
var CSS_Z = '/* ==== gen-nav:css:end ==== */';

var CSS = [
  CSS_A,
  '/* ניווט נפתח — נכתב ע"י .claude/tools/gen-nav.js. אל תערוך ידנית, ההרצה הבאה תדרוס. */',
  'nav.main .ndrop{position:relative}',
  /* הקישורים הישירים חייבים אותו ארגז כמו הכפתורים. הכפתור ממורכז אנכית ב-44
     פיקסלים, והקישור נמתח לאותו גובה אבל הטקסט שלו נשאר בראש הארגז, ולכן
     "מבצעים" ו"צרו קשר" ישבו גבוה משאר הפריטים. */
  'nav.main>a{display:inline-flex;align-items:center;min-height:44px}',
  'nav.main .ntrig{background:none;border:0;color:#eaeaea;font:inherit;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;min-height:44px;padding:.3rem 0}',
  /* אין חץ. מצב פתוח מסומן בצבע, וזה מספיק. */
  'nav.main .ntrig:hover,nav.main .ntrig[aria-expanded="true"]{color:var(--teal)}',
  'nav.main .npanel{display:none;flex-direction:column;gap:.2rem;position:absolute;inset-inline-start:0;inset-block-start:calc(100% + .55rem);background:#111;border:1px solid #262626;padding:1.15rem 1.35rem;z-index:130}',
  'nav.main .npanel.open{display:flex}',
  /* גשר שקוף מעל הפאנל, שמכסה את הרווח שבינו לבין הכפתור. בלעדיו העכבר בדרך
     מהכפתור לפאנל עובר מעל כלום, mouseleave יורה, והתפריט נסגר באמצע התנועה.
     הוא צאצא של .ndrop ולכן המעבר מעליו אינו יציאה ממנה. */
  'nav.main .npanel::before{content:"";position:absolute;inset-inline:0;inset-block-end:100%;block-size:.7rem}',
  'nav.main .nrow{display:flex;align-items:flex-start;gap:0 1.9rem}',
  'nav.main .ncol{min-inline-size:8.6rem}',
  'nav.main .nhead{color:#9a9a9a;font-size:.95rem;font-weight:700;margin:0 0 .35rem;letter-spacing:.02em}',
  /* min-block-size ולא padding בלבד: גובה השורה משתנה בין דפדפנים, ו-44 שנשען
     על padding יצא 43 במדידה. flex עם מרכוז נותן את היעד בוודאות. */
  'nav.main .npanel a{display:flex;align-items:center;color:#eaeaea;font-weight:500;min-block-size:44px;padding-block:.3rem;white-space:nowrap;border:0}',
  'nav.main .npanel a:hover{color:var(--teal)}',
  'nav.main .npanel a[aria-current="page"]{color:var(--teal)}',
  'nav.main .nall{border-top:1px solid #2a2a2a;padding-block-start:.45rem;margin-block-start:.5rem;display:flex;gap:0 1.9rem;flex-wrap:wrap}',
  /* התפריט של המכשירים רחב, ולכן הוא נפתח לכיוון פנים המסך ולא החוצה */
  'nav.main .ndrop:last-of-type .npanel{inset-inline-start:auto;inset-inline-end:0}',
  '@media(max-width:980px){',
  '  nav.main .ndrop{display:block}',
  '  nav.main .ntrig{display:flex;inline-size:100%;padding:.7rem clamp(12px,3vw,28px);border-bottom:1px solid #1c1c1c;min-height:48px}',
  /* ה-padding מוצהר במפורש ולא בירושה: לאתר יש nav.main a{padding-block:14px}
     באותה ספציפיות בדיוק, והוא נערם על ה-padding של השורה והפך את הקישורים
     ל-55 פיקסלים מול 49 של הכפתורים. */
  '  nav.main>a{display:flex;align-items:center;inline-size:100%;min-height:48px;padding:.7rem clamp(12px,3vw,28px)}',
  '  nav.main .npanel{position:static;border:0;background:#0b0b0b;padding:.15rem 0 .45rem;gap:0;min-inline-size:0}',
  '  nav.main .npanel::before{content:none}',
  '  nav.main .nrow{flex-direction:column;gap:0}',
  '  nav.main .ncol{min-inline-size:0}',
  '  nav.main .nhead{padding:.7rem clamp(18px,5vw,36px) .15rem;margin:0}',
  '  nav.main .npanel a{padding:.62rem clamp(24px,6vw,44px);border-bottom:1px solid #171717}',
  '  nav.main .nall{border-top:1px solid #2a2a2a;margin:0;padding-block-start:0;flex-direction:column;gap:0}',
  '  nav.main .ndrop:last-of-type .npanel{inset-inline-end:auto}',
  '}',
  CSS_Z
].join('\n');

/* ── JS ──────────────────────────────────────────────────────────
 * במסך עם עכבר התפריט נפתח גם במעבר עכבר, ובמגע בקליק בלבד. hover *בנוסף*
 * לקליק זה בסדר, hover *במקום* קליק זה הכשל הנגישותי הנפוץ בתפריטים כאלה,
 * ולכן הקליק נשאר עובד בכל מצב.
 * השער הוא (hover:hover) and (pointer:fine): בלעדיו מכשיר מגע יורה
 * mouseenter סינתטי בהקשה, והתפריט נפתח ונסגר מעצמו.
 * מקלדת: Escape סוגר ומחזיר פוקוס, חיצים מנווטים. */
var JS_A = '<!-- gen-nav:js:start -->';
var JS_Z = '<!-- gen-nav:js:end -->';

var JS = [
  JS_A,
  '<script>/* ניווט נפתח — .claude/tools/gen-nav.js. אל תערוך ידנית. */',
  '(function(){var nav=document.getElementById("nav");if(!nav)return;',
  'var trigs=[].slice.call(nav.querySelectorAll(".ntrig"));',
  'function pan(t){return document.getElementById(t.getAttribute("aria-controls"))}',
  'function shut(t){t.setAttribute("aria-expanded","false");var p=pan(t);if(p)p.classList.remove("open")}',
  'function shutAll(x){trigs.forEach(function(t){if(t!==x)shut(t)})}',
  'function open(t){shutAll(t);t.setAttribute("aria-expanded","true");var p=pan(t);if(p)p.classList.add("open")}',
  'var HQ=window.matchMedia?window.matchMedia("(hover:hover) and (pointer:fine) and (min-width:981px)"):null;',
  'trigs.forEach(function(t){',
  '  t.addEventListener("click",function(){t.getAttribute("aria-expanded")==="true"?shut(t):open(t)});',
  '  var d=t.parentNode;',
  '  d.addEventListener("mouseenter",function(){if(HQ&&HQ.matches)open(t)});',
  '  d.addEventListener("mouseleave",function(){if(HQ&&HQ.matches)shut(t)});',
  '  t.addEventListener("keydown",function(e){',
  '    if(e.key==="ArrowDown"){e.preventDefault();open(t);var a=pan(t).querySelector("a");if(a)a.focus()}',
  '    else if(e.key==="Escape"){shut(t)}});',
  '  var p=pan(t);if(!p)return;',
  '  p.addEventListener("keydown",function(e){',
  '    var L=[].slice.call(p.querySelectorAll("a")),i=L.indexOf(document.activeElement);',
  '    if(e.key==="Escape"){e.preventDefault();shut(t);t.focus()}',
  '    else if(e.key==="ArrowDown"&&i>-1){e.preventDefault();L[(i+1)%L.length].focus()}',
  '    else if(e.key==="ArrowUp"&&i>-1){e.preventDefault();L[(i-1+L.length)%L.length].focus()}})});',
  'document.addEventListener("click",function(e){if(!nav.contains(e.target))shutAll()});',
  'nav.addEventListener("focusout",function(e){if(!nav.contains(e.relatedTarget))shutAll()});',
  '})();</script>',
  JS_Z
].join('\n');

/* ── הפצה לכל העמודים ───────────────────────────────────────────── */
function pages() {
  var out = [];
  (function walk(dir, rel) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (e.name !== 'api') walk(p, r); }
      else if (/\.html$/.test(e.name)) out.push(r);
    });
  })(PROTO, '');
  return out;
}

/* קישור מת בניווט הוא קישור מת ב-59 עמודים בבת אחת, ולכן זה נבדק לפני
 * שנכתב ולו קובץ אחד. בדיקה 24 בפריפלייט תופסת את זה גם כן, אבל אחרי המעשה. */
function validateTargets() {
  var dead = [];
  structure().forEach(function (n) {
    var all = n.type === 'link' ? [n] : n.cols.reduce(function (acc, c) {
      return acc.concat(c.items);
    }, []).concat(n.all);
    all.forEach(function (it) {
      if (it.href.charAt(0) === '/' && it.href.indexOf('#') < 0) {
        var p = path.join(PROTO, it.href.replace(/^\//, ''), 'index.html');
        var q = path.join(PROTO, it.href.replace(/^\//, ''));
        if (!fs.existsSync(p) && !fs.existsSync(q)) dead.push(it.href + '  (' + it.label + ')');
      }
    });
  });
  if (dead.length) fail('יעדים שאינם קיימים:\n  ' + dead.join('\n  '));
  return true;
}
validateTargets();

var NAV_RE = /<nav class="main"[\s\S]*?<\/nav>/;

function esc4re(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
var CSS_BLOCK_RE = new RegExp(esc4re(CSS_A) + '[\\s\\S]*?' + esc4re(CSS_Z));
var JS_BLOCK_RE = new RegExp(esc4re(JS_A) + '[\\s\\S]*?' + esc4re(JS_Z));

/* מחליף בלוק קיים אם יש, ואחרת מוסיף לפני העוגן. הפרדה בין השניים היא מה
 * שהופך את המחולל לבר-הרצה חוזרת: שינוי ב-CSS כאן מגיע ל-57 העמודים בהרצה
 * הבאה, במקום להידלג עליהם כי "כבר קיים". */
function put(h, blockRe, block, anchor, rel, what) {
  if (blockRe.test(h)) return { h: h.replace(blockRe, function () { return block; }), added: 0 };
  var at = h.lastIndexOf(anchor);
  if (at < 0) fail(rel + ' — אין ' + anchor + ' להוסיף אליו את ה-' + what);
  var pre = h.slice(0, at);
  var eol = /\r\n[ \t]*$/.test(pre) ? '\r\n' : '\n';
  var ind = (pre.match(/(?:\r?\n)([ \t]*)$/) || ['', ''])[1];
  return { h: h.slice(0, at) + block.split('\n').join(eol) + eol + ind + h.slice(at), added: 1 };
}

var stats = { nav: 0, css: 0, js: 0, skipped: [] };

pages().forEach(function (rel) {
  var f = path.join(PROTO, rel);
  var h = fs.readFileSync(f, 'utf8');
  if (!NAV_RE.test(h)) { stats.skipped.push(rel); return; }

  var selfHref = '/' + rel.replace(/index\.html$/, '');
  h = h.replace(NAV_RE, function () { return buildNav(selfHref); });
  stats.nav++;

  var r1 = put(h, CSS_BLOCK_RE, CSS, '</style>', rel, 'CSS'); h = r1.h; stats.css += r1.added;
  var r2 = put(h, JS_BLOCK_RE, JS, '</body>', rel, 'JS'); h = r2.h; stats.js += r2.added;

  fs.writeFileSync(f, Buffer.from(h, 'utf8'));
});

var s = structure();
var links = 0;
s.forEach(function (n) {
  if (n.type === 'link') { links++; return; }
  n.cols.forEach(function (c) { links += c.items.length; });
  links += n.all.length;
});

console.log('✓ הניווט נכתב ל-' + stats.nav + ' עמודים');
console.log('  ' + s.filter(function (n) { return n.type === 'drop'; }).length + ' תפריטים נפתחים, ' +
  s.filter(function (n) { return n.type === 'link'; }).length + ' קישורים ישירים, ' + links + ' יעדים בסך הכול');
console.log('  CSS נוסף ל-' + stats.css + ' עמודים, JS ל-' + stats.js);
if (stats.skipped.length) console.log('  דילג (אין nav.main): ' + stats.skipped.join(', '));
console.log('\nהרצה: node .claude/preflight.js');
