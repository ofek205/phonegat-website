/* כלי ההשוואה, גרסה ח׳ (24.9.2026). הקוד הזה רץ בדפדפן. gen-compare.js עוטף אותו בפונקציה ומזריק לפניו
   את הנתונים: PAIRS, ORDER, TRAITS, TDEF, MEANS, READY ו-CFG. אין כאן חישוב הבדלים: PAIRS מחזיק את התוצאה
   של diffSpec מהמחולל, ולכן הכלי והעמודים הכתובים לא יכולים לומר שני דברים שונים על אותו זוג.

   מה נשאר מהכלי הקודם בכוונה:
   - button.dopen עם data-slot ו-button.dchip עם data-slug ו-aria-pressed. בלוק המדידה מדידת ההשוואה,
     שזהה ב-100 עמודים, מזהה לפיהם את הצד ואת בחירת הדגם.
   - הבחירה ב-?d= בכתובת, ב-replaceState. גם compare_start נקרא משם.
   - bigGaps, כולל הכלל שמוריד mAh כשהוא סותר את שעות הווידאו.
   מה השתנה: שני צדדים כברירת מחדל ושלישי כשמבקשים, "משווים גם" שמחליף צד, בורר שנפתח רק כשבוחרים צד,
   "מה חשוב לכם" שמסדר ולא מסנן, והסבר לכל שדה מאחורי כפתור i שנפתח מתחת לשורה ולא בחלונית צפה.
   הסבר קבוע מתחת לכל שדה נוסה ב-24.9.2026 והוסר באותו יום: אופק אמר שהוא מציף את העין. */
/* פונקציה ולא קוד חופשי, כדי שהשומר בשורה הראשונה יוכל לצאת בלי שגיאה, ושהקובץ ייקרא גם לבד */
function pgCompareMain() {
var SIDE = ["א׳", "ב׳", "ג׳"], SC = ["cv-a", "cv-b", "cv-c"];
/* slots הוא כמה צדדים על המסך: שניים כברירת מחדל, ושלושה כשמבקשים. עד 24.9.2026 בערב הכלי החדש ידע
   רק שניים, ואופק ביקש להשאיר את האפשרות לשלושה. */
var slots = 2;
var sel = [null, null, null], DB = null, pickFor = null, on = {}, restOpen = false, lastPair = "";
var openNote = {};                    /* ההסברים שנפתחו, לפי שדה, כדי שיישארו פתוחים ברינדור מחדש */
var cur = null;                       /* הזוג שעל המסך: {ds, diff, cats} */
function $(id) { return document.getElementById(id); }
var out = $("dout"), pick = $("cvpick"), list = $("dpick"), bar = null, sug = $("cvsug"), flip = $("cvflip"),
    addBtn = $("cvadd"), c3 = $("cvc3"), vs3 = $("cvvs3"), cardsBox = document.querySelector(".cv-cards");
function onScreen() { return sel.slice(0, slots); }
/* הצדדים שיש בהם דגם, לפי מספר הצד. עד התיקון הוספת צד שלישי בלי לבחור בו העלימה את ההשוואה של
   הזוג, והמסך אמר "בחרו עוד דגם" עד שהצד הוסר. עכשיו שני צדדים מלאים מספיקים. */
function filled() { var o = []; onScreen().forEach(function (x, i) { if (dev(x)) o.push(i); }); return o; }
var sides = [];                       /* מספר הצד של כל דגם בהשוואה שעל המסך, כדי שהצבע יתאים לכרטיס */
function scOf(k) { return SC[sides[k]]; }
function namesTxt(ds) { return ds.length === 2 ? "בין " + ds[0].name + " לבין " + ds[1].name : "בין שלושה דגמים: " + ds.map(function (d) { return d.name; }).join(", "); }
if (!out || !pick || !list) return;

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function ltr(s) { return '<bdo dir="ltr">' + esc(s) + "</bdo>"; }
/* ריצה לועזית בתוך משפט עברי מקבלת כיוון משלה, אחרת "48MP, צמצם" מתהפך. הפיסוק בסוף הריצה שייך למשפט. */
var RUN = /[A-Za-z0-9ƒ][A-Za-z0-9.,:%\/+–\-ƒ]*(?:[ ]+[A-Za-z0-9ƒ][A-Za-z0-9.,:%\/+–\-ƒ]*)*/g;
function ltrRuns(raw) {
  if (raw === null || raw === undefined) return "";
  var s = String(raw), o = "", last = 0, m;
  RUN.lastIndex = 0;
  while ((m = RUN.exec(s)) !== null) {
    var run = m[0], core = run.replace(/[.,:\s]+$/, ""), tail = run.slice(core.length);
    o += esc(s.slice(last, m.index));
    o += /[A-Za-z]/.test(core) ? '<bdo dir="ltr">' + esc(core) + "</bdo>" + esc(tail) : esc(run);
    last = m.index + run.length;
  }
  return o + esc(s.slice(last));
}
function dev(sl) { if (!DB || !sl) return null; for (var i = 0; i < DB.devices.length; i++) if (DB.devices[i].slug === sl) return DB.devices[i]; return null; }
function keysFor(a, b) { var p = PAIRS[a + "|" + b] || PAIRS[b + "|" + a]; return p ? { k: p.k ? p.k.split(".").map(Number) : [], s: p.s } : null; }
function empty(v) { return v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length); }
function val(v) { return Array.isArray(v) ? v.join(", ") : String(v); }
function push(ev, d) { try { window.dataLayer = window.dataLayer || []; var o = { event: ev }; for (var k in d) o[k] = d[k]; window.dataLayer.push(o); } catch (e) {} }
function year(d) { return d && d.launch ? String(d.launch).slice(0, 4) : ""; }
var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12l5 5 9-10"></path></svg>';
var canHover = false; try { canHover = window.matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) {}

/* ---------------- עברית: אין, יחיד, זוגי ורבים */
function diffTxt(n) { return n === 1 ? "הבדל אחד" : n + " הבדלים"; }
function sameTail(n) { return n === 0 ? ", ואין שדות זהים" : n === 1 ? ", ושדה אחד זהה" : n === 2 ? ", ושני שדות זהים" : ", ו-" + n + " שדות זהים"; }

/* ---------------- ההבדלים הגדולים במספרים. אותה לוגיקה שהייתה, בלי שינוי. */
function fmtN(v, f) {
  if (f === "gb") return v >= 1024 ? (v / 1024) + "TB" : v + "GB";
  if (f === "dec") return String(Math.round(v * 100) / 100);
  return String(Math.round(v));
}
function bigGaps(ds) {
  var res = [], seen = {};
  TDEF.forEach(function (t) {
    var hi = null, lo = null;
    ds.forEach(function (d) {
      var v = (TRAITS[d.slug] || {})[t.key];
      if (v === null || v === undefined) return;
      if (hi === null || v > hi.v) hi = { v: v, d: d };
      if (lo === null || v < lo.v) lo = { v: v, d: d };
    });
    if (hi === null || lo === null || hi.d === lo.d) return;
    var gap = hi.v - lo.v;
    if (gap < t.min) return;
    res.push({ t: t, key: t.key, group: t.group, pri: t.pri, gap: gap, hi: hi, lo: lo,
      lead: t.low ? lo.d : hi.d, more: t.low ? t.lowMore : t.more, strength: gap / t.min });
  });
  res.sort(function (a, b) { return b.strength - a.strength; });
  res.forEach(function (x) { var b = seen[x.group]; if (!b || x.pri < b.pri || (x.pri === b.pri && x.strength > b.strength)) seen[x.group] = x; });
  return res.filter(function (x) {
    if (seen[x.group] !== x) return false;
    /* mAh שמצביע הפוך משעות הווידאו של אותו יצרן אינו אמירה שאפשר להגן עליה, ולכן הוא יורד */
    if (x.key !== "battery_mah") return true;
    var hi = null, lo = null;
    ds.forEach(function (d) { var v = (TRAITS[d.slug] || {}).battery_hours; if (v === null || v === undefined) return;
      if (hi === null || v > hi.v) hi = { v: v, d: d }; if (lo === null || v < lo.v) lo = { v: v, d: d }; });
    if (hi === null || lo === null || hi.d === lo.d) return true;
    return hi.d === x.lead;
  });
}
function gapChip(x) {
  var t = x.t;
  if (x.lo.v === 0 && t.zero) return t.zero + " באחד מהם";
  var r = x.hi.v / x.lo.v;
  if (x.lo.v > 0 && (r >= 2 || t.each)) { var q = r < 10 ? Math.round(r * 10) / 10 : Math.round(r); return "פי " + q; }
  return "הפרש " + fmtN(x.gap, t.fmt) + (t.fmt === "gb" ? "" : t.unit);
}
function bigNum(v, t) {
  if (v === 0 && t.zero) return '<span class="cv-big" style="font-size:1.15rem">' + esc(t.zero) + "</span>";
  var u = t.fmt === "gb" ? "" : t.unit.trim();
  return '<span class="cv-big">' + ltr(fmtN(v, t.fmt)) + (u ? "<small>" + esc(u) + "</small>" : "") + "</span>";
}
function fill(w) { return '<span class="cv-track" aria-hidden="true"><span class="cv-fill" style="width:' + Math.max(0, Math.min(100, Math.round(w))) + '%"></span></span>'; }

/* שדות שיש להם מספר בשני הצדדים באותה יחידה. המפתח בטבלה הוא שם השדה במפרט, והערך הוא המפתח ב-TRAITS. */
var BAR = CFG.bars ? { screen_size: "screen_size", weight: "weight", storage_offered: "storage_offered", battery: "battery_hours", zoom: "zoom" } : {};
function tdefOf(k) { for (var i = 0; i < TDEF.length; i++) if (TDEF[i].key === k) return TDEF[i]; return null; }
function nums(field, ds) {
  var k = BAR[field]; if (!k) return null;
  var v = ds.map(function (d) { return (TRAITS[d.slug] || {})[k]; });
  if (v.some(function (x) { return typeof x !== "number"; }) || Math.max.apply(null, v) <= 0) return null;
  return { v: v, max: Math.max.apply(null, v), min: Math.min.apply(null, v), t: tdefOf(k) };
}
/* גובה ורוחב מתוך "150.0 x 71.9 x 8.75 מ״מ". רק בצורה הזאת בדיוק, אחרת אין שרטוט. */
function dims(d) { var m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*[0-9]/.exec(val(d.spec.dimensions || "")); return m ? { h: +m[1], w: +m[2] } : null; }

/* ---------------- הכרטיסים בהדר */
/* תמונה קטנה לדגם שיש לו img בקובץ הציבורי, כלומר דגם שאנחנו מוכרים ויש לו תמונה. הנתיב נבנה
   כאן מה-slug של העמוד, ולכן הקובץ הציבורי נושא דגל ולא נתיב. alt ריק: השם כתוב לידה. */
function thumb(d) {
  if (!d || !d.img) return "";
  return '<img class="cv-img" src="/' + CFG.pageBase + "img/" + esc(CFG.specLinks ? d.slug : d.page) +
    '-288.webp" alt="" width="288" height="384" decoding="async">';
}
function renderCards() {
  [0, 1, 2].forEach(function (i) {
    var b = document.querySelector('.cv-card[data-slot="' + i + '"]'); if (!b) return;
    var d = dev(sel[i]);
    b.classList.toggle("empty", !d);
    b.setAttribute("aria-expanded", pickFor === i ? "true" : "false");
    b.innerHTML = thumb(d) + '<span class="cv-dot" aria-hidden="true"></span><span class="cv-ct">' +
      (d ? '<span class="cv-nm">' + ltr(d.name) + '</span><span class="cv-meta">' + esc(d.brand) + (year(d) ? " · הוכרז ב-" + esc(year(d)) : "") + "</span>"
         : '<span class="cv-nm">בחרו דגם</span><span class="cv-meta">צד ' + SIDE[i] + "</span>") +
      '</span><span class="cv-act">' + (d ? "החלפה" : "בחירה") + "</span>";
  });
  if (flip) flip.disabled = !(sel[0] || sel[1]);
  if (c3) c3.hidden = slots < 3;
  if (vs3) vs3.hidden = slots < 3;
  if (cardsBox) cardsBox.classList.toggle("three", slots === 3);
  /* הכפתור מופיע רק כשיש זוג: שלישי לפני שיש שניים הוא צעד שאין לו משמעות */
  if (addBtn) addBtn.hidden = !(slots < 3 && dev(sel[0]) && dev(sel[1]));
  var topSec = document.querySelector(".cv-top"); if (topSec) topSec.classList.toggle("has-pair", filled().length >= 2);
  renderSug();
}
/* "משווים גם": השוואות מוכנות שחולקות דגם אחד עם הזוג שעל המסך. הלחיצה מחליפה את הצד השני, ולא מוסיפה עמודה. */
function renderSug() {
  if (!sug) return;
  if (slots > 2 || !(sel[0] && sel[1]) || !READY.length) { sug.hidden = true; return; }
  var got = [], sig = [sel[0], sel[1]].sort().join("|");
  READY.forEach(function (p) {
    if (got.length >= 2 || [p[0], p[1]].sort().join("|") === sig) return;
    var keep = sel.indexOf(p[0]) >= 0 ? p[0] : sel.indexOf(p[1]) >= 0 ? p[1] : null;
    if (!keep) return;
    var other = keep === p[0] ? p[1] : p[0];
    if (!dev(other) || !keysFor(keep, other)) return;
    var at = sel.indexOf(keep), pair = at === 0 ? [keep, other] : [other, keep];
    got.push(pair);
  });
  if (!got.length) { sug.hidden = true; return; }
  sug.hidden = false;
  sug.innerHTML = '<span class="cv-sl">משווים גם:</span>' + got.map(function (p) {
    return '<a class="cv-sa" href="?d=' + esc(p.join(",")) + '" data-sug="' + esc(p.join(",")) + '">' + ltr(dev(p[0]).name) + " מול " + ltr(dev(p[1]).name) + "</a>";
  }).join("");
}

/* ---------------- הבורר */
var autoClick = false;
function openPick(i, focusIt) {
  pickFor = i;
  pick.hidden = false;
  var h = $("cvpick-h"), d = dev(sel[i]);
  if (h) h.innerHTML = '<span class="cv-dot" aria-hidden="true" style="background:var(--' + SC[i] + ')"></span>' +
    (d ? "החלפת " + ltr(d.name) : "בחירת דגם לצד " + SIDE[i]);
  syncChips();
  renderCards();
  if (focusIt) {
    var q = $("dq");
    if (canHover && q) q.focus(); else if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    try { var r = pick.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * 0.6) pick.scrollIntoView({ block: "start" }); } catch (e) {}
  }
}
/* אחרי שנוצרה השוואה הפוקוס עובר לשורת הספירה, שהיא התשובה לפעולה. בלי זה הבורר נסגר עם הצ'יפ
   הממוקד בתוכו, או שהקישור של "משווים גם" נבנה מחדש, והפוקוס נפל ל-body. */
function focusResult() { var c = out.querySelector(".cv-count"); if (!c) return; c.setAttribute("tabindex", "-1"); try { c.focus({ preventScroll: true }); } catch (e) { c.focus(); } }
function closePick(back) {
  var i = pickFor; pickFor = null; pick.hidden = true; renderCards();
  if (back && i !== null) { var b = document.querySelector('.cv-card[data-slot="' + i + '"]'); if (b) b.focus(); }
}
function syncChips() {
  Array.prototype.forEach.call(list.querySelectorAll(".dchip"), function (c) {
    var s = c.getAttribute("data-slug");
    c.setAttribute("aria-pressed", pickFor !== null && sel[pickFor] === s ? "true" : "false");
    c.classList.toggle("side0", sel[0] === s);
    c.classList.toggle("side1", sel[1] === s);
    c.classList.toggle("side2", slots > 2 && sel[2] === s);
  });
}
/* בלוק המדידה זוכר את הצד לפי הלחיצה האחרונה על button.dopen. כשהבורר עובר לצד ב׳ מעצמו, הלחיצה הזאת
   נשלחת כדי שהמדידה תדע, והמטפל כאן מתעלם ממנה. */
function tellSide(i) {
  var b = document.querySelector('.cv-card[data-slot="' + i + '"]'); if (!b) return;
  autoClick = true; try { b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } catch (e) {} autoClick = false;
}
document.addEventListener("click", function (e) {
  var t = e.target; if (!t || !t.closest) return;
  var card = t.closest(".cv-card");
  if (card) {
    if (autoClick) return;
    var i = +card.getAttribute("data-slot");
    if (pickFor === i) closePick(true); else { openPick(i, true); push("cmp_menu_open", { slot: i }); }
    return;
  }
  if (t.closest(".cv-x")) { closePick(true); return; }
  var chip = t.closest(".dchip");
  if (chip && pickFor !== null && DB) {
    var i2 = pickFor, s = chip.getAttribute("data-slug"), was = filled().length >= 2, at = onScreen().indexOf(s);
    if (sel[i2] === s) sel[i2] = null;
    /* הדגם כבר בצד אחר: מחליפים מקומות, ולא מאבדים את מי שישב בצד שנבחר */
    else if (at >= 0) { sel[at] = sel[i2]; sel[i2] = s; }
    else sel[i2] = s;
    push("cmp_pick", { device: s, slot: i2, selected: onScreen().filter(Boolean).length });
    var nxt = -1; for (var k = 0; k < slots; k++) if (!sel[k]) { nxt = k; break; }
    if (sel[i2] && nxt >= 0) { tellSide(nxt); clearFilter(); openPick(nxt, true); }
    else if (sel[i2]) closePick(false);
    else openPick(i2, false);
    render();
    if (!was && filled().length >= 2) { if (pickFor === null) focusResult(); toResults(); }
    return;
  }
  if (addBtn && t.closest("#cvadd")) {
    slots = 3; push("cmp_add_slot", {});
    render(); tellSide(2); openPick(2, true); return;
  }
  if (t.closest("#cvdrop")) {
    sel[2] = null; slots = 2; push("cmp_drop_slot", {});
    if (pickFor === 2) closePick(false);
    render();
    if (addBtn && !addBtn.hidden) addBtn.focus();
    else { var fe = document.querySelector('.cv-card.empty') || document.querySelector('.cv-card[data-slot="0"]'); if (fe) fe.focus(); }
    return;
  }
  if (flip && t.closest("#cvflip")) {
    sel = [sel[1], sel[0], sel[2]]; push("cmp_flip", {});
    if (pickFor === 0 || pickFor === 1) { pickFor = 1 - pickFor; tellSide(pickFor); }
    if (pickFor !== null) openPick(pickFor, false);
    render(); return;
  }
  var sg = t.closest("[data-sug]");
  if (sg) {
    e.preventDefault();
    var pr = sg.getAttribute("data-sug").split(",");
    if (dev(pr[0]) && dev(pr[1])) {
      sel = [pr[0], pr[1], null]; slots = 2; push("cmp_suggest", { pair: pr.join(",") });
      /* בלוק המדידה מחשב compare_start רק אחרי לחיצה על צ'יפ, ולכן הכניסה הזאת לא נספרה בכלל */
      push("compare_start", { event_category: "engagement", page_path: location.pathname, model_a: pr[0], model_b: pr[1], models: pr.join(","), model_count: 2 });
      closePick(false); render(); focusResult(); toResults();
    }
    return;
  }
  if (pickFor !== null && !t.closest("#cvpick") && !t.closest(".cv-card") && !t.closest("#cvadd")) closePick(false);
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || pickFor === null || e.defaultPrevented) return;
  var a = document.activeElement;
  if (!(pick.contains(a) || (a && a.closest && a.closest(".cv-cards")))) return;
  closePick(true);
});

/* סינון. הקבוצה כולה נעלמת כשאין בה התאמה, אחרת נשארות כותרות מותג בלי תוכן. */
var q = $("dq"), noneEl = $("dnone"), qh = $("dqh"), qUsed = false, qhT = 0;
function applyFilter() {
  if (!q) return;
  var s = q.value.trim().toLowerCase(), shown = 0;
  Array.prototype.forEach.call(list.querySelectorAll(".dgrp"), function (g) {
    var vis = 0;
    Array.prototype.forEach.call(g.querySelectorAll("li"), function (li) {
      var c = li.querySelector(".dchip"); if (!c) return;
      var hit = !s || (c.getAttribute("data-q") || "").toLowerCase().indexOf(s) >= 0;
      li.hidden = !hit; if (hit) vis++;
    });
    g.hidden = !vis; shown += vis;
  });
  if (noneEl) noneEl.hidden = shown > 0;
  if (qh) { clearTimeout(qhT); var msg = !s ? "" : (shown ? shown + " דגמים מוצגים" : "אין דגם מתאים"); qhT = setTimeout(function () { qh.textContent = msg; }, 500); }
}
/* כשהבורר עובר לצד הבא החיפוש הקודם כבר לא רלוונטי */
function clearFilter() { if (q && q.value) { q.value = ""; applyFilter(); } }
if (q) q.addEventListener("input", function () { if (!qUsed && q.value.trim()) { qUsed = true; push("cmp_filter", {}); } applyFilter(); });

/* ---------------- הכתובת */
function syncURL() { try { var L = onScreen().filter(Boolean); history.replaceState(null, "", L.length ? "?d=" + L.join(",") : location.pathname); } catch (e) {} }
function fromURL() {
  try { var m = /[?&]d=([^&]+)/.exec(location.search); if (!m) return [];
    return decodeURIComponent(m[1]).split(",").filter(function (s) { return !!dev(s); })
      .filter(function (s, i, a) { return a.indexOf(s) === i; }).slice(0, 3);
  } catch (e) { return []; }
}

/* ---------------- ההיצמדות: הפס הלבן נדבק מתחת להדר של האתר, שגובהו משתנה לפי רוחב, באנר ותפריט נגישות */
function stick() {
  try {
    var h = document.querySelector("header.site"), base = 0;
    if (h) { var cs = getComputedStyle(h); if (cs.position === "sticky" || cs.position === "fixed") base = Math.max(0, h.getBoundingClientRect().bottom); }
    document.documentElement.style.setProperty("--pg-stick-1", Math.round(base) + "px");
    var bh = bar && !bar.hidden ? bar.offsetHeight : 0;
    document.documentElement.style.setProperty("--pg-stick-2", Math.round(base + bh) + "px");
  } catch (e) {}
}
var stickQ = false;
function stickSoon() { if (stickQ) return; stickQ = true; var run = function () { stickQ = false; stick(); }; if (window.requestAnimationFrame) requestAnimationFrame(run); setTimeout(run, 100); }
window.addEventListener("resize", stickSoon);
window.addEventListener("scroll", stickSoon, { passive: true });
(function () { var h = document.querySelector("header.site"); if (h) h.addEventListener("transitionend", function (e) { if (e.propertyName === "transform") stick(); }); })();
try { if (window.MutationObserver) new MutationObserver(stick).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(stick).catch(function () {}); } catch (e) {}
stick();
function toResults() {
  try { var off = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pg-stick-2")) || 0;
    window.scrollTo({ top: out.getBoundingClientRect().top + window.scrollY - off - 16 }); } catch (e) {}
}

/* ---------------- התוצאה */
function render() {
  renderCards(); syncURL();
  sides = filled();
  var ds = sides.map(function (i) { return dev(sel[i]); });
  if (ds.length < 2) {
    cur = null; bar = null; stick();
    out.innerHTML = '<p class="dempty">' + (ds.length ? "בחרו עוד דגם, ותראו כאן את ההבדלים ביניהם." : "בחרו שני דגמים, ותראו כאן את ההבדלים ביניהם.") + "</p>";
    return;
  }
  /* שדה שונה בין שלושה אם ורק אם הוא שונה באחד הזוגות. איחוד, לא חישוב חדש. */
  var set = {}, missingPair = false, pairSame = null;
  for (var i = 0; i < ds.length; i++) for (var j = i + 1; j < ds.length; j++) {
    var p = keysFor(ds[i].slug, ds[j].slug);
    if (!p) { missingPair = true; continue; }
    p.k.forEach(function (ix) { set[ix] = 1; });
    if (ds.length === 2) pairSame = p.s;
  }
  if (missingPair) { cur = null; bar = null; stick(); out.innerHTML = '<p class="dempty">' + CFG.pairErr + "</p>"; return; }
  var diff = ORDER.filter(function (r, ix) { return set[ix]; });
  var cats = []; diff.forEach(function (r) { if (cats.indexOf(r[0]) < 0) cats.push(r[0]); });
  Object.keys(on).forEach(function (c) { if (cats.indexOf(c) < 0) delete on[c]; });
  /* מה שזהה: שדות שאינם בהבדלים ושיש להם ערך בשני הצדדים. רק כשהספירה מסכימה עם המחולל מוצגות התגיות. */
  var same = ORDER.filter(function (r, ix) { return !set[ix] && ds.every(function (d) { return !empty(d.spec[r[2]]); }); });
  /* בזוג המספר מגיע מהמחולל. בשלושה אין מספר כזה, והרשימה עצמה היא הספירה. */
  var sameN = pairSame === null ? same.length : pairSame;
  cur = { ds: ds, diff: diff, cats: cats };

  /* כותרת העמודות: דביקה מעל התחומים, וכל שם יושב מעל העמודה שלו. aria-hidden, כי קורא מסך מקבל
     את שם הדגם בתוך כל תא, ולא צריך לשמוע אותו גם כאן. */
  var colHead = '<div class="cv-bar" id="cvbar" aria-hidden="true"><div class="cv-bi' + (ds.length === 3 ? " n3" : "") + '"><span class="cv-bc">' + diffTxt(diff.length) + "</span>" +
    ds.map(function (d, i) { return '<span class="cv-bn ' + scOf(i) + '"><span class="cv-dot"></span>' + ltr(d.name) + "</span>"; }).join("") + "</div></div>";

  var refs = ds.filter(function (d) { return d.own === false; });
  var disc = refs.length ? '<p class="dnote">את ' + refs.map(function (d) { return esc(d.name_he || d.name); }).join(" ואת ") + " איננו מוכרים, " +
    (refs.length === 1 ? "והוא כאן כדי שאפשר יהיה להשוות אליו" : "והם כאן כדי שאפשר יהיה להשוות אליהם") + ".</p>" : "";

  var sameHtml = "";
  if (same.length === sameN && same.length) {
    var tags = same.map(function (r) { var v = val(ds[0].spec[r[2]]); return v.length <= 22 ? r[1] + ": " + v : r[1]; });
    var shown = tags.slice(0, 5);
    sameHtml = '<ul class="cv-same" aria-label="' + (ds.length === 2 ? "זהים בשניהם" : "זהים בשלושתם") + '">' + shown.map(function (t) { return "<li>" + CHECK + ltrRuns(t) + "</li>"; }).join("") +
      (tags.length > shown.length ? "<li>ועוד " + (tags.length - shown.length) + "</li>" : "") + "</ul>";
  }
  var head = '<p class="cv-count">' + diffTxt(diff.length) + sameTail(sameN) + "</p>" + sameHtml +
    '<p class="cv-src">' + esc(CFG.src) + "</p>";

  var top = "";
  if (TDEF.length) {
    var gaps = bigGaps(ds).slice(0, 3);
    if (gaps.length) {
      top = '<h2 class="cv-h2">ההבדלים הגדולים במספרים</h2><ul class="cv-top3' + (gaps.length < 3 ? ' n' + gaps.length : '') + '">' + gaps.map(function (x) {
        var t = x.t, vs = ds.map(function (d) { var v = (TRAITS[d.slug] || {})[x.key]; return typeof v === "number" ? v : null; });
        var mx = Math.max.apply(null, vs.filter(function (v) { return v !== null; })) || 1;
        return '<li class="cv-t"><div class="cv-th"><b>' + esc(t.label) + '</b><span class="cv-gap">' + ltrRuns(gapChip(x)) + "</span></div>" +
          '<div class="cv-tv' + (ds.length === 3 ? " n3" : "") + '">' + ds.map(function (d, i) {
            return '<div class="' + scOf(i) + '">' + (vs[i] === null ? '<span class="cv-na">לא מפורסם</span>' : bigNum(vs[i], t) + fill(100 * vs[i] / mx)) + '<span class="cv-tn">' + ltr(d.name) + "</span></div>";
          }).join("") + "</div>" +
          '<p class="cv-lead">' + ltr(x.lead.name) + ": " + esc(x.more) + "</p></li>";
      }).join("") + "</ul>";
    }
  }

  var anyBar = diff.some(function (r) { return !!nums(r[2], ds); });
  var prio = '<div class="cv-prio"><h2 class="cv-h2">מה חשוב לכם?</h2><p>בחרו תחום, והוא יעלה לראש הרשימה. שום הבדל לא נעלם.</p>' +
    '<div class="cv-chips">' + cats.map(function (c) {
      var n = diff.filter(function (r) { return r[0] === c; }).length;
      return '<button type="button" class="cv-chip" data-cat="' + esc(c) + '" aria-pressed="' + (on[c] ? "true" : "false") + '">' + CHECK + esc(c) + " <span>" + n + "</span></button>";
    }).join("") + '</div><p class="cv-status" id="cvstatus" role="status" aria-live="polite"></p></div>' +
    (anyBar ? '<p class="cv-legend">קו ארוך יותר הוא מספר גדול יותר, לא בהכרח טוב יותר.</p>' : "");

  var links = ds.filter(function (d) { return CFG.specLinks ? d.own !== false : !!d.page; }).map(function (d) {
    return '<a href="/' + CFG.pageBase + esc(CFG.specLinks ? d.slug : d.page) + '/">המפרט המלא של ' + esc(d.name_he || d.name) + "</a>";
  }).join(" · ");

  out.innerHTML = disc + head + top + prio + '<div class="cv-table">' + colHead + '<div id="cvlist"></div></div>' +
    (links ? '<p class="cv-more">' + links + "</p>" : "") +
    '<div class="cv-wa"><div class="cv-wt"><b>רוצים שנעבור על זה איתכם?</b><span>ההודעה כבר מוכנה עם הדגמים, ותחום שתסמנו ב"מה חשוב לכם" ייכנס אליה. אפשר לערוך אותה לפני השליחה.</span>' +
    '<span class="cv-bubble" id="cvwatext"></span></div><div class="cv-wb">' +
    '<a class="btn btn-wa" id="cvwa" href="#"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">שליחה ב-WhatsApp</a>' +
    '<button type="button" class="btn btn-teal" id="dcopy">העתקת קישור להשוואה</button><span class="dok" id="dcopied" role="status"></span></div></div>';
  bar = $("cvbar"); stick();
  var sig = ds.map(function (d) { return d.slug; }).sort().join(",");
  if (sig !== lastPair) { lastPair = sig; restOpen = false; }
  renderList(false);
}

function rowHtml(r, ds) {
  var n = nums(r[2], ds), small = "";
  if (n && n.t && n.max - n.min > 0 && n.max - n.min < n.t.min) small = '<span class="cv-small">הבדל קטן</span>';
  var cell = function (d, i) {
    var raw = d.spec[r[2]], v;
    if (empty(raw)) v = '<span class="cv-na">לא מפורסם אצל היצרן</span>';
    else if (Array.isArray(raw)) v = '<span class="cv-val">' + raw.map(function (x) { return '<span class="vch">' + ltrRuns(x) + "</span>"; }).join("") + "</span>";
    else v = '<span class="cv-val">' + ltrRuns(raw) + "</span>";
    return '<div class="cv-v ' + scOf(i) + '"><span class="a11y-sr">' + esc(d.name) + ": </span>" + v +
      (n ? fill(100 * n.v[i] / n.max) : "") + "</div>";
  };
  var mean = MEANS[r[2]], mid = "m-" + r[2], open = !!openNote[r[2]];
  return '<div class="cv-r' + (ds.length === 3 ? " n3" : "") + '"><div class="cv-rl"><span>' + esc(r[1]) + "</span>" +
    (mean ? '<button type="button" class="cv-i" data-mean="' + esc(r[2]) + '" aria-expanded="' + (open ? "true" : "false") + '" aria-controls="' + mid + '" aria-label="מה זה ' + esc(r[1]) + '">i</button>' : "") +
    (small ? '<span class="cv-small">הבדל קטן</span>' : "") + "</div>" + ds.map(cell).join("") +
    (mean ? '<p class="cv-note" id="' + mid + '"' + (open ? "" : " hidden") + "><b>מה זה אומר</b> " + esc(mean) + "</p>" : "") + "</div>";
}
function sizeHtml(ds) {
  if (!CFG.outline) return "";
  var dd = ds.map(dims); if (dd.some(function (x) { return !x; })) return "";
  var fig = function (x, i) { return '<figure class="' + scOf(i) + '"><span class="cv-ol" aria-hidden="true" style="width:' + x.w + "px;height:" + x.h + 'px"></span><figcaption>' + ltr(x.h + " × " + x.w) + " מ״מ</figcaption></figure>"; };
  return '<div class="cv-size">' + dd.map(fig).join("") + "<p>" + (dd.length === 2 ? "שניהם" : "שלושתם") + " באותו קנה מידה, גובה ורוחב בלי עובי. מה שמורגש ביד הוא בעיקר המשקל והעובי.</p></div>";
}
function renderList(fromChip) {
  if (!cur) return;
  var ds = cur.ds, diff = cur.diff, cats = cur.cats;
  var picked = cats.filter(function (c) { return on[c]; }), others = cats.filter(function (c) { return !on[c]; });
  var order = picked.length ? picked.concat(restOpen ? others : []) : cats;
  var restN = 0; others.forEach(function (c) { restN += diff.filter(function (r) { return r[0] === c; }).length; });
  var html = order.map(function (c) {
    var rows = diff.filter(function (r) { return r[0] === c; });
    var hasDim = rows.some(function (r) { return r[2] === "dimensions"; });
    return '<section class="cv-grp" aria-labelledby="g-' + cats.indexOf(c) + '"><div class="cv-gh"><h3 id="g-' + cats.indexOf(c) + '">' + esc(c) + "</h3><span>" + diffTxt(rows.length) + "</span>" +
      (on[c] ? '<span class="cv-pk">בחרתם</span>' : "") + "</div>" + (hasDim ? sizeHtml(ds) : "") + rows.map(function (r) { return rowHtml(r, ds); }).join("") + "</section>";
  }).join("");
  if (picked.length && restN) html += '<button type="button" class="cv-rest" aria-expanded="' + (restOpen ? "true" : "false") + '">' + (restOpen ? "לקפל את שאר התחומים" : "עוד " + diffTxt(restN) + " בתחומים שלא בחרתם") + "</button>";
  $("cvlist").innerHTML = html;
  Array.prototype.forEach.call(out.querySelectorAll(".cv-chip"), function (b) { b.setAttribute("aria-pressed", on[b.getAttribute("data-cat")] ? "true" : "false"); });
  var st = $("cvstatus");
  if (st) st.textContent = !picked.length ? (diff.length === 1 ? "מוצג ההבדל היחיד." : "מוצגים כל " + diff.length + " ההבדלים, לפי תחום.")
    : "בראש הרשימה: " + picked.join(", ") + "." + (restN ? " עוד " + diffTxt(restN) + " בתחומים האחרים." : " אלה כל ההבדלים.");
  var msg = "היי, אשמח לעזרה בבחירה " + namesTxt(ds) + "." + (picked.length ? " חשוב לי: " + picked.join(", ") + "." : "");
  var wt = $("cvwatext"), wa = $("cvwa");
  if (wt) wt.textContent = msg;
  if (wa) wa.setAttribute("href", "https://wa.me/97286812050?text=" + encodeURIComponent(msg));
}
out.addEventListener("click", function (e) {
  var t = e.target; if (!t || !t.closest) return;
  /* פתיחה וסגירה במקום, בלי רינדור מחדש, כדי שהפוקוס יישאר על הכפתור */
  var ib = t.closest(".cv-i");
  if (ib) {
    var key = ib.getAttribute("data-mean"), note = $("m-" + key), opening = ib.getAttribute("aria-expanded") !== "true";
    if (opening) openNote[key] = 1; else delete openNote[key];
    ib.setAttribute("aria-expanded", opening ? "true" : "false");
    if (note) note.hidden = !opening;
    if (opening) push("cmp_explain", { field: key });
    return;
  }
  var c = t.closest(".cv-chip");
  if (c) { var k = c.getAttribute("data-cat"); on[k] = !on[k]; if (!on[k]) delete on[k]; if (!Object.keys(on).length) restOpen = false; push("cmp_priority", { category: k, on: !!on[k] }); renderList(true); return; }
  if (t.closest(".cv-rest")) { restOpen = !restOpen; push("cmp_rest", { open: restOpen }); renderList(true); var rb = out.querySelector(".cv-rest"); if (rb) rb.focus(); return; }
  if (t.closest("#cvwa")) { push("cmp_share_whatsapp", { devices: onScreen().filter(Boolean).join(","), priorities: Object.keys(on).join(",") }); return; }
  if (t.closest("#dcopy")) {
    push("cmp_copy_link", { devices: onScreen().filter(Boolean).join(",") });
    var note = $("dcopied"), url = location.href;
    var done = function () { if (note) note.textContent = "הקישור הועתק"; };
    var fail = function () { if (note) note.textContent = "לא הצלחנו להעתיק. אפשר להעתיק מהכתובת למעלה."; };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fail); else fail(); } catch (err) { fail(); }
  }
});

/* הקובץ הציבורי ולא הנתונים המלאים: הוא מחזיק רק את השדות שהכלי קורא */
fetch(CFG.pub, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
  DB = d;
  var pre = fromURL();
  sel = [pre[0] || null, pre[1] || null, pre[2] || null];
  slots = pre.length > 2 ? 3 : 2;
  if (!sel[0]) openPick(0, false); else if (!sel[1]) { tellSide(1); openPick(1, false); }
  render();
}).catch(function () { out.innerHTML = '<p class="dempty">' + CFG.loadErr + "</p>"; });
}
