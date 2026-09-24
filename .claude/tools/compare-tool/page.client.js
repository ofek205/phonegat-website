/* עמודי ההשוואה הקבועים, עיצוב ח׳. gen-compare.js עוטף את הקוד הזה ומזריק לפניו את PG: {a, b, slug}.
   כל התוכן כבר ב-HTML. הקוד מוסיף רק את "מה חשוב לכם": כפתור לכל תחום, שמעלה אותו לראש ומקפל את השאר
   תחת כפתור אחד. שום הבדל לא נעלם. עמוד בלי JavaScript מציג את כל התחומים, בלי כפתורים שלא עושים כלום. */
function pgComparePage() {
  /* הפס הלבן נדבק מתחת להדר של האתר, שגובהו משתנה לפי רוחב, באנר ותפריט נגישות */
  function stick() {
    try { var h = document.querySelector("header.site"), base = 0;
      if (h) { var cs = getComputedStyle(h); if (cs.position === "sticky" || cs.position === "fixed") base = Math.max(0, h.getBoundingClientRect().bottom); }
      document.documentElement.style.setProperty("--pg-stick-1", Math.round(base) + "px"); } catch (e) {}
  }
  var q = false;
  function soon() { if (q) return; q = true; var run = function () { q = false; stick(); }; if (window.requestAnimationFrame) requestAnimationFrame(run); setTimeout(run, 100); }
  window.addEventListener("resize", soon);
  window.addEventListener("scroll", soon, { passive: true });
  /* ההדר של האתר נסגר ונפתח באנימציה של 280ms, והגלילה נגמרת באמצעה. בלי המדידה בסוף המעבר הפס
     נשאר במקום של אמצע האנימציה: נמדד בטסטים, רווח של 32px בגלילה למטה, ו-24px מתחת להדר בגלילה
     למעלה. הכלי כבר מקשיב לזה, והעמוד לא הקשיב. */
  (function () { var h = document.querySelector("header.site"); if (h) h.addEventListener("transitionend", function (e) { if (e.propertyName === "transform") stick(); }); })();
  try { if (window.MutationObserver) new MutationObserver(stick).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
  stick();
  var box = document.getElementById("cvgroups"), prio = document.getElementById("cvprio");
  if (!box || !prio) return;
  var grps = Array.prototype.slice.call(box.querySelectorAll(".cv-grp[data-cat]"));
  if (grps.length < 2) return;
  var cats = grps.map(function (g) { return { name: g.getAttribute("data-cat"), n: +g.getAttribute("data-n") || 0, el: g }; });
  var on = {}, restOpen = false;
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function diffTxt(n) { return n === 1 ? "הבדל אחד" : n + " הבדלים"; }
  function push(ev, d) { try { window.dataLayer = window.dataLayer || []; var o = { event: ev, page_slug: PG.slug }; for (var k in d) o[k] = d[k]; window.dataLayer.push(o); } catch (e) {} }
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12l5 5 9-10"></path></svg>';
  prio.innerHTML = '<h3 class="cv-ph3">מה חשוב לכם?</h3><p>בחרו תחום, והוא יעלה לראש הרשימה. שום הבדל לא נעלם.</p><div class="cv-chips">' +
    cats.map(function (c) { return '<button type="button" class="cv-chip" data-cat="' + esc(c.name) + '" aria-pressed="false">' + CHECK + esc(c.name) + " <span>" + c.n + "</span></button>"; }).join("") +
    '</div><p class="cv-status" id="cvstatus" role="status" aria-live="polite"></p>';
  prio.hidden = false;
  var rest = document.createElement("button");
  rest.type = "button"; rest.className = "cv-rest"; rest.hidden = true;
  box.parentNode.insertBefore(rest, box.nextSibling);

  function apply() {
    var picked = cats.filter(function (c) { return on[c.name]; }), others = cats.filter(function (c) { return !on[c.name]; });
    var restN = 0; others.forEach(function (c) { restN += c.n; });
    /* הסדר ב-DOM ולא רק בתצוגה, כדי שקורא מסך ומקלדת יעברו באותו סדר שרואים */
    (picked.length ? picked.concat(others) : cats).forEach(function (c) { box.appendChild(c.el); c.el.hidden = picked.length > 0 && !on[c.name] && !restOpen; });
    rest.hidden = !(picked.length && restN);
    rest.setAttribute("aria-expanded", restOpen ? "true" : "false");
    rest.textContent = restOpen ? "לקפל את שאר התחומים" : "עוד " + diffTxt(restN) + " בתחומים שלא בחרתם";
    Array.prototype.forEach.call(prio.querySelectorAll(".cv-chip"), function (b) { b.setAttribute("aria-pressed", on[b.getAttribute("data-cat")] ? "true" : "false"); });
    var total = 0; cats.forEach(function (c) { total += c.n; });
    var st = document.getElementById("cvstatus");
    if (st) st.textContent = !picked.length ? "מוצגים כל " + total + " ההבדלים, לפי תחום."
      : "בראש הרשימה: " + picked.map(function (c) { return c.name; }).join(", ") + "." + (restN ? " עוד " + diffTxt(restN) + " בתחומים האחרים." : " אלה כל ההבדלים.");
    var msg = "היי, אשמח לעזרה בבחירה בין " + PG.a + " לבין " + PG.b + "." + (picked.length ? " חשוב לי: " + picked.map(function (c) { return c.name; }).join(", ") + "." : "");
    var wt = document.getElementById("cvwatext"), w = document.getElementById("cvwa");
    if (wt) wt.textContent = msg;
    if (w) w.setAttribute("href", "https://wa.me/97286812050?text=" + encodeURIComponent(msg));
  }
  prio.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest(".cv-chip") : null; if (!b) return;
    var k = b.getAttribute("data-cat"); if (on[k]) delete on[k]; else on[k] = 1;
    if (!Object.keys(on).length) restOpen = false;
    push("cmp_priority", { category: k, on: !!on[k] }); apply();
  });
  rest.addEventListener("click", function () { restOpen = !restOpen; push("cmp_rest", { open: restOpen }); apply(); });
  apply();

}
