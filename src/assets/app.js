// 会社名・機関名の検索（索引は端末に読み込んで照合する。入力した文字は外に送らない）とリンクのコピー
(() => {
  const script = document.currentScript;
  const base = script ? script.src.replace(/assets\/app\.js.*$/, '') : '/';
  const ver = script ? (script.src.split('?v=')[1] || '') : '';
  let index = null;
  let loading = null;

  const KIND = /株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|公益社団法人|一般財団法人|公益財団法人|社会福祉法人|医療法人|学校法人|特定非営利活動法人|独立行政法人|国立研究開発法人|国立大学法人|\(株\)|\(有\)|㈱|㈲/g;
  const norm = (s) => s.normalize('NFKC').toLowerCase()
    .replace(KIND, '')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s・･.,，、。\-‐－—―ー〜~&＆'’"“”()（）［］\[\]]/g, '');

  const GROUPS = [
    { key: 'a', label: '府省の落札結果', url: (r) => `${base}fusho/${r[0]}/`, meta: (r) => `国の落札 ${r[2].toLocaleString()}件`, max: 3 },
    { key: 'o', label: '機関の入札公告', url: (r) => `${base}kikan/${r[0]}/`, meta: (r) => `${r[2] ? `${r[2]}・` : ''}直近30日の公告 ${r[3]}件`, max: 4 },
    { key: 'c', label: '会社の落札実績', url: (r) => `${base}kigyo/${r[0]}/`, meta: (r) => `国の落札 ${r[2].toLocaleString()}件・法人番号 ${r[0]}`, max: 6 },
  ];

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch(`${base}assets/index.json${ver ? `?v=${ver}` : ''}`)
        .then((r) => r.json())
        .then((j) => {
          index = j;
          for (const g of GROUPS) index[`${g.key}n`] = j[g.key].map((row) => norm(row[1]));
          return index;
        });
    }
    return loading;
  }

  function searchGroup(g, k, limit) {
    const rows = index[g.key];
    const n = index[`${g.key}n`];
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const p = n[i].indexOf(k);
      if (p < 0) continue;
      // 先頭一致・名前の短さ・索引の順（落札額・公告の多い順）で並べる
      out.push([p === 0 ? 0 : 1, n[i].length - k.length, i]);
    }
    out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    return { total: out.length, rows: out.slice(0, limit).map(([, , i]) => rows[i]) };
  }

  function search(q, perGroup) {
    const k = norm(q);
    if (!k) return [];
    return GROUPS.map((g) => ({ g, ...searchGroup(g, k, perGroup || g.max) })).filter((x) => x.rows.length);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function bind(form) {
    const input = form.querySelector('.sb-i');
    const box = form.querySelector('.sb-r');
    if (!input || !box) return;
    let flat = [];
    let sel = -1;
    const close = () => { box.hidden = true; sel = -1; };
    const render = () => {
      if (!input.value.trim()) { close(); return; }
      const groups = search(input.value);
      flat = [];
      let html = '';
      for (const { g, rows } of groups) {
        html += `<div class="sb-h">${g.label}</div>`;
        for (const r of rows) {
          const i = flat.push(g.url(r)) - 1;
          html += `<a href="${g.url(r)}"${i === sel ? ' class="on"' : ''}>${esc(r[1])}<small>${esc(g.meta(r))}</small></a>`;
        }
      }
      box.innerHTML = html || '<div class="sb-none">見つかりませんでした。「株式会社」を外したり、一部だけで探してください。</div>';
      box.hidden = false;
    };
    input.addEventListener('focus', () => { load().then(() => input.value && render()); });
    input.addEventListener('input', () => { sel = -1; load().then(render); });
    input.addEventListener('keydown', (e) => {
      if (box.hidden || !flat.length) return;
      if (e.key === 'ArrowDown') { sel = Math.min(flat.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(-1, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Escape') close();
    });
    form.addEventListener('submit', (e) => {
      if (sel >= 0 && flat[sel]) { e.preventDefault(); location.href = flat[sel]; }
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
  }
  document.querySelectorAll('form.sb').forEach(bind);

  // 検索ページ
  const results = document.getElementById('results');
  if (results) {
    const q = new URLSearchParams(location.search).get('q') || '';
    const input = document.querySelector('.sb-page .sb-i');
    if (input) input.value = q;
    if (q) {
      results.textContent = '読み込み中…';
      load().then(() => {
        const groups = search(q, 100);
        if (!groups.length) {
          results.innerHTML = `<p>「${esc(q)}」は見つかりませんでした。「株式会社」を外したり、一部だけで探してください。</p>`;
          return;
        }
        results.innerHTML = groups.map(({ g, rows, total }) => `<h2>${g.label}（${total > rows.length ? `${total}件中${rows.length}件` : `${total}件`}）</h2><ul>${rows.map((r) => `<li><a href="${g.url(r)}">${esc(r[1])}</a><small>${esc(g.meta(r))}</small></li>`).join('')}</ul>`).join('');
      }).catch(() => { results.textContent = '索引を読み込めませんでした。時間をおいてお試しください。'; });
    }
  }

  // リンクのコピー
  document.querySelectorAll('.share').forEach((el) => {
    const btn = el.querySelector('.sh-copy');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const u = el.dataset.url || location.href;
      const done = () => { btn.textContent = 'コピーしました'; setTimeout(() => { btn.textContent = 'リンクをコピー'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(done, () => prompt('このリンクをコピーしてください', u));
      else prompt('このリンクをコピーしてください', u);
    });
  });
})();
