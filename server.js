/* ==========================================================================
   Простейший статический сервер без зависимостей.
   Запуск:  node server.js        → http://localhost:3000
            node server.js 8080   → другой порт
   ========================================================================== */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/plain; charset=utf-8'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Cache-Control': 'no-cache' }, headers || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  // защита от выхода за пределы каталога
  const filePath = path.join(ROOT, path.normalize(pathname));
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      console.log('404', pathname);
      return send(res, 404, 'Не найдено: ' + pathname, { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) lan.push(ni.address);
    }
  }

  console.log('\n  Сайт запущен\n');
  console.log('  Локально:   http://localhost:' + PORT);
  lan.forEach(ip => console.log('  В сети:     http://' + ip + ':' + PORT));
  console.log('\n  Ctrl+C — остановить\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Порт ' + PORT + ' занят. Запустите: node server.js ' + (PORT + 1) + '\n');
    process.exit(1);
  }
  throw err;
});
