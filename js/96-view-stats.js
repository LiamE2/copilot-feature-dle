/* Copilot Feature-dle · Stats dashboard, badges, ranks */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, mount } = FD.u;
  const ui = FD.ui;

  FD.views.stats = {
    title: 'Stats',
    render(main) {
      const p = FD.store.profile(), lib = FD.lib, s = p.stats, cfg = FD.config, today = FD.u.dateKey();
      const rk = FD.scoring.rank(p.xp);
      const official = lib.features.filter((f) => !f.community);
      const have = official.filter((f) => FD.scoring.collected(p, f)).length;
      const winPct = s.played ? Math.round((s.won / s.played) * 100) : 0;
      const avgHints = s.won ? (s.hist.reduce((a, n, i) => a + n * (i + 1), 0) / s.won).toFixed(1) : '\u2013';
      const streak = FD.store.dailyStreak();
      const maxBar = Math.max(1, ...s.hist, s.fails);
      const badgeDefs = FD.badges.all(lib), earned = badgeDefs.filter((b) => p.badges[b.id]);
      const un = FD.scoring.unlocks(p, lib, FD.store.settings());
      const master = FD.badges.masterStatus(p, lib);
      const days = Array.from({ length: 14 }, (_, i) => { const k = FD.u.addDays(today, i - 13); return { k, r: p.daily.results[k] }; });
      const dailyWins = Object.values(p.daily.results).filter((r) => r.won).length;

      main.innerHTML = flat(html`<div class="container hub">
        <header class="stats-head card c-blue">
          ${FD.avatar(p.name, p.color, 72)}
          <div class="sh-main"><p class="eyebrow">Player stats</p><h1>${p.name}</h1>
            <p class="sh-rank">${FD.icon('crown', { size: 20 })}<strong>${rk.rank.name}</strong><span>${p.xp} XP${rk.next ? ` \u00B7 ${rk.toNext} to ${rk.next.name}` : ' \u00B7 top rank!'}</span></p>
            ${ui.bar(rk.pct, 'yellow', 'Progress to next rank')}</div>
          <button class="btn btn-accent" type="button" data-action="profile">${FD.icon('users', { size: 20 })}Switch player</button>
        </header>

        <section class="num-grid" aria-label="Key numbers">
          <div class="num card"><strong>${s.played}</strong><span>Played</span></div>
          <div class="num card"><strong>${winPct}<small>%</small></strong><span>Win rate</span></div>
          <div class="num card c-orange is-fill"><strong>${FD.icon('flame', { size: 26 })}${streak}</strong><span>Daily streak</span></div>
          <div class="num card"><strong>${p.daily.max}</strong><span>Best daily streak</span></div>
          <div class="num card"><strong>${s.bestScore}</strong><span>Best score</span></div>
          <div class="num card"><strong>${avgHints}</strong><span>Avg hints used</span></div>
        </section>

        <div class="stats-cols">
          <section class="card" aria-labelledby="dist-h">
            <h2 id="dist-h">Hints used when you win</h2>
            <ol class="dist">${s.hist.map((n, i) => html`<li><span class="d-label">${i + 1}</span><span class="d-bar c-${FD.play.hintColor(i + 1)}" style="width:${Math.max(n ? 8 : 0, (n / maxBar) * 100)}%"><b>${n}</b></span></li>`)}
              <li><span class="d-label">X</span><span class="d-bar c-red" style="width:${Math.max(s.fails ? 8 : 0, (s.fails / maxBar) * 100)}%"><b>${s.fails}</b></span></li></ol>
            <p class="muted small">1 = nailed it from the first hint. X = revealed.</p>
          </section>
          <section class="card" aria-labelledby="cal-h">
            <h2 id="cal-h">Daily challenge, last 14 days</h2>
            <ol class="daystrip">${days.map(({ k, r }) => html`<li class="day ${r ? (r.won ? 'won' : 'lost') : 'none'} ${k === today ? 'today' : ''}" title="${FD.u.fmtDateShort(k)}: ${r ? (r.won ? 'solved' : 'missed') : 'not played'}"><span class="sr-only">${FD.u.fmtDateShort(k)}: ${r ? (r.won ? 'solved' : 'missed') : 'not played'}</span><span aria-hidden="true">${new Date(FD.u.keyToDay(k) * 86400000).getUTCDate()}</span></li>`)}</ol>
            <p class="muted small">${dailyWins} Daily Challenge ${dailyWins === 1 ? 'win' : 'wins'} in total \u00B7 green = solved, orange = revealed.</p>
          </section>
        </div>

        <section class="card" aria-labelledby="coll-h">
          <div class="section-head"><h2 id="coll-h">Collection progress</h2><a class="btn btn-link" href="#/book">Open Feature Book ${FD.icon('right', { size: 18 })}</a></div>
          <div class="coll-grid">
            <div class="coll-ring">${ui.ring(official.length ? (have / official.length) * 100 : 0, { size: 128, stroke: 14, color: 'green', label: `${have}/${official.length}`, sub: 'features' })}</div>
            <div class="coll-bars">${cfg.difficulties.map((d) => { const fs = official.filter((f) => f.difficulty === d); const h = fs.filter((f) => FD.scoring.collected(p, f)).length; const u = un[d]; return html`<div class="cb"><span class="cb-label">${ui.diffChip(d)}</span>${ui.bar(fs.length ? (h / fs.length) * 100 : 0, ui.DIFF_COLOR[d], d + ' collected')}<span class="cb-n">${h}/${fs.length}</span>${u.unlocked ? '' : html`<small class="cb-lock">${FD.icon('lock', { size: 12 })}Collect ${u.need - u.have} more ${u.from} to unlock in free play</small>`}</div>`; })}</div>
          </div>
          <h3 class="mini-h">Feature Master status <small>${master.mastered} of ${master.total} categories</small></h3>
          <ul class="master-list">${master.rows.map((r) => html`<li class="c-${r.category.color} ${r.master ? 'is-master' : ''}"><span class="m-ic" aria-hidden="true">${FD.icon(r.master ? 'crown' : r.category.icon || 'sparkle', { size: 20 })}</span><span class="m-name">${r.category.name}</span><span class="m-count">${r.have}/${r.total}</span>${ui.bar((r.have / r.total) * 100, r.category.color, r.category.name + ' progress')}</li>`)}</ul>
        </section>

        <section class="card" aria-labelledby="bad-h">
          <div class="section-head"><h2 id="bad-h">Achievement badges <small>${earned.length} of ${badgeDefs.length}</small></h2></div>
          <ul class="badge-grid">${badgeDefs.map((b) => { const got = p.badges[b.id]; return html`<li class="badge ${got ? 'is-earned' : ''}">${ui.badge(b, !!got)}<div><strong>${b.name}</strong><p>${b.desc}</p>${got ? html`<small>Earned ${FD.u.fmtDateShort(FD.u.dateKey(new Date(got)))}</small>` : html`<small class="muted">Locked</small>`}</div></li>`; })}</ul>
        </section>

        <div class="stats-cols">
          <section class="card" aria-labelledby="rank-h">
            <h2 id="rank-h">The road to Copilot Champion</h2>
            <ol class="ladder">${cfg.ranks.map((r, i) => html`<li class="c-${r.color} ${i === rk.index ? 'is-here' : i < rk.index ? 'is-done' : ''}"><span class="l-dot" aria-hidden="true">${i < rk.index ? FD.icon('check', { size: 14 }) : i === rk.index ? FD.icon('star', { size: 14 }) : ''}</span><strong>${r.name}</strong><small>${r.xp} XP</small>${i === rk.index ? html`<span class="chip chip-solid c-blue">You are here</span>` : ''}</li>`)}</ol>
          </section>
          <section class="card" aria-labelledby="rec-h">
            <h2 id="rec-h">Recent games</h2>
            ${p.history.length ? html`<ul class="recent">${p.history.slice(0, 8).map((h) => html`<li><span class="rv-dot ${h.won ? 'won' : 'lost'}" aria-hidden="true"></span><span class="rc-name"><strong>${h.name}</strong><small>${{ daily: 'Daily', free: 'Free play', speed: 'Speed round' }[h.mode] || h.mode} \u00B7 ${h.won ? FD.u.plural(h.hints, 'hint') : 'revealed'}</small></span><span class="rc-score">${h.won ? '+' + h.score : '\u2013'}</span></li>`)}</ul>` : html`<p class="muted">Nothing yet. <a href="#/daily">Play today\u2019s challenge</a> to get started!</p>`}
          </section>
        </div>
      </div>`);
    }
  };
})();
