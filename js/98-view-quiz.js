/* Copilot Feature-dle · Prompt Lab and Scenario Match: the two question-and-answer game modes, one screen design.
   Prompt Lab:     read a workplace scenario, pick the strongest of four PROMPTS, see why.  (Prompt it)
   Scenario Match: read a first-person need ("I want to ..."), pick the Copilot FEATURE that fits best, see why.  (Use it)
   A weaker pick explains itself and lets you try again for fewer points: up to three picks, worth 50, 30 and 10 points. Miss all three and the answer is shown for no points, and
   the puzzle goes to Needs Another Look. A game is a few rounds (you choose how many), every round you answer is recorded straight away (its points are XP and it joins your
   Stats) but the XP is only shown at the end. The game is saved as it goes, so leaving never loses it. A rank-up is held until the game ends or you leave.
   The question itself (FD.quizUI.mount) is shared: Free Play's rounds, Packs, the Daily Challenge and the Feature Book all ask it the same way. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, plural, announce, attrs } = FD.u;
  const ui = FD.ui;
  const LETTERS = ['A', 'B', 'C', 'D'];
  const PICK_NAMES = ['first', 'second', 'third'];

  /* everything that differs between the two game modes */
  const KIND = {
    prompt: {
      name: 'Prompt Lab', route: '#/prompts', icon: 'flask', prefs: 'promptLab', cfg: 'promptLab',
      QUESTION: 'Which prompt will get the best result?', optionsLabel: 'The four prompts', optionWord: 'prompt',
      first: 'Best pick, first try!', plus: 'Found it', headBest: 'The best pick', headOther: 'Why this one is weaker', recapTitle: 'The prompts worth keeping',
      priText: 'Prioritise prompts I haven\u2019t met yet'
    },
    match: {
      name: 'Scenario Match', route: '#/match', icon: 'puzzle', prefs: 'scenarioMatch', cfg: 'scenarioMatch',
      QUESTION: 'Which Copilot feature fits best?', optionsLabel: 'The four features', optionWord: 'feature',
      first: 'Spot on, first try!', plus: 'Found it', headBest: 'The best fit', headOther: 'What this one is for', recapTitle: 'The features worth remembering',
      priText: 'Prioritise scenarios I haven\u2019t met yet'
    }
  };
  const QUESTIONS = { prompt: KIND.prompt.QUESTION, match: KIND.match.QUESTION };

  const featOf = (scn) => (scn && scn.feature ? FD.lib.byId[scn.feature] : null);
  const catOf = (f) => (f ? FD.data.catMeta(f.category) : { color: 'blue', icon: 'chat' });
  /* a feature as a pill: its full name with the same coloured icon it has in the Feature Book */
  const featChip = (f, fallback) => {
    const cat = catOf(f);
    return html`<span class="pl-feat c-${cat.color}"><span class="pl-feat-ic" aria-hidden="true">${FD.icon(cat.icon || 'sparkle', { size: 22 })}</span><span class="pl-feat-name">${f ? f.name : fallback}</span></span>`;
  };
  const featTag = (scn) => featChip(featOf(scn), scn.app);

  /* the four ingredients a prompt may contain: ticked when it has one, dimmed when it doesn't */
  const ingStrip = (has) => html`<ul class="pl-strip" aria-label="Ingredients">${FD.prompts.ingredients.map((g) => {
    const on = has.includes(g.id);
    return html`<li class="pl-chip c-${g.color} ${on ? 'is-on' : 'is-off'}">${FD.icon(on ? 'check' : 'minus', { size: 14 })}${g.name}<span class="sr-only">${on ? ' (included)' : ' (missing)'}</span></li>`;
  })}</ul>`;

  /* ======================================================================== the question (shared) */
  /* the blue box: it says it is the scenario. Prompt Lab says which Copilot feature it is about; Scenario Match can't (the feature is the answer) */
  const scenarioCard = (kind, scn) => html`<section class="card pl-scenario${kind === 'match' ? ' is-match' : ''}" aria-labelledby="pl-sit-h">
        <div class="pl-scn-top"><h2 id="pl-sit-h" class="pl-scn-label">Scenario</h2>${kind === 'prompt' ? html`<p class="pl-app">${featTag(scn)}</p>` : ''}</div>
        <p class="pl-sit">${scn.situation}</p>
      </section>`;
  const optionBody = (kind, scn, oi, pos) => {
    const o = scn.options[oi];
    if (kind === 'match') return html`<span class="pl-text"><span class="sr-only">Feature ${LETTERS[pos]}: </span>${featChip(FD.lib.byId[o.feature], o.feature)}</span>`;
    return html`<span class="pl-text"><span class="sr-only">Prompt ${LETTERS[pos]}: </span>${o.text}</span>`;
  };
  const optionList = (kind, scn, order, action) => html`<ul class="pl-options" aria-label="${KIND[kind].optionsLabel}">${order.map((oi, pos) => html`<li class="pl-item" id="pl-item-${oi}">
        <button type="button" class="pl-opt${kind === 'match' ? ' pl-opt-feat' : ''}" data-action="${action}" data-oi="${oi}" aria-describedby="pl-fb-${oi}"><span class="pl-letter" aria-hidden="true">${LETTERS[pos]}</span>${optionBody(kind, scn, oi, pos)}</button>
        <div class="pl-fb" id="pl-fb-${oi}" hidden></div></li>`)}</ul>`;
  /* open the explanation under one option. nextPoints: what the next try is worth, shown under a weaker pick (0 = nothing to offer) */
  function reveal(root, kind, scn, oi, state, nextPoints) {
    const K = KIND[kind], opt = scn.options[oi], item = $('#pl-item-' + oi, root), fb = $('#pl-fb-' + oi, root);
    if (!item || !fb) return;
    item.classList.remove('is-wrong', 'is-best', 'is-other'); item.classList.add('is-' + state);
    item.querySelector('.pl-opt').setAttribute('aria-disabled', 'true');
    const head = state === 'best' ? html`${FD.icon('check', { size: 18 })}${K.headBest}` : state === 'wrong' ? html`${FD.icon('x', { size: 18 })}Not quite` : html`${FD.icon('info', { size: 18 })}${K.headOther}`;
    const f = kind === 'match' ? FD.lib.byId[opt.feature] : null;
    fb.hidden = false;
    fb.innerHTML = flat(html`<p class="pl-fb-h">${head}</p><p class="pl-why">${opt.why}</p>${kind === 'prompt' ? ingStrip(opt.has) : ''}${f && !opt.best ? html`<p class="pl-about"><button class="btn btn-link btn-sm" type="button" data-action="met-open" data-id="${f.id}">${FD.icon('book', { size: 16 })}About ${f.name}</button></p>` : ''}${nextPoints ? html`<p class="pl-next-hint">${FD.icon('right', { size: 16 })}<span>Pick another ${K.optionWord} for <strong>${nextPoints} points</strong>.</span></p>` : ''}`);
  }
  /* what happened to Needs Another Look because of this answer (the same wording a Feature Hunt result uses) */
  const reviewNote = (out) => {
    if (!out || !out.review) return '';
    const text = { added: html`Added to Needs Another Look. <a href="#/pack/review">Play it from Packs</a> whenever you like.`, stays: html`Still on your Needs Another Look list. Get it right next time and it comes off.`, cleared: html`Off your Needs Another Look list. Nicely done!` }[out.review];
    return html`<p class="note ${out.review === 'cleared' ? 'c-green' : 'c-orange'} pl-note">${FD.icon(out.review === 'cleared' ? 'check' : 'refresh', { size: 18 })}<span>${text}</span></p>`;
  };
  /* the panel shown once a question is answered. o.buttons: the buttons that carry on (Next round, Play again...), o.note: anything to say first,
     o.out: what recording the answer returned (for the Needs Another Look note) */
  const winPanel = (kind, scn, it, o) => {
    const K = KIND[kind], f = featOf(scn), best = scn.options[scn.bestIndex];
    const heading = it.tries === 1 ? K.first : it.tries === 2 ? 'Got it on the second pick.' : 'Got it on the third pick.';
    return html`
      <section class="card pl-win ${it.tries === 1 ? 'is-first' : ''}" aria-labelledby="pl-win-h">
        <div class="pl-win-top"><span class="pl-pts"><strong>+${it.points}</strong> points</span><h2 id="pl-win-h">${heading}</h2></div>
        ${kind === 'prompt' && scn.tip ? html`<p class="pl-tip">${FD.icon('bulb', { size: 20 })}<span><strong>The takeaway:</strong> ${scn.tip}</span></p>` : ''}
        ${o.note || ''}${reviewNote(o.out)}
        <div class="btn-row">
          ${o.buttons || ''}
          ${kind === 'prompt' ? html`<button class="btn btn-ghost" type="button" data-action="copy-prompt" data-copy="${best.text}">${FD.icon('copy', { size: 18 })}Copy the best prompt</button>` : ''}
          ${f ? html`<button class="btn btn-ghost" type="button" data-action="met-open" data-id="${f.id}">${FD.icon('book', { size: 18 })}About ${f.name}</button>` : ''}
          ${kind === 'match' && f && FD.prompts.ready && FD.prompts.scenarios.some((s) => s.feature === f.id) ? html`<a class="btn btn-ghost" href="#/prompts?feature=${encodeURIComponent(f.id)}">${FD.icon('flask', { size: 18 })}Practice prompting it</a>` : ''}
        </div>
      </section>`;
  };
  /* ...and when every pick was missed: the answer is shown, nothing is earned, and the puzzle is waiting in Needs Another Look */
  const missPanel = (kind, scn, it, o) => {
    const f = featOf(scn), best = scn.options[scn.bestIndex];
    const heading = kind === 'match' ? `Not this time. The best fit was ${f ? f.name : 'the one marked above'}.` : 'Not this time. The best prompt is marked above.';
    return html`
      <section class="card pl-win is-miss" aria-labelledby="pl-win-h">
        <div class="pl-win-top"><span class="pl-pts is-none"><strong>0</strong> points</span><h2 id="pl-win-h">${heading}</h2></div>
        ${kind === 'prompt' && scn.tip ? html`<p class="pl-tip">${FD.icon('bulb', { size: 20 })}<span><strong>The takeaway:</strong> ${scn.tip}</span></p>` : ''}
        ${o.note || ''}${reviewNote(o.out)}
        <div class="btn-row">
          ${o.buttons || ''}
          ${kind === 'prompt' ? html`<button class="btn btn-ghost" type="button" data-action="copy-prompt" data-copy="${best.text}">${FD.icon('copy', { size: 18 })}Copy the best prompt</button>` : ''}
          ${f ? html`<button class="btn btn-ghost" type="button" data-action="met-open" data-id="${f.id}">${FD.icon('book', { size: 18 })}About ${f.name}</button>` : ''}
        </div>
      </section>`;
  };

  /* A question on screen. spec = {
       kind, scn, order, wrong             what to ask, in what order, and any weaker picks already made (a saved question coming back)
       solved                              { tries, points, solved } when the question was already answered (a saved round waiting for Next); solved is false for a miss
       onWrong(oi, state)                  after a weaker pick (save it)
       record({ tries, points, solved })   the right pick, or the last allowed weaker pick (solved is false, nothing is earned): bank it (return the result of
                                           FD.store.record..., it is celebrated for you)
       finish({ tries, points, solved }, out)  what to show in the panel: { buttons, note } or { panel } to replace the whole panel (the Daily Challenge)
     } */
  function mount(host, spec) {
    const { kind, scn } = spec, Q = FD.quiz(kind), K = KIND[kind], maxTries = Q.maxTries();
    const st = { order: spec.order.slice(), wrong: (spec.wrong || []).filter((x, k, a) => [0, 1, 2, 3].includes(x) && a.indexOf(x) === k && x !== scn.bestIndex).slice(0, maxTries), done: false };
    host.innerHTML = flat(html`${scenarioCard(kind, scn)}${optionList(kind, scn, st.order, 'q-pick')}<p class="sr-only" id="pl-status"></p><div class="pl-after" id="pl-after"></div>`);
    st.wrong.forEach((oi, k) => reveal(host, kind, scn, oi, 'wrong', k === st.wrong.length - 1 && !spec.solved && st.wrong.length < maxTries ? Q.pointsFor(st.wrong.length + 1) : 0));
    const ctl = { kind, scn, state: st, host, pick, destroy() { if (FD.quizUI.active === ctl) FD.quizUI.active = null; } };
    FD.quizUI.active = ctl;

    /* the question is answered (or missed): show everything, then offer to carry on */
    function settle(res, out, fresh) {
      st.done = true;
      const miss = res.solved === false, bestName = FD.lib.byId[scn.feature] ? FD.lib.byId[scn.feature].name : 'the one marked';
      scn.options.forEach((o, oi) => { if (!st.wrong.includes(oi)) reveal(host, kind, scn, oi, o.best ? 'best' : 'other', 0); });
      const extra = (spec.finish && spec.finish(res, out)) || {};
      const o = Object.assign({ out }, extra);
      $('#pl-after', host).innerHTML = flat(extra.panel || (miss ? missPanel(kind, scn, res, o) : winPanel(kind, scn, res, o)));
      const msg = miss ? (kind === 'match' ? `Not this time. The best fit was ${bestName}. No points.` : 'Not this time. The best prompt is marked. No points.') : res.tries === 1 ? `${K.first} +${res.points} points.` : `That's the best one. +${res.points} points.`;
      $('#pl-status', host).textContent = msg;
      if (fresh) announce(msg); else announce(miss ? 'The answer was shown.' : res.tries === 1 ? K.first : 'The best option was found.');
      const nb = host.querySelector('#pl-next, [data-q-focus]');
      if (nb) { nb.focus({ preventScroll: true }); if (fresh) nb.scrollIntoView({ block: 'nearest', behavior: FD.u.reduceMotion() ? 'auto' : 'smooth' }); }
    }
    /* every pick allowed was a weaker one: the answer is shown, nothing is earned, and the puzzle goes to Needs Another Look */
    function miss(fresh) {
      const res = { tries: maxTries, points: 0, solved: false };
      const out = spec.record ? spec.record(res) : null;
      settle(res, out, fresh);
      if (fresh) { FD.fx.play('lose'); FD.fx.haptic(120); }
      if (out) ui.celebrate(out);
    }
    function pick(oi) {
      if (st.done) return;
      const opt = scn.options[oi]; if (!opt || st.wrong.includes(oi)) return;
      if (opt.best) {
        const tries = st.wrong.length + 1, points = Q.pointsFor(tries), res = { tries, points, solved: true };
        /* the question counts the moment it is answered: its points are XP, and it is added to your play history */
        const out = spec.record ? spec.record(res) : null;
        settle(res, out, true);
        FD.fx.play(tries === 1 ? 'win' : 'hint'); FD.fx.haptic(tries === 1 ? [30, 40, 60] : 30);
        if (tries === 1 && !spec.quiet) FD.fx.confetti({ count: 90 });
        if (out) ui.celebrate(out);
      } else {
        st.wrong.push(oi);
        if (spec.onWrong) spec.onWrong(oi, st);
        host.querySelectorAll('.pl-next-hint').forEach((n) => n.remove());
        if (st.wrong.length >= maxTries) { reveal(host, kind, scn, oi, 'wrong', 0); miss(true); return; }
        const nextPts = Q.pointsFor(st.wrong.length + 1), msg = `Not quite. Try another ${K.optionWord} for ${nextPts} points.`;
        reveal(host, kind, scn, oi, 'wrong', nextPts);
        $('#pl-status', host).textContent = msg; announce(`Not quite. ${opt.why} ${msg}`);
        FD.fx.play('wrong'); FD.fx.haptic(80);
        const next = host.querySelector('.pl-opt:not([aria-disabled="true"])'); if (next) next.focus({ preventScroll: true });
      }
    }
    if (spec.solved) settle(spec.solved, null, false);
    else if (st.wrong.length >= maxTries) miss(false); /* a game saved with every pick already used (an earlier version let the last one through) */
    else { const first = host.querySelector('.pl-opt:not([aria-disabled="true"])'); if (first && !spec.noFocus) first.focus({ preventScroll: true }); }
    return ctl;
  }
  ui.actions['q-pick'] = (el) => { const c = FD.quizUI.active; if (c) c.pick(+el.dataset.oi); };

  /* a heading for a question: an eyebrow line and the question itself (the caller says what comes in the eyebrow) */
  const head = (kind, parts, extra) => html`<header class="pl-head"><div><p class="eyebrow">${parts.filter(Boolean).join(' \u00B7 ')}</p><h1 id="pl-h">${QUESTIONS[kind]}</h1></div>${extra || ''}</header>`;

  /* a fresh question of one kind: a shuffled order of its four options */
  const freshOrder = () => FD.u.shuffle([0, 1, 2, 3]);
  const validOrder = (o) => Array.isArray(o) && o.length === 4 && [0, 1, 2, 3].every((i) => o.includes(i));

  FD.quizUI = { KIND, QUESTIONS, LETTERS, featChip, featTag, ingStrip, scenarioCard, optionList, reveal, winPanel, missPanel, reviewNote, mount, head, freshOrder, validOrder, active: null };

  /* ======================================================================== the game: setup, rounds, results */
  const lab = { main: null, kind: 'prompt', run: null, scn: null, focus: null, ctl: null, pri: true };
  const Q = () => FD.quiz(lab.kind);
  const K = () => KIND[lab.kind];
  const cfg = () => FD.config[K().cfg];
  const roundsText = (n) => plural(n, 'round');
  const matchText = (n) => `${n} ${n === 1 ? 'scenario matches' : 'scenarios match'} right now.`;
  /* what a game was last set to on this device (kept like the Feature Hunt and Free Play choices) */
  const prefs = (kind) => FD.store.state.meta[KIND[kind].prefs] || {};
  const prefRounds = (kind) => FD.quiz(kind).clampRounds(prefs(kind).rounds);
  const prefFilter = (kind) => FD.quiz(kind).cleanFilter(prefs(kind));
  const prefPrioritise = (kind) => prefs(kind).prioritise !== false;
  const savePrefs = (kind, rounds, filter, extra) => { FD.store.state.meta[KIND[kind].prefs] = Object.assign({ rounds }, filter, extra || {}); FD.store.save(); };
  /* the categories, features or level a game was set to, for the heading and the results ('' when it is drawing from everything) */
  const focusOf = (kind, run) => (run && run.focus ? FD.quiz(kind).focusName(run.focus) : '');
  const persist = () => { lab.run.savedAt = Date.now(); FD.store.setActive(Q().key, lab.run); };
  const focusHead = (root) => { const h = root.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } };

  function progressCard(run) {
    const focus = focusOf(lab.kind, run);
    return html`<section class="card in-progress" aria-labelledby="ip-h">
      <div class="ip-pip" aria-hidden="true">${FD.pip('think', { size: 76 })}</div>
      <div class="ip-body">
        <h2 id="ip-h">You have a ${K().name} game in progress</h2>
        <p>Round <strong>${run.i + 1}</strong> of ${run.ids.length}${focus ? ` \u00B7 ${focus}` : ''} \u00B7 ${plural(run.points, 'point')} so far</p>
        <div class="btn-row"><button class="btn btn-primary" type="button" data-action="pl-resume">${FD.icon('play', { size: 20 })}Resume game</button><button class="btn btn-ghost" type="button" data-action="pl-discard">${FD.icon('refresh', { size: 20 })}Start a new game</button></div>
      </div></section>`;
  }

  /* the dropdowns (each one can tick several). Prompt Lab: categories, and the features inside them. Scenario Match: categories (and a level, as pills).
     Only categories and features that have scenarios are offered. */
  const catSpec = (selected) => ({ id: 'pl-cat', label: 'Category', options: Q().categories().map((name) => ({ value: name, label: name })), selected, allLabel: 'All categories', noun: 'categories' });
  /* the features on offer inside the chosen categories, in the library's order; with more than one category each sits under its category's heading */
  function featOptions(cats) {
    const rank = (c) => FD.lib.categories.findIndex((x) => x.name === c);
    const list = Q().features(cats).map((ft, i) => ({ ft, i })).sort((a, b) => rank(a.ft.category) - rank(b.ft.category) || a.i - b.i);
    const heads = new Set(list.map((x) => x.ft.category)).size > 1;
    return list.map(({ ft }) => ({ value: ft.id, label: ft.name, group: heads ? ft.category : '' }));
  }

  /* ---------- Prompt Lab's "What makes a good prompt?": a link in a rounded box, in the slot at the top of the setup card where Feature Hunt and Scenario Match have Difficulty,
     so Category sits at the same height in all three. The box is sized by an invisible copy of the Difficulty row (its label and its pills), so it is exactly as tall as
     that row at every screen width and Text size, however the pills wrap; the link sits in the middle of it. The link opens a dialog with the whole recipe. ---------- */
  const recipeBox = () => html`<div class="field pl-recipe-slot"><div class="pl-recipe">
      <div class="pl-recipe-sizer" aria-hidden="true"><span class="label">Difficulty</span><div class="pill-radios">${['Any'].concat(FD.config.difficulties).map((d) => html`<span class="pill-radio"><span>${d}</span></span>`)}</div></div>
      <button class="pl-recipe-link" type="button" data-action="pl-recipe">${FD.icon('bulb', { size: 20 })}What makes a good prompt?</button>
    </div></div>`;
  ui.actions['pl-recipe'] = () => {
    const P = FD.prompts, ings = P.ingredients;
    ui.dialog({
      title: 'What makes a good prompt?', cls: 'dlg-wide dlg-recipe',
      body: html`<p class="pl-recipe-lede">A clear goal can get you a result, but using all four ingredients helps make the response more accurate, complete and tailored to your needs.</p>
        <ul class="pl-ings">${ings.map((g) => html`<li class="c-${g.color}"><span class="pl-ing-dot" aria-hidden="true">${g.name.charAt(0)}</span><span><strong>${g.name}</strong><span>${g.text}</span><em>\u201C${g.example}\u201D</em></span></li>`)}</ul>
        <h3 class="mini-h">All four together</h3>
        <p class="pl-example">${ings.map((g) => html`<span class="pl-hl c-${g.color}">${g.example}<span class="sr-only"> (${g.name})</span></span> `)}</p>
        ${P.learn ? html`<p class="pl-learn"><a class="btn btn-link" href="${P.learn.url}" target="_blank" rel="noopener noreferrer" data-action="doc-open" data-native>${P.learn.label}${FD.icon('external', { size: 16 })}<span class="sr-only"> (opens in a new tab)</span></a></p>` : ''}`,
      actions: [{ id: 'close', label: 'Got it', cls: 'btn-primary' }]
    });
  };

  function setup(main) {
    const kind = lab.kind, P = Q(), run = P.ready && P.scenarios.length ? P.readRun(FD.store.profile()) : null;
    const rd = cfg().rounds, filter0 = prefFilter(kind), top0 = P.maxRounds(filter0), rounds0 = Math.min(prefRounds(kind), top0);
    const isPrompt = kind === 'prompt';
    /* what to play comes first (the level, or the "What makes a good prompt?" box in the same place), then categories and features, then how much (the rounds), then the one setting */
    const fields = isPrompt
      ? html`${recipeBox()}<div class="field-row pl-pick-row">
          ${ui.msel.html(catSpec(filter0.category))}
          ${ui.msel.html({ id: 'pl-feat', label: 'Feature', hint: 'Choose a category first', options: featOptions(filter0.category), selected: filter0.feature, allLabel: 'All features', noun: 'features', disabled: !filter0.category.length })}
        </div>`
      : html`<fieldset class="field"><legend>Difficulty</legend>${ui.diffPills('difficulty', filter0.difficulty)}</fieldset>
        ${ui.msel.html(catSpec(filter0.category))}`;
    /* like Feature Hunt and Free Play: the choices and the start button come first */
    main.innerHTML = flat(html`<div class="container hub">
      ${ui.modeHead(isPrompt ? 'prompts' : 'match')}
      ${ui.modeNav(isPrompt ? 'prompts' : 'match')}
      ${run ? progressCard(run) : ''}
      ${!P.scenarios.length ? html`<div class="card"><h2>${K().name} is taking a break</h2><p>The scenarios didn\u2019t load, so there\u2019s nothing to play right now. Try refreshing the page, or come back in a little while.</p></div>` : html`
      <form class="card setup" id="pl-form">
        ${fields}
        <div class="field slider-field">
          <label for="pl-rounds">Rounds <output id="pl-out" for="pl-rounds">${roundsText(rounds0)}</output></label>
          <input id="pl-rounds" class="range" type="range" min="${rd.min}" max="${top0}" step="1" value="${rounds0}" aria-valuetext="${roundsText(rounds0)}"${attrs({ disabled: top0 <= rd.min })}>
          <div class="range-scale" aria-hidden="true"><span>${roundsText(rd.min)}</span><span id="pl-scale-max">${roundsText(top0)}</span></div>
        </div>
        <label class="check"><input type="checkbox" id="pl-pri"${attrs({ checked: prefPrioritise(kind) })}><span>${K().priText}</span></label>
        <p class="muted" id="pl-count" aria-live="polite">${matchText(P.pool(filter0).length)}</p>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">${FD.icon(K().icon, { size: 22 })}Start ${K().name}</button></div>
      </form>`}
    </div>`);
    const form = $('#pl-form', main);
    if (!form) return;
    const range = $('#pl-rounds', main), catRoot = $('#pl-cat', main), featRoot = $('#pl-feat', main);
    let want = prefRounds(kind); /* the number of rounds you asked for: a narrow choice can hold the game below it without forgetting it */
    const diff = () => { const d = form.querySelector('input[name="difficulty"]:checked'); return d ? d.value : 'all'; };
    const cats = () => ui.msel.values(catRoot);
    const filter = () => P.cleanFilter(isPrompt ? { category: cats(), feature: ui.msel.values(featRoot) } : { category: cats(), difficulty: diff() });
    const extra = () => ({ prioritise: $('#pl-pri', form).checked });
    const label = (n) => { const t = roundsText(n); $('#pl-out', main).textContent = t; range.setAttribute('aria-valuetext', t); };
    /* the choices change what is on offer: the slider can't go past the number of matching scenarios, and the count says how many there are */
    const sync = () => {
      const f = filter(), top = P.maxRounds(f), val = Math.min(want, top);
      range.max = String(top); range.value = String(val); range.disabled = top <= rd.min;
      ui.rangeFill(range); label(val);
      $('#pl-scale-max', main).textContent = roundsText(top);
      $('#pl-count', main).textContent = matchText(P.pool(f).length);
      savePrefs(kind, want, f, extra());
    };
    range.addEventListener('input', () => { want = P.clampRounds(range.value, filter()); label(want); savePrefs(kind, want, filter(), extra()); });
    form.addEventListener('change', (e) => {
      const t = e.target;
      /* the features on offer follow the categories chosen (a feature stays ticked while its category does) and wait until one is */
      if (isPrompt && catRoot.contains(t)) { const c = cats(); ui.msel.setOptions(featRoot, featOptions(c)); ui.msel.setDisabled(featRoot, !c.length); sync(); }
      else if (t && (t.closest('.msel') || t.name === 'difficulty' || t.id === 'pl-pri')) sync();
    });
    ui.rangeFill(range);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = filter(), n = P.clampRounds(range.value, f);
      savePrefs(kind, want, f, extra());
      if (P.readRun(FD.store.profile()) && !(await ui.confirm('Start a new game?', 'Your game in progress will be put down, and you\u2019ll get a fresh one. Rounds you\u2019ve already answered keep their XP.', 'Start a new game'))) return;
      start(n, f, extra());
    });
  }

  function start(rounds, filter, extra) {
    const kind = lab.kind;
    lab.focus = Q().cleanFilter(filter || prefFilter(kind));
    lab.pri = extra && extra.prioritise === false ? false : prefPrioritise(kind);
    lab.run = Q().newRun(FD.store.profile(), rounds || prefRounds(kind), Object.assign({}, lab.focus, lab.pri ? {} : { prioritise: false }));
    persist();
    show();
    ui.scrollTop();
  }
  ui.actions['pl-resume'] = () => { const r = Q().readRun(FD.store.profile()); if (!r) { setup(lab.main); return; } lab.run = r; lab.focus = Q().cleanFilter(r.focus); show(); ui.scrollTop(); };
  ui.actions['pl-discard'] = async () => {
    if (!(await ui.confirm('Start a new game?', 'Your game in progress will be put down, and you can start a fresh one. Rounds you\u2019ve already answered keep their XP.', 'Start a new game'))) return;
    FD.store.clearActive(Q().key); lab.run = null;
    setup(lab.main); focusHead(lab.main);
  };

  const dots = (run) => run.ids.map((id, i) => {
    const it = run.items[i], state = it ? (it.solved === false ? 'is-done miss' : 'is-done t' + it.tries) : i === run.i ? 'is-now' : '';
    return html`<li class="${state}"></li>`;
  });
  const meterLabel = (run) => `Round ${run.i + 1} of ${run.ids.length}. ${plural(run.points, 'point')} so far.`;
  const updateMeter = (run) => {
    const meter = $('#pl-meter', lab.main); if (!meter) return;
    meter.setAttribute('aria-label', meterLabel(run));
    meter.querySelector('.pl-dots').innerHTML = flat(dots(run)); meter.querySelector('.pl-score strong').textContent = run.points;
  };

  /* a round */
  function show() {
    const kind = lab.kind, run = lab.run, scn = Q().byId[run.ids[run.i]], order = run.orders[run.i];
    lab.scn = scn;
    ui.holdRankUp(true); /* a rank-up waits until the game is over, or until you leave it */
    lab.main.innerHTML = flat(html`<div class="container play-wrap pl-wrap">
      ${head(kind, [K().name, focusOf(kind, run), `Round ${run.i + 1} of ${run.ids.length}`], html`<div class="pl-meter" role="group" aria-label="${meterLabel(run)}" id="pl-meter"><ol class="pl-dots" aria-hidden="true">${dots(run)}</ol><p class="pl-score" aria-hidden="true"><strong>${run.points}</strong> points</p></div>`)}
      <div id="pl-body"></div>
    </div>`);
    const last = run.i >= run.ids.length - 1;
    const solved = run.done ? { tries: run.items[run.i].tries, points: run.items[run.i].points, solved: run.items[run.i].solved !== false } : null;
    if (lab.ctl) lab.ctl.destroy();
    lab.ctl = mount($('#pl-body', lab.main), {
      kind, scn, order, wrong: run.wrong, solved,
      onWrong: (oi) => { run.wrong.push(oi); persist(); const meter = $('#pl-meter', lab.main); if (meter) meter.setAttribute('aria-label', meterLabel(run)); },
      record: ({ tries, points, solved: ok }) => {
        /* the round counts the moment it is answered: points, XP and a line in your play history. A missed one earns nothing and goes to Needs Another Look. */
        const won = ok !== false, item = { id: scn.id, tries, points: won ? points : 0, solved: won, xp: 0 }; /* the XP is kept for the results, never shown during a round */
        const out = FD.store.recordQuizRound(kind, item, featOf(scn), { mode: kind });
        item.xp = out.xp;
        run.items.push(item); run.points += item.points; run.done = true;
        persist(); updateMeter(run);
        return out;
      },
      finish: () => { updateMeter(run); return { buttons: html`<button class="btn btn-primary" type="button" data-action="pl-next" id="pl-next">${last ? 'See my results' : 'Next round'} ${FD.icon('right', { size: 18 })}</button>` }; }
    });
  }
  ui.actions['pl-next'] = () => {
    const run = lab.run; if (!run || !run.done) return;
    if (run.i >= run.ids.length - 1) { finish(); return; }
    run.i++; run.wrong = []; run.done = false;
    persist();
    show();
    ui.scrollTop();
  };

  /* the end of a game */
  function finish() {
    const kind = lab.kind, P = Q(), run = lab.run, items = run.items.slice(), focus = focusOf(kind, run);
    lab.focus = P.cleanFilter(run.focus); /* Play again keeps the same choices */
    /* a game saved by an older version gave no XP as it went: those rounds are counted now */
    items.forEach((it) => { if (it.xp == null) { const o = FD.store.recordQuizRound(kind, it, featOf(P.byId[it.id]), { mode: kind }); it.xp = o.xp; ui.celebrate(o); } });
    const out = FD.store.recordQuizGame(kind, items);
    const xp = items.reduce((a, it) => a + (it.xp || 0), 0) + out.bonusXp;
    FD.store.clearActive(P.key);
    lab.run = null;
    if (lab.ctl) { lab.ctl.destroy(); lab.ctl = null; }
    FD.fx.play('win'); FD.fx.confetti({ count: out.perfect ? 220 : 120 });
    ui.celebrate(out);
    const isPrompt = kind === 'prompt';
    const [title, lede] = out.perfect ? [isPrompt ? 'Prompt pro!' : 'Perfect match!', isPrompt ? `All ${items.length} on the first try. Copilot would love your prompts.` : `All ${items.length} on the first try. You know exactly when to reach for each feature.`]
      : out.missed ? ['Good effort!', `${plural(out.missed, 'puzzle')} went to Needs Another Look, so you can try ${out.missed === 1 ? 'it' : 'them'} again from Packs whenever you like.`]
        : out.points >= P.maxPoints(items.length) * 0.6 ? ['Nicely done!', isPrompt ? 'Strong prompts. Look at the ingredients you skipped and you\u2019ll be unstoppable.' : 'Great instincts. Check the scenarios you needed a second look at and you\u2019ll be unstoppable.']
          : ['Good start!', isPrompt ? 'You found every best prompt, and now you know what to add next time: a goal, context, a source and expectations.' : 'You found every best fit, and you now know what a few more Copilot features are really for.'];
    const p = FD.store.profile(), rk = FD.scoring.rank(p.xp), st = isPrompt ? p.prompts : p.match;
    const pickChip = (it) => (it.solved === false
      ? html`<span class="chip chip-solid c-orange">Missed</span>`
      : html`<span class="chip ${it.tries === 1 ? 'chip-solid c-green' : ''}">${it.tries === 1 ? 'First try' : PICK_NAMES[it.tries - 1].replace(/^./, (c) => c.toUpperCase()) + ' pick'} +${it.points}</span>`);
    const recapItem = (it) => {
      const scn = P.byId[it.id]; if (!scn) return '';
      const f = featOf(scn), cat = catOf(f), chip = pickChip(it);
      if (!isPrompt) return html`<li class="pl-recap-item c-${cat.color}"><div class="pl-recap-top">${featChip(f, scn.title)}${chip}</div>
            <p class="pl-recap-sit">${scn.need}</p>
            <p class="pl-recap-how">${scn.text}</p>
            <div class="pl-recap-foot"><button class="btn btn-ghost btn-sm" type="button" data-action="met-open" data-id="${f.id}">${FD.icon('book', { size: 16 })}About ${f.name}</button></div></li>`;
      const best = scn.options[scn.bestIndex];
      return html`<li class="pl-recap-item c-${cat.color}"><div class="pl-recap-top"><span class="pl-recap-tags">${featTag(scn)}${chip}</span><button class="btn btn-ghost btn-sm pl-recap-copy" type="button" data-action="copy-prompt" data-copy="${best.text}">${FD.icon('copy', { size: 16 })}Copy prompt</button></div>
            <p class="pl-recap-sit">${scn.situation}</p>
            <blockquote class="pl-recap-q">${best.text}</blockquote></li>`;
    };
    lab.main.innerHTML = flat(html`<div class="container hub"><section class="card speed-summary pl-summary" aria-labelledby="pl-done">
      <div class="ss-top">${FD.pip(out.perfect ? 'cheer' : 'hello', { size: 130 })}<div><p class="eyebrow">${[K().name + ' complete', focus, plural(items.length, 'round')].filter(Boolean).join(' \u00B7 ')}</p><h1 id="pl-done">${title}</h1><p class="lede">${lede}</p></div></div>
      <div class="ss-stats"><div><strong>${out.points}</strong><span>points</span></div><div><strong>${out.firstTry}/${items.length}</strong><span>first-${isPrompt ? 'try' : 'pick'} ${isPrompt ? 'picks' : 'matches'}</span></div><div><strong>+${xp}</strong><span>XP earned</span></div><div><strong>${st.bestRun}</strong><span>best game${out.best ? ' (new!)' : ''}</span></div></div>
      ${out.bonusXp ? html`<div class="xp-row"><span class="chip">Perfect game bonus +${out.bonusXp} XP</span></div>` : ''}
      <div class="rank-row"><div><strong>${rk.rank.name}</strong><small class="muted">${rk.next ? ` \u00B7 ${rk.toNext} XP to ${rk.next.name}` : ' \u00B7 top rank!'}</small></div>${ui.bar(rk.pct, rk.rank.color, 'Progress to the next rank')}</div>
      <section class="pl-recap" aria-labelledby="pl-recap-h">
        <h2 id="pl-recap-h">${K().recapTitle}</h2>
        <p class="met-help">${FD.icon('info', { size: 18 })}${isPrompt ? 'Here\u2019s the strongest prompt from each round. Copy one and try it in Copilot with your own details.' : 'Here\u2019s the feature that fitted each scenario, and how it helps. Tap About to read everything on it in the Feature Book.'}</p>
        <ol class="pl-recap-list">${items.map(recapItem)}</ol>
      </section>
      ${isPrompt && P.learn ? html`<p class="pl-learn"><a class="btn btn-link" href="${P.learn.url}" target="_blank" rel="noopener noreferrer" data-action="doc-open" data-native>${P.learn.label}${FD.icon('external', { size: 16 })}<span class="sr-only"> (opens in a new tab)</span></a></p>` : ''}
      <div class="btn-row"><button class="btn btn-primary" type="button" data-action="pl-again">${FD.icon('refresh', { size: 20 })}Play again</button><a class="btn btn-ghost" href="#/free">${FD.icon('shuffle', { size: 20 })}Free Play</a><a class="btn btn-ghost" href="#/stats">${FD.icon('chart', { size: 20 })}Your Stats</a></div>
    </section></div>`);
    ui.scrollTop(); focusHead(lab.main);
    ui.holdRankUp(false); /* the game is over: a rank-up can pop up now */
  }
  ui.actions['pl-again'] = () => start(prefRounds(lab.kind), lab.focus, { prioritise: lab.pri });

  /* the two screens */
  const view = (kind, title) => ({
    title,
    render(main, ctx) {
      Object.assign(lab, { main, kind, run: null, scn: null, ctl: null });
      /* a link from a scenario or the Feature Book ("Practice prompting it") opens Prompt Lab already set to that feature */
      const ft = kind === 'prompt' && ctx && ctx.query && ctx.query.feature ? FD.lib.byId[ctx.query.feature] : null;
      if (ft && FD.prompts.features([ft.category]).some((x) => x.id === ft.id)) savePrefs('prompt', prefRounds('prompt'), { category: [ft.category], feature: [ft.id] }, { prioritise: prefPrioritise('prompt') });
      /* ...and a link from the Feature Book opens Scenario Match already set to that feature's category */
      const cat = kind === 'match' && ctx && ctx.query && ctx.query.category ? ctx.query.category : '';
      if (cat && FD.scenarios.categories().includes(cat)) savePrefs('match', prefRounds('match'), { category: [cat], difficulty: 'all' }, { prioritise: prefPrioritise('match') });
      setup(main);
      /* leaving keeps the game (it is saved after every pick) and lets a waiting rank-up pop up */
      return () => { if (lab.ctl) lab.ctl.destroy(); lab.ctl = null; lab.run = null; lab.scn = null; ui.holdRankUp(false); };
    }
  });
  FD.views.prompts = view('prompt', 'Prompt Lab');
  FD.views.match = view('match', 'Scenario Match');

})();
