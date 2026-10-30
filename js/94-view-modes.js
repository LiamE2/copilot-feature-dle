/* Copilot Feature-dle · Free play, Speed round, Team battle, friend challenges */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount, attrs } = FD.u;
  const ui = FD.ui;
  const cfg = FD.config;

  const seg = (active) => html`<nav class="seg" aria-label="Play modes">
    <a href="#/free"${attrs({ 'aria-current': active === 'free' ? 'page' : null })}>${FD.icon('shuffle', { size: 18 })}Free play</a>
    <a href="#/speed"${attrs({ 'aria-current': active === 'speed' ? 'page' : null })}>${FD.icon('timer', { size: 18 })}Speed round</a>
    <a href="#/team"${attrs({ 'aria-current': active === 'team' ? 'page' : null })}>${FD.icon('users', { size: 18 })}Team battle</a>
  </nav>`;

  /* difficulty pills with lock states + progress towards unlocking */
  function diffPills(name, selected, includeAll = true) {
    const un = FD.freeplay.unlocked();
    const items = (includeAll ? ['all'] : []).concat(cfg.difficulties);
    return html`<div class="pill-radios">${items.map((d) => {
      const u = d === 'all' ? { unlocked: true } : un[d];
      const label = d === 'all' ? 'Any unlocked' : d;
      const hint = !u.unlocked ? `Locked: collect ${u.need} ${u.from} features to unlock (${u.have}/${u.need})` : '';
      return html`<label class="pill-radio ${u.unlocked ? '' : 'is-locked'}"${attrs({ title: hint })}><input type="radio" name="${name}" value="${d}"${attrs({ checked: selected === d, disabled: !u.unlocked })}><span>${u.unlocked ? '' : FD.icon('lock', { size: 14 })}${label}${u.unlocked ? '' : html`<small>${u.have}/${u.need} ${u.from}</small>`}</span></label>`;
    })}</div>`;
  }
  const catOptions = (sel) => html`<option value="all">All categories</option>${FD.lib.categories.filter((c) => FD.lib.features.some((f) => f.category === c.name)).map((c) => html`<option value="${c.name}"${attrs({ selected: sel === c.name })}>${c.name}</option>`)}`;
  const packOptions = (sel) => html`<option value="all">All packs</option>${FD.lib.packs.map((p) => html`<option value="${p.id}"${attrs({ selected: sel === p.id })}>${p.name} (${FD.data.packFeatures(p.id).length})</option>`)}`;

  /* ======================================================================== FREE PLAY */
  const free = { filters: null, container: null, ctl: null, main: null };

  function loadFilters(query) {
    const saved = (FD.store.state.meta && FD.store.state.meta.free) || {};
    const f = Object.assign({ difficulty: 'all', category: 'all', pack: 'all', prioritise: true, tag: '' }, saved, { tag: '' });
    ['difficulty', 'category', 'pack', 'tag'].forEach((k) => { if (query && query[k]) f[k] = query[k]; });
    return f;
  }
  function saveFilters(f) { FD.store.state.meta.free = { difficulty: f.difficulty, category: f.category, pack: f.pack, prioritise: f.prioritise }; FD.store.save(); }

  function freeSetup(main) {
    const f = free.filters;
    const saved = FD.store.getActive('free');
    const resume = saved && saved.guesses && saved.status === 'playing' ? FD.Game.restore(saved) : null;
    const count = FD.freeplay.pool(f).length;
    main.innerHTML = flat(html`<div class="container hub">
      <header class="hub-head"><p class="eyebrow">Practise &amp; play together</p><h1>Free play</h1><p class="lede">Unlimited puzzles, no pressure. Pick a level or let Pip surprise you.</p></header>
      ${seg('free')}
      ${resume ? html`<div class="banner c-blue">${FD.icon('play', { size: 22 })}<p><strong>You have a game in progress</strong> (hint ${resume.hintsShown} of ${cfg.maxAttempts}).</p><button class="btn btn-accent btn-sm" type="button" data-action="free-resume">Resume</button></div>` : ''}
      ${f.tag ? html`<div class="banner c-purple">${FD.icon('sparkle', { size: 22 })}<p>Playing the <strong>${f.tag}</strong> spotlight.</p></div>` : ''}
      <form class="card setup" id="free-form">
        <fieldset class="field"><legend>Difficulty</legend>${diffPills('difficulty', f.difficulty)}</fieldset>
        <div class="field-row">
          <div class="field"><label for="f-cat">Category</label><select id="f-cat" class="select">${catOptions(f.category)}</select></div>
          <div class="field"><label for="f-pack">Pack</label><select id="f-pack" class="select">${packOptions(f.pack)}</select></div>
        </div>
        <label class="check"><input type="checkbox" id="f-pri"${attrs({ checked: f.prioritise })}><span>Prioritise features I haven\u2019t collected yet</span></label>
        <p class="muted" id="f-count" aria-live="polite">${count} ${count === 1 ? 'feature matches' : 'features match'} right now.</p>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">${FD.icon('shuffle', { size: 22 })}Surprise me</button></div>
      </form>
    </div>`);
    const form = $('#free-form', main);
    const read = () => {
      const d = form.querySelector('input[name="difficulty"]:checked');
      free.filters = Object.assign({}, free.filters, { difficulty: d ? d.value : 'all', category: $('#f-cat', form).value, pack: $('#f-pack', form).value, prioritise: $('#f-pri', form).checked });
      const n = FD.freeplay.pool(free.filters).length;
      $('#f-count', main).textContent = `${n} ${n === 1 ? 'feature matches' : 'features match'} right now.`;
      saveFilters(free.filters);
    };
    form.addEventListener('change', read);
    form.addEventListener('submit', (e) => { e.preventDefault(); read(); freeStart(); });
  }

  function freeStart(fixed, extra = {}) {
    const feature = fixed || FD.freeplay.pick(free.filters);
    if (!feature) { ui.toast('No features match those filters. Try widening them a little.', { icon: 'x' }); return; }
    const game = new FD.Game(feature, { mode: 'free' });
    freePlay(game, extra);
  }
  function freePlay(game, extra = {}) {
    if (free.ctl) free.ctl.destroy();
    free.main.innerHTML = '<div class="container play-wrap" id="play-root"></div>';
    const actions = extra.actions || [
      { label: 'Play again', action: 'free-again', icon: 'shuffle', cls: 'btn-primary' },
      { label: 'Change filters', action: 'free-setup', icon: 'sliders' },
      { label: 'Feature Book', href: '#/book', icon: 'book' }
    ];
    FD.store.setActive('free', game.serialize());
    free.ctl = FD.play.mount($('#play-root', free.main), game, { mode: 'free', title: extra.title || 'Free play', persistKey: 'free', challenge: !!extra.challenge, actions });
  }

  ui.actions['free-again'] = () => { if (free.filters) freeStart(); else ui.go('/free'); };
  ui.actions['free-setup'] = () => { if (free.ctl) free.ctl.destroy(); free.ctl = null; FD.store.clearActive('free'); freeSetup(free.main); window.scrollTo(0, 0); const h = free.main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } };
  ui.actions['free-resume'] = () => { const g = FD.Game.restore(FD.store.getActive('free')); if (g) freePlay(g); };

  FD.views.free = {
    title: 'Free play',
    render(main, ctx) {
      free.main = main; free.filters = loadFilters(ctx.query);
      if (ctx.query.start) { freeStart(); } else freeSetup(main);
      return () => { if (free.ctl) free.ctl.destroy(); free.ctl = null; };
    }
  };

  /* direct play of one feature: practise from the Feature Book, or a friend's challenge link */
  function fixedView(kind) {
    return {
      title: kind === 'challenge' ? 'Friend challenge' : 'Practise',
      render(main, ctx) {
        free.main = main; free.filters = loadFilters({});
        const id = kind === 'challenge' ? FD.share.challengeId(ctx.params.code) : ctx.params.id;
        const f = FD.lib.byId[id];
        if (!f) { ui.toast('Hmm, I couldn\u2019t find that feature. Try free play instead!', { icon: 'x' }); ui.go('/free'); return; }
        const actions = kind === 'challenge'
          ? [{ label: 'Play today\u2019s challenge', href: '#/daily', icon: 'calendar', cls: 'btn-primary' }, { label: 'Free play', href: '#/free', icon: 'shuffle' }]
          : [{ label: 'Back to Feature Book', href: '#/book', icon: 'book', cls: 'btn-primary' }, { label: 'Play something random', href: '#/free', icon: 'shuffle' }];
        freePlay(new FD.Game(f, { mode: 'free' }), { title: kind === 'challenge' ? 'A friend challenged you!' : 'Practice round', challenge: kind === 'challenge', actions });
        return () => { if (free.ctl) free.ctl.destroy(); free.ctl = null; };
      }
    };
  }
  FD.views.play = fixedView('practise');
  FD.views.challenge = fixedView('challenge');

  /* ======================================================================== SPEED ROUND */
  const speed = { main: null, ctl: null, timer: 0, filters: { difficulty: 'all' } };

  function speedCleanup() { clearInterval(speed.timer); speed.timer = 0; if (speed.ctl) speed.ctl.destroy(); speed.ctl = null; speed.over = true; }

  function speedSetup(main) {
    speedCleanup(); speed.over = false;
    const secs = (FD.store.settings().relaxed ? 2 : 1) * cfg.speedRoundSeconds;
    main.innerHTML = flat(html`<div class="container hub">
      <header class="hub-head"><p class="eyebrow">Beat the clock</p><h1>Speed round</h1><p class="lede">${Math.round(secs / 60)} minutes on the clock. Solve as many features as you can \u2013 a miss just moves you along.</p></header>
      ${seg('speed')}
      <form class="card setup" id="speed-form">
        <ul class="ticks"><li>${FD.icon('check', { size: 18 })}Same five-hint puzzles, but the clock never stops</li><li>${FD.icon('check', { size: 18 })}Solve a feature to go straight to the next one</li><li>${FD.icon('check', { size: 18 })}Streak bonuses stack up as you go${FD.store.settings().relaxed ? ' (relaxed timing is on, so you get double time)' : ''}</li></ul>
        <fieldset class="field"><legend>Difficulty</legend>${diffPills('difficulty', speed.filters.difficulty)}</fieldset>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">${FD.icon('play', { size: 22 })}Start the clock</button></div>
      </form></div>`);
    $('#speed-form', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = e.target.querySelector('input[name="difficulty"]:checked');
      speed.filters = { difficulty: d ? d.value : 'all' };
      speedStart();
    });
  }

  function speedStart() {
    const total = (FD.store.settings().relaxed ? 2 : 1) * cfg.speedRoundSeconds * 1000;
    Object.assign(speed, { total, ms: total, solved: 0, score: 0, items: [], paused: false, over: false, last: performance.now(), used: [] });
    speed.main.innerHTML = flat(html`<div class="container play-wrap">
      <div class="speed-bar" id="speed-bar" role="group" aria-label="Speed round status">
        <div class="sb-clock">${FD.icon('timer', { size: 22 })}<strong id="sb-time" role="timer" aria-live="off">${FD.u.fmtClock(total)}</strong></div>
        <div class="sb-meter">${ui.bar(100, 'pink', 'Time left')}</div>
        <div class="sb-stat"><span>Solved</span><strong id="sb-solved">0</strong></div>
        <div class="sb-stat"><span>Score</span><strong id="sb-score">0</strong></div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="speed-pause" id="sb-pause">${FD.icon('minus', { size: 16 })}Pause</button>
      </div>
      <div id="speed-play"></div></div>`);
    speed.timer = setInterval(speedTick, 250);
    speedNext();
  }
  function speedTick() {
    const now = performance.now(), dt = Math.min(500, now - speed.last); speed.last = now;
    if (speed.over || speed.paused || document.visibilityState !== 'visible') return;
    speed.ms -= dt;
    const t = $('#sb-time'); if (t) t.textContent = FD.u.fmtClock(speed.ms);
    const bar = $('#speed-bar .bar span'); if (bar) bar.style.width = Math.max(0, (speed.ms / speed.total) * 100) + '%';
    if (speed.ms <= 0) speedEnd();
  }
  function speedNext() {
    if (speed.over) return;
    const f = FD.freeplay.pick(speed.filters, { exclude: speed.used });
    if (!f) { speedEnd(); return; }
    speed.used.push(f.id);
    if (speed.used.length > 30) speed.used.shift();
    if (speed.ctl) speed.ctl.destroy();
    const game = new FD.Game(f, { mode: 'speed' });
    speed.ctl = FD.play.mount($('#speed-play'), game, {
      mode: 'speed', title: 'Speed round', compact: true, hideTimer: true,
      onRoundEnd: (g, data) => {
        if (speed.over) return;
        speed.items.push({ f: g.f, won: g.won, points: data.breakdown ? data.breakdown.total : 0, hints: g.hintsUsed });
        if (g.won) { speed.solved++; speed.score += data.breakdown.total; }
        $('#sb-solved').textContent = speed.solved; $('#sb-score').textContent = speed.score;
        FD.result.compact($('#result-host', $('#speed-play')), { ...data, points: g.won ? data.breakdown.total : null }, {
          footer: html`<div class="btn-row"><button class="btn btn-primary" type="button" data-action="speed-next" autofocus>Next feature ${FD.icon('right', { size: 18 })}</button></div>`
        });
        const nb = $('[data-action="speed-next"]'); if (nb) nb.focus({ preventScroll: true });
        speed.autoNext = setTimeout(() => { if (!speed.over) speedNext(); }, g.won ? 1800 : 3200);
      }
    });
  }
  ui.actions['speed-next'] = () => { clearTimeout(speed.autoNext); speedNext(); };
  ui.actions['speed-pause'] = () => {
    speed.paused = !speed.paused; speed.last = performance.now();
    const b = $('#sb-pause');
    if (speed.paused) { speed.ctl && speed.ctl.pause(); clearTimeout(speed.autoNext); b.innerHTML = flat(html`${FD.icon('play', { size: 16 })}Resume`); }
    else { speed.ctl && speed.ctl.resume(); b.innerHTML = flat(html`${FD.icon('minus', { size: 16 })}Pause`); }
    document.getElementById('speed-play').classList.toggle('is-paused', speed.paused);
  };

  function speedEnd() {
    if (speed.over) return;
    speed.over = true; clearInterval(speed.timer); clearTimeout(speed.autoNext);
    if (speed.ctl) speed.ctl.destroy(); speed.ctl = null;
    const p = FD.store.profile(), rk = FD.scoring.rank(p.xp);
    const earned = FD.store.bump('speedRounds').concat(FD.store.bump('speedBestSolved', speed.solved, true));
    const isBest = speed.score > (p.speedBest || 0); if (isBest) { p.speedBest = speed.score; FD.store.save(); }
    const attempted = speed.items.length, acc = attempted ? Math.round((speed.solved / attempted) * 100) : 0;
    const share = { mode: 'speed', solved: speed.solved, score: speed.score, won: speed.solved > 0, hintsUsed: 0, grid: [], streak: FD.store.dailyStreak(), rank: rk.rank.name, difficulty: speed.filters.difficulty === 'all' ? 'Mixed levels' : speed.filters.difficulty };
    FD.result.current = share; FD.share.prepare(share);
    FD.fx.play('win'); if (speed.solved) FD.fx.confetti({ count: 140 });
    ui.celebrate({ newBadges: earned });
    speed.main.innerHTML = flat(html`<div class="container hub"><section class="speed-summary card" aria-labelledby="ss-h">
      <div class="ss-top">${FD.pip(speed.solved ? 'cheer' : 'oops', { size: 130 })}<div><p class="eyebrow">Speed round complete</p><h1 id="ss-h">Time\u2019s up!</h1>
        <p class="lede">${speed.solved ? `You solved ${FD.u.plural(speed.solved, 'feature')}${isBest ? ' \u2013 a new personal best!' : '.'}` : 'No solves this time, but you met a few new features.'}</p></div></div>
      <div class="ss-stats"><div><strong>${speed.solved}</strong><span>solved</span></div><div><strong>${speed.score}</strong><span>points</span></div><div><strong>${acc}%</strong><span>accuracy</span></div><div><strong>${p.speedBest || 0}</strong><span>best score</span></div></div>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-action="share-go">${FD.icon('share', { size: 20 })}Share</button><button class="btn btn-ghost" type="button" data-action="share-copy">${FD.icon('copy', { size: 20 })}Copy text</button><button class="btn btn-ghost" type="button" data-action="share-save">${FD.icon('download', { size: 20 })}Save image</button></div>
      <h2 class="mini-h">What you met</h2>
      <ul class="review-list">${speed.items.map((it) => html`<li><details><summary><span class="rv-dot ${it.won ? 'won' : 'lost'}" aria-hidden="true"></span><span class="rv-name">${it.f.name}</span>${it.won ? html`<span class="chip chip-solid c-green">+${it.points}</span>` : html`<span class="chip">Missed</span>`}</summary>${FD.result.learn(it.f)}</details></li>`)}</ul>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-action="speed-again">${FD.icon('refresh', { size: 20 })}Go again</button><a class="btn btn-ghost" href="#/free">${FD.icon('shuffle', { size: 20 })}Free play</a><a class="btn btn-ghost" href="#/stats">${FD.icon('chart', { size: 20 })}My stats</a></div>
    </section></div>`);
    window.scrollTo(0, 0); const h = $('#ss-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  ui.actions['speed-again'] = () => speedStart();

  FD.views.speed = { title: 'Speed round', render(main) { speed.main = main; speedSetup(main); return speedCleanup; } };

  /* ======================================================================== TEAM BATTLE */
  const TEAM_COLORS = ['blue', 'pink', 'green', 'orange', 'purple', 'red'];
  const TEAM_NAMES = ['Team Blue', 'Team Pink', 'Team Green', 'Team Orange', 'Team Purple', 'Team Red'];
  const team = { main: null, ctl: null, cfg: { n: 3, rounds: 5, difficulty: 'all', names: TEAM_NAMES.slice() }, s: null };

  function teamSetup(main) {
    const c = team.cfg;
    main.innerHTML = flat(html`<div class="container hub">
      <header class="hub-head"><p class="eyebrow">Workshops, lunch-and-learns &amp; team socials</p><h1>Team battle</h1><p class="lede">Teams take turns guessing the same feature. Each wrong guess unlocks an easier hint and passes the turn. Project it on the big screen!</p></header>
      ${seg('team')}
      <form class="card setup" id="team-form">
        <fieldset class="field"><legend>How many teams?</legend><div class="pill-radios">${[2, 3, 4, 5, 6].map((n) => html`<label class="pill-radio"><input type="radio" name="n" value="${n}"${attrs({ checked: c.n === n })}><span>${n} teams</span></label>`)}</div></fieldset>
        <div class="field"><span class="label">Team names</span><div class="team-names" id="team-names">${TEAM_COLORS.slice(0, c.n).map((col, i) => html`<label class="team-name c-${col}"><span class="sr-only">Team ${i + 1} name</span><span class="tn-dot" aria-hidden="true"></span><input class="input" maxlength="20" value="${c.names[i]}" data-i="${i}"></label>`)}</div></div>
        <fieldset class="field"><legend>Rounds</legend><div class="pill-radios">${[5, 8, 10].map((n) => html`<label class="pill-radio"><input type="radio" name="rounds" value="${n}"${attrs({ checked: c.rounds === n })}><span>${n} rounds</span></label>`)}</div></fieldset>
        <fieldset class="field"><legend>Difficulty</legend>${diffPills('difficulty', c.difficulty)}</fieldset>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">${FD.icon('play', { size: 22 })}Start the battle</button></div>
      </form></div>`);
    const form = $('#team-form', main);
    const names = () => $$('#team-names input', form).forEach((i) => { c.names[+i.dataset.i] = i.value.trim() || TEAM_NAMES[+i.dataset.i]; });
    form.addEventListener('change', (e) => {
      names();
      if (e.target.name === 'n') { c.n = +e.target.value; teamSetup(main); const r = $('input[name="n"]:checked', main); if (r) r.focus(); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault(); names();
      c.rounds = +form.querySelector('input[name="rounds"]:checked').value;
      c.difficulty = (form.querySelector('input[name="difficulty"]:checked') || { value: 'all' }).value;
      teamStart();
    });
  }

  function teamStart() {
    const c = team.cfg;
    team.s = { teams: c.names.slice(0, c.n).map((name, i) => ({ name, color: TEAM_COLORS[i], score: 0, wins: 0 })), round: 0, used: [] };
    teamRound();
  }
  function teamBar() {
    const s = team.s;
    const active = team.game && !team.game.over ? (s.round - 1 + team.game.guesses.length) % s.teams.length : -1;
    return html`<div class="team-bar" role="group" aria-label="Scoreboard"><span class="tb-round">Round <strong>${s.round}</strong> of ${team.cfg.rounds}</span>${s.teams.map((t, i) => html`<span class="tb-team c-${t.color} ${i === active ? 'is-active' : ''}"><span class="tb-name">${t.name}</span><strong>${t.score}</strong></span>`)}</div>`;
  }
  function teamRound() {
    const s = team.s;
    if (s.round >= team.cfg.rounds) { teamEnd(); return; }
    s.round++;
    const f = FD.freeplay.pick({ difficulty: team.cfg.difficulty, prioritise: false }, { exclude: s.used });
    if (!f) { teamEnd(); return; }
    s.used.push(f.id);
    if (team.ctl) team.ctl.destroy();
    team.game = new FD.Game(f, { mode: 'team' });
    const starter = (s.round - 1) % s.teams.length;
    team.main.innerHTML = flat(html`<div class="container play-wrap"><div id="team-bar-host">${teamBar()}</div><div id="team-play"></div></div>`);
    team.ctl = FD.play.mount($('#team-play'), team.game, {
      mode: 'team', title: `Team battle \u00B7 round ${s.round}`, compact: true, record: false, hideTimer: true,
      turn: () => { const t = s.teams[(starter + team.game.guesses.length) % s.teams.length]; return { label: `${t.name}, it\u2019s your guess!`, color: t.color }; },
      onStep: () => { mount($('#team-bar-host'), teamBar()); },
      onRoundEnd: (g, data) => {
        let who = null, points = null;
        if (g.won) { const t = s.teams[(starter + g.guesses.length - 1) % s.teams.length]; points = FD.scoring.base(g.hintsUsed); t.score += points; t.wins++; who = t.name; }
        mount($('#team-bar-host'), teamBar());
        const last = s.round >= team.cfg.rounds;
        FD.result.compact($('#result-host', $('#team-play')), { ...data, who, points }, {
          learn: true,
          footer: html`<div class="btn-row"><button class="btn btn-primary" type="button" data-action="team-next">${last ? 'See the final scores' : 'Next round'} ${FD.icon('right', { size: 18 })}</button></div>`
        });
        const nb = $('[data-action="team-next"]'); if (nb) nb.focus({ preventScroll: true });
      }
    });
  }
  ui.actions['team-next'] = () => teamRound();

  function teamEnd() {
    const s = team.s;
    if (team.ctl) team.ctl.destroy(); team.ctl = null; team.game = null;
    const ranked = s.teams.slice().sort((a, b) => b.score - a.score || b.wins - a.wins);
    const top = ranked[0].score;
    const winners = ranked.filter((t) => t.score === top);
    const earned = FD.store.bump('teamBattles');
    ui.celebrate({ newBadges: earned }); FD.fx.play('win'); FD.fx.confetti({ count: 220 });
    team.main.innerHTML = flat(html`<div class="container hub"><section class="card podium-card" aria-labelledby="pod-h">
      <div class="ss-top">${FD.pip('cheer', { size: 130 })}<div><p class="eyebrow">Team battle complete</p><h1 id="pod-h">${winners.length > 1 ? 'It\u2019s a tie!' : `${winners[0].name} wins!`}</h1><p class="lede">${winners.length > 1 ? winners.map((w) => w.name).join(' & ') + ' share the crown.' : 'Brilliant effort from every team \u2013 and everyone learned a few new Copilot features.'}</p></div></div>
      <ol class="podium">${ranked.map((t, i) => html`<li class="c-${t.color} ${t.score === top ? 'is-top' : ''}"><span class="pod-rank">${i + 1}</span><span class="pod-name">${t.name}</span><span class="pod-wins">${FD.u.plural(t.wins, 'round')} won</span><strong class="pod-score">${t.score}</strong></li>`)}</ol>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-action="team-again">${FD.icon('refresh', { size: 20 })}Rematch</button><button class="btn btn-ghost" type="button" data-action="team-setup">${FD.icon('sliders', { size: 20 })}Change setup</button><a class="btn btn-ghost" href="#/">${FD.icon('home', { size: 20 })}Home</a></div>
    </section></div>`);
    window.scrollTo(0, 0); const h = $('#pod-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  ui.actions['team-again'] = () => teamStart();
  ui.actions['team-setup'] = () => teamSetup(team.main);

  FD.views.team = { title: 'Team battle', render(main) { team.main = main; teamSetup(main); return () => { if (team.ctl) team.ctl.destroy(); team.ctl = null; }; } };
})();
