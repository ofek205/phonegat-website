# 07 — Frontend Engineer (Web + Mobile/Responsive) — PHONE GAT

> פלייבוק תפקידי. נשען על `00-project-context.md` (אפיון v1 נעול · 2026-07-18).
> קהל: מפתח Frontend בכיר, אחראי ווב + מובייל/רספונסיב. סטאק מונחה: HTML5 סמנטי, CSS מודרני (logical properties), JS מינימלי vanilla-first. עברית RTL, mobile-first, רקע לבן, נגישות ת"י 5568 / WCAG 2.0 AA.

---

## 1. מנדט התפקיד

אני הופך עיצוב מאושר + משימות מ-Tech Lead לקוד production שרץ, מהיר, רספונסיבי ונגיש — לדף נחיתה One-Page של PHONE GAT.

**באחריותי:**
- מימוש נאמן-לפיקסל של העיצוב המאושר, RTL מלא, mobile-first.
- כל מקטע בדף (11 מקטעים + סרגל דביק בנייד) לפי מבנה הדף הנעול (סעיף 6 באפיון).
- ביצועים: Core Web Vitals ירוקים בשדה (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1).
- נגישות בקוד: מבנה סמנטי, ניווט מקלדת, focus גלוי, ניגודיות, ARIA נכון, כיבוד prefers-reduced-motion.
- וידג'טים כבדים (ביקורות גוגל, מפה, יוטיוב) בטכניקת facade / lazy כדי לא לחנוק את הדף.

**לא באחריותי:** קופירייטינג, החלטות עיצוב (צבע/טיפוגרפיה — מגיעות מאושרות), תוכן משפטי (הצהרת נגישות — מקבל טקסט מוכן), backend/שליחת מייל בפועל (מקבל endpoint/יעד), SEO strategy (מקבל דרישות meta מ-Tech Lead).

**עקרון-על מהמותג:** האתר חייב להיראות כמו עבודת סטודיו — **לא כמו אתר שנבנה ב-AI**. אין גרדיאנט סגול-כחול קלישאתי, אין אימוג'י ככותרות, טיפוגרפיה ומרווחים מדויקים (spacing scale עקבי), micro-interactions מדודות ואנושיות.

---

## 2. מיקום בתהליך (קלט / פלט)

**קלט שאני מקבל:**
- מ-**Tech Lead**: פירוק משימות, החלטות טכניות, breakpoints, דרישות meta/perf, יעד ה-endpoint לטופס, מקורות הווידג'טים (Place ID, YouTube IDs, קישורי ביקורות).
- מ-**עיצוב מאושר** (אחרי שער QA-עיצוב + אישור לקוח): Figma/מפרט ויזואלי, tokens (צבעים מהלוגו: ירוק/סגול/כתום/טורקיז על לבן), טיפוגרפיה, נכסים (30 צילומי ביקורות, תמונות ברוך וסיגל, לוגו, וידאו).
- מ-**Copywriter**: טקסטים סופיים (אין lorem ipsum בקוד production).

**פלט שאני מעביר:**
- קוד רץ לענף/preview URL, מתועד, עם הנחיות הרצה.
- דיווח עמידה בקריטריוני הקבלה של כל מקטע + מדדי Lighthouse/CWV.
- מעביר חזרה ל-**Tech Lead** → **שער G7** (QA מלא כולל מעבר עיצובי + נגישות + perf) → אישור לקוח → העלאה.

**כלל שער:** לא מעביר קדימה מקטע שלא עומד ב-DoD שלו (סעיף 6). כישלון שער = חזרה עם רשימת תיקונים.

---

## 3. מומחיות ליבה (דפוסים 2025-2026)

### 3.1 RTL עם CSS Logical Properties + `:dir()`

עברית RTL היא לא `direction: rtl` על ה-body ותו לא. הכלל: **logical properties by default**, physical רק כשאין חלופה לוגית (למשל `background-position`, `transform`, mirroring של אייקונים).

```html
<html lang="he" dir="rtl">
```

```css
/* ❌ אל תשתמש בפיזי */
.card { margin-left: 16px; padding-right: 24px; text-align: right; border-left: 2px solid; }

/* ✅ logical — מתהפך אוטומטית, ומאפשר בעתיד גם עמוד LTR ללא re-write */
.card {
  margin-inline-start: 16px;
  padding-inline-end: 24px;
  text-align: start;
  border-inline-start: 2px solid;
}
/* גם: inset-inline-start, inline-size/block-size, margin-block, padding-inline */
```

- **תמיכה:** logical properties ~95% גלובלי — ברירת מחדל בטוחה. `:dir()` ~80% — להשתמש רק כ-enhancement, לא כתלות קריטית; fallback ל-`[dir="rtl"]`.
- **מספרים/טלפונים/אנגלית בתוך עברית:** לעטוף עם `<bdi>` או `dir="ltr"` נקודתי כדי למנוע bidi mirroring של `052-589-3366` / `08-681-2050` / `wa.me`.
- **אייקונים כיווניים** (חץ "המשך", חזרה): למרר עם `:dir(rtl) .icon-chevron { transform: scaleX(-1); }`. אייקונים ניטרליים (טלפון, מפה, וואטסאפ) — **לא** למרר.
- **`scroll-padding`/`scroll-margin`** לעוגנים מתחת ל-header קבוע (ראה 3.5).
- קרוסלה RTL: `scroll-snap` על ציר inline מתהפך נכון מעצמו; ודא ש-`scrollLeft` מטופל (בכרום RTL הוא שלילי/הפוך — בדוק בפועל).

### 3.2 Core Web Vitals (LCP / INP / CLS)

יעדים (field, 75th percentile): **LCP ≤ 2.5s · INP ≤ 200ms · CLS ≤ 0.1**.

**LCP** (בד"כ תמונת ה-hero / פתיח):
```html
<!-- תמונת LCP: לא lazy, עדיפות גבוהה, מידות מפורשות -->
<img src="hero.avif" width="1200" height="800" fetchpriority="high"
     decoding="async" alt="ברוך וסיגל בחנות פון-גת בקרית גת">
<link rel="preload" as="image" href="hero.avif" fetchpriority="high">
```
- פורמטים מודרניים: **AVIF → WebP → JPG** fallback דרך `<picture>`.
- fonts: `font-display: swap` + `preload` לפונט העברי הראשי + self-host (לא לחסום render על CDN חיצוני).
- CSS קריטי inline למעל-הקיפול; שאר ה-CSS/JS `defer`.

**INP** (רספונסיביות לאינטראקציה):
- JS מינימלי, vanilla; להימנע מ-framework כבד לדף שיווקי סטטי.
- להאזין ב-event delegation, לפרק עבודה ארוכה, `requestIdleCallback` למשימות לא-דחופות.
- וידג'טים חיצוניים (מפה/יוטיוב) = הגורם מס' 1 ל-main-thread blocking → facade (ראה 3.4).

**CLS** (יציבות layout):
- כל `<img>`/`<iframe>`/וידאו עם `width`+`height` (או `aspect-ratio`) → שריון מקום.
```css
.review-shot { aspect-ratio: 9 / 16; inline-size: 100%; height: auto; }
.video-embed { aspect-ratio: 16 / 9; }
```
- header קבוע ו-sticky bar: לשריין גובה מראש, לא להזריק אחרי load.
- אין הזרקת באנרים/תוכן מעל אזור נראה אחרי טעינה.

### 3.3 Lazy-loading לתמונות + responsive

```html
<img
  src="review-12-800.webp"
  srcset="review-12-400.webp 400w, review-12-800.webp 800w, review-12-1200.webp 1200w"
  sizes="(max-width: 600px) 90vw, 300px"
  width="900" height="1600"
  loading="lazy" decoding="async"
  alt="צילום ביקורת מלקוח על שירות תיקון מסך">
```
- `loading="lazy"` **רק** לתמונות מתחת לקיפול (30 צילומי הביקורות = מועמד מובהק). **לעולם לא** על תמונת LCP.
- 3-5 breakpoints ב-srcset (יותר מדי = פגיעה ב-CDN cache).
- placeholder: `background-color` דומיננטי או blur-up קטן — לא skeleton כבד ב-JS.

### 3.4 וידג'טים כבדים בטכניקת Facade / Click-to-load

Embed רגיל של יוטיוב = 20+ בקשות ו-1.3-2.6MB, מוסיף 1.5-3s. facade חוסך ~800ms LCP.

```html
<!-- YouTube facade: תמונת poster + כפתור play; iframe נטען רק בקליק -->
<button class="yt-facade" data-yt-id="VIDEO_ID"
        aria-label="נגן וידאו: לקוחות מספרים על פון-גת">
  <img src="https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"
       width="480" height="360" loading="lazy" alt="">
  <span class="yt-play" aria-hidden="true"></span>
</button>
```
```js
document.querySelectorAll('.yt-facade').forEach(el => {
  el.addEventListener('click', () => {
    const id = el.dataset.ytId;
    const f = document.createElement('iframe');
    f.width = 560; f.height = 315;
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    f.title = 'לקוחות מספרים על פון-גת';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    el.replaceWith(f);
  }, { once: true });
});
```
- **מודעות SEO tradeoff:** facade עם iframe מוזרק דינמית עלול להוציא את הווידאו מ-Google Video search. לדף שיווקי מקומי — CWV חשוב יותר; אם רוצים גם video-SEO, להוסיף `VideoObject` structured data. **החלטה מ-Tech Lead.**
- שימוש ב-`youtube-nocookie.com` לפרטיות.
- **מפה**: להעדיף facade "לחץ לטעינת מפה" או lazy `<iframe loading="lazy">` תחת IntersectionObserver; לספק גם קישורי טקסט ל-Waze/Google Maps (לא לסמוך על ה-iframe בלבד).

### 3.5 HTML סמנטי + Landmarks

```html
<header> ... </header>            <!-- banner -->
<nav aria-label="ניווט ראשי"> ... </nav>
<main>
  <section aria-labelledby="story-h"> <h2 id="story-h">...</h2> </section>
  ...
</main>
<footer> ... </footer>            <!-- contentinfo -->
```
- כל `<section>` עם כותרת (`aria-labelledby`) או `aria-label`. היררכיית h1→h2→h3 ללא דילוגים; h1 יחיד.
- `<a href="#main" class="skip-link">דלג לתוכן</a>` ראשון ב-body.
- עוגנים מתחת ל-header קבוע:
```css
html { scroll-padding-top: 84px; }   /* גובה ה-header */
:target { scroll-margin-top: 84px; }
```

### 3.6 אנימציה + `prefers-reduced-motion`

הערך הוא `reduce` (לא "none") — לצמצם/להחליף, לא בהכרח לבטל הכל. להעדיף fade/opacity על scale/rotate/parallax.

```css
/* ברירת מחדל: ללא אנימציה; מוסיפים רק כשמותר */
@media (prefers-reduced-motion: no-preference) {
  .fade-in { animation: fadeIn .4s ease-out both; }
}
/* ביטול גורף כרשת ביטחון */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```
- קרוסלה: **לא** auto-rotate; אם בכל זאת — עצירה ב-focus/hover + כפתור pause גלוי (WCAG 2.2.2).

### 3.7 נגישות — ווידג'טים אינטראקטיביים (ARIA APG)

- כל control אינטראקטיבי = אלמנט native (`<button>`, `<a>`) עם focus מובנה. אין `<div onclick>`.
- **focus גלוי** תמיד: `:focus-visible { outline: 2px solid <brand-token>; outline-offset: 2px; }` — לא להסיר outline.
- ניגודיות טקסט ≥ 4.5:1 (בדוק צבעי המותג על לבן — כתום/טורקיז עלולים ליפול; להשתמש בגוונים כהים לטקסט).
- target size ≥ 24×24px (WCAG 2.2), בנייד לשאוף ל-44×44px.
- קרוסלת ביקורות = דפדוף ידני עם כפתורי הקודם/הבא + `aria-live="polite"` על אזור הסטטוס, או תבנית `tablist`/`group` לפי APG carousel; roving arrow-keys.
- אין תלות ב-overlay נגישות כתחליף (חובה חוקית — הצהרת נגישות אמיתית + רכז נגישות).

---

## 4. יישום ל-PHONE GAT (לפי מקטעי הדף)

### 4.0 שלד הדף
```html
<!doctype html>
<html lang="he" dir="rtl">
<head> <meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1"> ... </head>
<body>
  <a href="#main" class="skip-link">דלג לתוכן</a>
  <header> ... </header>
  <a class="wa-float" ...>וואטסאפ</a>
  <main id="main"> <!-- מקטעים 3-10 --> </main>
  <footer> ... </footer>
  <nav class="mobile-bar" aria-label="פעולות מהירות"> <!-- נייד בלבד --> </nav>
</body></html>
```

### 4.1 Header עליון קבוע (מקטע 1)
```css
header { position: sticky; inset-block-start: 0; z-index: 100; background:#fff; block-size: 84px; }
```
- `position: sticky` (לא fixed) → פחות בעיות overlap. z-index מסודר מול sticky-bar ו-wa-float.
- לוגו (`<img>` עם width/height, alt="פון-גת fix and go"), `<nav>` קצר, טלפון כ-`<a href="tel:+97286812050">` עטוף `dir="ltr"`.
- מובייל: ניווט מקוצר/hamburger `<button aria-expanded aria-controls>`; שריון גובה (CLS).

### 4.2 לחצן וואטסאפ צף (מקטע 2)
```html
<a class="wa-float" href="https://wa.me/972525893366?text=%D7%94%D7%99%D7%99%20%D7%A4%D7%95%D7%9F%20%D7%92%D7%AA"
   target="_blank" rel="noopener noreferrer"
   aria-label="שליחת הודעת וואטסאפ לפון-גת">
  <svg aria-hidden="true" width="28" height="28">...</svg>
</a>
```
```css
.wa-float { position: fixed; inset-block-end: 20px; inset-inline-start: 20px; z-index: 90;
  inline-size: 56px; block-size: 56px; border-radius: 50%; display:grid; place-items:center; }
@media (max-width:768px){ .wa-float{ inset-block-end: calc(64px + env(safe-area-inset-bottom)); } } /* מעל ה-sticky bar */
```
- `wa.me` + מספר בפורמט בינ"ל **ללא** `+`/רווחים/מקפים: `972525893366`. HTTPS חובה, `rel="noopener noreferrer"`.
- לוודא שלא מכסה את ה-sticky bar/קישורים/פקדי נגישות. target ≥ 44px.

### 4.3 פתיח "מי אנחנו" + הסיפור של ברוך וסיגל (מקטעים 3-4) — הלב
- מקטע 3 = מועמד ל-**LCP**: תמונת hero עם `fetchpriority="high"`, preload, ללא lazy.
- מקטע 4: שני sub-blocks (ברוך / סיגל) + על המקום. `<section aria-labelledby>`, תמונות עם alt תיאורי אמיתי, `aspect-ratio` לשריון. fade-in עדין תחת `no-preference`. טיפוגרפיה אנושית — לא template.

### 4.4 קרוסלת ביקורות גוגל — ~30 צילומים (מקטע 5) + easy (מקטע 6)
```html
<section aria-labelledby="rev-h">
  <h2 id="rev-h">מה הלקוחות אומרים · דירוג 4.9 מתוך מאות ביקורות בגוגל</h2>
  <div class="rev-track" role="group" aria-roledescription="קרוסלת ביקורות" tabindex="0">
    <figure><img loading="lazy" decoding="async" width="900" height="1600"
      srcset="..." sizes="(max-width:600px) 80vw, 300px"
      src="rev-1-800.webp" alt="ביקורת חמישה כוכבים על העברת נתונים מהיר"></figure>
    <!-- ... ~30 -->
  </div>
  <div class="rev-controls">
    <button aria-label="הביקורת הקודמת">‹</button>
    <button aria-label="הביקורת הבאה">›</button>
  </div>
</section>
```
```css
.rev-track { display:flex; gap:16px; overflow-x:auto; scroll-snap-type: x mandatory;
  scrollbar-width: none; overscroll-behavior-x: contain; }
.rev-track > figure { flex: 0 0 auto; inline-size: min(80vw, 300px); scroll-snap-align: start; }
```
- **הדירוג כטקסט** לצד הצילומים (חשוב ל-SEO/נגישות — אסור שיהיה רק בתוך תמונה). alt ייחודי לכל צילום.
- lazy-load לכל 30 (מתחת לקיפול); srcset ל-3 גדלים. שריון `aspect-ratio` → CLS=0.
- ניווט: כפתורי ‹/› native + מקלדת (arrow keys על ה-track שהוא `tabindex="0"`), focus גלוי, `scroll-snap`. **בלי auto-rotate.** מובייל = swipe טבעי (native scroll, לא ספריית drag כבדה).
- easy (מקטע 6): אותו רכיב, מקור נתונים אחר. לשקול טעינה עצלה של המקטע כולו (IntersectionObserver) אם הצילומים כבדים.

### 4.5 אמינות טכנית (מקטע 7)
- לוגואים/אייקונים של מכשירים ומותגים כ-SVG (חד, קל, scalable). alt/`aria-label` לכל אחד. מפוזר לאורך הדף כפי שהוגדר — לא מקטע ענק אחד.

### 4.6 וידג'ט וידאו — לקוחות מספרים (מקטע 8)
- YouTube **facade** (3.4), `youtube-nocookie`, poster עם `aspect-ratio:16/9`. כותרת iframe בעברית. כתוביות לווידאו (חובה נגישות) — לוודא שקיימות בסרטון.

### 4.7 מפה + שעות + ניווט (מקטע 9)
- מפה: `<iframe loading="lazy">` תחת facade/IntersectionObserver, `title="מפת פון-גת, רחבת תשרי 2 קריית גת"`, `aspect-ratio`.
- שעות כ-**טקסט סמנטי** (`<dl>` או `<table>`), לא כתמונה: א׳–ה׳ 9:00–18:30 · ו׳ 9:00–13:00.
- קישורי טקסט: "ניווט ב-Waze" / "פתח ב-Google Maps" — עצמאיים מה-iframe.

### 4.8 טופס פנייה → אימייל (מקטע 10)
```html
<form action="/api/lead" method="post" aria-labelledby="form-h" novalidate>
  <h2 id="form-h">השאירו פרטים — ברוך וסיגל יחזרו אליכם</h2>
  <div>
    <label for="name">שם מלא</label>
    <input id="name" name="name" type="text" autocomplete="name" required>
  </div>
  <div>
    <label for="phone">טלפון</label>
    <input id="phone" name="phone" type="tel" inputmode="numeric"
           autocomplete="tel" dir="ltr" required
           aria-describedby="phone-hint">
    <p id="phone-hint">נחזור אליכם בהקדם בשעות הפעילות</p>
  </div>
  <button type="submit">שליחה</button>
  <p role="status" aria-live="polite" class="form-status"></p>
</form>
```
- כל שדה עם `<label for>` נראה (לא placeholder-as-label). שגיאות מקושרות ב-`aria-describedby` + `aria-invalid`, הודעה טקסטואלית (לא רק צבע). ולידציה בצד לקוח כ-UX, אך ה-endpoint (מ-Tech Lead) הוא מקור האמת.
- `autocomplete` נכון, `inputmode` לטלפון. הודעת הצלחה/שגיאה ל-`role="status"`.
- **אין** איסוף מידע רגיש. יעד = אימייל (סעיף 3 באפיון). ללא reCAPTCHA שחוסם נגישות (להעדיף honeypot/anti-spam שקוף).

### 4.9 פוטר (מקטע 11)
- פרטי קשר (טלפונים כ-`tel:` עטופים `dir="ltr"`), שעות, לינקים לסושיאל (Facebook/easy) עם `aria-label`, כתובת. **קישור להצהרת נגישות + פרטי רכז נגישות** (חובה חוקית).

### 4.10 סרגל דביק בנייד (📞 · 💬 · 📍)
```html
<nav class="mobile-bar" aria-label="פעולות מהירות">
  <a href="tel:+97286812050" aria-label="חייגו לפון-גת">חייג</a>
  <a href="https://wa.me/972525893366" rel="noopener noreferrer" aria-label="וואטסאפ">וואטסאפ</a>
  <a href="https://waze.com/ul?..." rel="noopener noreferrer" aria-label="ניווט">ניווט</a>
</nav>
```
```css
.mobile-bar { display:none; }
@media (max-width:768px){
  .mobile-bar { position: fixed; inset-block-end:0; inset-inline:0; z-index:95;
    display:grid; grid-template-columns:repeat(3,1fr);
    padding-block-end: env(safe-area-inset-bottom); background:#fff; }
  body { padding-block-end: 64px; } /* שלא יכסה תוכן/פוטר */
}
```
- כל פריט ≥ 44px, focus גלוי, טקסט + אייקון. `env(safe-area-inset-bottom)` ל-iPhone notch. z-index מתואם מול wa-float ו-header.

---

## 5. צ'קליסטים

### 5.1 RTL
- [ ] `<html lang="he" dir="rtl">`.
- [ ] logical properties בכל מקום; physical רק עם הצדקה (transform/mirror).
- [ ] מספרים/טלפונים/URL עטופים `dir="ltr"`/`<bdi>`.
- [ ] אייקונים כיווניים ממוררים; ניטרליים לא.
- [ ] קרוסלה גוללת נכון ב-RTL (נבדק בפועל בכרום+ספארי).

### 5.2 ביצועים (CWV)
- [ ] תמונת LCP: לא lazy, `fetchpriority=high`, preload, AVIF/WebP.
- [ ] כל תמונה/iframe עם width+height/aspect-ratio (CLS=0).
- [ ] 30 צילומי ביקורות + מפה + וידאו = lazy/facade.
- [ ] fonts self-hosted + `font-display:swap` + preload.
- [ ] CSS קריטי inline; JS `defer`, מינימלי.
- [ ] Lighthouse mobile ירוק; מדידת field/CrUX אחרי עלייה.

### 5.3 נגישות (ת"י 5568 / WCAG AA)
- [ ] מבנה סמנטי + landmarks + skip-link + h-hierarchy.
- [ ] ניווט מקלדת מלא; `:focus-visible` גלוי בכל control.
- [ ] ניגודיות ≥ 4.5:1 (נבדק על צבעי המותג).
- [ ] alt לכל תמונה תוכן; alt="" לדקורטיבי.
- [ ] טפסים: label נראה, aria-describedby לשגיאות/hints, aria-live לסטטוס.
- [ ] כתוביות לווידאו; אין auto-play עם קול.
- [ ] `prefers-reduced-motion` מכובד; אין auto-rotate ללא pause.
- [ ] target size ≥ 44px בנייד.
- [ ] הצהרת נגישות + רכז נגישות בפוטר. אין overlay כתחליף.

### 5.4 רספונסיביות
- [ ] mobile-first; נבדק 360/390/768/1024/1440.
- [ ] אין scroll אופקי לא-רצוי; `overflow-x` נקי.
- [ ] sticky-bar + wa-float לא מכסים תוכן (padding-bottom, safe-area).
- [ ] טאץ' טרגטים ומרווחים נוחים בנייד.

---

## 6. שער היציאה (Definition of Done — G7)

מקטע/דף לא עובר ל-Tech Lead אלא אם **כל** אלה מסומנים:
1. **רץ** — נטען ללא שגיאות console, בכל הדפדפנים המרכזיים (Chrome, Safari, Firefox, Edge).
2. **נאמן לעיצוב** — עובר מעבר עיצובי (spacing/טיפוגרפיה/צבע), לא "template AI".
3. **רספונסיבי** — נייד + טאבלט + דסקטופ, RTL תקין, ללא scroll אופקי.
4. **עומד בקריטריוני הקבלה של המקטע** (מ-Tech Lead/PM).
5. **נגיש** — צ'קליסט 5.3 עובר; נבדק במקלדת + screen reader (NVDA/VoiceOver) + axe/Lighthouse a11y ללא שגיאות.
6. **מהיר** — Core Web Vitals ירוקים: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 (Lighthouse mobile + מדידת field לאחר עלייה).
7. **מתועד** — הוראות הרצה, מקורות נכסים/וידג'טים, החלטות פתוחות (למשל video-SEO tradeoff) מסומנות ל-Tech Lead.

כישלון שער = חזרה עם רשימת תיקונים ממוקדת.

---

## 7. מקורות

- MDN — [`:dir()` pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:dir) · [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) · [HTML landmark roles](https://developer.mozilla.org/en-US/blog/aria-accessibility-html-landmark-roles/)
- W3C WAI-ARIA APG — [Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) · [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/) · [C39 reduced-motion](https://www.w3.org/WAI/WCAG21/Techniques/css/C39)
- web.dev — [Responsive images](https://web.dev/learn/design/responsive-images) · [Browser-level lazy loading](https://web.dev/articles/browser-level-image-lazy-loading) · [Third-party embed best practices](https://web.dev/articles/embed-best-practices)
- Unlighthouse — [Don't lazy-load your LCP image](https://unlighthouse.dev/learn-lighthouse/lcp/lcp-lazy-loaded)
- Google Search Central — [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) · corewebvitals.io — [LCP/INP/CLS 2026](https://www.corewebvitals.io/core-web-vitals)
- Capellic — [YouTube facade for performance](https://capellic.com/insights/add-facade-image-youtube-videos-improve-performance) · Mugo — [YouTube facade load time](https://www.mugo.ca/Blog/Optimizing-page-load-time-with-a-YouTube-facade)
- A11Y Collective — [Accessible carousel](https://www.a11y-collective.com/blog/accessible-carousel/) · [Accessible tabs](https://www.a11y-collective.com/blog/accessibility-tab/)
- Firefox Source Docs — [RTL Guidelines](https://firefox-source-docs.mozilla.org/code-quality/coding-style/rtl_guidelines.html) · GitHub — [rtl-guidelines](https://github.com/ItielMaN/rtl-guidelines)
- HackerNoon — [WCAG 2.2 practical guide 2025](https://hackernoon.com/accessibility-in-2025-a-practical-guide-to-wcag-22-with-real-examples)
- Infobip — [WhatsApp button setup 2026](https://www.infobip.com/blog/add-whatsapp-button-to-website)
