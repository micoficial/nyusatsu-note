// 公告のページ：新着・日付・締切が近い・都道府県・分類・機関
import { SITE_NAME, PREFS, PREF_BY_CODE, CATEGORIES, SOURCES } from '../lib/meta.mjs';
import { esc, comma, jpDate } from '../lib/format.mjs';
import { layout, breadcrumbs, href, abs, orgPath, prefPath, catPath, datePath, agencyPath, noticeList, noticeStatus, shareButtons } from '../lib/html.mjs';

const CAP = 300;
const byIssue = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.f < b.f ? 1 : a.f > b.f ? -1 : 0);
const byDeadline = (a, b) => (a.dl < b.dl ? -1 : a.dl > b.dl ? 1 : byIssue(a, b));

const KKJ_NOTE = `<p class="note">公告は<a href="${SOURCES.kkj.url}" rel="noopener">${SOURCES.kkj.name}</a>（${SOURCES.kkj.org}）の検索APIで集めたもので、発注機関のすべての公告ではありません。件名をクリックすると、発注機関の元の公告（PDFなど）が開きます。締切・開札の日付は公告文から自動で読み取った目安です。必ず元の公告でご確認ください。</p>`;

function catCounts(list, ctx) {
  const m = new Map(CATEGORIES.map((c) => [c.key, 0]));
  for (const n of list) { const k = ctx.catOf(n); if (m.has(k)) m.set(k, m.get(k) + 1); }
  return m;
}

function orgGrid(orgs) {
  return `<ul class="grid grid-w">${orgs.map((o) => `<li><a href="${href(orgPath(o.id))}">${esc(o.label)}<small>${o.open ? `${comma(o.open)}件` : '—'}</small></a></li>`).join('')}</ul>`;
}

export function renderNoticesTop(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['新着の入札公告', null]]);
  const latest = ctx.notices.filter((n) => n.d <= ctx.today).slice(0, 200);
  const total31 = ctx.recentDates.reduce((s, d) => s + ctx.byDate.get(d).length, 0);
  const body = `${bc.html}
<header class="ph"><h1>新着の入札公告（国・都道府県・市区町村）</h1>
<p class="lead">国の機関・都道府県・市区町村・独立行政法人などが出した入札公告を、公告日の新しい順に並べています。直近31日の公告は${comma(total31)}件、そのうち締切前（または締切日が読み取れず公告から30日以内）のものは${comma(ctx.open.length)}件です。</p></header>
<section class="sec"><h2>日付から探す</h2><div class="chips">${ctx.recentDates.map((d) => `<a href="${href(datePath(d))}">${jpDate(d, { year: false, weekday: true })} <small>${comma(ctx.byDate.get(d).length)}</small></a>`).join('')}</div></section>
<section class="sec"><h2>新しい公告（${comma(latest.length)}件）</h2>
${KKJ_NOTE}
${noticeList(latest, ctx, { showPref: true })}</section>
<section class="sec"><h2>地域・分類から探す</h2>
<p><a href="${href('ken/')}">都道府県から探す</a>　<a href="${href('shimekiri/')}">締切が近い公告</a>　${CATEGORIES.map((c) => `<a href="${href(catPath(c))}">${c.key}</a>`).join('　')}</p></section>`;
  return layout({
    title: `新着の入札公告一覧（国・自治体）｜${SITE_NAME}`,
    description: `国・都道府県・市区町村の入札公告を毎日更新。新しい公告を公告日順に、締切日（公告文から読み取り）と元の公告へのリンクつきで無料公開。`,
    path: 'koukoku/',
    body,
    ld: [bc.ld],
  });
}

export function renderDate(ctx, d) {
  const list = ctx.byDate.get(d) || [];
  const bc = breadcrumbs([['トップ', ''], ['新着の入札公告', 'koukoku/'], [jpDate(d), null]]);
  const i = ctx.recentDates.indexOf(d);
  const newer = i > 0 ? ctx.recentDates[i - 1] : null;
  const older = i >= 0 && i < ctx.recentDates.length - 1 ? ctx.recentDates[i + 1] : null;
  const groups = new Map();
  for (const n of list) { const k = n.p || 0; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
  const sections = [...groups.keys()].sort((a, b) => (a || 99) - (b || 99)).map((p) => {
    const l = groups.get(p).sort((a, b) => a.o.localeCompare(b.o, 'ja') || byIssue(a, b));
    const name = PREF_BY_CODE.get(p)?.name || '都道府県なし';
    return `<section class="sec"><h2 id="p${p}">${esc(name)}（${comma(l.length)}件）</h2>${noticeList(l, ctx)}</section>`;
  }).join('\n');
  const nav = `<p class="jump">${newer ? `<a href="${href(datePath(newer))}">← ${jpDate(newer, { year: false })}</a>` : ''}${older ? `<a href="${href(datePath(older))}">${jpDate(older, { year: false })} →</a>` : ''}</p>`;
  const body = `${bc.html}
<header class="ph"><h1>${jpDate(d, { weekday: true })}の入札公告（${comma(list.length)}件）</h1>
<p class="lead">${jpDate(d)}が公告日の入札公告を、都道府県ごとに並べています（官公需情報ポータルサイトに載ったもの）。</p></header>
${nav}
<div class="chips">${[...groups.keys()].sort((a, b) => (a || 99) - (b || 99)).map((p) => `<a href="#p${p}">${esc(PREF_BY_CODE.get(p)?.short || 'なし')} <small>${groups.get(p).length}</small></a>`).join('')}</div>
${KKJ_NOTE}
${sections}
${nav}`;
  return layout({
    title: `${jpDate(d)}の入札公告一覧（${comma(list.length)}件）｜${SITE_NAME}`,
    description: `${jpDate(d)}に公告された国・都道府県・市区町村の入札公告${comma(list.length)}件。工事・物品・役務の公告を都道府県ごとに、元の公告へのリンクつきで。`,
    path: datePath(d),
    body,
    ld: [bc.ld],
  });
}

export function renderShimekiri(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['締切が近い入札公告', null]]);
  const until = ctx.addDays(ctx.today, 2);
  const list = ctx.open.filter((n) => n.dl && n.dl <= until).sort(byDeadline);
  const groups = new Map();
  for (const n of list) { if (!groups.has(n.dl)) groups.set(n.dl, []); groups.get(n.dl).push(n); }
  const week = ctx.open.filter((n) => n.dl && n.dl <= ctx.addDays(ctx.today, 7)).length;
  const body = `${bc.html}
<header class="ph"><h1>締切が近い入札公告</h1>
<p class="lead">公告文から読み取った締切・開札の日付が、今日（${jpDate(ctx.today, { weekday: true })}）から3日以内の入札公告です（${comma(list.length)}件）。7日以内では${comma(week)}件あります。地域ごとの一覧は<a href="${href('ken/')}">都道府県のページ</a>から見られます。</p></header>
${KKJ_NOTE}
${[...groups.keys()].map((d) => `<section class="sec"><h2>${jpDate(d, { year: false, weekday: true })}（${comma(groups.get(d).length)}件）</h2>${noticeList(groups.get(d), ctx, { showPref: true })}</section>`).join('\n')}`;
  return layout({
    title: `締切が近い入札公告（3日以内・${comma(list.length)}件）｜${SITE_NAME}`,
    description: `締切・開札が近い国・自治体の入札公告を毎日更新。締切日ごとに、発注機関・分類・元の公告へのリンクつきで一覧にしています。`,
    path: 'shimekiri/',
    body,
    ld: [bc.ld],
  });
}

export function renderPrefIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['都道府県から探す', null]]);
  const regions = [['北海道・東北', 1, 7], ['関東', 8, 14], ['中部', 15, 23], ['近畿', 24, 30], ['中国・四国', 31, 39], ['九州・沖縄', 40, 47]];
  const body = `${bc.html}
<header class="ph"><h1>都道府県から入札情報を探す</h1>
<p class="lead">都道府県を選ぶと、その都道府県にある国の機関・都道府県・市区町村などの入札公告のうち、締切前のものと、機関ごとのページが見られます。数字は締切前の公告の件数です。</p></header>
${regions.map(([name, a, b]) => `<section class="sec"><h2>${name}</h2><ul class="grid">${PREFS.filter((p) => p.code >= a && p.code <= b).map((p) => `<li><a href="${href(prefPath(p))}">${p.name}<small>${comma(ctx.byPrefOpen.get(p.code).length)}</small></a></li>`).join('')}</ul></section>`).join('\n')}`;
  return layout({
    title: `都道府県から入札情報を探す｜${SITE_NAME}`,
    description: '47都道府県ごとに、国・県・市区町村の入札公告（締切前のもの）と発注機関の一覧。毎日更新、無料。',
    path: 'ken/',
    body,
    ld: [bc.ld],
  });
}

export function renderPref(ctx, p) {
  const bc = breadcrumbs([['トップ', ''], ['都道府県から探す', 'ken/'], [p.name, null]]);
  const open = ctx.byPrefOpen.get(p.code).slice().sort(byIssue);
  const all = ctx.byPref.get(p.code);
  const cc = catCounts(open, ctx);
  const orgs = ctx.orgList.filter((o) => o.pref === p.code);
  const groups = [['pref', '都道府県'], ['city', '市区町村'], ['local', '企業局・一部事務組合など'], ['national', '国の機関'], ['quasi', '独立行政法人・国立大学法人など'], ['other', 'その他']];
  const orgSections = groups.map(([type, label]) => {
    const l = orgs.filter((o) => o.type === type).sort((a, b) => b.open - a.open || b.notices.length - a.notices.length || a.label.localeCompare(b.label, 'ja'));
    return l.length ? `<p class="sub">${label}（${l.length}）</p>${orgGrid(l)}` : '';
  }).join('');
  const shown = open.slice(0, CAP);
  const body = `${bc.html}
<header class="ph"><h1>${p.name}の入札情報（入札公告・締切一覧）</h1>
<p class="lead">${p.name}にある国の機関・${p.name}・市区町村などが出した入札公告のうち、締切前（または締切日が読み取れず公告から30日以内）のものが<b>${comma(open.length)}件</b>あります（工事${comma(cc.get('工事'))}件・物品${comma(cc.get('物品'))}件・役務${comma(cc.get('役務'))}件）。直近1年の公告は${comma(all.length)}件です。</p></header>
<div class="chips">${CATEGORIES.map((c) => `<a href="${href(prefPath(p, c))}">${p.name}の${c.key} <small>${comma(cc.get(c.key))}</small></a>`).join('')}</div>
<section class="sec"><h2>機関から探す</h2>
<p class="note">数字は締切前の公告の件数です。締切を過ぎた公告は、機関ごとのページに載せています。</p>
${orgSections || '<p class="note">まだ公告がありません。</p>'}</section>
<section class="sec"><h2>締切前の入札公告（新しい順${open.length > CAP ? `に${CAP}件` : ''}）</h2>
${KKJ_NOTE}
${noticeList(shown, ctx)}
${open.length > CAP ? `<p class="more">ほかの公告は、上の機関ごとのページか、分類ごとのページでご覧ください。</p>` : ''}</section>`;
  return layout({
    title: `${p.name}の入札情報・入札公告一覧（国・県・市町村）｜${SITE_NAME}`,
    description: `${p.name}の入札公告（締切前${comma(open.length)}件）を毎日更新。${p.name}・市区町村・国の出先機関の工事・物品・役務の入札情報を、締切日と元の公告へのリンクつきで。`,
    path: prefPath(p),
    body,
    ld: [bc.ld],
  });
}

export function renderPrefCat(ctx, p, c) {
  const bc = breadcrumbs([['トップ', ''], ['都道府県から探す', 'ken/'], [p.name, prefPath(p)], [c.key, null]]);
  const list = ctx.byPrefOpen.get(p.code).filter((n) => ctx.catOf(n) === c.key).sort(byIssue);
  const shown = list.slice(0, CAP);
  const body = `${bc.html}
<header class="ph"><h1>${p.name}の${c.key}の入札情報</h1>
<p class="lead">${p.name}にある機関が出した、${c.key}の入札公告のうち締切前のもの${comma(list.length)}件です${list.length > CAP ? `（新しい順に${CAP}件を表示）` : ''}。分類は官公需ポータルの値で、ないものは件名から当サイトが推定しています。</p></header>
<div class="chips">${CATEGORIES.map((x) => (x.key === c.key ? `<span>${x.key}</span>` : `<a href="${href(prefPath(p, x))}">${x.key}</a>`)).join('')}<a href="${href(prefPath(p))}">${p.name}のすべて</a></div>
${KKJ_NOTE}
${noticeList(shown, ctx)}`;
  return layout({
    title: `${p.name}の${c.key}の入札情報・入札公告｜${SITE_NAME}`,
    description: `${p.name}の${c.key}の入札公告（締切前${comma(list.length)}件）。国・${p.name}・市区町村の公告を、締切日と元の公告へのリンクつきで毎日更新。`,
    path: prefPath(p, c),
    body,
    ld: [bc.ld],
  });
}

export function renderCat(ctx, c) {
  const bc = breadcrumbs([['トップ', ''], [`${c.key}の入札情報`, null]]);
  const list = ctx.open.filter((n) => ctx.catOf(n) === c.key).sort(byIssue);
  const counts = new Map(PREFS.map((p) => [p.code, 0]));
  for (const n of list) if (counts.has(n.p)) counts.set(n.p, counts.get(n.p) + 1);
  const body = `${bc.html}
<header class="ph"><h1>${c.key}の入札情報（全国）</h1>
<p class="lead">全国の国の機関・自治体などが出した${c.key}の入札公告のうち、締切前のものが${comma(list.length)}件あります。新しい順に${Math.min(CAP, list.length)}件を載せています。都道府県ごとの一覧もあります。</p></header>
<section class="sec"><h2>都道府県から探す</h2><ul class="grid">${PREFS.map((p) => `<li><a href="${href(prefPath(p, c))}">${p.short}<small>${comma(counts.get(p.code))}</small></a></li>`).join('')}</ul></section>
<section class="sec"><h2>新しい${c.key}の公告</h2>
${KKJ_NOTE}
${noticeList(list.slice(0, CAP), ctx, { showPref: true })}</section>`;
  return layout({
    title: `${c.key}の入札情報・入札公告一覧（全国）｜${SITE_NAME}`,
    description: `全国の${c.key}の入札公告（締切前${comma(list.length)}件）を毎日更新。都道府県別の一覧、締切日、元の公告へのリンクつき。`,
    path: catPath(c),
    body,
    ld: [bc.ld],
  });
}

export function renderOrgIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['機関から探す', null]]);
  const nat = ctx.orgList.filter((o) => o.type === 'national').sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ja'));
  const quasi = ctx.orgList.filter((o) => o.type === 'quasi').sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ja')).slice(0, 300);
  const body = `${bc.html}
<header class="ph"><h1>機関から入札情報を探す</h1>
<p class="lead">公告を出した機関（${comma(ctx.orgs.size)}機関）ごとのページがあります。都道府県・市区町村などは<a href="${href('ken/')}">都道府県のページ</a>から、国の機関と独立行政法人などはこのページから選べます。数字は締切前の公告の件数です。</p></header>
<section class="sec"><h2>国の機関（${nat.length}）</h2>${orgGrid(nat)}</section>
<section class="sec"><h2>独立行政法人・国立大学法人など（公告の多い順に${quasi.length}）</h2>${orgGrid(quasi)}</section>
<section class="sec"><h2>都道府県から探す</h2><ul class="grid">${PREFS.map((p) => `<li><a href="${href(prefPath(p))}">${p.name}</a></li>`).join('')}</ul></section>`;
  return layout({
    title: `機関から入札情報を探す（国・独法・自治体）｜${SITE_NAME}`,
    description: '国の機関・独立行政法人・国立大学法人・都道府県・市区町村ごとの入札公告ページの一覧。',
    path: 'kikan/',
    body,
    ld: [bc.ld],
  });
}

export function renderOrg(ctx, o) {
  const p = PREF_BY_CODE.get(o.pref);
  const bc = breadcrumbs([['トップ', ''], ...(p ? [[p.name, prefPath(p)]] : [['機関から探す', 'kikan/']]), [o.label, null]]);
  const open = [];
  const closed = [];
  for (const n of o.notices) (noticeStatus(n, ctx.today).open ? open : closed).push(n);
  open.sort((a, b) => (a.dl && b.dl ? byDeadline(a, b) : a.dl ? -1 : b.dl ? 1 : byIssue(a, b)));
  closed.sort(byIssue);
  const cc = catCounts(o.notices, ctx);
  const neighbors = p ? ctx.orgList.filter((x) => x.pref === p.code && x.id !== o.id && (x.type === o.type || x.type === 'pref')).slice(0, 24) : [];
  const url = abs(orgPath(o.id));
  const first = o.notices[o.notices.length - 1]?.d;
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">${o.type === 'national' ? '国の機関' : o.type === 'quasi' ? '独立行政法人など' : p ? esc(p.name) : ''}の入札公告</p>
<h1>${esc(o.label)}の入札情報（入札公告一覧）</h1>
<p class="lead">${esc(o.name)}が出した入札公告を、官公需情報ポータルサイトから集めて並べています。締切前（または締切日が読み取れず公告から30日以内）の公告は<b>${comma(open.length)}件</b>、直近30日の公告は${comma(o.recent)}件です（${jpDate(first)}以降の合計${comma(o.notices.length)}件：工事${comma(cc.get('工事'))}・物品${comma(cc.get('物品'))}・役務${comma(cc.get('役務'))}）。</p></header>
${o.agency ? `<p class="callout">${esc(o.agency.name)}の<b>落札結果</b>（落札した会社・落札額）は <a href="${href(agencyPath(o.agency))}">${esc(o.agency.name)}の落札結果</a> にまとめています。</p>` : ''}
${shareButtons(url, `${o.label}の入札情報`)}
<section class="sec"><h2>締切前の公告（${comma(open.length)}件）</h2>
${KKJ_NOTE}
${noticeList(open.slice(0, CAP), ctx, { showOrg: false })}</section>
<section class="sec"><h2>締切を過ぎた公告（新しい順${closed.length > 100 ? 'に100件' : ''}）</h2>
<p class="note">元の公告は、発注機関のサイトから消えていることがあります。</p>
${noticeList(closed.slice(0, 100), ctx, { showOrg: false })}</section>
${neighbors.length ? `<section class="sec"><h2>${esc(p.name)}のほかの機関</h2>${orgGrid(neighbors)}<p class="more"><a href="${href(prefPath(p))}">${esc(p.name)}の入札情報をすべて見る →</a></p></section>` : ''}`;
  return layout({
    title: `${o.label}の入札情報・入札公告一覧｜${SITE_NAME}`,
    description: `${o.name}の入札公告（締切前${comma(open.length)}件）を毎日更新。工事・物品・役務の公告を、締切日（公告文から読み取り）と元の公告へのリンクつきで一覧に。`,
    path: orgPath(o.id),
    body,
    ld: [bc.ld],
  });
}
