// 表示用の小さな関数

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const comma = (n) => Number(n).toLocaleString('ja-JP');

// 落札額（1件）はそのまま円で
export const yen = (n) => `${comma(Math.round(n))}円`;

// 合計額は「億円」「万円」で短く
export function yenShort(n) {
  if (!n) return '0円';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2).replace(/\.?0+$/, '')}兆円`;
  if (n >= 1e10) return `${comma(Math.round(n / 1e8))}億円`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, '')}億円`;
  if (n >= 1e4) return `${comma(Math.round(n / 1e4))}万円`;
  return `${comma(n)}円`;
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function jpDate(d, { weekday = false, year = true } = {}) {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  const w = weekday ? `（${WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}）` : '';
  return `${year ? `${y}年` : ''}${m}月${day}日${w}`;
}
export const mdDate = (d) => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '—');

// 年度（4月始まり）
export const fyLabel = (fy) => `${fy}年度`;
export const fyReiwa = (fy) => (fy >= 2019 ? `令和${fy === 2019 ? '元' : fy - 2018}年度` : `平成${fy - 1988}年度`);

export function truncate(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function safeUrl(u) {
  u = String(u ?? '').trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(u)) return '';
  return u;
}

// 「株式会社」などを外した呼び名（文中で使う）
const KIND = /^(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|公益社団法人|一般財団法人|公益財団法人|社会福祉法人|医療法人社団|医療法人財団|医療法人|学校法人|特定非営利活動法人|独立行政法人|地方独立行政法人|国立研究開発法人|国立大学法人|社会医療法人|協同組合|有限責任事業組合)\s*|\s*(株式会社|有限会社|合同会社|合資会社|合名会社)$/g;
export const shortName = (name) => {
  const s = name.replace(KIND, '').trim();
  return s.length >= 2 ? s : name;
};

// 調達案件番号は先頭の0を外して見せる（調達ポータルの検索も先頭の0を省いて探せる）
export const caseNo = (id) => String(id).replace(/^0+/, '');

// 32bitのハッシュを英数字7桁に（機関ページのURLに使う）
export function hashId(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}
