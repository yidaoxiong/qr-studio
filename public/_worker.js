/* =========================================================================
 * QR Logo Studio · Cloudflare Pages Worker
 * /api/qr* 云端保存接口 —— 存储走 KV（PNG 体积会超过 D1 的 100KB 语句上限）
 * 上限：20 个文件
 * ========================================================================= */

const MAX_ITEMS = 20;
const MAX_BODY = 8 * 1024 * 1024; // 8MB，防误传超大文件

const J = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
const bad = (msg, status) => J({ error: msg }, status || 400);

const ID_RE = /^[a-z0-9]{6,32}$/;
function newId() {
  const t = Date.now().toString(36);
  const r = [...crypto.getRandomValues(new Uint8Array(3))]
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 5);
  return t + r;
}

function cleanName(v) {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s.slice(0, 60);
}

/** 列出全部条目（元数据来自 KV list 的 metadata，缩略图另取） */
async function listItems(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.QR_KV.list({ prefix: 'qr:', cursor, limit: 100 });
    for (const k of page.keys) {
      const m = k.metadata || {};
      out.push({
        id: k.name.slice(3),
        name: m.name || '未命名',
        createdAt: m.createdAt || null,
        w: m.w || 0,
        h: m.h || 0,
        bytes: m.bytes || 0,
      });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return out;
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/api/qr';

  if (!path.startsWith('/api/qr')) return bad('not_found', 404);

  // ---- 列表 ----
  if (request.method === 'GET' && path === '/api/qr') {
    const items = await listItems(env);
    const withThumb = await Promise.all(
      items.map(async (it) => {
        let thumb = null;
        try {
          thumb = await env.QR_KV.get('th:' + it.id, 'text');
        } catch (e) {}
        return Object.assign({ thumb }, it);
      })
    );
    return J({ ok: true, limit: MAX_ITEMS, items: withThumb });
  }

  // ---- 新建 / 覆盖 ----
  if (request.method === 'POST' && path === '/api/qr') {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return bad('too_large', 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return bad('bad_json');
    }
    const recipe = body.recipe;
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return bad('bad_recipe');

    const name = cleanName(body.name) || '未命名二维码';
    const png = typeof body.png === 'string' ? body.png : '';
    const logo = typeof body.logo === 'string' ? body.logo : '';
    const thumb = typeof body.thumb === 'string' ? body.thumb : '';
    // 覆盖保存时可以不带 png（沿用旧文件），但带了就必须是合法 PNG
    if (png && !png.startsWith('data:image/png;base64,')) return bad('bad_png');
    const w = Math.max(0, Math.min(20000, parseInt(body.w, 10) || 0));
    const h = Math.max(0, Math.min(20000, parseInt(body.h, 10) || 0));

    const id = body.id && ID_RE.test(String(body.id)) ? String(body.id) : '';
    const now = new Date().toISOString();
    let prev = null;

    if (id) {
      prev = await env.QR_KV.get('qr:' + id, 'json');
      if (!prev) return bad('not_found', 404);
    } else {
      const items = await listItems(env);
      if (items.length >= MAX_ITEMS) return bad('limit_reached:' + MAX_ITEMS, 409);
    }

    const createdAt = (prev && prev.createdAt) || now;
    const storedPng = png || (prev && prev.png) || '';
    if (!storedPng) return bad('bad_png');

    const rec = { id: id || newId(), name, createdAt, updatedAt: now, recipe, logo, png: storedPng };

    await env.QR_KV.put('qr:' + rec.id, JSON.stringify(rec), {
      metadata: { name, createdAt, w, h, bytes: Math.round((storedPng.length * 3) / 4) },
    });
    if (thumb) await env.QR_KV.put('th:' + rec.id, thumb);

    return J({ ok: true, id: rec.id, name: rec.name, createdAt });
  }

  // ---- 读取单条 / 删除 ----
  const m = path.match(/^\/api\/qr\/([a-z0-9]{6,32})$/);
  if (m) {
    const id = m[1];
    if (request.method === 'GET') {
      const rec = await env.QR_KV.get('qr:' + id, 'json');
      if (!rec) return bad('not_found', 404);
      return J({ ok: true, item: rec });
    }
    if (request.method === 'DELETE') {
      const rec = await env.QR_KV.get('qr:' + id, 'json');
      if (!rec) return bad('not_found', 404);
      await env.QR_KV.delete('qr:' + id);
      await env.QR_KV.delete('th:' + id);
      return J({ ok: true });
    }
    return bad('method_not_allowed', 405);
  }

  return bad('not_found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (e) {
        return bad('server_error:' + (e && e.message ? e.message : e), 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
