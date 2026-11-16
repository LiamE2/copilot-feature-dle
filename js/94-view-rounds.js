/* Copilot Feature-dle · games of rounds in Free Play and Feature Hunt.
   A game is a few rounds (the player chooses 1 to 10 on the setup screen). Free Play deals one puzzle a round from the game modes that are ticked (Feature Hunt, Scenario Match,
   Prompt Lab); Feature Hunt deals Feature Hunt puzzles only. Every puzzle counts the moment it is answered (its points are XP, and it joins the stats and the Feature Book),
   and the game is saved as it goes, so leaving never loses it. A rank-up is held until the game is over or you leave it.
   A game of one round is just a puzzle: it ends with the full answer and Play again. A longer game moves on with Next round and ends on a results page.
   The setup screens live in 94-view-modes.js; this file runs the game itself and shows its results. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, plural, announce } = FD.u;
  const ui = FD.ui;
  const cfg = FD.config;

  const MODES = {
    free: { id: 'free', key: 'rounds:free', name: 'Free Play', icon: 'shuffle', cfg: 'freePlay' },
    hunt: { id: 'hunt', key: 'rounds:hunt', name: 'Feature Hunt', icon: 'search', cfg: 'featureHunt' }
  };
  const KEEP_MS = 14 * 24 * 3600 * 1000; /* a game left alone for two weeks is let go */
  /* mode: which game is on screen (free or hunt), main: where the view draws, setup: draws the setup screen again, run: the game being played (saved as it goes),
     ctl / qctl: the Feature Hunt puzzle or the question on screen, last: how the game was set up (for Play again) */
  const eng = { mode: null, main: null, setup: null, run: null, ctl: null, qctl: null, unhook: null, last: null };

  /* ---------- the choices: how many rounds, and what to deal ---------- */
  const limits = (mode) => cfg[MODES[mode].cfg].rounds;
  const withKinds = (mode, f) => Object.assign({}, f, { kinds: mode === 'hunt' ? ['hunt'] : FD.puzzles.kindsOf(f) });
  /* the most rounds a game can have: the limit, or fewer when the choices leave fewer puzzles (a puzzle is never dealt twice in a game) */
  const maxRounds = (mode, filters) => { const r = limits(mode), n = filters ? FD.puzzles.count(withKinds(mode, filters)) : r.max; return Math.max(r.min, Math.min(r.max, n)); };
  const clamp = (mode, n, filters) => { const r = limits(mode); return Math.min(maxRounds(mode, filters), Math.max(r.min, Math.round(+n || r.defaultRounds))); };
  const libCategories = () => FD.lib.categories.filter((c) => FD.lib.features.some((f) => f.category === c.name)).map((c) => c.name);
  function cleanFilters(mode, f = {}) {
    const have = libCategories();
    return { kinds: withKinds(mode, f).kinds, difficulty: cfg.difficulties.includes(f.difficulty) ? f.difficulty : 'all', category: FD.u.selList(f.category).filter((c) => have.includes(c)), prioritise: f.prioritise !== false };
  }

  /* ---------- the saved game ---------- */
  const pointsOf = (r) => r.items.reduce((a, it) => a + (it.won ? it.points || 0 : 0), 0);
  const solvedOf = (r) => r.items.filter((it) => it.won).length;
  const last = (r) => r.i >= r.total - 1;
  /* the game waiting for you in a mode (or nothing): checked over, because it comes from storage */
  function read(mode) {
    const M = MODES[mode], d = FD.store.getActive(M.key);
    if (!d) return null;
    if (typeof d !== 'object' || d.mode !== mode || !Array.isArray(d.items) || !(+d.total >= 1) || Date.now() - (+d.savedAt || +d.startedAt || 0) > KEEP_MS) { FD.store.clearActive(M.key); return null; }
    const r = limits(mode);
    d.total = Math.min(r.max, Math.max(r.min, Math.round(+d.total)));
    d.items = d.items.filter((it) => it && typeof it === 'object' && FD.puzzles.isKind(it.kind) && FD.lib.byId[it.fid || it.id]).slice(0, d.total);
    d.i = Math.min(d.total - 1, Math.max(0, Math.round(+d.i) || 0));
    d.done = !!d.done && d.items.length === d.i + 1;
    if (!d.done && d.items.length > d.i) d.items.length = d.i;
    if (d.items.length < d.i) d.i = d.items.length;
    d.used = Array.isArray(d.used) ? d.used.filter((k) => typeof k === 'string').slice(-30) : [];
    d.filters = cleanFilters(mode, d.filters);
    return d;
  }
  /* what is on screen is saved with the game: a Feature Hunt puzzle (its hints and guesses), or a question (which one, in what order, and any weaker picks so far) */
  function persist() {
    const r = eng.run; if (!r || r.over) return;
    r.savedAt = Date.now();
    if (eng.ctl && !eng.ctl.game.over) r.game = eng.ctl.game.serialize();
    if (eng.qctl && !eng.qctl.state.done) r.q = { kind: eng.qctl.kind, id: eng.qctl.scn.id, order: eng.qctl.state.order.slice(), wrong: eng.qctl.state.wrong.slice() };
    FD.store.setActive(MODES[r.mode].key, r);
  }
  function savedQuestion(q) {
    if (!q || !FD.puzzles.isKind(q.kind) || q.kind === 'hunt') return null;
    const scn = FD.quiz(q.kind).byId[q.id];
    if (!scn || !FD.lib.byId[scn.feature]) return null;
    return { kind: q.kind, scn, order: FD.quizUI.validOrder(q.order) ? q.order : FD.quizUI.freshOrder(), wrong: Array.isArray(q.wrong) ? q.wrong : [] };
  }

  /* ---------- starting, resuming, leaving ---------- */
  const destroyPuzzle = () => { if (eng.ctl) eng.ctl.destroy(); eng.ctl = null; if (eng.qctl) eng.qctl.destroy(); eng.qctl = null; };
  const unhook = () => { if (eng.unhook) { eng.unhook(); eng.unhook = null; } };
  function begin() {
    unhook();
    /* hiding the page or closing the app pauses the puzzle's clock, and the game is saved as it was */
    eng.unhook = FD.play.track({ suspend: () => { if (eng.ctl) eng.ctl.suspend(); persist(); }, wake: () => { if (eng.ctl) eng.ctl.wake(); persist(); } });
    ui.holdRankUp(eng.run.total > 1);
    show();
  }
  function start(mode, total, filters) {
    const f = cleanFilters(mode, filters), n = clamp(mode, total, f);
    if (!FD.puzzles.count(withKinds(mode, f))) { ui.toast('Nothing matches those choices. Try another difficulty, category or more game modes.', { icon: 'x' }); return false; }
    destroyPuzzle();
    eng.mode = mode; eng.last = { mode, total: n, filters: f };
    eng.run = { v: 1, mode, total: n, i: 0, items: [], done: false, filters: f, used: [], game: null, q: null, startedAt: Date.now(), savedAt: Date.now() };
    FD.store.setActive(MODES[mode].key, eng.run);
    begin();
    return true;
  }
  function resume(mode) {
    const r = read(mode); if (!r) return false;
    destroyPuzzle();
    eng.mode = mode; eng.run = r; eng.last = { mode, total: r.total, filters: r.filters };
    begin();
    return true;
  }
  const discard = (mode) => FD.store.clearActive(MODES[mode].key);
  /* a view hands over its screen: main is where the game draws, setup draws the setup screen again (Change settings) */
  function attach(mode, main, setup) { destroyPuzzle(); unhook(); eng.mode = mode; eng.main = main; eng.setup = setup; eng.run = null; }
  /* leaving the screen keeps the game (it was saved as it went) and lets a waiting rank-up pop up */
  function detach() {
    if (eng.run) { if (eng.ctl) eng.ctl.suspend(); persist(); }
    destroyPuzzle(); unhook(); ui.holdRankUp(false);
    eng.run = null; eng.main = null; eng.setup = null; eng.mode = null;
  }

  /* ---------- the round meter: one dot a round, and the points so far ---------- */
  const tier = (it) => (it.kind === 'hunt' ? (it.hints <= 2 ? 1 : it.hints <= 4 ? 2 : 3) : Math.min(3, Math.max(1, it.tries || 1)));
  const dots = (r) => Array.from({ length: r.total }, (_, i) => { const it = r.items[i]; return html`<li class="${it ? (it.won ? 'is-done t' + tier(it) : 'is-done miss') : i === r.i ? 'is-now' : ''}"></li>`; });
  const meterLabel = (r) => `Round ${r.i + 1} of ${r.total}. ${plural(pointsOf(r), 'point')} so far.`;
  const meter = (r) => (r.total > 1 ? html`<div class="rounds-meter-row"><div class="pl-meter" role="group" aria-label="${meterLabel(r)}" id="pl-meter"><ol class="pl-dots" aria-hidden="true">${dots(r)}</ol><p class="pl-score" aria-hidden="true"><strong>${pointsOf(r)}</strong> points</p></div></div>` : '');
  function updateMeter() {
    const r = eng.run, m = $('#pl-meter', eng.main); if (!r || !m) return;
    m.setAttribute('aria-label', meterLabel(r));
    m.querySelector('.pl-dots').innerHTML = flat(dots(r));
    m.querySelector('.pl-score strong').textContent = pointsOf(r);
  }
  /* the heading's small line: the mode, which game mode this puzzle is (in Free Play), and the round */
  const eyebrow = (r, kind) => [MODES[r.mode].name].concat(r.mode === 'free' ? [FD.puzzles.name(kind)] : [], r.total > 1 ? [`Round ${r.i + 1} of ${r.total}`] : []);

  /* ---------- a round ---------- */
  function show() {
    const r = eng.run;
    if (r.done) { advance(); return; } /* it was answered before you left: carry on with the next one */
    const g = r.game ? FD.Game.restore(r.game) : null, q = g && !g.over ? null : savedQuestion(r.q);
    if (g && !g.over) mountHunt(g); else if (q) mountQuestion(q); else dealNext();
    if (r.total > 1) announce(`Round ${r.i + 1} of ${r.total}.`);
  }
  /* the next puzzle: a game mode (of the ones ticked), then something you haven't met, never one this game has already had */
  function dealNext() {
    const r = eng.run, pz = FD.puzzles.pick(r.filters, { exclude: r.used });
    if (!pz) { if (r.items.length) finish(); else { FD.store.clearActive(MODES[r.mode].key); if (eng.setup) eng.setup(); } return; }
    r.used.push(FD.puzzles.keyOf(pz.kind, pz.kind === 'hunt' ? pz.feature.id : pz.scn.id));
    if (pz.kind === 'hunt') mountHunt(new FD.Game(pz.feature, { mode: r.mode }));
    else mountQuestion({ kind: pz.kind, scn: pz.scn, order: FD.quizUI.freshOrder(), wrong: [] });
  }
  function roundDone(item) {
    const r = eng.run;
    r.items.push(item); r.done = true; r.game = null; r.q = null;
    if (r.total === 1) { r.over = true; FD.store.clearActive(MODES[r.mode].key); } else persist(); /* a single puzzle that is answered is over: nothing is left to resume */
    updateMeter();
  }
  const endActions = () => {
    const r = eng.run, M = MODES[r.mode];
    if (r.total === 1) return [{ label: 'Play again', action: 'rounds-again', icon: M.icon, cls: 'btn-primary' }, { label: 'Change settings', action: 'rounds-setup', icon: 'sliders' }, { label: 'Feature Book', href: '#/book', icon: 'book' }];
    return [{ label: last(r) ? 'See my results' : 'Next round', action: 'rounds-next', icon: 'right', after: true, cls: 'btn-primary' }, { label: 'Feature Book', href: '#/book', icon: 'book' }];
  };
  const questionButtons = () => {
    const r = eng.run, M = MODES[r.mode];
    if (r.total === 1) return html`<button class="btn btn-primary" type="button" data-action="rounds-again" id="pl-next">${FD.icon(M.icon, { size: 18 })}Play again</button><button class="btn btn-ghost" type="button" data-action="rounds-setup">${FD.icon('sliders', { size: 18 })}Change settings</button>`;
    return html`<button class="btn btn-primary" type="button" data-action="rounds-next" id="pl-next">${last(r) ? 'See my results' : 'Next round'} ${FD.icon('right', { size: 18 })}</button>`;
  };

  /* a Feature Hunt puzzle: its full answer and Learning Mode, with the way on at the top and the bottom */
  function mountHunt(game) {
    const r = eng.run;
    destroyPuzzle();
    eng.main.innerHTML = '<div class="container play-wrap" id="play-root"></div>';
    eng.ctl = FD.play.mount($('#play-root', eng.main), game, {
      mode: r.mode, title: eyebrow(r, 'hunt').join(' \u00B7 '), headExtra: meter(r),
      actions: () => endActions(),
      next: () => (r.total > 1 ? { label: last(r) ? 'See my results' : 'Next round', action: 'rounds-next', icon: 'right' } : null),
      onGuess: () => persist(),
      onFinish: (g, data) => roundDone({ kind: 'hunt', id: g.f.id, fid: g.f.id, won: g.won, points: g.won && data.breakdown ? data.breakdown.total : 0, xp: data.xp || 0, hints: g.hintsUsed })
    });
    persist();
    ui.scrollTop();
  }
  /* a Scenario Match or Prompt Lab question, answered the way those game modes answer it. Three weaker picks and it is a miss: nothing is earned, the answer is shown, and it
     goes to Needs Another Look. */
  function mountQuestion(st) {
    const r = eng.run, { kind, scn } = st, f = FD.lib.byId[scn.feature];
    destroyPuzzle();
    eng.main.innerHTML = flat(html`<div class="container play-wrap pl-wrap">${FD.quizUI.head(kind, eyebrow(r, kind))}${meter(r)}<div id="pl-body"></div></div>`);
    eng.qctl = FD.quizUI.mount($('#pl-body', eng.main), {
      kind, scn, order: st.order, wrong: st.wrong,
      onWrong: () => persist(),
      record: (res) => {
        const won = res.solved !== false, pts = won ? res.points : 0;
        const out = FD.store.recordQuizRound(kind, { id: scn.id, tries: res.tries, points: pts, solved: won }, f, { mode: r.mode });
        roundDone({ kind, id: scn.id, fid: f.id, won, points: pts, xp: out.xp, tries: res.tries });
        return out;
      },
      finish: () => ({ buttons: questionButtons() })
    });
    persist();
    ui.scrollTop();
  }

  /* on to the next round (or, once the game is over, the results) */
  function step() {
    const r = eng.run;
    r.i++; r.done = false; r.game = null; r.q = null;
    persist();
    show();
  }
  function advance() { if (last(eng.run)) finish(); else step(); }
  ui.actions['rounds-next'] = () => { const r = eng.run; if (!r || !r.done) return; if (last(r)) finish(); else { step(); ui.scrollTop(); } };
  ui.actions['rounds-again'] = () => { const l = eng.last; if (l) start(l.mode, l.total, l.filters); };
  ui.actions['rounds-setup'] = () => {
    destroyPuzzle(); unhook(); ui.holdRankUp(false);
    eng.run = null;
    if (!eng.setup) return;
    eng.setup(); ui.scrollTop();
    const h = eng.main && eng.main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  };

  /* ---------- the end of a game ---------- */
  function finish() {
    const r = eng.run, M = MODES[r.mode], items = r.items.slice();
    destroyPuzzle(); unhook();
    FD.store.clearActive(M.key);
    eng.run = null;
    const out = FD.store.recordRoundsGame(r.mode, items);
    const xp = items.reduce((a, it) => a + (it.xp || 0), 0), n = items.length;
    FD.fx.play('win'); if (out.solved) FD.fx.confetti({ count: out.solved === n ? 220 : 120 });
    ui.celebrate(out);
    const [title, lede] = out.solved === n ? ['Clean sweep!', `You solved all ${plural(n, 'puzzle')}.`]
      : out.solved / n >= 0.6 ? ['Nicely done!', `You solved ${out.solved} of ${n}.`]
        : ['Good effort!', out.solved ? `You solved ${out.solved} of ${n}.` : 'No solves this time, but you met a few new features.'];
    const missed = items.filter((it) => !it.won).length;
    const p = FD.store.profile(), rk = FD.scoring.rank(p.xp);
    const kinds = FD.puzzles.KINDS.filter((k) => items.some((it) => it.kind === k && it.won));
    const outcome = (it) => (it.won ? html`<span class="chip chip-solid c-green">Solved +${it.points}</span>` : html`<span class="chip chip-solid c-orange">Missed</span>`);
    const rows = items.map((it) => ({ f: FD.lib.byId[it.fid || it.id], it })).filter((x) => x.f);
    eng.main.innerHTML = flat(html`<div class="container hub"><section class="speed-summary rounds-summary card" aria-labelledby="ss-h">
      <div class="ss-top">${FD.pip(out.solved ? 'cheer' : 'hello', { size: 130 })}<div><p class="eyebrow">${[M.name + ' complete', plural(n, 'round')].join(' \u00B7 ')}</p><h1 id="ss-h">${title}</h1>
        <p class="lede">${lede}${missed ? ` The ${missed === 1 ? 'one' : 'ones'} you missed ${missed === 1 ? 'is' : 'are'} waiting in Needs Another Look.` : ''}</p></div></div>
      <div class="ss-stats"><div><strong>${out.points}</strong><span>points</span></div><div><strong>${out.solved}/${n}</strong><span>solved</span></div><div><strong>+${xp}</strong><span>XP earned</span></div><div><strong>${p.roundsBest || 0}</strong><span>best game${out.best ? ' (new!)' : ''}</span></div></div>
      <div class="rank-row"><div><strong>${rk.rank.name}</strong><small class="muted">${rk.next ? ` \u00B7 ${rk.toNext} XP to ${rk.next.name}` : ' \u00B7 top rank!'}</small></div>${ui.bar(rk.pct, rk.rank.color, 'Progress to the next rank')}</div>
      ${r.mode === 'free' && kinds.length > 1 ? html`<div class="chips ss-kinds" role="list" aria-label="Solved in each game mode">${kinds.map((k) => { const m = FD.puzzles.META[k]; return html`<span class="chip c-${m.color}" role="listitem">${FD.icon(m.icon, { size: 14 })}${m.name}: ${items.filter((it) => it.kind === k && it.won).length} solved</span>`; })}</div>` : ''}
      <section class="met" aria-labelledby="met-h">
        <h2 id="met-h">Puzzles you played</h2>
        <p class="met-help">${FD.icon('info', { size: 18 })}Tap any puzzle below to see everything about its feature: Know it, Use it and Prompt it.</p>
        <ul class="met-grid">${rows.map(({ f, it }) => { const cat = FD.data.catMeta(f.category); return html`<li><button class="met-card c-${cat.color} ${it.won ? 'is-won' : 'is-missed'}" type="button" data-action="met-open" data-id="${f.id}">
          <span class="met-ic" aria-hidden="true">${FD.icon(cat.icon || 'sparkle', { size: 24 })}</span>
          <span class="met-body"><span class="met-name">${f.name}</span><span class="met-meta">${ui.kindChip(it.kind)}${outcome(it)}</span></span>
          <span class="met-go">Learn more${FD.icon('right', { size: 18 })}</span></button></li>`; })}</ul></section>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-action="rounds-again">${FD.icon('refresh', { size: 20 })}Play again</button><button class="btn btn-ghost" type="button" data-action="rounds-setup">${FD.icon('sliders', { size: 20 })}Change settings</button><a class="btn btn-ghost" href="#/stats">${FD.icon('chart', { size: 20 })}Your Stats</a></div>
    </section></div>`);
    ui.scrollTop(); const h = $('#ss-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    ui.holdRankUp(false); /* the game is over: a rank-up can pop up now */
  }

  FD.rounds = { MODES, limits, maxRounds, clamp, cleanFilters, read, start, resume, discard, attach, detach, solvedOf, pointsOf };
})();
