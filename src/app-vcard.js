/* =========================================================================
 * QR Logo Studio · 名片表单交互
 *
 * 关键约束（实测结论）：
 *  名片码远比网址码密（完整名片 v24 = 113×113 模块，网址 v3 = 29×29），
 *  在默认 320px 下只有 2.8px/模块 —— 低于本工具自己的 3px 警戒线。
 *  所以填入后必须按模块数把二维码尺寸顶到「每模块 ≥4px」。
 * ========================================================================= */

const VC_FIELDS = {
  lastName: 'vcLast', firstName: 'vcFirst', org: 'vcOrg', title: 'vcTitle',
  phone: 'vcPhone', email: 'vcEmail', url: 'vcUrl', wechat: 'vcWechat',
  address: 'vcAddr', city: 'vcCity', region: 'vcRegion', postal: 'vcPostal',
  country: 'vcCountry',
  instagram: 'vcInstagram', linkedin: 'vcLinkedin', x: 'vcX', note: 'vcNote',
};

function readVcForm() {
  const f = {};
  for (const k in VC_FIELDS) f[k] = ($(VC_FIELDS[k]).value || '').trim();
  return f;
}
function vcOpts() {
  return { version: $('vcVersion').value, socialMode: $('vcSocialMode').value };
}

/** 不改 state，纯算：字节数 / 版本 / 模块数 / 建议边长 */
function vcMeasure(data) {
  const q = makeQR(data, 'H', 0);
  if (!q) return { ok: false, bytes: byteLen(data) };
  const n = q.getModuleCount();
  const total = n + state.quiet * 2;          // 含静区
  return { ok: true, bytes: byteLen(data), n: n, total: total, size: Math.ceil(total * 4) };
}

function vcUpdateInfo() {
  const el = $('vcInfo');
  if (!el) return;
  if (!vcardFilled(readVcForm())) { el.textContent = ''; return; }
  const v = buildVCard(readVcForm(), vcOpts());
  const m = vcMeasure(v.data);
  if (!m.ok) { el.textContent = t('vc.tooBig', { n: v.bytes }); el.className = 'note bad-note'; return; }
  el.className = 'note';
  el.textContent = t('vc.applied', {
    n: v.bytes, v: ((m.n - 17) / 4), size: m.size,
  }) + ' · ' + t('vc.hintSize');
}

function applyVCard() {
  const f = readVcForm();
  if (vcardFilled(f) < 2) { toast(t('vc.empty'), 3200); return; }
  const v = buildVCard(f, vcOpts());
  const m = vcMeasure(v.data);
  if (!m.ok) { toast(t('vc.tooBig', { n: v.bytes }), 4200); return; }

  const before = state.qrSize;
  state.content = v.data;
  state.ecc = 'H';                       // 带 logo 的名片码必须 H 级
  // 每模块 ≥4px 才敢印/敢远扫；只有真的不够时才动用户的尺寸
  if (state.qrSize < m.size) state.qrSize = Math.max(160, Math.min(640, Math.ceil(m.size / 8) * 8));

  syncUI(); render();
  vcUpdateInfo();
  if (state.qrSize > before) {
    toast(t('vc.tooSmall', { from: before, to: state.qrSize }) + '｜' + t('vc.applied', { n: v.bytes, v: ((m.n - 17) / 4), size: m.size }), 4800);
  } else {
    toast(t('vc.applied', { n: v.bytes, v: ((m.n - 17) / 4), size: m.size }), 3200);
  }
}

function downloadVcf() {
  const f = readVcForm();
  if (vcardFilled(f) < 2) { toast(t('vc.empty'), 3200); return; }
  const v = buildVCard(f, vcOpts());
  const name = (f.lastName || f.firstName || 'contact')
    .replace(/[\\/:*?"<>|,\s]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'contact';
  download(new Blob([v.data], { type: 'text/vcard;charset=utf-8' }), name + '.vcf');
  toast(t('vc.dlOk', { name: name }), 2600);
}

function clearVCard() {
  for (const k in VC_FIELDS) $(VC_FIELDS[k]).value = '';
  $('vcInfo').textContent = '';
  syncUI(); render();
}

function bindVCard() {
  if (!$('btnVcApply')) return;
  $('btnVcApply').addEventListener('click', applyVCard);
  $('btnVcFile').addEventListener('click', downloadVcf);
  $('btnVcClear').addEventListener('click', clearVCard);
  // 任何字段变化都实时更新字节/尺寸预估
  for (const k in VC_FIELDS) {
    $(VC_FIELDS[k]).addEventListener('input', vcUpdateInfo);
  }
  $('vcVersion').addEventListener('change', vcUpdateInfo);
  $('vcSocialMode').addEventListener('change', vcUpdateInfo);
  // 静区变了，预估的尺寸也跟着变
  $('quiet').addEventListener('input', vcUpdateInfo);
}
