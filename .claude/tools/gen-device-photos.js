#!/usr/bin/env node
/* PHONE GAT — הופך את תמונות המקור של הדגמים לתמונות ההירו של עמודי המכשיר.
 *
 *   node .claude/tools/gen-device-photos.js "<תיקיית המקור>"
 *
 * המקור הוא PNG של 1.5 מגה־בייט לתמונה, ולכן הוא לא נכנס לגיט. מה שנכנס לגיט הוא
 * הפלט בלבד: prototype/phones/img/<slug>-{480,960}.webp. הסקריפט בר־הרצה חוזרת,
 * וכשהמקור בהישג יד אפשר לייצר הכל מחדש בפקודה אחת.
 *
 * שלוש הסיבות לכך שזה סקריפט ולא המרה ידנית:
 *
 *   1. יחס הגובה־רוחב של המקור אינו אחיד: יש 3:4, יש 2:3 ויש 4:3 לרוחב. ה-CSS של
 *      .fig img קובע 3:4 עם object-fit:cover, כלומר תמונה ביחס אחר הייתה נחתכת,
 *      ובתמונות לרוחב זה היה חותך שני מכשירים מתוך שלושה. לכן כל תמונה מנורמלת
 *      כאן ל-3:4 בדיוק, ואף פיקסל תוכן לא הולך לאיבוד.
 *
 *   2. גודל המכשיר בתוך הפריים אינו אחיד במקור. בלי נרמול, דגם אחד ממלא 90% מהגובה
 *      ודגם אחר 55%, ושתי הכרטיסיות זו לצד זו נראות כאילו מדובר בשני מכשירים
 *      בגדלים שונים. הסקריפט מוצא את תיבת התוכן ומעמיד את כולם על אותו שוליים.
 *
 *   3. הריפוד נעשה בצבע הרקע שנדגם מהתמונה עצמה ולא בלבן קבוע. חלק מהרנדרים יושבים
 *      על אפור בהיר ולא על לבן, וריפוד לבן היה יוצר מסגרת גלויה סביב התמונה.
 *
 * הזיהוי נעשה על עותק מוקטן (raw RGB מ-ffmpeg), והחיתוך עצמו מבוצע על המקור המלא.
 */
'use strict';
var fs = require('fs'), path = require('path'), cp = require('child_process');

var ROOT = path.resolve(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var OUT = path.join(PROTO, 'phones', 'img');
var SRC = process.argv[2];
/* שלוש המידות נגזרות מרוחב התצוגה בפועל ולא מעוגלות לסתם מספרים:
 *   288  טלפון ב-1x  (התמונה מוגבלת ל-280 מתחת ל-900 פיקסל)
 *   576  טלפון ב-2x, וגם שולחני ב-1x (העמודה מגיעה ל-548 כש-wrap נוגע ב---maxw:1400)
 *  1152  שולחני ב-2x
 * כולן מתחלקות ב-3, ולכן הגובה שלהן שלם ביחס 3:4 ואין עיגול שמזיז פיקסל. */
var WIDTHS = [288, 576, 1152];
var RATIO = 3 / 4;                /* מה ש-.fig img מצפה לו */
var MARGIN = 0.055;               /* שוליים סביב תיבת התוכן, כחלק מהצלע הארוכה */
var PROBE_W = 192;                /* רוחב עותק הזיהוי */

/* שם הקובץ שאופק נתן -> ה-slug ב-devices.json. מיפוי מפורש ולא נרמול אוטומטי:
 * "Samsung Galaxy A07" ו-"galaxy-a07" לא נגזרים זה מזה בלי לנחש, וניחוש שגוי כאן
 * שם תמונה של דגם אחד בעמוד של דגם אחר. */
var MAP = {
  'iphone 16': 'iphone-16',
  'iphone 17': 'iphone-17',
  'iphone 17e': 'iphone-17e',
  'iphone 17 pro': 'iphone-17-pro',
  'iphone 17 pro max': 'iphone-17-pro-max',
  'samsung galaxy s26': 'galaxy-s26',
  'samsung galaxy s26+': 'galaxy-s26-plus',
  'samsung galaxy s26 ultra': 'galaxy-s26-ultra',
  'samsung galaxy s25 fe': 'galaxy-s25-fe',
  'samsung galaxy a07': 'galaxy-a07',
  'samsung galaxy a17': 'galaxy-a17',
  'samsung galaxy a27': 'galaxy-a27',
  'samsung galaxy a36': 'galaxy-a36',
  'samsung galaxy a37': 'galaxy-a37',
  'samsung galaxy a56': 'galaxy-a56',
  'samsung galaxy a57': 'galaxy-a57',
  'xiaomi 15': 'xiaomi-15',
  'redmi note 14': 'redmi-note-14',
  'redmi note 15': 'redmi-note-15',
  'redmi note 15 pro': 'redmi-note-15-pro'
};

/* חיתוך מקדים, בשברים של המקור, למי שצריך אותו. הוא רץ לפני זיהוי תיבת התוכן, ולכן משם
 * והלאה התמונה עוברת בדיוק את אותו נרמול כמו כל השאר.
 *
 * שתי תמונות ה-iPhone 17 Pro הן שלישייה לרוחב. בפריים 3:4 שלישייה כזאת ממלאת 95% מהרוחב
 * אבל רק 47% מהגובה, בעוד ששאר 18 התמונות ממלאות 82% עד 95% מהגובה. מדדתי את כולן, וזה
 * היה הפער היחיד שנראה בעין: אותו דגם נראה בעמוד שלו חצי מהגודל של השכן. החיתוך לוקח את
 * המכשיר האמצעי בלבד, ואז הוא נוחת באותם 88% כמו כולם.
 *
 * המחיר: שני הצבעים האחרים יורדים מהתמונה. זה נבחר ביודעין, כי עמוד מכשיר מוכר מכשיר אחד.
 *
 * כשיש חיתוך כזה הריפוד נצבע שטוח ולא נמשח: קצה החיתוך הוא המכשיר עצמו ולא רקע, ומשיחה
 * הייתה מותחת את דופן המכשיר לרוחב כל הריפוד. */
var CROP = {
  'iphone 17 pro max': { x: 0.4137, y: 0.1179, w: 0.2162, h: 0.8821 },
  'iphone 17 pro':     { x: 0.4006, y: 0.1639, w: 0.2210, h: 0.8361 }
};

if (!SRC || !fs.existsSync(SRC)) {
  console.error('✗ צריך נתיב לתיקיית תמונות המקור.\n  node .claude/tools/gen-device-photos.js "<תיקייה>"');
  process.exit(1);
}

function run(args, opts) {
  var r = cp.spawnSync('ffmpeg', args, Object.assign({ maxBuffer: 1 << 28 }, opts || {}));
  if (r.status !== 0) {
    console.error('✗ ffmpeg נכשל על:\n  ffmpeg ' + args.join(' ') + '\n' +
      String(r.stderr).split('\n').slice(-8).join('\n'));
    process.exit(1);
  }
  return r.stdout;
}

/* גודל התמונה נקרא מכותרת ה-PNG ולא מ-ffprobe, שאינו מובטח להיות מותקן לצד ffmpeg. */
function pngSize(file) {
  var b = fs.readFileSync(file, { start: 0, end: 32 });
  if (b.length < 24 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/* תיבת התוכן וצבע הרקע, מתוך עותק מוקטן.
 * הרקע נלקח כחציון של פיקסלי המסגרת ולא כפיקסל פינה בודד, כדי שנקודת אבק אחת
 * בפינה לא תגדיר את צבע הריפוד של כל התמונה. */
function analyze(file, w, h) {
  var pw = PROBE_W, ph = Math.max(1, Math.round(h * pw / w));
  var raw = run(['-v', 'error', '-i', file, '-vf', 'scale=' + pw + ':' + ph,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  if (raw.length < pw * ph * 3) { console.error('✗ דגימה חלקית של ' + path.basename(file)); process.exit(1); }
  var at = function (x, y, c) { return raw[(y * pw + x) * 3 + c]; };

  var edge = [[], [], []], x, y, c;
  for (x = 0; x < pw; x++) for (c = 0; c < 3; c++) { edge[c].push(at(x, 0, c)); edge[c].push(at(x, ph - 1, c)); }
  for (y = 0; y < ph; y++) for (c = 0; c < 3; c++) { edge[c].push(at(0, y, c)); edge[c].push(at(pw - 1, y, c)); }
  var bg = edge.map(function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; });

  /* 22 מתוך 255 הוא הסף שמפריד בין הדרגתיות של רקע סטודיו לבין קצה של מכשיר.
   * נמוך מזה תופס את הצללית של הרקע עצמו, גבוה מזה מפספס מכשיר לבן. */
  var TH = 22, x0 = pw, y0 = ph, x1 = -1, y1 = -1;
  for (y = 0; y < ph; y++) for (x = 0; x < pw; x++) {
    var d = Math.max(Math.abs(at(x, y, 0) - bg[0]), Math.abs(at(x, y, 1) - bg[1]), Math.abs(at(x, y, 2) - bg[2]));
    if (d > TH) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = pw - 1; y1 = ph - 1; }
  return {
    bg: '0x' + bg.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''),
    box: { x: x0 / pw, y: y0 / ph, w: (x1 - x0 + 1) / pw, h: (y1 - y0 + 1) / ph }
  };
}

/* צבע הריפוד כשיש חיתוך מקדים: החציון של השורה העליונה והתחתונה של החיתוך בלבד.
 *
 * לא של התמונה המלאה, וזה ההבדל בין תמונה שנראית שלמה לתמונה שנראית מודבקת. הרקע של
 * הרנדרים כהה יותר בפינות מאשר סביב המכשיר, וריפוד בצבע הפינה צייר מלבן בהיר גלוי בתוך
 * מסגרת כהה יותר. ההפרש היה ebeae7 מול f2f1ef, שבע דרגות, וזה נראה מטרים משם.
 *
 * ולא כל ארבע הדפנות: שתי העמודות הן ברובן המכשיר עצמו, והחציון היה יוצא כתום. */
function padColor(file, pre, w, h) {
  var raw = run(['-v', 'error', '-i', file, '-vf', pre + 'scale=' + w + ':' + h,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  var a = [[], [], []], x, c;
  for (x = 0; x < w; x++) for (c = 0; c < 3; c++) {
    a[c].push(raw[(1 * w + x) * 3 + c]);
    a[c].push(raw[((h - 2) * w + x) * 3 + c]);
  }
  return '0x' + a.map(function (v) {
    v.sort(function (p, q) { return p - q; });
    return ('0' + v[v.length >> 1].toString(16)).slice(-2);
  }).join('');
}

var files = fs.readdirSync(SRC).filter(function (f) { return /\.png$/i.test(f); });
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

var done = [], skipped = [];
files.forEach(function (f) {
  var slug = MAP[path.basename(f, path.extname(f)).toLowerCase()];
  if (!slug) { skipped.push(f); return; }

  var file = path.join(SRC, f);
  var full = pngSize(file);
  if (!full) { console.error('✗ ' + f + ' אינו PNG תקין'); process.exit(1); }

  /* צבע הרקע נדגם תמיד מהתמונה המלאה, גם כשיש חיתוך מקדים. בתוך החיתוך אין רקע כלל,
   * ודגימה משם הייתה מחזירה את צבע המכשיר ומרפדת את הפריים בכתום. */
  var a = analyze(file, full.w, full.h);
  var cut = CROP[path.basename(f, path.extname(f)).toLowerCase()];
  var pre = '', size = full;
  if (cut) {
    var q = {
      x: Math.round(cut.x * full.w), y: Math.round(cut.y * full.h),
      w: Math.round(cut.w * full.w), h: Math.round(cut.h * full.h)
    };
    pre = 'crop=' + q.w + ':' + q.h + ':' + q.x + ':' + q.y + ',';
    size = { w: q.w, h: q.h };
    a.box = { x: 0, y: 0, w: 1, h: 1 };   /* החיתוך הוא המכשיר, ואין בו מה לזהות */
    a.bg = padColor(file, pre, Math.min(q.w, 320), Math.min(q.h, 960));
  }

  /* תיבת התוכן בפיקסלים של המקור, ואז ריבוע־על ביחס 3:4 שמכיל אותה עם שוליים.
   * התיבה מורחבת ולא נחתכת, ולכן גם אם הזיהוי טעה בכמה פיקסלים שום תוכן לא נחתך. */
  var bx = a.box.x * size.w, by = a.box.y * size.h;
  var bw = a.box.w * size.w, bh = a.box.h * size.h;
  var m = Math.max(bw, bh) * MARGIN;
  bx -= m; by -= m; bw += 2 * m; bh += 2 * m;

  var fw = Math.max(bw, bh * RATIO), fh = fw / RATIO;
  var fx = bx + bw / 2 - fw / 2, fy = by + bh / 2 - fh / 2;

  /* המסגרת חורגת מהמקור כמעט תמיד, ולכן: חותכים את החפיפה עם המקור, ואז מרפדים
   * לגודל המלא בצבע הרקע. שני שלבים ולא אחד, כי crop של ffmpeg אינו יכול לצאת מהתמונה.
   *
   * כל החשבון נעשה על המסגרת המעוגלת (fx0,fy0,W,H) ולא על ערכי השבר. בגרסה הראשונה
   * הרוחב עוגל פעם אחת בתוך crop ופעם אחת בתוך pad, ובתמונה אחת מתוך 20 היעד של pad
   * יצא קטן בפיקסל אחד מהקלט שלו. ffmpeg נכשל שם ב-Invalid argument בלי לומר במה. */
  var fx0 = Math.round(fx), fy0 = Math.round(fy);
  var W = Math.round(fw), H = Math.round(fh);
  var cx = Math.min(Math.max(0, fx0), size.w - 1), cy = Math.min(Math.max(0, fy0), size.h - 1);
  var cw = Math.min(fx0 + W, size.w) - cx, ch = Math.min(fy0 + H, size.h) - cy;
  var px = cx - fx0, py = cy - fy0;
  if (cw < 1 || ch < 1) { console.error('✗ חיתוך ריק ב-' + f); process.exit(1); }

  /* הריפוד נצבע פעמיים: קודם בצבע הרקע שנדגם, ומיד אחריו fillborders במצב smear שמושח
   * החוצה את שורת הפיקסלים האחרונה של התוכן. הצבע הדגום לבדו הספיק רק לרקע אחיד, ורוב
   * הרנדרים יושבים על מדרג עדין. שם פס בצבע קבוע נראה כתפר אנכי בקצה התמונה, והמשיחה
   * ממשיכה את המדרג עצמו. pad נשאר לפניו כי fillborders אינו יכול להגדיל את הפריים. */
  var bord = [];
  if (!cut) {
    if (px > 0) bord.push('left=' + px);
    if (W - cw - px > 0) bord.push('right=' + (W - cw - px));
    if (py > 0) bord.push('top=' + py);
    if (H - ch - py > 0) bord.push('bottom=' + (H - ch - py));
  }

  WIDTHS.forEach(function (w) {
    var out = path.join(OUT, slug + '-' + w + '.webp');
    run(['-v', 'error', '-y', '-i', file,
      '-vf', pre + 'crop=' + cw + ':' + ch + ':' + cx + ':' + cy +
             ',pad=' + W + ':' + H + ':' + px + ':' + py + ':' + a.bg +
             (bord.length ? ',fillborders=' + bord.join(':') + ':mode=smear' : '') +
             ',scale=' + w + ':' + Math.round(w / RATIO) + ':flags=lanczos',
      '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6',
      '-preset', 'photo', out]);
  });
  done.push({ slug: slug, src: f, bg: a.bg, w: W, h: H });
});

/* ============================================ devices.json
 *
 * המאגר מתעדכן כאן ולא ביד, כי ה-srcset חייב לרשום בדיוק את הקבצים שנוצרו. רשימה שנכתבת
 * בנפרד מהיצירה היא בדיוק סוג הדבר שנשאר מאחור כשמידה משתנה, והדפדפן מוריד 404 בשקט
 * ונופל למידה אחרת בלי שאף אחד יראה.
 *
 * גם ה-alt נכתב כאן. הנוסח הקודם אמר "על דלפק המעבדה בפון גת" על כל 21 המכשירים, ואלה
 * תמונות סטודיו על רקע בהיר. מי שמקשיב לעמוד בקורא מסך היה מקבל תיאור של תמונה אחרת. */
var SHOT = {
  'iphone-17': 'הגב של המכשיר',
  'iphone-17-pro': 'שלושה צבעים, הגב של המכשירים',
  'iphone-17-pro-max': 'שלושה צבעים, הגב של המכשירים'
};

var dbFile = path.join(PROTO, 'devices.json');
var rawDb = fs.readFileSync(dbFile, 'utf8');
var db = JSON.parse(rawDb);
var bySlug = {};
done.forEach(function (d) { bySlug[d.slug] = d; });

db.devices.forEach(function (d) {
  if (!bySlug[d.slug]) return;
  var big = WIDTHS[WIDTHS.length - 1];
  d.media.hero = '/phones/img/' + d.slug + '-' + big + '.webp';
  d.media.srcset = WIDTHS.map(function (w) {
    return '/phones/img/' + d.slug + '-' + w + '.webp ' + w + 'w';
  }).join(', ');
  d.media.width = big;
  d.media.height = Math.round(big / RATIO);
  d.media.alt = d.name + ', ' + (SHOT[d.slug] || 'המסך והגב');
});
/* אותה הזחה שהייתה, אחרת כל הקובץ נראה כשינוי אחד גדול ב-diff */
var indent = /\n(\s+)"_"/.test(rawDb) ? RegExp.$1.length : 2;
fs.writeFileSync(dbFile, JSON.stringify(db, null, indent) + '\n');

/* קבצים של מידה שכבר לא בשימוש נשארים אחרת בתיקייה ובגיט לנצח */
var keep = {};
done.forEach(function (d) { WIDTHS.forEach(function (w) { keep[d.slug + '-' + w + '.webp'] = 1; }); });
var stale = fs.readdirSync(OUT).filter(function (f) { return /\.webp$/.test(f) && !keep[f]; });
stale.forEach(function (f) { fs.unlinkSync(path.join(OUT, f)); });

done.sort(function (a, b) { return a.slug < b.slug ? -1 : 1; });
done.forEach(function (d) {
  var k = WIDTHS.reduce(function (s, w) { return s + fs.statSync(path.join(OUT, d.slug + '-' + w + '.webp')).size; }, 0);
  console.log('  ' + d.slug.padEnd(20) + ' ← ' + d.src.padEnd(30) + ' רקע ' + d.bg + '  ' + Math.round(k / 1024) + 'KB');
});
console.log('\n' + done.length + ' מכשירים, ' + (done.length * WIDTHS.length) + ' קבצים ב-' +
  path.relative(ROOT, OUT).replace(/\\/g, '/') + ', ו-devices.json עודכן.');
if (stale.length) console.log('נמחקו קבצים ממידה ישנה: ' + stale.length);
if (skipped.length) console.log('לא מופו, ולכן לא הומרו: ' + skipped.join(', '));
var without = db.devices.filter(function (d) { return d.status !== 'reference' && !d.media.hero; });
if (without.length) console.log('עדיין בלי תמונה: ' + without.map(function (d) { return d.slug; }).join(', '));
console.log('הרצה הבאה: node .claude/tools/gen-devices.js');
