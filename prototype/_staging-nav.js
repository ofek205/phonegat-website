/* PHONE GAT — פאנל סקירה לסביבת הבדיקות בלבד.
 *
 * הבעיה שהוא פותר: העמודים החדשים מקושרים מתוך התוכן (אריח בדף הבית, כפתורים במדריך), וזה נכון
 * למבקר אמיתי אבל חסר תועלת לסקירה. אי אפשר היה להסתובב בין חמישה עמודים בלי להקליד כתובות.
 *
 * הוא נטען אך ורק כאשר window.PG_PROD הוא false, ולכן לעולם אינו קיים באתר החי. הרשימה נקראת
 * מ-services.json, כדי שעמוד חדש לא ידרוש עריכה של חמישה קבצים.
 *
 * הקובץ מתחיל בקו תחתון כדי שיהיה ברור במבט אחד שהוא אינו חלק מהאתר.
 */
(function () {
  'use strict';
  if (window.PG_PROD) return;                 /* חגורה: גם אם מישהו טען אותו בטעות בפרודקשן */

  var css = document.createElement('style');
  css.textContent =
    '.pg-rev{position:fixed;inset-block-end:calc(78px + var(--cookie-h,0px));inset-inline-start:12px;' +
      'z-index:100000;font:700 13px/1.2 system-ui,sans-serif;direction:rtl}' +
    '.pg-rev-t{background:#151100;color:#ffd400;border:2px solid #ffd400;border-radius:6px;' +
      'padding:10px 14px;min-height:44px;cursor:pointer;font:inherit;box-shadow:0 6px 18px rgba(0,0,0,.4)}' +
    '.pg-rev-p{display:none;margin-bottom:8px;background:#151100;border:2px solid #ffd400;border-radius:8px;' +
      'padding:8px;max-width:min(300px,86vw);box-shadow:0 10px 30px rgba(0,0,0,.5)}' +
    '.pg-rev.open .pg-rev-p{display:block}' +
    '.pg-rev-p a{display:flex;align-items:center;gap:.5em;min-height:44px;padding:0 10px;' +
      'color:#ffd400;text-decoration:none;border-radius:4px}' +
    '.pg-rev-p a:hover{background:#2a2410}' +
    '.pg-rev-p a[aria-current]{background:#ffd400;color:#151100}' +
    '.pg-rev-p hr{border:0;border-top:1px solid #4a4218;margin:6px 4px}' +
    '.pg-rev-b{font-size:10px;font-weight:800;padding:1px 5px;border-radius:3px;background:#4a4218;color:#ffd400}' +
    '.pg-rev-b.wip{background:#8a5a00;color:#fff}.pg-rev-b.planned{background:#3a3a3a;color:#bbb}';
  document.head.appendChild(css);

  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.createElement('div');
    wrap.className = 'pg-rev';
    var panel = document.createElement('div');
    panel.className = 'pg-rev-p';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pg-rev-t';
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = 'עמודי סקירה';
    btn.addEventListener('click', function () {
      var open = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    wrap.appendChild(panel);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    var here = location.pathname.replace(/\/index\.html$/, '/');
    function link(url, name, status) {
      var a = document.createElement('a');
      a.href = url;
      a.textContent = name;
      if (url === here) a.setAttribute('aria-current', 'page');
      if (status && status !== 'review') {
        var b = document.createElement('span');
        b.className = 'pg-rev-b ' + status;
        b.textContent = status === 'wip' ? 'בבנייה' : 'מתוכנן';
        a.appendChild(b);
      }
      panel.appendChild(a);
    }

    fetch('/services.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.pages || []).forEach(function (p) { link('/' + p.slug + '/', p.name, p.status); });
        if ((d.existing || []).length) panel.appendChild(document.createElement('hr'));
        (d.existing || []).forEach(function (p) { link(p.url, p.name); });
      })
      .catch(function () {
        panel.textContent = 'לא ניתן לקרוא את services.json';
      });
  });
})();
