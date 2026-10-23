// 府省ページ：国の機関ごとの落札結果
import { SITE_NAME, TOPICS, SOURCES } from '../lib/meta.mjs';
import { esc, comma, yenShort, jpDate, fyLabel, fyReiwa } from '../lib/format.mjs';
import { layout, breadcrumbs, href, abs, companyPath, agencyPath, topicPath, orgPath, awardTable, companyRank, pager, shareButtons } from '../lib/html.mjs';

const TOPIC = new Map(TOPICS.map((t) => [t.slug, t]));
const rankRows = (list, n, value = 's') => list.slice(0, n).map((r) => ({
  name: r.co.name, path: companyPath(r.co.n), value: value === 's' ? (r.s ? yenShort(r.s) : '—') : yenShort(r.s), count: r.c,
}));

export function renderAgencyIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['府省の落札結果', null]]);
  const list = [...ctx.agencies.values()].filter((a) => a.awards.length).sort((a, b) => b.awards.length - a.awards.length);
  const rows = list.map((a) => {
    const cur = a.fy.get(ctx.currentFy);
    const sum = [...a.fy.values()].reduce((s, x) => s + x.s, 0);
    return `<tr><th><a href="${href(agencyPath(a))}">${esc(a.name)}</a>${a.note ? `<small>${esc(a.note)}</small>` : ''}</th><td>${comma(a.awards.length)}件</td><td>${yenShort(sum)}</td><td>${cur ? `${comma(cur.c)}件` : '—'}</td></tr>`;
  }).join('\n');
  const body = `${bc.html}
<header class="ph"><h1>府省の落札結果（国の機関の入札）</h1>
<p class="lead">国の機関（府省など）が政府電子調達システムで行った入札の落札結果を、府省ごとにまとめています。${fyLabel(ctx.fys[ctx.fys.length - 1])}から${jpDate(ctx.ppInfo.latestDate)}までの${comma(ctx.awards.length)}件。府省を選ぶと、落札の多い会社や最近の落札案件が見られます。</p></header>
<div class="tw"><table class="dt dt-l"><thead><tr><th>府省</th><th>件数</th><th>落札額の合計</th><th>${fyLabel(ctx.currentFy)}</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<p class="note">府省の名前は、データの「府省等のコード」と件名から当サイトが判定しています。地方の出先機関（地方整備局・労働局・税関など）は、それぞれの府省に含まれます。独立行政法人・国立大学法人・自治体の入札は含まれません。</p>`;
  return layout({
    title: `府省の落札結果一覧（国の入札・${comma(ctx.awards.length)}件）｜${SITE_NAME}`,
    description: `国土交通省・防衛省・厚生労働省など国の機関の入札の落札結果を府省ごとに無料で。落札の多い会社、年度ごとの件数と落札額、最近の落札案件。`,
    path: 'fusho/',
    body,
    ld: [bc.ld],
  });
}

export function renderAgency(ctx, ag) {
  const bc = breadcrumbs([['トップ', ''], ['府省の落札結果', 'fusho/'], [ag.name, null]]);
  const fys = [...ag.fy.keys()].sort((a, b) => b - a);
  const sum = [...ag.fy.values()].reduce((s, x) => s + x.s, 0);
  const cur = ctx.currentFy;
  const curCo = new Map();
  for (const a of ag.awards) {
    if (a.fy !== cur || !a.n) continue;
    const x = curCo.get(a.n) || curCo.set(a.n, { c: 0, s: 0 }).get(a.n);
    x.c++;
    if (!a.k) x.s += a.y;
  }
  const curList = ctx.rankOf(curCo).sort(ctx.byAmount);
  const fyRows = fys.map((y) => {
    const x = ag.fy.get(y);
    return `<tr><th><a href="${href(agencyPath(ag, y))}">${fyLabel(y)}</a><small>${fyReiwa(y)}</small></th><td>${comma(x.c)}件</td><td>${yenShort(x.s)}</td></tr>`;
  }).join('');
  const topics = [...ag.topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
    .map(([slug, n]) => `<a href="${href(topicPath(TOPIC.get(slug)))}">${esc(TOPIC.get(slug).name)} <small>${comma(n)}件</small></a>`).join('');
  const orgs = ctx.orgList.filter((o) => o.agency && o.agency.code === ag.code).slice(0, 40);
  const latest = ag.awards.slice(0, 100);
  const top = ag.topCo[0];
  const url = abs(agencyPath(ag));
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">国の機関の落札結果</p>
<h1>${esc(ag.name)}の落札結果・落札企業</h1>
<p class="lead">${esc(ag.name)}${ag.note ? `（${esc(ag.note)}）` : ''}が政府電子調達システムで行った入札の落札結果です。${fyLabel(fys[fys.length - 1])}から${jpDate(ag.awards[0].d)}までに${comma(ag.awards.length)}件、落札額の合計は${yenShort(sum)}。${top ? `落札額が最も多い会社は${esc(top.co.name)}（${comma(top.c)}件・${yenShort(top.s)}）です。` : ''}</p></header>
${shareButtons(url, `${ag.name}の落札結果・落札企業`)}
<section class="sec"><h2>最近の落札（新しい順に100件）</h2>
${awardTable(latest, { show: 'winner', companyLink: ctx.companyLink })}
<p class="more">年度ごとの全件：${fys.map((y) => `<a href="${href(agencyPath(ag, y))}">${fyLabel(y)}</a>`).join('・')}</p></section>
<section class="sec"><h2>${fyLabel(cur)}に落札額が多い会社</h2>
${companyRank(rankRows(curList, 20))}</section>
<section class="sec"><h2>落札額が多い会社（${fyLabel(fys[fys.length - 1])}以降の合計）</h2>
${companyRank(rankRows(ag.topCo, 30))}</section>
<section class="sec"><h2>落札件数が多い会社</h2>
${companyRank(ag.topCoCount.slice(0, 20).map((r) => ({ name: r.co.name, path: companyPath(r.co.n), value: yenShort(r.s), count: r.c })))}</section>
<section class="sec"><h2>年度ごとの件数と落札額</h2>
<div class="tw"><table class="dt"><thead><tr><th>年度</th><th>件数</th><th>落札額の合計</th></tr></thead><tbody>${fyRows}</tbody></table></div></section>
${topics ? `<section class="sec"><h2>多い分野</h2><div class="chips">${topics}</div></section>` : ''}
${orgs.length ? `<section class="sec"><h2>${esc(ag.name)}の入札公告（官公需ポータル）</h2><p class="note">これから入札がある案件は、機関ごとの公告ページで見られます。</p><ul class="grid grid-w">${orgs.map((o) => `<li><a href="${href(orgPath(o.id))}">${esc(o.label)}<small>${comma(o.open)}件</small></a></li>`).join('')}</ul></section>` : ''}
<p class="note">落札額の合計に、売払い（国が物を売ったもの）と、単価契約で単価だけが記録されたものは入れていません。データ：${esc(SOURCES.pportal.name)}の落札実績オープンデータ。</p>`;
  return layout({
    title: `${ag.name}の落札結果・落札企業一覧（${comma(ag.awards.length)}件）｜${SITE_NAME}`,
    description: `${ag.name}の入札の落札結果を無料で。落札額・件数が多い会社のランキング、年度ごとの落札額、最近の落札案件（落札者・落札額）を一覧に。`,
    path: agencyPath(ag),
    body,
    ld: [bc.ld],
  });
}

export function renderAgencyYear(ctx, ag, fy, list, page, pages, per) {
  const bc = breadcrumbs([['トップ', ''], ['府省の落札結果', 'fusho/'], [ag.name, agencyPath(ag)], [`${fyLabel(fy)}${pages > 1 ? `（${page}）` : ''}`, null]]);
  const x = ag.fy.get(fy);
  const rows = list.slice((page - 1) * per, page * per);
  const fys = [...ag.fy.keys()].sort((a, b) => b - a);
  let top = '';
  if (page === 1) {
    const co = new Map();
    for (const a of list) {
      if (!a.n) continue;
      const y = co.get(a.n) || co.set(a.n, { c: 0, s: 0 }).get(a.n);
      y.c++;
      if (!a.k) y.s += a.y;
    }
    top = `<section class="sec"><h2>${fyLabel(fy)}に落札額が多い会社</h2>${companyRank(ctx.rankOf(co).sort(ctx.byAmount).slice(0, 20).map((r) => ({ name: r.co.name, path: companyPath(r.co.n), value: yenShort(r.s), count: r.c })))}</section>`;
  }
  const body = `${bc.html}
<header class="ph"><p class="eyebrow"><a href="${href(agencyPath(ag))}">${esc(ag.name)}の落札結果</a></p>
<h1>${esc(ag.name)}の${fyLabel(fy)}の落札結果${pages > 1 ? `（${page}/${pages}ページ）` : ''}</h1>
<p class="lead">${fyLabel(fy)}（${fyReiwa(fy)}、${fy}年4月〜${fy + 1}年3月）に${esc(ag.name)}で落札が決まった${comma(x.c)}件です（落札額の合計${yenShort(x.s)}）。新しい順に並べています。</p></header>
<div class="chips">${fys.map((y) => (y === fy ? `<span>${fyLabel(y)}</span>` : `<a href="${href(agencyPath(ag, y))}">${fyLabel(y)}</a>`)).join('')}</div>
${top}
<section class="sec"><h2>落札した案件${pages > 1 ? `（${comma((page - 1) * per + 1)}〜${comma((page - 1) * per + rows.length)}件目）` : ''}</h2>
${awardTable(rows, { show: 'winner', companyLink: ctx.companyLink })}
${pager(agencyPath(ag, fy), page, pages)}</section>`;
  return layout({
    title: `${ag.name}の${fyLabel(fy)}の落札結果一覧${pages > 1 ? `（${page}）` : ''}｜${SITE_NAME}`,
    description: `${ag.name}の${fyLabel(fy)}（${fyReiwa(fy)}）の入札の落札結果${comma(x.c)}件。件名・落札者・落札日・落札額の一覧と、落札額の多い会社。`,
    path: agencyPath(ag, fy, page),
    body,
    ld: [bc.ld],
  });
}
