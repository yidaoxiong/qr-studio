/* =========================================================================
 * QR Logo Studio · 交互层
 * ========================================================================= */
const $ = id => document.getElementById(id);
const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));
let previewScale = 1;
let lastResult = null;

/* ------------------------------------------------------------------ Toast */
let toastTimer = null;
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 220);
  }, ms || 2200);
}

/* ---------------------------------------------------------------- 控件绑定 */
function buildFontSelect() {
  const sel = $('fontFamily');
  sel.innerHTML = FONTS.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
  sel.value = state.fontId;
}
function buildVersionSelect() {
  const sel = $('version');
  let html = '<option value="0">自动</option>';
  for (let v = 1; v <= 40; v++) html += `<option value="${v}">v${v}（${v * 4 + 17} 模块）</option>`;
  sel.innerHTML = html;
  sel.value = '0';
}
function syncUI() {
  const set = (id, v) => { const el = $(id); if (el) el.value = v; };
  set('content', state.content);
  set('quiet', state.quiet);
  set('version', state.version);
  set('logoW', state.logoW);
  set('logoH', state.logoH);
  set('logoPad', state.logoPad);
  set('logoShape', state.logoShape);
  $('logoPlate').checked = state.logoPlate;
  set('title', state.title);
  set('subtitle', state.subtitle);
  set('fontFamily', state.fontId);
  set('titleSize', state.titleSize);
  set('subSize', state.subSize);
  set('weight', state.weight);
  set('align', state.align);
  set('letterSpacing', state.letterSpacing);
  set('lineHeight', state.lineHeight);
  set('textColor', state.textColor);
  set('fgColor', state.fgColor);
  set('bgColor', state.bgColor);
  set('cardColor', state.cardColor);
  set('cardRadius', state.cardRadius);
  set('cardPad', state.cardPad);
  set('qrSize', state.qrSize);
  set('exportScale', state.exportScale);
  $('transparentBg').checked = state.transparentBg;
  $$('#eccSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.ecc));
  $$('#dotSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.dotStyle));
  updateSliderLabels();
}
function updateSliderLabels() {
  $('lwVal').textContent = state.logoW + '%';
  $('lhVal').textContent = state.logoH + '%';
  $('lpadVal').textContent = state.logoPad + '%';
  $('tsVal').textContent = state.titleSize;
  $('ssVal').textContent = state.subSize;
  $('lsVal').textContent = state.letterSpacing;
  $('lhXVal').textContent = (+state.lineHeight).toFixed(2);
  $('crVal').textContent = state.cardRadius;
  $('cpVal').textContent = state.cardPad;
  $('qsVal').textContent = state.qrSize;
  const hint = $('shapeHint');
  if (hint) {
    hint.textContent = state.logoShape === 'circle'
      ? '取宽高较小值作正方形，居中裁切'
      : state.logoShape === 'square'
        ? '取宽高较小值作正方形，图片居中留白'
        : state.logoShape === 'none'
          ? '底板直角，跟随图片实际比例'
          : '底板圆角，贴住图片实际比例';
  }
}
function bindInputs() {
  const bind = (id, key, fn) => {
    const el = $(id);
    if (!el) return;
    const handler = () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number' || el.type === 'range' || el.id === 'version' || el.id === 'exportScale') v = parseFloat(v);
      state[key] = typeof fn === 'function' ? fn(v) : v;
      updateSliderLabels();
      scheduleRender();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  };
  bind('content', 'content');
  bind('quiet', 'quiet', v => Math.max(0, Math.min(10, v || 0)));
  bind('version', 'version', v => v || 0);
  bind('logoW', 'logoW', v => Math.max(0, Math.min(60, v)));
  bind('logoH', 'logoH', v => Math.max(0, Math.min(60, v)));
  bind('logoPad', 'logoPad', v => Math.max(0, Math.min(40, v)));
  bind('logoShape', 'logoShape');
  bind('logoPlate', 'logoPlate');
  bind('title', 'title');
  bind('subtitle', 'subtitle');
  bind('fontFamily', 'fontId');
  bind('titleSize', 'titleSize', v => Math.max(8, Math.min(72, v)));
  bind('subSize', 'subSize', v => Math.max(6, Math.min(48, v)));
  bind('weight', 'weight');
  bind('align', 'align');
  bind('letterSpacing', 'letterSpacing', v => Math.max(-2, Math.min(10, v)));
  bind('lineHeight', 'lineHeight', v => Math.max(1, Math.min(2.2, v)));
  bind('textColor', 'textColor');
  bind('fgColor', 'fgColor');
  bind('bgColor', 'bgColor');
  bind('cardColor', 'cardColor');
  bind('cardRadius', 'cardRadius', v => Math.max(0, Math.min(80, v)));
  bind('cardPad', 'cardPad', v => Math.max(0, Math.min(80, v)));
  bind('qrSize', 'qrSize', v => Math.max(160, Math.min(640, v)));
  bind('exportScale', 'exportScale', v => v || 2);
  bind('transparentBg', 'transparentBg');

  $('fontFamily').addEventListener('change', () => {
    const f = fontById(state.fontId);
    $('fontSample').style.fontFamily = f.css;
  });

  $$('#eccSeg button').forEach(b => b.addEventListener('click', () => {
    state.ecc = b.dataset.v;
    $$('#eccSeg button').forEach(x => x.classList.toggle('on', x === b));
    scheduleRender();
  }));
  $$('#dotSeg button').forEach(b => b.addEventListener('click', () => {
    state.dotStyle = b.dataset.v;
    $$('#dotSeg button').forEach(x => x.classList.toggle('on', x === b));
    scheduleRender();
  }));
  $$('.chip[data-ratio]').forEach(b => b.addEventListener('click', () => {
    const r = b.dataset.ratio;
    if (r === 'clear') {
      state.logoImg = null; state.logoSrc = null; state._logoAdjusted = false;
      $('logoThumb').hidden = true; $('logoThumb').src = '';
    }
    // 用固定尺寸，避免反复点击越点越大；用户可随后用滑块自由微调
    else if (r === 'square') { state.logoW = 22; state.logoH = 22; }
    else if (r === 'wide') { state.logoW = 30; state.logoH = 15; }
    else if (r === 'wide3') { state.logoW = 36; state.logoH = 12; }
    else if (r === 'tall') { state.logoW = 15; state.logoH = 30; }
    else if (r === 'fit' && state.logoImg) {
      const iw = state.logoImg.naturalWidth, ih = state.logoImg.naturalHeight;
      const LONG = 24;   // 长边固定 24%，短边按比例
      if (iw >= ih) { state.logoW = LONG; state.logoH = Math.max(6, Math.round(LONG * ih / iw)); }
      else { state.logoH = LONG; state.logoW = Math.max(6, Math.round(LONG * iw / ih)); }
    }
    syncUI(); scheduleRender();
  }));

  // Logo 上传 / 拖放 / 粘贴 / URL
  $('pickLogo').addEventListener('click', () => $('logoFile').click());
  $('logoFile').addEventListener('change', e => { if (e.target.files[0]) loadLogoFile(e.target.files[0]); });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadLogoFile(f);
    else {
      const txt = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (txt) { $('logoUrl').value = txt.trim(); loadLogoUrl(); }
    }
  });
  window.addEventListener('paste', e => {
    const items = (e.clipboardData || {}).items || [];
    for (const it of items) if (it.type && it.type.indexOf('image') === 0) { loadLogoFile(it.getAsFile()); e.preventDefault(); return; }
  });
  $('btnLoadUrl').addEventListener('click', loadLogoUrl);
  $('logoUrl').addEventListener('keydown', e => { if (e.key === 'Enter') loadLogoUrl(); });

  $('btnReset').addEventListener('click', () => {
    Object.assign(state, DEFAULTS);
    state.logoImg = null; state.logoSrc = null;
    $('logoThumb').hidden = true; $('logoThumb').src = ''; $('logoUrl').value = '';
    syncUI(); render();
    toast('已重置');
  });
  $('btnPresetLight').addEventListener('click', () => {
    Object.assign(state, { fgColor: '#111827', bgColor: '#ffffff', cardColor: '#ffffff', textColor: '#111827', dotStyle: 'square', transparentBg: false });
    syncUI(); render(); toast('浅色模板');
  });
  $('btnPresetDark').addEventListener('click', () => {
    Object.assign(state, { fgColor: '#ffffff', bgColor: '#0b1220', cardColor: '#0b1220', textColor: '#f8fafc', dotStyle: 'square' });
    syncUI(); render(); toast('深色模板（反色码，建议先看体检结果）');
  });

  $('btnPng').addEventListener('click', exportPng);
  $('btnSvg').addEventListener('click', exportSvg);
  $('btnPdf').addEventListener('click', exportPdf);
  $('btnCopy').addEventListener('click', copyPng);
  $('btnAutoFix').addEventListener('click', autoFix);
  bindCloud();
}

function loadLogoFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setLogo(reader.result);
  reader.readAsDataURL(file);
}
function loadLogoUrl() {
  const url = $('logoUrl').value.trim();
  if (!url) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => setLogo(url, img);
  img.onerror = () => toast('图片加载失败，或该站点不允许跨域读取；请先下载再上传本地文件', 4200);
  img.src = url;
}
function setLogo(src, preloaded) {
  const finish = img => {
    state.logoImg = img;
    state.logoSrc = src;
    const thumb = $('logoThumb');
    thumb.src = src; thumb.hidden = false;
    // 首次载入 logo 时按图片比例给一个合理框
    if (!state._logoAdjusted) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const box = 22;
      if (iw >= ih) { state.logoW = box; state.logoH = Math.max(8, Math.round(box * ih / iw)); }
      else { state.logoH = box; state.logoW = Math.max(8, Math.round(box * iw / ih)); }
      state._logoAdjusted = true;
    }
    syncUI(); render();
    toast('Logo 已载入');
  };
  if (preloaded) finish(preloaded);
  else { const img = new Image(); img.onload = () => finish(img); img.onerror = () => toast('图片解析失败'); img.src = src; }
}

/* ------------------------------------------------------------------ 渲染 */
let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 90);
}
function render() {
  const res = buildScene(state, {});
  lastResult = res;
  const cv = $('preview');
  if (!res.ok) {
    const ctx = cv.getContext('2d');
    cv.width = 420; cv.height = 160;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fdecea'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#b42318'; ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText(res.error, 18, 60);
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText('提示：二维码容量有限，长文本请改用短链接。', 18, 92);
    $('previewMeta').textContent = '';
    $('checks').innerHTML = `<li class="bad"><span class="ic">✕</span><span class="txt">${res.error}</span></li>`;
    return;
  }
  previewScale = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(res.scene.w * previewScale), h = Math.round(res.scene.h * previewScale);
  cv.width = w; cv.height = h;
  cv.style.width = res.scene.w + 'px';
  const ctx = cv.getContext('2d');
  drawScene(ctx, res.scene, previewScale, state);

  const m = res.meta;
  $('previewMeta').innerHTML =
    `v${m.version} · ${m.n}×${m.n} 模块<br>导出 ${m.exportW}×${m.exportH}px · ${(m.exportMs).toFixed(1)}px/模块`;
  runChecks(res);
  updatePdfNote();
}
function updatePdfNote() {
  const el = $('pdfNote');
  const t = (state.title + ' ' + state.subtitle).trim();
  const bytes = winAnsiBytes(t);
  if (!t) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = bytes
    ? 'PDF 说明：文字将用 PDF 内置标准字体以真矢量形式嵌入（覆盖英/德/西/法/葡/北欧等拉丁语系）。'
    : 'PDF 说明：当前文字含 PDF 标准字体不支持的字符（如中文/西里尔文），该行将作为高清位图嵌入；需要完全矢量中文字，请用 SVG 导出。';
}

/* ------------------------------------------------------------------ 体检 */
/** 体检用的是「样式是否成立」，所以要保证每模块有足够像素，
 *  不能沿用固定的画布宽度——否则高版本码会因为像素太少被误判为扫描失败。
 *
 *  另外要「多档取样」：jsQR 的块状二值化对采样相位敏感，实测同一张图在
 *  8px/模块读不出、而 6/10/12px 都能读（导出成品用 ZXing/OpenCV 也都能读）。
 *  只测单一分辨率会产生假警报，所以任一档通过就算通过。 */
function decodeCheck(st) {
  const res = buildScene(st, { includeCaption: false });
  if (!res.ok) return { ok: false, reason: res.error };
  const total = res.meta.total;
  const expect = new TextEncoder().encode(st.content);
  const trial = Object.assign({}, st, { transparentBg: false });
  let lastReason = '未识别到二维码';
  let tried = 0;
  for (const pxPerModule of [10, 12, 8, 14, 6]) {
    const scale = Math.min(10, Math.max(1, (pxPerModule * total) / st.qrSize));
    if (scale > 10) continue;
    const cv = renderToCanvas(res.scene, trial, scale);
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let out = null;
    try { out = jsQR(data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' }); }
    catch (e) { lastReason = '解码器异常：' + e.message; continue; }
    tried++;
    if (!out || !out.binaryData) continue;
    const got = out.binaryData;
    if (got.length !== expect.length) { lastReason = `内容长度不符（${got.length} vs ${expect.length} 字节）`; continue; }
    let same = true;
    for (let i = 0; i < expect.length; i++) if (expect[i] !== got[i]) { same = false; break; }
    if (same) return { ok: true, pxPerModule };
    lastReason = '内容校验不一致';
  }
  return { ok: false, reason: lastReason, tried };
}
function runChecks(res) {
  const m = res.meta;
  const items = [];

  // 1) 模块精度
  const ms = m.exportMs;
  items.push(ms >= 4
    ? { lv: 'ok', t: `<b>模块精度</b> ${ms.toFixed(1)}px/模块（导出 ${m.exportW}×${m.exportH}px）`, d: '打印与远距离扫描都安全' }
    : ms >= 3
      ? { lv: 'warn', t: `<b>模块精度</b> ${ms.toFixed(1)}px/模块，偏小`, d: '建议提高「导出倍率」或加大二维码尺寸' }
      : { lv: 'bad', t: `<b>模块精度</b> 仅 ${ms.toFixed(2)}px/模块`, d: '过小会导致扫描失败，请增大尺寸或提高倍率' });

  // 2) 定位图案避让
  if (m.hasLogo) {
    items.push(m.clearanceOk
      ? { lv: 'ok', t: '<b>定位图案避让</b> 通过', d: '三个角上的定位方块未被遮挡' }
      : { lv: 'bad', t: '<b>定位图案避让</b> 失败', d: `Logo 框侵入了定位图案区域，请把版本提到 v${m.needV} 以上，或缩小 Logo` });
  }

  // 3) 遮挡面积
  if (m.hasLogo) {
    const c = m.coverPct;
    items.push(c < 9
      ? { lv: 'ok', t: `<b>Logo 遮挡</b> 占矩阵面积 ${c.toFixed(1)}%`, d: '在 H 级容错的安全区间内' }
      : c < 14
        ? { lv: 'warn', t: `<b>Logo 遮挡</b> 占 ${c.toFixed(1)}%，偏大`, d: '建议开 H 级容错并以体检结果为准' }
        : { lv: 'bad', t: `<b>Logo 遮挡</b> 占 ${c.toFixed(1)}%，过大`, d: '已超出容错能力，请显著缩小 Logo' });
  }

  // 4) 实测解码（页面内置解码器，按导出样式重绘）
  const chk = decodeCheck(state);
  items.push(chk.ok
    ? { lv: 'ok', t: '<b>实测解码</b> 通过', d: `按当前样式重绘（${chk.pxPerModule}px/模块）后，内置解码器完整读出了内容` }
    : { lv: 'bad', t: '<b>实测解码</b> 未通过', d: (chk.reason || '') + '（已尝试多种采样倍率）。可点右上「自动优化到可扫描」' });

  // 5) 静区
  items.push(m.quiet >= 4
    ? { lv: 'ok', t: `<b>静区</b> ${m.quiet} 模块`, d: '符合标准（≥4）' }
    : { lv: 'warn', t: `<b>静区</b> ${m.quiet} 模块，小于标准 4`, d: '周边预留越少，越容易被误识别' });

  // 6) 容错级别
  if (m.hasLogo && state.ecc !== 'H') {
    items.push({ lv: 'warn', t: `<b>容错级别</b> 当前 ${state.ecc}`, d: '带 Logo 时强烈建议使用 H（30%）' });
  } else {
    items.push({ lv: 'ok', t: `<b>容错级别</b> ${state.ecc}`, d: state.ecc === 'H' ? '最高容错' : '无 Logo 遮挡时可接受' });
  }

  // 7) 反色提示
  const lum = h => { const v = parseInt(h.slice(1), 16); return (((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114); };
  if (lum(state.fgColor) > lum(state.bgColor)) {
    items.push({ lv: 'warn', t: '<b>反色二维码</b>（浅码点 + 深底）', d: '现代手机可识别，但部分老设备/工业扫码枪不支持' });
  }
  // 8) 装饰性模块样式
  if (state.dotStyle !== 'square') {
    items.push({
      lv: 'ok',
      t: `<b>模块样式</b> ${state.dotStyle === 'dots' ? '圆点' : '圆角'}`,
      d: '定位/时序/校正图案已强制保持实心，装饰只作用于数据模块——这是能被扫出来的前提',
    });
  }

  $('checks').innerHTML = items.map(i =>
    `<li class="${i.lv}"><span class="ic">${i.lv === 'ok' ? '✓' : (i.lv === 'warn' ? '!' : '✕')}</span><span class="txt">${i.t}<br><span style="opacity:.75">${i.d}</span></span></li>`
  ).join('');
}

/* -------------------------------------------------------------- 自动优化 */
function autoFix() {
  const log = [];
  if (state.ecc !== 'H') { state.ecc = 'H'; log.push('容错提到 H'); }
  if (!state.content.trim()) { toast('请先填写二维码内容'); return; }
  let mode = 'version';
  let guard = 0;
  while (guard++ < 80) {
    const res = buildScene(state, {});
    if (!res.ok) { toast(res.error, 3600); break; }
    if (!res.meta.clearanceOk) { state.version = res.meta.needV; log.push('版本提到 v' + res.meta.needV); continue; }
    // 遮挡远超容错能力时，提高版本也救不回来，直接缩 Logo
    if (mode === 'version' && res.meta.coverPct > 18) { mode = 'logo'; continue; }
    const chk = decodeCheck(state);
    if (chk.ok) break;
    if (mode === 'version') {
      const cur = state.version || res.meta.version;
      if (cur >= 40 || cur - res.meta.version >= 8) { mode = 'logo'; continue; }
      state.version = cur + 1;
      log.push('版本 v' + state.version);
    } else if (mode === 'logo') {
      if (state.logoW <= 12 || state.logoH <= 12) { mode = 'plain'; continue; }
      state.logoW = Math.max(12, state.logoW - 2);
      state.logoH = Math.max(12, Math.min(state.logoH, state.logoW));
      log.push('Logo 缩到 ' + state.logoW + '%');
    } else {
      if (state.dotStyle !== 'square') { state.dotStyle = 'square'; log.push('模块改回方块'); continue; }
      break;
    }
  }
  syncUI(); render();
  const done = decodeCheck(state);
  toast(done.ok ? ('已优化：' + (log.length ? log.slice(-3).join(' → ') : '当前配置本就可用')) : '仍未能通过实测，请手动减小 Logo 或缩短内容', done.ok ? 2600 : 4200);
}

/* ------------------------------------------------------------------ 导出 */
function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportPng() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(res.error, 3600);
  const cv = renderToCanvas(res.scene, state, state.exportScale);
  cv.toBlob(b => {
    if (!b) return toast('导出失败');
    download(b, `qrcode-${stamp()}.png`);
    toast(`已导出 PNG ${cv.width}×${cv.height}`);
  }, 'image/png');
}
function exportSvg() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(res.error, 3600);
  const svg = toSVG(res.scene, state);
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `qrcode-${stamp()}.svg`);
  toast('已导出 SVG（全矢量）');
}
function exportPdf() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(res.error, 3600);
  try {
    const bytes = toPDF(res.scene, state);
    download(new Blob([bytes], { type: 'application/pdf' }), `qrcode-${stamp()}.pdf`);
    toast('已导出 PDF');
  } catch (e) { toast('PDF 生成失败：' + e.message, 4000); }
}
function copyPng() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(res.error, 3600);
  const cv = renderToCanvas(res.scene, state, state.exportScale);
  cv.toBlob(async b => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      toast('PNG 已复制到剪贴板');
    } catch (e) { toast('复制失败，浏览器可能未授权剪贴板权限', 3200); }
  }, 'image/png');
}

/* -------------------------------------------------------------------- 启动 */
function init() {
  buildFontSelect();
  buildVersionSelect();
  $('appVersion').textContent = 'v' + APP_VERSION;
  syncUI();
  bindInputs();
  $('fontSample').style.fontFamily = fontById(state.fontId).css;
  render();
  cloudRefresh(true); // 云端列表：本地单文件打开时会安静失败，不影响使用
}
