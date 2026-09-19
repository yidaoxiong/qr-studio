/* =========================================================================
 * QR Logo Studio · 云端保存（Cloudflare Pages + KV）
 *  - 保存的是「PNG 文件 + 可复现的配方」，最多 20 个
 *  - 载入后可继续编辑，再存可覆盖同一个条目
 * ========================================================================= */
const CLOUD_API = '/api/qr';
const RECIPE_KEYS = Object.keys(DEFAULTS);

let cloudItems = [];
let cloudBusy = false;
let cloudLoadedId = null; // 当前预览对应云端哪一条

/* ------------------------------------------------------------ 小工具 */
function cloudRecipe(st) {
  const r = {};
  for (const k of RECIPE_KEYS) r[k] = st[k];
  r._logoAdjusted = true; // 载入时不要再自动改尺寸
  return r;
}
/** 把 dataURL 压到长边 maxEdge 以内，用于控制在库体积 */
function downscaleDataUrl(src, maxEdge, mime, quality) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const s = Math.min(1, maxEdge / Math.max(iw || 1, ih || 1));
      const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(cv.toDataURL(mime, quality)); } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function dataUrlBytes(url) {
  if (typeof url !== 'string') return 0;
  const i = url.indexOf('base64,');
  return i < 0 ? url.length : Math.round(((url.length - i - 7) * 3) / 4);
}
function fmtBytes(n) {
  if (!n) return '—';
  return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function cloudFetch(path, opts) {
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = (data && data.error) || ('HTTP ' + res.status);
    throw new Error(err);
  }
  return data;
}

/* ------------------------------------------------------------ 保存 */
async function cloudSave() {
  if (cloudBusy) return;
  const res = buildScene(state, {});
  if (!res.ok) return toast(res.error, 3600);

  const name = (cloudLoadedId ? (state._cloudName || '') : '') ||
    (state.title || state.content || t('cloud.unnamed')).slice(0, 40);

  // 覆盖确认：已从云端载入过，就直接问要不要覆盖
  let targetId = null;
  if (cloudLoadedId) {
    const yes = window.confirm(t('cloud.confirmOverwrite', { name: state._cloudName || name }));
    if (yes) targetId = cloudLoadedId;
  }

  cloudBusy = true;
  setCloudStatus(t('cloud.saving'));
  try {
    const cv = renderToCanvas(res.scene, state, state.exportScale);
    const png = cv.toDataURL('image/png');

    // 缩略图：按 240px 二维码边长重绘一遍，再转小 JPEG
    const thumbCv = renderToCanvas(res.scene, Object.assign({}, state, { transparentBg: false }), 240 / state.qrSize);
    const thumb = thumbCv.toDataURL('image/jpeg', 0.78);

    // Logo 压到长边 720，避免把几 MB 的原图塞进库
    let logo = state.logoSrc ? (state.logoSrc.slice(0, 5) === 'data:' ? state.logoSrc : state.logoSrc) : '';
    if (logo && dataUrlBytes(logo) > 350 * 1024) {
      const small = await downscaleDataUrl(logo, 720, 'image/png');
      if (small) logo = small;
    }

    const body = {
      id: targetId,
      name: targetId ? (state._cloudName || name) : name,
      recipe: cloudRecipe(state),
      logo,
      png,
      thumb,
      w: cv.width,
      h: cv.height,
      bytes: dataUrlBytes(png),
    };
    const out = await cloudFetch(CLOUD_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    cloudLoadedId = out.id;
    state._cloudName = out.name;
    toast(t('cloud.saved', { name: out.name }), 2600);
    await cloudRefresh();
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.indexOf('limit_reached') === 0) {
      toast(t('cloud.limit', { n: msg.split(':')[1] || 20 }), 4200);
    } else if (msg === 'Failed to fetch' || msg.indexOf('Load failed') >= 0) {
      toast(t('cloud.offline'), 4600);
    } else {
      toast(t('cloud.saveFail', { msg }), 4200);
    }
  } finally {
    cloudBusy = false;
    setCloudStatus('');
  }
}

/* ------------------------------------------------------------ 列表 */
function setCloudStatus(text) {
  const el = $('cloudStatus');
  if (el) { el.textContent = text || ''; el.hidden = !text; }
}
function setCloudCount(n) {
  const el = $('cloudCount');
  if (!el) return;
  el.textContent = n === null ? '' : `${n} / 20`;
  el.classList.toggle('full', n >= 20);
}
async function cloudRefresh(silent) {
  const box = $('cloudList');
  if (!box) return;
  if (!silent) box.innerHTML = `<div class="cloud-empty">${t('cloud.loading')}</div>`;
  try {
    const out = await cloudFetch(CLOUD_API, { headers: { accept: 'application/json' } });
    cloudItems = out.items || [];
    setCloudCount(cloudItems.length);
    renderCloudList();
  } catch (e) {
    cloudItems = [];
    setCloudCount(null);
    box.innerHTML = `<div class="cloud-empty">${t('cloud.error', { msg: String(e.message || e) })}</div>`;
  }
}
function renderCloudList() {
  const box = $('cloudList');
  if (!cloudItems.length) {
    box.innerHTML = `<div class="cloud-empty">${t('cloud.empty')}</div>`;
    return;
  }
  box.innerHTML = cloudItems.map(it => `
    <div class="cloud-item${it.id === cloudLoadedId ? ' active' : ''}" data-id="${it.id}">
      <div class="ci-thumb">${it.thumb ? `<img src="${it.thumb}" alt="">` : `<span>${t('cloud.noPreview')}</span>`}</div>
      <div class="ci-body">
        <div class="ci-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
        <div class="ci-meta">${fmtTime(it.createdAt)} · ${it.w || '?'}×${it.h || '?'} · ${fmtBytes(it.bytes)}</div>
        <div class="ci-actions">
          <button class="mini primary" data-act="load">${t('cloud.load')}</button>
          <button class="mini" data-act="png">${t('cloud.png')}</button>
          <button class="mini danger" data-act="del">${t('cloud.del')}</button>
        </div>
      </div>
    </div>`).join('');
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------- 载入 / 下载 / 删除 */
async function cloudLoad(id) {
  if (cloudBusy) return;
  cloudBusy = true;
  setCloudStatus(t('cloud.loadingOne'));
  try {
    const out = await cloudFetch(CLOUD_API + '/' + id);
    const rec = out.item;
    applyRecipe(rec.recipe, rec.logo, rec.name, id);
    toast(t('cloud.loaded', { name: rec.name }));
  } catch (e) {
    toast(t('cloud.loadFail', { msg: String(e.message || e) }), 4000);
  } finally {
    cloudBusy = false;
    setCloudStatus('');
  }
}
function applyRecipe(recipe, logo, name, id) {
  if (recipe && typeof recipe === 'object') {
    for (const k of RECIPE_KEYS) if (k in recipe) state[k] = recipe[k];
  }
  state._logoAdjusted = true;
  state._cloudName = name || '';
  cloudLoadedId = id || null;

  const finish = () => { syncUI(); render(); renderCloudList(); };
  if (logo) {
    state.logoSrc = logo;
    const img = new Image();
    img.onload = () => { state.logoImg = img; $('logoThumb').src = logo; $('logoThumb').hidden = false; finish(); };
    img.onerror = () => { state.logoImg = null; state.logoSrc = null; $('logoThumb').hidden = true; finish(); toast(t('cloud.logoFail')); };
    img.src = logo;
  } else {
    state.logoImg = null; state.logoSrc = null;
    $('logoThumb').hidden = true; $('logoThumb').src = '';
    finish();
  }
}
async function cloudDownloadPng(id) {
  const it = cloudItems.find(x => x.id === id);
  setCloudStatus(t('cloud.fetching'));
  try {
    const out = await cloudFetch(CLOUD_API + '/' + id);
    const rec = out.item;
    const bin = atob(rec.png.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    download(new Blob([buf], { type: 'image/png' }), `qrcode-${(it ? it.name : id).replace(/[\\/:*?"<>|]/g, '_')}.png`);
    toast(t('cloud.downloaded'));
  } catch (e) {
    toast(t('cloud.dlFail', { msg: String(e.message || e) }), 4000);
  } finally {
    setCloudStatus('');
  }
}
async function cloudDelete(id) {
  const it = cloudItems.find(x => x.id === id);
  if (!window.confirm(t('cloud.confirmDelete', { name: it ? it.name : id }))) return;
  if (cloudBusy) return;
  cloudBusy = true;
  setCloudStatus(t('cloud.deleting'));
  try {
    await cloudFetch(CLOUD_API + '/' + id, { method: 'DELETE' });
    if (cloudLoadedId === id) cloudLoadedId = null;
    toast(t('cloud.deleted'));
    await cloudRefresh(true);
  } catch (e) {
    toast(t('cloud.delFail', { msg: String(e.message || e) }), 4000);
  } finally {
    cloudBusy = false;
    setCloudStatus('');
  }
}

function bindCloud() {
  const save = $('btnSaveCloud');
  if (!save) return;
  save.addEventListener('click', cloudSave);
  $('btnRefreshCloud').addEventListener('click', () => cloudRefresh());
  $('cloudList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.cloud-item').dataset.id;
    if (btn.dataset.act === 'load') cloudLoad(id);
    else if (btn.dataset.act === 'png') cloudDownloadPng(id);
    else if (btn.dataset.act === 'del') cloudDelete(id);
  });
}
