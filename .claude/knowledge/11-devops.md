# 11 — DevOps / Infrastructure — פלייבוק תפקידי (PHONE GAT)

> נשען על `00-project-context.md` (אפיון v1 נעול · 2026-07-18). מונחים טכניים באנגלית, הסבר בעברית.
> תפקיד: מהנדס DevOps/תשתיות בכיר. אחראי על העלאה לאוויר, דומיין, HTTPS, אנליטיקס, ניטור ופריסה חוזרת.

---

## 1. מנדט התפקיד

להפוך את האתר הסטטי המאושר לנכס חי, מהיר, מאובטח ומדיד — ולוודא שכל פריסה עתידית תהיה **repeatable** (חוזרת, אוטומטית, בלי צעדים ידניים סמויים).

עקרונות מנחים לפרויקט הזה:
- **פשטות מעל הכל.** זהו אתר סטטי חד-עמודי בלי backend, בלי DB, בלי סל קניות. אין להכניס תשתית שלא נדרשת (no Kubernetes, no containers, no serverless functions אלא אם יתווסף טופס דינמי).
- **עלות אפס או קרובה לאפס.** תקציב עסק קטן. יעד: אירוח בחינם, דומיין בעלות שנתית נמוכה, כלים חינמיים בלבד.
- **זמן טעינה מהיר + SSL אוטומטי** — קריטי גם ל-UX וגם ל-SEO המקומי (יעד-העל של הפרויקט: להיות ראשון בגוגל בקרית גת).
- **אמינות (uptime).** אם הדף למטה, מפסידים לידים. ניטור חובה.
- **מדידות.** ה-KPI העסקי הוא פניות איכותיות (טלפון/וואטסאפ/טופס). בלי אנליטיקס אין דרך לדעת אם הדף עובד.
- **אבטחת סודות.** ה-tokens של הפריסה, ה-DNS ו-GA4 הם נכסים רגישים.

מה **לא** בתחום התפקיד: כתיבת קוד/עיצוב (frontend), תוכן שיווקי (copy), אפיון (PM). התפקיד מתחיל כשיש תוצר מאושר.

---

## 2. מיקום בתהליך (קלט/פלט)

זרימת השערים (מ-`00-project-context.md` §10):
עיצוב → QA-עיצוב → אישור לקוח → פיתוח → QA מלא → **אישור לקוח סופי (G10)** → **DevOps (כאן)** → אתר חי.

**קלט (מה שאני מקבל):**
- תיקיית build סטטית מאושרת (HTML/CSS/JS/assets) שעברה QA מלא כולל מעבר עיצובי ונגישות.
- אישור לקוח סופי (G10) — התחלת עבודתי מותנית בו.
- מזהי מותג לצורך רישום: שם עסק מדויק, כתובת, טלפונים, שעות (מ-§3), נכסי הוכחה חברתית קיימים (Google, easy, Facebook).
- החלטת דומיין מהלקוח (שם ה-domain הרצוי).

**פלט (מה שאני מספק):**
- אתר חי על דומיין ייעודי עם HTTPS.
- pipeline פריסה חוזרת (git push → deploy אוטומטי).
- GA4 פעיל ומאמת events (טלפון/וואטסאפ/טופס = Key Events).
- Google Business Profile מחובר ומקושר לדומיין (NAP עקבי).
- ניטור uptime פעיל עם התראות.
- מסמך handover קצר: איפה הכל, איך מפרסמים שינוי, למי ההתראות מגיעות.

**תלויות עליי מבעלי תפקידים אחרים:**
- Frontend: build תקין, נתיבי assets יחסיים, `<head>` שמאפשר הזרקת snippet של GA4.
- לקוח: גישה/פרטים לרישום דומיין ולפתיחת/אימות Google Business Profile (אימות דורש בעלות על העסק — לרוב וידאו verification).

---

## 3. מומחיות ליבה (כלים ופלטפורמות 2025-2026)

### 3.1 Static hosting + deploy
שלוש הפלטפורמות המובילות לאתר סטטי, כולן עם free tier ו-SSL אוטומטי:
- **Cloudflare Pages** — free tier עם **unlimited bandwidth** (יתרון מהותי לאתר שמכוון לתנועה מקומית גבוהה), 500 builds/חודש, ה-CDN הגלובלי המהיר ביותר (300+ PoPs). SSL מונפק אוטומטית תוך 5-15 דק'. אינטגרציית Git ל-auto-deploy.
- **Netlify** — הפשוט ביותר לאתרים סטטיים/Jamstack. free tier: 100GB bandwidth + 300 build minutes. כולל built-in forms (יתרון אם הטופס יהפוך לדינמי), redirects, deploy previews.
- **Vercel** — מצטיין ל-Next.js; overkill לאתר HTML סטטי טהור. free tier: 100GB bandwidth.

לאתר HTML/CSS/JS סטטי טהור בעברית עם דגש על מהירות בישראל ותקציב אפס — **Cloudflare Pages** הוא הבחירה החזקה ביותר (unlimited bandwidth + מהירות + DNS+SSL באותה מערכת). פירוט ההמלצה ב-§4.

### 3.2 רישום דומיין .co.il ו-DNS
- רישום .il / .ישראל דרך **ISOC** (איגוד האינטרנט הישראלי) מתבצע רק דרך **רשם מוסמך (accredited registrar)** — לא ישירות מול ISOC.
- בדיקת זמינות ב-**WHOIS** של ISOC לפני רכישה.
- בעת הרישום מזינים: פרטי מחזיק (holder), אנשי קשר, ו-**NS records** (nameservers) של ספק ה-hosting/DNS. אם ה-NS לא ידועים ברישום — אפשר להשלים מאוחר יותר בממשק הרשם.
- תקופת רישום: שנה עד 5 שנים.
- **המלצה ארכיטקטונית:** להעביר את ה-nameservers לניהול Cloudflare ולנהל את כל ה-DNS records שם (מקבל DNS מהיר + SSL + חיבור Pages בקליק).

### 3.3 SSL/HTTPS
בכל שלוש הפלטפורמות ה-SSL אוטומטי ומתחדש לבד. אין לרכוש/לנהל certificate ידני. חובה: לאכוף **HTTPS redirect** (HTTP→HTTPS) ו-**HSTS**. לוודא שגם `domain.co.il` וגם `www.domain.co.il` מכוסים.

### 3.4 Analytics — GA4
- התקנה באתר סטטי: הזרקת snippet **gtag.js** ב-`<head>` (או דרך GTM אם רוצים גמישות עתידית).
- להפעיל **Enhanced Measurement** מיום ראשון (page_view, scroll, outbound clicks, file downloads אוטומטית).
- להגדיר **custom events** שממופים ל-KPI: קליק על "התקשר", קליק על WhatsApp, שליחת טופס — ולסמן אותם כ-**Key Events** (conversions).
- אחרי התקנה: **exclude internal traffic** (IP של החנות), להעלות **data retention ל-14 חודשים**, לאמת ב-**DebugView**.

### 3.5 Google Business Profile (קידום מקומי)
- הנכס החשוב ביותר ל-Local SEO וליעד-העל של הפרויקט (ראשון בגוגל בקרית גת).
- Claim/verify ב-`business.google.com` (לרוב video verification, מיידי).
- **NAP consistency** (Name/Address/Phone) — זהה בול בין GBP, האתר, easy, Facebook. אי-עקביות פוגעת בדירוג.
- category ראשי מדויק (למשל "חנות טלפונים סלולריים") + secondary (תיקון סלולר).
- description 750 תווים, keywords חשובים ב-250-300 הראשונים.
- קישור ה-website field לדומיין החדש.
- תמונות באיכות גבוהה (פרופיל עם תמונות מקבל +42% בקשות ניווט).
- posts שבועיים + מענה לכל הביקורות = signal פעילות לגוגל.

### 3.6 Uptime monitoring
- **UptimeRobot** — free tier נדיב: 50 monitors, 5-min interval, HTTP/HTTPS+ping, אפליקציות iOS/Android. הבחירה הטבעית לפרויקט הזה.
- **Better Stack** — עשיר יותר (incident management, status page) אבל free tier מוגבל ל-5 monitors; overkill כאן.
- להגדיר: monitor על `https://domain.co.il`, alert contact לאימייל (ואפשר SMS/push), keyword monitor שמוודא שמופיע טקסט מהדף (מזהה "up אבל שבור").

### 3.7 CI/CD לפריסה חוזרת
- **Git-based continuous deployment**: repo ב-GitHub → חיבור ל-Cloudflare Pages / Netlify → כל push ל-branch הראשי מפעיל build+deploy אוטומטי.
- **deploy previews** לכל PR (בדיקה לפני מיזוג).
- rollback מיידי דרך היסטוריית ה-deployments בפלטפורמה.
- אין צורך ב-GitHub Actions ייעודי לאתר סטטי — האינטגרציה המובנית מספיקה. Actions נדרש רק אם יש build step מותאם.

---

## 4. יישום ל-PHONE GAT (המלצה מנומקת)

### 4.1 המלצת אירוח + פריסה
**Cloudflare Pages** + **GitHub** לניהול קוד.

נימוק:
1. **עלות אפס** — free tier מספיק בקלות לאתר חד-עמודי מקומי.
2. **Unlimited bandwidth** — אם הדף יתפוס ויקבל תנועה גבוהה מ-Google/Facebook, לא נופתע בחשבון (בניגוד ל-Netlify/Vercel שגובים על overage).
3. **מהירות** — CDN הכי מהיר, קריטי ל-Core Web Vitals ולדירוג SEO.
4. **DNS + SSL + hosting במערכת אחת** — אם מנהלים את הדומיין ב-Cloudflare, החיבור בין הדומיין ל-Pages, ה-SSL, וה-HTTPS redirect קורים כמעט אוטומטית.
5. **Repeatable deploy מובנה** — git push → live, בלי צעדים ידניים.

חלופה קבילה: **Netlify** — אם בעתיד הטופס יהפוך לדינמי (Netlify Forms מובנה חוסך backend). אם זה קורה, לשקול מעבר.

### 4.2 שלבי רכישת דומיין .co.il והכוונת DNS
1. לבחור שם דומיין עם הלקוח (למשל `phonegat.co.il`) ולבדוק זמינות ב-WHOIS של ISOC.
2. לרכוש דרך **רשם מוסמך** של ISOC (הלקוח = holder; הבעלות על שם הלקוח/העסק, לא על שמי).
3. להוסיף את הדומיין כ-zone ב-Cloudflare → Cloudflare נותן זוג **nameservers**.
4. בממשק הרשם: להחליף את ה-NS records ל-nameservers של Cloudflare (propagation עד 24-48 שעות, בפועל לרוב מהיר).
5. ב-Cloudflare Pages → הפרויקט → **Custom domains**: להוסיף גם `domain.co.il` וגם `www.domain.co.il`. ה-CNAME/records נוצרים אוטומטית כשה-zone מנוהל ב-Cloudflare.
6. לאכוף **Always Use HTTPS** + HSTS. להמתין ל-SSL (5-15 דק').

> ⚠️ הדומיין חייב להירשם על שם **הלקוח (ברוך/סיגל)**, לא על שם ספק/מפתח — מניעת בעיית בעלות עתידית.

### 4.3 GA4 + Google Business Profile
- **GA4:** לפתוח property, ליצור Web data stream, להזריק gtag.js ל-`<head>` (בתיאום עם Frontend). להגדיר Key Events: `click_call`, `click_whatsapp`, `form_submit`. לאמת ב-DebugView. exclude internal traffic + retention 14 חודשים.
- **GBP:** לאמת/לתבוע את הפרופיל הקיים (יש כבר דירוג גבוה עם מאות ביקורות — **לא ליצור פרופיל חדש**, לתבוע את הקיים). לוודא NAP זהה בול לאתר. לחבר את ה-website field לדומיין החדש. לוודא category, שעות, תמונות. זה המנוע של הקידום המקומי.

---

## 5. צ'קליסטים

### 5.1 Pre-deploy (לפני העלאה)
- [ ] התקבל אישור לקוח סופי (G10).
- [ ] build עבר QA מלא (עיצוב + נגישות ת"י 5568/WCAG AA).
- [ ] נתיבי assets יחסיים ותקינים; אין broken links.
- [ ] `<head>` מוכן להזרקת GA4; `lang=he` + `dir=rtl` קיימים.
- [ ] repo ב-GitHub עם ה-build הסופי, branch ראשי מוגדר.
- [ ] קובץ `robots.txt` + `sitemap.xml` קיימים (SEO).
- [ ] meta tags: title, description, Open Graph, favicon.

### 5.2 Deploy + Domain + SSL
- [ ] Cloudflare Pages project מחובר ל-GitHub repo (auto-deploy on push).
- [ ] deploy ראשון עלה ונבדק ב-`*.pages.dev`.
- [ ] דומיין .co.il נרכש דרך רשם מוסמך, על שם הלקוח.
- [ ] nameservers הופנו ל-Cloudflare; zone פעיל.
- [ ] `domain.co.il` + `www` נוספו ב-Custom domains.
- [ ] SSL פעיל (green); Always Use HTTPS + HSTS מופעלים.
- [ ] בדיקה: הדף נטען ב-HTTPS משני הווריאנטים ומ-mobile.

### 5.3 Analytics
- [ ] GA4 property + Web stream נוצרו.
- [ ] gtag.js מוזרק בכל טעינת דף; Enhanced Measurement פעיל.
- [ ] Key Events: click_call, click_whatsapp, form_submit — מוגדרים ומסומנים כ-conversions.
- [ ] internal traffic מוחרג; data retention = 14 חודשים.
- [ ] אומת ב-DebugView שה-events נכנסים.

### 5.4 Google Business Profile
- [ ] הפרופיל הקיים נתבע/אומת (לא נוצר חדש).
- [ ] NAP זהה בול בין GBP / אתר / easy / Facebook.
- [ ] website field → דומיין חדש.
- [ ] category ראשי + secondary; description עם keywords.
- [ ] תמונות + שעות עדכניות.

### 5.5 Monitoring + Handover
- [ ] UptimeRobot monitor על הדומיין (5-min, HTTPS + keyword check).
- [ ] alert contact = אימייל של הלקוח/צוות; נבדק שהתראה מגיעה.
- [ ] rollback נבדק (חזרה ל-deployment קודם עובדת).
- [ ] מסמך handover: גישות, מיקומי הכל, נוהל פרסום שינוי, יעדי התראות.

---

## 6. שער היציאה (Definition of Done)

התוצר עובר את השער **רק אם כל אלה מתקיימים**:
1. ✅ האתר **חי על הדומיין** הייעודי (.co.il) ונטען מ-`domain.co.il` ומ-`www`.
2. ✅ **HTTPS** פעיל עם certificate תקף, HTTP→HTTPS redirect ו-HSTS.
3. ✅ **GA4** פעיל — page views ו-Key Events (call/whatsapp/form) מאומתים ב-DebugView.
4. ✅ **Google Business Profile** מחובר, מאומת, NAP עקבי, website → הדומיין.
5. ✅ **Uptime monitoring** פעיל עם התראות שנבדקו בפועל.
6. ✅ **פריסה חוזרת (repeatable)** — git push מפרסם אוטומטית; rollback נבדק; handover תועד.

כישלון בכל סעיף = השער נכשל, חזרה עם רשימת תיקונים (לפי §10 באפיון).

---

## 7. מקורות

**Static hosting / deploy**
- [Vercel vs Netlify vs Cloudflare Pages: 2025 Comparison — digitalapplied](https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison)
- [Cloudflare Pages vs Netlify vs Vercel: Static Hosting 2026 — DanubeData](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)
- [6 best free static website hosting services compared — Appwrite](https://appwrite.io/blog/post/best-free-static-website-hosting)
- [Custom domains · Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Onboard a domain · Cloudflare Fundamentals docs](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/)

**דומיין .il / DNS (ISOC)**
- [מדריך לרישום דומיין — איגוד האינטרנט הישראלי](https://www.isoc.org.il/domain-name-registry/how-to-choose-a-domain)
- [רישום דומיין חדש — ISOC](https://www.isoc.org.il/domain-name-registry/manage-register-domain/register-new-domain)
- [רשמים מוסמכים — ISOC](https://www.isoc.org.il/domain-name-registry/accredited-registrars/domain-name-registrars)
- [כללי רישום IL. — ISOC](https://www.isoc.org.il/domain-name-registry/il-domain-rules)

**GA4**
- [Google Analytics 4 Complete Setup Guide: 2025 — digitalapplied](https://www.digitalapplied.com/blog/google-analytics-4-complete-setup-guide)
- [How to Install GA4 in 2026 — Analytics Mania](https://www.analyticsmania.com/post/how-to-install-google-analytics-4-with-google-tag-manager/)
- [GA4 Best Practices — Analytics Mania](https://www.analyticsmania.com/post/google-analytics-4-best-practices/)

**Google Business Profile / Local SEO**
- [How to Improve Local SEO With Google My Business: 2025 — SEO Space](https://www.seospace.co/blog/local-seo-google-my-business)
- [Google Business Profile Optimization: Complete 2025 Guide — Portland Peak SEO](https://portlandpeakseo.com/2025/09/23/google-business-profile-optimization-2025-guide/)
- [Google Business Profile Best Practices — Forge Digital Marketing](https://forgedigitalmarketing.com/google-business-profile-best-practices-your-local-seo-secret-weapon/)

**Uptime monitoring**
- [11 Best Uptime Monitoring Tools in 2026 — UptimeRobot](https://uptimerobot.com/knowledge-hub/monitoring/11-best-uptime-monitoring-tools-compared/)
- [UptimeRobot vs Better Stack — PerkyDash](https://perkydash.com/compare/uptimerobot-vs-betterstack)
- [10 Best Website Uptime Monitoring Tools 2026 — Better Stack](https://betterstack.com/community/comparisons/website-uptime-monitoring-tools/)
