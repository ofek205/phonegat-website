// Minimal dependency-free static server for the PHONE GAT prototype.
// Serves the ../prototype folder over http://localhost:8000
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'prototype');
const port = 8000;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.gif': 'image/gif', '.woff2': 'font/woff2'
};

http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  var file = path.normalize(path.join(root, p));
  if (file.indexOf(root) !== 0) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, function () {
  console.log('phonegat static server running on http://localhost:' + port + '/');
});
