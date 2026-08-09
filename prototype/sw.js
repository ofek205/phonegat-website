/* PHONE GAT service worker — enables installability + offline fallback.
   Strategy: network-first for all same-origin GETs (content always fresh online),
   fall back to cache when offline. Bump CACHE to invalidate on major asset changes. */
/* v3: המדריך עבר מ-/phone-problems.html ל-/phone-problems/.
   v4: /index.html ירד מהמעטפת ומהגיבוי הלא-מקוון, כי הוא מפנה עכשיו ל-/. addAll דוחה תשובה
   שהיא הפניה, וה-catch שם בולע את זה בשקט, כלומר כתובת מפנה ברשימה מבטלת את כל האחסון.
   בלי החלפת שם המטמון, מבקר חוזר נשאר עם הכתובות הישנות במעטפת השמורה שלו לנצח.
   v5: /guides/ ו-/guides/official-vs-parallel-import/ נכנסו למעטפת, ולכן השם עולה.
   v6: /phones/ ושני עמודי המכשיר הראשונים.
   v7: Redmi Note 14 Pro.
   v8: iPhone 17 Pro.
   v9 והלאה: gen-devices.js מעלה את השם בעצמו בכל הרצה שהוסיפה כתובת למעטפת. עד v8 זה היה
   צעד ידני, והוא נשכח בהרצה שהוסיפה שלושה דגמים בבת אחת. אין יותר צורך לתעד כאן כל גרסה. */
const CACHE = 'pg-v14';
const SHELL = ['/phone-repair-kiryat-malachi/', '/phone-repair-beer-tuvia/', '/phone-repair-shafir/', '/phone-repair-yoav/', '/phone-repair-lachish/', '/xiaomi-repair-kiryat-gat/', '/redmi-repair-kiryat-gat/', '/galaxy-a-battery-replacement-kiryat-gat/', '/galaxy-a-screen-replacement-kiryat-gat/', '/guides/how-much-storage/', '/guides/esim-israel/', '/phones/find-my-phone/', '/phones/compare/', '/compare/', '/compare/galaxy-a56-vs-redmi-note-14-pro/', '/compare/redmi-note-14-vs-redmi-note-14-pro/', '/compare/galaxy-a56-vs-galaxy-a36/', '/compare/galaxy-s26-vs-galaxy-s26-ultra/', '/compare/iphone-17-vs-galaxy-s26/', '/compare/iphone-16-vs-iphone-17e/', '/compare/iphone-17-pro-vs-iphone-17-pro-max/', '/compare/iphone-17-vs-iphone-17-pro/', '/phones/redmi-note-14/', '/phones/xiaomi-15/', '/phones/galaxy-a36/', '/phones/galaxy-a56/', '/phones/galaxy-s26/', '/phones/iphone-17e/', '/phones/iphone-16/', '/phones/iphone-17-pro-max/', '/phones/iphone-17-pro/', '/phones/redmi-note-14-pro/', '/phones/galaxy-s26-ultra/', '/phones/', '/phones/iphone-17/', '/guides/', '/guides/official-vs-parallel-import/', '/contact/', '/mobile-phone-repair-kiryat-gat/', '/phone-screen-replacement-kiryat-gat/', '/charging-port-repair-kiryat-gat/', '/phone-battery-replacement-kiryat-gat/', '/iphone-repair-kiryat-gat/', './', '/phone-problems/', './manifest.json', './logo.jpg', './logo-mark.png', './icon-192.png', './whatsapp-logo.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return; // leave analytics / fonts / web3forms alone
  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (r) {
          return r || (req.mode === 'navigate' ? caches.match('./') : undefined);
        });
      })
  );
});
