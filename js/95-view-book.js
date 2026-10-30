/* Copilot Feature-dle · Feature Book (collection) */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount, attrs } = FD.u;
  const ui = FD.ui;

  function statusOf(p, f, reveal) {
    const e = p.collection[f.id];
    if (e && e.solved > 0) return 'collected';
    if (e && e.seen > 0) return 'spotted';
    return reveal ? 'revealed' : 'locked';
  }

  function cardHtml(p, f, reveal) {
    const st = statusOf(p, f, reveal), e = p.collection[f.id], cat = FD.data.catMeta(f.category);
    const open = st !== 'locked';
    return html`<li><button class="fcard is-${st} c-${cat.color}" type="button" data-fid="${f.id}">
      <span class="fcard-ic" aria-hidden="true">${FD.icon(open ? cat.icon || 'sparkle' : 'lock', { size: 28 })}</span>
      <span class="fcard-name">${open ? f.name : 'Mystery feature'}</span>
      <span class="fcard-meta">${ui.diffChip(f.difficulty)}</span>
      <span class="fcard-foot">${st === 'collected' ? ui.stars(ui.mastery(e)) : st === 'spotted' ? html`<small>Spotted \u2013 solve it to collect</small>` : st === 'revealed' ? html`<small>Not played yet</small>` : html`<small>${f.category}</small>`}</span>
      <span class="sr-only">${st === 'collected' ? 'Collected' : st === 'spotted' ? 'Spotted' : open ? 'Not played yet' : 'Locked'}. ${f.difficulty}.</span>
    </button></li>`;
  }

  function detail(f, reveal) {
    const p = FD.store.profile(), st = statusOf(p, f, reveal), e = p.collection[f.id];
    const open = st !== 'locked';
    const hints = FD.hints.build(f);
    const body = open
      ? html`<div class="detail-chips">${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}${st === 'collected' ? ui.stars(ui.mastery(e)) : ''}${f.introduced ? html`<span class="chip">Introduced ${f.introduced}</span>` : ''}</div>
          ${FD.result.learn(f)}
          <h3 class="mini-h">The hints we use for this one</h3>
          <ol class="earlier-list">${hints.map((h, i) => html`<li class="c-${FD.play.hintColor(i + 1)}"><span class="e-n" aria-hidden="true">${i + 1}</span><span class="e-t">${h}</span></li>`)}</ol>`
      : html`<div class="detail-mystery">${FD.pip('think', { size: 110 })}<div><div class="detail-chips">${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}</div><p>You haven\u2019t met this one yet. Here\u2019s a teaser:</p><blockquote class="teaser">${hints[0]}</blockquote></div></div>`;
    const d = ui.dialog({
      title: open ? f.name : 'Mystery feature', cls: 'dlg-wide', body,
      actions: [{ id: 'close', label: 'Close' }, { id: 'play', label: st === 'collected' ? 'Practise again' : 'Play this one', cls: 'btn-primary' }],
      onClose: (v) => { if (v === 'play') ui.go('/play/' + f.id); else if (location.hash.startsWith('#/book/')) history.replaceState(null, '', '#/book'); }
    });
    return d;
  }

  FD.views.book = {
    title: 'Feature Book',
    render(main, ctx) {
      const lib = FD.lib, p = FD.store.profile(), reveal = FD.store.settings().unlockAll;
      const official = lib.features.filter((f) => !f.community);
      const have = official.filter((f) => FD.scoring.collected(p, f)).length;
      const spotted = official.filter((f) => !FD.scoring.collected(p, f) && p.collection[f.id] && p.collection[f.id].seen > 0).length;
      const master = FD.badges.masterStatus(p, lib);
      const f = { q: '', cat: 'all', diff: 'all', status: 'all' };

      main.innerHTML = flat(html`<div class="container hub">
        <header class="hub-head book-head">
          <div><p class="eyebrow">Your collection</p><h1>Feature Book</h1>
            <p class="lede">Every feature you solve lands here with what it does, why it matters and a prompt to try. ${reveal ? 'Facilitator mode is on, so the whole book is open.' : ''}</p></div>
          <div class="book-ring">${ui.ring(official.length ? (have / official.length) * 100 : 0, { size: 112, stroke: 12, color: 'green', label: `${have}/${official.length}`, sub: 'collected' })}</div>
        </header>
        <section class="card master-card" aria-labelledby="mast-h">
          <h2 id="mast-h">Feature Master status <small>${master.mastered} of ${master.total} categories mastered</small></h2>
          <ul class="master-list">${master.rows.map((r) => html`<li class="c-${r.category.color} ${r.master ? 'is-master' : ''}"><span class="m-ic" aria-hidden="true">${FD.icon(r.master ? 'crown' : r.category.icon || 'sparkle', { size: 20 })}</span><span class="m-name">${r.category.name}</span><span class="m-count">${r.have}/${r.total}</span>${ui.bar((r.have / r.total) * 100, r.category.color, r.category.name + ' progress')}</li>`)}</ul>
        </section>
        <form class="book-filters" role="search" aria-label="Filter the Feature Book">
          <div class="field grow"><label for="bk-q">Search</label><div class="search"><span aria-hidden="true">${FD.icon('search', { size: 18 })}</span><input id="bk-q" class="input" type="search" placeholder="Search collected features\u2026" autocomplete="off"></div></div>
          <div class="field"><label for="bk-cat">Category</label><select id="bk-cat" class="select"><option value="all">All</option>${lib.categories.filter((c) => lib.features.some((x) => x.category === c.name)).map((c) => html`<option>${c.name}</option>`)}</select></div>
          <div class="field"><label for="bk-diff">Difficulty</label><select id="bk-diff" class="select"><option value="all">All</option>${FD.config.difficulties.map((d) => html`<option>${d}</option>`)}</select></div>
          <div class="field"><label for="bk-st">Show</label><select id="bk-st" class="select"><option value="all">Everything</option><option value="collected">Collected</option><option value="spotted">Spotted</option><option value="locked">Not yet met</option></select></div>
        </form>
        <p class="muted" id="bk-count" aria-live="polite"></p>
        <ul class="fgrid" id="bk-grid"></ul>
      </div>`);

      const grid = $('#bk-grid', main);
      function draw() {
        const q = FD.match.norm(f.q);
        const list = lib.features.filter((x) => {
          if (f.cat !== 'all' && x.category !== f.cat) return false;
          if (f.diff !== 'all' && x.difficulty !== f.diff) return false;
          const st = statusOf(p, x, reveal);
          if (f.status === 'collected' && st !== 'collected') return false;
          if (f.status === 'spotted' && st !== 'spotted') return false;
          if (f.status === 'locked' && (st === 'collected' || st === 'spotted')) return false;
          if (q) { if (st === 'locked') return false; if (!FD.match.norm(x.name).includes(q) && !x.aliases.some((a) => FD.match.norm(a).includes(q))) return false; }
          return true;
        });
        mount(grid, list.map((x) => cardHtml(p, x, reveal)));
        $('#bk-count', main).textContent = `Showing ${list.length} of ${lib.features.length} features` + (spotted ? ` \u00B7 ${spotted} spotted` : '');
      }
      draw();
      $('.book-filters', main).addEventListener('submit', (e) => e.preventDefault());
      $('#bk-q', main).addEventListener('input', (e) => { f.q = e.target.value; draw(); });
      $('#bk-cat', main).addEventListener('change', (e) => { f.cat = e.target.value; draw(); });
      $('#bk-diff', main).addEventListener('change', (e) => { f.diff = e.target.value; draw(); });
      $('#bk-st', main).addEventListener('change', (e) => { f.status = e.target.value; draw(); });
      grid.addEventListener('click', (e) => { const b = e.target.closest('[data-fid]'); if (b) detail(lib.byId[b.dataset.fid], reveal); });
      if (ctx.params.id && lib.byId[ctx.params.id]) detail(lib.byId[ctx.params.id], reveal);
    }
  };
})();
