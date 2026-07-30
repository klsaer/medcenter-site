/* ==========================================================================
   Сборка одного самодостаточного файла (CSS, JS и картинки — внутрь HTML).
   Запуск: node build.js

   На выходе:
     dist/index.html    — полноценная страница; можно открыть двойным кликом,
                          отправить в мессенджере, залить на любой хостинг
     dist/artifact.html — та же страница без <html>/<head>/<body>,
                          для публикации через Artifact
   ========================================================================== */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');

/* --- 1. Картинки → data: URI --- */
html = html.replace(/src="(assets\/img\/[^"]+)"/g, (m, rel) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn('  ! пропущен (нет файла): ' + rel);
    return m;
  }
  const ext = path.extname(rel).toLowerCase();
  const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
                 '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
  const data = fs.readFileSync(abs).toString('base64');
  return `src="data:${mime};base64,${data}"`;
});

/* --- 2. CSS внутрь ---
   Замена только функцией: в строке-замене $$ и $& трактуются как спецпоследовательности
   и молча портят код (в main.js есть хелпер $$). */
html = html.replace(
  /<link rel="stylesheet" href="assets\/css\/styles\.css">/,
  () => '<style>\n' + read('assets/css/styles.css') + '\n</style>'
);

/* --- 3. JS внутрь --- */
html = html.replace(
  /<script src="assets\/js\/main\.js"><\/script>/,
  () => '<script>\n' + read('assets/js/main.js') + '\n</script>'
);

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);

/* --- 4. Версия для Artifact: только содержимое, без каркаса документа ---
   Обёртка (<!doctype>, <head>, <body>) добавляется при публикации,
   поэтому переносим только <title>, <style> и inline-скрипты. */
const headInner = (html.match(/<head>([\s\S]*?)<\/head>/) || [, ''])[1];

const headBits = [
  (headInner.match(/<title>[\s\S]*?<\/title>/) || [''])[0],
  (headInner.match(/<style>[\s\S]*?<\/style>/) || [''])[0],
  (headInner.match(/<script>[\s\S]*?<\/script>/) || [''])[0]   // тема до отрисовки
].filter(Boolean).join('\n');

const bodyInner = (html.match(/<body>([\s\S]*)<\/body>/) || [, ''])[1];

fs.writeFileSync(path.join(DIST, 'artifact.html'), headBits + '\n' + bodyInner.trim() + '\n');

const kb = f => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' КБ';
console.log('\n  Готово:');
console.log('    dist/index.html     ' + kb('index.html'));
console.log('    dist/artifact.html  ' + kb('artifact.html') + '\n');
