/* Copilot Feature-dle · the play screen (hint card, hint-o-meter, guess box with autocomplete, guess history, results) */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, raw, esc, flat, $, $$, announce, mount } = FD.u;
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
   * mount(container, game, opts) -> controller { destroy, update, pause, resume }
   *   opts.mode            'daily' | 'free' | 'speed' | 'team'
   *   opts.title           eyebrow text
   *   opts.number          daily number (for sharing)
   *   opts.dateKey         daily date key
   *   opts.finished        stored summary for an already-finished daily
   *   opts.compact         compact finish (speed/team): calls opts.onRoundEnd instead of showing the full result
   *   opts.record          false = do not touch the player's profile (team battle)
   *   opts.turn            () => ({ label, color }) for team battles
   *   opts.onGuess/onFinish/onRoundEnd callbacks
   *   opts.actions         buttons under the learning cards
   *   opts.headExtra       extra html in the header (e.g. speed-round clock)
   */
  function mountPlay(container, game, opts = {}) {
    const cfg = FD.config;
    const settings = () => FD.store.settings();
    let destroyed = false, paused = false, lastShown = game.hintsShown, timerId = 0, lastTick = performance.now();
    let sugIdx = -1, sugList = [];

    const isFinishedView = !!opts.finished;
    const f = game.f;

    container.innerHTML = flat(html`
      <div class="play ${opts.compact ? 'play-compact' : ''}">
        <header class="play-head">
          <div class="play-title"><p class="eyebrow">${opts.title || 'Free play'}</p><h1 class="play-h1">${isFinishedView ? 'Today\u2019s mystery feature' : 'Which Copilot feature am I?'}</h1></div>
          <div class="play-chips" id="play-chips"></div>
        </header>
        ${opts.turn ? html`<div class="turn-banner" id="turn" role="status" aria-live="polite"></div>` : ''}
        ${opts.headExtra || ''}
        <div class="play-grid" id="play-grid">
          <div class="play-main">
            <section class="hint-card" id="hint-card" aria-label="Current hint"></section>
            <section class="earlier" id="earlier" aria-label="Earlier hints"></section>
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
          <aside class="play-side" aria-label="Progress and score">
            <section class="card meter-card" id="meter"></section>
            <section class="card score-panel" id="scorep"></section>
            <section class="card extras" id="extras"></section>
          </aside>
        </div>
        <div class="result-host" id="result-host" tabindex="-1"></div>
      </div>`);

    const q = (s) => container.querySelector(s);
    const input = q('#guess-input'), list = q('#suggest'), msgEl = q('#guess-msg'), form = q('#guess-form');

    /* ---------- pieces ---------- */
    function chipsHtml() {
      const lvl = FD.hints.level(game.over ? 5 : game.hintsShown);
      const timer = !settings().relaxed && !opts.hideTimer && !game.over ? html`<span class="chip timer-chip" title="Time (affects the speed bonus)">${FD.icon('timer', { size: 16 })}<span id="play-timer">${FD.u.fmtClock(game.activeMs)}</span></span>` : '';
      return html`${ui.diffChip(f.difficulty)}${lvl.category ? ui.catChip(f.category) : html`<span class="chip chip-locked">${FD.icon('lock', { size: 14 })}Category at hint 3</span>`}${timer}`;
    }
    function hintCardHtml(isNew) {
      const n = game.hintsShown, c = hintColor(n);
      const pts = FD.scoring.base(n);
      return html`<div class="hint-pip">${FD.pip(n === 1 ? 'hello' : 'think', { size: 96 })}</div>
        <div class="hint-bubble c-${c} ${isNew ? 'is-new' : ''}">
          <p class="hint-label"><span class="hint-n">Hint ${n} of ${cfg.maxAttempts}</span><span class="hint-pts">${FD.icon('star', { size: 14 })}worth up to ${pts}</span></p>
          <p class="hint-text">${game.hints[n - 1]}</p>
        </div>`;
    }
    function earlierHtml() {
      const n = game.hintsShown;
      if (n < 2) return '';
      return html`<h2 class="mini-h">Earlier hints</h2><ol class="earlier-list">${game.hints.slice(0, n - 1).map((h, i) => html`<li class="c-${hintColor(i + 1)}"><span class="e-n" aria-hidden="true">${i + 1}</span><span class="sr-only">Hint ${i + 1}: </span><span class="e-t">${h}</span></li>`).reverse()}</ol>`;
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
    function scoreHtml() {
      const relaxed = settings().relaxed;
      const streakBefore = opts.mode === 'team' ? 0 : FD.store.profile().stats.winStreak;
      const p = FD.scoring.potential(game.hintsShown, game.activeMs, streakBefore, relaxed);
      let speedNote = '';
      if (!relaxed) { const t = cfg.speedBonus.find((s) => game.activeMs <= s.maxMs); if (t) speedNote = html`<small>${FD.u.fmtSeconds(Math.max(1000, t.maxMs - game.activeMs))} left for this bonus</small>`; }
      return html`<h2 class="mini-h">Score</h2>
        <p class="score-now"><span class="score-num" id="score-num">${p.total}</span><small>points if you nail it now</small></p>
        <ul class="score-lines">
          <li><span>Hint ${game.hintsShown} of ${cfg.maxAttempts}</span><b>${p.base}</b></li>
          ${relaxed ? '' : html`<li><span>Speed bonus</span><b id="score-speed">+${p.speed}</b>${speedNote}</li>`}
          <li><span>Streak bonus</span><b>\u00D7${p.multiplier.toFixed(1)}</b>${p.multiplier > 1 ? html`<small>${Math.round((p.multiplier - 1) * 10)} in a row \uD83D\uDD25</small>` : ''}</li>
        </ul>`;
    }
    function extrasHtml() {
      const n = game.over ? 5 : game.hintsShown, lvl = FD.hints.level(n);
      const nameState = lvl.first ? 'First letters revealed' : lvl.lengths ? 'Word lengths revealed' : lvl.count ? 'Word count revealed' : '';
      return html`<h2 class="mini-h">Pip\u2019s extras</h2>
        <ul class="extras-list">
          <li><span class="x-label">${FD.icon(lvl.category ? 'check' : 'lock', { size: 16 })}Category</span>${lvl.category ? ui.catChip(f.category) : html`<small>unlocks at hint 3</small>`}</li>
          <li class="x-name"><span class="x-label">${FD.icon(lvl.count ? 'check' : 'lock', { size: 16 })}Name shape</span>${lvl.count ? html`<div>${ui.nameTiles(f.name, lvl, false)}<small>${nameState}</small></div>` : html`<small>unlocks at hint 3</small>`}</li>
        </ul>`;
    }
    function historyHtml() {
      return html`<h2 class="mini-h" id="hist-h">Your guesses</h2>
        ${game.guesses.length ? html`<ol class="guess-list">${game.guesses.map((g, i) => g.k === 's'
          ? html`<li class="guess is-skip"><span class="g-n">${i + 1}</span><span class="g-name">Nudge used</span><span class="g-chips">${ui.tempChip('skip')}<span class="chip">Next hint revealed</span></span></li>`
          : html`<li class="guess is-${g.temp}"><span class="g-n">${i + 1}</span><span class="g-name">${g.name}</span><span class="g-chips">${ui.tempChip(g.temp)}
              ${g.temp === 'correct' ? '' : html`<span class="chip">${FD.icon(g.sameCat ? 'check' : 'x', { size: 14 })}${g.sameCat ? 'Same category' : 'Different category'}</span>
              <span class="chip">${FD.icon(g.dir === 'up' ? 'up' : g.dir === 'down' ? 'down' : 'equals', { size: 14 })}${g.dir === 'up' ? 'Answer is harder' : g.dir === 'down' ? 'Answer is easier' : 'Same level'}</span>`}</span></li>`)}</ol>`
          : html`<p class="muted empty">No guesses yet. Each wrong guess gets a hot or cold clue, then unlocks the next hint.</p>`}`;
    }
    function turnHtml() {
      if (!opts.turn) return;
      const t = opts.turn();
      const el = q('#turn');
      if (el) el.hidden = game.over;
      if (el && t && !game.over) { el.className = `turn-banner c-${t.color}`; el.innerHTML = flat(html`${FD.icon('users', { size: 20 })}<strong>${t.label}</strong>`); }
    }

    function drawAll(isNew) {
      mount(q('#play-chips'), chipsHtml());
      if (!isFinishedView) {
        mount(q('#hint-card'), hintCardHtml(isNew));
        mount(q('#earlier'), earlierHtml());
        mount(q('#meter'), meterHtml());
        mount(q('#scorep'), scoreHtml());
        mount(q('#extras'), extrasHtml());
      }
      mount(q('#history'), historyHtml());
      turnHtml();
      form.hidden = game.over || isFinishedView;
      q('#play-grid').classList.toggle('is-over', game.over || isFinishedView);
      if (game.over || isFinishedView) {
        q('#hint-card').hidden = true; q('#earlier').hidden = true;
        mount(q('#earlier'), html`<h2 class="mini-h">The hints</h2><ol class="earlier-list">${game.hints.slice(0, game.won ? game.hintsUsed : cfg.maxAttempts).map((h, i) => html`<li class="c-${hintColor(i + 1)}"><span class="e-n" aria-hidden="true">${i + 1}</span><span class="e-t">${h}</span></li>`)}</ol>`);
        q('#earlier').hidden = false;
        q('#scorep').hidden = true;
      }
    }

    /* ---------- suggestions (ARIA combobox) ---------- */
    function closeList() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); sugIdx = -1; }
    function openList() {
      const v = input.value.trim();
      sugList = v.length ? FD.match.suggest(v, FD.lib.features, 6, game.guessedIds()) : [];
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
      if (game.over || paused) return;
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
    function afterStep() {
      const isNew = game.hintsShown !== lastShown; lastShown = game.hintsShown;
      drawAll(isNew);
      if (isNew) { FD.fx.play('hint'); announce(`Hint ${game.hintsShown}: ${game.hints[game.hintsShown - 1]}. ${game.attemptsLeft} guesses left.`); }
      if (opts.onStep) opts.onStep(game);
      input.focus();
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

    /* ---------- timer ---------- */
    function tick() {
      const now = performance.now(), dt = Math.min(1000, now - lastTick); lastTick = now;
      if (destroyed || game.over || paused || document.visibilityState !== 'visible') return;
      game.activeMs += dt;
      const t = q('#play-timer'); if (t) t.textContent = FD.u.fmtClock(game.activeMs);
      const sn = q('#score-num');
      if (sn) { mount(q('#scorep'), scoreHtml()); }
      if (opts.mode === 'daily' && Math.round(game.activeMs / 1000) % 5 === 0) persist();
    }
    if (!isFinishedView && !game.over) timerId = setInterval(tick, 1000);

    /* ---------- finish ---------- */
    function summaryFor(out) {
      const rk = FD.scoring.rank(FD.store.profile().xp);
      return {
        mode: opts.mode, number: opts.number, won: game.won, hintsUsed: game.hintsUsed, score: out && out.breakdown ? out.breakdown.total : (opts.finished && opts.finished.score) || 0,
        grid: game.grid, streak: FD.store.dailyStreak(), rank: rk.rank.name, difficulty: f.difficulty
      };
    }
    function finish() {
      if (destroyed) return;
      clearInterval(timerId);
      const data = { feature: f, won: game.won, hintsUsed: game.hintsUsed, timeMs: Math.round(game.activeMs), grid: game.grid, guesses: game.guesses, mode: opts.mode, number: opts.number, dateKey: opts.dateKey, challenge: opts.challenge };
      let out = null;
      if (opts.record !== false) {
        out = FD.store.recordGame({ mode: opts.mode, dateKey: opts.dateKey, feature: f, won: game.won, hintsUsed: game.hintsUsed, timeMs: data.timeMs, grid: game.grid, guesses: game.guesses, typo: game.typo });
        Object.assign(data, out);
      }
      if (opts.persistKey && opts.mode !== 'daily') FD.store.clearActive(opts.persistKey);
      FD.fx.play(game.won ? 'win' : 'lose'); FD.fx.haptic(game.won ? [30, 40, 60] : 120);
      if (game.won) FD.fx.confetti({ count: game.hintsUsed <= 2 ? 220 : 150 });
      announce(game.won ? `Correct! The answer was ${f.name}.` : `Out of guesses. The answer was ${f.name}.`);
      drawAll(false);
      if (opts.onFinish) opts.onFinish(game, data);
      if (opts.compact) { if (opts.onRoundEnd) opts.onRoundEnd(game, data); return; }
      showResult(data, out);
    }
    function showResult(data, out) {
      data.share = summaryFor(out);
      FD.share.prepare(data.share);
      FD.result.render(q('#result-host'), data, { actions: opts.actions });
      if (out) ui.celebrate(out);
      const host = q('#result-host');
      setTimeout(() => { host.scrollIntoView({ behavior: FD.u.reduceMotion() ? 'auto' : 'smooth', block: 'start' }); host.focus({ preventScroll: true }); }, 450);
    }

    /* ---------- boot ---------- */
    if (isFinishedView) {
      drawAll(false);
      const r = opts.finished;
      const rk = FD.scoring.rank(FD.store.profile().xp);
      const data = { feature: f, won: r.won, hintsUsed: r.hints, timeMs: r.timeMs, grid: r.grid, guesses: game.guesses, mode: opts.mode, number: opts.number, dateKey: opts.dateKey, breakdown: r.breakdown || null, xp: r.xp || 0, bonusXp: r.bonusXp || [], firstTime: false, dailyStreak: FD.store.dailyStreak() };
      data.share = { mode: opts.mode, number: opts.number, won: r.won, hintsUsed: r.hints, score: r.score || 0, grid: r.grid || [], streak: FD.store.dailyStreak(), rank: rk.rank.name, difficulty: f.difficulty };
      FD.share.prepare(data.share);
      FD.result.render(q('#result-host'), data, { actions: opts.actions });
    } else if (game.over) {
      finish();
    } else {
      drawAll(false);
      if (opts.autofocus !== false) setTimeout(() => input.focus({ preventScroll: true }), 50);
    }

    return {
      game,
      update: () => drawAll(false),
      pause() { paused = true; container.classList.add('is-paused'); },
      resume() { paused = false; lastTick = performance.now(); container.classList.remove('is-paused'); input.focus(); },
      destroy() { destroyed = true; clearInterval(timerId); },
      forceFinish() { if (!game.over) { game.giveUp(); finish(); } }
    };
  }

  FD.play = { mount: mountPlay, hintColor };
})();
