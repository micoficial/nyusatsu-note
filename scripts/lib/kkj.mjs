// 官公需情報ポータルサイトの検索API（https://www.kkj.go.jp/api/）の結果を読む
// XMLの形は「検索APIガイド V1.1」のとおり。公告文（ProjectDescription）は件名の補いと締切日の読み取りにだけ使い、保存しない。

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return ENT[e.toLowerCase()] ?? m;
});
const field = (body, tag) => {
  const m = body.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`));
  if (!m) return '';
  return (m[1] != null ? m[1] : unxml(m[2] || '')).trim();
};

export function parseResults(xml) {
  const err = xml.match(/<Error>([^<]*)<\/Error>/);
  if (err) return { error: err[1], hits: 0, results: [] };
  const hits = +(xml.match(/<SearchHits>(\d+)<\/SearchHits>/) || [])[1];
  if (!Number.isFinite(hits)) return { error: 'SearchHits がありません', hits: 0, results: [] };
  const results = [];
  for (const m of xml.matchAll(/<SearchResult>([\s\S]*?)<\/SearchResult>/g)) {
    const b = m[1];
    const atts = [...b.matchAll(/<Attachment>([\s\S]*?)<\/Attachment>/g)].map((a) => ({ name: field(a[1], 'Name'), uri: field(a[1], 'Uri') }));
    results.push({
      key: field(b, 'Key'),
      uri: field(b, 'ExternalDocumentURI'),
      name: field(b, 'ProjectName'),
      date: field(b, 'Date'),
      fileType: field(b, 'FileType'),
      lg: field(b, 'LgCode'),
      prefName: field(b, 'PrefectureName'),
      cityCode: field(b, 'CityCode'),
      cityName: field(b, 'CityName'),
      org: field(b, 'OrganizationName'),
      cert: field(b, 'Certification'),
      issue: field(b, 'CftIssueDate'),
      periodEnd: field(b, 'PeriodEndTime'),
      category: field(b, 'Category'),
      procedure: field(b, 'ProcedureType'),
      location: field(b, 'Location'),
      tender: field(b, 'TenderSubmissionDeadline'),
      opening: field(b, 'OpeningTendersEvent'),
      desc: field(b, 'ProjectDescription'),
      atts,
    });
  }
  return { error: null, hits, results };
}

// 応答を少しずつ読み、公告1件ずつ取り出す。公告文が長すぎる件（数十MBの仕様書が丸ごと入っていることがある）は、
// 先頭だけ残して残りを読み捨てる。APIにはページ送りがないので、後ろの公告を取りこぼさないよう最後まで読む
export class StreamParser {
  constructor({ keepDesc = 200000 } = {}) {
    this.keepDesc = keepDesc;
    this.buf = '';
    this.head = ''; // 公告の外側（SearchHits・Error）
    this.records = [];
    this.inRec = false;
    this.skipping = false;
    this.truncated = 0;
  }

  push(text) {
    const OPEN = '<ProjectDescription>';
    const CLOSE = '</ProjectDescription>';
    const TAIL = 40; // タグが2回に分かれて届いても見つけられるよう、末尾は次に持ち越す
    this.buf += text;
    for (;;) {
      if (this.skipping) {
        const i = this.buf.indexOf(CLOSE);
        if (i < 0) { this.buf = this.buf.slice(-TAIL); return; }
        this.cur += CLOSE;
        this.buf = this.buf.slice(i + CLOSE.length);
        this.skipping = false;
        this.descDone = true;
        continue;
      }
      if (!this.inRec) {
        const i = this.buf.indexOf('<SearchResult>');
        if (i < 0) {
          // 公告の外側（SearchHits など）は小さいので残しておく
          if (this.head.length < 20000) this.head += this.buf.slice(0, Math.max(0, this.buf.length - TAIL));
          this.buf = this.buf.slice(-TAIL);
          return;
        }
        if (this.head.length < 20000) this.head += this.buf.slice(0, i);
        this.buf = this.buf.slice(i);
        this.inRec = true;
        this.cur = '';
        this.ds = -1;
        this.descDone = false;
      }
      const end = this.buf.indexOf('</SearchResult>');
      if (end >= 0) {
        this.cur += this.buf.slice(0, end + '</SearchResult>'.length);
        this.buf = this.buf.slice(end + '</SearchResult>'.length);
        this.records.push(this.cur);
        this.inRec = false;
        this.cur = '';
        continue;
      }
      // まだ1件が終わっていない。届いた分を cur に移し、公告文が長くなりすぎたら先頭だけ残して読み捨てに入る
      if (this.buf.length > TAIL) {
        this.cur += this.buf.slice(0, -TAIL);
        this.buf = this.buf.slice(-TAIL);
      }
      if (!this.descDone) {
        if (this.ds < 0) this.ds = this.cur.indexOf(OPEN);
        if (this.ds >= 0) {
          if (this.cur.indexOf(CLOSE, this.ds) >= 0) this.descDone = true;
          else if (this.cur.length - this.ds > this.keepDesc + OPEN.length) {
            this.cur = this.cur.slice(0, this.ds + OPEN.length + this.keepDesc).replace(/&[#\w]*$/, '');
            this.skipping = true;
            this.truncated++;
            continue;
          }
        }
      }
      return;
    }
  }

  // 途中で読むのをやめたとき、読みかけの1件（公告文の先頭まで）を閉じて残す。その件名を返す
  closePartial() {
    if (!this.inRec) return null;
    let rec = this.cur + (this.skipping ? '' : this.buf);
    if (rec.includes('<ProjectDescription>') && !rec.includes('</ProjectDescription>')) rec = `${rec.replace(/&[#\w]*$/, '')}</ProjectDescription>`;
    rec += '</SearchResult>';
    this.records.push(rec);
    this.inRec = false;
    this.skipping = false;
    this.buf = '';
    return (rec.match(/<ProjectName>([^<]*)<\/ProjectName>/) || [])[1] || '';
  }

  // 読み終えたら、ふつうの応答と同じ形のXMLにして返す
  xml() {
    const outside = this.head + (this.inRec ? '' : this.buf);
    const err = outside.match(/<Error>[^<]*<\/Error>/);
    if (err) return `<Results>${err[0]}</Results>`;
    const hits = (outside.match(/<SearchHits>\d+<\/SearchHits>/) || [''])[0];
    return `<?xml version="1.0" encoding="utf-8" ?>\n<Results>\n<Version>1.0</Version>\n<SearchResults>\n${hits}\n${this.records.map((r) => `${r}\n`).join('')}</SearchResults>\n</Results>\n`;
  }
}

// ---- 文字の正規化 ----
const z2h = (s) => s
  .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  .replace(/[：]/g, ':').replace(/[　 ]/g, ' ').replace(/[．]/g, '.').replace(/[／]/g, '/')
  .replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[～〜]/g, '~');

// 1文字ずつの間に空白が入っていても当たる正規表現（PDFから取り出した文は「入 札 書」のようになっていることがある）
const spaced = (words) => new RegExp(words.map((w) => [...w].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')).join('|'), 'g');

const DEADLINE = spaced(['締切', '締め切', '〆切', '提出期限', '提出期間', '提出日時', '受付期限', '受付期間', '受付締切', '受付日時', '申請期限', '申請期間', '申込期限', '申込期間', '申込締切', '入札期間', '入札書提出', '入札書の提出', '入札書等の提出', '必着', '投函', '参加申請', '参加申込', '確認申請', '見積書の提出', '見積書提出', '提案書の提出', '提案書提出', '企画提案書']);
const OPENING = spaced(['開札', '入札日', '入札日時', '入札執行', '入札及び開札', '入札会', '見積合わせ', '見積り合わせ', '開封']);
const EXCLUDE = spaced(['履行期間', '履行期限', '履行場所', '納入期限', '納期', '工期', '契約期間', '委託期間', '賃貸借期間', '借入期間', '実施期間', '業務期間', '供給期間', '公告日', '公示日', '掲載日', '作成日', '質問', '回答', '説明会', '現場説明', '閲覧', '保証', '有効期限', '契約締結', '契約日', '審査結果', '通知']);

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

function findDates(s, baseYear, baseMonth) {
  const out = [];
  const push = (m, y, mo, d) => {
    const v = ymd(y, +mo, +d);
    if (v) out.push({ i: m.index, end: m.index + m[0].length, v, text: m[0] });
  };
  for (const m of s.matchAll(/(?:令\s*和|R)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) push(m, 2018 + (m[1] === '元' ? 1 : +m[1]), m[2], m[3]);
  for (const m of s.matchAll(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) push(m, +m[1], m[2], m[3]);
  for (const m of s.matchAll(/(?:令和|R)\s*(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{1,2})(?!\d)/g)) push(m, 2018 + +m[1], m[2], m[3]);
  for (const m of s.matchAll(/(?<![\d.])(20\d{2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})(?!\d)/g)) push(m, +m[1], m[2], m[3]);
  for (const m of s.matchAll(/(?<![\d年.])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    let y = baseYear;
    if (+m[1] < baseMonth - 6) y++;
    push(m, y, m[1], m[2]);
  }
  // 重なったら長い方を残す
  out.sort((a, b) => a.i - b.i || b.end - a.end);
  const res = [];
  for (const x of out) if (!res.length || x.i >= res[res.length - 1].end) res.push(x);
  return res;
}

// 最後に当たった位置（終わりの位置と始まりの位置）。当たらなければ end = -1
const lastHit = (re, s) => {
  re.lastIndex = 0;
  let hit = { end: -1, start: -1 };
  let m;
  while ((m = re.exec(s))) { hit = { end: m.index + m[0].length, start: m.index }; if (m[0].length === 0) re.lastIndex++; }
  return hit;
};

// 公告文から「入札書の提出期限」「開札日時」などの日付を読み取る。いちばん遅い日付を返す
export function extractDeadline(desc, issue) {
  if (!desc) return null;
  const s = z2h(desc).replace(/\s+/g, ' ');
  const base = new Date(`${issue}T00:00:00Z`);
  if (Number.isNaN(+base)) return null;
  const dates = findDates(s, base.getUTCFullYear(), base.getUTCMonth() + 1);
  const lo = +base - 3 * 864e5;
  const hi = +base + 200 * 864e5;
  let best = null;
  let prev = null;
  for (const d of dates) {
    const segStart = Math.max(prev ? prev.end : 0, d.i - 60);
    const seg = s.slice(segStart, d.i);
    let kind = null;
    let kwPos = -1;
    let kwEnd = -1;
    if (prev && prev.kind && d.i - prev.end <= 8 && /^[\s()（）曜日月火水木金土祭午前後時分\d:~\-から至より]*$/.test(s.slice(prev.end, d.i))) {
      kind = prev.kind; // 「〇月〇日から〇月〇日まで」の後ろの日付
      kwPos = prev.kwPos;
    } else {
      const a = lastHit(DEADLINE, seg);
      const b = lastHit(OPENING, seg);
      const x = lastHit(EXCLUDE, seg);
      const inc = b.end > a.end ? b : a;
      // 「。」をまたぐ語は前の文のものなので使わない
      if (inc.end >= 0 && inc.end > x.end && !seg.slice(inc.end).includes('。')) {
        kind = b.end > a.end ? 'open' : 'deadline';
        kwPos = segStart + inc.start;
        kwEnd = segStart + inc.end;
      }
    }
    const t = Date.parse(`${d.v}T00:00:00Z`);
    d.kind = kind;
    d.kwPos = kwPos;
    prev = d;
    if (!kind || !(t >= lo && t <= hi)) continue;
    // 公告から2か月半より先の日付は、語のすぐ後ろ（25文字以内）にあるときだけ使う（履行期限などを拾わない）
    if (t > +base + 75 * 864e5 && kwEnd >= 0 && d.i - kwEnd > 25) continue;
    if (!best || d.v > best.v) {
      const from = Math.max(kwPos >= 0 ? kwPos : d.i - 16, d.i - 30);
      best = { v: d.v, kind, snippet: s.slice(from, d.end).replace(/^[\s、。:)]+/, '').trim() };
    }
  }
  return best;
}

// 件名の掃除。「126145.pdf」のようなファイル名だけのときは公告文から件名を探す
const SIZE_TAIL = /\s*[[［(（【]\s*(?:PDF|ＰＤＦ|pdf|Word|ワード|Excel|エクセル|ZIP|zip|DOCX?|XLSX?|\d+(?:\.\d+)?\s*[KMGkmg]?[BbＢ])[^\]］)）】]{0,30}[\]］)）】]\s*$/;
const CIRCLED_TAIL = /(?:\s*[①-⑳⑴-⒇])+\s*$/;
// 公告文から取った件名は、「⑵ 工事場所」などの次の項目の手前で切る
const DERIVED_CUT = /\s*(?:[⑴-⒇①-⑳]|\(\d{1,2}\)|工事場所|工事箇所|履行場所|納入場所|工事概要|工事内容|工事の場所|事後公表|完成期限|履行期間|納入期限|規格|\s{2,})/;
// 件名のない「要綱」「基準」などは公告ではないので外す
export const NOT_NOTICE = /要綱|要領|基準|規則|訓令|規程|注意事項|心得|様式集|について\(趣旨\)/;
const FILE_ONLY = /^[\w\-.()（）\s]+\.(?:pdf|docx?|xlsx?|zip|html?|jtd|txt)$/i;
const NAME_LABEL = /(?:件\s*名|業\s*務\s*名|工\s*事\s*名|案\s*件\s*名|調\s*達\s*件\s*名|委\s*託\s*業\s*務\s*名|物\s*品\s*名|品\s*名|契\s*約\s*件\s*名)\s*[:：]?\s*([^\n。]{4,70})/;
export function cleanTitle(name, desc) {
  let t = String(name || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(SIZE_TAIL, '').replace(CIRCLED_TAIL, '').trim();
  t = t.replace(/^(?:\[|［)?(?:PDF|ＰＤＦ)(?:\]|］)\s*/, '');
  const weak = !t || FILE_ONLY.test(t) || /^[\d\s_\-.]+$/.test(t) || t.length < 3 || /^(?:入札公告|公告|一般競争入札公告|入札説明書|公告文|別紙|様式)\d*$/.test(t);
  if (!weak) return { title: t, derived: false };
  const d = String(desc || '');
  const cut = (x) => {
    const v = x.replace(/\s+/g, ' ').trim();
    const i = v.slice(4).search(DERIVED_CUT);
    return (i >= 0 ? v.slice(0, i + 4) : v).trim().slice(0, 70);
  };
  // 文の途中（「及び数量」「は、「1. 件名」のとおり」など）を拾ったものは使わない
  const ok = (x) => x.length >= 5 && !/^[はをにがのへでと、。及称並又]/.test(x) && !/のとおり|しなければ|すること/.test(x);
  const m = z2h(d).match(NAME_LABEL);
  if (m && ok(cut(m[1]))) return { title: cut(m[1]), derived: true };
  for (const line of d.split(/\n/)) {
    const l = line.replace(/\s+/g, ' ').trim();
    if (l.length >= 6 && l.length <= 90 && /工事|業務|購入|委託|賃貸借|調達|製造|印刷|供給|売払|入札/.test(l) && ok(cut(l))) return { title: cut(l), derived: true };
  }
  return { title: '', derived: true };
}

const day = (iso) => (iso ? iso.slice(0, 10) : '');

// 1件をサイトで使う形にする（短いキー名で保存する）
export function toRecord(r) {
  const issue = day(r.issue) || day(r.date);
  const { title, derived } = cleanTitle(r.name, r.desc);
  // 件名がファイル名だけで、中身が要綱などの公告でない文書のもの、読めない添付（zip・Excelなど）のものは外す
  if (derived && NOT_NOTICE.test(title) && !/工事|業務|購入|委託/.test(title)) return null;
  if (derived && r.fileType && !/^(pdf|html?)$/i.test(r.fileType)) return null;
  if (!title) return null; // 件名を読み取れないもの
  const rec = {
    k: r.key,
    u: r.uri,
    t: title,
    o: r.org || r.prefName || '（機関名なし）',
    p: r.lg ? +r.lg : 0,
    d: issue,
    g: day(r.date),
  };
  if (derived) rec.tf = 1;
  if (r.cityCode) rec.c = r.cityCode;
  if (r.cityName) rec.cn = r.cityName;
  if (r.category) rec.cat = r.category;
  if (r.procedure) rec.pt = r.procedure.slice(0, 30);
  if (r.fileType) rec.ft = r.fileType;
  if (r.cert) rec.ce = r.cert;
  if (r.atts?.length) rec.na = r.atts.length;
  // 締切・開札の日付：APIの項目にあればそれ、なければ公告文から読み取る
  const api = [day(r.tender), day(r.opening)].filter((x) => x && x >= issue).sort();
  if (api.length) {
    rec.dl = api[api.length - 1];
    rec.dk = day(r.opening) === rec.dl ? 'open' : 'deadline';
    rec.dsrc = 'api';
  } else {
    const x = extractDeadline(r.desc, issue);
    if (x) {
      rec.dl = x.v;
      rec.dk = x.kind;
      rec.ds = x.snippet.slice(0, 60);
      rec.dsrc = 'text';
    }
  }
  return rec;
}
