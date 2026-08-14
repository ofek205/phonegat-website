#!/usr/bin/env node
/* PHONE GAT — רתמה על **הניתוב** של הבוט, ולא על בוני התשובות.
 *
 *   node .claude/tools/bot-flow-harness.js [שורש-חלופי]
 *
 * bot-harness.js מאמת 624 צירופים, אבל הוא קורא ל-fieldAnswer ול-compareAnswer **ישירות**.
 * לכן הוא היה ירוק לגמרי בזמן שבניסוח אמיתי ארבע מחמש שאלות דגם לא הגיעו אליהן בכלל:
 * מילות המפתח של buy כוללות את שמות המותגים ושל repair את שמות השדות, ולכן
 * "מה הסוללה של גלקסי A56" נחטף לזרימת תיקון ו"איזה שבב יש באייפון 17" לזרימת קנייה.
 * שכבת העובדות הייתה קוד מת, ואף שער לא ראה את זה.
 *
 * הרתמה הזאת מריצה את כל אזור bot:js מול DOM מדומה, לוכדת את המטפל של כפתור השליחה,
 * ושואלת שאלות כמו משתמש. מה שנבדק הוא **לאן השאלה נחתה**, לפי האירוע שנורה.
 *
 * setTimeout מורץ מיד, כי botReply משתמש בו להשהיית ההקלדה וללא זה אין תשובה.
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var html = fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8');
var facts = JSON.parse(fs.readFileSync(path.join(PROTO, 'bot-facts.json'), 'utf8'));
var content = JSON.parse(fs.readFileSync(path.join(PROTO, 'bot-content.json'), 'utf8'));

var a = html.indexOf('/* bot:js:start'), b = html.indexOf('/* bot:js:end */');
if (a < 0 || b < 0) { console.error('✗ סימני bot:js לא נמצאו'); process.exit(1); }
var code = html.slice(a, b);

/* ---------- DOM מדומה, מינימלי אבל מספיק כדי שה-IIFE יאותחל ---------- */
var tracked = [], bubbles = [];
function El(id) {
  var self = {
    id: id || '', tagName: 'DIV', value: '', textContent: '', innerHTML: '',
    children: [], _l: {}, style: {}, dataset: {},
    classList: { _s: {}, add: function (c) { this._s[c] = 1; }, remove: function (c) { delete this._s[c]; },
                 contains: function (c) { return !!this._s[c]; }, toggle: function (c) { this._s[c] ? delete this._s[c] : this._s[c] = 1; } },
    addEventListener: function (t, fn) { (this._l[t] = this._l[t] || []).push(fn); },
    removeEventListener: function () {}, appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function () {}, setAttribute: function (k, v) { this[k] = v; },
    getAttribute: function (k) { return this[k] === undefined ? null : this[k]; },
    hasAttribute: function (k) { return this[k] !== undefined; }, removeAttribute: function (k) { delete this[k]; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    closest: function () { return null; }, focus: function () {}, blur: function () {}, click: function () { fire(this, 'click'); },
    getBoundingClientRect: function () { return { width: 300, height: 500, top: 0, left: 0, bottom: 500, right: 300 }; },
    scrollIntoView: function () {}, scrollTop: 0, scrollHeight: 0, offsetParent: {}, parentNode: null
  };
  return self;
}
function fire(el, type, ev) {
  (el._l[type] || []).forEach(function (fn) { fn(ev || { target: el, preventDefault: function () {}, key: '' }); });
}
/* הבטחה סינכרונית מינימלית, כדי ש-loadFacts יסיים לפני השאלה הראשונה */
function P(v){return {then:function(f){var r=f(v);return (r&&typeof r.then==='function')?r:P(r);},'catch':function(){return this;}};}
var els = {};
['pgFab', 'pgPanel', 'pgMsgs', 'pgChips', 'pgInput', 'pgSend', 'pgClose', 'pgFabWrap', 'pgFabLabel', 'pgRefresh'].forEach(function (id) { els[id] = El(id); });

var sandbox = {
  document: {
    getElementById: function (id) { return els[id] || (els[id] = El(id)); },
    createElement: function (t) { var e = El(); e.tagName = String(t).toUpperCase(); return e; },
    addEventListener: function () {}, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, documentElement: { style: {}, classList: { add: function () {}, remove: function () {} } },
    body: El()
  },
  matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
  /* מיד ולא אחרי המתנה, אחרת botReply לא מספיק להשיב */
  setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; },
  clearTimeout: function () {}, requestAnimationFrame: function (fn) { fn(); return 0; },
  location: { href: '', search: '', pathname: '/' },
  navigator: { userAgent: 'node', language: 'he' },
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  /* fetch סינכרוני אמיתי, ולא דמות ריקה. הגרסה הראשונה החזירה thenable ריק ואז הזלפתי
     FACTS לקונטקסט הגלובלי, אבל ה-var FACTS שבתוך ה-IIFE מסתיר אותו, ולכן הרתמה מדדה
     בוט בלי קטלוג ודיווחה כשלי ניתוב מדומים. עכשיו הנתונים נטענים במסלול האמיתי. */
  fetch: function (url) {
    var data = /bot-facts/.test(url) ? facts : (/bot-content/.test(url) ? content : null);
    return P({ ok: !!data, json: function () { return P(data); } });
  },
  console: console, Math: Math, Date: Date, JSON: JSON, encodeURIComponent: encodeURIComponent,
  KeyboardEvent: function () {}, Event: function () {},
  addEventListener: function () {}, removeEventListener: function () {},
  innerWidth: 1280, innerHeight: 800, scrollY: 0, getComputedStyle: function () { return {}; },
  dataLayer: []
};
sandbox.window = sandbox;
var ctx = vm.createContext(sandbox);
try { new vm.Script(code, { filename: 'index.html:bot-js' }).runInContext(ctx); }
catch (e) { console.error('✗ אזור bot:js לא נטען: ' + e.message); process.exit(1); }

/* פתיחת הפאנל היא מה שמפעיל את loadFacts ואת loadContent, ועם fetch סינכרוני
   הם מסתיימים מיד. זה המסלול האמיתי ולא הזלפה. */
fire(els.pgFab,'click');

/* המטפל של כפתור השליחה הוא הדרך שבה משתמש שואל */
var sendL = (els.pgSend._l['click'] || [])[0];
if (!sendL) { console.error('✗ לא נמצא מטפל על כפתור השליחה'); process.exit(1); }

function ask(q) {
  sandbox.dataLayer.length = 0;
  els.pgInput.value = q;
  try { sendL({ target: els.pgSend, preventDefault: function () {} }); } catch (e) { return 'שגיאה: ' + e.message; }
  var ev = sandbox.dataLayer.filter(function (e) { return e && /^chat/.test(String(e.event)); });
  if (!ev.length) return '(שום אירוע)';
  return ev.map(function (e) {
    return e.event + (e.flow ? ':' + e.flow : '') + (e.field ? ':' + e.field : '') + (e.intent ? ':' + e.intent : '');
  }).join(' → ');
}
function reset() { try { ask('ביטול'); } catch (e) {} }

/* ---------- הפיקסצ'ר: לאן כל סוג שאלה חייב לנחות ---------- */
var CASES = [
  /* שאלות מפרט: חייבות להגיע לשכבת העובדות */
  ['מה הסוללה של גלקסי A56', 'chat_device_spec'],
  ['מה גודל המסך של אייפון 17', 'chat_device_spec'],
  ['איזה שבב יש באייפון 17', 'chat_device_spec'],
  ['כמה שוקל רדמי נוט 14', 'chat_device_spec'],
  ['יש טעינה אלחוטית בגלקסי S26', 'chat_device_spec'],
  ['אחריות על גלקסי A56', 'chat_device_spec'],
  ['אפשר בתשלומים על אייפון 17', 'chat_device_spec'],
  ['למי מתאים גלקסי A56', 'chat_device_spec'],
  /* השוואה */
  ['מה ההבדל בין אייפון 17 לאייפון 17 פרו', 'chat_device_compare'],
  ['גלקסי S26 מול אייפון 17', 'chat_device_compare'],
  /* כוונות פעולה: חייבות להישאר זרימה */
  ['אני רוצה לקנות מכשיר חדש', 'chat_flow:buy'],
  ['המסך שלי שבור', 'chat_flow:repair'],
  ['תחזרו אליי בבקשה', 'chat_lead_start'],
  /* תוכן */
  ['אחריות על טלפון בישראל מה החוק', 'chat_content_hit'],
  ['הטלפון נפל למים מה עושים', 'chat_content_hit']
];

/* פתוח ומדווח, לא נכשל: דורש צמצום מילות המפתח של buy, וזו החלטת מוצר. "מה עם גלקסי A55"
   נחטף לזרימת קנייה כי buy תופס את המילה "גלקסי", ולכן ביקוש לדגם שאיננו מחזיקים לא
   נרשם. שני הסוקרים הצביעו על אותו מקום לתיקון. */
var OPEN = [['מה עם גלקסי A55', 'chat_device_unmatched']];
var fails = [], rows = [];
CASES.forEach(function (c) {
  reset();
  var got = ask(c[0]);
  var ok = got.indexOf(c[1]) >= 0;
  rows.push({ q: c[0], want: c[1], got: got, ok: ok });
  if (!ok) fails.push('"' + c[0] + '" → ' + got + '   (צפוי ' + c[1] + ')');
});

console.log('');
console.log('  ' + (CASES.length - fails.length) + '/' + CASES.length + ' שאלות נחתו במקום הנכון\n');
rows.forEach(function (r) {
  console.log('   ' + (r.ok ? '✓' : '✗') + ' ' + r.q);
  if (!r.ok) console.log('       קיבל: ' + r.got + '   צפוי: ' + r.want);
});
console.log('  פתוח ומדווח, לא חוסם:');
OPEN.forEach(function (c) { reset(); console.log('   · "' + c[0] + '" → ' + ask(c[0]) + '   (רצוי ' + c[1] + ', דורש צמצום מילות המפתח של buy)'); });
console.log('');
if (fails.length) { console.log('  ' + fails.length + ' כשלי ניתוב\n'); process.exit(1); }
console.log('  הניתוב תקין\n');
