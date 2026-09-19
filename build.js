#!/usr/bin/env node
/* 把 src/ 与 lib/ 合成单文件 public/index.html
 *  - 该文件既是 Cloudflare Pages 的部署产物，也是可直接双击打开的离线版
 *  - 品牌图标与版本号在构建时注入，源码里只留占位符，避免多处硬编码漂移
 */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

/* 应用版本号 —— 唯一出处，改这里即可（顶栏徽标会跟着变） */
const APP_VERSION = '1.0.0';

/* 顶栏与标签页图标：内联成 dataURL，保证单文件离线时也带着品牌。
 * 顶栏用 128px（显示 26px，等效 2x 以上），标签页用 64px —— 分开放，
 * 避免同一张 base64 在文件里重复三份。 */
const iconDataUrl = px =>
  'data:image/png;base64,' +
  fs.readFileSync(path.join(root, 'assets/slashbro-icon-' + px + '.png')).toString('base64');
const BRAND_ICON = iconDataUrl(128);
const FAVICON = iconDataUrl(64);

let html = read('src/index.html');
const css = read('src/app.css');
const app = [
  read('src/i18n.js'),     // 必须最先：LANG / t() 供后面所有模块使用
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

// 注入口在最后统一处理：占位符在 HTML 与 JS 里都可能出现
html = html
  .replace(/\/\*__FAVICON__\*\//g, () => FAVICON)
  .replace(/\/\*__BRAND_ICON__\*\//g, () => BRAND_ICON)
  .replace(/\/\*__APP_VERSION__\*\//g, () => APP_VERSION);

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
const out = path.join(root, 'public', 'index.html');
fs.writeFileSync(out, html);
console.log('built ->', path.relative(root, out), (html.length / 1024).toFixed(1) + ' KB', '| v' + APP_VERSION);
