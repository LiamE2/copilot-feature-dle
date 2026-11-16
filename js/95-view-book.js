/* Copilot Feature-dle · Feature Book (collection). Every feature is open: tap one to see everything about it, in three layers that match the three game modes:
     Know it     (Feature Hunt: what it does and why it matters)
     Use it      (Scenario Match: the example scenarios)
     Prompt it   (Prompt Lab: a starter prompt, and the prompts you find by playing)
   A feature is Not collected until one of its puzzles is done, Spotted if a puzzle showed its answer, Collected once any puzzle is done and Mastered once all of them are.
   The Feature Tracker at the top follows each category through all three game modes. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, mount, attrs } = FD.u;
  const ui = FD.ui;
  const META = FD.puzzles.META;

  /* three pies below the text of a card: a layer's icon filling in as its puzzles are done (a feature with no Prompt Lab prompts yet has two) */
  function pies(L) {
    const list = FD.puzzles.KINDS.filter((k) => k !== 'prompt' || L.prompt.total);
    return html`<span class="lpies" aria-hidden="true">${list.map((k) => { const pr = FD.result.progressOf(k, L); return ui.pie(k, pr.done, pr.total, { size: 30 }); })}</span><span class="sr-only">${list.map((k) => `${META[k].verb}: ${FD.result.progressText(k, L)}.`).join(' ')}</span>`;
  }

  /* White and grey until something is done (grey with a dashed outline if it has been spotted), a wash of its category colour once any puzzle is done,
     and the full colour once every puzzle is. The status always sits above the pies. Difficulty is a surprise kept for the popup. */
  function cardHtml(p, f) {
    const L = FD.scoring.layers(p, f), st = FD.scoring.bookState(p, f), cat = FD.data.catMeta(f.category);
    return html`<li><button class="fcard is-${st} c-${cat.color}" type="button" data-fid="${f.id}" aria-haspopup="dialog">
      <span class="fcard-ic" aria-hidden="true">${FD.icon(cat.icon || 'sparkle', { size: 28 })}</span>
      <span class="fcard-name">${f.name}</span>
      <span class="fcard-foot">${ui.stateChip(st)}${pies(L)}</span>
      <span class="sr-only">${st === 'new' || st === 'spotted' ? '' : f.category + '. '}Opens the full details.</span>
    </button></li>`;
  }

  /* ---------- the popup: the same three layers Copilot Learning Mode shows ---------- */
  function detail(f) {
    const p = FD.store.profile(), st = FD.scoring.bookState(p, f), cat = FD.data.catMeta(f.category);
    const d = ui.dialog({
      title: f.name, cls: 'dlg-wide dlg-book',
      body: html`<div class="detail-chips">${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}${ui.stateChip(st, cat.color)}${f.introduced ? html`<span class="chip">Introduced ${f.introduced}</span>` : ''}</div>
        ${FD.result.learn(f, { idp: 'bk-' })}`,
      onClose: () => { if (location.hash.startsWith('#/book/')) history.replaceState(null, '', '#/book'); }
    });
    /* a link to another screen closes the popup on its way */
    d.addEventListener('click', (e) => { if (e.target.closest('[data-close-dlg]')) d.close(); });
    return d;
  }
  FD.bookDetail = detail;
  ui.actions['met-open'] = (el) => { const f = FD.lib.byId[el.dataset.id]; if (f) detail(f); };

  /* ---------- the Feature Tracker ---------- */
  const barColor = (k) => (META[k].color === 'blue-50' ? 'blue' : META[k].color);
  const layerKey = { hunt: 'know', match: 'use', prompt: 'prompt' };
  /* one category opened up: how many of its puzzles are done in each game mode (a ring and a bar for each), and every feature in it with its own pies */
  function trackerDetail(row) {
    const c = row.category, pz = row.puzzles, sum = (k) => pz[layerKey[k]];
    const done = FD.puzzles.KINDS.reduce((a, k) => a + sum(k).done, 0), total = FD.puzzles.KINDS.reduce((a, k) => a + sum(k).total, 0);
    return html`<div class="trk-head"><h3 id="trk-detail-h">${c.name}<small>${row.total} ${row.total === 1 ? 'feature' : 'features'} \u00B7 ${row.mastered} mastered</small></h3><button class="btn btn-ghost btn-sm" type="button" data-action="trk-close">${FD.icon('x', { size: 16 })}Close</button></div>
      <div class="coll-grid">
        <div class="coll-ring">${ui.ring(total ? (done / total) * 100 : 0, { size: 128, stroke: 14, color: c.color, label: `${done}/${total}`, sub: 'puzzles' })}</div>
        <div class="coll-bars">${FD.puzzles.KINDS.map((k) => { const M = META[k], pr = sum(k); return html`<div class="cb"><span class="cb-label"><span class="chip c-${M.color}">${FD.icon(M.icon, { size: 14 })}${M.verb}</span><small>${M.name}</small></span>${ui.bar(pr.total ? (pr.done / pr.total) * 100 : 0, barColor(k), `${M.verb} puzzles done in ${c.name}`)}<span class="cb-n">${pr.done}/${pr.total}</span></div>`; })}</div>
      </div>
      <ul class="trk-feats" aria-label="Features in ${c.name}">${row.features.map((f, i) => {
        const L = row.layers[i], st = FD.scoring.bookState(FD.store.profile(), f), cc = FD.data.catMeta(f.category);
        return html`<li><button class="trk-feat c-${cc.color}" type="button" data-action="met-open" data-id="${f.id}"><span class="trk-name">${f.name}</span>
          <span class="trk-pies">${FD.puzzles.KINDS.map((k) => { const pr = FD.result.progressOf(k, L); return pr.total || k !== 'prompt' ? html`<span class="trk-pie">${ui.pie(k, pr.done, pr.total, { size: 26 })}<span class="trk-n"><span class="sr-only">${META[k].verb}: </span>${pr.done}/${pr.total}</span></span>` : html`<span class="trk-pie is-none"><span class="trk-n"><span class="sr-only">${META[k].verb}: no prompts yet</span><span aria-hidden="true">\u2013</span></span></span>`; })}</span>
          <span class="trk-st">${ui.stateChip(st, cc.color)}</span></button></li>`;
      })}</ul>`;
  }

  FD.views.book = {
    title: 'Feature Book',
    render(main, ctx) {
      const lib = FD.lib, p = FD.store.profile(), cfg = FD.config;
      const states = Object.fromEntries(lib.features.map((x) => [x.id, FD.scoring.bookState(p, x)]));
      const have = lib.features.filter((x) => states[x.id] === 'collected' || states[x.id] === 'mastered').length;
      const spotted = lib.features.filter((x) => states[x.id] === 'spotted').length;
      const master = FD.badges.masterStatus(p, lib);
      const f = { q: '', cat: 'all', status: 'all' };
      let openCat = '';

      const isHave = (x) => states[x.id] === 'collected' || states[x.id] === 'mastered';
      /* the numbers beside a bar: collected out of all, then how many of those are mastered (spoken in full; the short form is for the eye) */
      const nums = (h, t, m) => html`<span class="sr-only">${h} of ${t} features collected, ${m} mastered.</span><span aria-hidden="true"><strong>${h}/${t}</strong> collected \u00B7 <strong>${m}</strong> mastered</span>`;

      main.innerHTML = flat(html`<div class="container hub">
        <header class="hub-head book-head">
          <div><p class="eyebrow">Your collection</p><h1>Feature Book</h1>
            <p class="lede">Every Copilot feature lives here. Tap any one to Know it, Use it and Prompt it. Solve a puzzle to collect it, and finish them all to master it.</p></div>
          <div class="book-ring">${ui.ring(lib.features.length ? (have / lib.features.length) * 100 : 0, { size: 112, stroke: 12, color: 'green', label: `${have}/${lib.features.length}`, sub: 'collected' })}</div>
        </header>
        <section class="card master-card tracker" aria-labelledby="trk-h">
          <h2 id="trk-h">Feature Tracker</h2>
          <p class="muted">Collect a feature with any puzzle, and master it by finishing them all. Tap a category to see how far you are in each game mode.</p>
          <h3 class="mini-h">Features by difficulty</h3>
          <div class="coll-bars trk-levels">${cfg.difficulties.map((d) => { const fs = lib.features.filter((x) => x.difficulty === d), h = fs.filter(isHave).length, m = fs.filter((x) => states[x.id] === 'mastered').length; return html`<div class="cb"><span class="cb-label">${ui.diffChip(d)}</span>${ui.nbar(h, m, fs.length, ui.DIFF_COLOR[d])}<span class="cb-nums">${nums(h, fs.length, m)}</span></div>`; })}</div>
          <h3 class="mini-h" id="mast-h">Features by category</h3>
          <ul class="master-list" aria-labelledby="mast-h">${master.rows.map((r) => html`<li><button class="mtile c-${r.category.color} ${r.master ? 'is-master' : ''}" type="button" data-action="trk-open" data-cat="${r.category.name}" aria-expanded="false" aria-controls="trk-detail"><span class="m-ic" aria-hidden="true">${FD.icon(r.master ? 'crown' : r.category.icon || 'sparkle', { size: 20 })}</span><span class="m-name">${r.category.name}</span>${ui.nbar(r.have, r.mastered, r.total, r.category.color)}<span class="m-nums">${nums(r.have, r.total, r.mastered)}${r.master ? html`<span class="sr-only"> Every feature in this category is mastered.</span>` : ''}</span></button></li>`)}</ul>
          <div class="trk-detail" id="trk-detail" role="region" aria-labelledby="trk-detail-h" hidden></div>
        </section>
        <form class="book-filters" role="search" aria-label="Filter the Feature Book">
          <div class="field grow"><label for="bk-q">Search</label><div class="search"><span aria-hidden="true">${FD.icon('search', { size: 18 })}</span><input id="bk-q" class="input" type="search" placeholder="Search features\u2026" autocomplete="off"></div></div>
          <div class="field"><label for="bk-cat">Category</label><select id="bk-cat" class="select"><option value="all">All</option>${lib.categories.filter((c) => lib.features.some((x) => x.category === c.name)).map((c) => html`<option>${c.name}</option>`)}</select></div>
          <div class="field"><label for="bk-st">Show</label><select id="bk-st" class="select"><option value="all">Everything</option><option value="new">Not collected</option><option value="spotted">Spotted</option><option value="collected">Collected</option><option value="mastered">Mastered</option></select></div>
        </form>
        <p class="muted" id="bk-count" aria-live="polite"></p>
        <ul class="fgrid" id="bk-grid"></ul>
      </div>`);

      /* the Feature Tracker: tapping a category opens it under the tiles (tapping it again, or Close, puts it away) */
      const detailEl = $('#trk-detail', main), tiles = Array.from(main.querySelectorAll('.mtile'));
      function paintTracker(focusTile) {
        tiles.forEach((t) => { const on = t.dataset.cat === openCat; t.classList.toggle('is-open', on); t.setAttribute('aria-expanded', String(on)); });
        const row = master.rows.find((r) => r.category.name === openCat);
        detailEl.hidden = !row;
        detailEl.className = 'trk-detail' + (row ? ' c-' + row.category.color : '');
        detailEl.innerHTML = row ? flat(trackerDetail(row)) : '';
        if (row) detailEl.scrollIntoView({ block: 'nearest', behavior: FD.u.reduceMotion() ? 'auto' : 'smooth' });
        if (focusTile) { const t = tiles.find((x) => x.dataset.cat === openCat) || tiles[0]; if (t) t.focus({ preventScroll: true }); }
      }
      ui.actions['trk-open'] = (el) => { openCat = openCat === el.dataset.cat ? '' : el.dataset.cat; paintTracker(false); };
      ui.actions['trk-close'] = () => { const was = openCat; openCat = ''; paintTracker(false); const t = tiles.find((x) => x.dataset.cat === was); if (t) t.focus(); };

      const grid = $('#bk-grid', main);
      function draw() {
        const q = FD.match.norm(f.q);
        const list = lib.features.filter((x) => {
          const s = states[x.id];
          if (f.cat !== 'all' && x.category !== f.cat) return false;
          if (f.status === 'collected' ? !(s === 'collected' || s === 'mastered') : f.status !== 'all' && s !== f.status) return false; /* Collected includes the mastered ones */
          if (q && !FD.match.norm(x.name).includes(q) && !x.aliases.some((a) => FD.match.norm(a).includes(q))) return false;
          return true;
        });
        mount(grid, list.map((x) => cardHtml(p, x)));
        $('#bk-count', main).textContent = `Showing ${list.length} of ${lib.features.length} features` + (spotted ? ` \u00B7 ${spotted} spotted` : '');
      }
      draw();
      $('.book-filters', main).addEventListener('submit', (e) => e.preventDefault());
      $('#bk-q', main).addEventListener('input', (e) => { f.q = e.target.value; draw(); });
      $('#bk-cat', main).addEventListener('change', (e) => { f.cat = e.target.value; draw(); });
      $('#bk-st', main).addEventListener('change', (e) => { f.status = e.target.value; draw(); });
      grid.addEventListener('click', (e) => { const b = e.target.closest('[data-fid]'); if (b) detail(lib.byId[b.dataset.fid]); });
      if (ctx.params.id && lib.byId[ctx.params.id]) detail(lib.byId[ctx.params.id]);
    }
  };
})();
