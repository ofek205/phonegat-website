/* PHONE GAT. The only switch for store phone calls.
   false: the store line is temporarily unavailable. Visible call buttons,
   tel: links and displayed phone numbers are WhatsApp (wa.me/97286812050).
   true: phone calls come back.
   After changing this value, run: node .claude/tools/apply-contact-mode.js
   Do not edit the call buttons by hand. That script is what applies the flag. */
window.PG_PHONE_CALLS_ENABLED = true;
