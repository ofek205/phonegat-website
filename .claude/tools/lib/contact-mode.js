/* Reads prototype/contact-mode.js so generators emit call buttons only when
   phone calls are enabled. The HTML already on disk is updated by
   node .claude/tools/apply-contact-mode.js */
'use strict';
var fs = require('fs');
var path = require('path');
var FILE = path.join(__dirname, '..', '..', '..', 'prototype', 'contact-mode.js');

function enabled() {
  var s = fs.readFileSync(FILE, 'utf8');
  var m = s.match(/window\.PG_PHONE_CALLS_ENABLED\s*=\s*(true|false)/);
  if (!m) throw new Error('prototype/contact-mode.js is missing window.PG_PHONE_CALLS_ENABLED');
  return m[1] === 'true';
}

var PHONE_CALLS_ENABLED = enabled();
var CALL = '<a class="btn btn-call" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>';
var CALL_HERO = '<a class="btn btn-call btn-hero" href="tel:+972525893366">חייגו <bdo dir="ltr">052-5893366</bdo></a>';

function callLine(indent) {
  if (!PHONE_CALLS_ENABLED) return '';
  return (indent || '') + CALL + '\n';
}
function callHeroInline() {
  return PHONE_CALLS_ENABLED ? CALL_HERO : '';
}

module.exports = {
  PHONE_CALLS_ENABLED: PHONE_CALLS_ENABLED,
  callLine: callLine,
  callHeroInline: callHeroInline
};
