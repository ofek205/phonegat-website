#!/usr/bin/env node
/* PHONE GAT — שני הצעדים של העלאה.
 *
 *   node .claude/ship.js stage    בדיקות → סביבת הבדיקות → מדפיס את הכתובת
 *   node .claude/ship.js prod     בדיקות → מאמת שנבדק ב-staging → האתר החי
 *
 * דוחף את ה-HEAD המקומי ישירות לענף המרוחק, בלי `git checkout`. זה מכוון:
 * לפעמים שני chats חולקים את אותה תיקייה, והחלפת ענף אצל אחד מושכת את
 * הקרקע מתחת לשני. כך גם אפשר להריץ את זה מכל ענף ומכל worktree.
 *
 * ללא תלויות npm — הפרויקט נשאר בלי package.json.
 */
'use strict';
var cp = require('child_process'), path = require('path'), fs = require('fs');

var ROOT = path.join(__dirname, '..');
var LIVE_URL = 'https://www.phonegat.co.il';

/* ── ענף בדיקות לכל סשן ───────────────────────────────────────────────────
   פעם אחת כל הסשנים דחפו לענף `staging` אחד. עם סשן אחד זה עבד; עם ארבעה
   שחולקים את אותה תיקייה זו הייתה התנגשות קבועה, ובגרסה שעוד הריצה `-f` זו
   הייתה מחיקה שקטה של עבודת האחרים (קרה ארבע פעמים ב-31.7.2026).

   עכשיו כל סשן דוחף ל-`staging/<slug>` משלו. Vercel פורס כל ענף בנפרד, ולכן
   לכל סשן יש כתובת בדיקות משלו ואף אחד לא דורך על השני. `main` נשאר נקודת
   האינטגרציה: דחיפה אליו היא fast-forward, ולכן מי שמגיע שני חייב rebase
   ובדיקה מחדש — וזה בדיוק הרגע שבו העבודות נפגשות.

   מאיפה מגיע ה-slug, לפי סדר: PG_SESSION, הקובץ .claude/session-name,
   ואז שם הענף הנוכחי. הוא נשמר בקובץ כדי שתצטרך לתת אותו רק פעם אחת. */
var SESSION_FILE = path.join(__dirname, 'session-name');
/* התווית של Vercel מוגבלת ל-63 תווים, והמעטפת תופסת 47. */
var MAX_SLUG = 16;

function slugify(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function previewUrl(slug) {
  return 'https://phonegat-website-git-staging-' + slug + '-ofek205s-projects.vercel.app';
}

function sessionSlug() {
  var fromFile = '';
  try { fromFile = fs.readFileSync(SESSION_FILE, 'utf8').trim(); } catch (e) {}
  var raw = process.argv[3] || process.env.PG_SESSION || fromFile;
  if (!raw) {
    var br = out('git rev-parse --abbrev-ref HEAD') || '';
    if (br && br !== 'HEAD' && br !== 'main' && br !== 'staging') raw = br;
  }
  var slug = slugify(raw);
  if (!slug) {
    die('אין שם לסשן הזה, ובלעדיו אי אפשר לדעת לאיזה ענף בדיקות לדחוף.',
        'תן שם קצר באנגלית, פעם אחת:\n' +
        '  ' + C.b + 'node .claude/ship.js stage animations' + C.x + '\n\n' +
        C.d + 'הוא נשמר ב-.claude/session-name ולא תצטרך לחזור עליו.' + C.x);
  }
  /* לא חותכים בשקט: שני סשנים שנחתכים לאותו slug חוזרים בדיוק לבאג
     שהמנגנון הזה בא למנוע. */
  if (slug.length > MAX_SLUG) {
    die('שם הסשן "' + slug + '" ארוך מדי (' + slug.length + ' תווים, המקסימום ' + MAX_SLUG + ').',
        'כתובת ה-Vercel לא תיווצר נכון. בחר שם קצר יותר:\n' +
        '  ' + C.b + 'node .claude/ship.js stage <שם-קצר>' + C.x);
  }
  if (slug !== fromFile) {
    try { fs.writeFileSync(SESSION_FILE, slug + '\n'); } catch (e) {}
  }
  return slug;
}

var C = { r: '[31m', g: '[32m', y: '[33m', b: '[1m', d: '[2m', x: '[0m' };

function run(cmd, quiet) {
  return cp.execSync(cmd, { cwd: ROOT, stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
}
function out(cmd) {
  try { return cp.execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch (e) { return null; }
}
function die(msg, hint) {
  console.error('\n' + C.r + C.b + '✗ ' + msg + C.x);
  if (hint) console.error('\n' + hint);
  console.error('');
  process.exit(1);
}

/* ---------- אימות שהפריסה באמת נוצרה ----------
 *
 * **זה קרה ב-17.8.2026, ופעמיים.** `ship.js prod` דחף ל-main בהצלחה, הדפיס "עלה לאתר
 * החי", ו-Vercel לא בנה כלום. הקומיט היה אצל GitHub, אין פריסה שנכשלה, אין פריסה בתור,
 * ופשוט לא נוצרה פריסה. גילינו את זה רק כי מישהו בדק את רשימת הפריסות ביד. אחר כך זה
 * חזר על עצמו בדחיפה לענף הבדיקות.
 *
 * **דחיפה מוצלחת אינה פריסה.** git מדווח על מה שהוא עשה, ולא על מה שוובהוק עשה אחריו,
 * ולכן ההודעה "עלה לאתר החי" הייתה הבטחה שהסקריפט לא יכול לקיים. אם לא רואים שהפריסה
 * נוצרה, אומרים את זה במקום להבטיח.
 *
 * הבדיקה נשענת על ה-CLI של Vercel, שכבר מותקן ומאומת. **היעדרו אינו כישלון**: אם הוא לא
 * שם, מדווחים שאי אפשר לאמת ומבקשים בדיקה ידנית. זה עדיף על שתיקה, ועדיף על חסימה. */
function deployAgeMinutes() {
  var raw = out('vercel ls phonegat-website --yes 2>&1');
  if (!raw) return null;
  var lines = raw.split('\n').filter(function (l) { return /https:\/\/\S+\.vercel\.app/.test(l); });
  if (!lines.length) return null;
  var best = null;
  lines.forEach(function (l) {
    var m = l.match(/^\s*(\d+)\s*([smhd])\b/);
    if (!m) return;
    var n = Number(m[1]);
    var mins = m[2] === 's' ? n / 60 : m[2] === 'm' ? n : m[2] === 'h' ? n * 60 : n * 1440;
    if (best === null || mins < best) best = mins;
  });
  return best;
}
function verifyDeploy(target) {
  var before = deployAgeMinutes();
  if (before === null) {
    console.log('\n  ' + C.y + '! אי אפשר לאמת שהפריסה נוצרה' + C.x);
    console.log('  ' + C.d + 'ה-CLI של Vercel לא זמין או לא מאומת. בדוק ביד ב-vercel.com' + C.x);
    return;
  }
  /* חלון ההמתנה קצר בכוונה: בנייה של אתר סטטי כאן לוקחת 5 עד 8 שניות, ולכן פריסה
     שלא נוצרה בתוך דקה כמעט ודאי לא תיווצר. */
  var waited = 0;
  while (waited < 60) {
    var age = deployAgeMinutes();
    if (age !== null && age <= 1.2) {
      console.log('  ' + C.g + '✓ נוצרה פריסה חדשה ב-Vercel (' + target + ')' + C.x);
      return;
    }
    try { cp.execSync(process.platform === 'win32' ? 'timeout /t 6 /nobreak >nul' : 'sleep 6', { stdio: 'ignore' }); }
    catch (e) { /* timeout מחזיר קוד יציאה שאינו אפס, וזה תקין */ }
    waited += 6;
  }
  console.log('\n  ' + C.r + C.b + '✗ הדחיפה עברה אבל Vercel לא יצר פריסה' + C.x);
  console.log('  ' + C.d + 'הקוד אצל GitHub, ולכן הקוד לא אבד. מה שלא קרה הוא הבנייה.' + C.x);
  console.log('\n  מה לבדוק:');
  console.log('  1. ' + C.b + 'vercel.com → phonegat-website → Settings → Git' + C.x + '  שהחיבור למאגר קיים');
  console.log('  2. ' + C.b + 'Deployments → Redeploy' + C.x + '  כדי לבנות ידנית עכשיו');
  console.log('  ' + C.d + 'האתר החי ממשיך להגיש את הפריסה הקודמת עד שזה נפתר.' + C.x);
}

function preflight() {
  console.log(C.d + 'מריץ בדיקות…' + C.x);
  try { run('node .claude/preflight.js'); }
  catch (e) { die('הבדיקות נכשלו — לא ממשיכים.', 'תקן את מה שסומן למעלה והרץ שוב.'); }
}

function dirtyCheck() {
  var st = out('git status --porcelain') || '';
  var all = st.split('\n').filter(function (l) { return !!l; });
  /* רק שינוי בתוך prototype/ באמת משנה את מה שנפרס. חוסמים עליו, כי אחרת
     מה שתבדוק ב-staging אינו מה שיש לך על המסך. שינוי מחוץ לתיקייה הזו
     (הנחיות, סקריפטים) לא נפרס בכלל, ולפעמים הוא בכלל של הסשן השני,
     ואין סיבה שיחסום העלאה. */
  var deployed = all.filter(function (l) { return /\sprototype\//.test(l) || /^\?\?\s+prototype\//.test(l); });
  /* קובץ לא-עקוב בתוך prototype/ נספר כאן, ופעם לא. זה היה החור המסוכן בשרשרת: המחוללים
     יוצרים עמוד חדש כקובץ חדש ומעדכנים במקביל קבצים עקובים, git commit -am מקמט רק את
     השניים, והפריפלייט עובר כי הוא קורא מהדיסק. התוצאה היא עמוד שכל האתר מקשר אליו ושאינו
     קיים בפרודקשן. מחוץ ל-prototype/ עדיין מתעלמים מקבצים לא-עקובים, כי שם הם רעש. */
  var modified = all.filter(function (l) { return !/^\?\?/.test(l); });
  if (deployed.length) {
    die('יש שינויים ב-prototype/ שלא נכנסו ל-commit — הם לא ייפרסו, ואז ה-staging לא ישקף מה שאתה רואה מקומית.',
        C.d + deployed.join('\n') + C.x + '\n\nעשה commit ואז נסה שוב.');
  }
  var other = modified.filter(function (l) { return !/\sprototype\//.test(l); });
  if (other.length) {
    console.log(C.y + '!' + C.x + ' שינויים לא-מקומיטים מחוץ ל-prototype/ (לא נפרסים, ממשיכים):');
    other.forEach(function (l) { console.log('  ' + C.d + l + C.x); });
  }
}

var head = out('git rev-parse HEAD');
var headShort = out('git rev-parse --short HEAD');
var cmd = (process.argv[2] || '').toLowerCase();

if (cmd === 'stage') {
  dirtyCheck();
  preflight();
  var slug = sessionSlug();
  /* מקף ולא לוכסן: ref הוא נתיב בקובץ, ולכן `staging` ו-`staging/animations`
     לא יכולים להתקיים יחד — הענף הישן היה חוסם כל ענף סשן חדש. המקף גם נותן
     בדיוק את הכתובת ש-Vercel מייצר. */
  var branch = 'staging-' + slug;
  /* שער נגד ענף תצוגה מזוהם. אם סשן אחר דחף לענף הזה, `rebase` עליו יכניס את
     העבודה הלא-מאושרת שלו לתצוגה שלי — כלומר בדיוק מה שהבידוד בא למנוע.
     קרה ב-2.8.2026: שני chats חלקו תיקייה, ולכן חלקו גם את
     `.claude/session-name`, קיבלו את אותו slug, ו-staging-general נהיה מעורב.
     במקרה כזה הפתרון הוא שם סשן אחר ולא rebase, ולכן זו שגיאה ולא אזהרה.
     `--not` ולא `^`: ב-Windows הפקודה עוברת דרך cmd.exe, ושם `^` הוא תו הבריחה
     והוא נאכל בשקט. */
  run('git fetch -q origin', true);
  if (out('git rev-parse -q --verify origin/' + branch)) {
    var foreign = (out('git log --oneline origin/' + branch + ' --not HEAD origin/main') || '')
                  .split('\n').filter(Boolean);
    if (foreign.length) {
      die(branch + ' מחזיק ' + foreign.length + ' קומיטים שאינם שלך ואינם בפרודקשן.',
          C.d + foreign.map(function (l) { return '  ' + l; }).join('\n') + C.x + '\n\n' +
          'סשן אחר משתמש בשם הזה. ' + C.b + 'אל תעשה rebase עליו' + C.x + ' — זה יכניס את\n' +
          'העבודה שלו לתצוגה שלך. תן לסשן הזה שם משלו:\n\n' +
          '  ' + C.b + 'node .claude/ship.js stage <שם-אחר>' + C.x);
    }
  }
  console.log(C.d + 'דוחף ' + headShort + ' ל-' + branch + '…' + C.x);
  /* בלי -f, בכוונה. גם כשהענף פרטי לסשן, force מוחק היסטוריה בלי אזהרה, ואם
     שני worktrees של אותו סשן דוחפים לאותו ענף זה חוזר להיות אותו באג. */
  try { run('git push origin HEAD:refs/heads/' + branch, true); }
  catch (e) {
    var perr = String(e.stderr || e.message);
    if (/non-fast-forward|fetch first|rejected/i.test(perr)) {
      /* השער שלמעלה כבר פסל קומיטים זרים, ולכן מה שנשאר הוא שהענף מכיל דברים
         שכבר בפרודקשן ואצלך לא. הרבייס הוא על main, לא על ענף התצוגה. */
      die(branch + ' מכיל קומיטים שאתה מפגר אחריהם.',
          'git fetch origin && git rebase origin/main\n' +
          'ואז שוב:  node .claude/ship.js stage');
    }
    die('הדחיפה ל-' + branch + ' נכשלה.', perr);
  }
  console.log('\n' + C.g + C.b + '✓ נדחף ל-' + branch + C.x);
  verifyDeploy('preview');
  console.log('\n  ' + C.b + previewUrl(slug) + C.x);
  console.log('\n  ' + C.d + 'חפש את הפס הצהוב למעלה. בדוק גם בטלפון.' + C.x);
  console.log('  ' + C.d + 'כשזה תקין:  node .claude/ship.js prod' + C.x + '\n');

} else if (cmd === 'whoami') {
  /* בלי דחיפה ובלי בדיקות — רק "לאן אני שולח". שימושי כשארבעה סשנים פתוחים
     ולא זוכרים מי זה מי. */
  var who = sessionSlug();
  console.log('\n  ' + C.d + 'סשן:  ' + C.x + C.b + who + C.x);
  console.log('  ' + C.d + 'ענף:  ' + C.x + 'staging-' + who);
  console.log('  ' + C.d + 'כתובת:' + C.x + ' ' + previewUrl(who) + '\n');

} else if (cmd === 'prod') {
  dirtyCheck();
  preflight();
  run('git fetch -q --prune origin', true);
  /* מספיק שהקומיט נמצא באחד מענפי הבדיקות — של הסשן הזה או של כל סשן אחר.
     `staging` היחיד נשאר תקף כדי שהמנגנון הישן ימשיך לעבוד.
     לא משתמשים ב-`; echo $?` — ב-Windows הפקודה רצה ב-cmd.exe ו-$? לא קיים שם.
     קוד יציאה שאינו 0 זורק, וזו הבדיקה. */
  var previews = (out('git for-each-ref --format=%(refname:short) ' +
                      'refs/remotes/origin/staging refs/remotes/origin/staging-*') || '')
                 .split('\n').filter(Boolean);
  var stagedOn = null;
  for (var i = 0; i < previews.length; i++) {
    try { run('git merge-base --is-ancestor ' + head + ' ' + previews[i], true); stagedOn = previews[i]; break; }
    catch (e) {}
  }
  if (!stagedOn) {
    die('הקומיט ' + headShort + ' לא נפרס לאף סביבת בדיקות, ולכן לא ראית אותו עובד.',
        '  ' + C.b + 'node .claude/ship.js stage' + C.x + '   ← קודם לשם, ולבדוק');
  }
  console.log(C.d + 'נבדק ב-' + stagedOn.replace(/^origin\//, '') + C.x);
  console.log(C.d + 'דוחף ' + headShort + ' לאתר החי…' + C.x);
  try { run('git push origin HEAD:main'); }
  catch (e) {
    die('הדחיפה ל-main נדחתה — כנראה שמישהו דחף ל-main מאז.',
        'סנכרן, העלה שוב לבדיקות, ואז נסה:\n' +
        '  ' + C.b + 'git fetch origin && git rebase origin/main' + C.x + '\n' +
        '  ' + C.b + 'node .claude/ship.js stage' + C.x + '\n' +
        '  ' + C.b + 'node .claude/ship.js prod' + C.x);
  }
  console.log('\n' + C.g + C.b + '✓ נדחף ל-main' + C.x);
  verifyDeploy('production');
  console.log('\n  ' + C.b + LIVE_URL + C.x + '\n');

} else {
  console.log('\n' + C.b + 'PHONE GAT — העלאה' + C.x + '\n');
  console.log('  ' + C.b + 'node .claude/ship.js stage' + C.x + '         בדיקות → ענף הבדיקות של הסשן הזה');
  console.log('  ' + C.b + 'node .claude/ship.js stage <שם>' + C.x + '    קובע את שם הסשן (פעם אחת)');
  console.log('  ' + C.b + 'node .claude/ship.js prod' + C.x + '          בדיקות → האתר החי (רק אחרי stage)\n');
  var known = '';
  try { known = fs.readFileSync(SESSION_FILE, 'utf8').trim(); } catch (e) {}
  if (known) {
    console.log('  ' + C.d + 'הסשן הזה: ' + C.x + C.b + known + C.x);
    console.log('  ' + C.d + 'בדיקות:   ' + previewUrl(known) + C.x);
  } else {
    console.log('  ' + C.d + 'לסשן הזה עוד אין שם. הוא ייקבע מהענף הנוכחי, או תן אותו ידנית.' + C.x);
  }
  console.log('  ' + C.d + 'חי:       ' + LIVE_URL + C.x + '\n');
  process.exit(process.argv[2] ? 1 : 0);
}
