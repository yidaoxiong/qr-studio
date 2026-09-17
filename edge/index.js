/* =========================================================================
 * QR Logo Studio · 边缘入口 Worker
 *
 * 作用：让 qrcode.slashbro.top 这个域名能落到 Cloudflare Pages 上的站点。
 *
 * 为什么要这一层：
 *   站点的正文（静态资源 + /api/qr*）全部跑在 Pages 项目 `qr-studio` 上，
 *   推送 main 分支就自动部署，那套流程保持不变。
 *   但本账号的 wrangler OAuth 令牌没有 dns_records 权限，Pages 的
 *   「自定义域名」只能建到 pending（CNAME 记录不会自动创建）。
 *   Workers 自定义域名这条路是令牌允许的：它由 Cloudflare 自动创建 DNS
 *   记录与证书（账号里的 time / dinosaur-run / helicopter / slashpack
 *   四个域名都是这么来的）。
 *
 *   所以：Pages 负责内容与自动部署，这个 Worker 只负责把域名接进来。
 *
 * 想换成零层级的直连（可选）：
 *   在 Cloudflare 面板给 slashbro.top 加一条
 *     CNAME  qrcode → qr-studio-5rx.pages.dev  （已代理）
 *   然后删掉这个 Worker 的域名绑定，并在 Pages 项目的 Custom domains 里
 *   重新添加 qrcode.slashbro.top 即可。本文件即可删除。
 * ========================================================================= */

const ORIGIN = 'https://qr-studio-5rx.pages.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = new URL(ORIGIN).hostname;
    url.port = '';

    const headers = new Headers(request.headers);
    headers.delete('host');

    const init = { method: request.method, headers, redirect: 'manual' };
    // GET / HEAD 不能带 body
    if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

    return fetch(new Request(url.toString(), init));
  },
};
