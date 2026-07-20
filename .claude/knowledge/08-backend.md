# 08 — Backend Engineer · פלייבוק תפקידי (PHONE GAT)

> נשען על `00-project-context.md` (אפיון v1 נעול · 2026-07-18). מונחים טכניים באנגלית, גוף המסמך בעברית.
> תחום אחריות ממוקד: **זרימת טופס פנייה → אימייל** (ובעתיד → Telegram bot). אין מסחר, אין משתמשים, אין DB כבד.

---

## 1. מנדט התפקיד

אני ה-Backend Engineer של דף הנחיתה. במיזם הזה ה-backend הוא **דק בכוונה** — אין API עסקי, אין אימות משתמשים, אין בסיס נתונים תפעולי. כל מטרתו: לקחת פנייה שהלקוח מילא בטופס, **לוודא שהיא לגיטימית**, ולהעביר אותה **בוודאות** ליעד שבו ברוך וסיגל יראו אותה (אימייל היום, אולי Telegram מחר).

עקרונות עבודה:
- **Deliverability מעל הכל.** ליד שלא הגיע = לקוח שאבד. כל כשל שליחה חייב fallback גלוי (טלפון/וואטסאפ).
- **Minimal footprint.** אין server קבוע ויקר. הכל serverless / static-friendly.
- **Server-side is the source of truth.** ולידציה והגנת ספאם בצד לקוח הן UX בלבד; ההחלטה הביטחונית נופלת בצד שרת.
- **Privacy by design.** אוספים רק מה שצריך (שם, טלפון, תוכן קצר), חושפים למי המידע עובר, ומאפשרים מחיקה — בהתאם לתיקון 13 לחוק הגנת הפרטיות (בתוקף 14.8.2025).
- **המראה האנושי לא נפגע.** הגנת הספאם חייבת להיות invisible/low-friction — בלי CAPTCHA מציק שמרגיש כמו "אתר AI".

---

## 2. מיקום בתהליך (קלט / פלט)

**קלט — מקבל מ-Tech Lead:**
- אפיון שדות הטופס (שם, טלפון, סוג פנייה, הודעה חופשית — email אופציונלי).
- ה-Frontend כבר בנה את ה-`<form>` הנגיש (labels, RTL, focus), כולל תצוגת מצבי success/error.
- החלטת ארכיטקטורה על פלטפורמת האירוח (static host + serverless).

**פלט — מחזיר ל-Tech Lead (שער G7):**
- endpoint/integration שמקבל את הטופס, מוודא, ושולח את הליד לאימייל היעד.
- הגנת ספאם פעילה + ולידציית server-side.
- טיפול בכשל שליחה עם fallback לטלפון.
- תיעוד קצר: איפה מוגדרים ה-secrets, איך מחליפים יעד, ואיך מפעילים את ה-Telegram hook בעתיד.

**גבולות גזרה:** אני לא מעצב את הטופס (UX/Frontend), לא כותב את הטקסטים (Copy), ולא מחליט על ניסוח מדיניות הפרטיות (PM/משפטי) — אבל אני **מספק את הדרישות הטכניות** להם (אילו שדות, אילו הסכמות, מי ה-processors).

---

## 3. מומחיות ליבה — השוואת פתרונות 2025-2026

### 3א. טופס → אימייל: שתי משפחות פתרונות

**משפחה A — Form-backend as a service (בלי שרת בכלל):**
ה-`<form>` עושה `POST` ישירות לשירות חיצוני שמעביר לאימייל.

| שירות | Free tier | Data residency | DPA | הערות |
|---|---|---|---|---|
| **Web3Forms** | ~250/חודש | US-East, **אין** EU option | **אין DPA** | הכי פשוט, honeypot מובנה, access-key בלבד |
| **Formspree** | ~50/חודש | AWS US | יש DPA + SOC 2 | בוגר, reCAPTCHA מובנה |
| **Static Forms / Formspark** | 500 / משתנה | משתנה | חלקי | Altcha (privacy-first CAPTCHA) ב-Static Forms |
| **EmailJS** | מוגבל | US | חלקי | הטוקן נחשף בצד client — פחות בטוח |

יתרון: זמן הקמה של דקות, zero maintenance. חיסרון: המידע האישי (טלפון/שם) עובר ל-processor אמריקאי **בלי DPA** (Web3Forms), אין שליטה בולידציה/rate-limit, ומעבר עתידי ל-Telegram דורש הגירה.

**משפחה B — Serverless function + email API (backend דק משלנו):**
ה-`<form>` עושה `POST` ל-function שלנו (Cloudflare Pages Functions / Netlify Functions / Vercel). ה-function מבצע ולידציה, הגנת ספאם, rate-limit, שולח מייל דרך **email API** ומחזיר תשובה.

| רכיב | אפשרויות 2025-2026 | המלצה |
|---|---|---|
| Runtime | Cloudflare Pages Functions (Workers), Netlify Functions, Vercel | **Cloudflare** — free tier נדיב, KV ל-rate-limit, אזור EU זמין |
| Email API | **Resend** (100/יום free, DX מצוין), MailChannels, Postmark, SMTP קיים | **Resend** אם אין SMTP; אחרת SMTP של הדומיין |
| Deliverability | SPF + DKIM + DMARC על דומיין השולח | חובה — אחרת נופל לספאם |

יתרון: שליטה מלאה בולידציה/ספאם/rate-limit, ה-secrets לא נחשפים, וה-Telegram hook הוא עוד `fetch` אחד באותה function. חיסרון: מעט קוד לתחזק.

### 3ב. הגנת ספאם — שכבות (defense in depth)

הקונצנזוס ל-2025-2026: **לא לסמוך על שכבה אחת**. שילוב זול ולא מציק:

1. **Honeypot** — שדה נסתר (`display:none` + `aria-hidden` + `tabindex=-1`) שבוט ממלא ואדם לא. אם מלא → זרוק בשקט. חינם, zero friction, privacy-friendly. חלש מול בוטים מתוחכמים לבד.
2. **Time-trap** — חותמת זמן בטעינת הטופס; אם ההגשה מתחת ל-~2-3 שניות → כנראה בוט. חינם, invisible.
3. **CAPTCHA-class (invisible)** — כשצריך שכבה חזקה:
   - **Cloudflare Turnstile** ✅ — invisible, **חינם ללא הגבלת נפח**, GDPR-friendly, מהיר יותר מ-reCAPTCHA, **אין** שליחת cookies/behavioral ל-Google. **הבחירה המומלצת ל-2026.**
   - reCAPTCHA v3 — שולח IP + behavioral + cookies ל-Google (US) → דורש הסכמה/מנגנון העברה. לא מומלץ לאתר עם רגישות פרטיות.
   - Altcha / hCaptcha — חלופות privacy-first טובות.
   - **חובה: אימות ה-token בצד שרת** — אחרת חסר ערך.
4. **Rate limiting** — הגבלת הגשות לכל IP (למשל 3-5 לשעה) דרך KV/edge. חוסם spam-floods.

> לדף פנייה של עסק קטן, השילוב **honeypot + time-trap + Turnstile invisible + rate-limit** מכסה כמעט הכל בלי חיכוך ובלי לפגוע בתחושה האנושית.

### 3ג. Server-side validation

לעולם לא לסמוך על ולידציית ה-client (ניתנת לעקיפה). בצד שרת:
- **חובה:** שם לא ריק, טלפון בפורמט ישראלי תקין (regex ל-`05X-XXXXXXX` / קווי), הודעה לא ריקה.
- **אורכים:** שם ≤ 80, טלפון ≤ 20, הודעה ≤ 2000 — הגנה על downstream.
- **Sanitization:** ניקוי/escaping לפני הכנסה לגוף המייל (מניעת header injection ו-XSS אם מוצג אי-פעם).
- **Content-Type / method:** לקבל רק `POST`, לדחות אחר.
- **email אופציונלי:** אם קיים — לוודא פורמט; אם ריק — לא לחסום (הטלפון הוא הליד האמיתי).

### 3ד. פרטיות — תיקון 13 לחוק הגנת הפרטיות (ישראל, בתוקף 14.8.2025)

חל על **כל** עסק שאוסף מידע אישי, כולל אתר תדמית עם טופס יצירת קשר. דרישות רלוונטיות ל-backend:
- **מדיניות פרטיות** נגישה: אילו נתונים נאספים, מטרת האיסוף, הבסיס החוקי, **צדדים שלישיים שהמידע עובר אליהם** (חשוב! — שירות הטופס/Resend/Cloudflare, כולל העברה לחו"ל), משך שמירה ומחיקה, וזכויות הגולש.
- **Data minimization** — לאסוף רק שם + טלפון + תוכן; email אופציונלי; לא לאסוף מה שלא צריך.
- **הסכמה שיווקית נפרדת** — אם רוצים להוסיף לרשימת דיוור: checkbox **נפרד, לא מסומן מראש**, עם הבהרה שזה לתכנים שיווקיים. פנייה בטופס = הסכמה לשירות/מענה בלבד, לא לדיוור.
- **Retention** — למחוק לידים ישנים; אם משתמשים בשירות חיצוני, לדעת את מדיניות המחיקה שלו (Web3Forms: 30 יום free / שנה ב-pro).
- **חשיפה:** הפרה חושפת לתביעה עד 50,000 ₪ ללא הוכחת נזק + עיצומים. שווה את ההקפדה.

### 3ה. Telegram bot hook (הכנה לעתיד)

מבנה: `https://api.telegram.org/bot<TOKEN>/sendMessage` עם `POST` JSON `{chat_id, text}`. הודעה מגיעה תוך 1-3 שניות (מהיר מאימייל).
- יוצרים bot דרך **BotFather** (`/newbot`) → מקבלים token; שולפים `chat_id` של ברוך/סיגל.
- ב-serverless function: אחרי שליחת המייל, `fetch` נוסף ל-Telegram API עם אותם נתונים.
- ה-token וה-chat_id הם **secrets** (env vars), לא בקוד. זו הסיבה שמשפחה B עדיפה — ה-hook הוא תוספת של ~10 שורות, בלי הגירה.

---

## 4. יישום ל-PHONE GAT — המלצה מנומקת

**המלצה ראשית: משפחה B — serverless function על Cloudflare Pages Functions.**

הזרימה המלאה:
```
<form> (RTL, נגיש) 
  → POST /api/contact  (Cloudflare Pages Function)
     1. method + Content-Type check
     2. honeypot ריק?  time-trap ≥ 2s?
     3. אימות Turnstile token (server-side)
     4. rate-limit לפי IP (KV, 5/שעה)
     5. server-side validation (שם/טלפון/הודעה + sanitize)
     6. שליחת מייל דרך Resend → יעד הלידים
     7. [עתיד] fetch → Telegram sendMessage
     8. החזרת 200 / 4xx-5xx ל-frontend
```

**נימוקים:**
1. **תואם אתר סטטי ובלי עלות** — Cloudflare Pages + Functions + Turnstile חינמיים; Resend 100 מיילים/יום חינם — יותר מספיק לנפח פניות של חנות.
2. **שליטה בפרטיות** — אנחנו קובעים מה נאסף ולמי עובר. אין processor אמריקאי שמאחסן טלפונים בלי DPA. ה-payload עובר, נשלח, ולא נשמר אצלנו (stateless).
3. **הגנת ספאם invisible** — honeypot + time-trap + Turnstile invisible: שומר על התחושה האנושית שהאפיון דורש, בלי CAPTCHA מציק.
4. **Telegram-ready** — ה-hook לעתיד הוא תוספת מינורית באותו קובץ, בלי הגירה.
5. **Deliverability** — שליחה מדומיין מאומת (SPF/DKIM/DMARC) נוחתת ב-inbox, לא בספאם.

**Fallback מהיר להשקה (אם לוח הזמנים דוחק): משפחה A — Web3Forms.**
- POST ישיר מה-HTML + honeypot מובנה. עולה לאוויר בדקות.
- **תנאים:** לחשוף במדיניות הפרטיות שהמידע עובר ל-Web3Forms (US, ללא DPA, מחיקה אחרי 30 יום); להוסיף honeypot; לדעת שמעבר עתידי ל-Telegram/שליטה מלאה ידרוש מיגרציה למשפחה B. מקובל כ-MVP, לא כיעד ארוך-טווח.

**טיפול בכשל שליחה (fallback לטלפון — חלק משער היציאה):**
- אם ה-email API מחזיר שגיאה → לנסות retry אחד; אם עדיין נכשל → להחזיר ל-frontend מצב error עם הודעה ברורה: *"השליחה נתקלה בתקלה — התקשרו אלינו ישירות: 052-589-3366 / 08-681-2050 או וואטסאפ"* + כפתורי חיוג/וואטסאפ ישירים.
- לתעד את הכשל (log) כדי לזהות בעיה שיטתית.
- ה-fallback לטלפון גלוי גם ב-success — הטופס לעולם לא ה"דרך היחידה" ליצור קשר (תואם את מבנה הדף: סרגל דביק בנייד עם חייג/וואטסאפ).

---

## 5. צ'קליסטים

### 5א. מימוש (Implementation)
- [ ] endpoint מקבל רק `POST` + `Content-Type` נכון; דוחה אחר.
- [ ] Honeypot: שדה נסתר נבדק בצד שרת; אם מלא → 200 "דמה" בשקט (לא לרמז לבוט).
- [ ] Time-trap: הגשה < 2-3s נדחית.
- [ ] Turnstile token מאומת **בצד שרת** מול Cloudflare.
- [ ] Rate-limit לפי IP (KV) פעיל.
- [ ] Server-side validation: שם/טלפון (regex ישראלי)/הודעה + אורכים + sanitize.
- [ ] Email נשלח מדומיין עם **SPF + DKIM + DMARC** מוגדרים.
- [ ] גוף המייל כולל את כל השדות + timestamp + מקור; Reply-To לאימייל הלקוח אם סופק.
- [ ] Secrets (API keys, Turnstile secret, Telegram token) ב-env vars — **לא בקוד/לא ב-repo**.
- [ ] תשובות HTTP ברורות ל-frontend (200 / 400 / 429 / 500).

### 5ב. פרטיות (Amendment 13)
- [ ] Data minimization — רק שם + טלפון + הודעה (email אופציונלי).
- [ ] מדיניות פרטיות נגישה מקושרת מהטופס/פוטר, כולל רשימת ה-processors (Cloudflare/Resend/וכו') והעברה לחו"ל.
- [ ] אם דיוור: checkbox נפרד **לא מסומן מראש** עם טקסט הסכמה מפורש.
- [ ] מדיניות retention/מחיקה מוגדרת ומיושמת.

### 5ג. הכנת Telegram (עתיד)
- [ ] Bot נוצר ב-BotFather; token + chat_id שמורים כ-secrets.
- [ ] `fetch` ל-`sendMessage` מתווסף אחרי שליחת המייל (best-effort — כשל בטלגרם לא מפיל את המייל).
- [ ] הודעת Telegram מפורמטת וקריאה (שם, טלפון, סוג פנייה, הודעה).

---

## 6. שער היציאה (Definition of Done — G7)

התוצר עובר ל-Tech Lead רק כאשר **כל** התנאים מתקיימים:
1. ✅ **טופס נשלח ומגיע ליעד** — הגשת בדיקה מגיעה לאימייל הלידים ב-inbox (לא בספאם), עם כל השדות תקינים.
2. ✅ **ולידציה עובדת** — client-side ל-UX, **server-side אוכף**: שדות ריקים/טלפון לא תקין נדחים בצד שרת.
3. ✅ **הגנת ספאם פעילה** — honeypot + time-trap + Turnstile מאומת server-side + rate-limit; בדיקת הגשה אוטומטית נחסמת, הגשה אנושית עוברת ללא חיכוך.
4. ✅ **טיפול בכשל שליחה** — כשל email API מציג fallback גלוי לטלפון/וואטסאפ (052-589-3366 / 08-681-2050) + retry + log.
5. ✅ **פרטיות** — data minimization, מדיניות פרטיות מקושרת, secrets לא חשופים.
6. ✅ **Telegram-ready** — נקודת ה-hook מתועדת ומוכנה להפעלה בלי הגירה.

כישלון בכל תנאי = חזרה אחורה עם רשימת תיקונים (לפי סעיף 10 באפיון).

---

## 7. מקורות

**טופס → אימייל / form backends:**
- [7 Best Form Backend Services 2026 — Forminit](https://forminit.com/blog/best-form-backend-services-2026/)
- [Web3Forms vs Static Forms 2026](https://www.staticforms.dev/blog/web3forms-vs-static-forms-comparison)
- [Web3Forms — form to email API](https://web3forms.com/)
- [Web3Forms FAQ (retention/data)](https://docs.web3forms.com/getting-started/faq)
- [Serverless Contact Form for a Static Website — Denis Isaev](https://disaev.me/serverless-contact-form-for-static-website/)

**הגנת ספאם:**
- [Honeypot vs CAPTCHA (reCAPTCHA/Turnstile/hCaptcha) — Formlova](https://formlova.com/en/blog/contact-form-captcha-comparison-en)
- [Honeypot vs reCAPTCHA vs Turnstile 2025 — 3Zero Digital](https://www.3zerodigital.com/blog/how-to-protect-your-forms-from-spam-bots-honeypot-vs-google-recaptcha-vs-cloudflare-turnstile-2025-comparison)
- [Best CAPTCHA for Contact Forms 2026 — splitforms](https://splitforms.com/blog/best-captcha-for-contact-form)

**ולידציה / rate-limit / serverless security:**
- [Client-Side vs Server-Side Validation — ivyforms](https://ivyforms.com/blog/client-side-vs-server-side-form-input-validation/)
- [Form Security Best Practices — DEV](https://dev.to/hostspica/form-security-best-practices-protecting-your-web-forms-from-attacks-3n5m)
- [Serverless Security Best Practices 2025 — Cyberbarrier](https://cyberbarrier.digital/serverless-security-challenges-and-best-practices/)

**Telegram bot:**
- [Telegram Bot API (רשמי)](https://core.telegram.org/bots/api/)
- [Lead notifications via Telegram bot — TechWithTwin](https://medium.com/@techwithtwin/collecting-lead-data-has-never-been-easier-effortlessly-receive-leads-and-notifications-via-a-0cbbbfe932e7)

**חוק הגנת הפרטיות (תיקון 13):**
- [תיקון 13 — עוז, לוטן, עינב & נורקין](https://o-n.law/privacy-protection-law-amendment-no-13/)
- [תיקון 13 — המדריך לבעלי אתרים · Ziko](https://ziko.co.il/privacy-amendment-13-guide)
- [תיקון 13 לעסק קטן עם אתר · imdigital](https://www.imdigital.co.il/post/תיקון-13-לחוק-הגנת-הפרטיות)
