#!/usr/bin/env node
/* PHONE GAT — רתמה לשכבת התשובות של הבוט.
 *
 *   node .claude/tools/bot-harness.js
 *
 * צ'אט אינו נסרק סטטית, ולכן אין דרך להוכיח בקוד שהוא עונה נכון. הרתמה הזאת פותרת את זה
 * בלי דפדפן ובלי תלויות: היא מחלצת את האזור bot:facts:start עד bot:answers:end מתוך
 * index.html, מריצה אותו ב-vm עם דמויות (stubs) במקום ה-DOM, וקוראת לפונקציות בניית
 * התשובה ישירות. כך אפשר לעבור על **כל 24 הדגמים כפול כל השדות** ולא על מדגם.
 *
 * מה שנבדק, לפי קריטריוני הקבלה:
 *   1. אין מחיר בשום תשובה, בשום נתיב.
 *   2. אין מספר בתשובה שאינו מופיע בשדה המקורי, בשם הדגם או ב-warranty_months.
 *   3. דגם ייחוס נושא גילוי נאות **בכל** תשובה, ולא רק בראשונה.
 *   4. אין מקף ארוך בשום תשובה (בדיקה 13 בפריפלייט אוכפת את זה בקבצים, לא בזמן ריצה).
 *   5. זיהוי דגם אינו מנחש: מספר עירום ושם שאינו בקטלוג נופלים ולא מתאימים דגם קרוב.
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
/* ארגומנט אופציונלי = שורש חלופי, כמו ב-preflight.js, כדי שאפשר יהיה לנסות את הרתמה
   עצמה על עותק שבור. בלעדיו היא הייתה קוראת תמיד את העץ האמיתי, והשער לא היה בר-כשל. */
var ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '..');
var html = fs.readFileSync(path.join(ROOT, 'prototype', 'index.html'), 'utf8');
var facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prototype', 'bot-facts.json'), 'utf8'));

/* ---------- חילוץ האזור ---------- */
var a = html.indexOf('/* bot:facts:start');
var b = html.indexOf('/* bot:answers:end');
if (a < 0 || b < 0) { console.error('✗ סימני האזור לא נמצאו ב-index.html'); process.exit(1); }
var code = html.slice(a, b) + '\n';

/* ---------- דמויות ---------- */
var replies = [], tracked = [];
var sandbox = {
  /* נלכד ולא מוצג */
  botReply: function (text, opts) { replies.push({ text: text, opts: opts || {} }); },
  bubble: function () {}, down: function () {}, focusInput: function () {},
  track: function (ev, d) { tracked.push({ event: ev, data: d || {} }); },
  contactCta: function () { return []; },
  startLead: function () {}, startBuy: function () {}, runIntent: function () {},
  matchIntent: function () { return null; }, fallback: function () {},
  ctx: {}, flow: null, fails: 0, lastUser: '',
  msgs: { appendChild: function () {} },
  panel: { classList: { add: function () {}, remove: function () {} } },
  document: { createElement: function () { return { classList: {}, style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} }; } },
  location: { href: '' },
  setTimeout: function () {}, fetch: function () { throw new Error('no fetch in harness'); },
  console: console
};
sandbox.window = sandbox;
var ctxv = vm.createContext(sandbox);
try { new vm.Script(code, { filename: 'index.html:bot-region' }).runInContext(ctxv); }
catch (e) { console.error('✗ האזור לא נטען: ' + e.message); process.exit(1); }
sandbox.FACTS = facts;   /* במקום loadFacts, שנשען על fetch */

var fieldAnswer = sandbox.fieldAnswer, findDevices = sandbox.findDevices,
    findField = sandbox.findField, refNote = sandbox.refNote, DEV_FIELDS = sandbox.DEV_FIELDS;
if (!fieldAnswer || !findDevices || !findField) {
  console.error('✗ לא נמצאו הפונקציות. שם השתנה?'); process.exit(1);
}

/* ---------- כלים ---------- */
/* גבול עברי ולא \b: ב-JS ה-\b הוא ASCII, ולכן "שקל" נתפס בתוך "משקל" ובתוך "שוקל".
   זו הייתה תפיסת שווא בחמישה דגמים בהרצה הראשונה. */
var HE = '\\u0590-\\u05FF';
var PRICE = new RegExp('₪|\\bNIS\\b|(?<![' + HE + '])(שקל|שקלים|ש"ח)(?![' + HE + '])');
function nums(s) { return (String(s).match(/\d+/g) || []); }
function srcText(d, field) {
  if (field === '__good') return (d.good_for || []).join(' ');
  if (field === '__less') return (d.less_for || []).join(' ');
  if (field === 'warranty') return [d.warranty_by, d.warranty_months, d.service_terms].join(' ');
  if (d[field] !== undefined && d[field] !== null) return String(d[field]);
  var sv = d.spec ? d.spec[field] : null;
  if (Array.isArray(sv)) sv = sv.join(' ');
  return sv === null || sv === undefined ? '' : String(sv);
}

var FIELDS = DEV_FIELDS.map(function (f) { return f[0]; });
var fails = [], checked = 0, refChecked = 0;

facts.devices.forEach(function (d) {
  FIELDS.forEach(function (field) {
    var a;
    try { a = fieldAnswer(d, field); }
    catch (e) { fails.push(d.slug + '/' + field + ': נפל — ' + e.message); return; }
    if (!a || typeof a.text !== 'string') { fails.push(d.slug + '/' + field + ': לא הוחזר טקסט'); return; }
    checked++;
    var t = a.text;

    if (PRICE.test(t)) fails.push(d.slug + '/' + field + ': מחיר בתשובה');
    if (t.indexOf('—') >= 0) fails.push(d.slug + '/' + field + ': מקף ארוך');

    /* דגם ייחוס: גילוי נאות בכל תשובה */
    if (d.kind === 'reference') {
      refChecked++;
      if (t.indexOf('לא מוכרים') < 0) fails.push(d.slug + '/' + field + ': חסר גילוי נאות');
    }

    /* אין מספר שאינו במקור, בשם הדגם או ב-warranty_months */
    var allowed = srcText(d, field) + ' ' + d.name_he + ' ' + d.name + ' ' +
      (typeof d.warranty_months === 'number' ? d.warranty_months : '');
    var allowedNums = nums(allowed);
    nums(t).forEach(function (n) {
      if (allowedNums.indexOf(n) < 0) fails.push(d.slug + '/' + field + ': המספר ' + n + ' אינו בשדה המקור');
    });
  });
});

/* ---------- השוואה: כל צמד שיש לו עמוד, ועוד צמדים שאין ---------- */
var compareAnswer = sandbox.compareAnswer, comparePage = sandbox.comparePage,
    isCompareQ = sandbox.isCompareQ, CMP_ORDER = sandbox.CMP_ORDER;
var cmpFails = [], cmpChecked = 0;
function bySlug(s) { for (var i = 0; i < facts.devices.length; i++) if (facts.devices[i].slug === s) return facts.devices[i]; return null; }

if (compareAnswer && comparePage) {
  /* כל 19 עמודי ההשוואה, ולכן גם שלושת הצמדים שכוללים מכשיר ייחוס */
  var pairs = (facts.comparePages || []).map(function (p) {
    var ix = p.indexOf('-vs-');
    return [p.slice(0, ix), p.slice(ix + 4)];
  });
  /* ועוד צמד שאין לו עמוד, כדי לוודא נפילה לשער ההשוואות ולא ל-404 */
  pairs.push(['iphone-16', 'galaxy-a07']);

  pairs.forEach(function (pr) {
    var a = bySlug(pr[0]), b = bySlug(pr[1]);
    if (!a || !b) { cmpFails.push(pr.join(' vs ') + ': דגם לא נמצא בקובץ'); return; }
    cmpChecked++;
    var r, href;
    try { r = compareAnswer(a, b); href = comparePage(a, b); }
    catch (e) { cmpFails.push(pr.join(' vs ') + ': נפל — ' + e.message); return; }
    var t = r.text;

    if (PRICE.test(t)) cmpFails.push(pr.join(' vs ') + ': מחיר בתשובה');
    if (t.indexOf('—') >= 0) cmpFails.push(pr.join(' vs ') + ': מקף ארוך');
    if ((a.kind === 'reference' || b.kind === 'reference') && t.indexOf('לא מוכרים') < 0)
      cmpFails.push(pr.join(' vs ') + ': חסר גילוי נאות למכשיר ייחוס');
    if ((t.match(/\n•/g) || []).length > 3)
      cmpFails.push(pr.join(' vs ') + ': יותר משלושה הבדלים');

    /* הקישור חייב להצביע לעמוד שקיים, או לשער */
    var known = (facts.comparePages || []).indexOf(pr[0] + '-vs-' + pr[1]) >= 0 ||
                (facts.comparePages || []).indexOf(pr[1] + '-vs-' + pr[0]) >= 0;
    if (known && href === '/compare/') cmpFails.push(pr.join(' vs ') + ': יש עמוד והקישור נשלח לשער');
    if (!known && href !== '/compare/') cmpFails.push(pr.join(' vs ') + ': אין עמוד והקישור מוביל ל-404: ' + href);

    /* כל מספר בתשובה חייב לבוא מאחד משדות המפרט של אחד משני הדגמים, או משם דגם */
    var allowed = a.name_he + ' ' + b.name_he + ' ' + a.name + ' ' + b.name;
    CMP_ORDER.forEach(function (f) { allowed += ' ' + srcText(a, f[0]) + ' ' + srcText(b, f[0]); });
    var an = nums(allowed);
    nums(t).forEach(function (n) {
      if (an.indexOf(n) < 0) cmpFails.push(pr.join(' vs ') + ': המספר ' + n + ' אינו באף שדה מקור');
    });
  });

  /* שאלת השוואה מזהה שני דגמים, גם כשאחד מוכל בשני */
  [['ההבדל בין אייפון 17 לאייפון 17 פרו', 'iphone-17', 'iphone-17-pro'],
   ['גלקסי A56 מול גלקסי A36', 'galaxy-a56', 'galaxy-a36'],
   ['אייפון 17 לעומת פיקסל 10', 'iphone-17', 'pixel-10']
  ].forEach(function (c) {
    if (!isCompareQ(c[0])) { cmpFails.push('"' + c[0] + '" לא זוהתה כשאלת השוואה'); return; }
    var r = findDevices(c[0]);
    if (r.length < 2 || r[0].slug !== c[1] || r[1].slug !== c[2])
      cmpFails.push('"' + c[0] + '" → ' + r.map(function (x) { return x.slug; }).join('+') + ', צפוי ' + c[1] + '+' + c[2]);
  });
  /* ושאלה על דגם אחד אינה נחשבת השוואה */
  if (findDevices('אחריות על אייפון 17 פרו').length !== 1)
    cmpFails.push('"אחריות על אייפון 17 פרו" זוהה כיותר מדגם אחד');
} else {
  cmpFails.push('פונקציות ההשוואה לא נמצאו');
}

/* ---------- זיהוי דגם: לא מנחשים ---------- */
var idFails = [];
function expectNone(q) { if (findDevices(q).length) idFails.push('"' + q + '" זוהה כדגם ולא היה צריך'); }
function expectOne(q, slug) {
  var r = findDevices(q);
  if (r.length !== 1 || r[0].slug !== slug)
    idFails.push('"' + q + '" → ' + (r.length ? r.map(function (x) { return x.slug; }).join('+') : 'כלום') + ', צפוי ' + slug);
}
expectNone('אחריות על 17');                 /* מספר עירום אינו מזהה */
expectNone('אחריות על גלקסי Z פליפ');        /* דגם שאינו בקטלוג */
expectNone('אחריות על פיקסל 9');             /* דור שאינו בקטלוג */
expectOne('אחריות על גלקסי A56', 'galaxy-a56');
expectOne('מה הסוללה של אייפון 17 פרו מקס', 'iphone-17-pro-max');
expectOne('galaxy-a07 אחריות', 'galaxy-a07');
expectOne('כמה שוקל pixel 10', 'pixel-10');

/* ---------- זיהוי שדה ---------- */
var fFails = [];
function expectField(q, f) { var g = findField(q); if (g !== f) fFails.push('"' + q + '" → ' + g + ', צפוי ' + f); }
expectField('מה האחריות', 'warranty');
expectField('אפשר בתשלומים', 'payments');
expectField('טעינה אלחוטית יש', 'charging_wireless');
expectField('איזו מצלמה קדמית', 'camera_front');
expectField('למי מתאים', '__good');
expectField('שלום', null);

/* ---------- דוח ---------- */
console.log('');
console.log('  נבדקו ' + checked + ' צירופים של דגם כפול שדה (' + facts.devices.length +
  ' דגמים × ' + FIELDS.length + ' שדות), מהם ' + refChecked + ' על דגמי ייחוס');
function report(list, title) {
  if (!list.length) { console.log('  ✓ ' + title); return 0; }
  console.log('  ✗ ' + title + ':');
  list.slice(0, 12).forEach(function (m) { console.log('     ' + m); });
  if (list.length > 12) console.log('     ועוד ' + (list.length - 12));
  return list.length;
}
var n = 0;
n += report(fails, 'תשובות: אין מחיר, אין מספר מחוץ למקור, גילוי נאות בכל אזכור ייחוס, אין מקף ארוך');
n += report(cmpFails, 'השוואה (' + cmpChecked + ' צמדים): עד שלושה הבדלים, קישור לעמוד קיים, גילוי נאות, זיהוי שני דגמים');
n += report(idFails, 'זיהוי דגם: לא מנחש דגם קרוב ולא מספר עירום');
n += report(fFails, 'זיהוי שדה');
console.log('');
if (n) { console.log('  ' + n + ' כשלים\n'); process.exit(1); }
console.log('  הכול תקין\n');
