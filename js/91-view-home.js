/* Copilot Feature-dle · Home + Daily Challenge views */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount } = FD.u;
  const ui = FD.ui;

  /* ---------- HOME ---------- */
  FD.views.home = {
    title: '',
    render(main) {
      const p = FD.store.profile(), lib = FD.lib, today = FD.u.dateKey();
      const info = FD.daily.info(today);
      const res = FD.store.dailyResult(today);
      const act = FD.store.getActive('daily:' + today);
      const inProgress = !res && act && act.guesses && act.guesses.length > 0;
      const streak = FD.store.dailyStreak();
      const rk = FD.scoring.rank(p.xp);
      const official = lib.features.filter((f) => !f.community);
      const have = official.filter((f) => FD.scoring.collected(p, f)).length;
      const badgeDefs = FD.badges.all(lib), earned = badgeDefs.filter((b) => p.badges[b.id]).length;
      const theme = (lib.themes || []).find((t) => t.month === new Date().getMonth() + 1);
      const themeCount = theme ? FD.data.pool({ tag: theme.tag }).length : 0;
      const winPct = p.stats.played ? Math.round((p.stats.won / p.stats.played) * 100) : 0;

      let dailyState, dailyCta;
      if (res) {
        dailyState = res.won
          ? html`<p class="daily-msg">${FD.icon('check', { size: 20 })} Solved in <strong>${res.hints} ${res.hints === 1 ? 'hint' : 'hints'}</strong> for <strong>${res.score} points</strong>. Lovely work!</p>`
          : html`<p class="daily-msg">${FD.icon('bulb', { size: 20 })} Not this time \u2013 but you\u2019ve met today\u2019s feature now. Have a read of the learning card.</p>`;
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/daily">See result &amp; share</a>`;
      } else if (inProgress) {
        dailyState = html`<p class="daily-msg">${FD.icon('target', { size: 20 })} You\u2019re on <strong>hint ${Math.min(act.guesses.length + 1, FD.config.maxAttempts)} of ${FD.config.maxAttempts}</strong>. Pick up where you left off.</p>`;
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/daily">Continue today\u2019s challenge</a>`;
      } else {
        dailyState = html`<p class="daily-msg">Five hints, one Copilot feature, the same puzzle for everyone today. Solve it early for more points and keep your streak glowing.</p>`;
        dailyCta = html`<a class="btn btn-primary btn-lg" href="#/daily">Play today\u2019s challenge</a>`;
      }

      main.innerHTML = flat(html`
        <div class="container">
          <section class="hero" aria-labelledby="home-h">
            <div class="hero-pill">
              <p class="kicker">${FD.tagline('curious')}</p>
              <h1 id="home-h" class="hero-title">${FD.wordmark({ cls: 'wm-hero' })}</h1>
              <p class="hero-lede">Five sneaky hints. One Microsoft Copilot feature. Guess it early, learn something new, and build your streak.</p>
              <div class="hero-cta">
                <a class="btn btn-accent btn-lg" href="#/daily">${FD.icon('calendar', { size: 22 })}Today\u2019s challenge</a>
                <a class="btn btn-outline-light btn-lg" href="#/free">${FD.icon('shuffle', { size: 22 })}Play free mode</a>
              </div>
            </div>
            <div class="hero-art" aria-hidden="true">
              <span class="float-tile ft1">C</span><span class="float-tile ft2">?</span><span class="float-tile ft3">P</span><span class="float-tile ft4">!</span>
              ${FD.pip('hello', { size: 230, cls: 'hero-pip', color: 'yellow' })}
            </div>
            <div class="hero-tab">${FD.logo({ width: 160 })}</div>
          </section>

          <section class="daily-card card" aria-labelledby="daily-h">
            <div class="daily-main">
              <p class="eyebrow">Daily Challenge #${info.number} \u00B7 ${FD.u.fmtDateLong(today)}</p>
              <h2 id="daily-h">Today\u2019s challenge</h2>
              <div class="chips">${ui.diffChip(info.difficulty)}${res ? html`<span class="chip chip-solid ${res.won ? 'c-green' : 'c-orange'}">${res.won ? 'Solved' : 'Revealed'}</span>` : inProgress ? html`<span class="chip chip-solid c-blue">In progress</span>` : html`<span class="chip">Not started</span>`}</div>
              ${dailyState}
              <div class="btn-row">${dailyCta}${res ? html`<a class="btn btn-ghost" href="#/free">${FD.icon('shuffle', { size: 20 })}Keep practising</a>` : ''}</div>
            </div>
            <div class="daily-side">
              <div class="streak-big ${streak ? 'is-on' : ''}">${FD.icon('flame', { size: 44 })}<strong>${streak}</strong><span>day streak</span></div>
              <p class="countdown">${FD.icon('timer', { size: 16 })} Next challenge in <strong data-countdown>${FD.u.fmtClock(FD.u.msToMidnight())}</strong></p>
            </div>
          </section>

          <section class="section" aria-labelledby="modes-h">
            <div class="section-head"><h2 id="modes-h">Ways to play</h2></div>
            <div class="mode-grid">
              <a class="mode-card c-orange" href="#/free"><span class="mode-ic">${FD.icon('shuffle', { size: 30 })}</span><h3>Free play</h3><p>Unlimited practice. Pick your level or let Pip surprise you.</p></a>
              <a class="mode-card c-pink" href="#/speed"><span class="mode-ic">${FD.icon('timer', { size: 30 })}</span><h3>Speed round</h3><p>${Math.round(FD.config.speedRoundSeconds / 60)} minutes. How many features can you name?</p></a>
              <a class="mode-card c-purple" href="#/team"><span class="mode-ic">${FD.icon('users', { size: 30 })}</span><h3>Team battle</h3><p>Pass the laptop or fire up the projector. Perfect for workshops.</p></a>
              <a class="mode-card c-green" href="#/book"><span class="mode-ic">${FD.icon('book', { size: 30 })}</span><h3>Feature Book</h3><p>${have} of ${official.length} features collected.</p></a>
              <a class="mode-card c-blue" href="#/stats"><span class="mode-ic">${FD.icon('chart', { size: 30 })}</span><h3>Your stats</h3><p>Streaks, XP, badges and how you\u2019re tracking.</p></a>
              <a class="mode-card c-yellow" href="#/leaderboard"><span class="mode-ic">${FD.icon('trophy', { size: 30 })}</span><h3>Leaderboard</h3><p>Daily rankings, streaks and top scores.</p></a>
              <a class="mode-card c-red" href="#/packs"><span class="mode-ic">${FD.icon('package', { size: 30 })}</span><h3>Packs &amp; themes</h3><p>Wave packs, Build edition and community packs.</p></a>
              <a class="mode-card c-navy" href="#/about"><span class="mode-ic">${FD.icon('info', { size: 30 })}</span><h3>About</h3><p>How to play, scoring and tips for facilitators.</p></a>
            </div>
          </section>

          <section class="section peek" aria-labelledby="peek-h">
            <div class="section-head"><h2 id="peek-h">Your journey</h2><a class="btn btn-link" href="#/stats">All stats ${FD.icon('right', { size: 18 })}</a></div>
            <div class="peek-grid">
              <div class="card peek-card"><p class="peek-label">Rank</p><p class="peek-big">${rk.rank.name}</p>${ui.bar(rk.pct, rk.rank.color, 'Progress to next rank')}<p class="muted small">${p.xp} XP${rk.next ? html` \u00B7 ${rk.toNext} to ${rk.next.name}` : ' \u00B7 top rank!'}</p></div>
              <div class="card peek-card peek-ring">${ui.ring(official.length ? (have / official.length) * 100 : 0, { color: 'green', label: `${have}`, sub: `of ${official.length}` })}<div><p class="peek-label">Collection</p><p class="muted small">Features in your Feature Book</p></div></div>
              <div class="card peek-card"><p class="peek-label">Win rate</p><p class="peek-big">${winPct}<small>%</small></p><p class="muted small">${FD.u.plural(p.stats.won, 'win')} from ${FD.u.plural(p.stats.played, 'game')}</p></div>
              <div class="card peek-card"><p class="peek-label">Badges</p><p class="peek-big">${earned}<small> / ${badgeDefs.length}</small></p><p class="muted small">Unlock more by exploring every corner</p></div>
            </div>
          </section>

          ${theme ? html`<section class="spotlight c-${theme.color || 'purple'}" aria-labelledby="spot-h">
            <div class="spot-text"><p class="eyebrow">${new Date().toLocaleDateString('en-AU', { month: 'long' })} spotlight</p><h2 id="spot-h">${theme.title}</h2><p>${theme.blurb}</p>
              ${themeCount ? html`<a class="btn btn-dark" href="#/free?tag=${theme.tag}&start=1">${FD.icon('play', { size: 20 })}Play ${themeCount} featured ${themeCount === 1 ? 'feature' : 'features'}</a>` : ''}</div>
            <div class="spot-art" aria-hidden="true">${FD.pip('think', { size: 130, color: 'navy' })}</div>
          </section>` : ''}

          <section class="section how" aria-labelledby="how-h">
            <div class="section-head"><h2 id="how-h">How it works</h2></div>
            <ol class="steps">
              <li class="c-blue"><span class="step-n">1</span><h3>Read the clue</h3><p>Hint one is deliberately sneaky but always accurate.</p></li>
              <li class="c-purple"><span class="step-n">2</span><h3>Take a guess</h3><p>Wrong? You\u2019ll get a hot or cold clue and a friendlier hint.</p></li>
              <li class="c-green"><span class="step-n">3</span><h3>Learn &amp; collect</h3><p>Every answer comes with use cases and a prompt to try.</p></li>
            </ol>
          </section>
        </div>`);
    }
  };

  /* ---------- DAILY ---------- */
  FD.views.daily = {
    title: 'Daily Challenge',
    render(main) {
      const today = FD.u.dateKey(), info = FD.daily.info(today);
      if (!info.feature) { main.innerHTML = flat(html`<div class="container section"><div class="card"><h1>No challenge today</h1><p>The feature library is empty.</p></div></div>`); return; }
      const res = FD.store.dailyResult(today);
      let game;
      if (res) {
        game = FD.Game.restore({ fid: res.id, mode: 'daily', key: today, guesses: res.guesses || [], status: res.won ? 'won' : 'lost', activeMs: res.timeMs || 0 });
      } else {
        const saved = FD.store.getActive('daily:' + today);
        game = saved ? FD.Game.restore(saved) : null;
        if (!game || game.f.id !== info.feature.id || game.over) game = new FD.Game(info.feature, { mode: 'daily', key: today });
      }
      main.innerHTML = '<div class="container play-wrap" id="play-root"></div>';
      const ctl = FD.play.mount($('#play-root', main), game, {
        mode: 'daily', title: `Daily Challenge #${info.number} \u00B7 ${FD.u.fmtDateLong(today)}`, number: info.number, dateKey: today, persistKey: 'daily:' + today,
        finished: res || null,
        actions: [
          { label: 'Play free mode', href: '#/free', icon: 'shuffle', cls: 'btn-primary' },
          { label: 'My stats', href: '#/stats', icon: 'chart' },
          { label: 'Leaderboard', href: '#/leaderboard', icon: 'trophy' }
        ]
      });
      return () => ctl.destroy();
    }
  };
})();
