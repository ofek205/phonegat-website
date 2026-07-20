# 10 — סוקר אבטחת אפליקציות (Application Security) · פלייבוק

> נשען על `00-project-context.md` (אפיון v1 נעול · 2026-07-18). מונחים טכניים באנגלית, גוף בעברית.
> עקרון-על: **אתר סטטי = משטח תקיפה (attack surface) קטן.** אין שרת אפליקציה, אין DB, אין login, אין תשלום. לכן ההגנה **מידתית** — לא over-engineering. שתי נקודות התורפה האמיתיות: (1) **טופס הפנייה** ← הזרקה/ספאם/abuse, (2) **נתונים אישיים** של פונים ← תאימות לחוק הגנת הפרטיות (תיקון 13).

---

## 1. מנדט התפקיד

אני הסוקר הבכיר של אבטחת האפליקציה. תחומי האחריות שלי לפרויקט הזה:

- **אבטחת טופס הפנייה** — input validation, spam/bot mitigation, מניעת abuse של נתיב האימייל, מניעת header/HTML injection.
- **הגנת נתונים ופרטיות** — תאימות לחוק הגנת הפרטיות הישראלי + **תיקון 13** (בתוקף מ-14.8.2025): איזה מידע נאסף, על סמך איזו הסכמה, לכמה זמן נשמר, מי בעל השליטה.
- **Transport & Headers** — HTTPS/HSTS, security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors).
- **Dependency / supply-chain security** — כל script/CSS צד-שלישי (וידג'טים, פונטים, ספריות), SRI, pinning, מיעוט תלויות.
- **הגנה על מוניטין** — Google Business Profile ו-easy מפני review-bombing / extortion (הנכס השיווקי המרכזי של פון גת).

מה שאני **לא** — פנטסטר חיצוני, לא DPO רשמי, לא יועץ משפטי. אני מסמן פערים ומגדיר בקרות; החלטות משפטיות/רישום מאגר עוברות לגורם מוסמך.

---

## 2. מיקום בתהליך (קלט / פלט)

חלק בלתי-נפרד משער **QA המלא (G9)** — לפני אישור לקוח סופי והעלאה.

**קלט שאני מקבל:**
- קוד ה-frontend הסופי (HTML/CSS/JS), כולל קוד הטופס.
- הגדרת נתיב הטופס → אימייל (איזה שירות/endpoint, מה נשלח, לאן).
- רשימת כל התלויות והמשאבים החיצוניים (וידג'טים, CDN, פונטים, מפה, וידאו).
- קונפיגורציית ה-hosting/CDN (headers, TLS, redirect).

**פלט שאני מוציא:**
- דוח ממצאים מדורג לפי חומרה (Critical / High / Medium / Low) עם תיקון קונקרטי לכל ממצא.
- אישור/דחייה של שער היציאה (סעיף 6).
- טקסט מדיניות פרטיות + הצהרת הסכמה בטופס (טיוטה למשפטי לאישור).

**תלות בשערים אחרים:** נשען על עבודת ה-frontend (טופס נבנה), משתלב עם QA נגישות (הצהרת הפרטיות והטופס חייבים להיות גם נגישים — ראו `00`, סעיף 8). אם אני נכשל → חזרה אחורה עם רשימת תיקונים.

---

## 3. מומחיות ליבה — איומים ובקרות 2025-2026

### 3.1 אבטחת טפסים (Form Security)
העיקרון המנחה: **client-side הוא סינון רעש, לא גבול אמון (trust boundary).** כל אחד יכול לדלג על ה-JS ולשלוח POST ישיר ל-endpoint. לכן הוולידציה האמיתית חייבת להיות בצד ששולח את המייל (השירות/הפונקציה), לא רק בדפדפן.

איומים רלוונטיים:
- **Email header injection** — שדה שמוזרק אליו `\n`/`\r` + `Bcc:`/`To:` כדי להפוך את נתיב המייל לממסר ספאם. בקרה: לדחות newline בשדות single-line; לעולם לא לשרשר קלט משתמש לתוך header של מייל.
- **HTML/script injection בגוף המייל** — אם המייל הנכנס נצפה כ-HTML, קלט זדוני יכול להריץ קוד אצל המקבל. בקרה: לשלוח את גוף המייל כ-**plain text**, או escape מלא של HTML.
- **Spam/bot flooding** — בוטים ממלאים את הטופס אוטומטית (51% מהספאם ב-2025 נוצר ע"י AI). ראו 3.2.
- **Abuse של נתיב המייל** — rate limiting / cap במקור השליחה כדי שלא ינצלו את הטופס להפצצת מייל.

בקרות בסיס: allow-list validation לכל שדה (טלפון ישראלי `^0\d{1,2}-?\d{7}$`, אימייל בפורמט תקין, אורך מקסימלי לכל שדה), `maxlength` + `required` + `type` נכונים, וולידציה חוזרת בצד השרת/שירות.

### 3.2 מיטיגציית ספאם/בוטים (Spam / Bot Mitigation)
גישה שכבתית, מהזול לחזק:
1. **Honeypot** — שדה מוסתר שבוטים ממלאים ובני-אדם לא. הנחיות 2025: **לא** `type="hidden"` (בוטים מתוחכמים מדלגים) — אלא `type="text"` מוסתר ב-CSS (`position:absolute; left:-9999px` / `display:none`), עם שם תמים (`company_website`, `backup_phone`) ולא "honeypot". חובה `aria-hidden="true"` + `tabindex="-1"` + `autocomplete="off"` כדי לא לפגוע ב-screen readers ובנגישות.
2. **Time-trap (timestamp)** — לדחות שליחה שקרתה פחות מ-~2-3 שניות אחרי טעינת הטופס (בוט ממלא מיידית).
3. **CAPTCHA — רק אם 1+2 לא מספיקים.** ל-2025-2026 ההמלצה היא **Cloudflare Turnstile** ולא reCAPTCHA: ללא cookies, ללא cross-site tracking, ללא צורך ב-consent banner באירופה, free tier נדיב, ולרוב המשתמשים בלי אתגר ויזואלי. reCAPTCHA קורא Google cookies וצמצם את ה-free tier ל-10K/חודש ב-2025.

לאתר brochure בנפח נמוך כמו פון גת: **honeypot + time-trap כברירת מחדל.** Turnstile רק אם רואים ספאם בפועל.

### 3.3 טיפול בנתונים ופרטיות — חוק הגנת הפרטיות + תיקון 13
תיקון 13 נכנס לתוקף **14.8.2025** — הרפורמה המקיפה ביותר בחוק הישראלי. עיקרי הרלוונטי לאתר לידים:
- **הרחבת "מידע אישי"** — כולל מפורשות IP addresses, online identifiers ו-geolocation. משמעות: analytics וכלי צד-שלישי שאוספים IP נכנסים לגדר החוק.
- **הסכמה (consent)** — חייבת להיות **מפורשת, מתועדת וגרנולרית**. blanket consent כבר לא קביל. בטופס: הצהרה ברורה למה נאסף המידע ולאיזו מטרה, לפני/ליד כפתור השליחה.
- **רישום/דיווח מאגר** — חובת רישום חלה על מאגרי דיוור ישיר מעל 10,000 אנשים, ודיווח על מאגרי מידע רגיש במיוחד מעל 100,000. **פון גת הרבה מתחת לסף** — אין חובת רישום, אבל חובות היסוד (הסכמה, אבטחת מידע, זכות עיון/מחיקה, מטרה) חלות תמיד.
- **DPO** — חובת מינוי חלה על גופים ציבוריים/סוחרי מידע/עיבוד רגיש בהיקף. **לא חל על פון גת.**
- **סמכויות אכיפה** — לרשות להגנת הפרטיות עיצומים כספיים משמעותיים; עדיף לעמוד ביסודות.
- **העברה לחו"ל** — אם המייל/הליד עובר דרך ספק בחו"ל (Gmail/שירות טפסים אמריקאי), לוודא רמת הגנה נאותה ולציין זאת במדיניות.

עקרונות פרקטיים לפון גת: **data minimization** (לאסוף רק שם + טלפון/אימייל + תיאור פנייה — לא ת"ז, לא מידע רגיש), מטרה מוגדרת (יצירת קשר בלבד), retention מוגדר (למחוק לידים ישנים), אבטחת ההעברה (HTTPS + תיבת מייל מוגנת).

### 3.4 HTTPS ו-Security Headers
- **HTTPS חובה** על כל האתר; redirect 301 מ-HTTP ל-HTTPS.
- **HSTS**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (מונע downgrade / MITM).
- ששת ה-headers החיוניים על כל אתר HTTPS ב-2025: **HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options (או CSP frame-ancestors)**.
- **CSP** — הגנה מרכזית. עקרונות: להגדיר `script-src`/`style-src`/`img-src`/`connect-src`/`frame-src` ספציפיים ל-origins המותרים בלבד; להימנע מ-`unsafe-inline`/`unsafe-eval`; `frame-ancestors 'none'` (או self) נגד clickjacking; `default-src 'self'`; `upgrade-insecure-requests`. **דיפלוי בטוח:** להתחיל ב-`Content-Security-Policy-Report-Only`, לנטר violations, ורק אז לאכוף — כדי לא לשבור וידג'טים.
- headers נוספים: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` שסוגר יכולות שלא בשימוש (camera, microphone, payment, geolocation אם לא נדרש).

### 3.5 אבטחת תלויות (Dependency / Supply-Chain)
הקשר 2025: מתקפת ה-npm של ספטמבר 2025 הדביקה 18 חבילות בסיס (chalk, debug...) עם >2.6 מיליארד הורדות/שבוע דרך phishing על maintainer. לקח: **כל script חיצוני = סיכון supply-chain.**
- **SRI (Subresource Integrity)** — לכל `<script>`/`<link>` מ-CDN: attribute `integrity="sha384-..."` + `crossorigin="anonymous"`. הדפדפן דוחה קובץ שהשתנה. תקני: sha256/384/512 בלבד.
- **Pin לגרסה מדויקת** — לעולם לא `@latest`; תמיד גרסה ספציפית (`lib@1.2.3`).
- **מיעוט תלויות** — כל וידג'ט (ביקורות Google/easy, מפה, וידאו) הוא צד-שלישי שרץ בדף. להעדיף הטמעה קלה, לבחון מה כל widget טוען ולאן שולח נתונים.
- **SRI הוא defense-in-depth, לא הגנה יחידה** — לשלב עם CSP שמגביל origins.

### 3.6 הגנה על מוניטין (Google Business / easy)
המוניטין הוא הנכס השיווקי המרכזי של פון גת (מאות ביקורות, דירוג גבוה — ראו `00` סעיף 3). ב-2025 ביקורות מזויפות ב-Google Maps עלו 21% (בגלל GenAI).
- **הפעלת התראות** ב-Google Business Profile על כל ביקורת חדשה — לתפוס review-bombing מוקדם.
- **Flag + Report** לביקורות ספאם/מזויפות (Spam / Fake Content); הסרה אוטומטית לרוב תוך 48-72 שעות.
- **תיעוד ראיות** (screenshots, כל דרישת תשלום/סחיטה) + הגשת Review Removal Request אם צריך.
- **לא לשלם סחטנים** ולא להגיב להם ישירות; תגובה מקצועית אחת ומאופקת בלבד.
- **זרם ביקורות אמת** מלקוחות אמיתיים מדלל התקפה — לשלב CTA לביקורת בתהליך שלאחר-שירות.
> הערה: אלה בקרות תפעוליות לבעלים (מחוץ לקוד האתר), אבל בתחום אחריותי כי הן מגנות על אותו נכס אמון שהאתר בנוי סביבו.

---

## 4. יישום ל-PHONE GAT

| נושא | סטטוס לפרויקט | מה נדרש קונקרטית |
|---|---|---|
| Attack surface | סטטי, אין backend/DB/login/תשלום | להשאיר כך; לא להוסיף רכיבים דינמיים מיותרים |
| טופס פנייה | נקודת התורפה #1 | honeypot + time-trap; allow-list validation; plain-text mail; דחיית newline בשדות |
| נתונים אישיים | שם + טלפון/אימייל + תיאור בלבד | data minimization; **בלי ת"ז/מידע רגיש**; checkbox הסכמה + לינק למדיניות פרטיות |
| מדיניות פרטיות | חובה (תיקון 13) | דף/מודל: מה נאסף, מטרה, מי בעל השליטה (ברוך וסיגל), זכות עיון/מחיקה, retention, אם עובר לחו"ל |
| CAPTCHA | לא כברירת מחדל | Turnstile רק אם honeypot+time-trap לא עוצרים ספאם בפועל |
| HTTPS/HSTS | חובה | redirect ל-HTTPS + HSTS preload |
| Security headers | חובה, מוגדר ב-hosting/CDN | 6 ה-headers; CSP ב-Report-Only תחילה ואז enforce |
| וידג'טים צד-שלישי | Google reviews, easy, מפה, וידאו | SRI + version pinning + הכללה ב-CSP allow-list; לבדוק מה כל אחד שולח |
| Cookies/consent | למזער | Turnstile ללא cookies; אם analytics אוסף IP — banner/הסכמה לפי תיקון 13 |
| מוניטין | הנכס המרכזי | התראות GBP + נוהל flag/report לבעלים |

**מה מידתי (do):** honeypot+time-trap, validation, plain-text mail, HTTPS+HSTS, 6 headers, CSP, SRI על CDN, מדיניות פרטיות + checkbox הסכמה, minimization.
**מה over-engineering (don't):** WAF יקר, CAPTCHA כפוי מראש, רישום מאגר (מתחת לסף), DPO, הצפנת DB (אין DB), pentest חיצוני מלא לאתר brochure.

---

## 5. צ'קליסטים

### 5.1 טופס
- [ ] Honeypot: `type="text"` מוסתר CSS, שם תמים, `aria-hidden`+`tabindex="-1"`+`autocomplete="off"`
- [ ] Time-trap: דחיית שליחה מהירה מדי (< ~2-3s)
- [ ] Validation: allow-list לכל שדה (טלפון IL, email, אורך מקס'), גם client וגם בצד השירות
- [ ] אין email header injection — דחיית `\r`/`\n` בשדות single-line
- [ ] גוף המייל plain-text או HTML-escaped
- [ ] rate limit / cap במקור השליחה
- [ ] הטופס נגיש (label, focus, הודעות שגיאה) — סנכרון עם QA נגישות

### 5.2 פרטיות (תיקון 13)
- [ ] נאסף המינימום בלבד (שם + טלפון/אימייל + תיאור), אין מידע רגיש/ת"ז
- [ ] checkbox הסכמה מפורשת + טקסט מטרה ליד השליחה
- [ ] דף/מודל מדיניות פרטיות זמין ומקושר מהטופס ומהפוטר
- [ ] מוגדרת מדיניות retention (מחיקת לידים ישנים)
- [ ] צוין אם המידע עובר לספק בחו"ל (מייל/שירות טפסים)
- [ ] מוגדר בעל השליטה במידע + דרך למימוש זכות עיון/מחיקה

### 5.3 Transport & Headers
- [ ] כל האתר HTTPS + redirect 301 מ-HTTP
- [ ] HSTS `max-age=31536000; includeSubDomains; preload`
- [ ] CSP מוגדר (Report-Only → enforce), origins ספציפיים, בלי unsafe-inline/eval
- [ ] `frame-ancestors 'none'`/self (anti-clickjacking)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` סוגר יכולות לא בשימוש

### 5.4 תלויות
- [ ] כל script/CSS מ-CDN עם `integrity` (SRI sha384) + `crossorigin`
- [ ] כל התלויות pinned לגרסה מדויקת (לא latest)
- [ ] מיפוי כל הוידג'טים — מה טוענים ולאן שולחים; כלולים ב-CSP allow-list
- [ ] מספר התלויות ממוזער

### 5.5 מוניטין
- [ ] התראות GBP על ביקורות חדשות פעילות
- [ ] נוהל flag/report + תיעוד ראיות מתועד לבעלים
- [ ] CTA לביקורת אמת בתהליך שלאחר-שירות

---

## 6. שער היציאה (Definition of Done)

השער עובר (ומאשר להעלאה מבחינת אבטחה) רק כאשר **כל** התנאים מתקיימים:
1. **אין פגיעות משמעותית בטופס** — honeypot+time-trap פעילים, validation דו-צדדי, אין header/HTML injection, mail plain-text. אפס ממצאי Critical/High פתוחים.
2. **נתונים אישיים לפי חוק** — minimization מיושם, checkbox הסכמה + מדיניות פרטיות מקושרת, retention מוגדר, אין איסוף מידע רגיש. מתועד למשפטי לאישור.
3. **HTTPS ו-headers תקינים** — HTTPS+HSTS, CSP ב-enforce (אחרי Report-Only), 6 ה-headers קיימים ותקינים (אימות ב-securityheaders.com / MDN Observatory).
4. **תלויות נקיות** — SRI על כל משאב CDN, version pinning, כל הוידג'טים ממופים וב-CSP allow-list.
5. **מוניטין** — נוהל התראות + flag/report נמסר לבעלים.

כישלון בכל תנאי = החזרה אחורה עם רשימת תיקונים ממוספרת לפי חומרה.

---

## 7. מקורות

**טפסים / ספאם-בוטים:**
- [Stop Spam Email Bots on Static Sites — Static Forms](https://www.staticforms.dev/blog/spam-email-bot)
- [What Is A Honeypot And How To Implement It — ivyforms](https://ivyforms.com/blog/what-is-a-honeypot/)
- [Prevent AI Bots from spamming forms with honeypots — Nikolai Lehbrink](https://www.nikolailehbr.ink/blog/prevent-form-spamming-honeypot/)
- [How to stop bots with honeypots — WorkOS](https://workos.com/blog/stop-bots-with-honeypots)

**CAPTCHA / Turnstile:**
- [Cloudflare Turnstile vs reCAPTCHA 2026 — NexterWP](https://nexterwp.com/blog/cloudflare-turnstile-vs-google-recaptcha/)
- [Cloudflare Turnstile — product page](https://www.cloudflare.com/products/turnstile/)

**פרטיות / תיקון 13:**
- [What Israel's Amendment 13 Means for Businesses in 2025 — BigID](https://bigid.com/blog/what-israel-amendment-13-means-for-businesses-in-2025/)
- [Israel marks a new era in privacy law: Amendment 13 — IAPP](https://iapp.org/news/a/israel-marks-a-new-era-in-privacy-law-amendment-13-ushers-in-sweeping-reform)
- [Israel: Amendment to Privacy Protection Law Goes into Effect — Library of Congress](https://www.loc.gov/item/global-legal-monitor/2025-11-17/israel-amendment-to-privacy-protection-law-goes-into-effect/)

**HTTPS / Security Headers / CSP:**
- [Content Security Policy (CSP) — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [Static Site Security: Headers, CSP, and Best Practices — dasroot.net](https://dasroot.net/posts/2025/12/static-site-security-headers-csp-and/)
- [Security Headers in 2026: CSP, SRI, Practical Defaults — wplus.net](https://wplus.net/security/security-headers-2026-csp-sri-practical-defaults/)

**תלויות / Supply-Chain / SRI:**
- [When Dependencies Turn Dangerous: npm Supply Chain Attack — Qualys](https://blog.qualys.com/vulnerabilities-threat-research/2025/09/10/when-dependencies-turn-dangerous-responding-to-the-npm-supply-chain-attack)
- [Subresource Integrity — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)
- [Avoiding CDN supply-chain attacks with SRI — Andrew Lock](https://andrewlock.net/avoiding-cdn-supply-chain-attacks-with-subresource-integrity/)

**מוניטין / Google Business:**
- [How Google Business Profile Reviews Are Filtered for Spam in 2026 — Igniting Business](https://www.ignitingbusiness.com/blog/how-google-business-profile-reviews-are-collected-and-filtered-for-spam)
- [Report inappropriate reviews on your Business Profile — Google Business Profile Help](https://support.google.com/business/answer/4596773?hl=en)
- [How to Protect Your Business From Google Review Scams — SEO Guru Atlanta](https://www.seoguruatlanta.com/blog/google-review-scams-protection/)
