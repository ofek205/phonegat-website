# שלוש תגיות GA4 לאירועי הלידים

האתר דוחף מ-12.9.2026 שלושה אירועים ל-`dataLayer` בכל לחיצה על טלפון או על WhatsApp,
מהבלוק `pg-contact-tap` שקיים בכל 78 העמודים:

| אירוע | מתי | פרמטרים |
|---|---|---|
| `whatsapp_click` | לחיצה על קישור WhatsApp | `method`, `link_url`, `page_path`, `event_category`, `link_location` |
| `phone_click` | לחיצה על קישור `tel:` | אותם פרמטרים |
| `generate_lead` | בשתי הלחיצות | `method`, `page_path`, `event_category` |

**בלי התגיות שמתוארות כאן הם יושבים ב-`dataLayer` ולא מגיעים ל-GA4 בכלל.**

## למה זה לא בקוד

GA4 נטען באתר **דרך GTM בלבד**. אין `gtag.js` בשום עמוד, ו-`G-KQPCV7JGKT` אינו מופיע
בקוד: מזהה המדידה חי בתוך המכל `GTM-WZSVD7Z5`. ה-`gtag()` שבראש כל עמוד הוא shim של
שורה אחת ל-Consent Mode, וקריאה דרכו רק דוחפת `arguments` ל-`dataLayer`.

לכן מדידה חדשה באתר הזה היא תמיד שני חצאים: דחיפה מהקוד, ותגית ב-GTM. חצי אחד בלבד
נראה כמו מדידה שעובדת ואינו שולח כלום.

## ⚠️ הייבוא חייב להיות Merge, לא Overwrite

ב-GTM: **Admin → Import Container**, בוחרים את `lead-events.json`, ואז:

| שדה | מה לבחור |
|---|---|
| Workspace | **Existing** (או חדש), לא Default |
| Choose an import option | **Merge** |
| בהתנגשות | **Rename conflicting tags, triggers and variables** |

**`Overwrite` ימחק את כל המכל** ויחליף אותו בשלוש התגיות שבקובץ הזה, כלומר ימחק את
תגית ה-GA4 הראשית ואת כל המדידות הקיימות. אין ל-GTM "בטל" אחרי פרסום, רק חזרה לגרסה
קודמת. לפני הייבוא שווה **Admin → Export Container** כגיבוי.

אחרי הייבוא: **Preview** לבדיקה, ורק אז **Submit**.

## מבנה המכל החי, כפי שנצפה ב-13.9.2026

במכל כבר קיימת **Google Tag בשם "פון גת"**. כשממלאים `Measurement ID` בתגית
`GA4 Event`, GTM מזהה אותה לבד ומציג טקסט ירוק:

> Google tag found in this container. This tag will use the configuration of Google tag פון גת.

כלומר `measurementIdOverride` שבקובץ הייבוא הוא **השדה הנכון**, ו-GTM פותר אותו מול
ה-Google Tag הקיימת. אין צורך להצמיד ידנית Configuration Tag.

**התלות ששווה לזכור:** שלוש התגיות האלה שואבות את ההגדרה מה-Google Tag ההיא. אם
היא תימחק או תשונה, הן יאבדו את ההגדרה שלהן, ו-`G-KQPCV7JGKT` שרשום בהן לבדו לא
בהכרח יספיק. מי שנוגע ב-Google Tag צריך לבדוק גם את השלוש.

## הקובץ לא נבדק מול המכל

`lead-events.json` נכתב ידנית ולא יוצא מהמכל שלכם, ולכן:

* `accountId` ו-`containerId` הם `0`, ו-GTM ממפה אותם בייבוא
* מזהי התגיות מתחילים ב-9101 כדי להתרחק מהקיימים
* הסכמה של תגית `gaawe` השתנתה בין גרסאות GTM. אם הייבוא נכשל או שהתגית נראית חסרה
  שדה, **אין לתקן בקובץ אלא להגדיר ידנית** לפי הטבלה שלמטה. שלוש תגיות ידניות הן עשר
  דקות, וקובץ ייבוא שגוי שנדחף בשקט הוא מדידה שלא נספרת

**עדכון 13.9.2026:** ההגדרה נעשתה בפועל ידנית ולא מהקובץ, ו-`Measurement ID` בתגית
האירוע התקבל כפי שהקובץ מניח. כלומר ההנחה המרכזית בו אומתה, אבל **הקובץ עצמו עדיין
לא יובא מעולם**, ולכן הוא נשאר לא בדוק כמסלול.

## ההגדרה הידנית, אם מעדיפים או אם הייבוא נכשל

לכל אחד משלושת האירועים, אותו מתכון:

**1. משתנים** (פעם אחת לכל השלושה) — Variables → New → **Data Layer Variable**,
`Data Layer Variable Name` בדיוק כשם הפרמטר:

```
method        link_url        page_path        event_category        link_location
```

שמות המשתנים בטבלה למטה מניחים `DLV - <שם>`.

**2. טריגר** — Triggers → New → **Custom Event**,
`Event name` בדיוק אחד מ: `whatsapp_click`, `phone_click`, `generate_lead`.
בלי regex, בלי תנאים נוספים.

**3. תגית** — Tags → New → **Google Analytics: GA4 Event**:

| שדה | ערך |
|---|---|
| Measurement ID | `G-KQPCV7JGKT` |
| Event Name | אותו שם כמו הטריגר |
| Event Parameters | `method` = `{{DLV - method}}` |
| | `link_url` = `{{DLV - link_url}}` |
| | `page_path` = `{{DLV - page_path}}` |
| | `event_category` = `{{DLV - event_category}}` |
| | `link_location` = `{{DLV - link_location}}` |
| Triggering | הטריגר מסעיף 2 |

ב-`generate_lead` אין `link_url` ואין `link_location`, כי הוא נשלח פעם אחת לכל ליד
ולא לכל קישור.

## איך לבדוק שזה עובד

**GTM מגודר לפרודקשן.** ב-staging ובמקומי הוא אינו נטען כלל, ולכן צריך `?pg_gtm=1`:

```
https://www.phonegat.co.il/?pg_gtm=1
```

1. **GTM → Preview**, ומדביקים את הכתובת
2. לוחצים על כפתור WhatsApp או טלפון
3. ב-Tag Assistant: האירוע מופיע בעמודה השמאלית, והתגית תחת **Tags Fired**
4. **GA4 → Admin → DebugView** — האירוע מופיע תוך שניות
5. **GA4 → Reports → Realtime** — תוך דקה

**בדיקה בלי GTM בכלל**, כדי להפריד בין "האתר לא דוחף" ל"GTM לא מוגדר": פותחים קונסול
בכל עמוד, מקלידים `dataLayer.length`, לוחצים על כפתור WhatsApp, ומקלידים שוב.
הוא גדל ב-3. אם הוא גדל והאירוע אינו ב-GA4, הבעיה ב-GTM ולא באתר.

## ⚠️ מצב נכון ל-13.9.2026: הוגדר, לא פורסם

התגיות נוצרו ונבדקו ב-Preview, אבל **לא בוצע Publish** והן יושבות ב-workspace טיוטה.
עד שייעשה Publish, האתר דוחף את שלושת האירועים ל-`dataLayer` ו-GA4 אינו סופר אותם.

Preview מריץ את הטיוטה בדפדפן שלך בלבד. הוא **אינו** משנה כלום למבקרים.

## מה שומר על זה

**בדיקה 42 ב-`preflight.js`** משווה טביעת אצבע של הבלוק בין 78 העמודים ומוודאת ששלושת
שמות האירועים בתוכו. לבלוק אין מחולל והוא הועתק ידנית, ועמוד שיישאר מאחור אחרי עריכה
ייראה בדוח כמי שאינו ממיר, ולא כמי שאינו נמדד.
