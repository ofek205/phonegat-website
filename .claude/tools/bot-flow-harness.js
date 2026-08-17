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
/* והבטחה **מושהית**, בשביל מירוץ הטעינה. ראו boot(slowTicks) למטה. */
function D(){
  var cbs=[],done=false,val;
  var p={
    then:function(f){
      var d2=D();
      function run(v){var r;try{r=f(v);}catch(e){return;}
        if(r&&typeof r.then==='function')r.then(d2.resolve);else d2.resolve(r);}
      if(done)run(val);else cbs.push(run);
      return d2.promise;
    },
    'catch':function(){return this;}
  };
  return {promise:p,resolve:function(v){if(done)return;done=true;val=v;cbs.forEach(function(c){c(v);});}};
}

/* ---------- boot: קונטקסט אחד של הבוט ----------
 * slowTicks=0 הוא המסלול הרגיל, fetch סינכרוני, וכל הנתונים מוכנים לפני השאלה הראשונה.
 * slowTicks>N מדמה רשת איטית: ה-fetch נפתר רק אחרי N פעימות של setTimeout, ולכן שאלה
 * שנשלחת מיד אחרי פתיחת הצ'אט מגיעה בזמן ש-factsState עדיין 'loading'. זה בדיוק המצב
 * שנמדד בדפדפן על עמוד השוואה והחזיר "לא בטוח שהבנתי" לשאלה שיש לה תשובה.
 */
function boot(slowTicks, pathname, DateImpl) {
var pending = [], ticksLeft = slowTicks || 0, armed = false, sent = [];
var els = {};
['pgFab', 'pgPanel', 'pgMsgs', 'pgChips', 'pgInput', 'pgSend', 'pgClose', 'pgFabWrap', 'pgFabLabel', 'pgRefresh', 'pgStatus', 'pgStatusTxt'].forEach(function (id) { els[id] = El(id); });

var sandbox = {
  document: {
    getElementById: function (id) { return els[id] || (els[id] = El(id)); },
    createElement: function (t) { var e = El(); e.tagName = String(t).toUpperCase(); return e; },
    addEventListener: function () {}, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, documentElement: { style: {}, classList: { add: function () {}, remove: function () {} } },
    body: El()
  },
  matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
  /* מיד ולא אחרי המתנה, אחרת botReply לא מספיק להשיב.
     במסלול האיטי כל פעימה מקרבת את פתרון ה-fetch, וכך ההמתנה של handle נמדדת באמת.
     הספירה מתחילה רק אחרי arm(), אחרת פתיחת הפאנל עצמה הייתה שורפת את הפעימות. */
  setTimeout: function (fn) {
    if (armed && pending.length && --ticksLeft <= 0) { pending.splice(0).forEach(function (f) { f(); }); }
    try { fn(); } catch (e) {}
    return 0;
  },
  clearTimeout: function () {}, requestAnimationFrame: function (fn) { fn(); return 0; },
  /* העמוד שעליו הבוט יושב. עד 16.8.2026 הוא היה תמיד '/', ולכן כל נתיב המכשיר המשתמע
     לא נבדק כאן בכלל. */
  location: { href: '', search: '', pathname: pathname || '/' },
  navigator: { userAgent: 'node', language: 'he' },
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  /* fetch סינכרוני אמיתי, ולא דמות ריקה. הגרסה הראשונה החזירה thenable ריק ואז הזלפתי
     FACTS לקונטקסט הגלובלי, אבל ה-var FACTS שבתוך ה-IIFE מסתיר אותו, ולכן הרתמה מדדה
     בוט בלי קטלוג ודיווחה כשלי ניתוב מדומים. עכשיו הנתונים נטענים במסלול האמיתי. */
  fetch: function (url, opt) {
    /* שליחת הליד נלכדת ולא יוצאת, כדי שבדיקה לא תשלח מייל אמיתי לתיבה של ברוך וסיגל */
    if (/web3forms/.test(String(url))) {
      try { sent.push(JSON.parse(opt.body)); } catch (e) { sent.push({ _parse: 'נכשל' }); }
      return P({ ok: true, json: function () { return P({ success: true }); } });
    }
    var data = /bot-facts/.test(url) ? facts : (/bot-content/.test(url) ? content : null);
    var res = { ok: !!data, json: function () { return P(data); } };
    if (!slowTicks) return P(res);
    var d = D(); pending.push(function () { d.resolve(res); }); return d.promise;
  },
  console: console, Math: Math, Date: DateImpl || Date, Intl: Intl, JSON: JSON, encodeURIComponent: encodeURIComponent,
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
    return e.event + (e.flow ? ':' + e.flow : '') + (e.step ? ':' + e.step : '') +
           (e.field ? ':' + e.field : '') + (e.intent ? ':' + e.intent : '') +
           (e.slug ? ':' + e.slug : '');
  }).join(' → ');
}
function reset() { try { ask('ביטול'); } catch (e) {} }
/* תוויות ההצעות של התור האחרון, כפי שהמשתמש רואה אותן */
function lastSug() {
  var last = null;
  (function walk(n) {
    if (!n || !n.children || !n.children.length) return;
    var kids = n.children;
    if (kids.every(function (c) { return c.tagName === 'BUTTON'; })) last = kids;
    kids.forEach(walk);
  })(els.pgMsgs);
  return last ? last.map(function (b) { return String(b.textContent || '').trim(); }) : [];
}
return { ask: ask, reset: reset, arm: function () { armed = true; }, els: els, sandbox: sandbox, lastSug: lastSug, sent: sent,
         status: function () { return String((els.pgStatusTxt && els.pgStatusTxt.textContent) || ''); } };
}

/* המסלול הרגיל, שעליו רצות כל בדיקות הניתוב */
var M = boot(0), ask = M.ask, reset = M.reset;

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
  /* **כוונה מתוחזקת מנצחת תוכן.** שכבת התוכן רצה לפני 18 הכוונות שנכתבו ביד, ולכן סף
     נמוך מדי הצליל אותן. שתי אלה נחטפו ב-8 וחזרו ב-12, והראשונה היא הבדל מסחרי:
     פון גת הוא הסניף היחיד של סלקום בקרית גת, ולקוח ששאל על זה קיבל פסקה על eSIM. */
  ['אתם נקודת שירות של סלקום', 'chat_intent:celcom'],
  ['יש אחריות על התיקון', 'chat_intent:warranty'],
  /* תוכן */
  ['אחריות על טלפון בישראל מה החוק', 'chat_content_hit'],
  /* **שונה ב-16.8.2026, וזה שיפור ולא נסיגה.** קודם זה הגיע למדריך, כי דירוג הכוונות
     היה לפי אורך מילת מפתח בודדת ו"טלפון" של כוונת human ניצחה את "נפל" ו"מים" של
     repair. הדירוג היום סופר התאמות, ולכן תיאור של תקלה פותח את זרימת התיקון, וזו
     התשובה הנכונה לעסק. המדריך לא אבד: הוא מוצע כקישור באותה בועה, ראו הכלל למטה. */
  ['הטלפון נפל למים מה עושים', 'chat_flow:repair'],
  /* דגם שאיננו מחזיקים. היה נבלע בזרימת הקנייה כי "גלקסי" לבדה היא מילת מפתח שלה, ולכן
     הביקוש לא נרשם באף מקום. הדרישה לספרה היא מה שמשאיר "לקנות אייפון" בזרימה. */
  ['מה עם גלקסי A55', 'chat_device_unmatched'],
  ['יש לכם אייפון 12', 'chat_device_unmatched'],
  ['אני רוצה לקנות אייפון', 'chat_flow:buy'],
  /* קוד דגם בלי שם מותג ובלי פועל קנייה. נענה בסוף השרשרת, אחרי שאף כוונה לא ענתה. */
  ['יש לכם משהו כמו A99 פרו מקס', 'chat_device_unmatched'],
  /* מותג ומספר באותה שאלה שאינם אזכור של דגם. הדרישה לסמיכות היא מה שמפריד, ומה שנבדק
     כאן הוא שהשאלה **אינה** נופלת ל-chat_device_unmatched. מאז שדירוג הכוונות סופר
     התאמות, buy מנצח עם "לקנות" ו"אייפון" את payments עם "תשלומים", וזו התשובה
     הנכונה: מי שכותב "לקנות אייפון בתשלומים" רוצה לקנות, לא הסבר על אשראי. */
  ['לקנות אייפון בתשלומים ל-12 חודשים', 'chat_flow:buy'],
  /* **מכשיר שאיננו מוכרים אנחנו כן מתקנים**, ולכן זה חייב להישאר תיקון */
  ['תיקון מסך לגלקסי A55', 'chat_flow:repair'],
  /* ניקוד וכתיב חסר. normDev מנרמל את שאילתת המשתמש ואת שמות הקטלוג באותה פונקציה,
     ולכן שלוש הצורות נפגשות בלי רשימת מילים נרדפות. */
  ['כמה הסוללה של אַיְיפוֹן 17', 'chat_device_spec'],
  ['כמה הסוללה של איפון 17', 'chat_device_spec'],
  /* שם שנכתב בקטלוג עם גרש, "נאת׳ינג פון 3a פרו", ונשאל בלעדיו. נמצא דרך טוקן הדגם. */
  ['כמה הסוללה של נאתינג פון 3a פרו', 'chat_device_spec']
];
/* רצף רב-שלבי, כי הבאגים כאן לא נראים בשאלה בודדת. שלושתם נמצאו כך:
   יצרן שהוקלד ביד לא נפתר לשם האנגלי ולכן שלב הדגם נדלג בשקט, הקלדה בשלב הסדרה חזרה
   לשלב היצרן בלולאה, ומכשיר ייחוס שהוקלד נרשם כדגם לרכישה ונשלח כבקשת הצעת מחיר. */
var SEQ = [
  ['אני רוצה לקנות מכשיר', 'chat_flow'],
  ['סמסונג', 'chat_buy_step:brand'],
  ['גוגל פיקסל 10', 'chat_ref_declined'],
  ['גלקסי A56', 'chat_buy_step:model']
];
var seqFails = [];
(function () {
  reset();
  SEQ.forEach(function (s) {
    var got = ask(s[0]);
    if (got.indexOf(s[1]) < 0) seqFails.push('"' + s[0] + '" → ' + got + '   (צפוי ' + s[1] + ')');
  });
  reset();
})();

/* ---------- שלושה כללים שנשברו בשקט ולכן הם שערים ----------
 * 1. **בקשה לאדם מחלצת מהזרימה.** נמדד: "אני רוצה שברוך יתקשר אליי" באמצע זרימת הקנייה
 *    נרשם כשם היצרן והזרימה המשיכה לשלב הנפח, וזה גם הגיע להודעת ה-WhatsApp שברוך מקבל.
 * 2. **טקסט חופשי לא נשלח לאנליטיקס.** נמדד dataLayer עם
 *    device:"קוראים לי דוד לוי 0501234567" ו-storage:"0525893366", בזמן ש-privacy.html
 *    מבטיח מידע סטטיסטי בלבד.
 * 3. **אין שתי תוויות זהות באותה רשימת דגמים.** "שיאומי 15" ו"רדמי נוט 15" התקצרו שניהם
 *    ל-"15", ושני צ'יפים שונים קיבלו אותו שם נגיש. */
var ruleFails = [], ruleRows = [];
function rule(name, ok, detail) {
  ruleRows.push({ n: name, ok: ok });
  if (!ok) ruleFails.push(name + (detail ? ': ' + detail : ''));
}
(function () {
  /* 1. יציאה לאדם */
  var S = boot(0, '/');
  S.ask('אני רוצה לקנות מכשיר');
  var got = S.ask('אני רוצה שברוך יתקשר אליי');
  rule('בקשה לאדם מחלצת מזרימת הקנייה', got.indexOf('chat_lead_start') >= 0 || got.indexOf('chat_flow_exit') >= 0, got);

  /* 2. PII: מריצים זרימת תיקון וזרימת קנייה עם טקסט שמכיל שם ומספר, ובודקים את dataLayer */
  /* בלי המילים שמפעילות את היציאה לאדם. הניסוח הראשון כאן היה "תחזרו אליי", והוא חילץ
     מהזרימה לפני ש-chat_repair בכלל נורה, כלומר הבדיקה עברה בלי לבדוק כלום. */
  var T = boot(0, '/');
  T.sandbox.dataLayer.length = 0;
  T.ask('תיקון');
  T.ask('הטלפון של דוד לוי 0501234567');
  T.ask('המסך שבור לגמרי, דחוף');
  var B = boot(0, '/');
  B.ask('אני רוצה לקנות מכשיר');
  B.ask('אייפון');
  B.ask('אייפון 17');
  B.ask('0525893366');
  var all = T.sandbox.dataLayer.concat(B.sandbox.dataLayer);
  var leaked = [];
  all.forEach(function (e) {
    if (!e || !e.event) return;
    Object.keys(e).forEach(function (k) {
      var v = String(e[k] == null ? '' : e[k]);
      /* ספרות רצופות הן הסימן החד משמעי: מספר טלפון או תעודת זהות. */
      if (/\d{7,}/.test(v.replace(/[-\s]/g, ''))) leaked.push(e.event + '.' + k + '="' + v.slice(0, 40) + '"');
      /* וגם משפט שלם: ארבע מילים ומעלה אינו ערך מרשימה סגורה. */
      else if (k !== 'heading' && k !== 'hint' && v.split(/\s+/).length >= 4) leaked.push(e.event + '.' + k + '="' + v.slice(0, 40) + '"');
    });
  });
  rule('טקסט חופשי לא נשלח לאנליטיקס', leaked.length === 0, leaked.slice(0, 3).join(' · '));

  /* 4. **הליד באמת נשלח למייל, ועם מה שהשיחה יודעת.** הכותרת בהדר הבטיחה "בדרך כלל
     עונים מיד", והדבר היחיד שבאמת מגיע לברוך הוא המייל הזה. שמות השדות זהים לטופס
     ב-/contact/, כדי ששתי הפניות ייראו אותו דבר בתיבה. */
  var L = boot(0, '/phones/galaxy-a56/');
  L.sandbox.PG_PROD = true;
  L.ask('תיקון'); L.ask('אייפון'); L.ask('מסך שבור');
  L.ask('אני רוצה שתחזרו אליי');
  L.ask('שרה כהן');
  L.ask('052-9876543');
  var mail = L.sent[0];
  rule('הליד נשלח למייל עם הפרטים', !!mail && mail['שם מלא'] === 'שרה כהן' && mail['טלפון'] === '0529876543',
       mail ? JSON.stringify(mail) : 'לא נשלח כלום');
  rule('שדות המייל זהים לטופס בצור קשר',
       !!mail && ['שם מלא', 'טלפון', 'נושא', 'הודעה'].every(function (k) { return k in mail; }),
       mail ? Object.keys(mail).join(', ') : '');
  /* **מה שהשיחה אספה חייב להופיע בגוף**, אחרת ברוך מקבל שם וטלפון ומתקשר בלי לדעת כלום.
     בדיקת נוכחות שדה בלבד עברה גם כששדה ההודעה רוקן, ולכן כאן נבדק התוכן עצמו. */
  var body = mail ? String(mail['הודעה']) : '';
  rule('גוף המייל נושא את מה שנאסף בשיחה',
       body.indexOf('מסך שבור') >= 0 && body.indexOf('אייפון') >= 0 && body.indexOf('/phones/galaxy-a56/') >= 0,
       body.slice(0, 80));
  rule('המייל לא נושא טקסט חופשי', !/\d{7,}/.test(body.replace(/[-\s]/g, '')), body.slice(0, 60));

  /* נושא שהוא מזהה פנימי. זה קורה כשמבקשים שיחה **באמצע** זרימת הקנייה, לפני buyDone,
     כי startBuy קובע ctx.topic='buy' והוא הגיע כך לשורת הנושא במייל. */
  var Q = boot(0, '/');
  Q.sandbox.PG_PROD = true;
  Q.ask('אני רוצה לקנות מכשיר');
  Q.ask('אני רוצה שתחזרו אליי');
  Q.ask('רון'); Q.ask('0501112222');
  var m2 = Q.sent[0];
  rule('נושא המייל בעברית ולא מזהה פנימי',
       !!m2 && !/^(buy|repair|callback|lead)$/.test(String(m2['נושא'])),
       m2 ? String(m2['נושא']) : 'לא נשלח');

  /* 5. **חיווי הזמינות אומר את האמת בשני הכיוונים.**
     הוא החליף את "בדרך כלל עונים מיד", שהיא הבטחה שאיש לא עומד מאחוריה בשתיים בלילה.
     שני שעונים קבועים, שניהם ביום שני, ושניהם נמדדים בשעון ישראל:
       16:00 UTC = 19:00 בישראל, אחרי הסגירה ב-18:30
       09:00 UTC = 12:00 בישראל, באמצע יום העבודה */
  function atUtc(iso) {
    var F = new Date(iso);
    function Stub() { var d = new Date(F.getTime());
      d.getHours = function () { return d.getUTCHours(); };
      d.getMinutes = function () { return d.getUTCMinutes(); };
      d.getDay = function () { return d.getUTCDay(); }; return d; }
    Stub.now = function () { return F.getTime(); };
    return Stub;
  }
  var closed = boot(0, '/', atUtc('2026-08-17T16:00:00Z')).status();
  var open2 = boot(0, '/', atUtc('2026-08-17T09:00:00Z')).status();
  rule('חיווי הזמינות: "מחוץ לשעות הפעילות" כשסגור', closed.indexOf('מחוץ') >= 0, closed);
  rule('חיווי הזמינות: "זמין" כשפתוח', open2.indexOf('זמין') >= 0, open2);

  /* 6. **קישור לעמוד שעונה, גם כשהבוט עונה בעצמו וגם כשלא.**
     שני מסלולים נפרדים, ושניהם נשאלו במפורש:
       · שאלה שיש לה זרימה: "תיקון סוללה באייפון" פותח תיקון, ולצידו קישור לעמוד.
       · שאלה שאין עליה תשובה: במקום "לא הבנתי", "יש לנו עמוד באתר שמסביר את זה".
     הספרייה מכסה את כל 76 העמודים ולא רק את 20 המאונדקסים, ולכן גם עמוד מכשיר ועמוד
     השוואה יכולים להיות ההצעה. */
  function linkIn(sug){ return sug.filter(function(l){ return /^לעמוד: /.test(l); }); }
  var P1 = boot(0, '/');
  P1.ask('תיקון סוללה באייפון');
  var l1 = linkIn(P1.lastSug());
  rule('קישור לעמוד מוצע לצד זרימת התיקון', l1.length === 1, P1.lastSug().join(' | '));

  var P2 = boot(0, '/');
  P2.ask('הטלפון נפל למים מה עושים');
  rule('קישור למדריך מוצע לצד תקלת המים', linkIn(P2.lastSug()).length === 1, P2.lastSug().join(' | '));

  /* שאלה שבאמת נופלת: שכבת התוכן לא מדרגת אותה כלל, ואף כוונה לא תופסת. עמוד היישוב
     קיים ואינו באינדקס, ולכן רק ספריית העמודים יכולה למצוא אותו. הניסוח הראשון כאן
     נענה ממילא על ידי התוכן, כלומר השער עבר בלי לבדוק את המסלול שהוא נועד לשמור. */
  var P3 = boot(0, '/');
  var ev3 = P3.ask('יש לכם סניף בלכיש');
  rule('כשאין תשובה מוצע עמוד במקום "לא הבנתי"', ev3.indexOf('chat_page_suggest') >= 0, ev3);
  /* על הכתובת ולא על התווית: התווית נחתכת, והבדיקה הראשונה כאן נכשלה בדיוק בגלל זה
     בזמן שהקישור עצמו היה נכון. */
  var sug3 = P3.sandbox.dataLayer.filter(function (e) { return e && e.event === 'chat_page_suggest'; })[0];
  rule('העמוד המוצע הוא הנכון', !!sug3 && sug3.url === '/phone-repair-lachish/', sug3 ? sug3.url : 'אין');
  /* והתווית עדיין מבדילה: המילה המזהה שורדת את החיתוך */
  rule('תווית הקישור שומרת את המילה המזהה', linkIn(P3.lastSug()).join('').indexOf('לכיש') >= 0, P3.lastSug().join(' | '));

  /* 7. **הצעות של תור קודם מושבתות.** נמדד: 32 צ'יפים פעילים מ-12 תורות באותה שיחה.
     זה נפל עליי בבדיקת הקישורים החדשים: לחצתי על מה שנראה כמו הקישור הנוכחי והגעתי
     לעמוד מלפני שלושה תורות, כי הצ'יפ הישן חי ויושב קודם ב-DOM. */
  var S7 = boot(0, '/');
  S7.ask('תיקון'); S7.ask('אייפון');
  var live = 0, dead = 0;
  (function walk(n) {
    if (!n || !n.children) return;
    n.children.forEach(function (c) {
      if (c.tagName === 'BUTTON') { if (c.disabled) dead++; else live++; }
      walk(c);
    });
  })(S7.els.pgMsgs);
  rule('הצעות של תור קודם מושבתות', dead > 0 && live > 0 && live <= 6, 'פעילים ' + live + ', מושבתים ' + dead);

  /* 3. תוויות דגם ייחודיות. שיאומי הוא הענף שבו זה נשבר. */
  var X = boot(0, '/');
  X.ask('אני רוצה לקנות מכשיר');
  X.ask('שיאומי');
  var labels = X.lastSug();
  var seen = {}, dup = [];
  labels.forEach(function (l) { if (seen[l]) dup.push(l); else seen[l] = 1; });
  rule('אין שתי תוויות זהות ברשימת הדגמים', dup.length === 0, 'כפולות: ' + dup.join(', ') + '  מתוך ' + labels.join(', '));
})();

/* ---------- מירוץ הטעינה ----------
 * bot-facts ו-bot-content נמשכים בפתיחת הצ'אט ולא בטעינת העמוד, כדי שמי שלא פותח אותו
 * לא ישלם עליהם. לכן יש חלון שבו הבוט פתוח ולא יודע כלום. **נמדד בדפדפן:** פתיחה,
 * הקלדה ושליחה ברצף על עמוד השוואה החזירו "לא בטוח שהבנתי", ואותה שאלה בדיוק ענתה נכון
 * שנייה אחר כך. handle מחזיק את השאלה עד שהנתונים מגיעים, וזאת הבדיקה שלא ייסוג. */
var raceFail = '';
(function () {
  var S = boot(3);
  S.arm();
  var got = S.ask('מה הסוללה של גלקסי A56');
  if (got.indexOf('chat_device_spec') < 0) {
    raceFail = 'שאלה בזמן טעינת הנתונים → ' + got + '   (צפוי chat_device_spec)';
  }
})();

/* ---------- מכשיר משתמע: העמוד והשיחה ----------
 * **שני התרחישים נמדדו בדפדפן על /phones/galaxy-a56/ ושניהם נפלו לזרימת תיקון:**
 * "כמה הסוללה?" בלי שם דגם, ו"ומה המסך?" מיד אחרי תשובה נכונה על A56. שני השומרים
 * נבדקים כאן יחד עם התיקון, כי בלעדיהם התיקון גרוע מהבאג: תלונה הייתה מקבלת מפרט,
 * ושאלת מדריך הייתה מקבלת שדה של הדגם שבעמוד. */
var implFails = [], implRows = [];
(function () {
  var A56 = '/phones/galaxy-a56/';
  var cases = [
    ['הדגם נלקח מהעמוד', A56, ['כמה הסוללה?'], 'chat_device_implied:galaxy-a56'],
    ['תלונה נשארת תיקון', A56, ['המסך שלי שבור'], 'chat_flow:repair'],
    /* שאלה שמזכירה תיקון אינה שאלה על המפרט של המכשיר שבעמוד. נמדד: בעמוד A56 זה
       החזיר את האחריות של A56 מהקטלוג, כלומר אחריות על מכשיר חדש, במקום את האחריות
       שאנחנו נותנים על תיקון. */
    ['שאלת שירות אינה שאלת מפרט', A56, ['יש אחריות על התיקון'], 'chat_intent:warranty'],
    /* ניקוד 17.6 בשכבת התוכן, הרבה מעל הסף. בלי השומר הזה השאלה הייתה מקבלת את שדה
       האחריות של הדגם שבעמוד במקום את המדריך שנכתב בדיוק בשבילה. */
    ['מדריך גובר על מפרט', A56, ['מה האחריות על טלפון בישראל'], 'chat_content_hit'],
    ['הדגם נזכר מהשיחה', '/', ['כמה הסוללה של גלקסי A56', 'ומה המצלמה?'], 'chat_device_implied:galaxy-a56'],
    /* עומדים על עמוד A56 אבל שאלו על אייפון 17, ולכן ההמשך שייך לאייפון */
    ['השיחה גוברת על העמוד', A56, ['מה השבב של אייפון 17', 'ומה המצלמה?'], 'chat_device_implied:iphone-17']
  ];
  cases.forEach(function (c) {
    var S = boot(0, c[1]), got = '';
    c[2].forEach(function (q) { got = S.ask(q); });
    var ok = got.indexOf(c[3]) >= 0;
    implRows.push({ n: c[0], got: got, want: c[3], ok: ok });
    if (!ok) implFails.push(c[0] + ': "' + c[2][c[2].length - 1] + '" → ' + got + '   (צפוי ' + c[3] + ')');
  });
})();

/* ---------- שעות הפתיחה נמדדות בשעון החנות ----------
 * openNow קרא new Date().getHours(), כלומר את השעון של המבקר. מי שגולש מחו"ל, או שהשעון
 * במכשיר שלו סטה, קיבל "אנחנו פתוחים עכשיו, אפשר לחייג ישירות" בשעה שהחנות סגורה, וגם
 * כפתור חיוג במקום "נחזור אליכם". החנות בקרית גת, ולכן התשובה נמדדת בשעון ישראל.
 *
 * הרגע שנבחר הוא בדיוק זה שמפריד בין השניים: יום שני 16:00 UTC הוא 19:00 בישראל, כלומר
 * אחרי הסגירה ב-18:30, בזמן שמכשיר שמכוון ל-UTC היה מחשב 16:00 ומכריז "פתוח". */
var clockFail = '';
(function () {
  var FIXED = new Date('2026-08-17T16:00:00Z');
  function UtcDate() {
    var d = new Date(FIXED.getTime());
    /* מדמה מכשיר שהשעון המקומי שלו הוא UTC, ומשאיר אותו Date אמיתי כדי ש-Intl יעבוד */
    d.getHours = function () { return d.getUTCHours(); };
    d.getMinutes = function () { return d.getUTCMinutes(); };
    d.getDay = function () { return d.getUTCDay(); };
    return d;
  }
  UtcDate.now = function () { return FIXED.getTime(); };
  var S = boot(0, '/', UtcDate);
  var open = S.sandbox.dataLayer.filter(function (e) { return e && e.event === 'chat_open'; })[0];
  if (!open) { clockFail = 'לא נורה chat_open, אי אפשר למדוד את השעון'; }
  else if (open.open !== false) {
    clockFail = 'ביום שני 19:00 בשעון ישראל הבוט מכריז שהחנות פתוחה, כלומר הוא קורא את שעון המבקר';
  }
})();

/* **קונטקסט נקי לכל מקרה, ולא reset() על קונטקסט משותף.**
 * reset שולח "ביטול", וזה סוגר זרימה פעילה אבל לא מנקה את ctx.slug. מאז שיש מכשיר
 * משתמע זו דליפה שמזייפת תוצאות: "כמה הסוללה של איפון 17" עבר גם כשנרמול הכתיב הוסר,
 * לא כי הכתיב זוהה אלא כי מקרה קודם השאיר את אייפון 17 בהקשר והמכשיר המשתמע ענה עליו.
 * בדיקה שעוברת מהסיבה הלא נכונה גרועה מבדיקה חסרה, כי היא נראית כמו כיסוי. */
var fails = [], rows = [];
CASES.forEach(function (c) {
  var got = boot(0, '/').ask(c[0]);
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
if(seqFails.length){console.log('  ✗ רצף זרימת הקנייה:');seqFails.forEach(function(m){console.log('     '+m);});}else{console.log('  ✓ רצף זרימת הקנייה: יצרן בהקלדה, דגם ייחוס נדחה, דגם נמכר מתקדם');}
console.log('');
if (raceFail) { console.log('  ✗ ' + raceFail); } else { console.log('  ✓ שאלה שנשלחת לפני שהנתונים נטענו ממתינה ונענית'); }
console.log('');
console.log('  מכשיר משתמע מהעמוד ומהשיחה:');
implRows.forEach(function (r) {
  console.log('   ' + (r.ok ? '✓' : '✗') + ' ' + r.n + (r.ok ? '' : '   קיבל: ' + r.got + '   צפוי: ' + r.want));
});
if (clockFail) { console.log('  ✗ ' + clockFail); } else { console.log('  ✓ שעות הפתיחה נמדדות בשעון ישראל ולא בשעון המבקר'); }
console.log('');
ruleRows.forEach(function (r) { console.log('  ' + (r.ok ? '✓' : '✗') + ' ' + r.n); });
if (ruleFails.length) ruleFails.forEach(function (m) { console.log('      ' + m); });
console.log('');
if (fails.length || seqFails.length || raceFail || implFails.length || clockFail || ruleFails.length) {
  console.log('  ' + (fails.length + implFails.length + ruleFails.length + (raceFail ? 1 : 0) + (clockFail ? 1 : 0)) + ' כשלים\n');
  process.exit(1);
}
console.log('  הניתוב תקין\n');
