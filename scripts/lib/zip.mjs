// ZIPの中身を読む（依存なし）。調達ポータルのZIPはCSVが1つ入っているだけなので、これで足りる
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readZip(file) {
  const buf = fs.readFileSync(file);
  // 末尾の「中央ディレクトリの終わり」を探す
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`ZIPとして読めません: ${file}`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`ZIPの目次が壊れています: ${file}`);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + csize);
    entries.push({ name, data: () => (method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : (() => { throw new Error(`未対応の圧縮方式 ${method}`); })()) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
