// 会社ページ（法人番号ごと）：国の機関の入札で落札した実績
import { SITE_NAME, AGENCY_BY_CODE, TOPICS } from '../lib/meta.mjs';
import { esc, comma, yen, yenShort, jpDate, fyLabel, shortName, truncate } from '../lib/format.mjs';
import { layout, breadcrumbs, href, abs, companyPath, agencyPath, topicPath, rankPath, awardTable, shareButtons } from '../lib/html.mjs';

const TOPIC = new Map(TOPICS.map((t) => [t.slug, t]));
const fyOf = (d) => (+d.slice(5, 7) >= 4 ? +d.slice(0, 4) : +d.slice(0, 4) - 1);

function facts(c) {
  const ags = [...c.ag.entries()].sort((a, b) => b[1].c - a[1].c || b[1].s - a[1].s);
  const tps = [...c.tp.entries()].sort((a, b) => b[1].c - a[1].c || b[1].s - a[1].s);
  const fys = [...c.fy.keys()].sort((a, b) => a - b);
  const excluded = c.awards.filter((a) => a.k).length;
  return { ags, tps, fys, firstFy: fys[0], lastFy: fys[fys.length - 1], excluded, latest: c.awards[0] };
}

function lead(c, f) {
  const ag0 = AGENCY_BY_CODE.get(f.ags[0][0]);
  const agName = ag0 ? ag0.name : f.ags[0][0];
  if (c.c === 1) {
    const a = c.awards[0];
    return `${esc(c.name)}は、${jpDate(a.d)}に${esc(agName)}の「${esc(truncate(a.t, 60))}」を落札しています（落札額 ${a.k === 'unit' ? `単価 ${yen(a.y)}` : yen(a.y)}）。`;
  }
  const span = f.firstFy === f.lastFy ? `${fyLabel(f.firstFy)}に` : `${fyLabel(f.firstFy)}から${fyLabel(f.lastFy)}までに`;
  let s = `${esc(c.name)}は、${span}国の機関の入札で<b>${comma(c.c)}件</b>を落札しています。`;
  if (c.s > 0) s += `落札額の合計は<b>${yenShort(c.s)}</b>です${f.excluded ? `（売払い・単価で記録された${comma(f.excluded)}件を除く）` : ''}。`;
  s += f.ags.length > 1
    ? `最も多いのは${esc(agName)}（${comma(f.ags[0][1].c)}件）で、ほかに${f.ags.slice(1, 3).map(([code, x]) => `${esc(AGENCY_BY_CODE.get(code)?.name || code)}（${comma(x.c)}件）`).join('、')}などがあります。`
    : `すべて${esc(agName)}の案件です。`;
  s += `直近の落札は${jpDate(f.latest.d)}の「${esc(truncate(f.latest.t, 50))}」です。`;
  return s;
}

function sideLists(c, ctx, f) {
  const blocks = [];
  const tp0 = f.tps[0];
  if (tp0) {
    const t = ctx.topicAgg.get(tp0[0]);
    const list = t.topCo.filter((r) => r.co.n !== c.n).slice(0, 8);
    if (list.length) blocks.push(`<div class="mini"><h3>「${esc(t.name)}」で国の落札が多い会社</h3><ol>${list.map((r, i) => `<li><span>${i + 1}</span><a href="${href(companyPath(r.co.n))}">${esc(r.co.name)}</a><em>${comma(r.c)}件</em></li>`).join('')}</ol><p class="more"><a href="${href(topicPath(t))}">${esc(t.name)}の入札情報・落札実績 →</a></p></div>`);
  }
  const ag0 = ctx.agencies.get(f.ags[0][0]);
  if (ag0) {
    const list = ag0.topCoCount.filter((r) => r.co.n !== c.n).slice(0, 8);
    if (list.length) blocks.push(`<div class="mini"><h3>${esc(ag0.name)}で落札の多い会社</h3><ol>${list.map((r, i) => `<li><span>${i + 1}</span><a href="${href(companyPath(r.co.n))}">${esc(r.co.name)}</a><em>${comma(r.c)}件</em></li>`).join('')}</ol><p class="more"><a href="${href(agencyPath(ag0))}">${esc(ag0.name)}の落札結果 →</a></p></div>`);
  }
  return blocks.length ? `<section class="sec"><h2>同じ分野・同じ府省の会社</h2><div class="minis">${blocks.join('')}</div></section>` : '';
}

function header(c, ctx, f, titleText) {
  const bc = breadcrumbs([['トップ', ''], ['落札額ランキング', rankPath()], [c.name, titleText ? companyPath(c.n) : null], ...(titleText ? [[titleText, null]] : [])]);
  return bc;
}

export function renderCompany(c, ctx, mainRows) {
  const f = facts(c);
  const bc = header(c, ctx, f);
  const names = [...c.names.entries()].sort((a, b) => (a[1].last < b[1].last ? 1 : -1));
  const rows = c.split ? c.awards.slice(0, mainRows) : c.awards;
  const ags = f.ags.map(([code, x]) => {
    const ag = ctx.agencies.get(code);
    return `<tr><th><a href="${href(agencyPath(ag))}">${esc(ag.name)}</a></th><td>${comma(x.c)}件</td><td>${x.s ? yenShort(x.s) : '—'}</td></tr>`;
  }).join('');
  const fyRows = [...f.fys].reverse().map((y) => {
    const x = c.fy.get(y);
    const label = c.split ? `<a href="${href(companyPath(c.n, y))}">${fyLabel(y)}</a>` : fyLabel(y);
    return `<tr><th>${label}</th><td>${comma(x.c)}件</td><td>${x.s ? yenShort(x.s) : '—'}</td></tr>`;
  }).join('');
  const tps = f.tps.slice(0, 12).map(([slug, x]) => `<a href="${href(topicPath(TOPIC.get(slug)))}">${esc(TOPIC.get(slug).name)} <small>${comma(x.c)}件</small></a>`).join('');
  const badges = (c.badges || []).sort((a, b) => b.fy - a.fy).slice(0, 4)
    .map((b) => `<li><a href="${href(rankPath(b.fy))}">${fyLabel(b.fy)}の落札額ランキング</a><b>${b.rank}位</b></li>`).join('');
  const short = shortName(c.name);
  const ag0 = AGENCY_BY_CODE.get(f.ags[0][0]);
  const desc = `${c.name}（法人番号${c.n}）が国の機関の入札で落札した${comma(c.c)}件の一覧（${fyLabel(f.firstFy)}〜）。${c.s ? `落札額の合計${yenShort(c.s)}、` : ''}府省別・年度別の内訳と、最近の落札案件。`;
  const url = abs(companyPath(c.n));
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">国の機関の入札での落札実績（${fyLabel(f.firstFy)}〜）</p>
<h1>${esc(c.name)}の落札実績</h1>
<p class="lead">${lead(c, f)}</p></header>
<section class="card stats">
<dl class="kpi"><div><dt>落札件数</dt><dd><b>${comma(c.c)}</b>件</dd></div><div><dt>落札額の合計</dt><dd><b>${c.s ? yenShort(c.s) : '—'}</b></dd></div><div><dt>最新の落札</dt><dd><b>${jpDate(c.last)}</b></dd></div><div><dt>主な府省</dt><dd><b>${esc(ag0?.name || '')}</b></dd></div></dl>
<dl class="dl"><div><dt>法人番号</dt><dd>${c.n}<span class="dd-l"><a href="https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${c.n}" rel="noopener">国税庁 法人番号公表サイトで見る</a>　<a href="https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${c.n}" rel="noopener">gBizINFOで見る</a></span></dd></div>
${names.length > 1 ? `<div><dt>落札時の名前</dt><dd>${names.map(([nm, x]) => `${esc(nm)}（${x.first.slice(0, 4)}〜${x.last.slice(0, 4)}年、${comma(x.c)}件）`).join('<br>')}</dd></div>` : ''}
</dl>
${badges ? `<ul class="badges">${badges}</ul>` : ''}
<p class="note">落札額の合計は、記録された落札価格を足したものです。複数年度にわたる契約は落札した年度にまとめて入り、単価契約で単価が記録されたものと売払い（国から買い受けたもの）は合計に入れていません。</p>
</section>
${shareButtons(url, `${c.name}の国の落札実績（${comma(c.c)}件）`)}
<section class="sec"><h2>年度ごとの落札</h2>
<div class="tw"><table class="dt"><thead><tr><th>年度</th><th>件数</th><th>落札額の合計</th></tr></thead><tbody>${fyRows}</tbody></table></div></section>
<section class="sec"><h2>府省ごとの落札</h2>
<div class="tw"><table class="dt"><thead><tr><th>府省</th><th>件数</th><th>落札額の合計</th></tr></thead><tbody>${ags}</tbody></table></div>
${tps ? `<p class="sub">件名から見た分野</p><div class="chips">${tps}</div>` : ''}</section>
${c.c > 5 ? `<section class="sec"><h2>落札額が大きい案件</h2>
${awardTable(c.awards.filter((a) => !a.k).slice().sort((a, b) => b.y - a.y).slice(0, 5), { show: 'agency' })}</section>` : ''}
<section class="sec" id="list"><h2>${c.split ? `最近の落札（新しい順に${comma(rows.length)}件）` : `落札した案件（${comma(rows.length)}件）`}</h2>
${c.split ? `<p class="note">全${comma(c.c)}件は年度ごとのページで見られます：${[...f.fys].reverse().map((y) => `<a href="${href(companyPath(c.n, y))}">${fyLabel(y)}</a>`).join('・')}</p>` : ''}
${awardTable(rows, { show: 'agency' })}
<p class="note">案件の詳しい内容（公告・落札者等の公示）は、<a href="https://www.p-portal.go.jp/pps-web-biz/UAA01/OAA0101" rel="noopener">調達ポータルの調達情報検索</a>で「調達案件番号」を入れると確認できます（公開期間が過ぎたものは表示されないことがあります）。</p></section>
${sideLists(c, ctx, f)}
<section class="sec faq"><h2>よくある質問</h2>
<h3>${esc(short)}は国の入札で何件落札していますか？</h3>
<p>調達ポータルの落札実績オープンデータでは、${fyLabel(f.firstFy)}から${jpDate(ctx.ppInfo.latestDate)}までに${comma(c.c)}件です${c.s ? `（落札額の合計${yenShort(c.s)}）` : ''}。</p>
<h3>${esc(short)}が最も多く落札している府省はどこですか？</h3>
<p>${esc(ag0?.name || '')}で、${comma(f.ags[0][1].c)}件です。</p>
<h3>自治体（都道府県・市区町村）の入札の落札も含まれますか？</h3>
<p>含まれません。国の機関（府省など）が政府電子調達システム（GEPS）で行った入札・見積り合わせの落札だけです。自治体の入札結果は、各自治体の入札情報サービスなどをご確認ください。</p>
</section>`;
  return layout({
    title: `${c.name}の落札実績（国の入札${comma(c.c)}件）｜${SITE_NAME}`,
    description: desc,
    path: companyPath(c.n),
    body,
    ld: [bc.ld],
  });
}

export function renderCompanyYear(c, ctx, fy) {
  const f = facts(c);
  const list = c.awards.filter((a) => fyOf(a.d) === fy);
  const x = c.fy.get(fy);
  const bc = header(c, ctx, f, fyLabel(fy));
  const others = [...f.fys].reverse().map((y) => (y === fy ? `<span>${fyLabel(y)}</span>` : `<a href="${href(companyPath(c.n, y))}">${fyLabel(y)}</a>`)).join('');
  const body = `${bc.html}
<header class="ph"><p class="eyebrow"><a href="${href(companyPath(c.n))}">${esc(c.name)}の落札実績</a></p>
<h1>${esc(c.name)}の${fyLabel(fy)}の落札</h1>
<p class="lead">${fyLabel(fy)}（${fy}年4月〜${fy + 1}年3月）に、${esc(c.name)}が国の機関の入札で落札した${comma(x.c)}件です${x.s ? `（落札額の合計${yenShort(x.s)}）` : ''}。</p></header>
<div class="chips">${others}</div>
${awardTable(list, { show: 'agency' })}
<p class="note">案件の詳しい内容は、<a href="https://www.p-portal.go.jp/pps-web-biz/UAA01/OAA0101" rel="noopener">調達ポータルの調達情報検索</a>で「調達案件番号」を入れると確認できます。</p>`;
  return layout({
    title: `${c.name}の${fyLabel(fy)}の落札実績（${comma(x.c)}件）｜${SITE_NAME}`,
    description: `${c.name}が${fyLabel(fy)}に国の機関の入札で落札した${comma(x.c)}件の一覧。件名・府省・落札日・落札額。`,
    path: companyPath(c.n, fy),
    body,
    ld: [bc.ld],
  });
}
