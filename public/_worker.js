/* =========================================================================
 * QR Logo Studio · Cloudflare Pages Worker
 * /api/qr* 云端保存接口
 *
 *  为什么拆两个存储：
 *   - 索引/元数据 → D1。KV 的 list() 写入后要十几秒才可见，保存完刷新列表
 *     会「看不到刚存的东西」，体验不可接受。D1 强一致，立刻可见。
 *   - PNG 文件与 Logo 原图 → KV。体积可达几百 KB，超过 D1 的 SQL 语句上限；
 *     而且是按 id 直读（不是 list），KV 的传播延迟不影响体验。
 *
 *  上限：20 个文件
 * ========================================================================= */

const MAX_ITEMS = 20;
const MAX_BODY = 12 * 1024 * 1024; // 12MB，防误传超大文件

const J = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
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
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
}

async function countItems(db) {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM qr_files').first();
  return row ? row.n : 0;
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/api/qr';
  if (!path.startsWith('/api/qr')) return bad('not_found', 404);

  const db = env.qr_studio_db;
  const kv = env.QR_KV;

  /* ------------------------------------------------------------ 列表 */
  if (request.method === 'GET' && path === '/api/qr') {
    const { results } = await db
      .prepare('SELECT id, name, created_at, w, h, bytes, thumb FROM qr_files ORDER BY created_at DESC LIMIT 100')
      .all();
    const items = (results || []).map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      w: r.w,
      h: r.h,
      bytes: r.bytes,
      thumb: r.thumb || null,
    }));
    return J({ ok: true, limit: MAX_ITEMS, items });
  }

  /* --------------------------------------------------- 新建 / 覆盖 */
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
    // 覆盖保存时可以不带 png（沿用旧文件），带了就必须是合法 PNG
    if (png && !png.startsWith('data:image/png;base64,')) return bad('bad_png');
    const w = Math.max(0, Math.min(20000, parseInt(body.w, 10) || 0));
    const h = Math.max(0, Math.min(20000, parseInt(body.h, 10) || 0));

    const id = body.id && ID_RE.test(String(body.id)) ? String(body.id) : '';
    const now = new Date().toISOString();
    let prev = null;

    if (id) {
      prev = await db.prepare('SELECT * FROM qr_files WHERE id = ?').bind(id).first();
      if (!prev) return bad('not_found', 404);
    } else if ((await countItems(db)) >= MAX_ITEMS) {
      return bad('limit_reached:' + MAX_ITEMS, 409);
    }

    const recId = id || newId();
    const createdAt = (prev && prev.created_at) || now;
    const recipeJson = JSON.stringify(recipe);
    // recipe 存进 D1（小），避免整包塞进 SQL
    if (recipeJson.length > 60000) return bad('bad_recipe');

    if (prev) {
      await db
        .prepare(
          `UPDATE qr_files SET name=?, updated_at=?, w=?, h=?, bytes=?, recipe=?,
             has_logo=?, thumb=CASE WHEN ?='' THEN thumb ELSE ? END
           WHERE id=?`
        )
        .bind(name, now, w, h, parseInt(body.bytes, 10) || 0, recipeJson, logo ? 1 : (prev.has_logo || 0), thumb, thumb, recId)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO qr_files (id, name, created_at, updated_at, w, h, bytes, recipe, has_logo, thumb)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(recId, name, now, now, w, h, parseInt(body.bytes, 10) || 0, recipeJson, logo ? 1 : 0, thumb)
        .run();
    }

    // 大对象进 KV：直读，不受 list 传播延迟影响
    if (png) await kv.put('png:' + recId, png);
    if (logo) await kv.put('logo:' + recId, logo);

    return J({ ok: true, id: recId, name, createdAt });
  }

  /* -------------------------------------------------- 读取 / 删除 */
  const m = path.match(/^\/api\/qr\/([a-z0-9]{6,32})$/);
  if (m) {
    const id = m[1];

    if (request.method === 'GET') {
      const row = await db.prepare('SELECT * FROM qr_files WHERE id = ?').bind(id).first();
      if (!row) return bad('not_found', 404);
      const [png, logo] = await Promise.all([
        kv.get('png:' + id, 'text').catch(() => null),
        row.has_logo ? kv.get('logo:' + id, 'text').catch(() => null) : Promise.resolve(''),
      ]);
      let recipe = {};
      try {
        recipe = JSON.parse(row.recipe);
      } catch (e) {}
      return J({
        ok: true,
        item: {
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          recipe,
          logo: logo || '',
          png: png || '',
        },
      });
    }

    if (request.method === 'DELETE') {
      const row = await db.prepare('SELECT id FROM qr_files WHERE id = ?').bind(id).first();
      if (!row) return bad('not_found', 404);
      await db.prepare('DELETE FROM qr_files WHERE id = ?').bind(id).run();
      await Promise.all([
        kv.delete('png:' + id).catch(() => {}),
        kv.delete('logo:' + id).catch(() => {}),
      ]);
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
