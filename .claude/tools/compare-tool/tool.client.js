/* כלי ההשוואה, גרסה ח׳ (24.9.2026). הקוד הזה רץ בדפדפן. gen-compare.js עוטף אותו בפונקציה ומזריק לפניו
   את הנתונים: PAIRS, ORDER, TRAITS, TDEF, MEANS, READY ו-CFG. אין כאן חישוב הבדלים: PAIRS מחזיק את התוצאה
   של diffSpec מהמחולל, ולכן הכלי והעמודים הכתובים לא יכולים לומר שני דברים שונים על אותו זוג.

   מה נשאר מהכלי הקודם בכוונה:
   - button.dopen עם data-slot ו-button.dchip עם data-slug ו-aria-pressed. בלוק המדידה מדידת ההשוואה,
     שזהה ב-100 עמודים, מזהה לפיהם את הצד ואת בחירת הדגם.
   - הבחירה ב-?d= בכתובת, ב-replaceState. גם compare_start נקרא משם.
   - bigGaps, כולל הכלל שמוריד mAh כשהוא סותר את שעות הווידאו.
   מה השתנה: שני צדדים בלבד (מנהל המוצר: "+" מחליף ולא מוסיף עמודה), בורר שנפתח רק כשבוחרים צד,
   "מה חשוב לכם" שמסדר ולא מסנן, והסבר קבוע מתחת לכל שדה במקום חלונית. */
/* פונקציה ולא קוד חופשי, כדי שהשומר בשורה הראשונה יוכל לצאת בלי שגיאה, ושהקובץ ייקרא גם לבד */
function pgCompareMain() {
var SIDE = ["א׳", "ב׳"];
var sel = [null, null], DB = null, pickFor = null, on = {}, restOpen = false, lastPair = "";
var cur = null;                       /* הזוג שעל המסך: {ds, diff, cats} */
function $(id) { return document.getElementById(id); }
var out = $("dout"), pick = $("cvpick"), list = $("dpick"), bar = $("cvbar"), sug = $("cvsug"), flip = $("cvflip");
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
  if (x.lo.v > 0 && r >= 2) { var q = r < 10 ? Math.round(r * 10) / 10 : Math.round(r); return "פי " + q; }
  return "הפרש " + fmtN(x.gap, t.fmt) + (t.fmt === "gb" ? "" : t.unit);
}
function bigNum(v, t) {
  if (v === 0 && t.zero) return '<span class="cv-big" style="font-size:1.15rem">' + esc(t.zero) + "</span>";
  var u = t.fmt === "gb" ? "" : t.unit.trim();
  return '<span class="cv-big">' + ltr(fmtN(v, t.fmt)) + (u ? "<small>" + esc(u) + "</small>" : "") + "</span>";
}
function fill(w) { return '<span class="cv-track"><span class="cv-fill" style="width:' + Math.max(0, Math.min(100, Math.round(w))) + '%"></span></span>'; }

/* שדות שיש להם מספר בשני הצדדים באותה יחידה. המפתח בטבלה הוא שם השדה במפרט, והערך הוא המפתח ב-TRAITS. */
var BAR = CFG.bars ? { screen_size: "screen_size", weight: "weight", storage_offered: "storage_offered", battery: "battery_hours", zoom: "zoom" } : {};
function tdefOf(k) { for (var i = 0; i < TDEF.length; i++) if (TDEF[i].key === k) return TDEF[i]; return null; }
function nums(field, ds) {
  var k = BAR[field]; if (!k) return null;
  var a = (TRAITS[ds[0].slug] || {})[k], b = (TRAITS[ds[1].slug] || {})[k];
  if (typeof a !== "number" || typeof b !== "number" || Math.max(a, b) <= 0) return null;
  return { a: a, b: b, t: tdefOf(k) };
}
/* גובה ורוחב מתוך "150.0 x 71.9 x 8.75 מ״מ". רק בצורה הזאת בדיוק, אחרת אין שרטוט. */
function dims(d) { var m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*[0-9]/.exec(val(d.spec.dimensions || "")); return m ? { h: +m[1], w: +m[2] } : null; }

/* ---------------- הכרטיסים בהדר */
function renderCards() {
  [0, 1].forEach(function (i) {
    var b = document.querySelector('.cv-card[data-slot="' + i + '"]'); if (!b) return;
    var d = dev(sel[i]);
    b.classList.toggle("empty", !d);
    b.setAttribute("aria-expanded", pickFor === i ? "true" : "false");
    b.innerHTML = '<span class="cv-dot" aria-hidden="true"></span><span class="cv-ct">' +
      (d ? '<span class="cv-nm">' + ltr(d.name) + '</span><span class="cv-meta">' + esc(d.brand) + (year(d) ? " · הוכרז ב-" + year(d) : "") + "</span>"
         : '<span class="cv-nm">בחרו דגם</span><span class="cv-meta">צד ' + SIDE[i] + "</span>") +
      '</span><span class="cv-act">' + (d ? "החלפה" : "בחירה") + "</span>";
  });
  if (flip) flip.disabled = !(sel[0] || sel[1]);
  var topSec = document.querySelector(".cv-top"); if (topSec) topSec.classList.toggle("has-pair", !!(dev(sel[0]) && dev(sel[1])));
  renderSug();
}
/* "משווים גם": השוואות מוכנות שחולקות דגם אחד עם הזוג שעל המסך. הלחיצה מחליפה את הצד השני, ולא מוסיפה עמודה. */
function renderSug() {
  if (!sug) return;
  if (!(sel[0] && sel[1]) || !READY.length) { sug.hidden = true; return; }
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
  if (h) h.innerHTML = '<span class="cv-dot" aria-hidden="true" style="background:' + (i ? "var(--cv-b)" : "var(--cv-a)") + '"></span>' +
    (d ? "החלפת " + ltr(d.name) : "בחירת דגם לצד " + SIDE[i]);
  syncChips();
  renderCards();
  if (focusIt) {
    var q = $("dq");
    if (canHover && q) q.focus(); else if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    try { var r = pick.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * 0.6) pick.scrollIntoView({ block: "start" }); } catch (e) {}
  }
}
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
    var i2 = pickFor, s = chip.getAttribute("data-slug"), o = 1 - i2, was = !!(sel[0] && sel[1]);
    if (sel[i2] === s) sel[i2] = null;
    else if (sel[o] === s) { sel[o] = sel[i2]; sel[i2] = s; }
    else sel[i2] = s;
    push("cmp_pick", { device: s, slot: i2, selected: (sel[0] ? 1 : 0) + (sel[1] ? 1 : 0) });
    if (sel[i2] && !sel[o]) { tellSide(o); openPick(o, true); }
    else if (sel[i2]) closePick(false);
    else openPick(i2, false);
    render();
    if (!was && sel[0] && sel[1]) toResults();
    return;
  }
  if (flip && t.closest("#cvflip")) {
    sel = [sel[1], sel[0]]; push("cmp_flip", {});
    if (pickFor !== null) openPick(pickFor, false);
    render(); return;
  }
  var sg = t.closest("[data-sug]");
  if (sg) {
    e.preventDefault();
    var pr = sg.getAttribute("data-sug").split(",");
    if (dev(pr[0]) && dev(pr[1])) { sel = [pr[0], pr[1]]; push("cmp_suggest", { pair: pr.join(",") }); closePick(false); render(); toResults(); }
    return;
  }
  if (pickFor !== null && !t.closest("#cvpick") && !t.closest(".cv-card")) closePick(false);
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && pickFor !== null) closePick(true); });

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
if (q) q.addEventListener("input", function () { if (!qUsed && q.value.trim()) { qUsed = true; push("cmp_filter", {}); } applyFilter(); });

/* ---------------- הכתובת */
function syncURL() { try { var L = sel.filter(Boolean); history.replaceState(null, "", L.length ? "?d=" + L.join(",") : location.pathname); } catch (e) {} }
function fromURL() {
  try { var m = /[?&]d=([^&]+)/.exec(location.search); if (!m) return [];
    return decodeURIComponent(m[1]).split(",").filter(function (s) { return !!dev(s); })
      .filter(function (s, i, a) { return a.indexOf(s) === i; }).slice(0, 2);
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
  var ds = [dev(sel[0]), dev(sel[1])];
  if (!ds[0] || !ds[1]) {
    cur = null; if (bar) bar.hidden = true; stick();
    out.innerHTML = '<p class="dempty">' + (ds[0] || ds[1] ? "בחרו עוד דגם, ותראו כאן את ההבדלים ביניהם." : "בחרו שני דגמים, ותראו כאן את ההבדלים ביניהם.") + "</p>";
    return;
  }
  var p = keysFor(ds[0].slug, ds[1].slug);
  if (!p) { cur = null; if (bar) bar.hidden = true; out.innerHTML = '<p class="dempty">' + CFG.pairErr + "</p>"; return; }
  var set = {}; p.k.forEach(function (ix) { set[ix] = 1; });
  var diff = ORDER.filter(function (r, ix) { return set[ix]; });
  var cats = []; diff.forEach(function (r) { if (cats.indexOf(r[0]) < 0) cats.push(r[0]); });
  Object.keys(on).forEach(function (c) { if (cats.indexOf(c) < 0) delete on[c]; });
  /* מה שזהה: שדות שאינם בהבדלים ושיש להם ערך בשני הצדדים. רק כשהספירה מסכימה עם המחולל מוצגות התגיות. */
  var same = ORDER.filter(function (r, ix) { return !set[ix] && !empty(ds[0].spec[r[2]]) && !empty(ds[1].spec[r[2]]); });
  var sameN = p.s;
  cur = { ds: ds, diff: diff, cats: cats };

  if (bar) {
    bar.hidden = false;
    bar.innerHTML = '<div class="wrap cv-bi"><span class="cv-bn cv-a"><span class="cv-dot" aria-hidden="true"></span>' + ltr(ds[0].name) + '</span><span class="cv-vs">מול</span>' +
      '<span class="cv-bn cv-b"><span class="cv-dot" aria-hidden="true"></span>' + ltr(ds[1].name) + '</span><span class="cv-bc">' + diffTxt(diff.length) + "</span></div>";
  }
  stick();

  var refs = ds.filter(function (d) { return d.own === false; });
  var disc = refs.length ? '<p class="dnote">את ' + refs.map(function (d) { return esc(d.name_he || d.name); }).join(" ואת ") + " איננו מוכרים, " +
    (refs.length === 1 ? "והוא כאן כדי שאפשר יהיה להשוות אליו" : "והם כאן כדי שאפשר יהיה להשוות אליהם") + ". את המפרט לקחנו מאתר היצרן.</p>" : "";

  var sameHtml = "";
  if (same.length === sameN && same.length) {
    var tags = same.map(function (r) { var v = val(ds[0].spec[r[2]]); return v.length <= 22 ? r[1] + ": " + v : r[1]; });
    var shown = tags.slice(0, 5);
    sameHtml = '<ul class="cv-same" aria-label="זהים בשניהם">' + shown.map(function (t) { return "<li>" + CHECK + ltrRuns(t) + "</li>"; }).join("") +
      (tags.length > shown.length ? "<li>ועוד " + (tags.length - shown.length) + "</li>" : "") + "</ul>";
  }
  var head = '<p class="cv-count">' + diffTxt(diff.length) + sameTail(sameN) + "</p>" + sameHtml +
    '<p class="cv-src">' + esc(CFG.src) + "</p>";

  var top = "";
  if (TDEF.length) {
    var gaps = bigGaps(ds).slice(0, 3);
    if (gaps.length) {
      top = '<h2 class="cv-h2">ההבדלים הגדולים במספרים</h2><ul class="cv-top3 n' + gaps.length + '">' + gaps.map(function (x) {
        var t = x.t, va = (TRAITS[ds[0].slug] || {})[x.key], vb = (TRAITS[ds[1].slug] || {})[x.key], mx = Math.max(va, vb) || 1;
        return '<li class="cv-t"><div class="cv-th"><b>' + esc(t.label) + '</b><span class="cv-gap">' + ltrRuns(gapChip(x)) + "</span></div>" +
          '<div class="cv-tv"><div class="cv-a">' + bigNum(va, t) + fill(100 * va / mx) + '<span class="cv-tn">' + ltr(ds[0].name) + "</span></div>" +
          '<div class="cv-b">' + bigNum(vb, t) + fill(100 * vb / mx) + '<span class="cv-tn">' + ltr(ds[1].name) + "</span></div></div>" +
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
    (anyBar ? '<div class="cv-legend"><span class="cv-k cv-a"><i aria-hidden="true"></i>' + ltr(ds[0].name) + '</span><span class="cv-k cv-b"><i aria-hidden="true"></i>' + ltr(ds[1].name) +
      "</span><span>קו ארוך יותר הוא מספר גדול יותר, לא בהכרח טוב יותר.</span></div>" : "");

  var links = CFG.specLinks ? ds.filter(function (d) { return d.own !== false; }).map(function (d) {
    return '<a href="/phones/' + esc(d.slug) + '/">המפרט המלא של ' + esc(d.name_he || d.name) + "</a>";
  }).join(" · ") : "";

  out.innerHTML = disc + head + top + prio + '<div id="cvlist"></div>' +
    (links ? '<p class="cv-more">' + links + "</p>" : "") +
    '<div class="cv-wa"><div class="cv-wt"><b>רוצים שנעבור על זה איתכם?</b><span>ההודעה כבר מוכנה, עם הזוג ומה שסימנתם. אפשר לערוך אותה לפני השליחה.</span>' +
    '<span class="cv-bubble" id="cvwatext"></span></div><div class="cv-wb">' +
    '<a class="btn btn-wa" id="cvwa" href="#"><img class="wa-ico" src="/whatsapp-logo.png" alt="" width="26" height="26" loading="lazy" decoding="async">שליחה ב-WhatsApp</a>' +
    '<button type="button" class="btn btn-teal" id="dcopy">העתקת קישור להשוואה</button><span class="dok" id="dcopied" role="status"></span></div></div>';
  renderList(false);
  var sig = [ds[0].slug, ds[1].slug].sort().join(",");
  if (sig !== lastPair) { lastPair = sig; restOpen = false; }
}

function rowHtml(r, ds) {
  var n = nums(r[2], ds), small = "";
  if (n && n.t && Math.abs(n.a - n.b) < n.t.min) small = '<span class="cv-small">הבדל קטן</span>';
  var mx = n ? Math.max(n.a, n.b) : 1;
  var cell = function (d, i) {
    var raw = d.spec[r[2]], v;
    if (empty(raw)) v = '<span class="cv-na">לא מפורסם אצל היצרן</span>';
    else if (Array.isArray(raw)) v = '<span class="cv-val">' + raw.map(function (x) { return '<span class="vch">' + ltrRuns(x) + "</span>"; }).join("") + "</span>";
    else v = '<span class="cv-val">' + ltrRuns(raw) + "</span>";
    return '<div class="cv-v ' + (i ? "cv-b" : "cv-a") + '"><span class="cv-who"><span class="cv-dot" aria-hidden="true"></span>' + ltr(d.name) + "</span>" + v +
      (n ? fill(100 * (i ? n.b : n.a) / mx) : "") + "</div>";
  };
  return '<div class="cv-r"><div class="cv-rl">' + esc(r[1]) + (small ? "<br>" + small : "") + "</div>" + cell(ds[0], 0) + cell(ds[1], 1) +
    (MEANS[r[2]] ? '<p class="cv-note">' + esc(MEANS[r[2]]) + "</p>" : "") + "</div>";
}
function sizeHtml(ds) {
  if (!CFG.outline) return "";
  var a = dims(ds[0]), b = dims(ds[1]); if (!a || !b) return "";
  var fig = function (x, d, c) { return '<figure class="' + c + '"><span class="cv-ol" aria-hidden="true" style="width:' + x.w + "px;height:" + x.h + 'px"></span><figcaption>' + ltr(x.h + " × " + x.w) + " מ״מ</figcaption></figure>"; };
  return '<div class="cv-size">' + fig(a, ds[0], "cv-a") + fig(b, ds[1], "cv-b") + "<p>בקנה מידה אמיתי, גובה ורוחב בלי עובי. מה שמורגש ביד הוא בעיקר המשקל והעובי.</p></div>";
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
  var msg = "היי, אשמח לעזרה בבחירה בין " + ds[0].name + " לבין " + ds[1].name + "." + (picked.length ? " חשוב לי: " + picked.join(", ") + "." : "");
  var wt = $("cvwatext"), wa = $("cvwa");
  if (wt) wt.textContent = msg;
  if (wa) wa.setAttribute("href", "https://wa.me/97286812050?text=" + encodeURIComponent(msg));
}
out.addEventListener("click", function (e) {
  var t = e.target; if (!t || !t.closest) return;
  var c = t.closest(".cv-chip");
  if (c) { var k = c.getAttribute("data-cat"); on[k] = !on[k]; if (!on[k]) delete on[k]; push("cmp_priority", { category: k, on: !!on[k] }); renderList(true); return; }
  if (t.closest(".cv-rest")) { restOpen = !restOpen; push("cmp_rest", { open: restOpen }); renderList(true); var rb = out.querySelector(".cv-rest"); if (rb) rb.focus(); return; }
  if (t.closest("#cvwa")) { push("cmp_share_whatsapp", { devices: sel.join(","), priorities: Object.keys(on).join(",") }); return; }
  if (t.closest("#dcopy")) {
    push("cmp_copy_link", { devices: sel.join(",") });
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
  sel = [pre[0] || null, pre[1] || null];
  if (!sel[0]) openPick(0, false); else if (!sel[1]) openPick(1, false);
  render();
}).catch(function () { out.innerHTML = '<p class="dempty">' + CFG.loadErr + "</p>"; });
}
