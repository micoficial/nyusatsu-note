// 公開データを取ってきて data/ に貯める
//   調達ポータル：落札実績オープンデータ（年度ごとの全件ZIP＋日ごとの差分ZIP）→ data/raw/pportal/
//   官公需情報ポータルサイト：検索APIで公告日ごとに取得 → data/store/kkj/YYYY-MM.json（月ごとに貯める）
// 使い方:
//   node scripts/fetch.mjs                  … 調達ポータル＋公告の直近3日（日曜は14日。公告日から2週間たってポータルに載るものもある）
//   KKJ_DAYS=95 node scripts/fetch.mjs      … 公告を95日さかのぼって取る（初回）
//   KKJ_FROM=2026-07-01 KKJ_TO=2026-07-31 node scripts/fetch.mjs
//   SKIP_PPORTAL=1 / SKIP_KKJ=1             … 片方だけ
//   RESTORE=1 / UPLOAD=1                    … リリース data-latest の控えから戻す／控えを差し替える（GH_TOKEN が要る）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseResults, toRecord, StreamParser } from './lib/kkj.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_PP = path.join(ROOT, 'data', 'raw', 'pportal');
const RAW_KKJ = path.join(ROOT, 'data', 'raw', 'kkj');
const STORE = path.join(ROOT, 'data', 'store', 'kkj');
const REPO = process.env.GITHUB_REPOSITORY || 'micoficial/nyusatsu-note';
const UA = 'Mozilla/5.0 (compatible; nyusatsu-note/1.0; +https://micoficial.github.io/nyusatsu-note/about/)';
const env = process.env;
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const d of [RAW_PP, STORE]) fs.mkdirSync(d, { recursive: true });

const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

async function get(url, { timeout = 180e3, retries = 2, binary = false } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(15e3 * (i + 1));
    }
  }
  throw new Error(`${url} を取得できませんでした: ${lastErr?.message}`);
}

function gh(args, opts = {}) {
  return execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts });
}

// 貯めた公告の件数（控えを差し替える前に、減りすぎていないか確かめる）
function storeCount() {
  let n = 0;
  for (const f of fs.readdirSync(STORE)) if (/^\d{4}-\d{2}\.json$/.test(f)) n += Object.keys(JSON.parse(fs.readFileSync(path.join(STORE, f), 'utf8'))).length;
  return n;
}

// ---- リリースの控えから戻す ----
// 控えがあるのに戻せなかったときは止める（そのまま差し替えると、貯めた公告が消えるため）
function restore() {
  let assets = [];
  try {
    assets = JSON.parse(gh(['release', 'view', 'data-latest', '-R', REPO, '--json', 'assets'])).assets.map((a) => a.name);
  } catch {
    log('控え（リリース data-latest）はまだありません');
    return 0;
  }
  const dir = path.join(ROOT, 'data', 'tmp-restore');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const name of assets.filter((a) => a.endsWith('.tar.gz'))) {
    gh(['release', 'download', 'data-latest', '-R', REPO, '--pattern', name, '--dir', dir, '--clobber']);
    execFileSync('tar', ['--force-local', '-xzf', path.join(dir, name), '-C', path.join(ROOT, 'data')]);
    log('控えから戻しました:', name);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return storeCount();
}

// ---- 調達ポータル ----
const PP_LIST = 'https://www.p-portal.go.jp/pps-web-biz/UAB02/OAB0201';
const PP_FILE = 'https://api.p-portal.go.jp/pps-web-biz/UAB03/OAB0301?fileversion=v001&filename=';
async function fetchPportal() {
  const html = await get(PP_LIST);
  const files = [...new Set([...html.matchAll(/doDownload\('(successful_bid_record_info_(?:all_\d{4}|diff_\d{8})\.zip)'\)/g)].map((m) => m[1]))];
  if (!files.some((f) => f.includes('_all_'))) throw new Error('落札実績の一覧ページの形が変わりました（全件ファイルが見つかりません）');
  const upd = html.match(/令和\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日更新/);
  const allUpdated = upd ? `${2018 + +upd[1]}-${upd[2].padStart(2, '0')}-${upd[3].padStart(2, '0')}` : '';
  const metaFile = path.join(RAW_PP, 'meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const refreshAll = meta.allUpdated !== allUpdated;
  let n = 0;
  for (const f of files) {
    const dest = path.join(RAW_PP, f);
    const isAll = f.includes('_all_');
    if (fs.existsSync(dest) && !(isAll && refreshAll)) continue;
    const buf = await get(PP_FILE + f, { binary: true });
    if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error(`${f} がZIPではありません`);
    fs.writeFileSync(dest, buf);
    n++;
    await sleep(1500);
  }
  // 一覧から消えた差分（2か月より前）は、全件ファイルに入ったので消す
  for (const f of fs.readdirSync(RAW_PP)) if (/_diff_\d{8}\.zip$/.test(f) && !files.includes(f)) fs.rmSync(path.join(RAW_PP, f));
  fs.writeFileSync(metaFile, JSON.stringify({ allUpdated, fetched: new Date().toISOString(), files }, null, 1));
  log(`調達ポータル：${files.length}ファイル（新しく取ったもの ${n}）、全件データの更新日 ${allUpdated}`);
  return { allUpdated, downloaded: n };
}

// ---- 官公需情報ポータルサイト ----
const KKJ_API = 'https://www.kkj.go.jp/api/';
const ALL_PREFS = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, '0'));
const GROUPS = [ALL_PREFS.slice(0, 7), ALL_PREFS.slice(7, 14), ALL_PREFS.slice(14, 23), ALL_PREFS.slice(23, 30), ALL_PREFS.slice(30, 39), ALL_PREFS.slice(39)];
// 応答を少しずつ読む。長すぎる公告文は StreamParser が先頭だけ残す。idle の間なにも届かなければやめる。
// 公告文の欄に図面データなどが丸ごと入った件があり、応答が数百MBになることがある。maxBytes を超えたら読むのをやめ、
// 読みかけの1件の件名を giant として返す（呼び出し側でその件名を除いて取り直す）
async function getKkjStream(url, { idle = 90e3, total = 1200e3, retries = 1, maxBytes = 25e6 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(new Error(`${idle / 1000}秒なにも届きませんでした`)), idle);
    const stop = setTimeout(() => ctrl.abort(new Error(`${total / 1000}秒たっても終わりませんでした`)), total);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parser = new StreamParser();
      const dec = new TextDecoder('utf-8');
      let bytes = 0;
      let giant = null;
      for await (const chunk of res.body) {
        clearTimeout(timer);
        timer = setTimeout(() => ctrl.abort(new Error(`${idle / 1000}秒なにも届きませんでした`)), idle);
        bytes += chunk.length;
        parser.push(dec.decode(chunk, { stream: true }));
        if (bytes > maxBytes) {
          if (!parser.skipping) throw new Error(`応答が${(maxBytes / 1e6).toFixed(0)}MBを超えました`);
          giant = parser.closePartial();
          break; // ループを抜けると受信は止まる（ここで abort すると、抜けるときに失敗扱いになる）
        }
      }
      if (giant == null) parser.push(dec.decode());
      if (parser.truncated) log(`  長い公告文 ${parser.truncated}件を先頭だけ残しました（${giant != null ? `${(maxBytes / 1e6).toFixed(0)}MBで打ち切り：${giant}` : `応答 ${(bytes / 1e6).toFixed(0)}MB`}）`);
      return { xml: parser.xml(), giant };
    } catch (e) {
      lastErr = ctrl.signal.aborted && ctrl.signal.reason ? ctrl.signal.reason : e;
      if (i < retries) await sleep(15e3 * (i + 1));
    } finally {
      clearTimeout(timer);
      clearTimeout(stop);
    }
  }
  throw new Error(`${url} を取得できませんでした: ${lastErr?.message}`);
}

let lastCall = 0;
// tag：保存名の区別（all＝全都道府県、g1〜g6＝都道府県のまとまり、p13＝東京都など）
// 戻り値の giant は、応答が大きすぎて途中で読むのをやめたときの、読みかけの件の件名（なければ null）
async function kkj(params, tag, { retries = 1 } = {}) {
  const raw = path.join(RAW_KKJ, `${params.CFT_Issue_Date.replace('/', '_')}_${tag}.xml.gz`);
  if (env.REUSE_RAW && fs.existsSync(raw)) {
    const xml = zlib.gunzipSync(fs.readFileSync(raw)).toString('utf8');
    return { ...parseResults(xml), giant: (xml.match(/<!-- giant: ([\s\S]*?) -->/) || [])[1] ?? null };
  }
  const wait = 4000 - (Date.now() - lastCall); // 続けて大量に送らない（利用規約）
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const { xml, giant } = await getKkjStream(`${KKJ_API}?${new URLSearchParams({ ...params, Count: '1000' })}`, { retries });
  lastCall = Date.now();
  const r = parseResults(xml);
  if (r.error) throw new Error(`官公需ポータルAPIのエラー: ${r.error}（${JSON.stringify(params)}）`);
  if (env.KEEP_RAW) {
    fs.mkdirSync(RAW_KKJ, { recursive: true });
    fs.writeFileSync(raw, zlib.gzipSync(giant != null ? `${xml}<!-- giant: ${giant.replace(/--/g, '')} -->\n` : xml));
  }
  return { ...r, giant };
}

// 件名から、除外の検索に使う語（かな・漢字が4文字以上続くところでいちばん長いもの）
function giantTerm(title) {
  const runs = String(title).normalize('NFKC').match(/[぀-ヿ一-鿿々]{4,}/g) || [];
  return runs.sort((a, b) => b.length - a.length)[0] || '';
}

// 1つの都道府県・1日ぶん。大きすぎる件で打ち切ったときは、その件名の語を除いて取り直し、後ろの公告を拾う
async function fetchKkjPref(range, p) {
  const r = await kkj({ LG_Code: p, CFT_Issue_Date: range }, `p${p}`, { retries: 1 });
  if (r.hits > 1000) log(`注意：${range} の都道府県${p}は${r.hits}件あり、1000件までしか取れませんでした`);
  if (r.giant == null) return r;
  const byKey = new Map(r.results.map((x) => [x.key, x]));
  const terms = [];
  let giant = r.giant;
  for (let i = 0; i < 3 && giant != null; i++) {
    const t = giantTerm(giant);
    if (!t || terms.includes(t)) break;
    terms.push(t);
    const q = terms.map((x, j) => (j === 0 ? `NOT ${x}` : `ANDNOT ${x}`)).join(' ');
    const r2 = await kkj({ LG_Code: p, CFT_Issue_Date: range, Project_Name: q }, `p${p}x${i + 1}`, { retries: 1 });
    for (const x of r2.results) if (!byKey.has(x.key)) byKey.set(x.key, x);
    giant = r2.giant;
  }
  const got = byKey.size;
  if (got < r.hits) log(`  ${range} の都道府県${p}：${r.hits}件のうち${got}件を取得（大きすぎる公告文があり、残りは取れませんでした）`);
  return { hits: r.hits, results: [...byKey.values()], giant: null };
}

// 公告日1日ぶん（または期間）を取る。1000件を超えたとき、応答がないとき、大きすぎて打ち切ったときは都道府県で分けて取り直す
async function fetchKkjRange(range) {
  const failed = [];
  try {
    const first = await kkj({ LG_Code: ALL_PREFS.join(','), CFT_Issue_Date: range }, 'all', { retries: 0 });
    if (first.hits <= 1000 && first.giant == null) return { hits: first.hits, results: first.results, failed };
    if (first.giant != null) log(`${range}：大きすぎる公告文（${first.giant}）があったので、都道府県で分けて取ります`);
  } catch (e) {
    log(`${range} をまとめて取れなかったので、都道府県で分けて取ります（${e.message}）`);
  }
  const out = [];
  let hits = 0;
  for (const [gi, g] of GROUPS.entries()) {
    try {
      const r = await kkj({ LG_Code: g.join(','), CFT_Issue_Date: range }, `g${gi + 1}`, { retries: 0 });
      if (r.hits <= 1000 && r.giant == null) { out.push(...r.results); hits += r.hits; continue; }
    } catch (e) {
      log(`${range} の都道府県${g[0]}〜${g[g.length - 1]}を取れなかったので、1つずつ取ります（${e.message}）`);
    }
    for (const p of g) {
      try {
        const r2 = await fetchKkjPref(range, p);
        out.push(...r2.results);
        hits += r2.hits;
      } catch (e) {
        failed.push(`${range}:${p}`);
        log(`取れませんでした：${range} の都道府県${p}（${e.message}）`);
      }
    }
  }
  return { hits, results: out, failed };
}

function loadMonth(ym) {
  const f = path.join(STORE, `${ym}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}
function saveMonth(ym, obj) {
  const keys = Object.keys(obj).sort();
  const sorted = Object.fromEntries(keys.map((k) => [k, obj[k]]));
  fs.writeFileSync(path.join(STORE, `${ym}.json`), JSON.stringify(sorted));
}

async function fetchKkj() {
  const today = jstToday();
  let dates = [];
  if (env.KKJ_FROM) {
    for (let d = env.KKJ_FROM; d <= (env.KKJ_TO || today); d = addDays(d, 1)) dates.push(d);
  } else {
    // 日曜の夜（日本時間）だけ、2週間さかのぼって取り直す
    const jst = new Date(Date.now() + 9 * 3600e3);
    const days = +(env.KKJ_DAYS || (jst.getUTCDay() === 0 && jst.getUTCHours() >= 12 ? 14 : 3));
    for (let i = 0; i < days; i++) dates.push(addDays(today, -i));
  }
  dates.sort().reverse();
  const months = new Map();
  const month = (ym) => months.get(ym) || months.set(ym, loadMonth(ym)).get(ym);
  let added = 0;
  let updated = 0;
  let total = 0;
  const seenAt = new Date().toISOString().slice(0, 10);
  const merge = (results) => {
    for (const r of results) {
      const rec = toRecord(r);
      if (!rec || !rec.k || !rec.d) continue;
      const m = month(rec.d.slice(0, 7));
      const old = m[rec.k];
      rec.f = old?.f || seenAt; // このサイトが最初に見つけた日
      if (!old) added++; else if (JSON.stringify({ ...old, f: 0 }) !== JSON.stringify({ ...rec, f: 0 })) updated++;
      m[rec.k] = rec;
      total++;
    }
  };
  const failed = [];
  let ok = 0;
  // 公告日が先の日付になっている公告（予告）も取る。1日取るごとに保存する（途中で止まっても取った分は残す）
  for (const range of [`${addDays(today, 1)}/`, ...dates]) {
    const r = await fetchKkjRange(range);
    merge(r.results);
    failed.push(...r.failed);
    if (r.results.length || !r.failed.length) ok++;
    for (const [ym, obj] of months) saveMonth(ym, obj);
    log(`公告 ${range}: ${r.hits}件${r.failed.length ? `（取れなかった都道府県 ${r.failed.length}）` : ''}`);
  }
  // 400日より古い月は捨てる
  const oldest = addDays(today, -400).slice(0, 7);
  for (const f of fs.readdirSync(STORE)) if (/^\d{4}-\d{2}\.json$/.test(f) && f.slice(0, 7) < oldest) fs.rmSync(path.join(STORE, f));
  log(`官公需ポータル：${dates.length}日ぶん ${total}件（新しく ${added}件、更新 ${updated}件、取れなかったもの ${failed.length}）`);
  if (!ok) throw new Error('官公需ポータルから1日分も取れませんでした');
  return { days: dates.length, total, added, updated, failed };
}

// ---- リリースの控えを差し替える ----
function upload() {
  const tmp = path.join(ROOT, 'data', 'tmp-upload');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execFileSync('tar', ['--force-local', '-czf', path.join(tmp, 'kkj-store.tar.gz'), '-C', path.join(ROOT, 'data'), 'store/kkj']);
  execFileSync('tar', ['--force-local', '-czf', path.join(tmp, 'pportal-raw.tar.gz'), '-C', path.join(ROOT, 'data'), 'raw/pportal']);
  try {
    gh(['release', 'view', 'data-latest', '-R', REPO]);
  } catch {
    gh(['release', 'create', 'data-latest', '-R', REPO, '--title', '公開データの控え', '--notes-file', path.join(ROOT, 'scripts', 'release-notes.md')]);
  }
  gh(['release', 'upload', 'data-latest', '-R', REPO, '--clobber', path.join(tmp, 'kkj-store.tar.gz'), path.join(tmp, 'pportal-raw.tar.gz')]);
  fs.rmSync(tmp, { recursive: true, force: true });
  log('リリース data-latest の控えを差し替えました');
}

const status = { started: new Date().toISOString() };
const restored = env.RESTORE ? restore() : 0;
if (!env.SKIP_PPORTAL) {
  try { status.pportal = await fetchPportal(); } catch (e) { status.pportalError = e.message; log('調達ポータルから取れませんでした。手元（控え）のデータを使います:', e.message); }
}
if (!env.SKIP_KKJ) {
  try { status.kkj = await fetchKkj(); } catch (e) { status.kkjError = e.message; log('官公需ポータルから取れませんでした。手元（控え）のデータを使います:', e.message); }
}
fs.writeFileSync(path.join(ROOT, 'data', 'fetch-status.json'), JSON.stringify(status, null, 1));
if (env.UPLOAD) {
  const now = storeCount();
  if (now < restored * 0.9) log(`公告が ${restored} 件から ${now} 件に減ったので、控えは差し替えません`);
  else if (!fs.existsSync(path.join(RAW_PP, 'meta.json'))) log('調達ポータルのデータがないので、控えは差し替えません');
  else upload();
}
if (env.STRICT && (status.pportalError || status.kkjError)) process.exit(1);
