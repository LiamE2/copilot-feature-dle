/* Copilot Feature-dle · Home + Daily Challenge views.
   The Daily Challenge is one puzzle a weekday, the same for everyone, and it can be any of the three game modes:
   a Feature Hunt, a Scenario Match question or a Prompt Lab question. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $ } = FD.u;
  const ui = FD.ui;

  /* "Daily Challenge #23 · Monday 16 November". A weekend has no challenge, so it has no number either. */
  const dailyTitle = (key) => { const n = FD.daily.number(key); return `Daily Challenge${n ? ' #' + n : ''} \u00B7 ${FD.u.fmtDateLong(key)}`; };

  /* what each kind of day asks (the daily card on the home screen) */
  const ASKS = {
    hunt: 'Five hints, one Copilot feature. Which one is it?',
    match: 'A real work scenario and four Copilot features. Which one fits best?',
    prompt: 'A work scenario and four prompts. Which one will get the best result?'
  };

  /* Fridays and weekends: remind players with a streak that a weekend never breaks a Daily streak (no streak, nothing to protect) */
  function weekendNote(streak, key) {
    if (!FD.daily.weekendSafeDay(key) || !(streak > 0)) return '';
    const weekend = FD.u.isWeekend(key);
    const text = weekend ? `Your ${streak}-day streak is safe. Weekends never reset it.` : `Weekend ahead: your ${streak}-day streak won\u2019t reset on Saturday or Sunday.`;
    return html`<p class="weekend-note">${FD.icon('shield', { size: 18 })}<span>${text}</span></p>`;
  }

  /* ---------- HOME ---------- */
  FD.views.home = {
    title: '',
    render(main) {
      const p = FD.store.profile(), lib = FD.lib, today = FD.u.dateKey();
      const info = FD.daily.info(today);
      const res = FD.store.dailyResult(today);
      const act = info.weekend ? null : FD.store.getActive('daily:' + today);
      const inProgress = !res && !!act;
      const streak = FD.store.dailyStreak();
      const rk = FD.scoring.rank(p.xp);
      const have = lib.features.filter((f) => FD.scoring.collected(p, f)).length;
      const badgeDefs = FD.badges.all(lib), earned = badgeDefs.filter((b) => p.badges[b.id]).length;
      const nowYear = new Date().getFullYear(), nowMonth = new Date().getMonth() + 1;
      const themes = lib.themes || [];
      /* this month's spotlight: this year's if there is one, otherwise the most recent year that has this month */
      const theme = themes.find((t) => t.month === nowMonth && t.year === nowYear) || themes.filter((t) => t.month === nowMonth).sort((a, b) => b.year - a.year)[0];
      /* what the spotlight holds: its Feature Hunt puzzles, Scenario Match and Prompt Lab questions (see FD.packs in the Packs view) */
      const themeIds = theme ? ((FD.packs.find('spot-' + theme.id) || { ids: [] }).ids) : [];
      const themeProg = theme ? FD.store.packProgress('spot-' + theme.id, themeIds) : null;
      const tot = FD.scoring.totals(p);

      const kind = info.kind || 'hunt';
      const kindChip = ui.kindChip(kind);
      let dailyState, dailyCta, chips;
      if (info.weekend) {
        chips = html`<span class="chip chip-solid c-blue">Weekend break</span>`;
        dailyState = html`<p class="daily-msg">${FD.icon('calendar', { size: 20 })}<span>There\u2019s no Daily Challenge on Saturdays and Sundays. See you on Monday! In the meantime, try Free Play or a Pack.</span></p>`;
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/free">${FD.icon('shuffle', { size: 22 })}Free Play</a>`;
      } else if (res) {
        const unit = (res.kind || 'hunt') === 'hunt' ? 'hint' : 'pick';
        chips = html`${kindChip}${ui.diffChip(info.difficulty)}<span class="chip chip-solid ${res.won ? 'c-green' : 'c-orange'}">${res.won ? 'Solved' : 'Revealed'}</span>`;
        dailyState = res.won
          ? html`<p class="daily-msg">${FD.icon('check', { size: 20 })}<span>Solved in <strong>${res.hints} ${res.hints === 1 ? unit : unit + 's'}</strong> for <strong>${res.score} points</strong>. Lovely work!</span></p>`
          : html`<p class="daily-msg">${FD.icon('bulb', { size: 20 })}<span>Not this time \u2013 but you\u2019ve met today\u2019s ${(res.kind || 'hunt') === 'hunt' ? 'feature' : 'answer'} now. Have a read of the learning card.</span></p>`;
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/daily">See today\u2019s result</a>`;
      } else if (inProgress) {
        chips = html`${kindChip}${ui.diffChip(info.difficulty)}<span class="chip chip-solid c-blue">In progress</span>`;
        if (act.fid) {
          const g = FD.Game.restore(act, { realtime: true });
          dailyState = html`<p class="daily-msg">${FD.icon('target', { size: 20 })}<span>You\u2019re on <strong>hint ${Math.min(act.guesses.length + 1, FD.config.maxAttempts)} of ${FD.config.maxAttempts}</strong>. The clock keeps running while you\u2019re away: <strong class="bonus-live" data-clock="${g ? g.startedAt : ''}" data-paused="${g ? g.pausedMs : 0}">${ui.bonusText(g ? g.activeMs : 0)}</strong>.</span></p>`;
        } else {
          const wrong = Array.isArray(act.wrong) ? act.wrong.length : 0;
          dailyState = html`<p class="daily-msg">${FD.icon('target', { size: 20 })}<span>${wrong ? `${FD.u.plural(wrong, 'weaker pick')} so far. ` : 'You\u2019ve opened today\u2019s question. '}The clock keeps running while you\u2019re away: <strong class="bonus-live" data-clock="${act.startedAt || ''}" data-paused="0">${ui.bonusText(Date.now() - (act.startedAt || Date.now()))}</strong>.</span></p>`;
        }
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/daily">Continue today\u2019s challenge</a>`;
      } else {
        chips = html`${kindChip}${ui.diffChip(info.difficulty)}<span class="chip">Not started</span>`;
        dailyState = html`<p class="daily-msg">${FD.icon('target', { size: 20 })}<span>${ASKS[kind]} The same puzzle for everyone today. Solve it early for more points, and keep your Daily streak glowing for bonus XP.</span></p>`;
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/daily">Play today\u2019s challenge</a>`;
      }

      main.innerHTML = flat(html`
        <div class="container">
          <section class="hero" aria-labelledby="home-h">
            <div class="hero-pill">
              <p class="kicker">${FD.tagline()}</p>
              <h1 id="home-h" class="hero-title">${FD.wordmark({ cls: 'wm-hero' })}</h1>
              <p class="hero-lede">Know it, Use it, Prompt it: learn Microsoft Copilot one friendly puzzle at a time. Solve puzzles, learn something new, and build your streak.</p>
              <div class="hero-cta">
                <a class="btn btn-accent btn-lg" href="#/daily">${FD.icon('calendar', { size: 22 })}Today\u2019s challenge</a>
                <a class="btn btn-outline-light btn-lg" href="#/free">${FD.icon('shuffle', { size: 22 })}Free Play</a>
              </div>
            </div>
            <div class="hero-art">
              <span class="float-tile ft1" aria-hidden="true">C</span><span class="float-tile ft2" aria-hidden="true">?</span><span class="float-tile ft3" aria-hidden="true">P</span><span class="float-tile ft4" aria-hidden="true">!</span>
              <button class="hero-pip-btn" type="button" data-action="welcome" aria-label="Say hi to Pip (opens the welcome message)" title="Say hi to Pip">${FD.pip('hello', { size: 230, cls: 'hero-pip', color: 'yellow' })}</button>
            </div>
            <div class="hero-tab">${FD.logo({ width: 160 })}</div>
          </section>

          <section class="daily-card card" aria-labelledby="daily-h">
            <div class="daily-main">
              <p class="eyebrow">${dailyTitle(today)}</p>
              <h2 id="daily-h">${info.weekend ? 'No challenge today' : 'Today\u2019s challenge'}</h2>
              <div class="chips">${chips}</div>
              ${dailyState}
              ${weekendNote(streak, today)}
              <div class="btn-row">${dailyCta}${res ? html`<a class="btn btn-ghost" href="#/free">${FD.icon('shuffle', { size: 20 })}Free Play</a>` : ''}</div>
            </div>
            <div class="daily-side">
              <div class="streak-big ${streak ? 'is-on' : ''}">${FD.icon('flame', { size: 44 })}<strong>${streak}</strong><span>day streak</span></div>
              <p class="countdown">${FD.icon('timer', { size: 16 })} ${!info.weekend && !res ? html`Today\u2019s challenge ends in <strong data-countdown="end">${FD.u.fmtClock(FD.u.msToMidnight())}</strong>` : html`Next challenge in <strong data-countdown>${FD.daily.countdownText()}</strong>`}</p>
            </div>
          </section>

          <section class="section" aria-labelledby="modes-h">
            <div class="section-head"><h2 id="modes-h">Ways to play</h2></div>
            <div class="mode-grid">
              <a class="mode-card c-blue" href="#/hunt"><span class="mode-ic">${FD.icon('search', { size: 30 })}</span><h3>Feature Hunt</h3><p>${ui.MODE_TEXT.hunt}</p></a>
              <a class="mode-card c-purple" href="#/match"><span class="mode-ic">${FD.icon('puzzle', { size: 30 })}</span><h3>Scenario Match</h3><p>${ui.MODE_TEXT.match}</p></a>
              <a class="mode-card c-blue-50" href="#/prompts"><span class="mode-ic">${FD.icon('flask', { size: 30 })}</span><h3>Prompt Lab</h3><p>${ui.MODE_TEXT.prompts}</p></a>
              <a class="mode-card c-orange" href="#/free"><span class="mode-ic">${FD.icon('shuffle', { size: 30 })}</span><h3>Free Play</h3><p>${ui.MODE_TEXT.free}</p></a>
              <a class="mode-card c-red" href="#/packs"><span class="mode-ic">${FD.icon('package', { size: 30 })}</span><h3>Packs</h3><p>${ui.MODE_TEXT.packs}</p></a>
              <a class="mode-card c-green" href="#/book"><span class="mode-ic">${FD.icon('book', { size: 30 })}</span><h3>Feature Book</h3><p>${ui.MODE_TEXT.book}</p></a>
            </div>
          </section>

          <section class="section peek" aria-labelledby="peek-h">
            <div class="section-head"><h2 id="peek-h">Your journey</h2><a class="btn btn-link" href="#/stats">All stats ${FD.icon('right', { size: 18 })}</a></div>
            <div class="peek-grid">
              <div class="card peek-card"><p class="peek-label">Rank</p><p class="peek-big">${rk.rank.name}</p>${ui.bar(rk.pct, rk.rank.color, 'Progress to next rank')}<p class="muted small">${p.xp} XP${rk.next ? html` \u00B7 ${rk.toNext} to ${rk.next.name}` : ' \u00B7 top rank!'}</p></div>
              <div class="card peek-card peek-ring">${ui.ring(lib.features.length ? (have / lib.features.length) * 100 : 0, { color: 'green', label: `${have}`, sub: `of ${lib.features.length}` })}<div><p class="peek-label">Collection</p><p class="muted small">Features in your Feature Book</p></div></div>
              <div class="card peek-card"><p class="peek-label">Puzzles solved</p><p class="peek-big">${tot.solved}</p><p class="muted small">Across Feature Hunt, Scenario Match and Prompt Lab</p></div>
              <div class="card peek-card"><p class="peek-label">Badges</p><p class="peek-big">${earned}<small> / ${badgeDefs.length}</small></p><p class="muted small">Unlock more by exploring every corner</p></div>
            </div>
          </section>

          ${theme ? html`<section class="spotlight c-${theme.color || 'purple'}" aria-labelledby="spot-h">
            <div class="spot-text"><p class="eyebrow">${new Date().toLocaleDateString('en-AU', { month: 'long' })} spotlight</p><h2 id="spot-h">${theme.title}</h2><p>${theme.blurb}</p>
              ${themeIds.length ? html`<a class="btn btn-dark" href="#/pack/spot-${theme.id}">${FD.icon('play', { size: 20 })}${themeProg.complete ? 'Play it again' : themeProg.started ? `Resume progress${themeProg.count ? ` (${themeProg.count} of ${themeProg.total})` : ''}` : `Play ${themeIds.length} ${themeIds.length === 1 ? 'puzzle' : 'puzzles'}`}</a>` : ''}</div>
            <div class="spot-art" aria-hidden="true">${FD.pip('think', { size: 130, color: 'navy' })}</div>
          </section>` : ''}

          <section class="section how" aria-labelledby="how-h">
            <div class="section-head"><h2 id="how-h">How it works</h2></div>
            <ol class="steps">
              <li class="c-blue"><span class="step-n">1</span><h3>Know it</h3><p>Feature Hunt: sneaky hints help you work out what a Copilot feature is.</p></li>
              <li class="c-purple"><span class="step-n">2</span><h3>Use it</h3><p>Scenario Match: read a real work scenario and pick the feature that fits.</p></li>
              <li class="c-blue-50"><span class="step-n">3</span><h3>Prompt it</h3><p>Prompt Lab: pick the prompt that gets the best result from Copilot.</p></li>
              <li class="c-green"><span class="step-n">4</span><h3>Collect it</h3><p>The Feature Book keeps all three together for every feature you meet.</p></li>
            </ol>
          </section>
        </div>`);
    }
  };

  /* ---------- DAILY ---------- */
  /* a Scenario Match or Prompt Lab Daily Challenge: one question, worth 50, 30 or 10 points by the pick it is found on, plus the Speed Bonus. It is saved the moment it opens,
     with its own real-time clock, so leaving never loses it and the day's end still ends it. */
  function dailyQuestion(main, today, info) {
    const { kind, scenario: scn, feature: f } = info, Q = FD.quiz(kind), key = 'daily:' + today, maxTries = Q.maxTries();
    const res = FD.store.dailyResult(today);
    let st = null;
    if (!res) {
      const saved = FD.store.getActive(key);
      st = saved && saved.kind === kind && saved.id === scn.id && FD.quizUI.validOrder(saved.order)
        ? { order: saved.order, wrong: Array.isArray(saved.wrong) ? saved.wrong : [], startedAt: +saved.startedAt || Date.now() }
        : { order: FD.quizUI.freshOrder(), wrong: [], startedAt: Date.now() };
      FD.store.setActive(key, { kind, id: scn.id, ...st });
    }
    main.innerHTML = flat(html`<div class="container play-wrap pl-wrap" id="daily-q">
      ${FD.quizUI.head(kind, [dailyTitle(today), FD.puzzles.name(kind)], html`<div class="play-chips">${ui.diffChip(f.difficulty)}${res ? '' : ui.bonusChip(st.startedAt)}</div>`)}
      <div id="pl-body"></div>
      <div class="result-host" id="result-host" tabindex="-1"></div>
      <div id="learn-host"></div></div>`);
    const actions = [
      { label: 'Free Play', href: '#/free', icon: 'shuffle', cls: 'btn-primary' },
      { label: 'Your Stats', href: '#/stats', icon: 'chart' },
      { label: 'Leaderboard', href: '#/leaderboard', icon: 'trophy' }
    ];
    const base = { kind, feature: f, scn, number: info.number, mode: 'daily', dateKey: today };
    const showResult = (d, fresh) => {
      const head = $('.pl-head', main); if (head) head.hidden = true; /* the answer block takes over the top of the page */
      FD.result.renderQuestion($('#result-host', main), { ...base, ...d }, { actions, learnHost: $('#learn-host', main) });
      if (fresh) setTimeout(() => { const h = $('#result-host', main); if (h) { h.scrollIntoView({ behavior: FD.u.reduceMotion() ? 'auto' : 'smooth', block: 'start' }); h.focus({ preventScroll: true }); } }, 450);
    };
    const stored = (r) => ({ won: !!r.won, expired: !!r.expired, tries: r.hints, timeMs: r.timeMs, breakdown: r.breakdown || null, xp: r.xp || 0, bonusXp: r.bonusXp || [], dailyStreak: FD.store.dailyStreak(), revisit: true });
    let ctl = null, finished = !!res, timer = 0;
    ctl = FD.quizUI.mount($('#pl-body', main), {
      kind, scn, order: res ? FD.quizUI.freshOrder() : st.order, wrong: res ? [] : st.wrong,
      solved: res ? { tries: Math.min(maxTries, Math.max(1, res.hints || maxTries)), points: res.won ? Q.pointsFor(res.hints) : 0, solved: !!res.won } : null,
      quiet: true, noFocus: !!res,
      onWrong: (oi, s) => FD.store.setActive(key, { kind, id: scn.id, order: s.order, wrong: s.wrong, startedAt: st.startedAt }),
      /* the right pick scores the pick it was found on plus the Speed Bonus; every pick missed (three) is a lost day that ends the streak */
      record: (r) => { finished = true; return FD.store.recordDailyQuiz(kind, { scn, feature: f, tries: r.tries, timeMs: Date.now() - st.startedAt, dateKey: today, won: r.solved !== false }); },
      finish: (r, out) => {
        if (res) showResult(stored(res), false);
        else if (out) showResult({ won: r.solved !== false, tries: r.tries, timeMs: out.timeMs, breakdown: out.breakdown, xp: out.xp, bonusXp: out.bonusXp, dailyStreak: out.dailyStreak, review: out.review, revisit: false }, true);
        return { panel: html`<p class="sr-only">Answered. Your result is below.</p>` };
      }
    });
    /* the day ended before it was answered: it counts as missed, and the answer is shown so the day still teaches something */
    const expire = () => {
      if (finished || FD.u.dateKey() === today) return;
      finished = true;
      const out = FD.store.recordDailyQuiz(kind, { scn, feature: f, tries: maxTries, timeMs: 0, dateKey: today, won: false, expired: true });
      ctl.state.done = true;
      scn.options.forEach((o, oi) => { if (!ctl.state.wrong.includes(oi)) FD.quizUI.reveal(ctl.host, kind, scn, oi, o.best ? 'best' : 'other', 0); });
      showResult({ won: false, expired: true, tries: maxTries, timeMs: 0, breakdown: null, xp: out.xp, bonusXp: out.bonusXp, dailyStreak: out.dailyStreak, review: out.review, revisit: false }, true);
      ui.celebrate(out);
    };
    if (!res) timer = setInterval(expire, 1000);
    return () => { clearInterval(timer); expire(); ctl.destroy(); };
  }

  FD.views.daily = {
    title: 'Daily Challenge',
    render(main) {
      const today = FD.u.dateKey(), info = FD.daily.info(today);
      if (info.weekend) {
        const streak = FD.store.dailyStreak();
        main.innerHTML = flat(html`<div class="container hub"><section class="card weekend-card" aria-labelledby="wk-h">
          <div class="ss-top">${FD.pip('hello', { size: 130 })}<div><p class="eyebrow">${dailyTitle(today)}</p><h1 id="wk-h">No Daily Challenge on weekends</h1>
            <p class="lede">The Daily Challenge takes a break on Saturdays and Sundays. See you on Monday!</p></div></div>
          ${weekendNote(streak, today)}
          <p class="next-daily">${FD.icon('calendar', { size: 18 })} Next challenge in <strong data-countdown>${FD.daily.countdownText()}</strong></p>
          <div class="btn-row"><a class="btn btn-primary" href="#/free">${FD.icon('shuffle', { size: 20 })}Free Play</a><a class="btn btn-ghost" href="#/packs">${FD.icon('package', { size: 20 })}Try a pack</a><a class="btn btn-ghost" href="#/book">${FD.icon('book', { size: 20 })}Feature Book</a></div>
        </section></div>`);
        return;
      }
      if (!info.feature) { main.innerHTML = flat(html`<div class="container section"><div class="card"><h1>No challenge today</h1><p>The feature library is empty.</p></div></div>`); return; }
      if (info.kind !== 'hunt' && info.scenario) return dailyQuestion(main, today, info);

      const res = FD.store.dailyResult(today);
      let game;
      if (res) {
        game = FD.Game.restore({ fid: res.id, mode: 'daily', key: today, guesses: res.guesses || [], status: res.won ? 'won' : 'lost', activeMs: res.timeMs || 0, expired: !!res.expired });
      } else {
        const saved = FD.store.getActive('daily:' + today);
        game = saved && saved.fid ? FD.Game.restore(saved, { realtime: true }) : null;
        if (!game || game.f.id !== info.feature.id || game.over) game = new FD.Game(info.feature, { mode: 'daily', key: today });
      }
      main.innerHTML = '<div class="container play-wrap" id="play-root"></div>';
      const ctl = FD.play.mount($('#play-root', main), game, {
        mode: 'daily', title: dailyTitle(today), number: info.number, dateKey: today, persistKey: 'daily:' + today, realtime: true,
        finished: res || null,
        actions: [
          { label: 'Free Play', href: '#/free', icon: 'shuffle', cls: 'btn-primary' },
          { label: 'Your Stats', href: '#/stats', icon: 'chart' },
          { label: 'Leaderboard', href: '#/leaderboard', icon: 'trophy' }
        ]
      });
      return () => ctl.destroy();
    }
  };
})();
