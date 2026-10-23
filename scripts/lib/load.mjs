// 貯めたデータを読む
//   loadAwards：調達ポータルの落札実績（全件ZIP＋差分ZIP）→ 1件ずつの配列
//   loadNotices：官公需ポータルの公告（data/store/kkj/*.json）→ 1件ずつの配列
import fs from 'node:fs';
import path from 'node:path';
import { readZip } from './zip.mjs';
import { AGENCY_BY_CODE, METHOD_SALE, METHOD_UNIT } from './meta.mjs';

// RFC4180 のCSVを文字列から読む
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// 試しに登録された件（「テスト」「ダミーデータ」）は外す
const TEST = /^テスト$|^テスト[\s　（(]|（テスト）|\(テスト\)|テスト案件|ダミーデータ|^開札準備のためのデモンストレーション$/;

const fiscalYear = (d) => {
  const y = +d.slice(0, 4);
  return +d.slice(5, 7) >= 4 ? y : y - 1;
};

export function loadAwards(dir) {
  if (!fs.existsSync(dir)) throw new Error(`${dir} がありません（先に node scripts/fetch.mjs）`);
  const files = fs.readdirSync(dir).filter((f) => /^successful_bid_record_info_(all_\d{4}|diff_\d{8})\.zip$/.test(f));
  // 全件 → 差分（日付順）の順に読み、あとから読んだ方で上書きする
  files.sort((a, b) => (a.includes('_all_') === b.includes('_all_') ? a.localeCompare(b) : a.includes('_all_') ? -1 : 1));
  const byKey = new Map();
  const unknownAgency = new Map();
  const unknownMethod = new Map();
  let rowsRead = 0;
  let dropped = 0;
  let latestDiff = '';
  let latestAllYear = 0;
  for (const f of files) {
    if (f.includes('_diff_')) latestDiff = f.match(/_diff_(\d{8})/)[1];
    else latestAllYear = Math.max(latestAllYear, +f.match(/_all_(\d{4})/)[1]);
    for (const e of readZip(path.join(dir, f))) {
      if (!e.name.endsWith('.csv')) continue;
      const text = e.data().toString('utf8').replace(/^﻿/, '');
      for (const r of parseCSV(text)) {
        if (r.length === 1 && r[0] === '') continue;
        if (r.length !== 8) throw new Error(`${f} の列の数が8ではありません（${r.length}列）。データの形が変わった可能性があります: ${r.join(',').slice(0, 200)}`);
        rowsRead++;
        const [id, title, date, price, agency, method, winner, corp] = r.map((x) => x.trim());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${f} の落札決定日の形が違います: ${date}`);
        if (TEST.test(title)) { dropped++; continue; }
        if (!AGENCY_BY_CODE.has(agency)) unknownAgency.set(agency, (unknownAgency.get(agency) || 0) + 1);
        if (!/^80\d{5}$/.test(method)) unknownMethod.set(method, (unknownMethod.get(method) || 0) + 1);
        const rec = {
          id,
          t: title.replace(/\s+/g, ' '),
          d: date,
          fy: fiscalYear(date),
          y: Math.round(+price || 0),
          a: agency,
          m: method,
          w: winner.replace(/\s+/g, ' '),
          n: /^\d{13}$/.test(corp) ? corp : '',
          k: METHOD_SALE.has(method) ? 'sale' : METHOD_UNIT.has(method) ? 'unit' : '',
        };
        byKey.set(`${id}|${rec.n || rec.w}`, rec);
      }
    }
  }
  const awards = [...byKey.values()].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : b.y - a.y));
  if (awards.length < 100000) throw new Error(`落札実績が ${awards.length} 件しかありません。取得に失敗した可能性があります`);
  return {
    awards,
    info: {
      rowsRead, dropped, files: files.length, latestDiff, latestAllYear,
      latestDate: awards[0]?.d, firstDate: awards[awards.length - 1]?.d,
      unknownAgency: Object.fromEntries(unknownAgency), unknownMethod: Object.fromEntries(unknownMethod),
    },
  };
}

export function loadNotices(dir) {
  if (!fs.existsSync(dir)) return { notices: [], info: { months: 0 } };
  const notices = [];
  const months = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
  for (const f of months) {
    const obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const r of Object.values(obj)) notices.push(r);
  }
  notices.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.f < b.f ? 1 : a.f > b.f ? -1 : a.k < b.k ? -1 : 1));
  return { notices, info: { months: months.length, first: notices[notices.length - 1]?.d, last: notices[0]?.d } };
}
