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

var BIDI = require(path.join(__dirname, 'lib', 'bidi.js'));
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

/* .hub נולד ב-guides/index.html, ונשלף משם בזמן החילול במקום להיכתב כאן שוב.
 * זה אותו דפוס שכבר קיים ב-gen-compare וב-gen-finder, והוא התשובה לכשל שחזר בפרויקט
 * חמש פעמים: רכיב שמועתק לעמוד חדש בלי הכלל שלו נראה שבור בלי להיכשל בשום דבר. */
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

/* תמונת המכשיר, או הפלייסהולדר כשאין עדיין תמונה. שני מצבים ולא אחד, כי מכשיר נכנס
 * למאגר לפני שיש לו צילום, ועמוד עם ריבוע ריק עדיף על עמוד עם קישור לתמונה שאיננה.
 *
 * המידות נכתבות במפורש כדי שהדפדפן ישריין את המקום לפני שהקובץ ירד. בלעדיהן הטבלה
 * שמתחת קופצת כשהתמונה נוחתת, וזה בדיוק ה-CLS שגוגל מודד.
 *
 * sizes נמדד ולא נוסח בקירוב, כי טעות בו לא נראית בעין אלא רק בתמונה מטושטשת או בבייטים
 * מיותרים. העמודה היא .85fr מתוך 2fr, בתוך wrap של --maxw:1400 עם padding 28 וgap 54,
 * כלומר 548 פיקסל כשה-wrap רווי. מתחת ל-900 הפריסה נשברת לעמודה אחת והתמונה מוגבלת ל-280.
 * 41vw באמצע הוא הערכת יתר קטנה ומכוונת לכל רוחב בטווח: עדיף להוריד מעט יותר מדי מאשר
 * למתוח קובץ קטן. ההערכה הראשונה כאן אמרה 445, והתמונה נמתחה מ-480 ל-548 בשולחני. */
function heroImg(d) {
  var m = d.media || {};
  if (!m.hero) {
    return '      <div class="ph"><svg viewBox="0 0 200 200" aria-hidden="true"><g transform="translate(100 100)"><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#1878A8"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#e0913f" transform="rotate(90)"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#63a244" transform="rotate(180)"/><path d="M0 0 L0 -94 C36 -90 64 -60 68 -18 Z" fill="#7D3169" transform="rotate(270)"/></g></svg><span>' + esc(PH.images) + '</span></div>\n';
  }
  if (!fs.existsSync(path.join(PROTO, m.hero.replace(/^\//, '')))) {
    console.error('✗ ' + d.slug + ': media.hero מצביע על ' + m.hero + ', והקובץ אינו קיים.');
    process.exit(1);
  }
  /* .devimg ולא .fig img סתם: הכלל המשותף למובייל יושב בהמשך הגיליון ומנצח באותה ספציפיות.
   * הכיתה מרימה את הספציפיות ומנתקת את התמונה הזאת מהתלות בסדר ההזרקה. */
  return '      <img class="devimg" src="' + esc(m.hero) + '"' +
    (m.srcset ? ' srcset="' + esc(m.srcset) + '"' +
      ' sizes="(max-width:900px) 280px, (max-width:1400px) 41vw, 548px"' : '') +
    ' width="' + (m.width || 960) + '" height="' + (m.height || 1280) + '"' +
    ' alt="' + esc(m.alt || d.name) + '" loading="lazy" decoding="async">\n';
}

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
      /* ltrRuns ולא esc: ערך מפרט מערבב עברית ולטינית, ואלגוריתם ה-bidi סידר מחדש
       * את המספרים. "50MP, 12MP" הוצג "12MP 50MP", כלומר הראשית נראתה 12MP. */
      return '          <tr><th scope="row">' + esc(p[1]) + '</th><td>' + BIDI.ltrRuns(v) + '</td></tr>';
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
    ['תשלומים', C.payments, 'לבדיקת פריסת תשלומים'],
    /* שתי השורות האלה נוספו ב-10.8.2026. הן היו במאגר ולא הוצגו, וזה בזבוז:
       טלפון חלופי בזמן תיקון והעברת נתונים ממכשיר שבור הם בדיוק הדברים שאף
       אתר מתחרה לא כותב, ולכן הם שווים יותר מכל שורת מפרט. */
    ['בזמן תיקון באחריות', C.service_terms, 'לשאול מה קורה עם מכשיר חלופי'],
    ['העברת נתונים', C.data_transfer, 'לשאול על העברת נתונים מהמכשיר הישן']
  ].map(function (f) {
    var real = f[1] !== null && f[1] !== undefined && f[1] !== '';
    return '        <tr><th scope="row">' + esc(f[0]) + '</th><td>' +
      (real ? BIDI.ltrRuns(f[1]) : '<em>' + esc(f[2]) + '</em>') + '</td></tr>';
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

  /* --- עובדות מסחריות + תמונת המכשיר --- */
  '<section class="prob" id="buy" style="--nc:var(--teal)" aria-labelledby="h-buy">\n' +
  '  <div class="wrap row">\n' +
  '    <figure class="fig">\n' +
  heroImg(d) +
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
  '        <p>מה ההבדל בין יבוא רשמי למקביל: <a href="/guides/official-vs-parallel-import/">המדריך המלא</a>. ומה האחריות מכסה ומה לא: <a href="/guides/phone-warranty-israel/">מדריך האחריות</a>.</p>\n' +
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

  /* --- ההשוואות שהדגם הזה משתתף בהן ---
   *
   * שמונת עמודי ההשוואה היו מקושרים ממקום אחד בלבד, מרכז ההשוואות, ובדיקה 26 תפסה את זה.
   * עמוד מכשיר שאינו מקשר להשוואה שהוא עצמו צד בה הוא גם קישור חסר וגם שירות חסר לקורא:
   * מי שקורא על דגם מסוים הוא בדיוק מי שרוצה לדעת במה הוא שונה מהשכן שלו. */
  var pairs = ((db._comparisons || {}).pairs || []).filter(function (p) {
    return p.a === d.slug || p.b === d.slug;
  });
  if (pairs.length) {
    var bySlug = function (s) { return db.devices.filter(function (x) { return x.slug === s; })[0]; };
    var other = function (p) { return bySlug(p.a === d.slug ? p.b : p.a); };
    out += '<section class="block" id="vs" aria-labelledby="h-vs">\n' +
    '  <div class="wrap box">\n' +
    '    <h2 id="h-vs">מול מה שווה להשוות אותו</h2>\n' +
    '    <ul class="hub">\n' +
    pairs.map(function (p) {
      var o = other(p);
      return '      <li><a href="/compare/' + esc(p.slug) + '/"><b>' + ltr(d.name) + ' מול ' + ltr(o ? o.name : '') +
             '</b><span>' + esc(p.lede ? p.lede.split('.')[0] + '.' : 'טבלה מלאה של ההבדלים, מתוך המפרט שהיצרנים מפרסמים.') + '</span></a></li>';
    }).join('\n') + '\n' +
    '    </ul>\n' +
    /* הכלי עם הדגם כבר בפנים. ?d= נתמך בכלי, והוא נפתח עם התא הראשון מלא ואומר "בחרו עוד
       אחד לפחות". זה חוסך לקורא לבחור מחדש את המכשיר שהוא כבר קורא עליו, וזה גם רגע
       ההתלבטות עצמו: מי שהגיע עד לכאן כבר יודע מה מעניין אותו ומתלבט מול מה.
       כפתור ולא הערת שוליים, כי כהערה זה היה כאן כל הזמן ואיש לא הגיע לכלי דרכו. */
    '    <p class="vscta"><a class="btn btn-teal" href="/phones/compare/?d=' + esc(d.slug) + '">' +
    'להשוות את ' + ltr(d.name) + ' לדגם אחר</a></p>\n' +
    '    <p class="aside">הכלי מחזיק ' + db.devices.filter(function (x) { return x.status !== 'draft'; }).length +
    ' דגמים, ואפשר להשוות שלושה יחד. <a href="/phones/find-my-phone/">השאלון</a> מציע דגמים לפי מה שחשוב לכם.</p>\n' +
    '  </div>\n</section>\n\n';
  }

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
   *
   * מ-6.8.2026 התנאי הזה לא ייתקיים לעולם, וזו החלטה ולא חוסר: אין מחירון באתר, כי המחיר
   * משתנה כל הזמן. Offer דורש price, וגם AggregateOffer דורש lowPrice.
   * הבלוק נשאר כאן ולא נמחק, כי אם ההחלטה תשתנה זה מה שצריך לעבוד.
   *
   * ⚠ מה שנכתב כאן קודם היה "Product בלי offers חוקי לגמרי, פשוט לא זכאי לתוצאות עשירות".
   * החצי הראשון נכון: schema.org לא דורש offers. החצי השני לא: גוגל מגדירה את שלושת
   * offers, review ו-aggregateRating כנדרשים, ולכן היא לא מתעלמת מהבלוק אלא מדווחת עליו
   * כשגיאה קריטית. ב-13.8.2026 הגיע מייל Search Console על 21 עמודי המכשיר, כלומר כולם.
   * לכן הישות נפלטת רק כשהיא יכולה להיות תקינה. אין מה לאבד: Product בלי מחיר ובלי דירוג
   * לא יכול לזכות בתוספת בשום מצב, והמידע עצמו מוצג בעמוד ובטבלת המפרט.
   *
   * ולא לפתור את זה ב-aggregateRating. אין ביקורות מוצר לדגמים האלה, ולכן זה יהיה סימון
   * ביקורות מומצא, הפרת מדיניות שגוררת ענישה ידנית. */
  var sellable = !!(C.price && C.stock);
  if (sellable) {
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
  return sellable ? [product, crumbs] : [crumbs];
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
  /* מכשיר ייחוס אינו מקבל עמוד. הוא קיים במאגר רק כדי להשוות אליו, ועמוד
     משלו היה אומר ללקוח שאנחנו מוכרים אותו. */
  if (d.status === 'reference' && !only) { skipped.push(d.slug + ' (ייחוס, לא נמכר)'); return; }
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
    /* nowrap הוא ברירת המחדל של .btn במסגרת המשותפת, והוא גולש 86px בהגדלת טקסט ל-200%.
       מוגבל ל-main בכוונה, כדי שה-CTA בהדר והסרגל התחתון לא ישנו צורה. */
    'main .btn{white-space:normal}\n' +
    /* מקטע "מול מה שווה להשוות" משתמש ב-.hub, והכלל שלו נולד ב-guides/index.html.
       בדיקה 21 תפסה את זה בהרצה הראשונה: 11 עמודי מכשיר עם הרכיב ובלי ה-CSS שלו. */
    hubCss() + '\n' +
    /* הכפתור לכלי ההשוואה, מתחת לרשימת ההשוואות המוכנות. הטקסט נושא את שם הדגם ולכן הוא
       ארוך, ובמסך צר הוא חייב לשבור לשתי שורות במקום לגלוש: white-space:normal, כמו
       ב-.btn-hero שכבר קיים כאן מאותה סיבה בדיוק. */
    '.vscta{margin:1.6rem 0 0}\n' +
    /* ה-padding נושא את הגובה ולא min-height, כמו ב-.dstate .btn-sm: גובה מוצהר נאכל על ידי
       המסגרת ותיבת השורה ויוצא נמוך מהמוצהר. נמדד 40px עם ברירת המחדל, וזה מתחת ל-44. */
    '.vscta .btn{white-space:normal;text-align:center;line-height:1.4;padding-block:.7rem}\n' +
    '.btn-hero{white-space:normal;text-align:center}\n' +
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
    '.ghero .btn-hero{white-space:normal;text-align:center}\n' +
    /* תמונות המכשירים נוצרות ב-3:4 מדויק על ידי gen-device-photos.js, ולכן הכלל המשותף
       .fig img (3:4, cover) מתאים להן בשולחני בלי לחתוך פיקסל. מסגרת שיער כמו שיש
       לפלייסהולדר, כי רקע התמונה כמעט לבן והיא הייתה מרחפת בלי גבול על רקע הדף. */
    '.fig img.devimg{border:1px solid var(--line);background:#fff}\n' +
    /* במובייל הכלל המשותף חותך את התמונה ל-4:3. במדריך תיקון זה נכון, כי שם התמונה ממחישה
       שלב וכל גובה מיותר דוחף את ההוראות מתחת לקיפול. בעמוד מכשיר התמונה היא המוצר עצמו,
       וחיתוך ל-4:3 מוריד ממנה את בליטת המצלמה למעלה ואת תחתית המכשיר. לכן היא נשארת 3:4
       ומוגבלת ברוחב במקום להיחתך: 280px נותנים 373px גובה במקום ה-468 שהכלל המשותף חשש מהם. */
    '@media(max-width:900px){.fig img.devimg{aspect-ratio:3/4;object-fit:contain;max-width:280px;margin-inline:auto}}');

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
    var live = db.devices.filter(function (x) { return x.status !== 'draft' && x.status !== 'reference'; }).sort(hubOrder);
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

/* ============================================ devices-public.json
 *
 * שורה 2 ב-devices.json מצהירה שהוא "הצד הפרטי", ושקובץ ציבורי נגזר ממנו ומכיל רק את מה
 * שכבר מוצג בעמוד. הקובץ הציבורי הזה **לא נבנה מעולם**, וזו הייתה משימה D0.5 בתוכנית.
 * בינתיים נבנה כלי ההשוואה, והוא שולף /devices.json בזמן ריצה. כלומר בקשת GET אחת ללא
 * אימות מחזירה את _rules (החלטות עסקיות עם תאריכים), את _candidates_findings (מחקר
 * מתחרים ושאלות פתוחות), את spec_source (מתודולוגיית אימות), את commercial (סכימה
 * שנועדה להכיל מחירים ושמות יבואנים), ואת recommendation (ציטוטים של ברוך וסיגל לפני
 * אישור פרסום). כרגע השדות המסחריים והציטוטים ריקים, ולכן אין דלף בפועל, אבל הגידור
 * של "רק approved נכנס" חי במחולל ה-HTML ולא בקובץ ה-JSON.
 *
 * מה שנכנס לקובץ הציבורי: בדיוק ארבעת השדות שהכלי קורא בזמן ריצה, ולא יותר.
 * נמדד מהקוד עצמו: DB.devices, d.slug, d.name, d.name_he, d.spec[key]. */
(function buildPublic() {
  var pub = {
    _: 'נגזר אוטומטית מ-devices.json על ידי gen-devices.js. אל תערוך. מכיל רק את השדות שכלי ההשוואה קורא בזמן ריצה, וכולם מוצגים בעמודי המכשיר בכל מקרה.',
    /* מכשיר ייחוס כן נכנס לקובץ הציבורי מאז 15.8.2026, בהחלטת בעלים. עד אז הוא הוחרג
       בנימוק שהכלי הוא "השווה בין מה שאנחנו מוכרים", וההשוואה החוצה-מותגית חיה בעמודי
       ההשוואה הכתובים. מה ששינה את ההחלטה: לקוח שמתלבט מול פיקסל או OnePlus משווה אותם
       ממילא, והשאלה היחידה היא אם הוא עושה את זה אצלנו או באתר אחר.
       own:false נוסע איתו, כי בלעדיו הכלי לא יכול לדעת שהוא חייב גילוי נאות ושאסור לו
       לקשר לעמוד מכשיר שלא קיים. זה השדה החמישי, והוא לא נתון עסקי אלא סימון תצוגה. */
    devices: db.devices.filter(function (d) { return d.status !== 'draft'; }).map(function (d) {
      var o = { slug: d.slug, name: d.name, name_he: d.name_he || d.name, brand: d.brand, spec: d.spec };
      if (d.status === 'reference') o.own = false;
      /* img הוא דגל ולא נתיב, והוא השדה השישי. הכלי בונה את הכתובת מה-slug בעצמו, ולכן
         נתיב כאן היה עותק שני של אותה נוסחה שנפרד ממנה בשקט ברגע שמידה משתנה.
         הדגל כן נחוץ: בלעדיו הכלי מניח שלכל דגם יש תמונה, ודגם חדש שנכנס למאגר לפני
         שצולם היה מציג סמל תמונה שבורה. media עצמו לא נכנס לכאן, והחגורה למטה אוכפת. */
      if (d.media && d.media.hero) o.img = 1;
      return o;
    })
  };
  var out = path.join(PROTO, 'devices-public.json');
  fs.writeFileSync(out, JSON.stringify(pub, null, 2) + '\n');

  /* חגורה: אם שדה פרטי ימצא את דרכו לקובץ הציבורי, זה ייפול כאן ולא יישלח לרשת. */
  var leaked = ['_rules', '_candidates', '_candidates_findings', 'spec_source',
                'recommendation', 'commercial', 'editorial', 'seo', 'media', '_comparisons']
    .filter(function (k) { return JSON.stringify(pub).indexOf('"' + k + '"') >= 0; });
  if (leaked.length) {
    console.error('✗ devices-public.json מכיל שדות פרטיים: ' + leaked.join(', '));
    process.exit(1);
  }
  console.log('✓ devices-public.json: ' + pub.devices.length + ' מכשירים (' + pub.devices.filter(function(d){return d.own===false;}).length + ' ייחוס), אפס שדות פרטיים');
})();

/* ============================================ bot-facts.json
 *
 * הקובץ שהעוזר בצ'אט קורא כשהפאנל נפתח. **קובץ נפרד ולא הרחבה של devices-public.json**,
 * משתי סיבות: לזה יש חוזה מתועד ("בדיוק ארבעת השדות שכלי ההשוואה קורא בזמן ריצה") והוא
 * מוציא מכשירי ייחוס בכוונה, והבוט צריך אותם דווקא בשביל הגילוי הנאות.
 *
 * המפתחות כאן **שטוחים**, כלומר המחרוזות "commercial" ו-"editorial" אינן מופיעות בקובץ.
 * זה לא נוי: שער הדלף של buildPublic חוסם את שתיהן לפי שם, ולכן דחיפת שדות מסחריים לתוך
 * הקובץ הציבורי הקיים הייתה מחייבת לרופף שער שכל תפקידו למנוע דלף מחירים. שיטוח פותר את
 * זה בבנייה במקום בהחרגה.
 *
 * מה שלא נכנס, ולמה:
 *   price, colors_stocked   אין מחירון באתר, החלטת בעלים נעולה. ריקים ב-24 מ-24 בכל מקרה.
 *   stock, storage_stocked  מלאים ב-12 ו-2 מ-24. בוט שעונה "יש במלאי" מנתון חלקי גרוע
 *                           מבוט שמנתב לאדם, כי טעות כאן היא הבטחה בשם המותג.
 *   importer_name           מלא ב-1 מ-24.
 *   recommendation          48 מ-48 ב-missing. ציטוט אישי מוצג רק ב-approved בדיוק. */
(function buildBotFacts() {
  var FORBIDDEN = ['price', 'colors_stocked', 'stock', 'storage_stocked',
                   'importer_name', 'recommendation', 'commercial', 'editorial'];
  var facts = {
    _: 'נגזר אוטומטית מ-devices.json על ידי gen-devices.js. אל תערוך.',
    devices: db.devices.filter(function (d) { return d.status !== 'draft'; }).map(function (d) {
      var c = d.commercial || {}, e = d.editorial || {};
      var ref = d.status === 'reference';
      return {
        slug: d.slug,
        name: d.name,
        name_he: d.name_he || d.name,
        brand: d.brand,
        kind: ref ? 'reference' : 'sold',
        /* מכשיר ייחוס אינו נמכר, ולכן אין לו תנאי אחריות ותשלום. null כאן הוא הערך הנכון
           ולא נתון חסר, והבוט מסתעף על kind לפני שהוא נוגע בשדות האלה. */
        warranty_by: ref ? null : (c.warranty_by || null),
        warranty_months: ref ? null : (typeof c.warranty_months === 'number' ? c.warranty_months : null),
        service_terms: ref ? null : (c.service_terms || null),
        payments: ref ? null : (c.payments || null),
        data_transfer: ref ? null : (c.data_transfer || null),
        /* מערכי משפטים שנכתבו ביד. הבוט מצטט מהם מילה במילה ולא מנסח מחדש, וזה מה
           שמקיים את קריטריון הקבלה "אין מספר שאינו מופיע כטקסט בשדה המקורי". */
        good_for: Array.isArray(e.good_for) ? e.good_for : [],
        less_for: Array.isArray(e.less_for) ? e.less_for : [],
        spec: d.spec || {}
      };
    }),
    /* רשימת עמודי ההשוואה נגזרת מהדיסק ולא מ-editorial.comparisons, שריק ב-24 מ-24.
       כך הבוט מקשר רק לעמוד שבאמת קיים, ולא מייצר 404 בשיחה. */
    comparePages: (function () {
      try {
        return fs.readdirSync(path.join(PROTO, 'compare')).filter(function (n) {
          return n.indexOf('-vs-') > 0 && fs.existsSync(path.join(PROTO, 'compare', n, 'index.html'));
        }).sort();
      } catch (e) { return []; }
    })()
  };
  var out = path.join(PROTO, 'bot-facts.json');
  fs.writeFileSync(out, JSON.stringify(facts, null, 2) + '\n');

  var leaked = FORBIDDEN.filter(function (k) {
    return JSON.stringify(facts).indexOf('"' + k + '"') >= 0;
  });
  if (leaked.length) {
    console.error('✗ bot-facts.json מכיל שדה אסור: ' + leaked.join(', ') +
      ' — הבוט לא יקבל נתון שאסור לו לנקוב בו');
    process.exit(1);
  }
  var refs = facts.devices.filter(function (d) { return d.kind === 'reference'; }).length;
  console.log('✓ bot-facts.json: ' + facts.devices.length + ' מכשירים (' + refs +
    ' ייחוס), אפס שדות אסורים');
})();

console.log('\n' + made + ' עמודי מכשיר נוצרו. הרצה: node .claude/preflight.js');
