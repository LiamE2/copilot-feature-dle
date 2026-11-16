/* Copilot Feature-dle · the play screen (hint card, hint-o-meter, Pip's extras, guess box with autocomplete, guess history, results) */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $$, announce, mount } = FD.u;
  const ui = FD.ui;

  /* hint colours "warm up" as the hints get easier */
  const HINT_COLORS = ['blue', 'purple', 'pink', 'orange', 'green'];
  const hintColor = (n) => HINT_COLORS[(n - 1) % HINT_COLORS.length];

  const TEMP_MSG = {
    hot: (g) => `Ooh, ${g.name} is in the same family. Very warm!`,
    warm: (g) => `Warm! ${g.name} lives in the same neighbourhood.`,
    cold: (g) => `Brrr, ${g.name} is a different category. Fresh hint coming up.`
  };

  /**
   * mount(container, game, opts) -> controller { destroy, update, suspend, wake, forceFinish }
   *   opts.mode            'daily' | 'free' | 'pack' | 'hunt'  (the way it is played: it is what the play history and the stats call it)
   *   opts.title           eyebrow text
   *   opts.dateKey         daily date key
   *   opts.number          daily challenge number (shown in the answer block's heading line)
   *   opts.finished        stored summary for an already-finished daily
   *   opts.onGuess/onFinish callbacks
   *   opts.actions         buttons under the learning cards: an array, or (game, data) => array
   *   opts.next            a button for the top of the answer block, so the next round of a game of rounds is one click away: { label, action, icon }, or (game, data) => that
   *   opts.headExtra       extra html under the header (a game of rounds puts its round meter here)
   *   opts.persistKey      keep the running game in storage under this key, so it can be picked up again (Daily Challenge, Packs)
   *   opts.realtime        true = the clock is real elapsed time and never pauses when the player leaves (the Daily Challenge)
   *
   * Except for the Daily Challenge, the clock only runs while the game is on screen. Leaving it (another screen, another tab, closing the app)
   * pauses it and saves the game; coming back carries on from the same second. The controller also offers suspend() / wake() for the modes
   * that keep the game themselves. The Daily Challenge is the exception: its clock keeps running in real time, and the challenge still ends at midnight.
   */
  function mountPlay(container, game, opts = {}) {
    const cfg = FD.config;
    let destroyed = false, autoPaused = false, lastShown = game.hintsShown, timerId = 0, unhook = null;
    let sugIdx = -1, sugList = [];

    const isFinishedView = !!opts.finished;
    const f = game.f;
    /* the stopwatch belongs to the Daily Challenge, where the time on the clock sets the Speed Bonus. Every other way to play keeps time quietly and shows none. */
    const showClock = FD.scoring.speedApplies(opts.mode);

    container.innerHTML = flat(html`
      <div class="play">
        <header class="play-head" id="play-head">
          <div class="play-title"><p class="eyebrow">${opts.title || 'Free Play'}</p><h1 class="play-h1">Which Copilot feature am I?</h1></div>
          <div class="play-chips" id="play-chips"></div>
        </header>
        ${opts.headExtra || ''}
        <div class="result-host" id="result-host" tabindex="-1"></div>
        <div class="play-grid" id="play-grid">
          <div class="play-main">
            <section class="hint-card" id="hint-card" aria-label="Current hint"></section>
            <section class="earlier" id="earlier" aria-label="Hints"></section>
            <form class="guess-form" id="guess-form" novalidate>
              <label class="label" for="guess-input" id="guess-label">Your guess</label>
              <div class="guess-row">
                <div class="combo">
                  <input id="guess-input" class="input input-lg" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggest" aria-describedby="guess-help guess-msg" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type a Copilot feature\u2026" enterkeyhint="go">
                  <ul id="suggest" class="suggest" role="listbox" aria-label="Suggested features" hidden></ul>
                </div>
                <button class="btn btn-primary btn-lg" type="submit" id="guess-btn">Guess</button>
              </div>
              <p id="guess-help" class="help">Typos are fine, and you can skip the word \u201CCopilot\u201D if you like.</p>
              <p id="guess-msg" class="guess-msg" role="status" aria-live="polite"></p>
              <div class="guess-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-act="nudge">${FD.icon('bulb', { size: 18 })}Need a nudge? <small>(uses a guess)</small></button>
                <button type="button" class="btn btn-link btn-sm" data-act="giveup">I give up</button>
              </div>
            </form>
            <section class="history" id="history" aria-labelledby="hist-h"></section>
          </div>
          <aside class="play-side" id="play-side" aria-label="Progress and extras">
            <section class="card meter-card" id="meter"></section>
            <section class="card extras" id="extras" aria-labelledby="extras-h"></section>
            <section class="card score-panel" id="scorep"></section>
          </aside>
        </div>
        <div class="learn-host" id="learn-host"></div>
      </div>`);

    const q = (s) => container.querySelector(s);
    const input = q('#guess-input'), list = q('#suggest'), msgEl = q('#guess-msg'), form = q('#guess-form');

    /* ---------- pieces ---------- */
    function chipsHtml() {
      const lvl = FD.hints.level(game.over ? 5 : game.hintsShown);
      const timer = showClock && !game.over ? html`<span class="chip timer-chip" title="Time on the clock (it sets your Speed Bonus, and it keeps ticking if you leave the game)">${FD.icon('timer', { size: 16 })}<span class="sr-only">Time on the clock: </span><span id="play-timer">${FD.u.fmtClock(game.activeMs)}</span></span>` : '';
      return html`${ui.diffChip(f.difficulty)}${lvl.category ? ui.catChip(f.category) : html`<span class="chip chip-locked">${FD.icon('lock', { size: 14 })}Category at hint 3</span>`}${timer}`;
    }
    function hintCardHtml(isNew) {
      const n = game.hintsShown, c = hintColor(n);
      return html`<div class="hint-pip">${FD.pip(n === 1 ? 'hello' : 'think', { size: 96 })}</div>
        <div class="hint-bubble c-${c} ${isNew ? 'is-new' : ''}">
          <p class="hint-label"><span class="hint-n">Hint ${n} of ${cfg.maxAttempts}</span></p>
          <p class="hint-text">${game.hints[n - 1]}</p>
        </div>`;
    }
    function earlierHtml() {
      const n = game.hintsShown;
      if (n < 2) return '';
      return html`<h2 class="mini-h">Earlier hints</h2><ol class="earlier-list">${game.hints.slice(0, n - 1).map((h, i) => html`<li class="c-${hintColor(i + 1)}"><span class="e-n" aria-hidden="true">${i + 1}</span><span class="sr-only">Hint ${i + 1}: </span><span class="e-t">${h}</span></li>`).reverse()}</ol>`;
    }
    function allHintsHtml() {
      return html`<h2 class="mini-h">The hints</h2><ol class="earlier-list">${game.hints.slice(0, game.won ? game.hintsUsed : cfg.maxAttempts).map((h, i) => html`<li class="c-${hintColor(i + 1)}"><span class="e-n" aria-hidden="true">${i + 1}</span><span class="sr-only">Hint ${i + 1}: </span><span class="e-t">${h}</span></li>`)}</ol>`;
    }
    function meterHtml() {
      const n = game.hintsShown, over = game.over;
      return html`<h2 class="mini-h" id="meter-h">Hint-o-meter</h2>
        <ol class="meter" aria-labelledby="meter-h">${cfg.points.map((p, i) => {
          const k = i + 1, state = over ? (k <= (game.won ? game.hintsUsed : cfg.maxAttempts) ? 'used' : 'locked') : k < n ? 'used' : k === n ? 'current' : 'locked';
          return html`<li class="meter-step is-${state} c-${hintColor(k)}" aria-label="Hint ${k}, ${p} points, ${state === 'used' ? 'unlocked' : state === 'current' ? 'current' : 'locked'}"><span class="meter-n" aria-hidden="true">${state === 'locked' ? FD.icon('lock', { size: 14 }) : k}</span><span class="meter-pts" aria-hidden="true">${p}</span></li>`;
        })}</ol>
        <p class="attempts"><span class="dotrow" aria-hidden="true">${Array.from({ length: cfg.maxAttempts }, (_, i) => html`<i class="${i < game.guesses.length ? 'used' : ''}"></i>`)}</span>${over ? html`<strong>${game.won ? `Solved on guess ${game.guesses.length}` : 'Answer revealed'}</strong>` : html`<strong>${game.attemptsLeft}</strong> ${game.attemptsLeft === 1 ? 'guess' : 'guesses'} left`}</p>`;
    }
    /* the Speed Bonus line only exists on the Daily Challenge: every other way to play scores the hint alone */
    function scoreHtml() {
      const daily = FD.scoring.speedApplies(opts.mode), p = FD.scoring.potential(game.hintsShown, game.activeMs, opts.mode);
      let speedNote = '';
      const t = daily ? cfg.speedBonus.find((s) => game.activeMs <= s.maxMs) : null;
      if (t) speedNote = html`<small>${FD.u.fmtSeconds(Math.max(1000, t.maxMs - game.activeMs))} left for this bonus</small>`;
      return html`<h2 class="mini-h">Score</h2>
        <p class="score-now"><span class="score-num" id="score-num">${p.total}</span><small>points if you nail it now</small></p>
        <ul class="score-lines">
          <li><span>Hint ${game.hintsShown} of ${cfg.maxAttempts}</span><b>${p.base}</b></li>
          ${daily ? html`<li><span>Speed bonus</span><b id="score-speed">+${p.speed}</b>${speedNote}</li>` : ''}
        </ul>`;
    }
    /* Pip's extras: three unlocks (category, name shape, first letters), each with a clear locked state.
       The first letters are shown on the name-shape tiles, so once unlocked their row is just a tick and its label. */
    function extrasHtml(isNew) {
      const n = game.over ? 5 : game.hintsShown, lvl = FD.hints.level(n);
      const unlocked = [lvl.category, lvl.shape, lvl.first].filter(Boolean).length;
      const row = (open, at, label, verb, body) => html`<li class="x-row ${open ? 'is-open' : 'is-locked'} ${open && isNew && !game.over && n === at ? 'is-new' : ''}">
        <span class="x-label">${FD.icon(open ? 'check' : 'lock', { size: 16 })}${label}${open && isNew && !game.over && n === at ? html`<span class="x-new">New!</span>` : ''}</span>
        ${open ? body : html`<small class="x-lock">${label} ${verb} at hint ${at}</small>`}</li>`;
      return html`<h2 class="mini-h extras-h" id="extras-h">${FD.icon('sparkle', { size: 18 })}Pip\u2019s extras <span class="x-count">${unlocked} of 3 unlocked</span></h2>
        <ul class="extras-list">
          ${row(lvl.category, 3, 'Category', 'unlocks', ui.catChip(f.category))}
          ${row(lvl.shape, 4, 'Name shape', 'unlocks', html`<div>${ui.nameTiles(f.name, lvl, false)}<small>One tile for every letter in each word</small></div>`)}
          ${row(lvl.first, 5, 'First letters', 'unlock', '')}
        </ul>`;
    }
    function historyHtml() {
      return html`<h2 class="mini-h" id="hist-h">Your guesses</h2>
        ${game.guesses.length ? html`<ol class="guess-list">${game.guesses.map((g, i) => g.k === 's'
          ? html`<li class="guess is-skip"><span class="g-n">${i + 1}</span><span class="g-name">Nudge used</span><span class="g-chips">${ui.tempChip('skip')}<span class="chip">Next hint revealed</span></span></li>`
          : html`<li class="guess is-${g.temp}"><span class="g-n">${i + 1}</span><span class="g-name">${g.name}</span><span class="g-chips">${ui.tempChip(g.temp)}
              ${g.temp === 'correct' ? '' : html`${ui.defChip(g.sameCat ? 'check' : 'x', g.sameCat ? 'Same category' : 'Different category', 'category')}
              ${ui.defChip(g.dir === 'up' ? 'up' : g.dir === 'down' ? 'down' : 'equals', g.dir === 'up' ? 'Answer is harder' : g.dir === 'down' ? 'Answer is easier' : 'Same difficulty', 'level')}`}</span></li>`)}</ol>`
          : html`<p class="muted empty">No guesses yet. Each wrong guess gets a hot or cold clue, then unlocks the next hint.</p>`}`;
    }
    function drawAll(isNew) {
      const over = game.over;
      mount(q('#play-chips'), chipsHtml());
      if (!over) {
        mount(q('#hint-card'), hintCardHtml(isNew));
        mount(q('#earlier'), earlierHtml());
        mount(q('#meter'), meterHtml());
        mount(q('#extras'), extrasHtml(isNew));
        mount(q('#scorep'), scoreHtml());
      } else {
        /* finished, solved or not: the hint-o-meter and Pip's extras have done their job, so they are put away and the hints and guesses are all that is left */
        mount(q('#earlier'), allHintsHtml());
      }
      mount(q('#history'), historyHtml());
      form.hidden = over;
      q('#hint-card').hidden = over;
      q('#scorep').hidden = over;
      q('#meter').hidden = over;
      q('#extras').hidden = over;
      q('#play-side').hidden = over;
      q('#play-head').hidden = over; /* the answer block takes over the top of the page */
      const grid = q('#play-grid');
      grid.classList.toggle('is-over', over);
      grid.classList.toggle('is-solved', over);
      /* post-game, hint N and guess N share one row so the two lists always line up in height */
      if (over) grid.style.setProperty('--recap-rows', String(1 + Math.max(game.won ? game.hintsUsed : cfg.maxAttempts, game.guesses.length)));
      else grid.style.removeProperty('--recap-rows');
    }

    /* ---------- suggestions (ARIA combobox) ---------- */
    function closeList() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); sugIdx = -1; }
    function openList() {
      const v = input.value.trim();
      sugList = v.length ? FD.match.suggest(v, FD.lib.features, 5, game.guessedIds()) : [];
      if (!sugList.length) { closeList(); return; }
      list.innerHTML = flat(sugList.map((s, i) => html`<li role="option" id="sg-${i}" data-i="${i}" aria-selected="false"><span class="sg-name">${s.name}</span><span class="sg-meta">${s.category}</span></li>`));
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); sugIdx = -1;
      const vv = window.visualViewport, room = (vv ? vv.height + vv.offsetTop : innerHeight) - input.getBoundingClientRect().bottom;
      list.classList.toggle('up', room < 250);
    }
    function highlight(i) {
      $$('#suggest li', container).forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      if (i >= 0) { input.setAttribute('aria-activedescendant', 'sg-' + i); const li = q('#sg-' + i); if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
      sugIdx = i;
    }
    function pickSuggestion(i) { const s = sugList[i]; if (!s) return; input.value = s.name; closeList(); input.focus(); }

    input.addEventListener('input', openList);
    input.addEventListener('focus', () => { if (input.value.trim()) openList(); });
    input.addEventListener('blur', () => setTimeout(closeList, 120));
    input.addEventListener('keydown', (e) => {
      const open = !list.hidden;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); if (sugList.length) highlight((sugIdx + 1) % sugList.length); }
      else if (e.key === 'ArrowUp') { if (open) { e.preventDefault(); highlight((sugIdx - 1 + sugList.length) % sugList.length); } }
      else if (e.key === 'Enter' && open && sugIdx >= 0) { e.preventDefault(); pickSuggestion(sugIdx); }
      else if (e.key === 'Escape' && open) { e.preventDefault(); closeList(); }
      else if (e.key === 'Tab') closeList();
    });
    list.addEventListener('mousedown', (e) => { e.preventDefault(); const li = e.target.closest('li'); if (li) pickSuggestion(+li.dataset.i); });

    /* ---------- messages ---------- */
    function say(text, kind) { msgEl.textContent = text; msgEl.className = 'guess-msg' + (kind ? ' is-' + kind : ''); }
    function shake() { if (FD.u.reduceMotion()) return; input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); }

    /* ---------- submit ---------- */
    function submit() {
      if (game.over) return;
      const res = game.submit(input.value);
      if (!res.ok) {
        if (res.reason === 'empty') say('Type a feature name first.', 'warn');
        else if (res.reason === 'duplicate') say(`You've already tried ${res.feature.name}. Pick something new!`, 'warn');
        else if (res.reason === 'ambiguous') say(`That could be ${res.options.slice(0, 3).map((o) => o.name).join(' or ')}. Be a little more specific!`, 'warn');
        else say('Hmm, I don\u2019t know that one. Try picking from the suggestions as you type.', 'warn');
        shake(); input.focus(); return;
      }
      input.value = ''; closeList();
      if (opts.onGuess) opts.onGuess(game, res);
      persist();
      if (game.over) { finish(); return; }
      FD.fx.play('wrong'); FD.fx.haptic(40);
      say(`${TEMP_MSG[res.guess.temp](res.guess)} ${res.guess.dir === 'up' ? 'The answer is a bit harder.' : res.guess.dir === 'down' ? 'The answer is a bit easier.' : ''}`.trim(), res.guess.temp);
      afterStep();
    }
    function afterStep(focus = true) {
      const isNew = game.hintsShown !== lastShown; lastShown = game.hintsShown;
      drawAll(isNew);
      if (isNew) { FD.fx.play('hint'); announce(`Hint ${game.hintsShown}: ${game.hints[game.hintsShown - 1]}. ${game.attemptsLeft} guesses left.`); }
      if (opts.onStep) opts.onStep(game);
      if (focus) input.focus();
    }
    function persist() { if (opts.persistKey) FD.store.setActive(opts.persistKey, game.serialize()); }

    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    form.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b || game.over) return;
      if (b.dataset.act === 'nudge') {
        const r = game.nudge(); if (!r.ok) return;
        if (opts.onGuess) opts.onGuess(game, r);
        persist(); say('Here\u2019s the next hint. That nudge used one of your guesses.', 'warn');
        if (game.over) finish(); else afterStep();
      } else if (b.dataset.act === 'giveup') {
        const ok = await ui.confirm('Give up on this one?', 'No worries! We\u2019ll reveal the answer so you can learn it. It counts as a miss.', 'Show me the answer');
        if (ok) { game.giveUp(); persist(); finish(); }
      }
    });

    /* ---------- the clock: it runs while the game is on screen (the Daily Challenge's runs in real time, wherever you are, and is the only one shown) ---------- */
    function tick() {
      if (destroyed || game.over || game.pausedAt) return;
      if (opts.mode === 'daily' && opts.dateKey && FD.u.dateKey() !== opts.dateKey) { game.expire(); persist(); finish(); return; }
      if (!showClock) return;
      const t = q('#play-timer'); if (t) t.textContent = FD.u.fmtClock(game.activeMs);
      if (q('#score-num')) mount(q('#scorep'), scoreHtml());
    }
    if (!isFinishedView && !game.over) timerId = setInterval(tick, 1000);

    /* leaving the game (or hiding the page) stops its clock and saves it; wake() undoes only a pause made here, never the player's own Pause.
       A real-time game (the Daily Challenge) is only saved: its clock carries on. */
    function suspend() {
      if (destroyed || game.over || isFinishedView) return;
      if (!opts.realtime && !game.pausedAt) { game.pause(); autoPaused = true; }
      persist();
    }
    function wake() {
      if (destroyed || game.over || !autoPaused) return;
      autoPaused = false; game.resume(); persist(); tick();
    }

    /* ---------- finish ---------- */
    function finish() {
      if (destroyed) return;
      clearInterval(timerId);
      const data = { feature: f, won: game.won, expired: game.expired, hintsUsed: game.hintsUsed, timeMs: Math.round(game.activeMs), grid: game.grid, guesses: game.guesses, mode: opts.mode, dateKey: opts.dateKey, number: opts.number };
      const out = FD.store.recordGame({ mode: opts.mode, dateKey: opts.dateKey, feature: f, won: game.won, expired: game.expired, hintsUsed: game.hintsUsed, timeMs: data.timeMs, grid: game.grid, guesses: game.guesses, typo: game.typo });
      Object.assign(data, out);
      if (opts.persistKey && opts.mode !== 'daily') FD.store.clearActive(opts.persistKey);
      FD.fx.play(game.won ? 'win' : 'lose'); FD.fx.haptic(game.won ? [30, 40, 60] : 120);
      if (game.won) FD.fx.confetti({ count: game.hintsUsed <= 2 ? 220 : 150 });
      announce(game.won ? `Correct! The answer was ${f.name}.` : game.expired ? `The day ended. The answer was ${f.name}.` : `Out of guesses. The answer was ${f.name}.`);
      drawAll(false);
      if (opts.onFinish) opts.onFinish(game, data);
      showResult(data, out);
    }
    function actionsFor(data) { return typeof opts.actions === 'function' ? opts.actions(game, data) : opts.actions; }
    const nextFor = (data) => (typeof opts.next === 'function' ? opts.next(game, data) : opts.next) || null;
    function showResult(data, out) {
      FD.result.render(q('#result-host'), data, { actions: actionsFor(data), learnHost: q('#learn-host'), eyebrow: opts.title, next: nextFor(data) });
      if (out) ui.celebrate(out);
      const host = q('#result-host');
      setTimeout(() => { host.scrollIntoView({ behavior: FD.u.reduceMotion() ? 'auto' : 'smooth', block: 'start' }); host.focus({ preventScroll: true }); }, 450);
    }

    /* ---------- boot ---------- */
    if (isFinishedView) {
      drawAll(false);
      const r = opts.finished;
      const data = { feature: f, won: r.won, expired: !!r.expired, hintsUsed: r.hints, timeMs: r.timeMs, grid: r.grid, guesses: game.guesses, mode: opts.mode, dateKey: opts.dateKey, number: opts.number, breakdown: r.breakdown || null, xp: r.xp || 0, bonusXp: r.bonusXp || [], firstTime: false, dailyStreak: FD.store.dailyStreak(), revisit: true };
      FD.result.render(q('#result-host'), data, { actions: actionsFor(data), learnHost: q('#learn-host'), eyebrow: opts.title });
    } else if (game.over) {
      finish();
    } else {
      /* picking a game up again starts its clock from where it stopped: the time spent away is never counted.
         (A real-time game, the Daily Challenge, has no pause to undo, so this does nothing for it.) */
      if (!opts.realtime) game.resume();
      drawAll(false);
      persist(); /* the game is saved straight away, so leaving can never lose it or reset its clock */
      unhook = FD.play.track({ suspend, wake });
      if (!opts.realtime && document.visibilityState === 'hidden') suspend(); /* opened in a background tab: the clock starts when the tab is shown */
      if (opts.autofocus !== false) setTimeout(() => input.focus({ preventScroll: true }), 50);
    }

    return {
      game,
      update: () => drawAll(false),
      suspend,
      wake,
      destroy() { suspend(); destroyed = true; clearInterval(timerId); if (unhook) { unhook(); unhook = null; } },
      forceFinish() { if (!game.over) { game.giveUp(); finish(); } }
    };
  }

  /* Everything that keeps a game of its own registers here. Hiding the page or closing the app pauses their clocks and saves the games,
     and showing the page again carries on. */
  const tracked = new Set();
  const track = (o) => { tracked.add(o); return () => tracked.delete(o); };
  const away = () => { Array.from(tracked).forEach((o) => { try { o.suspend(); } catch (e) { console.error(e); } }); FD.store.saveNow(); };
  const back = () => Array.from(tracked).forEach((o) => { try { o.wake(); } catch (e) { console.error(e); } });
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? away() : back()));
  window.addEventListener('pagehide', away);
  window.addEventListener('pageshow', (e) => { if (e.persisted) back(); });

  FD.play = { mount: mountPlay, hintColor, track };
})();
