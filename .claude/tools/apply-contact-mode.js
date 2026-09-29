#!/usr/bin/env node
/* Applies prototype/contact-mode.js to every HTML page.
 *
 *   node .claude/tools/apply-contact-mode.js
 *
 * PHONE_CALLS_ENABLED false: visible tel: links, call buttons and displayed
 * store numbers become WhatsApp (wa.me/97286812050). A call button that already
 * sits beside a WhatsApp button is removed, so the row does not show two
 * WhatsApp buttons. Markers (<!--pg-call*-->) remember where to put the phone
 * controls back.
 *
 * PHONE_CALLS_ENABLED true: those markers become call controls again.
 *
 * JSON-LD telephone stays +972-8-6812050 either way. The mobile number is not
 * put back into structured data.
 *
 * Titles, meta descriptions, H1s, canonicals, the sitemap and redirects are
 * not touched. The lead-tracking block is not touched.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var PROTO = path.join(ROOT, 'prototype');
var FLAG = path.join(PROTO, 'contact-mode.js');

var flagSrc = fs.readFileSync(FLAG, 'utf8');
var flag = flagSrc.match(/window\.PG_PHONE_CALLS_ENABLED\s*=\s*(true|false)/);
if (!flag) { console.error('missing window.PG_PHONE_CALLS_ENABLED'); process.exit(1); }
var ON = flag[1] === 'true';

var WA = 'https://wa.me/97286812050';
var CALL = '<a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>';
var CALL_HERO = '<a class="btn btn-call btn-hero" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>';
var CALL_HOME = '<a class="btn btn-call" href="tel:+972525893366" aria-label="חייגו 052-5893366"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1l-2.2 2.3Z"/></svg>חייגו <span class="num" dir="ltr">052-5893366</span></a>';
var CALL_IC = '<a class="ic" href="tel:+972525893366" aria-label="טלפון"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4.5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1l-2.2 2.3Z"/></svg></a>';
var CALL_RAIL = '<a class="tel" href="tel:+972525893366" aria-label="טלפון"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4.5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1l-2.2 2.3Z"/></svg></a>';
var CALL_MBAR = '<a href="tel:+972525893366"><span class="mi" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4.5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1l-2.2 2.3Z"/></svg></span>חייגו</a>';
var CALL_CH = '<a class="ch" data-pg-cta="phone" data-pg-loc="channels" href="tel:+972525893366">\n        <span class="ch-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4.5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1l-2.2 2.3Z"/></svg></span>\n        <span class="ch-txt"><b><bdo dir="ltr">052-5893366</bdo></b><span>ברוך וסיגל עונים בעצמם</span></span>\n      </a>';
var FORM_TEL = ' · <a href="tel:+972525893366"><span dir="ltr">052-5893366</span></a>';

var FOOT_ON = '<li><a href="tel:+972525893366"><bdo dir="ltr">052-5893366</bdo></a></li><li><a href="tel:+97286812050"><bdo dir="ltr">08-6812050</bdo></a></li>';
var FOOT_OFF = '<li data-pg-was-phones="1"><a href="' + WA + '">WhatsApp</a></li>';
var LEGAL_ON = '<span class="k">טלפון:</span> <span><a href="tel:+972525893366"><bdo dir="ltr">052-5893366</bdo></a> · <a href="tel:+97286812050"><bdo dir="ltr">08-6812050</bdo></a></span>';
var LEGAL_OFF = '<span class="k">WhatsApp:</span> <span><a data-pg-was-phones="legal" href="' + WA + '">כתבו לנו ב-WhatsApp</a></span>';
var REV_ON = '<div class="rev-cta"><a class="btn btn-teal" href="tel:+972525893366">חייגו עכשיו</a></div>';
var REV_OFF = '<div class="rev-cta"><a class="btn btn-wa" href="' + WA + '"><img class="wa-ico" src="whatsapp-logo.png" alt="" width="22" height="22" decoding="async">WhatsApp</a></div>';
var MAP_ON = '<b>טלפון:</b> <bdo dir="ltr">052-5893366</bdo> · <bdo dir="ltr">08-6812050</bdo>';
var MAP_OFF = '<b>WhatsApp:</b> <a href="' + WA + '">כתבו לנו ב-WhatsApp</a>';
var GRID_ON = 'grid-template-columns:1fr 1fr 1fr;background:#fff';
var GRID_OFF = 'grid-template-columns:1fr 1fr;background:#fff';

/* Longer phrases first, so a shorter one cannot eat part of a longer one. */
var COPY = [
  ['חייגו 052-5893366 או שלחו WhatsApp', 'שלחו הודעה ב-WhatsApp'],
  ['או חייגו 052-5893366', 'או כתבו לנו ב-WhatsApp'],
  ['בינתיים חייגו 052-5893366 או שלחו WhatsApp.', 'בינתיים שלחו הודעה ב-WhatsApp.'],
  ['משהו השתבש בשליחה. חייגו 052-5893366 או שלחו WhatsApp.', 'משהו השתבש בשליחה. שלחו הודעה ב-WhatsApp.']
];

function walk(d, o) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
    var p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.html$/.test(e.name)) o.push(p);
  });
  return o;
}
function fit(file, s) {
  return file.indexOf('\r\n') >= 0 ? s.replace(/\n/g, '\r\n') : s;
}
function swap(s, from, to) {
  if (s.indexOf(from) < 0) return s;
  return s.split(from).join(to);
}
function swapRe(s, re, to) {
  return s.replace(re, to);
}

function towardOff(s, file) {
  s = swapRe(s, /<a class="btn btn-call" href="tel:\+972525893366" aria-label="חייגו 052-5893366">[\s\S]*?<\/a>/g, '<!--pg-call-home-->');
  s = swap(s, CALL_HERO, '<!--pg-call-hero-->');
  s = swap(s, CALL, '<!--pg-call-->');
  s = swap(s, REV_ON, REV_OFF);
  s = swapRe(s, /<a class="ic" href="tel:\+972525893366" aria-label="טלפון">[\s\S]*?<\/a>/g, '<!--pg-call-ic-->');
  s = swapRe(s, /<a class="tel" href="tel:\+972525893366" aria-label="טלפון">[\s\S]*?<\/a>/g, '<!--pg-call-rail-->');
  s = swapRe(s, /<a href="tel:\+972525893366"><span class="mi"[\s\S]*?<\/a>/g, '<!--pg-call-mbar-->');
  s = swap(s, FOOT_ON, FOOT_OFF);
  s = swap(s, LEGAL_ON, LEGAL_OFF);
  s = swapRe(s, /<a class="ch" data-pg-cta="phone"[\s\S]*?<\/a>/g, '<!--pg-call-ch-->');
  s = swap(s, FORM_TEL, '<!--pg-call-form-->');
  s = swap(s, MAP_ON, MAP_OFF);
  s = swap(s, GRID_ON, GRID_OFF);
  COPY.forEach(function (p) { s = swap(s, p[0], p[1]); });
  return s;
}
function towardOn(s, file) {
  s = swap(s, '<!--pg-call-home-->', CALL_HOME);
  s = swap(s, '<!--pg-call-hero-->', CALL_HERO);
  s = swap(s, '<!--pg-call-->', CALL);
  s = swap(s, '<!--pg-call-ic-->', CALL_IC);
  s = swap(s, '<!--pg-call-rail-->', CALL_RAIL);
  s = swap(s, '<!--pg-call-mbar-->', CALL_MBAR);
  s = swap(s, '<!--pg-call-ch-->', fit(file, CALL_CH));
  s = swap(s, '<!--pg-call-form-->', FORM_TEL);
  s = swap(s, REV_OFF, REV_ON);
  s = swap(s, FOOT_OFF, FOOT_ON);
  s = swap(s, LEGAL_OFF, LEGAL_ON);
  s = swap(s, MAP_OFF, MAP_ON);
  s = swap(s, GRID_OFF, GRID_ON);
  COPY.forEach(function (p) { s = swap(s, p[1], p[0]); });
  return s;
}

var changed = 0, telLeft = [];
walk(PROTO, []).forEach(function (f) {
  var orig = fs.readFileSync(f, 'utf8');
  var s = ON ? towardOn(orig, orig) : towardOff(orig, orig);
  /* Structured data keeps the landline. The mobile is dropped and not restored. */
  s = swap(s, '+972-52-5893366', '+972-8-6812050');
  if (s.indexOf('/contact-mode.js') < 0 && s.indexOf('</head>') >= 0) {
    var br = orig.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    s = s.replace('</head>', '<script src="/contact-mode.js"></script>' + br + '</head>');
  }
  if (s !== orig) { fs.writeFileSync(f, s); changed++; }
  if (/href\s*=\s*["']tel:/i.test(s)) telLeft.push(path.relative(PROTO, f));
});

console.log((ON ? 'calls on' : 'calls off') + ', wrote ' + changed + ' files');
if (!ON && telLeft.length) {
  console.error('tel: hrefs remain in ' + telLeft.join(', '));
  process.exit(1);
}
