#!/usr/bin/env node
/* PHONE GAT — normalise and optimise the photos for a content page.
 *
 *   node .claude/skills/pg-new-content-page/scripts/prep-images.js <folder>
 *   e.g.  … prep-images.js problems
 *
 * Drop the raw files into prototype/<folder>/ under their final names and run this. It:
 *   1. checks the real format by magic bytes, not by extension — files handed over by people and by
 *      image tools are routinely PNGs called .jpg (one arrived as "no-power.jpg.png", and seven
 *      photos weighed 14.13 MB)
 *   2. re-encodes everything to real JPEG at quality 82, after backing the originals up
 *   3. verifies the aspect ratio is 3:4 portrait, because the layout and the mobile crop depend on it
 *   4. builds the 700px variant and the WebP pair, which is where ~72% of the mobile weight goes
 *
 * Needs ffmpeg on PATH (or FFMPEG=<path>). No npm dependencies, by project rule.
 */
'use strict';
var fs = require('fs'), path = require('path'), cp = require('child_process');

var ROOT = path.resolve(__dirname, '..', '..', '..', '..');
var folder = process.argv[2];
if (!folder) { console.error('שימוש: prep-images.js <folder>   (למשל: problems)'); process.exit(1); }
var dir = path.join(ROOT, 'prototype', folder);
if (!fs.existsSync(dir)) { console.error('לא נמצאה התיקייה ' + dir); process.exit(1); }

/* ffmpeg */
var FFMPEG = process.env.FFMPEG || 'ffmpeg';
function ff(args) { return cp.spawnSync(FFMPEG, args, { encoding: 'utf8' }); }
if (ff(['-hide_banner', '-version']).error) {
  console.error('ffmpeg לא נמצא. התקן, או הרץ עם FFMPEG=<נתיב מלא>.');
  console.error('ב-Windows הוא לעיתים כאן: %LOCALAPPDATA%\\ai-video-tools\\ffmpeg\\...\\bin\\ffmpeg.exe');
  process.exit(1);
}
if ((ff(['-hide_banner', '-encoders']).stdout || '').indexOf('libwebp') < 0) {
  console.error('ל-ffmpeg הזה אין libwebp — אי אפשר לייצר WebP.'); process.exit(1);
}

function magic(p) {
  var fd = fs.openSync(p, 'r'), b = Buffer.alloc(4);
  fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd);
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'png';
  if (b.slice(0, 4).toString() === 'RIFF') return 'webp';
  return 'unknown';
}
/* dimensions without a decoder: ask ffmpeg */
function dims(p) {
  var out = ff(['-hide_banner', '-i', p]).stderr || '';
  var m = out.match(/,\s(\d{2,5})x(\d{2,5})[,\s]/);
  return m ? { w: +m[1], h: +m[2] } : null;
}

/* originals worth keeping: anything that is not already a generated variant */
var files = fs.readdirSync(dir).filter(function (f) {
  return /\.(jpg|jpeg|png)$/i.test(f) && !/-700\.(jpg|jpeg)$/i.test(f);
});
if (!files.length) { console.error('אין תמונות מקור ב-' + dir); process.exit(1); }

var bak = path.join(dir, '_originals');
if (!fs.existsSync(bak)) fs.mkdirSync(bak);

var rows = [], warn = [], totalBefore = 0, totalMobile = 0;

files.forEach(function (f) {
  var src = path.join(dir, f);
  /* "x.jpg.png" -> "x.jpg" ; "x.png" -> "x.jpg" */
  var base = f.replace(/\.(jpg|jpeg)\.png$/i, '.$1').replace(/\.png$/i, '.jpg').replace(/\.jpeg$/i, '.jpg');
  var name = base.replace(/\.jpg$/i, '');
  var fmt = magic(src), d = dims(src);
  totalBefore += fs.statSync(src).size;

  if (d) {
    var ratio = d.w / d.h;
    if (Math.abs(ratio - 0.75) > 0.02) {
      warn.push(name + ': יחס ' + ratio.toFixed(3) + ' ולא 0.75 (3:4 לאורך) — הפריסה והחיתוך במובייל מניחים 3:4');
    }
    if (d.w < 1000) warn.push(name + ': רוחב ' + d.w + 'px, פחות מ-1000 — מסך צפוף יראה תמונה רכה');
  }

  fs.copyFileSync(src, path.join(bak, f));

  var jpg = path.join(dir, name + '.jpg');
  /* -q:v 4 ≈ quality 82; also flattens any alpha a PNG carried in */
  var r1 = ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-q:v', '4', jpg + '.tmp']);
  if (r1.status !== 0) { warn.push(name + ': כשל בהמרה ל-JPEG'); return; }
  if (fs.existsSync(src) && path.resolve(src) !== path.resolve(jpg)) fs.unlinkSync(src);
  fs.renameSync(jpg + '.tmp', jpg);

  ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', jpg, '-vf', 'scale=700:-2', '-q:v', '4', path.join(dir, name + '-700.jpg')]);
  ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', jpg, '-c:v', 'libwebp', '-quality', '80', path.join(dir, name + '.webp')]);
  ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, name + '-700.jpg'), '-c:v', 'libwebp', '-quality', '80', path.join(dir, name + '-700.webp')]);

  function kb(p) { try { return Math.round(fs.statSync(p).size / 1024); } catch (e) { return 0; } }
  var mobile = kb(path.join(dir, name + '-700.webp'));
  totalMobile += mobile * 1024;
  rows.push({ name: name, was: fmt.toUpperCase(), dims: d ? d.w + 'x' + d.h : '?',
              jpg: kb(jpg), j700: kb(path.join(dir, name + '-700.jpg')),
              webp: kb(path.join(dir, name + '.webp')), w700: mobile });
});

console.log('');
console.log('  ' + 'file'.padEnd(16) + 'was   ' + 'dims'.padEnd(11) + 'jpg   700   webp  700w');
rows.forEach(function (r) {
  console.log('  ' + r.name.padEnd(16) + r.was.padEnd(6) + r.dims.padEnd(11) +
    String(r.jpg + 'K').padEnd(6) + String(r.j700 + 'K').padEnd(6) +
    String(r.webp + 'K').padEnd(6) + r.w700 + 'K');
});
console.log('');
console.log('  מקור: ' + Math.round(totalBefore / 1024) + ' KB   →   מובייל בפועל: ' + Math.round(totalMobile / 1024) + ' KB' +
  (totalBefore ? '   (' + (100 - Math.round(totalMobile * 100 / totalBefore)) + '% פחות)' : ''));
console.log('  המקור גובה ב-' + path.relative(ROOT, bak));
if (warn.length) { console.log('\n  אזהרות:'); warn.forEach(function (w) { console.log('   ⚠ ' + w); }); }
console.log('\n  ה-markup לכל תמונה:');
console.log('  <picture>');
console.log('    <source type="image/webp" sizes="(max-width:900px) 92vw, 53vw" srcset="' + folder + '/NAME-700.webp 700w, ' + folder + '/NAME.webp 1086w">');
console.log('    <source type="image/jpeg" sizes="(max-width:900px) 92vw, 53vw" srcset="' + folder + '/NAME-700.jpg 700w, ' + folder + '/NAME.jpg 1086w">');
console.log('    <img src="' + folder + '/NAME.jpg" alt="…" width="1086" height="1448" loading="lazy" decoding="async">');
console.log('  </picture>');
console.log('\n  ואל תשכח: git add prototype/' + folder + '  — קובץ לא מנוהל לא נפרס.\n');
