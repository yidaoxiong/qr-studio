# QR Logo Studio

带 **中心 Logo**（方形 / 长方形 / 圆形）与 **多语言文字说明** 的二维码生成器。
纯前端单文件，离线可用；云端保存走 Cloudflare Pages + KV。

线上：**https://qrcode.slashbro.top**（边缘入口见下文「域名入口」一节）
备用：**https://qr-studio-5rx.pages.dev**

## 能做什么

- **二维码**：文本 / 网址，容错 L·M·Q·H，版本可自动或指定，静区可调
- **Logo**：拖入 / 选择 / 粘贴 / URL 载入；宽高独立可调；5 种预设比例
  - 形状 4 选 1：原始（不裁剪）· 圆角矩形 · 正方形 · 圆形
  - 可选白色底板，内边距可调，避免破坏可扫性
- **文字说明**：主标题 + 副标题，26 种字体（覆盖英 / 德 / 西 / 法 / 葡 / 北欧 / 中日韩）
  字号、字重、对齐、字距、行距、颜色全可调
- **样式**：码点/背景/卡片三色，模块形状（方块 / 圆角 / 圆点），卡片圆角与内边距
- **导出**：PNG · SVG（全矢量）· PDF（码点矢量 + WinAnsi 标准字体嵌入）· 复制到剪贴板
- **可扫性体检**：内置解码器实测，逐项给出问题与修复建议，一键「自动优化到可扫描」
- **云端保存**：把 PNG 文件连同全部参数存到云端，最多 **20** 个，随时载入继续编辑或取回原文件

## 目录结构

```
build.js              合并 src/ + lib/ → public/index.html
src/
  index.html          页面骨架（含 /*__CSS__*/ 等占位符）
  app.css             样式
  app-core.js         二维码编码 + 场景构建 + Canvas/SVG/PDF 三个渲染后端
  app-ui.js           交互与体检
  app-cloud.js        云端保存（Pages KV 接口）
  app-boot.js         启动引导（必须最后执行，避开 TDZ）
public/
  index.html          构建产物（部署入口，也可直接双击打开）
  _worker.js          Pages Worker：/api/qr* 云端接口
edge/
  index.js            边缘入口 Worker：把 qrcode.slashbro.top 转发到 Pages 站点
  wrangler.toml       Worker 配置（只做转发，无存储绑定）
lib/
  qrcode-generator.js 二维码编码（MIT, Kazuhiko Arase）
  jsqr.min.js         解码器，用于页面内自检
schema.sql            D1 建表语句
wrangler.toml         Pages 配置：输出目录 public + D1 / KV 绑定
```

## 域名入口为什么要单独一层 Worker

站点的**正文**（静态资源 + `/api/qr*`）全部跑在 Pages 项目 `qr-studio` 上，
推送 `main` 分支自动部署，这套流程不受影响。

但本账号的 wrangler OAuth 令牌**没有 `dns_records` 权限**：在 Pages 里添加自定义域名
只会建到 `pending`，CNAME 记录不会自动创建（`"CNAME record not set"`）。
而 **Workers 自定义域名**这条路是令牌允许的 —— Cloudflare 会自动创建 DNS 记录与证书
（账号里 `time` / `dinosaur-run` / `helicopter` / `slashpack` 四个域名都是这么来的）。

所以拆成：**Pages 负责内容与自动部署，`edge/` 这个 25 行的 Worker 只负责把域名接进来**。

```
qrcode.slashbro.top → qr-studio-edge (Worker，纯转发) → qr-studio-5rx.pages.dev (Pages)
```

已验证：两边的首页响应**字节级一致**（SHA256 相同），`/`、`/api/qr`、`/api/qr/:id`、
未知路径的状态码（200/404）逐条对齐，POST/DELETE 带 body 的请求正常穿透。

### 想换成零层级的直连（可选）

如果更希望 `qrcode.slashbro.top` 直接指向 Pages、不要中间这一跳：

1. Cloudflare 面板 → `slashbro.top` → DNS → 添加
   `CNAME  qrcode → qr-studio-5rx.pages.dev`（已代理）
2. 删除 Workers 自定义域名绑定（面板 Workers → qr-studio-edge → Settings → Domains & Routes）
3. Pages 项目 → Custom domains → 重新添加 `qrcode.slashbro.top`
4. 删掉本仓库的 `edge/` 目录

## 开发与部署

```bash
node build.js                                   # 构建
npx wrangler pages dev                          # 本地起 Pages（含 /api 接口、本地 D1/KV）
npx wrangler d1 execute qr-studio-db --local  --file=schema.sql   # 本地建表
npx wrangler pages deploy                       # 手动部署 Pages
cd edge && npx wrangler deploy                  # 部署边缘入口 Worker（仅改 edge/ 时才需要）
```

仓库连接到 Cloudflare Pages 的 `main` 分支后，推送即自动部署。
Pages 读取仓库内的 `wrangler.toml` 得到输出目录与 D1 / KV 绑定。
`edge/` 目录不在 Pages 的构建范围内，与 Pages 的自动部署互不干扰。

## 云端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/qr` | 列表（含缩略图） |
| POST | `/api/qr` | 新建；带 `id` 则覆盖该条目（不带 `png` 则沿用旧文件） |
| GET | `/api/qr/:id` | 取单条完整内容（含 PNG 与配方） |
| DELETE | `/api/qr/:id` | 删除 |

上限 20 条，服务端强制；超出返回 `409 limit_reached:20`。

### 为什么索引放 D1、文件放 KV

一开始索引和文件都放 KV，结果**保存完刷新列表看不到刚存的东西**：KV 的
`list()` 写入后要十几秒才可见（实测 ~15~20s），而按 key 直读是立刻可见的。

所以拆成两层：

- **D1** 存索引与元数据（id / 名称 / 时间 / 尺寸 / 配方 / 缩略图）—— 强一致，存完立刻出现在列表里
- **KV** 存 PNG 文件与 Logo 原图 —— 体积可达几百 KB，超过 D1 的 SQL 语句上限；
  而且只在点「载入 / PNG」时按 id 直读，不涉及 `list()`

## 两个已修复的坑（踩过，留个记录）

1. **多语言乱码**：`qrcode-generator` 默认 `stringToBytes` 只取低 8 位（Latin-1），
   德语 `ü`/`ß`、西语 `ñ`/`á` 会被编成非 UTF-8 字节。必须切到
   `qrcode.stringToBytesFuncs['UTF-8']`。
2. **圆点样式扫不出来**：定位图案 / 时序图案 / 校正图案必须是实心，
   装饰只能作用于数据模块，否则三种解码器全部失败。

## 许可

依赖 `qrcode-generator`（MIT）与 `jsQR`（Apache-2.0）。
