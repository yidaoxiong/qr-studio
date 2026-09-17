/* =========================================================================
 * QR Logo Studio · 核心引擎
 *  - 二维码编码（已修正库默认的 Latin-1 截断问题，强制 UTF-8 字节模式）
 *  - 用「场景(Scene)」描述画面，再做 Canvas / SVG / PDF 三个后端渲染
 * ========================================================================= */

/* 关键修复：qrcode-generator 默认的 stringToBytes 只取低 8 位（Latin-1），
 * 会把德语 ü/ß、西语 ñ/á 编成非 UTF-8 字节，扫码乱码。
 * 库内已注册正确的 UTF-8 实现，这里切换过去。 */
if (typeof qrcode !== 'undefined' && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
}

/* ------------------------------------------------------------------ 字体表 */
/* cat 用于 PDF 标准字体映射；css 为跨平台回退栈，末尾带 CJK 兜底 */
const FONTS = [
  { id: 'helv', label: '无衬线 · Helvetica Neue', css: '"Helvetica Neue", Helvetica, Arial, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'sf', label: '无衬线 · 系统默认', css: '-apple-system, "SF Pro Text", "Segoe UI", Roboto, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'arial', label: '无衬线 · Arial', css: 'Arial, Helvetica, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'verdana', label: '无衬线 · Verdana', css: 'Verdana, Geneva, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'tahoma', label: '无衬线 · Tahoma', css: 'Tahoma, Verdana, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'trebuchet', label: '无衬线 · Trebuchet MS', css: '"Trebuchet MS", Tahoma, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'futura', label: '几何 · Futura', css: 'Futura, "Century Gothic", "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'gillsans', label: '人文 · Gill Sans', css: '"Gill Sans", "Gill Sans MT", Calibri, "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'segoe', label: '无衬线 · Segoe UI', css: '"Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", sans-serif', cat: 'sans' },
  { id: 'georgia', label: '衬线 · Georgia', css: 'Georgia, "Times New Roman", serif', cat: 'serif' },
  { id: 'times', label: '衬线 · Times New Roman', css: '"Times New Roman", Times, Georgia, serif', cat: 'serif' },
  { id: 'palatino', label: '衬线 · Palatino', css: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif', cat: 'serif' },
  { id: 'baskerville', label: '衬线 · Baskerville', css: 'Baskerville, "Libre Baskerville", Georgia, serif', cat: 'serif' },
  { id: 'didot', label: '高对比衬线 · Didot', css: 'Didot, "Bodoni 72", "Playfair Display", Georgia, serif', cat: 'serif' },
  { id: 'songti', label: '中文 · 宋体 / Songti', css: '"Songti SC", SimSun, "Times New Roman", serif', cat: 'serif' },
  { id: 'menlo', label: '等宽 · Menlo', css: 'Menlo, Monaco, "Courier New", monospace', cat: 'mono' },
  { id: 'courier', label: '等宽 · Courier New', css: '"Courier New", Courier, monospace', cat: 'mono' },
  { id: 'impact', label: '标题 · Impact', css: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif', cat: 'sans' },
  { id: 'arialblack', label: '标题 · Arial Black', css: '"Arial Black", "Arial Bold", Gadget, sans-serif', cat: 'sans' },
  { id: 'rounded', label: '圆体 · Arial Rounded', css: '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "Yuanti SC", sans-serif', cat: 'sans' },
  { id: 'copperplate', label: '装饰 · Copperplate', css: 'Copperplate, "Copperplate Gothic Light", "Times New Roman", serif', cat: 'serif' },
  { id: 'chalkboard', label: '手写 · Chalkboard SE', css: '"Chalkboard SE", "Comic Sans MS", "Segoe Print", sans-serif', cat: 'sans' },
  { id: 'marker', label: '手写 · Marker Felt', css: '"Marker Felt", "Comic Sans MS", cursive', cat: 'sans' },
  { id: 'snell', label: '花体 · Snell Roundhand', css: '"Snell Roundhand", "Apple Chancery", "Segoe Script", cursive', cat: 'serif' },
  { id: 'pingfang', label: '中文 · 苹方 / PingFang', css: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', cat: 'sans' },
  { id: 'kaiti', label: '中文 · 楷体 / Kaiti', css: '"Kaiti SC", KaiTi, STKaiti, serif', cat: 'serif' },
  { id: 'yuanti', label: '中文 · 圆体 / Yuanti', css: '"Yuanti SC", "Hiragino Maru Gothic ProN", "PingFang SC", sans-serif', cat: 'sans' },
];
const fontById = id => FONTS.find(f => f.id === id) || FONTS[0];

/* --------------------------------------------------- WinAnsi（PDF 标准字体） */
const WINANSI_EXT = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};
function winAnsiByte(codePoint) {
  if (codePoint >= 0x20 && codePoint <= 0x7E) return codePoint;
  if (codePoint >= 0xA0 && codePoint <= 0xFF) return codePoint;
  const ext = WINANSI_EXT[codePoint];
  return ext === undefined ? null : ext;
}
function winAnsiBytes(str) {
  const out = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const b = winAnsiByte(cp);
    if (b === null) return null;
    out.push(b);
  }
  return out;
}

/* --------------------------------------------------------------- 状态定义 */
const DEFAULTS = {
  content: 'https://wealth.slashbro.top/',
  ecc: 'H',
  version: 0,
  quiet: 4,
  dotStyle: 'square',
  fgColor: '#000000',
  bgColor: '#ffffff',
  cardColor: '#ffffff',
  cardRadius: 24,
  cardPad: 28,
  qrSize: 320,
  exportScale: 2,
  transparentBg: false,

  logoW: 22,
  logoH: 22,
  logoPad: 10,
  logoShape: 'round',
  logoPlate: true,

  title: '扫码查看儿童记账',
  subtitle: 'Scannen · Escanear · Scannen · スキャン',
  fontId: 'helv',
  titleSize: 22,
  subSize: 14,
  weight: '600',
  align: 'center',
  letterSpacing: 0,
  lineHeight: 1.35,
  textColor: '#0f172a',
};
const state = Object.assign({}, DEFAULTS);
state.logoImg = null;      // HTMLImageElement
state.logoSrc = null;      // dataURL / 原始 URL

/* --------------------------------------------------------------- 二维码编码 */
function makeQR(text, ecc, versionFloor) {
  // versionFloor > 0 时强制该版本；溢出则递增重试
  let v = versionFloor || 0;
  for (let i = 0; i < 45; i++) {
    try {
      const qr = qrcode(v, ecc);
      qr.addData(text);
      qr.make();
      return qr;
    } catch (e) {
      v = (v || 1) + 1;
      if (v > 40) return null;
    }
  }
  return null;
}
/** 让 logo 框（含底板）避开三个定位图案 + 分隔符所需的 8 模块环带 */
function requiredVersionForBox(wPct, hPct) {
  const s = Math.max(wPct, hPct) / 100;
  if (!(s > 0)) return 0;
  if (s >= 0.95) return 40;
  const need = Math.ceil(16 / (1 - s));           // n >= 16/(1-s)
  return Math.max(1, Math.min(40, Math.ceil((need - 17) / 4)));
}

/* --------------------------------------------------------------- 文字排版 */
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');
function fontString(size, familyCss, weight) { return weight + ' ' + size + 'px ' + familyCss; }
function setMeasureFont(size, familyCss, weight, ls) {
  measureCtx.font = fontString(size, familyCss, weight);
  try { measureCtx.letterSpacing = (ls || 0) + 'px'; } catch (e) { /* 老浏览器忽略字距 */ }
}
function textWidth(str, size, familyCss, weight, ls) {
  setMeasureFont(size, familyCss, weight, ls);
  return measureCtx.measureText(str).width;
}
/** 支持 CJK 的贪心换行：优先在空格断，超长的无空格串按字符断 */
function wrapText(str, maxW, size, familyCss, weight, ls) {
  if (!str) return [];
  const out = [];
  for (const para of String(str).split('\n')) {
    const tokens = para.split(/(\s+)/).filter(t => t !== '');
    let cur = '';
    const flush = () => { if (cur.trim() !== '') out.push(cur.replace(/\s+$/, '')); cur = ''; };
    for (let token of tokens) {
      if (textWidth(cur + token, size, familyCss, weight, ls) <= maxW) { cur += token; continue; }
      flush();
      if (textWidth(token, size, familyCss, weight, ls) <= maxW) { cur = token.replace(/^\s+/, ''); continue; }
      // 单词本身过长（CJK 常见）→ 逐字符断行
      let piece = '';
      for (const ch of token) {
        if (textWidth(piece + ch, size, familyCss, weight, ls) > maxW && piece !== '') { out.push(piece); piece = ''; }
        piece += ch;
      }
      cur = piece;
    }
    flush();
  }
  return out;
}

/** Logo 几何的唯一真源。
 *  所有数值都是「矩阵边长 matSize 的比例」，调用方再乘 matSize 换算成像素。
 *  这样「预估遮挡面积（选版本）」和「实际绘制」永远用同一套算法，不会各算一套。
 *
 *  形状语义（四种都明显不同）：
 *    none   原始——contain 完整显示，底板直角、贴着图片
 *    round  圆角矩形——contain，底板圆角、贴着图片
 *    square 正方形——正方形容器 + contain（图片在方块内居中留白），底板为正方形
 *    circle 圆形——正方形容器 + cover 居中裁切（头像式），底板为圆形
 */
function logoLayout(st) {
  const isCircle = st.logoShape === 'circle';
  const isSquare = st.logoShape === 'square';
  const squareBox = isCircle || isSquare;          // 圆形与正方形都用正方形底板
  const bw = st.logoW / 100, bh = st.logoH / 100;
  const side = Math.min(bw, bh);
  const cw = squareBox ? side : bw;                // 容器尺寸
  const ch = squareBox ? side : bh;

  const iw = (state.logoImg && (state.logoImg.naturalWidth || state.logoImg.width)) || 1;
  const ih = (state.logoImg && (state.logoImg.naturalHeight || state.logoImg.height)) || 1;
  const a = iw / ih;

  let dw = cw, dh = ch;
  if (isCircle) {                                  // cover：填满容器，居中裁切
    const s = Math.max(cw, ch * a);
    dw = s; dh = s / a;
  } else if (cw / ch > a) {                        // contain
    dh = ch; dw = ch * a;
  } else {
    dw = cw; dh = cw / a;
  }

  const cx = (1 - cw) / 2, cy = (1 - ch) / 2;              // 容器左上角（相对矩阵）
  const dx = cx + (cw - dw) / 2, dy = cy + (ch - dh) / 2;  // 实际图片矩形

  // 可见区（底板依据）：正方形/圆形取容器，其余取实际图片矩形
  const vx = squareBox ? cx : dx, vy = squareBox ? cy : dy;
  const vw = squareBox ? cw : dw, vh = squareBox ? ch : dh;

  const usePlate = !!st.logoPlate;
  const pad = usePlate ? Math.min(vw, vh) * (st.logoPad / 100) : 0;
  const pw = vw + pad * 2, ph = vh + pad * 2;

  let plateRad;
  if (!usePlate) plateRad = 0;
  else if (isCircle) plateRad = Math.min(pw, ph) / 2;                 // 圆
  else if (st.logoShape === 'round') plateRad = Math.min(vw, vh) * 0.22 + pad;
  else if (isSquare) plateRad = Math.min(vw, vh) * 0.08 + pad;
  else plateRad = 0;                                                  // 原始 → 直角

  return { isCircle, isSquare, cw, ch, dw, dh, cx, cy, dx, dy, vx, vy, vw, vh, pad, pw, ph, plateRad, usePlate };
}

/** Logo（含底板）实际遮挡的矩形，按矩阵边长的百分比返回 */
function logoDamagePct(st) {
  if (!state.logoImg) return null;
  if (!(st.logoW > 0 && st.logoH > 0)) return null;
  const L = logoLayout(st);
  return { wPct: L.pw * 100, hPct: L.ph * 100 };
}

/** 校正图案（alignment pattern）中心坐标，按 QR 规范公式生成 */
function alignmentPositions(version) {
  if (version < 2) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = (version === 32) ? 26 : Math.ceil((size - 13) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}
/** 功能图案（定位/分隔符/时序/校正/版本信息）必须保持实心，
 *  把它们也做成圆点会破坏 1:1:3:1:1 定位比例，实测三个解码器全部读取失败 */
function isFunctionModule(r, c, n, version) {
  if (r < 8 && c < 8) return true;                    // 左上定位 + 分隔符
  if (r < 8 && c >= n - 8) return true;               // 右上
  if (r >= n - 8 && c < 8) return true;               // 左下
  if (r === 6 || c === 6) return true;                // 时序图案
  if (version >= 7) {                                 // 版本信息
    if (r < 6 && c >= n - 11 && c <= n - 9) return true;
    if (c < 6 && r >= n - 11 && r <= n - 9) return true;
  }
  const pos = alignmentPositions(version);
  for (const ar of pos) {
    for (const ac of pos) {
      const nearFinder = (ar <= 8 && ac <= 8) || (ar <= 8 && ac >= n - 9) || (ar >= n - 9 && ac <= 8);
      if (nearFinder) continue;
      if (r >= ar - 2 && r <= ar + 2 && c >= ac - 2 && c <= ac + 2) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ 场景构建 */
/** 返回 {ok, scene, qr, meta} —— scene 与渲染后端无关 */
function buildScene(st, opts) {
  opts = opts || {};
  const includeCaption = opts.includeCaption !== false;
  const f = fontById(st.fontId);

  // 先按 logo 实际遮挡尺寸推算必须的最小版本，再编码
  const dmgPct = logoDamagePct(st);
  const boxNeed = dmgPct ? requiredVersionForBox(dmgPct.wPct, dmgPct.hPct) : 0;
  const vFloor = st.version > 0 ? st.version : boxNeed;
  const qr = makeQR(st.content || ' ', st.ecc, vFloor);
  if (!qr) return { ok: false, error: '内容过长，超出二维码容量上限（可缩短文本或降低容错级别）' };

  const n = qr.getModuleCount();
  const version = (n - 17) / 4;
  const Q = st.qrSize;
  const P = st.cardPad;
  const total = n + st.quiet * 2;
  const ms = Q / total;                 // 单模块边长
  const matSize = n * ms;               // 矩阵区（不含静区）
  const matOff = st.quiet * ms;
  // ★ 二维码整块必须落在卡片的 (P,P) 位置。之前漏了这个偏移，
  //   导致二维码贴着卡片左上角画，视觉上明显不居中。
  const matX = P + matOff, matY = P + matOff;   // 矩阵左上角在卡片中的坐标

  // Logo 几何（logoLayout 是唯一真源，数值为矩阵边长的比例）
  const L = logoLayout(st);
  const hasLogo = !!state.logoImg;
  const px = v => v * matSize;
  const drawRect = hasLogo ? { x: matX + px(L.dx), y: matY + px(L.dy), w: px(L.dw), h: px(L.dh) } : null;
  const plate = (hasLogo && L.usePlate) ? {
    x: matX + px(L.vx - L.pad), y: matY + px(L.vy - L.pad),
    w: px(L.pw), h: px(L.ph), r: px(L.plateRad),
  } : null;
  const damage = plate || drawRect;
  const clipRad = Math.min(px(L.dw), px(L.dh)) * 0.22;

  // 字体排版
  const cardW = Q + P * 2;
  const innerW = Q;
  const capGap = Math.round(P * 0.75);
  const subWeight = String(Math.min(500, +st.weight));
  const lines = [];
  if (includeCaption) {
    wrapText(st.title, innerW, st.titleSize, f.css, st.weight, st.letterSpacing)
      .forEach(t => lines.push({ text: t, size: st.titleSize, ls: st.letterSpacing, weight: st.weight }));
    const subGap = st.subtitle && st.title ? st.subSize * 0.55 : 0;
    wrapText(st.subtitle, innerW, st.subSize, f.css, subWeight, st.letterSpacing * 0.6)
      .forEach((t, i) => lines.push({ text: t, size: st.subSize, ls: st.letterSpacing * 0.6, weight: subWeight, gapBefore: i === 0 ? subGap : 0 }));
  }

  let capH = 0;
  lines.forEach(l => { capH += l.size * st.lineHeight; });
  capH += lines.reduce((a, l) => a + (l.gapBefore || 0), 0);

  const cardH = Q + P * 2 + (lines.length ? capGap + capH : 0);
  const scene = { w: cardW, h: cardH, items: [], card: { w: cardW, h: cardH, r: st.cardRadius }, bgColor: st.cardColor };
  const items = scene.items;

  // 1) 码点：功能图案永远实心；装饰样式只作用在数据模块上
  //    方块样式按行程合并成矩形，体积更小
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      const cat = isFunctionModule(r, c, n, version) ? 1 : 0;
      const s = c;
      while (c < n && qr.isDark(r, c) && (isFunctionModule(r, c, n, version) ? 1 : 0) === cat) c++;
      if (st.dotStyle === 'square' || cat === 1) {
        items.push({ k: 'mod', x: matX + s * ms, y: matY + r * ms, w: (c - s) * ms, h: ms, r: 0, fill: st.fgColor });
      } else {
        const rad = st.dotStyle === 'dots' ? ms / 2 : ms * 0.3;
        for (let i = s; i < c; i++) {
          items.push({ k: 'mod', x: matX + i * ms, y: matY + r * ms, w: ms, h: ms, r: rad, fill: st.fgColor });
        }
      }
    }
  }

  // 2) Logo 底板 + Logo（底板圆角跟随所选形状：圆形→圆/胶囊、圆角→圆角矩形、原始/直角→直角）
  if (hasLogo && drawRect) {
    if (plate) items.push({ k: 'rect', x: plate.x, y: plate.y, w: plate.w, h: plate.h, r: plate.r, fill: st.bgColor });
    items.push({
      k: 'img', x: drawRect.x, y: drawRect.y, w: drawRect.w, h: drawRect.h,
      src: state.logoSrc, shape: st.logoShape, rad: clipRad,
    });
  }

  // 3) 文字
  let cursor = Q + P + capGap;
  for (const l of lines) {
    cursor += l.gapBefore || 0;
    const w = l.weight;
    const baseline = cursor + l.size * 0.78;
    const lw = textWidth(l.text, l.size, f.css, w, l.ls);
    const x = st.align === 'center' ? cardW / 2 : (st.align === 'left' ? P : cardW - P);
    items.push({
      k: 'text', x, y: baseline, s: l.text, w: lw,
      size: l.size, family: f.css, cat: f.cat, weight: w, ls: l.ls,
      fill: st.textColor,
      anchor: st.align === 'center' ? 'middle' : (st.align === 'left' ? 'start' : 'end'),
      boxY: cursor, boxH: l.size * st.lineHeight,
    });
    cursor += l.size * st.lineHeight;
  }

  // 体检数据
  let coverPct = 0, clearanceOk = true, needV = 0;
  if (damage) {
    coverPct = (damage.w * damage.h) / (matSize * matSize) * 100;
    needV = requiredVersionForBox(damage.w / matSize * 100, damage.h / matSize * 100);
    const bwMod = damage.w / ms, bhMod = damage.h / ms;
    const c0 = (n - bwMod) / 2, r0 = (n - bhMod) / 2;
    clearanceOk = c0 >= 8 - 0.001 && r0 >= 8 - 0.001;
  }
  const meta = {
    version, n, ms, matSize, total, quiet: st.quiet,
    coverPct, clearanceOk, needV, hasLogo: !!state.logoImg,
    exportMs: ms * st.exportScale,
    exportW: Math.round(scene.w * st.exportScale),
    exportH: Math.round(scene.h * st.exportScale),
    fgColor: st.fgColor, bgColor: st.bgColor,
  };
  return { ok: true, scene, qr, meta };
}

/* ------------------------------------------------------------- Canvas 后端 */
function drawScene(ctx, scene, scale, st) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (!st.transparentBg) {
    ctx.fillStyle = st.cardColor;
    roundRectPath(ctx, 0, 0, scene.w, scene.h, scene.card.r);
    ctx.fill();
  } else if (scene.card.r > 0) {
    // 透明背景仍保留卡片圆角裁切
    roundRectPath(ctx, 0, 0, scene.w, scene.h, scene.card.r);
    ctx.clip();
  }
  if (!st.transparentBg && st.bgColor !== st.cardColor) {
    // 码区底色（静区在内）
    ctx.fillStyle = st.bgColor;
    ctx.fillRect(st.cardPad, st.cardPad, st.qrSize, st.qrSize);
  }

  for (const it of scene.items) {
    if (it.k === 'mod') {
      ctx.fillStyle = it.fill;
      if (it.r > 0) { roundRectPath(ctx, it.x, it.y, it.w, it.h, it.r); ctx.fill(); }
      else {
        // 设备像素对齐，避免行列之间出现接缝
        const x0 = Math.round(it.x * scale), y0 = Math.round(it.y * scale);
        const x1 = Math.round((it.x + it.w) * scale), y1 = Math.round((it.y + it.h) * scale);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
      }
    } else if (it.k === 'rect') {
      ctx.fillStyle = it.fill;
      roundRectPath(ctx, it.x, it.y, it.w, it.h, it.r);
      ctx.fill();
    } else if (it.k === 'img') {
      if (!state.logoImg) continue;
      ctx.save();
      if (it.shape === 'circle') { ctx.beginPath(); ctx.arc(it.x + it.w / 2, it.y + it.h / 2, Math.min(it.w, it.h) / 2, 0, Math.PI * 2); ctx.clip(); }
      else if (it.shape === 'round' || it.shape === 'square') { roundRectPath(ctx, it.x, it.y, it.w, it.h, it.shape === 'square' ? it.rad : it.rad); ctx.clip(); }
      ctx.drawImage(state.logoImg, it.x, it.y, it.w, it.h);
      ctx.restore();
    } else if (it.k === 'text') {
      ctx.font = fontString(it.size, it.family, it.weight);
      try { ctx.letterSpacing = it.ls + 'px'; } catch (e) {}
      ctx.fillStyle = it.fill;
      ctx.textAlign = it.anchor === 'middle' ? 'center' : (it.anchor === 'start' ? 'left' : 'right');
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(it.s, it.x, it.y);
    }
  }
  ctx.restore();
}
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  if (r === 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function renderToCanvas(scene, st, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(scene.w * scale));
  cv.height = Math.max(1, Math.round(scene.h * scale));
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  drawScene(ctx, scene, scale, st);
  return cv;
}

/* ---------------------------------------------------------------- SVG 后端 */
function roundRectSVG(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return `M${f2(x + r)} ${f2(y)}H${f2(x + w - r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w)} ${f2(y + r)}V${f2(y + h - r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w - r)} ${f2(y + h)}H${f2(x + r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x)} ${f2(y + h - r)}V${f2(y + r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + r)} ${f2(y)}Z`;
}
const f2 = v => (Math.round(v * 100) / 100);
const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function toSVG(scene, st) {
  const defs = [], body = [];
  let clipId = 0;
  if (!st.transparentBg) {
    body.push(`<path d="${roundRectSVG(0, 0, scene.w, scene.h, scene.card.r)}" fill="${st.cardColor}"/>`);
  }
  if (!st.transparentBg && st.bgColor !== st.cardColor) {
    body.push(`<rect x="${st.cardPad}" y="${st.cardPad}" width="${st.qrSize}" height="${st.qrSize}" fill="${st.bgColor}"/>`);
  }
  let pendingRuns = null;   // 合并连续方块，减小体积
  const flushRuns = () => {
    if (pendingRuns && pendingRuns.length) {
      body.push(`<path d="${pendingRuns.map(p => `M${f2(p[0])} ${f2(p[1])}h${f2(p[2])}v${f2(p[3])}h${f2(-p[2])}z`).join('')}" fill="${st.fgColor}"/>`);
    }
    pendingRuns = null;
  };
  for (const it of scene.items) {
    if (it.k === 'mod') {
      if (it.r === 0) { (pendingRuns = pendingRuns || []).push([it.x, it.y, it.w, it.h]); continue; }
      flushRuns();
      body.push(`<rect x="${f2(it.x)}" y="${f2(it.y)}" width="${f2(it.w)}" height="${f2(it.h)}" rx="${f2(Math.min(it.r, it.w / 2))}" fill="${it.fill}"/>`);
    } else if (it.k === 'rect') {
      flushRuns();
      body.push(`<path d="${roundRectSVG(it.x, it.y, it.w, it.h, it.r)}" fill="${it.fill}"/>`);
    } else if (it.k === 'img') {
      flushRuns();
      const id = 'clip' + (++clipId);
      if (it.shape === 'circle') {
        defs.push(`<clipPath id="${id}"><circle cx="${f2(it.x + it.w / 2)}" cy="${f2(it.y + it.h / 2)}" r="${f2(Math.min(it.w, it.h) / 2)}"/></clipPath>`);
      } else if (it.shape === 'round' || it.shape === 'square') {
        defs.push(`<clipPath id="${id}"><path d="${roundRectSVG(it.x, it.y, it.w, it.h, it.rad)}"/></clipPath>`);
      }
      const clip = (it.shape === 'none') ? '' : ` clip-path="url(#${id})"`;
      body.push(`<image x="${f2(it.x)}" y="${f2(it.y)}" width="${f2(it.w)}" height="${f2(it.h)}" preserveAspectRatio="xMidYMid meet" href="${escXml(it.src)}" xlink:href="${escXml(it.src)}"${clip}/>`);
    } else if (it.k === 'text') {
      flushRuns();
      const lsAttr = it.ls ? ` letter-spacing="${f2(it.ls)}"` : '';
      body.push(`<text x="${f2(it.x)}" y="${f2(it.y)}" font-family="${escXml(it.family)}" font-size="${f2(it.size)}" font-weight="${it.weight}"${lsAttr} fill="${it.fill}" text-anchor="${it.anchor}">${escXml(it.s)}</text>`);
    }
  }
  flushRuns();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f2(scene.w)}" height="${f2(scene.h)}" viewBox="0 0 ${f2(scene.w)} ${f2(scene.h)}">
<title>QR Code</title>
${defs.length ? '<defs>\n' + defs.join('\n') + '\n</defs>' : ''}
${body.join('\n')}
</svg>`;
}

/* ---------------------------------------------------------------- PDF 后端 */
/* 手写 PDF：码点真矢量；卡片圆角用贝塞尔；Logo/非 WinAnsi 文字按需嵌入位图 */
function toPDF(scene, st) {
  const pageH = scene.h;
  const ops = [];
  const images = [];
  let fontUsed = null;         // 1: Helvetica, 2: Times, 3: Courier
  const fontTag = cat => (cat === 'serif' ? 2 : (cat === 'mono' ? 3 : 1));
  const baseFonts = { 1: 'Helvetica', 2: 'Times-Roman', 3: 'Courier' };

  const pdfPath = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    const Y = pageH - y, yb = Y - h, yt = Y, xl = x, xr = x + w;
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    if (r === 0) return `${f2(xl)} ${f2(yb)} ${f2(w)} ${f2(h)} re`;
    const k = r * 0.5523;
    return [
      `${f2(xl + r)} ${f2(yb)} m`,
      `${f2(xr - r)} ${f2(yb)} l`,
      `${f2(xr - r + k)} ${f2(yb)} ${f2(xr)} ${f2(yb + r - k)} ${f2(xr)} ${f2(yb + r)} c`,
      `${f2(xr)} ${f2(yt - r)} l`,
      `${f2(xr)} ${f2(yt - r + k)} ${f2(xr - r + k)} ${f2(yt)} ${f2(xr - r)} ${f2(yt)} c`,
      `${f2(xl + r)} ${f2(yt)} l`,
      `${f2(xl + r - k)} ${f2(yt)} ${f2(xl)} ${f2(yt - r + k)} ${f2(xl)} ${f2(yt - r)} c`,
      `${f2(xl)} ${f2(yb + r)} l`,
      `${f2(xl)} ${f2(yb + r - k)} ${f2(xl + r - k)} ${f2(yb)} ${f2(xl + r)} ${f2(yb)} c`,
      'h',
    ].join(' ');
  };
  const hexToRgb = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#000000');
    const v = m ? parseInt(m[1], 16) : 0;
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  };
  const rgbOp = hex => hexToRgb(hex).map(v => f2(v)).join(' ');

  // 背景卡片
  if (!st.transparentBg) {
    ops.push('q', rgbOp(st.cardColor) + ' rg', pdfPath(0, 0, scene.w, scene.h, st.cardRadius) + ' f', 'Q');
  }
  if (!st.transparentBg && st.bgColor !== st.cardColor) {
    ops.push('q', rgbOp(st.bgColor) + ' rg', pdfPath(st.cardPad, st.cardPad, st.qrSize, st.qrSize, 0) + ' f', 'Q');
  }

  // 码点：方块样式按行程合并成一条路径
  const runs = [], others = [];
  for (const it of scene.items) {
    if (it.k === 'mod') (it.r === 0 ? runs : others).push(it);
    else if (it.k === 'rect') others.push(it);
  }
  if (runs.length) {
    const d = runs.map(it => pdfPath(it.x, it.y, it.w, it.h, 0)).join(' ');
    ops.push('q', rgbOp(st.fgColor) + ' rg', d, 'f', 'Q');
  }
  for (const it of others) {
    ops.push('q', rgbOp(it.fill) + ' rg', pdfPath(it.x, it.y, it.w, it.h, it.r || 0) + ' f', 'Q');
  }

  // Logo（含底板）→ 位图，避免 PDF 里做复杂裁剪
  if (state.logoImg) {
    const plate = scene.items.find(i => i.k === 'rect');
    const img = scene.items.find(i => i.k === 'img');
    if (img) {
      const x0 = plate ? plate.x : img.x, y0 = plate ? plate.y : img.y;
      const x1 = plate ? plate.x + plate.w : img.x + img.w, y1 = plate ? plate.y + plate.h : img.y + img.h;
      const bw = x1 - x0, bh = y1 - y0;
      const targetLong = Math.min(2400, Math.max(600, Math.round(Math.max(bw, bh) * 6)));
      const s = targetLong / Math.max(bw, bh);
      const cw = Math.max(1, Math.round(bw * s)), ch = Math.max(1, Math.round(bh * s));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const cx = cv.getContext('2d');
      cx.fillStyle = st.cardColor;
      cx.fillRect(0, 0, cw, ch);
      cx.setTransform(s, 0, 0, s, 0, 0);
      cx.translate(-x0, -y0);
      if (plate) {
        cx.fillStyle = plate.fill;
        roundRectPath(cx, plate.x, plate.y, plate.w, plate.h, plate.r);
        cx.fill();
      }
      cx.save();
      if (img.shape === 'circle') { cx.beginPath(); cx.arc(img.x + img.w / 2, img.y + img.h / 2, Math.min(img.w, img.h) / 2, 0, Math.PI * 2); cx.clip(); }
      else if (img.shape === 'round' || img.shape === 'square') { roundRectPath(cx, img.x, img.y, img.w, img.h, img.rad); cx.clip(); }
      cx.drawImage(state.logoImg, img.x, img.y, img.w, img.h);
      cx.restore();
      images.push({ name: 'Im' + (images.length + 1), w: cw, h: ch, data: dataUrlToBytes(cv.toDataURL('image/jpeg', 0.94)) });
      const nm = images[images.length - 1].name;
      ops.push('q', `${f2(bw)} 0 0 ${f2(bh)} ${f2(x0)} ${f2(pageH - y0 - bh)} cm`, '/' + nm + ' Do', 'Q');
    }
  }

  // 文字：WinAnsi 可用 → 矢量标准字体；不可用 → 高清位图嵌入
  for (const it of scene.items) {
    if (it.k !== 'text') continue;
    const cat = it.cat;
    const bytes = winAnsiBytes(it.s);
    if (bytes) {
      const tag = fontTag(cat);
      if (fontUsed === null) fontUsed = tag;
      const bf = baseFonts[tag];
      const avg = tag === 3 ? 0.6 : (tag === 2 ? 0.47 : 0.52);
      const estW = avg * it.size * it.s.length + Math.max(0, it.s.length - 1) * it.ls;
      const tz = estW > it.w * 1.04 ? Math.max(60, Math.min(100, 100 * it.w / estW)) : 100;
      // 标准字体没有 text-anchor：按对齐方式换算出左起点，并补偿横向缩放带来的偏移
      const left = it.anchor === 'middle' ? it.x - it.w / 2 : (it.anchor === 'end' ? it.x - it.w : it.x);
      const slack = it.w - it.w * tz / 100;
      const x = left + (it.anchor === 'middle' ? slack / 2 : (it.anchor === 'end' ? slack : 0));
      const str = bytes.map(b => (b === 0x28 || b === 0x29 || b === 0x5C)
        ? '\\' + String.fromCharCode(b)
        : (b < 32 || b > 126 ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b))).join('');
      ops.push('BT', '/' + bf + ' ' + f2(it.size) + ' Tf', rgbOp(it.fill) + ' rg');
      if (it.ls) ops.push(f2(it.ls) + ' Tc');
      if (tz !== 100) ops.push(f2(tz) + ' Tz');
      ops.push('1 0 0 1 ' + f2(x) + ' ' + f2(pageH - it.y) + ' Tm', '(' + str + ') Tj', 'ET');
    } else {
      // 非 WinAnsi（中文/西里尔等）→ 位图文字
      const pad = 2;
      const bx = (it.anchor === 'middle' ? it.x - it.w / 2 : (it.anchor === 'end' ? it.x - it.w : it.x)) - pad;
      const by = it.boxY - pad;
      const bw = it.w + pad * 2, bh = it.boxH + pad * 2;
      const s = Math.min(6, Math.max(2, 900 / Math.max(1, it.size)));
      const cw = Math.max(1, Math.round(bw * s)), ch = Math.max(1, Math.round(bh * s));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const cx = cv.getContext('2d');
      cx.fillStyle = st.transparentBg ? '#ffffff' : st.cardColor;
      cx.fillRect(0, 0, cw, ch);
      cx.setTransform(s, 0, 0, s, 0, 0);
      cx.font = fontString(it.size, it.family, it.weight);
      try { cx.letterSpacing = it.ls + 'px'; } catch (e) {}
      cx.fillStyle = it.fill;
      cx.textAlign = it.anchor === 'middle' ? 'center' : (it.anchor === 'start' ? 'left' : 'right');
      cx.textBaseline = 'alphabetic';
      cx.fillText(it.s, it.x - bx, it.y - by);
      images.push({ name: 'Im' + (images.length + 1), w: cw, h: ch, data: dataUrlToBytes(cv.toDataURL('image/jpeg', 0.95)) });
      const nm = images[images.length - 1].name;
      ops.push('q', `${f2(bw)} 0 0 ${f2(bh)} ${f2(bx)} ${f2(pageH - by - bh)} cm`, '/' + nm + ' Do', 'Q');
    }
  }

  return assemblePDF(ops, images, scene, fontUsed);
}
function dataUrlToBytes(url) {
  const b64 = url.split(',')[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function assemblePDF(ops, images, scene, fontUsed) {
  const enc = new TextEncoder();
  const chunks = [];
  let len = 0;
  const push = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; chunks.push(b); len += b.length; };

  // 动态分配对象编号：字体对象可能不存在，不能写死在 xref 里
  let n = 1;
  const N_CATALOG = n++, N_PAGES = n++, N_PAGE = n++, N_CONTENT = n++;
  const N_FONT = fontUsed ? n++ : null;
  const imgNums = images.map(() => n++);
  const objCount = n;                       // xref 条目 0..n-1
  const objStart = {};
  const beginObj = (num) => { objStart[num] = len; push(num + ' 0 obj\n'); };

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

  beginObj(N_CATALOG);
  push(`<< /Type /Catalog /Pages ${N_PAGES} 0 R >>\nendobj\n`);
  beginObj(N_PAGES);
  push(`<< /Type /Pages /Kids [${N_PAGE} 0 R] /Count 1 >>\nendobj\n`);

  const resFont = N_FONT ? `/Font << /F1 ${N_FONT} 0 R >> ` : '';
  const resImg = images.length ? `/XObject << ${images.map((im, i) => '/' + im.name + ' ' + imgNums[i] + ' 0 R').join(' ')} >> ` : '';
  beginObj(N_PAGE);
  push(`<< /Type /Page /Parent ${N_PAGES} 0 R /MediaBox [0 0 ${f2(scene.w)} ${f2(scene.h)}] /Resources << ${resFont}${resImg}>> /Contents ${N_CONTENT} 0 R >>\nendobj\n`);

  const cb = enc.encode(ops.join('\n'));
  beginObj(N_CONTENT);
  push('<< /Length ' + cb.length + ' >>\nstream\n');
  push(cb);
  push('\nendstream\nendobj\n');

  if (N_FONT) {
    const bf = { 1: 'Helvetica', 2: 'Times-Roman', 3: 'Courier' }[fontUsed];
    beginObj(N_FONT);
    push(`<< /Type /Font /Subtype /Type1 /BaseFont /${bf} /Encoding /WinAnsiEncoding >>\nendobj\n`);
  }
  images.forEach((im, i) => {
    beginObj(imgNums[i]);
    push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
    push(im.data);
    push('\nendstream\nendobj\n');
  });

  const xrefPos = len;
  let xref = 'xref\n0 ' + objCount + '\n0000000000 65535 f \n';
  for (let i = 1; i < objCount; i++) {
    xref += String(objStart[i] || 0).padStart(10, '0') + ' 00000 n \n';
  }
  push(xref);
  push('trailer\n<< /Size ' + objCount + ' /Root ' + N_CATALOG + ' 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n');

  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
