// トップ・分野・ランキング・検索・このサイトについて
import { SITE_NAME, OPERATOR, OPERATOR_ID, CONTACT, SOURCES, PREFS, CATEGORIES, TOPICS } from '../lib/meta.mjs';
import { esc, comma, yenShort, jpDate, fyLabel, fyReiwa } from '../lib/format.mjs';
import {
  layout, breadcrumbs, href, abs, companyPath, agencyPath, prefPath, topicPath, catPath, rankPath, noticeList, awardTable, companyRank, buildInfo,
} from '../lib/html.mjs';

const byIssue = (a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.f < b.f ? 1 : a.f > b.f ? -1 : 0);
const rankRows = (list, n, start = 0) => list.slice(start, start + n).map((r) => ({ name: r.co.name, path: companyPath(r.co.n), value: yenShort(r.s), count: r.c }));

export function renderTop(ctx) {
  const soon = ctx.open.filter((n) => n.dl).sort((a, b) => (a.dl < b.dl ? -1 : a.dl > b.dl ? 1 : byIssue(a, b))).slice(0, 10);
  const latestDate = ctx.recentDates[0];
  const fresh = (ctx.byDate.get(latestDate) || []).slice().sort(byIssue).slice(0, 12);
  const agencies = [...ctx.agencies.values()].filter((a) => a.awards.length).sort((a, b) => b.awards.length - a.awards.length);
  const fyList = ctx.fyTop.get(ctx.lastFullFy) || [];
  const body = `<section class="hero">
<p class="hero-k">無料・登録なし・毎日更新</p>
<h1>入札<span>ノート</span></h1>
<p class="hero-l">国・都道府県・市区町村の<b>入札公告</b>と、国の機関の<b>落札実績${comma(ctx.awards.length)}件</b>を、発注機関・地域・分野・落札した会社ごとにまとめました。会社名で検索すると、その会社が国から落札した案件と金額がわかります。</p>
<form class="sb sb-big" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="会社名・機関名で検索" autocomplete="off" aria-label="会社名・機関名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<p class="hero-ex">例：<a href="${href(`search/?q=${encodeURIComponent('富士通')}`)}">富士通</a><a href="${href(agencyPath(ctx.agencies.get('U1')))}">防衛省の落札結果</a><a href="${href('ken/fukuoka/')}">福岡県の入札情報</a><a href="${href(topicPath(TOPICS[0]))}">清掃の入札</a></p>
</section>
<section class="kpis">
<div><b>${comma(ctx.open.length)}</b><span>締切前の公告</span></div>
<div><b>${comma((ctx.byDate.get(latestDate) || []).length)}</b><span>${jpDate(latestDate, { year: false })}の新着公告</span></div>
<div><b>${comma(ctx.awards.length)}</b><span>国の落札実績（件）</span></div>
<div><b>${comma(ctx.companies.size)}</b><span>落札した会社</span></div>
</section>
<section class="sec"><h2>締切が近い入札公告</h2>
${noticeList(soon, ctx, { showPref: true })}
<p class="more"><a href="${href('shimekiri/')}">締切が近い公告をすべて見る →</a></p></section>
<section class="sec"><h2>新着の入札公告（${jpDate(latestDate, { year: false })}）</h2>
${noticeList(fresh, ctx, { showPref: true })}
<p class="more"><a href="${href('koukoku/')}">新着の公告をもっと見る →</a></p></section>
<section class="sec"><h2>都道府県から探す</h2>
<ul class="grid">${PREFS.map((p) => `<li><a href="${href(prefPath(p))}">${p.short}<small>${comma(ctx.byPrefOpen.get(p.code).length)}</small></a></li>`).join('')}</ul>
<p class="note">数字は締切前の公告の件数。${CATEGORIES.map((c) => `<a href="${href(catPath(c))}">${c.key}の入札情報</a>`).join('・')}も見られます。</p></section>
<section class="sec"><h2>${fyLabel(ctx.lastFullFy)}に国から落札した額が多い会社</h2>
${companyRank(rankRows(fyList, 10))}
<p class="more"><a href="${href(rankPath(ctx.lastFullFy))}">${fyLabel(ctx.lastFullFy)}のランキングをもっと見る →</a>　<a href="${href(rankPath())}">ほかの年度・件数のランキング</a></p></section>
<section class="sec"><h2>府省の落札結果</h2>
<ul class="grid grid-m">${agencies.map((a) => `<li><a href="${href(agencyPath(a))}">${esc(a.name)}<small>${comma(a.awards.length)}</small></a></li>`).join('')}</ul></section>
<section class="sec"><h2>分野から探す</h2>
<ul class="grid grid-w">${TOPICS.map((t) => `<li><a href="${href(topicPath(t))}">${esc(t.name)}<small>${comma(ctx.topicAgg.get(t.slug).notices.length)}</small></a></li>`).join('')}</ul>
<p class="note">数字は締切前の公告の件数。分野は件名に含まれる語で当サイトが分けています。</p></section>
<section class="sec why card"><h2>このサイトについて</h2>
<p>入札の公告は国・自治体のサイトにばらばらに載り、「どの会社がいくらで落札したか」は、国のオープンデータ（CSV）を開かないとわかりません。有料の入札情報サービスで見るような情報を、${SITE_NAME}は国の公開データから自動でまとめ、無料で公開しています。</p>
<p>公告は<a href="${SOURCES.kkj.url}" rel="noopener">${SOURCES.kkj.name}</a>（${SOURCES.kkj.org}）の検索API、落札実績は<a href="${SOURCES.pportal.data}" rel="noopener">${SOURCES.pportal.name}</a>（${SOURCES.pportal.org}）の落札実績オープンデータを使っています。締切日は公告文から自動で読み取った目安なので、入札に参加するときは必ず元の公告をご確認ください。<a href="${href('about/')}">データと見方の説明 →</a></p></section>`;
  return layout({
    title: `${SITE_NAME}｜国・自治体の入札情報と落札結果を無料で（毎日更新）`,
    description: `国・都道府県・市区町村の入札公告（締切前${comma(ctx.open.length)}件）と、国の機関の落札実績${comma(ctx.awards.length)}件を、機関・地域・分野・落札企業ごとに無料公開。会社名で検索すると国から落札した案件と金額がわかります。`,
    path: '',
    body,
    ld: [{ '@type': 'WebSite', name: SITE_NAME, url: abs(''), inLanguage: 'ja', potentialAction: { '@type': 'SearchAction', target: `${abs('search/')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }],
  });
}

export function renderTopicIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['分野から探す', null]]);
  const rows = [...ctx.topicAgg.values()].map((t) => `<tr><th><a href="${href(topicPath(t))}">${esc(t.name)}</a><small>${esc(t.desc)}</small></th><td>${comma(t.notices.length)}件</td><td>${comma(t.awards.length)}件</td></tr>`).join('\n');
  const body = `${bc.html}
<header class="ph"><h1>分野から入札情報・落札実績を探す</h1>
<p class="lead">件名に含まれる語で、入札公告と国の落札実績を分野に分けました。1件が複数の分野に入ることがあります。</p></header>
<div class="tw"><table class="dt dt-l"><thead><tr><th>分野</th><th>締切前の公告</th><th>国の落札実績</th></tr></thead><tbody>
${rows}
</tbody></table></div>`;
  return layout({
    title: `分野から入札情報・落札実績を探す｜${SITE_NAME}`,
    description: '清掃・警備・電力・システム・印刷・建設コンサル・工事など、分野ごとの入札公告と国の落札実績（落札の多い会社）。',
    path: 'bunya/',
    body,
    ld: [bc.ld],
  });
}

export function renderTopic(ctx, t) {
  const bc = breadcrumbs([['トップ', ''], ['分野から探す', 'bunya/'], [t.name, null]]);
  const open = t.notices.slice().sort(byIssue);
  const prefCounts = new Map(PREFS.map((p) => [p.code, 0]));
  for (const n of open) if (prefCounts.has(n.p)) prefCounts.set(n.p, prefCounts.get(n.p) + 1);
  const cur = new Map();
  for (const a of t.awards) {
    if (a.fy !== ctx.lastFullFy || !a.n) continue;
    const x = cur.get(a.n) || cur.set(a.n, { c: 0, s: 0 }).get(a.n);
    x.c++;
    if (!a.k) x.s += a.y;
  }
  const curList = ctx.rankOf(cur).sort(ctx.byCount);
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">分野ごとの入札情報</p>
<h1>${esc(t.name)}の入札情報・落札実績</h1>
<p class="lead">件名に「${esc(t.desc)}」などの語を含む入札公告と、国の機関の落札実績をまとめました。締切前の公告は<b>${comma(open.length)}件</b>、国の落札実績は${comma(t.awards.length)}件です。</p></header>
<section class="sec"><h2>締切前の公告（新しい順${open.length > 200 ? 'に200件' : ''}）</h2>
<p class="note">都道府県ごとの件数：${PREFS.filter((p) => prefCounts.get(p.code)).map((p) => `<a href="${href(prefPath(p))}">${p.short}</a> ${prefCounts.get(p.code)}`).join('、') || 'なし'}</p>
${noticeList(open.slice(0, 200), ctx, { showPref: true })}</section>
<section class="sec"><h2>${fyLabel(ctx.lastFullFy)}に国の「${esc(t.name)}」を多く落札した会社</h2>
${companyRank(curList.slice(0, 20).map((r) => ({ name: r.co.name, path: companyPath(r.co.n), value: yenShort(r.s), count: r.c })))}</section>
<section class="sec"><h2>国の「${esc(t.name)}」の落札件数が多い会社（全期間）</h2>
${companyRank(t.topCo.slice(0, 30).map((r) => ({ name: r.co.name, path: companyPath(r.co.n), value: yenShort(r.s), count: r.c })))}</section>
<section class="sec"><h2>最近の国の落札（100件）</h2>
${awardTable(t.awards.slice(0, 100), { show: 'winner', companyLink: ctx.companyLink })}</section>`;
  return layout({
    title: `${t.name}の入札情報・落札実績（国・自治体）｜${SITE_NAME}`,
    description: `${t.name}の入札公告（締切前${comma(open.length)}件）と、国の${t.name}の落札実績${comma(t.awards.length)}件。落札の多い会社、最近の落札者と落札額を無料で。`,
    path: topicPath(t),
    body,
    ld: [bc.ld],
  });
}

const RANK_NOTE = '<p class="note">落札額は落札価格を足したものです。複数年度にわたる契約は落札した年度にまとめて入るため、その年度に国が支払った額ではありません。売払い（国が物を売ったもの）と、単価契約で単価だけが記録されたものは合計に入れていません。法人番号のない事業者は載せていません。</p>';

export function renderRankingIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['落札額ランキング', null]]);
  const all = ctx.coList.slice(0, 50).map((c) => ({ name: c.name, path: companyPath(c.n), value: yenShort(c.s), count: c.c }));
  const byCount = [...ctx.coList].sort((a, b) => b.c - a.c || b.s - a.s).slice(0, 50).map((c) => ({ name: c.name, path: companyPath(c.n), value: yenShort(c.s), count: c.c }));
  const body = `${bc.html}
<header class="ph"><h1>国の入札 落札額ランキング（会社別）</h1>
<p class="lead">国の機関（府省など）の入札で落札した額と件数を、会社（法人番号）ごとに足し上げたランキングです。${fyLabel(ctx.fys[ctx.fys.length - 1])}から${jpDate(ctx.ppInfo.latestDate)}までの${comma(ctx.awards.length)}件が対象です。</p></header>
<div class="chips">${ctx.fys.map((y) => `<a href="${href(rankPath(y))}">${fyLabel(y)}</a>`).join('')}</div>
${RANK_NOTE}
<section class="sec"><h2>${fyLabel(ctx.lastFullFy)}の落札額ランキング（上位30社）</h2>
${companyRank(rankRows(ctx.fyTop.get(ctx.lastFullFy) || [], 30))}
<p class="more"><a href="${href(rankPath(ctx.lastFullFy))}">300位まで見る →</a></p></section>
<section class="sec"><h2>${fyLabel(ctx.currentFy)}（${jpDate(ctx.ppInfo.latestDate)}まで）の落札額ランキング（上位30社）</h2>
${companyRank(rankRows(ctx.fyTop.get(ctx.currentFy) || [], 30))}
<p class="more"><a href="${href(rankPath(ctx.currentFy))}">300位まで見る →</a></p></section>
<section class="sec"><h2>落札件数ランキング（全期間・上位50社）</h2>
${companyRank(byCount)}</section>
<section class="sec"><h2>落札額ランキング（全期間・上位50社）</h2>
${companyRank(all)}</section>`;
  return layout({
    title: `国の入札 落札額ランキング（会社別・年度別）｜${SITE_NAME}`,
    description: `国の機関の入札で落札額・落札件数が多い会社のランキング。${fyLabel(ctx.lastFullFy)}・${fyLabel(ctx.currentFy)}・全期間。調達ポータルの落札実績${comma(ctx.awards.length)}件から集計。`,
    path: rankPath(),
    body,
    ld: [bc.ld],
  });
}

export function renderRanking(ctx, fy) {
  const bc = breadcrumbs([['トップ', ''], ['落札額ランキング', rankPath()], [fyLabel(fy), null]]);
  const list = ctx.fyTop.get(fy) || [];
  const total = list.reduce((s, r) => s + r.s, 0);
  const body = `${bc.html}
<header class="ph"><h1>${fyLabel(fy)}の国の入札 落札額ランキング</h1>
<p class="lead">${fyLabel(fy)}（${fyReiwa(fy)}、${fy}年4月〜${fy + 1}年3月${fy === ctx.currentFy ? `のうち${jpDate(ctx.ppInfo.latestDate)}まで` : ''}）に、国の機関の入札で落札した額が多い会社です。対象は${comma(list.length)}社、落札額の合計は${yenShort(total)}。</p></header>
<div class="chips">${ctx.fys.map((y) => (y === fy ? `<span>${fyLabel(y)}</span>` : `<a href="${href(rankPath(y))}">${fyLabel(y)}</a>`)).join('')}</div>
${RANK_NOTE}
${companyRank(rankRows(list, 300))}`;
  return layout({
    title: `${fyLabel(fy)}（${fyReiwa(fy)}）国の落札額ランキング 上位300社｜${SITE_NAME}`,
    description: `${fyLabel(fy)}に国の機関の入札で落札額が多かった会社のランキング（上位300社）。落札額の合計と件数。`,
    path: rankPath(fy),
    body,
    ld: [bc.ld],
  });
}

export function renderSearch() {
  const body = `<header class="ph"><h1>会社・機関を探す</h1></header>
<form class="sb sb-page" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="会社名・機関名（例：富士通、福岡市）" autocomplete="off" aria-label="会社名・機関名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<div id="results" class="results"><p class="note">会社名（国の入札で落札したことのある会社）、または入札公告を出した機関の名前で探せます。「株式会社」は付けなくてもかまいません。</p></div>`;
  return layout({ title: `検索｜${SITE_NAME}`, description: '会社名・機関名で入札情報と落札実績を探す', path: 'search/', body, noindex: true });
}

export function render404() {
  const body = `<header class="ph"><h1>ページが見つかりませんでした</h1>
<p class="lead">URLが変わったか、公告の掲載期間が過ぎた可能性があります。会社名・機関名で探してください。</p></header>
<form class="sb sb-page" role="search" action="${href('search/')}">
<input class="sb-i" name="q" type="search" placeholder="会社名・機関名" autocomplete="off" aria-label="会社名・機関名で検索">
<div class="sb-r" hidden></div>
</form>
<p><a href="${href('')}">トップへ戻る</a></p>`;
  return layout({ title: `ページが見つかりません｜${SITE_NAME}`, description: 'お探しのページは見つかりませんでした。', path: '404.html', body, noindex: true });
}

export function renderAbout(ctx) {
  const info = buildInfo();
  const bc = breadcrumbs([['トップ', ''], ['このサイトについて', null]]);
  const k = { first: ctx.dates[ctx.dates.length - 1], last: ctx.dates[0] };
  const body = `${bc.html}
<header class="ph"><h1>このサイトについて・データの見方</h1>
<p class="lead">${SITE_NAME}は、国・自治体の入札公告と、国の機関の落札実績を、だれでも無料で、機関・地域・分野・会社ごとに見られるようにしたサイトです。</p></header>
<section class="card"><h2>使っているデータ</h2>
<ul class="ul">
<li><b>入札公告</b>：<a href="${SOURCES.kkj.url}" rel="noopener">${SOURCES.kkj.name}</a>（${SOURCES.kkj.org}）の検索APIを利用して、公告日ごとに取得しています。国の機関・独立行政法人・都道府県・市区町村などが自分のサイトに載せた公告を、同ポータルが集めたものです（すべての公告ではありません）。いま${jpDate(k.first)}〜${jpDate(k.last)}の公告${comma(ctx.notices.length)}件を載せています。</li>
<li><b>落札実績</b>：<a href="${SOURCES.pportal.data}" rel="noopener">${SOURCES.pportal.name}</a>（${SOURCES.pportal.org}）の「落札実績オープンデータ」（全件データ・差分データ）。国の機関が政府電子調達システム（GEPS）で行った入札などの落札で、${fyLabel(ctx.fys[ctx.fys.length - 1])}から${jpDate(ctx.ppInfo.latestDate)}までの${comma(ctx.awards.length)}件です。自治体・独立行政法人の落札は含みません。</li>
</ul>
<p>調達ポータルのコンテンツは政府標準利用規約（第2.0版）に準拠し、出典を書けば商用を含めて自由に使えます（CC BY 4.0互換）。官公需情報ポータルサイトの検索APIは、同サイトの利用規約にしたがい、APIを使っていることを明記し、同サイトへのリンクを設けて利用しています。${SITE_NAME}は、これらのデータを${OPERATOR}が加工して作成しています。国（中小企業庁・デジタル庁）が作成したものではありません。</p>
<p>データは毎日自動で更新しています（最終更新：${esc(info.built)}）。</p></section>
<section class="card" id="shimekiri"><h2>締切日・「締切前」の意味</h2>
<ul class="ul">
<li>官公需ポータルのデータには締切日の項目がほとんど入っていないため、<b>公告文の「入札書の提出期限」「開札の日時」などの近くにある日付を、当サイトが自動で読み取っています</b>。いくつかあるときは、いちばん遅い日付（多くは開札日）を出しています。</li>
<li>読み取った文は「公告文より『…』」として各公告の下に載せています。読み違えることがあり、参加申請の期限が先に来る公告も多いので、<b>入札に参加するときは必ず元の公告・入札説明書でご確認ください</b>。</li>
<li>「締切前」は、読み取った日付が今日以降のもの、または日付を読み取れず公告日から30日以内のもの（「締切は公告で確認」と表示）です。</li>
<li>分類（工事・物品・役務）は官公需ポータルの値です。値がないものは件名から当サイトが推定し、「（推定）」と付けています。</li>
</ul></section>
<section class="card" id="rakusatsu"><h2>落札実績の見方</h2>
<ul class="ul">
<li><b>会社ごとの集計は法人番号で行っています</b>。社名が変わった会社も同じページにまとまります。法人番号の記載がない事業者（個人事業主など）は、会社ページを作らず、府省などの一覧に名前だけ載せています。</li>
<li>府省の名前は、データの「府省等のコード」から当サイトが判定しています（コード表が公開されていないため、各コードの件名から判断しました）。地方の出先機関は、それぞれの府省に含まれます。</li>
<li>落札額は記録された落札価格です。複数年度にわたる契約は落札した年度にまとめて入ります。<b>売払い</b>（国が物を売り、事業者が買い受けたもの）と、<b>単価契約で単価だけが記録されたもの</b>は、落札額の合計に入れていません。単価契約でも、データに総額か単価かの区別がないものはそのまま足しています。</li>
<li>落札率・予定価格・入札した会社の数は、データに含まれていません。</li>
<li>件名に「テスト」「ダミーデータ」とある試験用の記録は除いています。</li>
</ul></section>
<section class="card" id="bunya"><h2>分野の分け方</h2>
<p>件名に含まれる語で分けています（例：「清掃」「クリーニング」→清掃、「システム」「クラウド」「ネットワーク」→システム・IT）。1件が複数の分野に入ることがあり、語を含まない案件はどの分野にも入りません。</p>
<ul class="ul">${TOPICS.map((t) => `<li><a href="${href(topicPath(t))}">${esc(t.name)}</a>：${esc(t.desc)}</li>`).join('')}</ul></section>
<section class="card" id="privacy"><h2>運営者・お問い合わせ・プライバシー</h2>
<dl class="dl"><div><dt>運営</dt><dd>${OPERATOR}（法人番号 ${OPERATOR_ID}）</dd></div><div><dt>お問い合わせ</dt><dd>${CONTACT}</dd></div></dl>
<p>このサイトはAIを使って作られ、データの取得・集計・ページの作成も自動で行っています。内容の誤りに気づいたときは、まず元の公告・調達ポータルをご確認のうえ、上記メールアドレスまでご連絡ください。</p>
<p>このサイトはCookieを使わず、アクセス解析も行っていません。検索に入力した文字は、お使いの端末の中だけで処理され、外部に送られません。</p></section>`;
  return layout({
    title: `このサイトについて・データの見方｜${SITE_NAME}`,
    description: `${SITE_NAME}で使っているデータ（官公需情報ポータルサイトの検索API、調達ポータルの落札実績オープンデータ）、締切日の読み取り方、落札額の集計方法、運営者について。`,
    path: 'about/',
    body,
    ld: [bc.ld],
  });
}
