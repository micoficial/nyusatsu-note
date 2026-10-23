import { SITE_NAME, OPERATOR, SOURCES, AGENCY_BY_CODE } from './meta.mjs';
import { esc, comma, yen, mdDate, jpDate, caseNo, safeUrl } from './format.mjs';

export const ORIGIN = process.env.SITE_ORIGIN || 'https://micoficial.github.io';
export const BASE = process.env.SITE_BASE || '/nyusatsu-note/';
export const abs = (p) => `${ORIGIN}${BASE}${p}`;
export const href = (p) => `${BASE}${p}`;

export const companyPath = (n, fy) => `kigyo/${n}/${fy ? `${fy}/` : ''}`;
export const agencyPath = (a, fy, page = 1) => `fusho/${a.slug}/${fy ? `${fy}/` : ''}${page > 1 ? `${page}/` : ''}`;
export const orgPath = (id) => `kikan/${id}/`;
export const prefPath = (p, cat) => `ken/${p.slug}/${cat ? `${cat.slug}/` : ''}`;
export const topicPath = (t) => `bunya/${t.slug}/`;
export const catPath = (c) => `bunrui/${c.slug}/`;
export const datePath = (d) => `koukoku/${d}/`;
export const rankPath = (fy) => `ranking/${fy ? `${fy}/` : ''}`;

let ASSET_V = '1';
export const setAssetVersion = (v) => { ASSET_V = v; };
let BUILD = { built: '', kkjAsOf: '', pportalAsOf: '', today: '' };
export const setBuildInfo = (b) => { BUILD = { ...BUILD, ...b }; };
export const buildInfo = () => BUILD;

export function breadcrumbs(items) {
  // items: [[name, path|null], ...]
  const li = items.map(([name, p], i) => (p != null && i < items.length - 1
    ? `<li><a href="${href(p)}">${esc(name)}</a></li>`
    : `<li aria-current="page">${esc(name)}</li>`)).join('');
  const ld = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(p != null ? { item: abs(p) } : {}) })),
  };
  return { html: `<nav class="bc" aria-label="現在地"><ol>${li}</ol></nav>`, ld };
}

// 出典（全ページのフッター）
export function sourceLine() {
  const k = SOURCES.kkj;
  const p = SOURCES.pportal;
  return `公告：<a href="${k.url}" rel="noopener">${k.name}</a>（${k.org}）の検索APIを利用して取得（${esc(jpDate(BUILD.kkjAsOf))}時点）。落札実績：<a href="${p.data}" rel="noopener">${p.name}</a>（${p.org}）の落札実績オープンデータ（${esc(jpDate(BUILD.pportalAsOf))}時点）。いずれも${OPERATOR}が加工して作成したもので、国（中小企業庁・デジタル庁）が作成したものではありません。`;
}

export function shareButtons(url, text) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const hatena = url.replace(/^https:\/\//, 's/');
  return `<div class="share" data-url="${esc(url)}">
<span class="share-l">シェア</span>
<a class="sh sh-x" href="https://x.com/intent/post?text=${t}&amp;url=${u}" target="_blank" rel="noopener">X</a>
<a class="sh sh-line" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener">LINE</a>
<a class="sh sh-hb" href="https://b.hatena.ne.jp/entry/${esc(hatena)}" target="_blank" rel="noopener">はてブ</a>
<button class="sh sh-copy" type="button">リンクをコピー</button>
</div>`;
}

export function layout({ title, description, path, body, ld = [], noindex = false }) {
  const canonical = abs(path);
  const graph = ld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }).replace(/</g, '\\u003c')}</script>` : '';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${abs('assets/og.png')}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0f4c5c">
<link rel="icon" href="${href('assets/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${href('assets/icon-180.png')}">
<link rel="stylesheet" href="${href(`assets/style.css?v=${ASSET_V}`)}">
<script defer src="${href(`assets/app.js?v=${ASSET_V}`)}"></script>
${graph}
</head>
<body>
<header class="hd">
<div class="wrap hd-in">
<a class="logo" href="${href('')}"><span class="logo-m" aria-hidden="true">札</span><span>${SITE_NAME}</span></a>
<form class="sb" role="search" action="${href('search/')}" data-base="${BASE}">
<input class="sb-i" name="q" type="search" placeholder="会社名・機関名で検索" autocomplete="off" aria-label="会社名・機関名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<nav class="nv" aria-label="メニュー"><a href="${href('koukoku/')}">新着公告</a><a href="${href('shimekiri/')}">締切間近</a><a href="${href('rakusatsu/')}">落札結果</a><a href="${href('ranking/')}">ランキング</a><a href="${href('about/')}">使い方</a></nav>
</div>
</header>
<main class="wrap">
${body}
</main>
<footer class="ft">
<div class="wrap">
<p class="ft-src">${sourceLine()}</p>
<p>入札に参加するときは、必ず発注機関の元の公告・入札説明書で、締切・資格・日時をご確認ください。このサイトの締切日は公告文から自動で読み取った目安です。</p>
<nav class="ft-nv"><a href="${href('')}">トップ</a><a href="${href('koukoku/')}">新着の公告</a><a href="${href('ken/')}">都道府県から探す</a><a href="${href('bunya/')}">分野から探す</a><a href="${href('rakusatsu/')}">国の新着の落札結果</a><a href="${href('fusho/')}">府省の落札結果</a><a href="${href('ranking/')}">落札額ランキング</a><a href="${href('kikan/')}">機関から探す</a><a href="${href('about/')}">このサイトについて</a><a href="${href('about/#privacy')}">プライバシー</a></nav>
<p class="ft-c">© ${new Date().getFullYear()} ${OPERATOR}　｜　データ更新：${esc(BUILD.built)}</p>
</div>
</footer>
</body>
</html>
`;
}

export function pager(basePath, page, pages) {
  if (pages <= 1) return '';
  const link = (p, label = p) => (p === page ? `<span aria-current="page">${label}</span>` : `<a href="${href(p === 1 ? basePath : `${basePath}${p}/`)}">${label}</a>`);
  const items = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) items.push(link(p));
    else if (items[items.length - 1] !== '…') items.push('…');
  }
  return `<nav class="pg" aria-label="ページ">${items.join('')}</nav>`;
}

// ---- 公告の一覧 ----
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const wd = (d) => WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()];

// 「入札公告の取りやめに関する公告」などは、締切前の一覧に入れない
const CANCEL = /(入札|公告|調達|手続き?|執行|公募)の?(取りやめ|取止め|取り止め|中止|取り消し|取消し?)|(取りやめ|取り止め|中止|取消し?)(について|のお知らせ|に関する|します|しました)/;

// 締切の状態。today は 'YYYY-MM-DD'（日本時間）
export function noticeStatus(n, today) {
  if (CANCEL.test(n.t)) return { open: false, days: null, label: '取りやめ・中止', cls: 'st-closed' };
  if (n.dl) {
    const days = Math.round((Date.parse(n.dl) - Date.parse(today)) / 864e5);
    if (days >= 0) return { open: true, days, label: days === 0 ? '今日まで' : `あと${days}日`, cls: days <= 3 ? 'st-soon' : 'st-open' };
    return { open: false, days, label: n.dk === 'open' ? '開札済み' : '締切済み', cls: 'st-closed' };
  }
  const age = Math.round((Date.parse(today) - Date.parse(n.d)) / 864e5);
  if (age <= 30) return { open: true, days: null, label: '締切は公告で確認', cls: 'st-unk' };
  return { open: false, days: null, label: '公告から30日超', cls: 'st-closed' };
}

export function noticeList(list, ctx, { showOrg = true, showPref = false } = {}) {
  if (!list.length) return '<p class="note">該当する公告はありません。</p>';
  return `<ul class="nl">${list.map((n) => {
    const st = noticeStatus(n, ctx.today);
    // 日本語や空白を含むURLもあるので、そのときは符号化してから確かめる
    const raw = String(n.u || '').trim();
    const u = safeUrl(/[^\x21-\x7e]/.test(raw) ? encodeURI(raw) : raw);
    const ft = n.ft && /^(pdf|docx?|xlsx?|zip)$/i.test(n.ft) ? `<span class="ft-b">${esc(n.ft.toUpperCase())}</span>` : '';
    const org = ctx.orgOf(n);
    const meta = [
      n.dl ? `<b>${n.dk === 'open' ? '開札' : '締切'} ${mdDate(n.dl)}（${wd(n.dl)}）</b>` : '',
      showOrg && org ? `<a href="${href(orgPath(org.id))}">${esc(org.label)}</a>` : '',
      showPref && n.p && ctx.prefName(n.p) && !(org && org.label.includes(ctx.prefName(n.p))) ? esc(ctx.prefName(n.p)) : '',
      n.cat || n.gc ? esc(n.cat || `${n.gc}（推定）`) : '',
      `公告 ${mdDate(n.d)}`,
    ].filter(Boolean).join('<i>・</i>');
    const snip = n.ds ? `<small class="nl-s">公告文より「${esc(n.ds)}」</small>` : '';
    const title = u ? `<a class="nl-t" href="${esc(u)}" target="_blank" rel="noopener">${esc(n.t)}</a>${ft}` : `<span class="nl-t">${esc(n.t)}</span>`;
    return `<li><span class="st ${st.cls}">${st.label}</span>${title}<span class="nl-m">${meta}</span>${snip}</li>`;
  }).join('')}</ul>`;
}

// ---- 落札の表 ----
export function awardTable(rows, { show = 'agency', companyLink = null } = {}) {
  if (!rows.length) return '<p class="note">該当する落札はありません。</p>';
  const head = `<th>落札日</th><th>件名</th><th>${show === 'agency' ? '府省' : '落札者'}</th><th class="num">落札額</th>`;
  const tr = rows.map((a) => {
    const ag = AGENCY_BY_CODE.get(a.a);
    let who;
    if (show === 'agency') who = ag ? esc(ag.name) : esc(a.a);
    else {
      const p = companyLink && companyLink(a);
      who = p ? `<a href="${href(p)}">${esc(a.w)}</a>` : esc(a.w);
    }
    const price = a.k === 'unit' ? `${yen(a.y)}<small>単価</small>` : a.k === 'sale' ? `${yen(a.y)}<small>売払い</small>` : yen(a.y);
    // 行が多いので、列の見た目は class ではなく CSS の nth-child で付ける（ページを軽くする）
    return `<tr><td>${a.d.slice(0, 4)}/${a.d.slice(5, 7)}/${a.d.slice(8, 10)}</td><td>${esc(a.t)}<small>案件番号 ${caseNo(a.id)}</small></td><td>${who}</td><td>${price}</td></tr>`;
  }).join('\n');
  return `<div class="tw"><table class="at"><thead><tr>${head}</tr></thead><tbody>
${tr}
</tbody></table></div>`;
}

// 会社の順位表（落札額・件数）
export function companyRank(rows, { valueLabel = '落札額の合計', countLabel = '件数', start = 1 } = {}) {
  if (!rows.length) return '<p class="note">該当する会社はありません。</p>';
  const tr = rows.map((r, i) => {
    const name = r.path ? `<a href="${href(r.path)}">${esc(r.name)}</a>` : esc(r.name);
    return `<tr><td class="rt-n">${start + i}</td><td class="rt-c">${name}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</td><td class="num">${esc(r.value)}</td><td class="num">${comma(r.count)}件</td></tr>`;
  }).join('\n');
  return `<div class="tw"><table class="rt"><thead><tr><th>順位</th><th>会社</th><th class="num">${esc(valueLabel)}</th><th class="num">${esc(countLabel)}</th></tr></thead><tbody>
${tr}
</tbody></table></div>`;
}
