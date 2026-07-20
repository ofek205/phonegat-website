# PHONE GAT — פלייבוק Software Architect (ארכיטקט תוכנה)

> פלייבוק תפקידי. נשען על מסמך-האב `00-project-context.md` (אפיון v1 נעול · 2026-07-18).
> גרסה: 1.0 · עודכן 2026-07-18. מונחים טכניים באנגלית במכוון.

---

## 1. מנדט התפקיד

הארכיטקט הוא בעל ההחלטה הטכנית העליונה לפני שהקוד נכתב. התפקיד ממיר את **העיצוב המאושר** ואת **האפיון** להחלטות מבנה מחייבות: בחירת stack, מבנה קבצים/רכיבים, אסטרטגיית ביצועים, טיפול בטופס, ובחירת אירוח ודומיין.

**מה בסמכות הארכיטקט:**
- בחירת ה-technology stack וה-build pipeline.
- הגדרת ה-component/file architecture וגבולות האחריות.
- החלטות non-functional: performance budget, accessibility architecture, SEO technical baseline, security posture בסיסי.
- בחירת ספקי תשתית: hosting, form backend, DNS/domain, CDN.
- הגדרת ה-Definition of Done הטכני שעליו יישען ה-Tech Lead.

**מה מחוץ לסמכות (לא הארכיטקט מחליט):**
- שפת שיווק, ניסוח, תוכן — Copywriter/PM.
- החלטות ויזואליות (צבע, טיפוגרפיה, layout) — UX/UI Designer. הארכיטקט **מכבד** את העיצוב המאושר, לא משנה אותו.
- פירוק למשימות ביצוע ותזמון — Tech Lead/Delivery.

**עקרון-על:** הפתרון הפשוט ביותר שעומד בכל הדרישות מנצח. אין over-engineering. דף נחיתה חד-עמודי סטטי לא צריך framework כבד, לא צריך database, לא צריך backend משלנו. כל תלות (dependency) חייבת להצדיק את קיומה מול עלות התחזוקה.

---

## 2. מיקום בתהליך (קלט / פלט)

בהתאם לשרשרת השערים במסמך-האב (סעיף 10):
`עיצוב → QA-עיצוב → אישור לקוח → **[ארכיטקטורה]** → פיתוח → QA מלא → אישור לקוח → העלאה`

הארכיטקט נכנס **אחרי אישור העיצוב** (שער design מאושר) ולפני תחילת הפיתוח. זהו **שער G6**.

### קלט (מה שחייב להגיע לשולחן הארכיטקט)
- `00-project-context.md` — האפיון הנעול.
- עיצוב מאושר (Figma / קבצי מסירה) שעבר QA-עיצוב ואישור לקוח.
- רשימת נכסים: לוגו, פלטת צבעי מותג, פונטים, תמונות, ~30 צילומי ביקורות, וידאו לקוחות.
- דרישות נגישות (ת"י 5568 / WCAG 2.0 AA) מסעיף 8.
- דרישות SEO-על מסעיף 5 (דומיננטיות מקומית בקרית גת).

### פלט (תוצרי השער — ראה סעיף 6)
1. **מסמך החלטות ארכיטקטורה** (ADR — Architecture Decision Record) מנומק.
2. **מבנה קבצים/רכיבים** (component + file tree).
3. **בחירת אירוח + טיפול בטופס + DNS/domain** — מנומקת ומאושרת.

### למי מעבירים
ל-**Tech Lead** (לפירוק למשימות הנדסיות) ול-**מפתחים** (frontend/DevOps). הארכיטקט זמין כ-consultant לאורך הפיתוח אך לא כותב קוד ביצור.

---

## 3. מומחיות ליבה (השוואות 2025-2026)

### 3.1 בחירת Stack — Static HTML/CSS/JS מול Astro מול Next.js

זהו הצומת המרכזי. שלוש חלופות ריאליות לדף נחיתה חד-עמודי:

| קריטריון | Static HTML/CSS/JS (Vanilla) | **Astro** | Next.js |
|---|---|---|---|
| פילוסופיה | ידני, אפס abstraction | content-first, zero-JS by default | app-first, React full-stack |
| JS שנשלח ל-browser | מה שכתבת בלבד | **~0 KB by default** (Islands opt-in) | bundle גדול גם ל-static |
| Core Web Vitals | מצוין (אם עושים נכון) | **מצוין, enforced ארכיטקטונית** | טוב אך תלוי משמעת |
| DX / תחזוקה | חזרתיות, אין components, קשה לתחזק ככל שגדל | components, layouts, partials, מעולה | מצוין ל-app, כבד ל-landing |
| Build/deploy | פשוט (אין build או Vite קל) | `astro build` → static output | build כבד, נוטה ל-SSR |
| התאמה ל-landing page | טוב לעמוד ממש קטן | **התאמה מיטבית** | over-kill |
| עקומת למידה לצוות | אפסית | נמוכה (דמוי HTML) | גבוהה (React ecosystem) |

**מסקנת 2025-2026:** הקונצנזוס בתעשייה מובהק — לאתרי תוכן ודפי נחיתה **Astro הוא ברירת המחדל**. Astro שולח כ-90% פחות JavaScript מ-Next.js וזמני טעינה מהירים בכ-40% בזכות גישת ה-**zero-JS-by-default** וה-**Islands Architecture** (interactivity נבחרת per-component, לא per-page). Next.js הוא הבחירה הנכונה ל-dashboards, SaaS, e-commerce ואפליקציות דינמיות — **לא** לדף שיווקי סטטי. חיזוק לבשלות המערכת: בינואר 2026 Cloudflare רכשה את Astro וצוות הליבה עבר אליה — מה שמבטיח המשכיות ותמיכה ארוכת-טווח, ומחזק את שילוב Astro + Cloudflare Pages כ-path מועדף.

Vanilla HTML/CSS/JS נותן ביצועים מצוינים אך משלם ב-DX: אין components לשימוש חוזר (Header, כרטיס ביקורת, section) — מה שהופך תחזוקה של דף עם ~11 sections לחזרתית ורגישה לטעויות.

### 3.2 Static Site Generation (SSG)

עקרון: כל ה-HTML נוצר ב-**build time**, לא ב-runtime. אין server rendering per-request, אין database call בזמן טעינה. התוצר הוא קבצי `.html`, `.css`, `.js`, ותמונות מוכנים ל-CDN.

יתרונות ל-PHONE GAT: TTFB מינימלי (הקובץ כבר קיים ב-edge), attack surface אפסי (אין backend חי לתקוף), עלות אירוח ~0, cache-ability מלא. Astro מפיק static output דיפולטיבית עם `output: 'static'`. אין צורך ב-SSR/ISR עבור דף שמשתנה נדיר.

### 3.3 ארכיטקטורת טיפול בטופס (Serverless / Form Service)

באתר סטטי אין backend משלנו לקבל POST. הפתרון: **third-party form backend** (serverless). השוואת 2025-2026:

| שירות | Free tier | הערות |
|---|---|---|
| **Formspree** | 50 submissions/חודש | הוותיק והבשל, אינטגרציה פשוטה, email מובנה, spam protection |
| **Web3Forms** | ~250 submissions/חודש (unlimited forms) | access key בלבד, privacy-focused, ללא חשבון מורכב, מעולה ל-JAMstack |
| **Netlify Forms** | 100/חודש | טוב **רק אם** מארחים ב-Netlify; vendor lock-in (מעבר host = בניית טופס מחדש) |
| **Forminit / Basin** | ~100/חודש + file upload | EU-hosted, DPA, מתאים לרגישות GDPR |

**עקרונות אדריכליים לטופס:**
- הטופס נשאר plain HTML `<form>` עם `action` ל-endpoint של השירות — **progressive enhancement**: עובד גם ללא JS.
- honeypot field + (אופציונלי) hCaptcha להגנת spam — **לא** reCAPTCHA שפוגע ב-INP וב-privacy.
- server-side validation אצל הספק + client-side validation ל-UX.
- יעד: email של ברוך וסיגל (סעיף 3 באפיון). ללא אחסון PII אצלנו.
- redirect לעמוד "תודה" (thank-you state) אחרי submit.

### 3.4 ארכיטקטורת ביצועים (Core Web Vitals)

ספי 2025-2026 (75th percentile, real-user data, ≥75% מהמבקרים ב-"good"):

| מדד | Good | פירוש |
|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | מהירות טעינת האלמנט הגדול |
| **INP** (Interaction to Next Paint) | ≤ 200ms | תגובתיות (החליף את FID) |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | יציבות ויזואלית |

INP הוא המדד שהכי נכשלים בו (43% מהאתרים) — וכאן ל-Astro יתרון מובנה כי כמעט אין JS ב-main thread. **Performance budget מוצע:** alert-thresholds ב-80% מהסף — LCP > 2.0s, INP > 160ms, CLS > 0.08.

**טכניקות מחייבות:**
- **LCP:** תמונת hero ב-WebP/AVIF, `fetchpriority="high"`, `preload` ל-LCP image, פונטים עם `font-display: swap` + preload, ללא render-blocking resources.
- **INP:** מינימום JS. וידג'טים (קרוסלת ביקורות, וידאו) כ-Islands עם `client:visible` — נטענים רק כשנגללים לתצוגה. וידאו ב-lazy-load / facade (thumbnail שטוען את הנגן רק בלחיצה).
- **CLS:** `width`/`height` מפורשים לכל image/iframe/video, מקום שמור לקרוסלות ולמפה, ללא הזרקת תוכן שמזיז layout.
- מפת Google/Waze כ-**lazy iframe** או facade — לא לטעון SDK כבד ב-load ראשוני.

### 3.5 אירוח ודומיין (.co.il בישראל)

**דומיין .co.il:** נרשם דרך **רשם מוסמך** של איגוד האינטרנט הישראלי (ISOC / isoc.org.il). עלות שנתית טיפוסית ~₪80-85 כולל מע"מ (internic, clickpress ועוד). הרישום דורש רשם ישראלי; ה-hosting עצמו יכול להיות בכל מקום — מפרידים בין **domain registration** ל-**hosting**. מנהלים DNS דרך nameserver-transfer ל-CDN הנבחר.

**Static hosting — השוואת 2026:**

| פלטפורמה | Free tier | חוזק |
|---|---|---|
| **Cloudflare Pages** | **Unlimited bandwidth**, 500 builds/חודש, ללא egress fees | הרשת הגדולה (300+ ערים), TTFB נמוך עקבי, הזול ביותר בכל scale, DNS+SSL+CDN במקום אחד |
| **Netlify** | 100GB bandwidth, 300 build-min | DX מצוין למרקטינג, Netlify Forms מובנה (אך lock-in) |
| **Vercel** | נדיב אך יקר ב-scale | מיטבי ל-Next.js, פחות רלוונטי כאן |

לישראל, ל-Cloudflare יתרון latency בזכות PoP קרובים (כולל edge באזור) ו-unlimited bandwidth — קריטי אם וידאו/ביקורות מושכים traffic. שילוב נפוץ בישראל: דומיין .co.il מרשם ישראלי + DNS/CDN/hosting ב-Cloudflare (רבים מהרשמים אף מחברים ל-Cloudflare אוטומטית).

---

## 4. יישום ל-PHONE GAT — המלצת Stack מנומקת

### ההמלצה: **Astro (SSG, static output) + Cloudflare Pages + Web3Forms/Formspree + דומיין .co.il מ-ISOC**

#### נימוק לפי דרישות האפיון

| דרישה (מהאפיון) | איך ה-stack עונה |
|---|---|
| דף נחיתה חד-עמודי, ללא e-commerce | Astro SSG — עמוד סטטי אחד, אפס backend, אפס סל/תשלום |
| "נראה כמו סטודיו אמיתי, לא כמו אתר AI" | Astro מאפשר שליטה מלאה ב-HTML/CSS מדויק, טיפוגרפיה ומרווחים pixel-perfect לפי העיצוב — ללא כפייה של template גנרי |
| מהיר (SEO-על, דומיננטיות מקומית) | zero-JS-by-default → Core Web Vitals מצוינים → אות דירוג חיובי; static ב-edge → TTFB מינימלי |
| נגיש (ת"י 5568 / WCAG 2.0 AA) | HTML סמנטי מלא בשליטתנו, `lang=he`/`dir=rtl`, Islands נגישים; אין overlay |
| עברית RTL, mobile-first | נשלט מלא ב-CSS (logical properties, `dir="rtl"`); אין תלות ב-framework שמפריע ל-RTL |
| קל לתחזוקה | components לשימוש חוזר (Section, ReviewCard, Header, StickyBar) — עדכון במקום אחד |
| זול לאירוח | Cloudflare Pages free tier (unlimited bandwidth) + ~₪85/שנה דומיין. עלות תפעולית שוטפת ≈ 0 |
| טופס → email | Web3Forms/Formspree — serverless, ללא backend, email ישיר לברוך וסיגל |

#### מדוע לא החלופות
- **Vanilla HTML/CSS/JS:** ביצועים דומים אך ללא components → תחזוקה חזרתית ל-11 sections, סיכון לטעויות, קשה ל-Tech Lead לפרק לעבודה מודולרית. Astro נותן את אותם ביצועים **plus** DX.
- **Next.js:** over-engineering מובהק לדף סטטי. bundle גדול, סיכון INP, עקומת למידה, ותלות ב-React ל-landing שאין בו state מורכב. נוגד את עקרון-העל.
- **בונה אתרים (Wix/Elementor):** נוגד "לא כמו אתר AI/template", פוגע ב-performance ובנגישות, lock-in, לא נותן שליטת studio-grade.

#### הכרעות משנה
- **Styling:** CSS מודרני עם **CSS logical properties** (`margin-inline`, `padding-block`) ל-RTL נקי, `clamp()` ל-fluid type, custom properties לצבעי המותג. אופציונלי: Tailwind עם RTL config — אך ל-landing יחיד, scoped CSS ב-Astro components מספיק ומונע bloat.
- **JS:** מינימלי. Vanilla JS ל-sticky bar ולתפריט. Islands (`client:visible`) רק ל: קרוסלת ביקורות, נגן וידאו (facade), אולי מפה. ללא framework client-side אם לא הכרחי.
- **תמונות:** רכיב `<Image />` של Astro → WebP/AVIF אוטומטי, responsive `srcset`, `width`/`height` (מונע CLS).
- **Form backend:** ברירת מחדל **Web3Forms** (free tier נדיב ~250/חודש, ללא חשבון כבד, privacy-focused). חלופה **Formspree** אם רוצים ניהול submissions בשל יותר. honeypot + hCaptcha להגנה.
- **אנליטיקס:** Cloudflare Web Analytics (privacy-first, cookieless, ללא פגיעה ב-CWV) למדידת ה-KPI (קליקים על התקשר/וואטסאפ/טופס).

---

## 5. צ'קליסטים

### 5.1 צ'קליסט החלטת Stack
- [ ] ה-stack עומד בכל דרישה פונקציונלית מהאפיון (סעיפים 2, 6).
- [ ] אין רכיב שנוסף מעבר לצורך (עקרון פשטות).
- [ ] כל dependency מוצדק מול עלות תחזוקה.
- [ ] ה-build מפיק static output בלבד (אין SSR נדרש).
- [ ] הצוות מסוגל לתחזק את ה-stack (עקומת למידה סבירה).

### 5.2 צ'קליסט מבנה קבצים/רכיבים
- [ ] כל section מהאפיון (11 sections + sticky bars) ממופה ל-component.
- [ ] components לשימוש חוזר מזוהים (Header, Section, ReviewCard, FloatingWhatsApp, StickyMobileBar, ContactForm, Footer).
- [ ] Layout יחיד עם `<html lang="he" dir="rtl">`, meta, SEO tags.
- [ ] נכסים (images/fonts/video) מאורגנים ב-`src/assets` / `public`.
- [ ] תוכן (טקסטים, פרטי קשר, שעות) מרוכז במקום אחד (data file) לעדכון קל.

### 5.3 צ'קליסט טופס
- [ ] `<form>` עובד גם ללא JS (progressive enhancement).
- [ ] endpoint לספק נבחר; email יעד = ברוך וסיגל.
- [ ] כל שדה עם `<label>` מקושר (נגישות).
- [ ] honeypot + spam protection.
- [ ] thank-you state / redirect אחרי submit.
- [ ] ללא אחסון PII אצלנו; ספק תואם privacy.

### 5.4 צ'קליסט ביצועים (Performance budget)
- [ ] LCP ≤ 2.5s (יעד פנימי 2.0s), hero preload + `fetchpriority`.
- [ ] INP ≤ 200ms (יעד 160ms), JS מינימלי, Islands `client:visible`.
- [ ] CLS ≤ 0.1 (יעד 0.08), width/height לכל media.
- [ ] תמונות WebP/AVIF + responsive.
- [ ] פונטים preload + `font-display: swap`.
- [ ] וידאו ומפה כ-lazy/facade.
- [ ] אין render-blocking JS/CSS מיותר.

### 5.5 צ'קליסט נגישות (ארכיטקטוני)
- [ ] HTML סמנטי (`header`, `main`, `section`, `nav`, `footer`).
- [ ] `lang="he"` + `dir="rtl"`.
- [ ] ניגודיות 4.5:1 (מוגדר בעיצוב, נבדק בקוד).
- [ ] focus גלוי + ניווט מקלדת מלא.
- [ ] `alt` לכל תמונה; כתוביות לווידאו.
- [ ] `prefers-reduced-motion` מכובד.
- [ ] וידג'טים (קרוסלה, מפה) נגישים; **ללא overlay**.
- [ ] הצהרת נגישות + רכז נגישות (חובה חוקית).

### 5.6 צ'קליסט אירוח / דומיין
- [ ] דומיין .co.il נרשם דרך רשם מוסמך ISOC.
- [ ] DNS מנוהל ב-Cloudflare (nameserver transfer).
- [ ] SSL/TLS פעיל (auto ב-Cloudflare Pages).
- [ ] deploy pipeline מחובר (git → Cloudflare Pages).
- [ ] analytics privacy-first מותקן.

---

## 6. שער היציאה (Definition of Done — G6)

השער נחשב עבור **רק** כאשר כל שלושת התוצרים קיימים, מנומקים ומאושרים:

1. **מסמך החלטות ארכיטקטורה (ADR)** — כולל:
   - החלטת stack עם נימוק מול חלופות.
   - performance budget (ספי CWV).
   - החלטות נגישות ו-SEO ברמת התשתית.
2. **מבנה קבצים/רכיבים** — component tree + file tree מלא, מיפוי כל section לרכיב, ריכוז תוכן ל-data file.
3. **בחירת אירוח + טיפול בטופס + DNS/domain** — ספקים נבחרו, free-tier מאומת מול הצורך, נתיב deploy מוגדר.

**קריטריוני מעבר:**
- [ ] כל דרישה באפיון (functional + non-functional) מכוסה בהחלטה ארכיטקטונית.
- [ ] אין החלטה שסותרת את העיצוב המאושר.
- [ ] כל בחירה מנומקת (לא "ככה מקובל" אלא נימוק מול הדרישה).
- [ ] ה-Tech Lead יכול לפרק את המסמך למשימות ללא שאלות פתוחות מהותיות.
- [ ] אושר ע"י הגורם המאשר (PM/לקוח).

כישלון שער = חזרה עם רשימת תיקונים (בהתאם לסעיף 10 באפיון). אין מעבר לפיתוח לפני אישור.

---

## 7. מקורות

**Stack (Astro / Next.js / Static):**
- [Astro vs Next.js: Which Framework Should You Use in 2026? — Pagepro](https://pagepro.co/blog/astro-nextjs/)
- [Next.js vs Astro in 2026 — Cosmic](https://www.cosmicjs.com/blog/nextjs-vs-astro-choosing-the-right-framework-for-your-project)
- [Next.js vs. Astro in 2025: Marketing Website — Makers' Den](https://makersden.io/blog/nextjs-vs-astro-in-2025-which-framework-best-for-your-marketing-website)
- [Astro vs. Next.js: Features, performance, use cases — Contentful](https://www.contentful.com/blog/astro-next-js-compared/)
- [Astro in 2026: Why It's Beating Next.js for Content Sites (Cloudflare acquisition) — DEV](https://dev.to/polliog/astro-in-2026-why-its-beating-nextjs-for-content-sites-and-what-cloudflares-acquisition-means-6kl)
- [Why Astro? — Astro Docs](https://docs.astro.build/en/concepts/why-astro/)
- [Best Static Site Generators 2026 — The Software Scout](https://thesoftwarescout.com/best-static-site-generators-2026-astro-next-js-hugo-more/)

**טיפול בטופס (Form backend):**
- [The Best Form Backend for Static Sites in 2026 — DEV](https://dev.to/allenarduino/the-best-form-backend-for-static-sites-in-2026-1fae)
- [7 Best Form Backend Services in 2026 — Forminit](https://forminit.com/blog/best-form-backend-services-2026/)
- [Formspree Alternatives: 6 Form Backends Compared (2026) — Un-static](https://un-static.com/alternative/formspree/)
- [Formspree](https://formspree.io/) · [Web3Forms](https://findfree.org/resource/web3forms)

**ביצועים (Core Web Vitals):**
- [Core Web Vitals 2026: INP, LCP & CLS Optimization Guide — Digital Applied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)
- [What Are the Core Web Vitals? LCP, INP & CLS Explained (2026)](https://www.corewebvitals.io/core-web-vitals)
- [How Core Web Vitals thresholds were defined — web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds)

**אירוח ודומיין:**
- [Cloudflare Pages vs Netlify vs Vercel: Static Site Hosting Compared (2026) — DanubeData](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)
- [Vercel vs Netlify vs Cloudflare Pages in 2026 — CoderFile](https://coderfile.io/blog/vercel-vs-netlify-vs-cloudflare-2026)
- [רישום דומיין — איגוד האינטרנט הישראלי (ISOC)](https://www.isoc.org.il/domain-name-registry/manage-register-domain/register-new-domain)
- [כללי רישום IL. — ISOC](https://www.isoc.org.il/domain-name-registry/il-domain-rules)
- [בניית אתר סטטי בעלות מינימלית (Cloudflare + דומיין) — Techwaiz](https://techwaiz.co.il/create-a-static-website/)
