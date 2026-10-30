/* Copilot Feature-dle · Leaderboard (device-wide by default, optional live event board) */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount, attrs } = FD.u;
  const ui = FD.ui;

  const TABS = [
    { id: 'daily', label: 'Today', icon: 'calendar', heading: 'Daily challenge rankings', empty: 'Nobody has finished today\u2019s challenge yet. Be the first on the board!',
      metric: (p) => html`<strong>${p.today.score}</strong><small>pts</small>`, sub: (p) => `${FD.u.plural(p.today.hints, 'hint')}${p.today.timeMs ? ' \u00B7 ' + FD.u.fmtSeconds(p.today.timeMs) : ''}` },
    { id: 'streak', label: 'Longest streak', icon: 'flame', heading: 'Longest Daily Challenge streak', empty: 'No streaks yet. Win the Daily Challenge two days running to get one going.',
      metric: (p) => html`<strong>${p.maxStreak}</strong><small>${p.maxStreak === 1 ? 'day' : 'days'}</small>`, sub: (p) => `${p.totalScore} pts overall` },
    { id: 'score', label: 'Highest scores', icon: 'star', heading: 'Highest total scores', empty: 'No scores yet \u2013 play a game to get on the board.',
      metric: (p) => html`<strong>${p.totalScore}</strong><small>pts</small>`, sub: (p) => `Best game: ${p.bestScore}` },
    { id: 'games', label: 'Most games', icon: 'target', heading: 'Most games completed', empty: 'No games yet \u2013 your first one is just a click away.',
      metric: (p) => html`<strong>${p.played}</strong><small>${p.played === 1 ? 'game' : 'games'}</small>`, sub: (p) => `${p.totalScore} pts overall` }
  ];

  FD.views.leaderboard = {
    title: 'Leaderboard',
    async render(main) {
      let tab = 'daily', data = FD.board.local(), live = false, note = '', loading = false;
      const remote = FD.board.remoteEnabled();
      const rows = (t, list) => list.length
        ? html`<ol class="board">${list.map((p, i) => html`<li class="lb-row ${p.you ? 'is-you' : ''}"><span class="lb-rank r${i + 1}" aria-label="Rank ${i + 1}">${i + 1}</span>${FD.avatar(p.name, p.color, 40)}<span class="lb-name"><strong>${p.name}</strong>${p.you ? html`<span class="chip chip-solid c-blue">You</span>` : ''}${p.sample ? html`<span class="chip" title="Sample player so the board is never empty. Turn off in Settings.">Sample</span>` : ''}<small>${t.sub(p)}</small></span><span class="lb-metric">${t.metric(p)}</span></li>`)}</ol>`
        : html`<div class="empty-state">${FD.pip('think', { size: 100 })}<p>${t.empty}</p><a class="btn btn-primary" href="#/daily">Play today\u2019s challenge</a></div>`;

      function draw() {
        const t = TABS.find((x) => x.id === tab);
        main.innerHTML = flat(html`<div class="container hub">
          <header class="hub-head"><p class="eyebrow">${live ? 'Live event board' : 'On this device'}</p><h1>Leaderboard</h1>
            <p class="lede">${live ? 'Everyone playing in this event, updated live.' : 'Everyone who has played on this device, plus a few friendly sample players. Running an event? You can connect a shared board.'}</p></header>
          <div class="tabs" role="tablist" aria-label="Leaderboards">${TABS.map((x) => html`<button class="tab" role="tab" id="tab-${x.id}" aria-controls="lb-panel" aria-selected="${String(x.id === tab)}" tabindex="${x.id === tab ? 0 : -1}" data-tab="${x.id}">${FD.icon(x.icon, { size: 18 })}${x.label}</button>`)}</div>
          <section class="card lb-card" id="lb-panel" role="tabpanel" aria-labelledby="tab-${tab}">
            <div class="section-head"><h2>${t.heading}</h2>${remote ? html`<button class="btn btn-ghost btn-sm" type="button" data-action="lb-refresh">${FD.icon('refresh', { size: 16 })}${loading ? 'Refreshing\u2026' : 'Refresh'}</button>` : ''}</div>
            ${note ? html`<p class="banner c-orange">${FD.icon('info', { size: 18 })} ${note}</p>` : ''}
            ${rows(t, data[tab])}
          </section>
          <p class="muted small lb-foot">${FD.icon('shield', { size: 16 })} ${live ? 'Names are whatever each player typed. Scores are only as honest as the players \u2013 this is a friendly game!' : html`Your progress and this board are stored only on this device. ${data.players.some((p) => p.sample) ? 'Players marked \u201CSample\u201D are placeholders. Switch them off in Settings.' : ''}`}</p>
        </div>`);
        const list = $('.tabs', main);
        list.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; draw(); $('#tab-' + tab, main).focus(); } });
        list.addEventListener('keydown', (e) => {
          const i = TABS.findIndex((x) => x.id === tab);
          const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
          if (n >= 0) { e.preventDefault(); tab = TABS[n].id; draw(); $('#tab-' + tab, main).focus(); }
        });
      }
      async function refresh() {
        if (!remote) return;
        loading = true; draw();
        try { data = await FD.board.fetchRemote(); live = true; note = ''; }
        catch (e) { live = false; data = FD.board.local(); note = 'Couldn\u2019t reach the event leaderboard, so you\u2019re seeing this device only.'; }
        loading = false; draw();
      }
      ui.actions['lb-refresh'] = refresh;
      draw();
      if (remote) refresh();
    }
  };
})();
