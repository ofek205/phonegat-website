'use strict';
/* PHONE GAT — **אילו עמודים נושאים את הצ'אט.** מקור אמת אחד לשני צרכנים.
 *
 * gen-bot.js מזריק לפי הכלל הזה, ובדיקה 31 בפריפלייט מוודאת לפיו שהעמודים באמת נושאים
 * את הצ'אט. הכלל היה כתוב פעמיים, ולכן הרחבה בצד אחד הייתה משאירה את השער שומר על
 * הרשימה הישנה ומאשר עמודים בלי בוט.
 *
 * **זה לא אותו כלל כמו אינדקס התוכן ב-gen-bot-content.js.** עמודי המכשיר וההשוואה
 * נשארים מחוץ ל-bot-content.json בכוונה, כי הם נגזרים מאותו devices.json שממנו נגזר
 * bot-facts, ואינדוקס שלהם היה יוצר שני נתיבי תשובה מתחרים לאותה שאלה. אבל הם בדיוק
 * העמודים שבהם הלקוח שואל על דגם, ולכן הבוט חייב להיות שם. הוא עונה להם מהקטלוג.
 */
module.exports = function carriesChat(url) {
  if (/^\/guides\/.+\//.test(url)) return true;          /* מדריך, לא השער */
  if (url === '/phone-problems/') return true;
  if (/^\/[a-z0-9-]+-kiryat-gat\/$/.test(url)) return true;  /* 13 עמודי השירות */
  if (/^\/phones\//.test(url)) return true;              /* עמודי המכשיר, השער וכלי ההשוואה */
  if (/^\/compare\//.test(url)) return true;             /* עמודי ההשוואה והשער */
  if (/^\/phone-repair-[a-z-]+\/$/.test(url)) return true;   /* 8 עמודי המועצות והיישובים */
  if (url === '/contact/') return true;                  /* העמוד עם הכוונה הגבוהה ביותר באתר */
  if (url === '/guides/') return true;
  if (url === '/upcoming-phones/') return true;
  /* accessibility.html ו-privacy.html נשארים בחוץ: אין בהם הדר ולא פוטר, ואין לאן להזריק.
     זה קדם לבוט, וזו בעיה נפרדת שמתועדת ב-CLAUDE.md. */
  return false;
};
