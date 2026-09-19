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
  sel.innerHTML = FONTS.map(f => `<option value="${f.id}">${fontLabel(f)}</option>`).join('');
  sel.value = state.fontId;
}
function buildVersionSelect() {
  const sel = $('version');
  let html = `<option value="0">${t('versionAuto')}</option>`;
  for (let v = 1; v <= 40; v++) html += `<option value="${v}">${t('versionItem', { v, n: v * 4 + 17 })}</option>`;
  sel.innerHTML = html;
  sel.value = String(state.version || 0);
}
function buildLangSelect() {
  const sel = $('langSel');
  sel.innerHTML = LANGS.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  sel.value = LANG;
  sel.onchange = () => { setLang(sel.value); applyLang(); };
}
/** 切换语言：静态文案 + 所有下拉框 + 预览/体检/云列表都要重刷 */
function applyLang() {
  buildLangSelect();
  buildFontSelect();
  buildVersionSelect();
  applyStaticText();
  $('cloudNote').innerHTML = t('cloudNote');
  syncUI();
  render();
  cloudRefresh(true);
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
  set('imagePad', state.imagePad);
  set('textGap', state.textGap);
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
  $('ipVal').textContent = state.imagePad;
  $('tgVal').textContent = state.textGap;
  $('qsVal').textContent = state.qrSize;
  const hint = $('shapeHint');
  if (hint) hint.textContent = t('shapeHint.' + (state.logoShape || 'round'));
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
  bind('imagePad', 'imagePad', v => Math.max(0, Math.min(80, v)));
  bind('textGap', 'textGap', v => Math.max(0, Math.min(120, v)));
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
    toast(t('toast.reset'));
  });
  $('btnPresetLight').addEventListener('click', () => {
    Object.assign(state, { fgColor: '#111827', bgColor: '#ffffff', cardColor: '#ffffff', textColor: '#111827', dotStyle: 'square', transparentBg: false });
    syncUI(); render(); toast(t('toast.light'));
  });
  $('btnPresetDark').addEventListener('click', () => {
    Object.assign(state, { fgColor: '#ffffff', bgColor: '#0b1220', cardColor: '#0b1220', textColor: '#f8fafc', dotStyle: 'square' });
    syncUI(); render(); toast(t('toast.dark'));
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
  img.onerror = () => toast(t('toast.imgUrlFail'), 4200);
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
    toast(t('toast.logoLoaded'));
  };
  if (preloaded) finish(preloaded);
  else { const img = new Image(); img.onload = () => finish(img); img.onerror = () => toast(t('toast.imgParseFail')); img.src = src; }
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
    const msg = t(res.error || 'toast.contentTooLong');
    const ctx = cv.getContext('2d');
    cv.width = 420; cv.height = 160;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fdecea'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#b42318'; ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText(msg, 18, 60);
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(t('toast.capacityHint'), 18, 92);
    $('previewMeta').textContent = '';
    $('checks').innerHTML = `<li class="bad"><span class="ic">✕</span><span class="txt">${msg}</span></li>`;
    return;
  }
  previewScale = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(res.scene.w * previewScale), h = Math.round(res.scene.h * previewScale);
  cv.width = w; cv.height = h;
  cv.style.width = res.scene.w + 'px';
  const ctx = cv.getContext('2d');
  drawScene(ctx, res.scene, previewScale, state);

  const m = res.meta;
  $('previewMeta').innerHTML = t('meta.line', {
    v: m.version, n: m.n, w: m.exportW, h: m.exportH, ms: m.exportMs.toFixed(1),
  });
  runChecks(res);
  updatePdfNote();
}
function updatePdfNote() {
  const el = $('pdfNote');
  const txt = (state.title + ' ' + state.subtitle).trim();
  const bytes = winAnsiBytes(txt);
  if (!txt) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = bytes ? t('pdfNote.vector') : t('pdfNote.bitmap');
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
  if (!res.ok) return { ok: false, reason: t(res.error) };
  const total = res.meta.total;
  const expect = new TextEncoder().encode(st.content);
  const trial = Object.assign({}, st, { transparentBg: false });
  let lastReason = t('decode.fail');
  let tried = 0;
  for (const pxPerModule of [10, 12, 8, 14, 6]) {
    const scale = Math.min(10, Math.max(1, (pxPerModule * total) / st.qrSize));
    if (scale > 10) continue;
    const cv = renderToCanvas(res.scene, trial, scale);
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let out = null;
    try { out = jsQR(data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' }); }
    catch (e) { lastReason = t('decode.exception', { msg: e.message }); continue; }
    tried++;
    if (!out || !out.binaryData) continue;
    const got = out.binaryData;
    if (got.length !== expect.length) {
      lastReason = t('decode.lenMismatch', { got: got.length, expect: expect.length });
      continue;
    }
    let same = true;
    for (let i = 0; i < expect.length; i++) if (expect[i] !== got[i]) { same = false; break; }
    if (same) return { ok: true, pxPerModule };
    lastReason = t('decode.mismatch');
  }
  return { ok: false, reason: lastReason, tried };
}
function runChecks(res) {
  const m = res.meta;
  const items = [];
  const name = k => '<b>' + t(k) + '</b>';

  // 1) 模块精度
  const ms = m.exportMs;
  items.push(ms >= 4
    ? { lv: 'ok', t: `${name('chk.precision')} ${t('chk.precision.px', { ms: ms.toFixed(1) })}${t('chk.precision.suffix', { w: m.exportW, h: m.exportH })}`, d: t('chk.precision.ok') }
    : ms >= 3
      ? { lv: 'warn', t: `${name('chk.precision')} ${t('chk.precision.px', { ms: ms.toFixed(1) })}${t('chk.precision.small')}`, d: t('chk.precision.warn') }
      : { lv: 'bad', t: `${name('chk.precision')} ${t('chk.precision.px', { ms: ms.toFixed(2) })}`, d: t('chk.precision.bad') });

  // 2) 定位图案避让
  if (m.hasLogo) {
    items.push(m.clearanceOk
      ? { lv: 'ok', t: name('chk.clear'), d: t('chk.clear.ok') }
      : { lv: 'bad', t: name('chk.clear'), d: t('chk.clear.bad', { v: m.needV }) });
  }

  // 3) 遮挡面积
  if (m.hasLogo) {
    const c = m.coverPct;
    items.push(c < 9
      ? { lv: 'ok', t: `${name('chk.cover')} ${t('chk.cover.pre')}${c.toFixed(1)}%`, d: t('chk.cover.ok') }
      : c < 14
        ? { lv: 'warn', t: `${name('chk.cover')} ${t('chk.cover.pre')}${c.toFixed(1)}%${t('chk.cover.warnSuffix')}`, d: t('chk.cover.warn') }
        : { lv: 'bad', t: `${name('chk.cover')} ${t('chk.cover.pre')}${c.toFixed(1)}%${t('chk.cover.badSuffix')}`, d: t('chk.cover.bad') });
  }

  // 4) 实测解码（页面内置解码器，按导出样式重绘）
  const chk = decodeCheck(state);
  items.push(chk.ok
    ? { lv: 'ok', t: name('chk.decode'), d: t('chk.decode.ok', { px: chk.pxPerModule }) }
    : { lv: 'bad', t: name('chk.decode'), d: t('chk.decode.bad', { reason: chk.reason || '' }) });

  // 5) 静区
  items.push(m.quiet >= 4
    ? { lv: 'ok', t: `${name('chk.quiet')} ${m.quiet}`, d: t('chk.quiet.ok') }
    : { lv: 'warn', t: `${name('chk.quiet')} ${m.quiet}`, d: t('chk.quiet.warn') });

  // 6) 容错级别
  if (m.hasLogo && state.ecc !== 'H') {
    items.push({ lv: 'warn', t: `${name('chk.ecc')} ${state.ecc}`, d: t('chk.ecc.warn') });
  } else {
    items.push({ lv: 'ok', t: `${name('chk.ecc')} ${state.ecc}`, d: state.ecc === 'H' ? t('chk.ecc.highest') : t('chk.ecc.acceptable') });
  }

  // 7) 反色提示
  const lum = h => { const v = parseInt(h.slice(1), 16); return (((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114); };
  if (lum(state.fgColor) > lum(state.bgColor)) {
    items.push({ lv: 'warn', t: name('chk.invert'), d: t('chk.invert.desc') });
  }
  // 8) 装饰性模块样式
  if (state.dotStyle !== 'square') {
    items.push({
      lv: 'ok',
      t: `${name('chk.style')} ${state.dotStyle === 'dots' ? t('chk.style.dots') : t('chk.style.round')}`,
      d: t('chk.style.desc'),
    });
  }

  $('checks').innerHTML = items.map(i =>
    `<li class="${i.lv}"><span class="ic">${i.lv === 'ok' ? '✓' : (i.lv === 'warn' ? '!' : '✕')}</span><span class="txt">${i.t}<br><span style="opacity:.75">${i.d}</span></span></li>`
  ).join('');
}

/* -------------------------------------------------------------- 自动优化 */
function autoFix() {
  const log = [];
  if (state.ecc !== 'H') { state.ecc = 'H'; log.push(t('fix.ecc')); }
  if (!state.content.trim()) { toast(t('toast.emptyContent')); return; }
  let mode = 'version';
  let guard = 0;
  while (guard++ < 80) {
    const res = buildScene(state, {});
    if (!res.ok) { toast(t(res.error), 3600); break; }
    if (!res.meta.clearanceOk) { state.version = res.meta.needV; log.push(t('fix.version', { v: res.meta.needV })); continue; }
    // 遮挡远超容错能力时，提高版本也救不回来，直接缩 Logo
    if (mode === 'version' && res.meta.coverPct > 18) { mode = 'logo'; continue; }
    const chk = decodeCheck(state);
    if (chk.ok) break;
    if (mode === 'version') {
      const cur = state.version || res.meta.version;
      if (cur >= 40 || cur - res.meta.version >= 8) { mode = 'logo'; continue; }
      state.version = cur + 1;
      log.push(t('fix.version2', { v: state.version }));
    } else if (mode === 'logo') {
      if (state.logoW <= 12 || state.logoH <= 12) { mode = 'plain'; continue; }
      state.logoW = Math.max(12, state.logoW - 2);
      state.logoH = Math.max(12, Math.min(state.logoH, state.logoW));
      log.push(t('fix.logo', { n: state.logoW }));
    } else {
      if (state.dotStyle !== 'square') { state.dotStyle = 'square'; log.push(t('fix.style')); continue; }
      break;
    }
  }
  syncUI(); render();
  const done = decodeCheck(state);
  toast(done.ok
    ? t('toast.optimizeOk', { log: log.length ? log.slice(-3).join(' → ') : t('toast.optimizeAlready') })
    : t('toast.optimizeFail'), done.ok ? 2600 : 4200);
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
  if (!res.ok) return toast(t(res.error), 3600);
  const cv = renderToCanvas(res.scene, state, state.exportScale);
  cv.toBlob(b => {
    if (!b) return toast(t('toast.exportFail'));
    download(b, `qrcode-${stamp()}.png`);
    toast(t('toast.exportedPng', { w: cv.width, h: cv.height }));
  }, 'image/png');
}
function exportSvg() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(t(res.error), 3600);
  const svg = toSVG(res.scene, state);
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `qrcode-${stamp()}.svg`);
  toast(t('toast.exportedSvg'));
}
function exportPdf() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(t(res.error), 3600);
  try {
    const bytes = toPDF(res.scene, state);
    download(new Blob([bytes], { type: 'application/pdf' }), `qrcode-${stamp()}.pdf`);
    toast(t('toast.exportedPdf'));
  } catch (e) { toast(t('toast.pdfFail', { msg: e.message }), 4000); }
}
function copyPng() {
  const res = buildScene(state, {});
  if (!res.ok) return toast(t(res.error), 3600);
  const cv = renderToCanvas(res.scene, state, state.exportScale);
  cv.toBlob(async b => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      toast(t('toast.copied'));
    } catch (e) { toast(t('toast.copyFail'), 3200); }
  }, 'image/png');
}

/* -------------------------------------------------------------------- 启动 */
function init() {
  buildLangSelect();
  buildFontSelect();
  buildVersionSelect();
  applyStaticText();
  $('appVersion').textContent = 'v' + APP_VERSION;
  $('cloudNote').innerHTML = t('cloudNote');
  syncUI();
  bindInputs();
  $('fontSample').style.fontFamily = fontById(state.fontId).css;
  render();
  cloudRefresh(true); // 云端列表：本地单文件打开时会安静失败，不影响使用
}
