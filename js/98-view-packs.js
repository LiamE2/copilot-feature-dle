/* Copilot Feature-dle · Packs: themed sets of puzzles.
   A pack mixes all three game modes: Feature Hunt puzzles ("Which Copilot feature am I?", five hints), Scenario Match questions (a work scenario, pick the feature
   that fits) and Prompt Lab questions (a scenario and four prompts). Official packs and monthly spotlights each have their own progress, and one you have already
   played in a pack is not offered again until you finish the pack. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, plural, announce } = FD.u;
  const ui = FD.ui;

  const spotId = (t) => 'spot-' + t.id;
  const monthName = (m) => new Date(Date.UTC(2026, m - 1, 1)).toLocaleDateString('en-AU', { month: 'long', timeZone: 'UTC' });

  /* A pack's progress lists what has been played. A Feature Hunt puzzle is saved as its feature's id (as it always was); a Scenario Match question as 'match:<scenario id>'
     and a Prompt Lab question as 'prompt:<scenario id>'. An item's kind is 'feature' (a Feature Hunt puzzle), 'match' or 'prompt'. */
  const QK = { match: 'match:', prompt: 'prompt:' };
  const QUIZ_KINDS = ['match', 'prompt'];

  /* What a pack (or a monthly spotlight) holds: a Feature Hunt puzzle for each of its features, then, for each of those features, one Scenario Match question (its first
     scenario) and every Prompt Lab question about it. So a pack that holds the Copilot in Excel puzzle also holds an Excel scenario and the Excel prompts.
     A pack or spotlight can choose its own questions with "scenarios" in data/features.json: a list of scenario ids, from data/scenarios.json or data/prompts.json,
     which then replaces that default (an empty list means Feature Hunt puzzles only). */
  function content(def, features) {
    const items = features.map((f) => ({ key: f.id, kind: 'feature', id: f.id }));
    const have = new Set(features.map((f) => f.id)), M = FD.scenarios, P = FD.prompts;
    const ready = (e) => !!e && e.ready;
    const add = (kind, s) => items.push({ key: QK[kind] + s.id, kind, id: s.id, feature: s.feature && have.has(s.feature) ? s.feature : '' });
    if (Array.isArray(def.scenarios)) {
      const seen = new Set();
      def.scenarios.map(String).forEach((id) => {
        if (seen.has(id)) return; seen.add(id);
        if (ready(M) && M.byId[id]) add('match', M.byId[id]); else if (ready(P) && P.byId[id]) add('prompt', P.byId[id]);
      });
    } else {
      if (ready(M)) features.forEach((f) => { const s = M.scenarios.find((x) => x.feature === f.id); if (s) add('match', s); });
      if (ready(P)) P.scenarios.filter((s) => s.feature && have.has(s.feature)).forEach((s) => add('prompt', s));
    }
    return items;
  }
  const build = (pk) => {
    pk.ids = pk.items.map((i) => i.key);
    pk.nFeatures = pk.items.filter((i) => i.kind === 'feature').length;
    pk.nMatch = pk.items.filter((i) => i.kind === 'match').length;
    pk.nPrompts = pk.items.filter((i) => i.kind === 'prompt').length;
    return pk;
  };
  /* what a pack is made of, in the order of the game modes: "12 Feature Hunt", "12 Scenario Match", "22 Prompt Lab" */
  const mixParts = (pk) => [pk.nFeatures ? `${pk.nFeatures} Feature Hunt` : '', pk.nMatch ? `${pk.nMatch} Scenario Match` : '', pk.nPrompts ? `${pk.nPrompts} Prompt Lab` : ''].filter(Boolean);

  function allPacks() {
    const lib = FD.lib;
    const official = lib.packs.map((p) => build({ id: p.id, kind: 'pack', name: p.name, blurb: p.description, color: p.color || 'blue', icon: p.icon || 'package', items: content(p, FD.data.packFeatures(p.id)) }));
    const spots = (lib.themes || []).slice().sort((a, b) => a.year - b.year || a.month - b.month).map((t) => build({ id: spotId(t), kind: 'spot', name: t.title, blurb: t.blurb, color: t.color || 'blue', icon: 'sparkle', month: t.month, year: t.year, items: content(t, FD.data.themeFeatures(t.tag)) }));
    return { official, spots };
  }
  /* Needs Another Look is a pack made for you: the puzzles you missed, from all three game modes (see FD.scoring.lookItems): a Feature Hunt you missed, or a Scenario Match
     or Prompt Lab question you missed in three picks. It is not progress based like the others: every time you play it, it plays whatever you have missed at that moment.
     While a run is on, its list is frozen as a queue so each puzzle is played once. It only shows up in Packs when there is something in it. */
  const REVIEW = 'review';
  /* a queue key back into a pack item: a feature's id is a Feature Hunt puzzle, 'match:<id>' and 'prompt:<id>' are questions */
  function reviewItem(key) {
    const kind = key.startsWith(QK.match) ? 'match' : key.startsWith(QK.prompt) ? 'prompt' : 'feature';
    if (kind === 'feature') return FD.lib.byId[key] ? { key, kind, id: key } : null;
    const id = key.slice(QK[kind].length), s = FD.quiz(kind).byId[id];
    return s && FD.lib.byId[s.feature] ? { key, kind, id, feature: s.feature } : null;
  }
  function reviewPack() {
    const p = FD.store.profile(), e = p.packs[REVIEW];
    const live = FD.scoring.lookItems(p, FD.lib).map((it) => it.key);
    const queue = e && Array.isArray(e.queue) ? e.queue : [];
    return build({ id: REVIEW, kind: 'review', name: 'Needs Another Look', blurb: 'Puzzles you missed. Get one right and it comes off your list.', color: 'orange', icon: 'refresh', items: queue.map(reviewItem).filter(Boolean), live });
  }
  const findPack = (id) => { if (id === REVIEW) return reviewPack(); const a = allPacks(); return a.official.concat(a.spots).find((p) => p.id === id) || null; };
  FD.packs = { all: allPacks, find: findPack, mixParts };

  /* the monthly spotlights have a year toggle, and it only moves between years that have spotlights */
  const spotYears = () => Array.from(new Set((FD.lib.themes || []).filter((t) => FD.data.themeFeatures(t.tag).length).map((t) => t.year))).sort((a, b) => a - b);
  let spotYear = 0;
  function currentSpotYear() {
    const ys = spotYears(), now = new Date().getFullYear();
    if (ys.includes(spotYear)) return spotYear;
    return ys.includes(now) ? now : (ys.filter((y) => y <= now).pop() || ys[0] || now);
  }

  /* Play, or Resume progress + Start again, or Start again once it is finished */
  function packButtons(pk, pr, empty, playLabel) {
    if (empty) return html`<span class="muted small">Coming soon</span>`;
    const restart = (cls) => html`<button class="btn ${cls} btn-sm" type="button" data-action="pack-restart" data-id="${pk.id}">${FD.icon('refresh', { size: 16 })}Start again</button>`;
    if (pr.complete) return restart('btn-dark');
    if (pr.started) return html`<a class="btn btn-dark btn-sm" href="#/pack/${encodeURIComponent(pk.id)}">${FD.icon('play', { size: 16 })}Resume progress</a>${restart('btn-ghost')}`;
    return html`<a class="btn btn-dark btn-sm" href="#/pack/${encodeURIComponent(pk.id)}">${FD.icon('play', { size: 16 })}${playLabel}</a>`;
  }
  /* the progress bar, how many are played, and what the pack is made of */
  const progressBar = (pk, pr) => html`<div class="pk-prog">${ui.bar(pr.pct, 'green', `${pk.name} progress`)}<div class="pk-meta"><span class="pk-n">${pr.count} of ${pr.total} played</span><span class="pk-mixtext">${mixParts(pk).join(' + ')}</span></div></div>`;

  /* an official pack: a box in the carousel */
  function packCard(pk) {
    const pr = FD.store.packProgress(pk.id, pk.ids), empty = !pk.ids.length;
    return html`<article class="pk-card c-${pk.color}" aria-labelledby="pk-${pk.id}">
      <span class="pk-ic" aria-hidden="true">${FD.icon(pk.icon, { size: 26 })}</span>
      <div class="pk-body">
        <h3 id="pk-${pk.id}">${pk.name}${pr.complete ? html` <span class="chip chip-solid c-green">${FD.icon('check', { size: 14 })}Completed</span>` : ''}</h3>
        <p>${pk.blurb}</p>
        ${empty ? '' : progressBar(pk, pr)}
      </div>
      <div class="pk-actions">${packButtons(pk, pr, empty, 'Play')}</div>
    </article>`;
  }

  /* a monthly spotlight: one long row for the month */
  function spotRow(pk, thisMonth) {
    const pr = FD.store.packProgress(pk.id, pk.ids), empty = !pk.ids.length;
    return html`<li><article class="sp-row c-${pk.color} ${thisMonth ? 'is-now' : ''}" aria-labelledby="pk-${pk.id}">
      <span class="sp-month">${monthName(pk.month)}</span>
      <div class="sp-body">
        <h3 id="pk-${pk.id}">${pk.name}${thisMonth ? html` <span class="chip chip-solid c-green">This month</span>` : ''}${pr.complete ? html` <span class="chip chip-solid c-green">${FD.icon('check', { size: 14 })}Completed</span>` : ''}</h3>
        <p>${pk.blurb}</p>
        ${empty ? '' : progressBar(pk, pr)}
      </div>
      <div class="sp-actions">${packButtons(pk, pr, empty, `Play ${pk.ids.length}`)}</div>
    </article></li>`;
  }

  /* Needs Another Look: a slim row made for you. It is not progress based: no progress bar and no Resume or Start again, just Play and the number of puzzles you have missed.
     Playing it always starts a fresh run of what is on the list right now. With nothing on the list there is no row at all (see FD.views.packs). */
  function reviewRow() {
    const pk = reviewPack(), left = pk.live.length;
    return html`<li><article class="rv-row c-orange" aria-labelledby="pk-review">
      <span class="rv-ic" aria-hidden="true">${FD.icon('refresh', { size: 24 })}</span>
      <div class="sp-body">
        <h3 id="pk-review">${pk.name}</h3>
        <p>${pk.blurb}</p>
      </div>
      <div class="sp-actions"><a class="btn btn-dark btn-sm" href="#/pack/${REVIEW}">${FD.icon('play', { size: 16 })}Play ${left}</a></div>
    </article></li>`;
  }
  const stepOk = (dir) => { const ys = spotYears(), i = ys.indexOf(currentSpotYear()); return dir < 0 ? i > 0 : i >= 0 && i < ys.length - 1; };
  function yearStepper() {
    const btn = (dir, label, icon) => html`<button class="yr-btn" type="button" data-action="spot-year" data-dir="${dir}" aria-label="${label}"${FD.u.attrs({ 'aria-disabled': stepOk(dir) ? null : 'true' })}>${FD.icon(icon, { size: 20 })}</button>`;
    return html`<div class="yr" role="group" aria-label="Spotlight year">${btn(-1, 'Previous year', 'left')}<strong class="yr-n" id="yr-n" aria-live="polite">${currentSpotYear()}</strong>${btn(1, 'Next year', 'right')}</div>`;
  }
  function spotList() {
    const y = currentSpotYear(), now = new Date(), { spots } = allPacks();
    return html`<ul class="sp-list">${spots.filter((p) => p.year === y).map((p) => spotRow(p, y === now.getFullYear() && p.month === now.getMonth() + 1))}</ul>`;
  }
  ui.actions['spot-year'] = (el) => {
    const ys = spotYears(), n = ys[ys.indexOf(currentSpotYear()) + (+el.dataset.dir || 0)];
    if (n == null) return;
    spotYear = n;
    const host = document.getElementById('sp-host'), label = document.getElementById('yr-n');
    if (host) host.innerHTML = flat(spotList());
    if (label) label.textContent = String(n);
    document.querySelectorAll('.yr-btn[data-action="spot-year"]').forEach((b) => { if (stepOk(+b.dataset.dir)) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); });
  };

  /* ---------- the official packs: one row you browse sideways. Wide screens show three (a tablet two, a phone one) with the next pack peeking in at the edge. ---------- */
  const carousel = (official) => html`<div class="pk-carousel" id="pk-car">
    <ul class="pk-track" id="pk-track" tabindex="0" aria-label="Official packs. Scroll sideways, or use the arrows, to see more.">${official.map((p) => html`<li class="pk-slide">${packCard(p)}</li>`)}</ul>
  </div>`;
  function carouselStepper(n) {
    const btn = (dir, label, icon) => html`<button class="pk-btn" type="button" data-action="pk-scroll" data-dir="${dir}" aria-label="${label}">${FD.icon(icon, { size: 20 })}</button>`;
    return html`<div class="yr pk-step" id="pk-step" role="group" aria-label="Browse the official packs">${btn(-1, 'Previous packs', 'left')}<strong class="yr-n pk-range" id="pk-range" aria-live="polite">1 of ${n}</strong>${btn(1, 'Next packs', 'right')}</div>`;
  }
  /* one pack at a time per press, the same as a swipe; the cards snap into place */
  ui.actions['pk-scroll'] = (el) => {
    const track = document.getElementById('pk-track');
    if (!track || el.getAttribute('aria-disabled') === 'true') return;
    const slides = Array.from(track.children); if (!slides.length) return;
    const tr = track.getBoundingClientRect(), pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
    const at = (s) => s.getBoundingClientRect().left - tr.left + track.scrollLeft; /* where a pack starts along the row */
    const lead = slides.reduce((best, s, i) => (Math.abs(at(s) - track.scrollLeft - pad) < Math.abs(at(slides[best]) - track.scrollLeft - pad) ? i : best), 0);
    const to = Math.max(0, Math.min(slides.length - 1, lead + (+el.dataset.dir || 0)));
    track.scrollTo({ left: Math.max(0, at(slides[to]) - pad), behavior: FD.u.reduceMotion() ? 'auto' : 'smooth' });
    track.dispatchEvent(new Event('scroll')); /* bring the count and the arrows up to date straight away, rather than waiting for the browser's own scroll events */
  };
  /* keep the "1\u20133 of 4" and the arrows in step with what is on screen, however it got there (arrows, swipe, wheel, keyboard focus) */
  function wireCarousel(main) {
    const track = main.querySelector('#pk-track'), step = main.querySelector('#pk-step');
    if (!track || !step) return null;
    const range = step.querySelector('#pk-range'), prev = step.querySelector('[data-dir="-1"]'), next = step.querySelector('[data-dir="1"]'), slides = Array.from(track.children);
    const setOff = (b, off) => { if (off) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); };
    let timer = 0;
    const update = () => {
      timer = 0;
      const max = track.scrollWidth - track.clientWidth, tr = track.getBoundingClientRect();
      step.hidden = max <= 2; /* everything fits: nothing to browse */
      const whole = slides.map((s, i) => [i, s.getBoundingClientRect()]).filter(([, r]) => r.left >= tr.left - 2 && r.right <= tr.right + 2).map(([i]) => i + 1);
      const a = whole.length ? whole[0] : 1, b = whole.length ? whole[whole.length - 1] : 1;
      range.textContent = `${a === b ? a : `${a}\u2013${b}`} of ${slides.length}`;
      setOff(prev, track.scrollLeft <= 2); setOff(next, track.scrollLeft >= max - 2);
    };
    const queue = () => { if (!timer) timer = setTimeout(update, 30); };
    track.addEventListener('scroll', queue, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null;
    if (ro) ro.observe(track); else window.addEventListener('resize', queue);
    update();
    return () => { clearTimeout(timer); if (ro) ro.disconnect(); else window.removeEventListener('resize', queue); };
  }

  ui.actions['pack-restart'] = async (el) => {
    const pk = findPack(el.dataset.id); if (!pk) return;
    if (pk.kind === 'review') {
      /* opening it always plays whatever you have missed right now */
      if (!pk.live.length) { ui.toast('Nothing to revisit right now. Nice!', { icon: 'check' }); return; }
      ui.go('/pack/' + REVIEW);
      return;
    }
    const pr = FD.store.packProgress(pk.id, pk.ids);
    if (pr.started && !pr.complete && !(await ui.confirm('Start again?', `Your progress in ${pk.name} (${pr.count} of ${pr.total} played) will reset, and you\u2019ll start from the beginning.`, 'Start again'))) return;
    FD.store.packRestart(pk.id);
    ui.go('/pack/' + encodeURIComponent(pk.id));
  };

  FD.views.packs = {
    title: 'Packs',
    render(main) {
      const { official } = allPacks(), made = reviewPack().live.length;
      /* Needs Another Look only shows up while there is something in it */
      main.innerHTML = flat(html`<div class="container hub">
        ${ui.modeHead('packs')}
        ${ui.modeNav('packs')}
        ${made ? ui.section('Made for you', html`<ul class="sp-list">${reviewRow()}</ul>`, { id: 'pk-made' }) : ''}
        ${ui.section('Official packs', carousel(official), { id: 'pk-off', aside: carouselStepper(official.length) })}
        ${ui.section('Monthly spotlights', html`<div id="sp-host">${spotList()}</div>`, { id: 'pk-themes', aside: yearStepper() })}
      </div>`);
      return wireCarousel(main);
    }
  };

  /* ---------- playing a pack: one puzzle at a time (a Feature Hunt puzzle, a Scenario Match question or a Prompt Lab question), never repeating one you have already played ---------- */
  FD.views.pack = {
    title: 'Pack',
    render(main, ctx) {
      let pk = findPack(ctx.params.id);
      /* Needs Another Look is not worked through over time: every time it is opened it starts a fresh run of whatever has been missed right now */
      if (pk && pk.kind === 'review') {
        if (!pk.live.length) { ui.toast('Nothing to revisit right now. Nice!', { icon: 'check' }); ui.go('/packs'); return; }
        FD.store.reviewStart(pk.live);
        pk = reviewPack();
      }
      if (!pk || !pk.ids.length) { ui.toast('That pack isn\u2019t available yet.', { icon: 'x' }); ui.go('/packs'); return; }
      const review = pk.kind === 'review';
      let ctl = null, qctl = null; /* ctl: the Feature Hunt game on screen, qctl: the question on screen */
      const KEY = 'pack:' + pk.id;
      /* a pack moves on to the next puzzle (Needs Another Look too: its puzzles come from all three game modes) */
      const nextLabel = 'Next puzzle';
      /* the same round tracker the games of rounds show, in the same place, counting puzzles: "Puzzle 3 of 46" (a pack with a single puzzle has no use for one) */
      const tracker = (pr) => (pr.total > 1 ? ui.roundTracker({ noun: 'Puzzle', n: pr.count + 1, total: pr.total }) : '');
      const sayPuzzle = (pr) => { if (pr.total > 1) announce(`Puzzle ${pr.count + 1} of ${pr.total}.`); };
      const stop = () => { if (ctl) ctl.destroy(); ctl = null; if (qctl) qctl.destroy(); qctl = null; };

      function complete() {
        stop();
        const left = review ? reviewPack().live.length : 0;
        main.innerHTML = flat(html`<div class="container hub"><section class="card speed-summary" aria-labelledby="pk-done">
          <div class="ss-top">${FD.pip('cheer', { size: 130 })}<div><p class="eyebrow">${pk.name}</p><h1 id="pk-done">${review ? 'Run complete!' : 'Pack complete!'}</h1>
            <p class="lede">${review ? html`You\u2019ve played all ${pk.ids.length} puzzles you missed. ${left ? html`<strong>${left}</strong> ${left === 1 ? 'is' : 'are'} still on your list: get ${left === 1 ? 'it' : 'them'} right next time and ${left === 1 ? 'it' : 'they'} will come off.` : 'Nothing is left on your list. Brilliant!'}` : `You\u2019ve played all ${pk.ids.length} puzzles in this pack (${mixParts(pk).join(', ')}). Start again to play them in a fresh order, or pick another pack.`}</p></div></div>
          <div class="btn-row">${review ? (left ? html`<button class="btn btn-primary" type="button" data-action="pack-restart" data-id="${pk.id}">${FD.icon('refresh', { size: 20 })}Play ${left}</button>` : '') : html`<button class="btn btn-primary" type="button" data-action="pack-restart" data-id="${pk.id}">${FD.icon('refresh', { size: 20 })}Start again</button>`}<a class="btn ${review && left ? 'btn-ghost' : 'btn-primary'}" href="#/packs">${FD.icon('package', { size: 20 })}Back to Packs</a></div>
        </section></div>`);
        ui.scrollTop(); const h = $('#pk-done', main); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      }

      /* the last puzzle in a pack or spotlight: its badges, and a burst of confetti. (Finishing a Needs Another Look run has its own badge, and is not one of the "finish a whole pack" badges.) */
      function packFinished() {
        if (review) ui.celebrate({ newBadges: FD.store.bump('reviewRuns') });
        else ui.celebrate({ newBadges: FD.store.bump('packsFinished').concat(pk.kind === 'spot' ? FD.store.bump('spotlightsFinished') : []) });
        FD.fx.confetti({ count: 260 });
      }

      /* a question about a feature waits until that feature has had its puzzle (or you already have it in your Feature Book),
         so a question's feature name never gives away a puzzle that is still to come */
      const collectedFeature = (id) => { const f = FD.lib.byId[id]; return !!f && FD.scoring.collected(FD.store.profile(), f); };
      function choose(remaining, done) {
        const open = remaining.filter((it) => it.kind === 'feature' || !it.feature || done.has(it.feature) || collectedFeature(it.feature));
        const pool = open.length ? open : remaining;
        const recent = new Set(FD.store.profile().history.slice(0, 5).map((h) => h.id));
        const fresh = pool.filter((it) => it.kind !== 'feature' || !recent.has(it.id));
        return FD.u.pick(fresh.length ? fresh : pool);
      }

      function next() {
        const pr = FD.store.packProgress(pk.id, pk.ids);
        if (pr.complete) { complete(); return; }
        const done = new Set(pr.done), remaining = pk.items.filter((it) => !done.has(it.key));
        const saved = FD.store.getActive(KEY);
        /* a question left half-answered waits for you exactly as you left it */
        if (saved && QUIZ_KINDS.includes(saved.kind)) {
          const it = remaining.find((r) => r.key === QK[saved.kind] + saved.id);
          if (it) { ask(it, pr, saved); return; }
          FD.store.clearActive(KEY);
        }
        /* a feature left half-played waits for you, paused, exactly as you left it; otherwise the next puzzle comes from what is left */
        const kept = saved && saved.fid ? FD.Game.restore(saved) : null;
        let game = kept && !kept.over && remaining.some((r) => r.kind === 'feature' && r.id === kept.f.id) ? kept : null;
        if (!game) {
          const it = choose(remaining, done);
          if (!it) { complete(); return; }
          if (it.kind !== 'feature') { ask(it, pr, null); return; }
          game = new FD.Game(FD.lib.byId[it.id], { mode: 'pack' });
        }
        const f = game.f;
        stop();
        main.innerHTML = '<div class="container play-wrap" id="play-root"></div>';
        ctl = FD.play.mount($('#play-root', main), game, {
          mode: 'pack', title: `${pk.name}${pk.nMatch || pk.nPrompts ? ' \u00B7 Feature Hunt' : ''}`, headExtra: tracker(pr), persistKey: KEY,
          onFinish: (g, data) => {
            const finished = FD.store.packMarkDone(pk.id, f.id, pk.ids);
            const after = FD.store.packProgress(pk.id, pk.ids);
            data.pack = { name: pk.name, done: after.count, total: after.total, complete: after.complete };
            if (finished) packFinished();
          },
          /* a pack never offers "Play again": you move on to the next puzzle instead */
          actions: (g, data) => {
            const back = { label: 'Back to Packs', href: '#/packs', icon: 'package' };
            if (!(data.pack && data.pack.complete)) return [{ label: nextLabel, action: 'pack-next', icon: 'right', cls: 'btn-primary' }, back];
            const left = review ? reviewPack().live.length : 0;
            if (review) return left ? [{ label: `Play ${left}`, action: 'pack-restart', id: pk.id, icon: 'refresh', cls: 'btn-primary' }, back] : [Object.assign({ cls: 'btn-primary' }, back)];
            return [{ label: 'Start again', action: 'pack-restart', id: pk.id, icon: 'refresh', cls: 'btn-primary' }, back];
          }
        });
        sayPuzzle(pr);
        ui.scrollTop();
      }
      ui.actions['pack-next'] = () => next();

      /* ---------- a Scenario Match or Prompt Lab question, shown the same way those game modes show one ---------- */
      function ask(it, pr, saved) {
        const kind = it.kind, Q = FD.quiz(kind), scn = Q.byId[it.id], feat = FD.lib.byId[scn.feature];
        stop();
        const order = saved && FD.quizUI.validOrder(saved.order) ? saved.order.slice() : FD.quizUI.freshOrder();
        const wrong = saved && FD.quizUI.validOrder(saved.order) && Array.isArray(saved.wrong) ? saved.wrong : [];
        main.innerHTML = flat(html`<div class="container play-wrap pl-wrap">${FD.quizUI.head(kind, [pk.name, FD.puzzles.name(kind)])}${tracker(pr)}<div id="pl-body"></div></div>`);
        /* the question in play is saved after every pick, so leaving never loses it (the pack then offers Resume progress) */
        const keep = () => { if (qctl) FD.store.setActive(KEY, { kind, id: scn.id, order: qctl.state.order, wrong: qctl.state.wrong, savedAt: Date.now() }); };
        let finished = false;
        qctl = FD.quizUI.mount($('#pl-body', main), {
          kind, scn, order, wrong,
          onWrong: keep,
          /* the question counts the moment it is answered, exactly as in its own game mode: its points are XP, and it is added to your play history. Three weaker picks and it is a miss:
             nothing is earned, the answer is shown and it goes to Needs Another Look (it still counts as played in the pack). */
          record: ({ tries, points, solved }) => {
            const out = FD.store.recordQuizRound(kind, { id: scn.id, tries, points, solved: solved !== false }, feat, { mode: 'pack' });
            FD.store.clearActive(KEY);
            finished = FD.store.packMarkDone(pk.id, it.key, pk.ids);
            return out;
          },
          finish: () => {
            const after = FD.store.packProgress(pk.id, pk.ids);
            const back = html`<a class="btn btn-ghost" href="#/packs">${FD.icon('package', { size: 20 })}Back to Packs</a>`;
            const left = review ? reviewPack().live.length : 0;
            /* the last puzzle of a pack offers Start again; the last of a Needs Another Look run offers a fresh run of what is still missed (or just the way back, when nothing is) */
            const buttons = after.complete
              ? (review
                ? (left ? html`<button class="btn btn-primary" type="button" data-action="pack-restart" data-id="${pk.id}" id="pl-next">${FD.icon('refresh', { size: 20 })}Play ${left}</button>${back}` : html`<a class="btn btn-primary" href="#/packs" data-q-focus>${FD.icon('package', { size: 20 })}Back to Packs</a>`)
                : html`<button class="btn btn-primary" type="button" data-action="pack-restart" data-id="${pk.id}" id="pl-next">${FD.icon('refresh', { size: 20 })}Start again</button>${back}`)
              : html`<button class="btn btn-primary" type="button" data-action="pack-next" id="pl-next">${nextLabel} ${FD.icon('right', { size: 18 })}</button>${back}`;
            const note = html`<p class="note c-purple pk-note">${FD.icon('package', { size: 18 })}<span>${after.complete ? html`<strong>${pk.name} complete!</strong> You\u2019ve played everything in it.` : html`${pk.name}: <strong>${after.count} of ${after.total}</strong> played`}</span></p>`;
            if (finished) setTimeout(packFinished, 0); /* after this answer's own celebration has been queued */
            return { buttons, note };
          }
        });
        if (!qctl.state.done) keep(); /* a saved question that turns out to be a miss has just been recorded and cleared: it must not be saved again */
        sayPuzzle(pr);
        ui.scrollTop();
      }

      next();
      return stop;
    }
  };
})();
