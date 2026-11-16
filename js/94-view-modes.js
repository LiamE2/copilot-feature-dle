/* Copilot Feature-dle · the play modes' shared pieces (mode selector, headers, filters), Feature Hunt, Free Play and the old practice / challenge links.
   Feature Hunt is the hint-guessing game (Know it) and Free Play serves puzzles from any of the three game modes. Both are played in rounds (1 to 10, the player chooses):
   their setup screens are here, and the games themselves run in 94-view-rounds.js. Scenario Match and Prompt Lab are in 98-view-quiz.js, Packs in 98-view-packs.js. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount, attrs } = FD.u;
  const ui = FD.ui;
  const cfg = FD.config;

  /* the five ways in: Free Play (any game mode), the three game modes (Know it, Use it, Prompt it) and Packs */
  ui.modeNav = (active) => html`<nav class="seg" aria-label="Play modes">
    <a href="#/free"${attrs({ 'aria-current': active === 'free' ? 'page' : null })}>${FD.icon('shuffle', { size: 18 })}Free Play</a>
    <a href="#/hunt"${attrs({ 'aria-current': active === 'hunt' ? 'page' : null })}>${FD.icon('search', { size: 18 })}Feature Hunt</a>
    <a href="#/match"${attrs({ 'aria-current': active === 'match' ? 'page' : null })}>${FD.icon('puzzle', { size: 18 })}Scenario Match</a>
    <a href="#/prompts"${attrs({ 'aria-current': active === 'prompts' ? 'page' : null })}>${FD.icon('flask', { size: 18 })}Prompt Lab</a>
    <a href="#/packs"${attrs({ 'aria-current': active === 'packs' ? 'page' : null })}>${FD.icon('package', { size: 18 })}Packs</a>
  </nav>`;
  const seg = ui.modeNav;

  /* The header above the mode selector. All five headers sit in one grid cell and only the active one is visible,
     so the header is always as tall as the tallest and the mode selector never moves when you switch modes. */
  const MODE_HEADS = {
    free: ['Mix it up', 'Free Play', 'Unlimited puzzles from any game mode. Choose how many rounds and play at your own pace.'],
    hunt: ['Know it', 'Feature Hunt', 'Read the hints and guess the Copilot feature being referenced.'],
    match: ['Use it', 'Scenario Match', 'Read a real work scenario and match it to the Copilot feature that fits best.'],
    prompts: ['Prompt it', 'Prompt Lab', 'Read the scenario, pick the strongest prompt and build the habits behind great answers.'],
    packs: ['Themed sets of puzzles', 'Packs', 'Curated bundles that mix all three game modes together.']
  };
  ui.modeHead = (active) => html`<header class="hub-head mode-head">${Object.keys(MODE_HEADS).map((k) => {
    const [eyebrow, title, lede] = MODE_HEADS[k], on = k === active;
    return html`<div class="mh${on ? ' is-on' : ''}"${attrs({ 'aria-hidden': on ? null : 'true' })}><p class="eyebrow">${eyebrow}</p>${on ? html`<h1>${title}</h1>` : html`<p class="mh-title">${title}</p>`}<p class="lede">${lede}</p></div>`;
  })}</header>`;

  /* a game mode as a small chip: its icon and name in its own colour (the results of a game of rounds, the Daily result, Feature Book) */
  ui.kindChip = (kind) => { const m = FD.puzzles.META[kind]; return m ? html`<span class="chip c-${m.color}">${FD.icon(m.icon, { size: 14 })}${m.name}</span>` : ''; };

  /* a new puzzle always starts with the question in view */
  ui.scrollTop = () => window.scrollTo({ top: 0, behavior: FD.u.reduceMotion() ? 'auto' : 'smooth' });

  /* difficulty pills: Any, then the four levels. Every level is open from the start, in every game mode. */
  function diffPills(name, selected, o = {}) {
    const { includeAll = true } = o;
    const items = (includeAll ? ['all'] : []).concat(cfg.difficulties);
    return html`<div class="pill-radios">${items.map((d) => html`<label class="pill-radio"><input type="radio" name="${name}" value="${d}"${attrs({ checked: selected === d })}><span>${d === 'all' ? 'Any' : d}</span></label>`)}</div>`;
  }
  /* which game modes a Free Play can pull puzzles from: three tick-pills, and at least one stays ticked */
  function kindPills(name, selected) {
    const on = FD.puzzles.kindsOf({ kinds: selected });
    return html`<div class="pill-radios">${FD.puzzles.KINDS.map((k) => html`<label class="pill-radio"><input type="checkbox" name="${name}" value="${k}"${attrs({ checked: on.includes(k) })}><span>${FD.icon(FD.puzzles.META[k].icon, { size: 16 })}${FD.puzzles.META[k].name}</span></label>`)}</div>`;
  }
  /* keeps one box ticked: ticking nothing is turned straight back */
  function keepOneKind(form, name) {
    form.addEventListener('change', (e) => {
      if (!e.target || e.target.name !== name) return;
      const boxes = Array.from(form.querySelectorAll(`input[name="${name}"]`));
      if (!boxes.some((b) => b.checked)) e.target.checked = true;
    });
  }
  const readKinds = (form, name) => Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((b) => b.value);
  /* the Category dropdown (it ticks any number of categories): every category that has a feature */
  const libCategories = () => FD.lib.categories.filter((c) => FD.lib.features.some((f) => f.category === c.name)).map((c) => c.name);
  const catSpec = (id, selected) => ({ id, label: 'Category', options: libCategories().map((name) => ({ value: name, label: name })), selected, allLabel: 'All categories', noun: 'categories' });
  ui.diffPills = diffPills; ui.kindPills = kindPills; ui.keepOneKind = keepOneKind; ui.readKinds = readKinds; ui.catSpec = catSpec;
  const plural = FD.u.plural;

  /* a saved difficulty or category that no longer makes sense is let go */
  const cleanDifficulty = (d) => (cfg.difficulties.includes(d) ? d : 'all');
  const cleanCategories = (v) => { const have = libCategories(); return FD.u.selList(v).filter((c) => have.includes(c)); };

  /* ---------- the setup screens of the two games of rounds ---------- */
  const roundsText = (n) => plural(n, 'round');
  /* the Rounds slider: 1 to 10, and never more than the number of puzzles the choices leave */
  const roundsField = (id, mode, top, value) => {
    const rd = FD.rounds.limits(mode);
    return html`<div class="field slider-field">
      <label for="${id}-rounds">Rounds <output id="${id}-out" for="${id}-rounds">${roundsText(value)}</output></label>
      <input id="${id}-rounds" class="range" type="range" min="${rd.min}" max="${top}" step="1" value="${value}" aria-valuetext="${roundsText(value)}"${attrs({ disabled: top <= rd.min })}>
      <div class="range-scale" aria-hidden="true"><span>${roundsText(rd.min)}</span><span id="${id}-scale-max">${roundsText(top)}</span></div>
    </div>`;
  };
  /* keeps the slider in step with the choices (it can't go past the puzzles on offer, and it remembers the number that was asked for) */
  function syncRounds(main, id, mode, filters, want) {
    const range = $('#' + id + '-rounds', main), top = FD.rounds.maxRounds(mode, filters), val = Math.min(want, top), t = roundsText(val);
    range.max = String(top); range.value = String(val); range.disabled = top <= FD.rounds.limits(mode).min;
    ui.rangeFill(range);
    $('#' + id + '-out', main).textContent = t; range.setAttribute('aria-valuetext', t);
    $('#' + id + '-scale-max', main).textContent = roundsText(top);
  }
  /* a game that is waiting: where it got to, with the way to carry on or let it go */
  function waitingCard(mode, run) {
    const M = FD.rounds.MODES[mode], g = run.game, q = run.q;
    const line = run.total > 1
      ? (run.done && run.i >= run.total - 1
        ? html`All ${run.total} rounds played \u00B7 ${plural(FD.rounds.solvedOf(run), 'puzzle')} solved \u00B7 ${plural(FD.rounds.pointsOf(run), 'point')}, and the results are waiting`
        : html`Round <strong>${run.done ? run.i + 2 : run.i + 1}</strong> of ${run.total} \u00B7 ${plural(FD.rounds.solvedOf(run), 'puzzle')} solved \u00B7 ${plural(FD.rounds.pointsOf(run), 'point')} so far`)
      : g ? html`Hint <strong>${Math.min(g.guesses.length + 1, cfg.maxAttempts)}</strong> of ${cfg.maxAttempts} \u00B7 ${plural(g.guesses.length, 'guess', 'guesses')} so far, waiting just as you left it`
        : q ? html`${q.wrong.length ? plural(q.wrong.length, 'weaker pick') + ' so far' : 'Not answered yet'}, waiting just as you left it`
          : html`A puzzle, waiting for you`;
    return html`<section class="card in-progress" aria-labelledby="ip-h">
      <div class="ip-pip" aria-hidden="true">${FD.pip('think', { size: 76 })}</div>
      <div class="ip-body">
        <h2 id="ip-h">You have a ${M.name} game in progress</h2>
        <p>${line}</p>
        <div class="btn-row"><button class="btn btn-primary" type="button" data-action="${mode}-resume">${FD.icon('play', { size: 20 })}Resume game</button><button class="btn btn-ghost" type="button" data-action="${mode}-discard">${FD.icon('refresh', { size: 20 })}Start a new game</button></div>
      </div></section>`;
  }
  const askNewGame = () => ui.confirm('Start a new game?', 'Your game in progress will be put down, and you\u2019ll get a fresh one. Rounds you\u2019ve already answered keep their XP.', 'Start a new game');
  const focusHead = (main) => { const h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } };

  /* ======================================================================== FEATURE HUNT
     Five sneaky hints about one Copilot feature. Choose a difficulty and categories (or let Pip surprise you) and how many rounds, guess, learn. */
  const hunt = { filters: null, ctl: null, main: null };

  function loadHuntFilters() {
    const saved = (FD.store.state.meta && FD.store.state.meta.hunt) || {};
    return { difficulty: cleanDifficulty(saved.difficulty), category: cleanCategories(saved.category), prioritise: saved.prioritise !== false, rounds: FD.rounds.clamp('hunt', saved.rounds) };
  }
  function saveHuntFilters(f) { FD.store.state.meta.hunt = { difficulty: f.difficulty, category: f.category, prioritise: f.prioritise, rounds: f.rounds }; FD.store.save(); }
  const featuresText = (n) => `${n} ${n === 1 ? 'feature matches' : 'features match'} right now.`;
  const huntChoices = (f) => ({ difficulty: f.difficulty, category: f.category, prioritise: f.prioritise });

  function huntSetup(main) {
    const f = hunt.filters, waiting = FD.rounds.read('hunt');
    const count = FD.freeplay.pool(f).length, top0 = FD.rounds.maxRounds('hunt', f), rounds0 = Math.min(f.rounds, top0);
    main.innerHTML = flat(html`<div class="container hub">
      ${ui.modeHead('hunt')}
      ${seg('hunt')}
      ${waiting ? waitingCard('hunt', waiting) : ''}
      <form class="card setup" id="hunt-form">
        <fieldset class="field"><legend>Difficulty</legend>${diffPills('difficulty', f.difficulty)}</fieldset>
        ${ui.msel.html(catSpec('h-cat', f.category))}
        ${roundsField('h', 'hunt', top0, rounds0)}
        <label class="check"><input type="checkbox" id="h-pri"${attrs({ checked: f.prioritise })}><span>Prioritise features I haven\u2019t solved yet</span></label>
        <p class="muted" id="h-count" aria-live="polite">${featuresText(count)}</p>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">${FD.icon('search', { size: 22 })}Start Feature Hunt</button></div>
      </form>
    </div>`);
    const form = $('#hunt-form', main), range = $('#h-rounds', main);
    let want = f.rounds; /* the number of rounds asked for: a narrow choice can hold the game below it without forgetting it */
    ui.rangeFill(range);
    const read = () => {
      const d = form.querySelector('input[name="difficulty"]:checked');
      hunt.filters = { difficulty: d ? d.value : 'all', category: ui.msel.values($('#h-cat', form)), prioritise: $('#h-pri', form).checked, rounds: want };
      syncRounds(main, 'h', 'hunt', hunt.filters, want);
      $('#h-count', main).textContent = featuresText(FD.freeplay.pool(hunt.filters).length);
      saveHuntFilters(hunt.filters);
    };
    range.addEventListener('input', () => { want = FD.rounds.clamp('hunt', range.value, hunt.filters); read(); });
    form.addEventListener('change', (e) => { if (e.target !== range) read(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); read();
      if (!FD.freeplay.pool(hunt.filters).length) { ui.toast('No features match those filters. Try widening them a little.', { icon: 'x' }); return; }
      if (FD.rounds.read('hunt') && !(await askNewGame())) return;
      FD.rounds.start('hunt', FD.rounds.clamp('hunt', want, hunt.filters), huntChoices(hunt.filters));
    });
  }
  ui.actions['hunt-resume'] = () => { if (!FD.rounds.resume('hunt')) huntSetup(hunt.main); };
  ui.actions['hunt-discard'] = async () => {
    if (!(await ui.confirm('Start a new game?', 'Your game in progress will be put down, and you can pick a fresh one. Rounds you\u2019ve already answered keep their XP.', 'Start a new game'))) return;
    FD.rounds.discard('hunt');
    huntSetup(hunt.main); focusHead(hunt.main);
  };

  FD.views.hunt = {
    title: 'Feature Hunt',
    render(main, ctx) {
      hunt.main = main; hunt.filters = loadHuntFilters();
      FD.rounds.attach('hunt', main, () => huntSetup(main));
      if (ctx.query.start) FD.rounds.start('hunt', FD.rounds.clamp('hunt', hunt.filters.rounds, hunt.filters), huntChoices(hunt.filters)) || huntSetup(main); else huntSetup(main);
      return () => FD.rounds.detach();
    }
  };

  /* direct play of one feature (a deep link, or a friend challenge link from an earlier version): a single hunt that is not kept */
  const unb64 = (s) => { try { return decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { return ''; } };
  function huntPlay(game, extra) {
    if (hunt.ctl) hunt.ctl.destroy();
    hunt.main.innerHTML = '<div class="container play-wrap" id="play-root"></div>';
    hunt.ctl = FD.play.mount($('#play-root', hunt.main), game, { mode: 'hunt', title: extra.title, actions: extra.actions });
    ui.scrollTop();
  }
  function fixedView(kind) {
    return {
      title: kind === 'challenge' ? 'Friend challenge' : 'Practice',
      render(main, ctx) {
        hunt.main = main;
        const id = kind === 'challenge' ? (unb64(ctx.params.code).startsWith('fd:') ? unb64(ctx.params.code).slice(3) : '') : ctx.params.id;
        const f = FD.lib.byId[id];
        if (!f) { ui.toast('Hmm, I couldn\u2019t find that feature. Try Free Play instead!', { icon: 'x' }); ui.go('/free'); return; }
        const actions = kind === 'challenge'
          ? [{ label: 'Play today\u2019s challenge', href: '#/daily', icon: 'calendar', cls: 'btn-primary' }, { label: 'Free Play', href: '#/free', icon: 'shuffle' }]
          : [{ label: 'Free Play', href: '#/free', icon: 'shuffle', cls: 'btn-primary' }, { label: 'Feature Book', href: '#/book', icon: 'book' }];
        huntPlay(new FD.Game(f, { mode: 'hunt' }), { title: kind === 'challenge' ? 'A friend challenged you!' : 'Practice round', actions });
        return () => { if (hunt.ctl) hunt.ctl.destroy(); hunt.ctl = null; };
      }
    };
  }
  FD.views.play = fixedView('practice');
  FD.views.challenge = fixedView('challenge');

  /* ======================================================================== FREE PLAY
     Puzzles from any game mode (or just the ones you tick): a Feature Hunt puzzle, a Scenario Match question or a Prompt Lab question, in as many rounds as you choose. A game
     left unfinished is kept. */
  const free = { filters: null, main: null };

  function loadFreeFilters() {
    const saved = (FD.store.state.meta && FD.store.state.meta.free) || {};
    return { kinds: FD.puzzles.kindsOf({ kinds: saved.kinds }), difficulty: cleanDifficulty(saved.difficulty), category: cleanCategories(saved.category), prioritise: saved.prioritise !== false, rounds: FD.rounds.clamp('free', saved.rounds) };
  }
  function saveFreeFilters(f) { FD.store.state.meta.free = { kinds: f.kinds, difficulty: f.difficulty, category: f.category, prioritise: f.prioritise, rounds: f.rounds }; FD.store.save(); }
  const matchesText = (n) => `${n} ${n === 1 ? 'puzzle matches' : 'puzzles match'} right now.`;
  const freeChoices = (f) => ({ kinds: f.kinds, difficulty: f.difficulty, category: f.category, prioritise: f.prioritise });

  function freeSetup(main) {
    const f = free.filters, waiting = FD.rounds.read('free');
    const count = FD.puzzles.count(f), top0 = FD.rounds.maxRounds('free', f), rounds0 = Math.min(f.rounds, top0);
    main.innerHTML = flat(html`<div class="container hub">
      ${ui.modeHead('free')}
      ${seg('free')}
      ${waiting ? waitingCard('free', waiting) : ''}
      <form class="card setup" id="free-form">
        <fieldset class="field"><legend>Game modes</legend>${kindPills('kinds', f.kinds)}</fieldset>
        <fieldset class="field"><legend>Difficulty</legend>${diffPills('difficulty', f.difficulty)}</fieldset>
        ${ui.msel.html(catSpec('f-cat', f.category))}
        ${roundsField('f', 'free', top0, rounds0)}
        <label class="check"><input type="checkbox" id="f-pri"${attrs({ checked: f.prioritise })}><span>Prioritise puzzles I haven\u2019t tried yet</span></label>
        <p class="muted" id="f-count" aria-live="polite">${matchesText(count)}</p>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit" id="f-go">${FD.icon('shuffle', { size: 22 })}Surprise me</button></div>
      </form>
    </div>`);
    const form = $('#free-form', main), range = $('#f-rounds', main);
    let want = f.rounds; /* the number of rounds asked for: a narrow choice can hold the game below it without forgetting it */
    keepOneKind(form, 'kinds');
    ui.rangeFill(range);
    const read = () => {
      const d = form.querySelector('input[name="difficulty"]:checked');
      free.filters = { kinds: readKinds(form, 'kinds'), difficulty: d ? d.value : 'all', category: ui.msel.values($('#f-cat', form)), prioritise: $('#f-pri', form).checked, rounds: want };
      syncRounds(main, 'f', 'free', free.filters, want);
      $('#f-count', main).textContent = matchesText(FD.puzzles.count(free.filters));
      saveFreeFilters(free.filters);
    };
    range.addEventListener('input', () => { want = FD.rounds.clamp('free', range.value, free.filters); read(); });
    form.addEventListener('change', (e) => { if (e.target !== range) read(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); read();
      if (!FD.puzzles.count(free.filters)) { ui.toast('Nothing matches those choices. Try another difficulty, category or more game modes.', { icon: 'x' }); return; }
      if (FD.rounds.read('free') && !(await askNewGame())) return;
      FD.rounds.start('free', FD.rounds.clamp('free', want, free.filters), freeChoices(free.filters));
    });
  }
  ui.actions['free-resume'] = () => { if (!FD.rounds.resume('free')) freeSetup(free.main); };
  ui.actions['free-discard'] = async () => {
    if (!(await ui.confirm('Start a new game?', 'Your game in progress will be put down, and you can pick a fresh one. Rounds you\u2019ve already answered keep their XP.', 'Start a new game'))) return;
    FD.rounds.discard('free');
    freeSetup(free.main); focusHead(free.main);
  };

  FD.views.free = {
    title: 'Free Play',
    render(main, ctx) {
      free.main = main; free.filters = loadFreeFilters();
      FD.rounds.attach('free', main, () => freeSetup(main));
      /* links from the old Packs & themes screen now live in Packs */
      if (ctx.query.pack) { ui.go('/pack/' + encodeURIComponent(ctx.query.pack)); return; }
      if (ctx.query.tag) { const t = (FD.lib.themes || []).find((x) => x.tag === ctx.query.tag); ui.go(t ? '/pack/' + encodeURIComponent('spot-' + t.id) : '/packs'); return; }
      if (ctx.query.start) FD.rounds.start('free', FD.rounds.clamp('free', free.filters.rounds, free.filters), freeChoices(free.filters)) || freeSetup(main); else freeSetup(main);
      return () => FD.rounds.detach();
    }
  };
})();
