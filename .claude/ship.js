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
var cp = require('child_process'), path = require('path');

var ROOT = path.join(__dirname, '..');
var STAGING_URL = 'https://phonegat-website-git-staging-ofek205s-projects.vercel.app';
var LIVE_URL = 'https://www.phonegat.co.il';

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

function preflight() {
  console.log(C.d + 'מריץ בדיקות…' + C.x);
  try { run('node .claude/preflight.js'); }
  catch (e) { die('הבדיקות נכשלו — לא ממשיכים.', 'תקן את מה שסומן למעלה והרץ שוב.'); }
}

function dirtyCheck() {
  var st = out('git status --porcelain') || '';
  var modified = st.split('\n').filter(function (l) { return l && !/^\?\?/.test(l); });
  /* רק שינוי בתוך prototype/ באמת משנה את מה שנפרס. חוסמים עליו, כי אחרת
     מה שתבדוק ב-staging אינו מה שיש לך על המסך. שינוי מחוץ לתיקייה הזו
     (הנחיות, סקריפטים) לא נפרס בכלל — ולפעמים הוא בכלל של הסשן השני,
     ואין סיבה שיחסום העלאה. */
  var deployed = modified.filter(function (l) { return /\sprototype\//.test(l); });
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
  console.log(C.d + 'דוחף ' + headShort + ' לסביבת הבדיקות…' + C.x);
  try { run('git push -f origin HEAD:staging', true); }
  catch (e) { die('הדחיפה ל-staging נכשלה.', String(e.stderr || e.message)); }
  console.log('\n' + C.g + C.b + '✓ עלה לסביבת הבדיקות' + C.x);
  console.log('\n  ' + C.b + STAGING_URL + C.x);
  console.log('\n  ' + C.d + 'הפריסה לוקחת ~דקה. חפש את הפס הצהוב למעלה.' + C.x);
  console.log('  ' + C.d + 'בדוק גם בטלפון. כשזה תקין:  node .claude/ship.js prod' + C.x + '\n');

} else if (cmd === 'prod') {
  dirtyCheck();
  preflight();
  run('git fetch -q origin staging', true);
  /* לא משתמשים ב-`; echo $?` — ב-Windows הפקודה רצה ב-cmd.exe ו-$? לא קיים שם.
     קוד יציאה שאינו 0 זורק, וזו הבדיקה. */
  var staged = true;
  try { run('git merge-base --is-ancestor ' + head + ' origin/staging', true); }
  catch (e) { staged = false; }
  if (!staged) {
    die('הקומיט ' + headShort + ' לא נפרס לסביבת הבדיקות.',
        '  ' + C.b + 'node .claude/ship.js stage' + C.x + '   ← קודם לשם, ולבדוק');
  }
  console.log(C.d + 'דוחף ' + headShort + ' לאתר החי…' + C.x);
  try { run('git push origin HEAD:main'); }
  catch (e) {
    die('הדחיפה ל-main נדחתה — כנראה שמישהו דחף ל-main מאז.',
        'סנכרן, העלה שוב לבדיקות, ואז נסה:\n' +
        '  ' + C.b + 'git fetch origin && git rebase origin/main' + C.x + '\n' +
        '  ' + C.b + 'node .claude/ship.js stage' + C.x + '\n' +
        '  ' + C.b + 'node .claude/ship.js prod' + C.x);
  }
  console.log('\n' + C.g + C.b + '✓ עלה לאתר החי' + C.x);
  console.log('\n  ' + C.b + LIVE_URL + C.x);
  console.log('\n  ' + C.d + 'הפריסה לוקחת ~דקה.' + C.x + '\n');

} else {
  console.log('\n' + C.b + 'PHONE GAT — העלאה' + C.x + '\n');
  console.log('  ' + C.b + 'node .claude/ship.js stage' + C.x + '   בדיקות → סביבת הבדיקות');
  console.log('  ' + C.b + 'node .claude/ship.js prod' + C.x + '    בדיקות → האתר החי (רק אחרי stage)\n');
  console.log('  ' + C.d + 'בדיקות: ' + STAGING_URL + C.x);
  console.log('  ' + C.d + 'חי:     ' + LIVE_URL + C.x + '\n');
  process.exit(process.argv[2] ? 1 : 0);
}
