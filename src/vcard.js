/* =========================================================================
 * QR Logo Studio · 名片（vCard / MECARD）生成器
 *
 * 格式要点（都踩过，别改）：
 *  - 每行结尾必须是 CRLF（\r\n），纯 LF 不合规
 *  - 非结构化文本里 \ , ; 要转义，\n 表示换行
 *  - N / ADR 是「分号分隔的结构化」字段，里面的分号不能转义（转了就解析错），
 *    所以只转义 \ 和 , —— 姓名里真有分号只能换写法
 *  - 社媒：SOCIALPROFILE 是 vCard 4.0 才有的标准属性（RFC 7095，2015）；
 *    3.0 只有 Apple 的私有扩展 X-SOCIALPROFILE（Apple 通讯录自己导出的就是它）
 *  - 微信没有 wa.me 那种唤起链接，vCard 只能存微信号文本，点了不会加好友
 * ========================================================================= */

const CRLF = '\r\n';

/** 文本字段转义：反斜杠、逗号、分号、换行 */
function vcText(v) {
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** 结构化字段的单个分段：只转义反斜杠和逗号（分号是分隔符，不能转） */
function vcComp(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/,/g, '\\,');
}

/** 电话 → 只留数字和开头的 +（wa.me 要求无空格无括号） */
function vcPhoneDigits(v) {
  const s = String(v || '').trim();
  const plus = s.replace(/[^\d]/g, '').replace(/^0+/, '');
  return /\+\d[\d\s\-()]{6,}/.test(s) ? '+' + plus : plus;
}

/* 姓名顺序：中日韩习惯姓在前，拉丁字母习惯名在前（Ray 李 / Ray Li 都对）。
   注意 vCard 的 N 字段永远是「姓;名」，那是规范强制的，跟显示顺序无关。 */
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿가-힯]/;
function displayName(last, first) {
  if (!last) return first || '';
  if (!first) return last;
  return CJK_RE.test(last + first) ? last + ' ' + first : first + ' ' + last;
}
/** WhatsApp 官方 click-to-chat 链接：https://wa.me/<国家码+号码> */
function waLink(phone) {
  const d = vcPhoneDigits(phone);
  return d ? 'https://wa.me/' + d.replace(/^\+/, '') : '';
}
/** 社交账号的规范链接。
 *  坑：LinkedIn 大家习惯只填 `in/rayli` 或直接填整条网址，Instagram 会带 @，
 *  光靠「去掉协议头再补 https://」会生成 https://in/rayli 这种废链接。 */
const SOCIAL_DEFS = [
  { key: 'whatsapp', type: 'whatsapp', field: 'phone', fromPhone: true },
  {
    key: 'instagram', type: 'instagram', field: 'instagram',
    link: u => (/^https?:\/\//i.test(u) ? u.replace(/\/+$/, '')
      : 'https://www.instagram.com/' + u.replace(/^@/, '').replace(/^\/+/, '').replace(/\/+$/, '')),
  },
  {
    key: 'linkedin', type: 'linkedin', field: 'linkedin',
    // 允许填 username / in/username / company/xxx / 完整 URL；
    // 只填一个词时默认是个人主页 in/xxx（填错会变成 /rayli 这种废链接）
    link: u => (/^https?:\/\//i.test(u) ? u.replace(/\/+$/, '')
      : 'https://www.linkedin.com/' + (u.indexOf('/') >= 0 ? '' : 'in/') + u.replace(/^\/+/, '').replace(/\/+$/, '')),
  },
  {
    key: 'x', type: 'twitter', field: 'x',
    link: u => (/^https?:\/\//i.test(u) ? u.replace(/\/+$/, '')
      : 'https://x.com/' + u.replace(/^@/, '').replace(/^\/+/, '').replace(/\/+$/, '')),
  },
];

/**
 * 生成名片内容
 * @param {object} f  表单：lastName firstName org title phone email url address city region
 *                    country postal wechat instagram linkedin x note nickname
 * @param {object} o  选项：version '3.0'|'4.0'|'mecard'，socialMode 'url'|'profile'
 * @returns {{data:string, bytes:number, lines:number, socials:number}}
 */
function buildVCard(f, o) {
  o = o || {};
  const ver = o.version || '3.0';
  const socialMode = o.socialMode === 'profile' ? 'profile' : 'url';
  f = f || {};

  const last = vcComp(f.lastName).trim();
  const first = vcComp(f.firstName).trim();
  const full = displayName(f.lastName, f.firstName) || vcText(f.nickname || '');
  const phoneRaw = (f.phone || '').trim();
  const wechat = (f.wechat || '').trim();

  // 社媒链接：有账号才算，没有就跳过
  const socials = [];
  for (const d of SOCIAL_DEFS) {
    let url = '';
    if (d.fromPhone) {
      url = waLink(phoneRaw);
    } else {
      const raw = (f[d.field] || '').trim();
      if (raw) url = d.link(raw);
    }
    if (url) socials.push({ type: d.type, url: url });
  }
  if (wechat) socials.push({ type: 'wechat', text: wechat });

  /* ---------- MECARD（仅安卓 / 日本系 App） ----------
   * MECARD 是极简格式，**没有转义机制**（设计目标就是手写能记住），
   * 所以这里绝不能用 vcText/vcComp —— 那会把逗号和分号转义成 \; \, ，反而解析错。
   * 字段用 ; 分隔，整条记录以 ; 结尾。 */
  if (ver === 'mecard') {
    // MECARD 的 N 段是「姓,名」（逗号），和 vCard 的分号不一样
    const m = ['MECARD:N:' + [f.lastName, f.firstName].filter(Boolean).join(',')];
    if (f.org) m.push('ORG:' + f.org);
    if (phoneRaw) m.push('TEL:' + vcPhoneDigits(phoneRaw));
    if (f.email) m.push('EMAIL:' + f.email);
    if (f.url) m.push('URL:' + (/^https?:\/\//i.test(f.url.trim()) ? f.url.trim() : 'https://' + f.url.trim()));
    const adr = [f.address, f.city, f.region, f.postal, f.country].filter(Boolean).join(',');
    if (adr) m.push('ADR:' + adr);
    for (const s of socials) if (s.url) m.push('URL:' + s.url);
    if (wechat) m.push('IMPP:wechat:' + wechat);
    if (f.note) m.push('NOTE:' + f.note);
    const data = m.join(';') + ';';       // 末尾只补一个分号
    return { data: data, bytes: byteLen(data), lines: m.length, socials: socials.length };
  }

  /* ---------- vCard 3.0 / 4.0 ---------- */
  const L = ['BEGIN:VCARD', 'VERSION:' + ver];
  const add = k => { L.push(k); };

  if (last || first) add('N:' + [last, first, '', '', ''].join(';'));
  add('FN:' + vcText(full));
  if (wechat) add('NICKNAME:' + vcText(f.nickname || f.firstName || ''));
  // 排序串：让通讯录按姓排（中文名尤其重要，否则会按名排）
  if (last || first) add('SORT-STRING:' + [last, first].filter(Boolean).join(', '));
  if (ver === '4.0') add('UID:urn:uuid:' + (f.uuid || '00000000-0000-4000-8000-000000000000'));
  if (ver === '4.0') add('PRODID:-//QR Studio//ZH-CN');
  if (f.org) add('ORG:' + vcText(f.org));
  if (f.title) add('TITLE:' + vcText(f.title));
  if (f.role) add('ROLE:' + vcText(f.role));
  if (phoneRaw) add('TEL;TYPE=CELL,VOICE:' + vcText(phoneRaw));
  if (f.email) add('EMAIL;TYPE=WORK:' + vcText(f.email));
  if (f.address || f.city || f.region || f.postal || f.country) {
    // ADR 值固定 7 段：邮政信箱;扩展地址;街道;城市;省州;邮编;国家
    // ⚠ 前面不要再多打一个分号 —— 多一个就把街道挪到"城市"槽，整条地址整体错位一格
    add('ADR;TYPE=WORK:' + ['', '', f.address, f.city, f.region, f.postal, f.country].map(vcComp).join(';'));
  }
  if (f.bday) add('BDAY:' + vcText(f.bday.replace(/[^\d-]/g, '')));

  const web = (f.url || '').trim();
  if (web) add('URL:' + vcText(/^https?:\/\//i.test(web) ? web : 'https://' + web));

  // 社媒
  for (const s of socials) {
    if (s.text) {
      if (socialMode === 'url' || ver === '4.0') add('IMPP:' + s.type + ':' + s.text);
      continue;
    }
    if (socialMode === 'profile') {
      add((ver === '4.0' ? 'SOCIALPROFILE' : 'X-SOCIALPROFILE') + ';TYPE=' + s.type + ':' + s.url);
    } else {
      add('URL:' + s.url);
    }
  }

  if (f.note) add('NOTE:' + vcText(f.note));
  if (f.categories) for (const c of String(f.categories).split(/[,，]/)) {
    if (c.trim()) add('CATEGORIES:' + vcText(c.trim()));
  }
  L.push('END:VCARD');
  const data = L.join(CRLF) + CRLF;
  return { data: data, bytes: byteLen(data), lines: L.length, socials: socials.length };
}

function byteLen(s) {
  try { return new TextEncoder().encode(s).length; } catch (e) { return unescape(encodeURIComponent(s)).length; }
}

/** 表单里哪些字段是空的（用来提示"至少填姓名和一个联系方式"） */
function vcardFilled(f) {
  return Object.keys(f).filter(k => f[k] && String(f[k]).trim() && k !== 'version' && k !== 'socialMode').length;
}
