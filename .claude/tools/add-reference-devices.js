#!/usr/bin/env node
/* PHONE GAT — הזנת **מכשירי ייחוס** לקטלוג.
 *
 *   node .claude/tools/add-reference-devices.js <קובץ-נתונים.json>
 *   node .claude/tools/add-reference-devices.js <קובץ> --dry
 *
 * מכשיר ייחוס הוא דגם שפון גת **אינה מוכרת**, והוא במאגר אך ורק כדי שאפשר יהיה להשוות
 * אליו. הוא אינו מקבל עמוד מכשיר, אינו ב-/phones/, ואינו נדרש ב-DEVICE_ORDER. ראו
 * CLAUDE.md, "מכשיר ייחוס: דגם שאיננו מוכרים".
 *
 * **למה כלי ולא עריכה ידנית.** רשומה אחת היא 29 שדות מפרט, ציטוט מקור לכל שדה, ועוד
 * שישה בלוקים. הזנה ביד של 26 דגמים מבטיחה שרשומה אחת תצא עם commercial לא מאופס, וזה
 * בדיוק המקרה שבו האתר יאמר ללקוח שאנחנו מוכרים משהו שאיננו מוכרים. הכלי אוכף את הצורה.
 *
 * **מה הוא מסרב לעשות:**
 *   · להוסיף slug שכבר קיים
 *   · לקבל ערך מפרט בלי ציטוט מקור, או null בלי הערה שמסבירה למה
 *   · לקבל שדה מפרט שאינו ברשימת 29 השדות של הסכמה, או להשמיט אחד מהם
 *   · לקבל what_matters שאינו נפתח בגילוי הנאות
 * כל אחד מהם היה עובר בשקט בעריכה ידנית.
 */
'use strict';
var fs = require('fs'), path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var DEVICES = path.join(ROOT, 'prototype', 'devices.json');

var args = process.argv.slice(2);
var DRY = args.indexOf('--dry') >= 0;
var dataFile = args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
if (!dataFile) { console.error('שימוש: node add-reference-devices.js <קובץ-נתונים.json> [--dry]'); process.exit(1); }

/* 29 שדות המפרט, בסדר שבו הם מופיעים בקטלוג. חייבים להיות כולם, גם כ-null. */
var SPEC_FIELDS = ['screen_size', 'screen_type', 'resolution', 'refresh_rate', 'brightness',
  'chip', 'cpu', 'gpu', 'ram', 'storage_offered', 'storage_expandable', 'camera_main',
  'camera_extra', 'zoom', 'camera_front', 'video', 'battery', 'charging_wired',
  'charging_wireless', 'dimensions', 'weight', 'water_resistance', 'colors_manufacturer',
  'sim', 'esim', 'connectivity', 'box_contents', 'security_updates', 'model_numbers'];

/* הגילוי הנאות. אותה בדיקה שהרתמה עושה על התשובות, אבל על המקור. */
var DISCLOSURE = /לא מוכרים/;

var raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
var incoming = Array.isArray(raw) ? raw : raw.devices;
if (!Array.isArray(incoming)) { console.error('קובץ הנתונים צריך להיות מערך, או אובייקט עם devices'); process.exit(1); }

var catalog = JSON.parse(fs.readFileSync(DEVICES, 'utf8'));
var isArr = Array.isArray(catalog);
var list = isArr ? catalog : (catalog.devices || null);
if (!list) { console.error('לא זוהה מערך הדגמים ב-devices.json'); process.exit(1); }

var existing = {};
list.forEach(function (d) { existing[d.slug] = true; });

var errors = [], added = [];

incoming.forEach(function (d, ix) {
  var where = 'רשומה ' + (ix + 1) + (d.slug ? ' (' + d.slug + ')' : '');
  function err(m) { errors.push(where + ': ' + m); }

  ['slug', 'brand', 'name', 'name_he', 'series', 'os'].forEach(function (k) {
    if (!d[k]) err('חסר ' + k);
  });
  if (d.slug && existing[d.slug]) err('ה-slug כבר קיים בקטלוג');
  if (!d.spec) { err('חסר spec'); return; }
  if (!d.spec_source) { err('חסר spec_source'); return; }

  var got = Object.keys(d.spec), unknown = got.filter(function (k) { return SPEC_FIELDS.indexOf(k) < 0; });
  var missing = SPEC_FIELDS.filter(function (k) { return got.indexOf(k) < 0; });
  if (unknown.length) err('שדות שאינם בסכמה: ' + unknown.join(', '));
  if (missing.length) err('שדות חסרים: ' + missing.join(', '));

  /* **הכלל המרכזי: אין ערך בלי מקור, ואין חוסר בלי הסבר.** */
  SPEC_FIELDS.forEach(function (k) {
    var v = d.spec[k];
    var empty = v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
    var s = d.spec_source[k] || d.spec_source['default'];
    if (!empty) {
      if (!s || !s.src) err('לשדה ' + k + ' יש ערך ואין src במקור');
      else if (!s.at) err('לשדה ' + k + ' יש מקור בלי תאריך קריאה');
    } else {
      var own = d.spec_source[k];
      if (!own || !own.note) err('השדה ' + k + ' ריק ואין הערה שמסבירה למה');
    }
  });

  var ed = d.editorial || {};
  if (!ed.what_matters) err('חסר editorial.what_matters');
  else if (!DISCLOSURE.test(ed.what_matters)) {
    err('what_matters אינו נושא את הגילוי הנאות. מכשיר ייחוס חייב לומר במפורש שאיננו מוכרים אותו');
  }
  if (/—/.test(JSON.stringify(d))) err('יש מקף ארוך ברשומה. אסור בכל טקסט שהקורא רואה');

  if (errors.length) return;

  added.push({
    slug: d.slug,
    status: 'reference',
    brand: d.brand,
    name: d.name,
    name_he: d.name_he,
    series: d.series,
    os: d.os,
    launch_year: d.launch_year === undefined ? null : d.launch_year,
    spec_source: d.spec_source,
    spec: (function () { var o = {}; SPEC_FIELDS.forEach(function (k) { o[k] = d.spec[k]; }); return o; })(),
    /* **הכול null חוץ מ"לא נמכר אצלנו".** זו הצורה שמונעת מהאתר ומהבוט להציע אותו
       למכירה, לתת לו אחריות, או לנקוב במחיר. אין דרך לעקוף אותה מקובץ הנתונים. */
    commercial: {
      price: null, stock: 'לא נמכר אצלנו', storage_stocked: null, colors_stocked: null,
      import_official: null, import_parallel: null, importer_name: null,
      warranty_by: null, warranty_months: null, service_terms: null,
      payments: null, data_transfer: null
    },
    editorial: {
      what_matters: ed.what_matters,
      good_for: [], less_for: [], daily_benefits: [],
      pros: Array.isArray(ed.pros) ? ed.pros : [],
      cons: Array.isArray(ed.cons) ? ed.cons : [],
      similar: Array.isArray(ed.similar) ? ed.similar : [],
      comparisons: Array.isArray(ed.comparisons) ? ed.comparisons : []
    },
    /* המלצה היא של ברוך וסיגל, ולא של מי שמזין נתונים. דגם שאיננו מוכרים לא מקבל אחת. */
    recommendation: { sigal: { text: null, status: 'missing' }, baruch: { text: null, status: 'missing' } },
    seo: { keywords: [], title: null, description: null, canonical: null, schema: [] },
    media: { hero: null, gallery: [], alt: d.name }
  });
});

if (errors.length) {
  console.error('✗ ' + errors.length + ' בעיות, לא נכתב כלום:');
  errors.slice(0, 25).forEach(function (e) { console.error('   ' + e); });
  if (errors.length > 25) console.error('   ועוד ' + (errors.length - 25));
  process.exit(1);
}

var sourced = 0, total = 0;
added.forEach(function (d) {
  SPEC_FIELDS.forEach(function (k) {
    total++;
    var v = d.spec[k];
    if (!(v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length))) sourced++;
  });
});

console.log('✓ ' + added.length + ' מכשירי ייחוס תקינים');
console.log('  שדות מפרט מלאים: ' + sourced + ' מתוך ' + total +
  ' (' + Math.round(sourced / total * 100) + '%), והשאר ריקים עם הערה');
console.log('  ' + added.map(function (d) { return d.slug; }).join(', '));

if (DRY) { console.log('\n--dry, לא נכתב לקטלוג'); process.exit(0); }

added.forEach(function (d) { list.push(d); });
fs.writeFileSync(DEVICES, JSON.stringify(isArr ? list : catalog, null, 1) + '\n');
console.log('\n✓ נכתבו לקטלוג. סדר ההרצה מכאן:');
console.log('  gen-devices → gen-compare → add-deals → gen-nav → gen-bot-content → gen-bot → preflight');
