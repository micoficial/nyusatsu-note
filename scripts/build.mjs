// 貯めた公開データ → 静的サイト（dist/）を作る
// 使い方: node scripts/build.mjs   （先に node scripts/fetch.mjs でデータを取る）
//   LIMIT=300 で会社ページを300件だけ作る（試すとき用）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadAwards, loadNotices } from './lib/load.mjs';
import { AGENCIES, AGENCY_BY_CODE, PREFS, PREF_BY_CODE, TOPICS, CATEGORIES, topicsOf, guessCategory } from './lib/meta.mjs';
import { hashId } from './lib/format.mjs';
import {
  setAssetVersion, setBuildInfo, abs, BASE, companyPath, agencyPath, orgPath, prefPath, topicPath, catPath, datePath, rankPath, noticeStatus,
} from './lib/html.mjs';
import { renderCompany, renderCompanyYear } from './pages/company.mjs';
import { renderAgencyIndex, renderAgency, renderAgencyYear } from './pages/agency.mjs';
import {
  renderNoticesTop, renderDate, renderShimekiri, renderPrefIndex, renderPref, renderPrefCat, renderOrg, renderCat, renderOrgIndex,
} from './pages/notices.mjs';
import {
  renderTop, renderTopicIndex, renderTopic, renderRankingIndex, renderRanking, renderSearch, render404, renderAbout, renderLatestAwards, renderOpendataGuide,
} from './pages/hubs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const LIMIT = process.env.LIMIT ? +process.env.LIMIT : 0;
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const now = new Date();
const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の今日
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// ================= 落札実績（調達ポータル） =================
const { awards, info: ppInfo } = loadAwards(path.join(ROOT, 'data', 'raw', 'pportal'));
log('awards', awards.length, ppInfo);
const ppMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raw', 'pportal', 'meta.json'), 'utf8'));

const counted = (a) => a.k === ''; // 売払い・単価は金額の合計に入れない
const bump = (m, k, a) => {
  let x = m.get(k);
  if (!x) m.set(k, (x = { c: 0, s: 0 }));
  x.c++;
  if (counted(a)) x.s += a.y;
  return x;
};

const companies = new Map(); // 法人番号 → 会社
const agencies = new Map(AGENCIES.map((a) => [a.code, { ...a, awards: [], fy: new Map(), co: new Map(), topics: new Map() }]));
const topicAgg = new Map(TOPICS.map((t) => [t.slug, { ...t, awards: [], co: new Map(), notices: [] }]));
const fyRank = new Map(); // 年度 → (法人番号 → {c, s})
let noCorp = 0;
let totalSum = 0;
for (const a of awards) {
  a.tp = topicsOf(a.t);
  if (counted(a)) totalSum += a.y;
  let ag = agencies.get(a.a);
  if (!ag) {
    ag = { code: a.a, name: `府省等コード ${a.a}`, note: 'コードの意味が分からない府省等', slug: a.a.toLowerCase(), awards: [], fy: new Map(), co: new Map(), topics: new Map() };
    agencies.set(a.a, ag);
  }
  ag.awards.push(a);
  bump(ag.fy, a.fy, a);
  for (const t of a.tp) {
    const ta = topicAgg.get(t);
    ta.awards.push(a);
    ag.topics.set(t, (ag.topics.get(t) || 0) + 1);
  }
  if (!a.n) { noCorp++; continue; }
  let c = companies.get(a.n);
  if (!c) {
    c = { n: a.n, name: a.w, nameDate: a.d, names: new Map(), awards: [], c: 0, s: 0, fy: new Map(), ag: new Map(), tp: new Map(), first: a.d, last: a.d };
    companies.set(a.n, c);
  }
  c.awards.push(a);
  c.c++;
  if (counted(a)) c.s += a.y;
  if (a.d > c.nameDate) { c.name = a.w; c.nameDate = a.d; }
  const nm = c.names.get(a.w);
  if (!nm) c.names.set(a.w, { first: a.d, last: a.d, c: 1 }); else { nm.c++; if (a.d < nm.first) nm.first = a.d; if (a.d > nm.last) nm.last = a.d; }
  if (a.d < c.first) c.first = a.d;
  if (a.d > c.last) c.last = a.d;
  bump(c.fy, a.fy, a);
  bump(c.ag, a.a, a);
  for (const t of a.tp) bump(c.tp, t, a);
  bump(ag.co, a.n, a);
  for (const t of a.tp) bump(topicAgg.get(t).co, a.n, a);
  let fr = fyRank.get(a.fy);
  if (!fr) fyRank.set(a.fy, (fr = new Map()));
  bump(fr, a.n, a);
}
log('companies', companies.size, 'no corp rows', noCorp);

const fys = [...fyRank.keys()].sort((a, b) => b - a);
const currentFy = fys[0];
const lastFullFy = fys.find((y) => y < currentFy) ?? currentFy;
const coList = [...companies.values()].sort((a, b) => b.s - a.s || b.c - a.c || a.n.localeCompare(b.n));
coList.forEach((c, i) => { c.rankAll = i + 1; });
const rankOf = (m) => [...m.entries()].map(([n, x]) => ({ co: companies.get(n), ...x })).filter((r) => r.co);
const byAmount = (a, b) => b.s - a.s || b.c - a.c || a.co.n.localeCompare(b.co.n);
const byCount = (a, b) => b.c - a.c || b.s - a.s || a.co.n.localeCompare(b.co.n);
const fyTop = new Map(fys.map((y) => [y, rankOf(fyRank.get(y)).sort(byAmount)]));
// 会社ページに出す順位（年度の落札額で上位100位まで）
for (const [y, list] of fyTop) list.slice(0, 100).forEach((r, i) => { (r.co.badges ||= []).push({ fy: y, rank: i + 1 }); });

// 同じ分野・同じ府省で落札の多い会社（会社ページ用）
for (const ta of topicAgg.values()) ta.topCo = rankOf(ta.co).sort(byCount);
for (const ag of agencies.values()) {
  ag.topCo = rankOf(ag.co).sort(byAmount);
  ag.topCoCount = rankOf(ag.co).sort(byCount);
}

// ================= 公告（官公需ポータル） =================
const { notices: allNotices, info: kkjInfo } = loadNotices(path.join(ROOT, 'data', 'store', 'kkj'));
const kkjStatus = fs.existsSync(path.join(ROOT, 'data', 'fetch-status.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fetch-status.json'), 'utf8')) : {};
const windowStart = addDays(today, -365);
// 同じ機関・同じ件名・同じ公告日の公告（公告文と別紙が別々に載っているものなど）は1件にまとめる。日付を読み取れた方を残す
const dedup = new Map();
for (const n of allNotices) {
  if (n.d < windowStart || n.d > addDays(today, 60)) continue;
  const key = `${n.o}|${n.t}|${n.d}`;
  const prev = dedup.get(key);
  if (!prev || (!prev.dl && n.dl)) dedup.set(key, n);
}
const notices = [...dedup.values()];
log('notices', notices.length, `（まとめる前 ${allNotices.length}）`, kkjInfo);

const prefName = (p) => PREF_BY_CODE.get(p)?.name || '';
const NATIONAL = /^(内閣|衆議院|参議院|最高裁判所|会計検査院|人事院|宮内庁|国立国会図書館|[^都道府県市区町村]{1,10}(省|庁)|.*委員会$)/;
const QUASI = /法人|機構|大学|研究所|研究開発|公庫|公団|事業団|高等専門学校|銀行$/;
function agencyOfOrg(name) {
  let best = null;
  for (const a of AGENCIES) if (name.startsWith(a.name) && (!best || a.name.length > best.name.length)) best = a;
  return best;
}
// 機関名 → ページのID（機関名のハッシュ。まれに重なったら付け直す）
const orgIdByName = new Map();
const orgNameById = new Map();
function orgIdFor(name) {
  let id = orgIdByName.get(name);
  if (id) return id;
  id = hashId(name);
  while (orgNameById.has(id) && orgNameById.get(id) !== name) id = hashId(`${name}#${id}`);
  orgNameById.set(id, name);
  orgIdByName.set(name, id);
  return id;
}
const orgs = new Map();
for (const n of notices) {
  if (!n.cat) {
    const g = guessCategory(n.t);
    if (g) n.gc = g;
  }
  n.tp = topicsOf(n.t);
  const id = orgIdFor(n.o);
  let o = orgs.get(id);
  if (!o) {
    const pn = prefName(n.p);
    let label = n.o;
    let type = 'other';
    if (pn && n.o === pn) type = 'pref';
    else if (pn && n.cn && n.o === pn + n.cn) { type = 'city'; label = `${n.cn}（${pn}）`; }
    else if (NATIONAL.test(n.o) && !(pn && n.o.startsWith(pn))) type = 'national';
    else if (QUASI.test(n.o)) type = 'quasi';
    else if (pn && n.o.startsWith(pn)) type = 'local';
    o = { id, name: n.o, label, type, prefCount: new Map(), notices: [], agency: type === 'national' ? agencyOfOrg(n.o) : null, city: n.cn || '' };
    orgs.set(id, o);
  }
  o.notices.push(n);
  if (n.p) o.prefCount.set(n.p, (o.prefCount.get(n.p) || 0) + 1);
}
for (const o of orgs.values()) {
  o.pref = [...o.prefCount].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  o.open = o.notices.filter((n) => noticeStatus(n, today).open).length;
  o.recent = o.notices.filter((n) => n.d >= addDays(today, -30)).length;
}
const orgOf = (n) => orgs.get(orgIdFor(n.o));
const orgList = [...orgs.values()].sort((a, b) => b.recent - a.recent || b.notices.length - a.notices.length || a.name.localeCompare(b.name, 'ja'));
log('orgs', orgs.size);

const open = notices.filter((n) => noticeStatus(n, today).open);
const byPref = new Map(PREFS.map((p) => [p.code, []]));
const byPrefOpen = new Map(PREFS.map((p) => [p.code, []]));
const byDate = new Map();
for (const n of notices) {
  if (byPref.has(n.p)) byPref.get(n.p).push(n);
  if (!byDate.has(n.d)) byDate.set(n.d, []);
  byDate.get(n.d).push(n);
}
for (const n of open) {
  if (byPrefOpen.has(n.p)) byPrefOpen.get(n.p).push(n);
  for (const t of n.tp) topicAgg.get(t).notices.push(n);
}
const catOf = (n) => n.cat || n.gc || '';
const dates = [...byDate.keys()].filter((d) => d <= today).sort().reverse();
const recentDates = dates.slice(0, 31);

// ================= 出力 =================
const built = `${today.slice(0, 4)}年${+today.slice(5, 7)}月${+today.slice(8, 10)}日`;
const kkjAsOf = kkjStatus.kkj ? today : (notices[0]?.f || kkjInfo.last || today);
setBuildInfo({ built, today, kkjAsOf, pportalAsOf: ppInfo.latestDate });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const ASSETS_SRC = path.join(ROOT, 'src', 'assets');
fs.cpSync(ASSETS_SRC, path.join(DIST, 'assets'), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'src', 'root'))) fs.cpSync(path.join(ROOT, 'src', 'root'), DIST, { recursive: true });
const hash = crypto.createHash('sha1');
for (const f of ['style.css', 'app.js']) hash.update(fs.readFileSync(path.join(ASSETS_SRC, f)));
setAssetVersion(hash.digest('hex').slice(0, 8));

let pages = 0;
let bytes = 0;
const urls = { hubs: [], notices: [], companies: [] };
function write(p, html, kind = 'hubs', sitemap = true) {
  const file = p === '' ? path.join(DIST, 'index.html') : p.endsWith('.html') ? path.join(DIST, p) : path.join(DIST, p, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  pages++;
  bytes += Buffer.byteLength(html);
  if (sitemap) urls[kind].push(abs(p));
}

const ctx = {
  today, built, awards, companies, coList, agencies, topicAgg, fys, currentFy, lastFullFy, fyTop, totalSum, noCorp, ppInfo, ppMeta,
  notices, open, orgs, orgList, orgOf, byPref, byPrefOpen, byDate, dates, recentDates, prefName, catOf, kkjInfo, kkjStatus,
  rankOf, byAmount, byCount, addDays,
  companyLink: (a) => (a.n && companies.has(a.n) ? companyPath(a.n) : null),
};

write('', renderTop(ctx));
write('about/', renderAbout(ctx));
write('about/opendata/', renderOpendataGuide(ctx));
write('search/', renderSearch(ctx), 'hubs', false);
write('404.html', render404(ctx), 'hubs', false);

// 公告
write('koukoku/', renderNoticesTop(ctx), 'notices');
for (const d of recentDates) write(datePath(d), renderDate(ctx, d), 'notices');
write('shimekiri/', renderShimekiri(ctx), 'notices');
write('ken/', renderPrefIndex(ctx), 'notices');
for (const p of PREFS) {
  write(prefPath(p), renderPref(ctx, p), 'notices');
  for (const c of CATEGORIES) write(prefPath(p, c), renderPrefCat(ctx, p, c), 'notices');
}
for (const c of CATEGORIES) write(catPath(c), renderCat(ctx, c), 'notices');
write('kikan/', renderOrgIndex(ctx), 'notices');
for (const o of orgList) write(orgPath(o.id), renderOrg(ctx, o), 'notices');
log('notice pages', pages);

// 分野
write('bunya/', renderTopicIndex(ctx));
for (const t of topicAgg.values()) write(topicPath(t), renderTopic(ctx, t));

// 府省
write('rakusatsu/', renderLatestAwards(ctx));
write('fusho/', renderAgencyIndex(ctx));
const PER_AGENCY_YEAR = 500;
for (const ag of agencies.values()) {
  if (!ag.awards.length) continue;
  write(agencyPath(ag), renderAgency(ctx, ag));
  for (const fy of [...ag.fy.keys()].sort((a, b) => b - a)) {
    const list = ag.awards.filter((a) => a.fy === fy);
    const n = Math.ceil(list.length / PER_AGENCY_YEAR);
    for (let i = 1; i <= n; i++) write(agencyPath(ag, fy, i), renderAgencyYear(ctx, ag, fy, list, i, n, PER_AGENCY_YEAR));
  }
}

// ランキング
write('ranking/', renderRankingIndex(ctx));
for (const fy of fys) write(rankPath(fy), renderRanking(ctx, fy));
log('hub pages', pages);

// 会社
const MAIN_ROWS = 200;
const targets = LIMIT ? coList.slice(0, LIMIT) : coList;
for (const c of targets) {
  c.split = c.awards.length > 400;
  write(companyPath(c.n), renderCompany(c, ctx, MAIN_ROWS), 'companies');
  if (c.split) for (const fy of [...c.fy.keys()].sort((a, b) => b - a)) write(companyPath(c.n, fy), renderCompanyYear(c, ctx, fy), 'companies');
}
log('company pages', targets.length);

// 検索用の索引（会社は落札額の大きい順、機関は直近の公告の多い順）
const index = {
  v: 1,
  built,
  c: coList.map((c) => [c.n, c.name, c.c]),
  o: orgList.map((o) => [o.id, o.label, o.pref ? PREF_BY_CODE.get(o.pref)?.short || '' : '', o.recent]),
  a: [...agencies.values()].filter((a) => a.awards.length).map((a) => [a.slug, a.name, a.awards.length]),
};
fs.writeFileSync(path.join(DIST, 'assets', 'index.json'), JSON.stringify(index));

// サイトマップ
const lastmod = today;
const smFiles = [];
const writeSitemap = (name, list) => {
  fs.writeFileSync(path.join(DIST, name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  smFiles.push(name);
};
writeSitemap('sitemap-hubs.xml', urls.hubs);
for (let i = 0; i < urls.notices.length; i += 40000) writeSitemap(`sitemap-notices-${i / 40000 + 1}.xml`, urls.notices.slice(i, i + 40000));
for (let i = 0; i < urls.companies.length; i += 40000) writeSitemap(`sitemap-companies-${i / 40000 + 1}.xml`, urls.companies.slice(i, i + 40000));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smFiles.map((f) => `<sitemap><loc>${abs(f)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${abs('sitemap.xml')}\n`);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// 更新の記録（リポジトリに残す。GitHub の定期実行が止まらないようにする役目もある）
const summary = {
  built, base: BASE, pages, bytes,
  awards: awards.length, companies: companies.size, awardsLatest: ppInfo.latestDate, pportalAllUpdated: ppMeta.allUpdated,
  notices: notices.length, openNotices: open.length, orgs: orgs.size, noticesLatest: dates[0], kkjFetch: kkjStatus.kkj || kkjStatus.kkjError || null,
};
if (process.env.GITHUB_ACTIONS === 'true' && !LIMIT) {
  fs.writeFileSync(path.join(ROOT, 'data', 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}
log('done', summary);
