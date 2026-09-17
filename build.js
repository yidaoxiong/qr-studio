#!/usr/bin/env node
/* 把 src/ 与 lib/ 合成单文件 public/index.html
 *  - 该文件既是 Cloudflare Pages 的部署产物，也是可直接双击打开的离线版
 */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('src/index.html');
const css = read('src/app.css');
const app = [
  read('src/app-core.js'),
  read('src/app-ui.js'),
  read('src/app-cloud.js'),
  read('src/app-boot.js'),
].join('\n');

// 内联 JS 时必须打断 </script>，否则会提前结束脚本标签
const safe = s => s.replace(/<\/script/gi, '<\\/script');

html = html
  .replace('/*__CSS__*/', () => css)
  .replace('/*__LIB_QRCODE__*/', () => safe(read('lib/qrcode-generator.js')))
  .replace('/*__LIB_JSQR__*/', () => safe(read('lib/jsqr.min.js')))
  .replace('/*__APP__*/', () => safe(app));

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
const out = path.join(root, 'public', 'index.html');
fs.writeFileSync(out, html);
console.log('built ->', path.relative(root, out), (html.length / 1024).toFixed(1) + ' KB');
