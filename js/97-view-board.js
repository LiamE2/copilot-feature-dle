/* Copilot Feature-dle · Leaderboard (everyone on this device by default, or a shared organisation board). Tap a player to see their profile. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $ } = FD.u;
  const ui = FD.ui;

  const TABS = [
    { id: 'daily', label: 'Today', icon: 'calendar', heading: 'Daily challenge rankings', empty: 'Nobody has finished today\u2019s challenge yet. Be the first on the board!',
      metric: (p) => html`<strong>${p.today.score}</strong><small>pts</small>`, sub: (p) => `${FD.u.plural(p.today.hints, p.today.kind && p.today.kind !== 'hunt' ? 'pick' : 'hint')}${p.today.timeMs ? ' \u00B7 ' + FD.u.fmtSeconds(p.today.timeMs) : ''}` },
    { id: 'streak', label: 'Longest streak', icon: 'flame', heading: 'Longest Daily Challenge streak', empty: 'No streaks yet. Win the Daily Challenge two days running to get one going.',
      metric: (p) => html`<strong>${p.maxStreak}</strong><small>${p.maxStreak === 1 ? 'day' : 'days'}</small>`, sub: (p) => `${p.totalScore} pts overall` },
    { id: 'score', label: 'Highest scores', icon: 'star', heading: 'Highest total scores', empty: 'No scores yet \u2013 play a game to get on the board.',
      metric: (p) => html`<strong>${p.totalScore}</strong><small>pts</small>`, sub: (p) => `${FD.u.plural(p.played, 'puzzle')} played` },
    { id: 'puzzles', label: 'Most puzzles', icon: 'target', heading: 'Most puzzles played', empty: 'No puzzles yet \u2013 your first one is just a click away.',
      metric: (p) => html`<strong>${p.played}</strong><small>${p.played === 1 ? 'puzzle' : 'puzzles'}</small>`, sub: (p) => `${p.totalScore} pts overall` },
    { id: 'mastery', label: 'Mastery', icon: 'crown', heading: 'Most features mastered', empty: 'Nobody has mastered a feature yet. Complete every puzzle a feature has (Know it, Use it and Prompt it) to master it.',
      metric: (p) => html`<strong>${p.mastered}</strong><small>${p.mastered === 1 ? 'feature' : 'features'}</small>`, sub: (p) => `${p.collected} of ${p.collectedTotal} collected` }
  ];
  /* what the search results show for each player: their score and rank (never their XP) */
  const FIND = { metric: (p) => html`<strong>${p.totalScore || 0}</strong><small>pts</small>`, sub: (p) => FD.scoring.rank(p.xp || 0).rank.name };

  FD.views.leaderboard = {
    title: 'Leaderboard',
    async render(main) {
      let tab = 'daily', data = FD.board.local(), note = '', loading = false, query = '';
      const remote = FD.board.remoteEnabled();

      const row = (t, p, i, showRank) => html`<li><button class="lb-row ${p.you ? 'is-you' : ''}" type="button" data-action="lb-open" data-pid="${p.id}" aria-haspopup="dialog">
        ${showRank ? html`<span class="lb-rank r${i + 1}" aria-label="Rank ${i + 1}">${i + 1}</span>` : ''}${FD.avatar(p.name, p.color, 40, FD.scoring.rank(p.xp || 0).rank.id)}<span class="lb-name"><strong>${p.name}</strong>${p.you ? html`<span class="chip chip-solid c-blue">You</span>` : ''}<small>${t.sub(p)}</small></span><span class="lb-metric">${t.metric(p)}</span><span class="lb-go" aria-hidden="true">${FD.icon('right', { size: 18 })}</span><span class="sr-only">Open profile</span></button></li>`;

      function panelHtml() {
        const q = query.trim().toLowerCase();
        if (q) {
          const found = data.players.filter((p) => p.name.toLowerCase().includes(q)).sort((a, b) => (b.xp || 0) - (a.xp || 0));
          return html`<div class="section-head"><h2>Players matching \u201C${query.trim()}\u201D</h2></div>
            ${found.length ? html`<ol class="board">${found.map((p, i) => row(FIND, p, i, false))}</ol>` : html`<p class="muted">Nobody called that yet. Check the spelling, or try just the first few letters.</p>`}`;
        }
        const t = TABS.find((x) => x.id === tab), list = data[tab];
        return html`<div class="section-head"><h2>${t.heading}</h2>${remote ? html`<button class="btn btn-ghost btn-sm" type="button" data-action="lb-refresh">${FD.icon('refresh', { size: 16 })}${loading ? 'Refreshing\u2026' : 'Refresh'}</button>` : ''}</div>
          ${note ? html`<p class="banner c-orange">${FD.icon('info', { size: 18 })} ${note}</p>` : ''}
          ${list.length ? html`<ol class="board">${list.map((p, i) => row(t, p, i, true))}</ol>`
            : html`<div class="empty-state">${FD.pip('think', { size: 100 })}<p>${t.empty}</p><a class="btn btn-primary" href="#/daily">Play today\u2019s challenge</a></div>`}`;
      }
      function drawPanel() { $('#lb-panel', main).innerHTML = flat(panelHtml()); }
      function markTabs() {
        main.querySelectorAll('[data-tab]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.tab === tab && !query.trim())); b.tabIndex = b.dataset.tab === tab ? 0 : -1; });
        const panel = $('#lb-panel', main); panel.setAttribute('aria-labelledby', 'tab-' + tab);
      }

      function draw() {
        main.innerHTML = flat(html`<div class="container hub">
          <header class="hub-head"><p class="eyebrow">Across the org</p><h1>Leaderboard</h1>
            <p class="lede">See how you rank across your organisation and follow the race for the top spot. Tap anyone to see their profile.</p></header>
          ${FD.board.hidden() ? html`<p class="banner c-blue">${FD.icon('eye', { size: 18 })} You\u2019re hidden from the leaderboard. You can change this in <a href="#/settings">Settings</a>.</p>` : FD.account.note('You\u2019re on this board as a guest. Sign in to use your own name.')}
          <div class="field lb-search"><label for="lb-q">Find a player</label><div class="search"><span aria-hidden="true">${FD.icon('search', { size: 18 })}</span><input id="lb-q" class="input" type="search" placeholder="Search by name\u2026" autocomplete="off" value="${query}"></div></div>
          <div class="tabs" role="tablist" aria-label="Leaderboards">${TABS.map((x) => html`<button class="tab" role="tab" id="tab-${x.id}" aria-controls="lb-panel" aria-selected="${String(x.id === tab && !query.trim())}" tabindex="${x.id === tab ? 0 : -1}" data-tab="${x.id}">${FD.icon(x.icon, { size: 18 })}${x.label}</button>`)}</div>
          <section class="card lb-card" id="lb-panel" role="tabpanel" aria-labelledby="tab-${tab}"></section>

        </div>`);
        drawPanel();
        const tabs = $('.tabs', main);
        const pick = (id) => { tab = id; query = ''; $('#lb-q', main).value = ''; markTabs(); drawPanel(); $('#tab-' + tab, main).focus(); };
        tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) pick(b.dataset.tab); });
        tabs.addEventListener('keydown', (e) => {
          const i = TABS.findIndex((x) => x.id === tab);
          const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
          if (n >= 0) { e.preventDefault(); pick(TABS[n].id); }
        });
        $('#lb-q', main).addEventListener('input', (e) => { query = e.target.value; markTabs(); drawPanel(); });
      }
      async function refresh() {
        if (!remote) return;
        loading = true; drawPanel();
        try { data = await FD.board.fetchRemote(); note = ''; }
        catch (e) { data = FD.board.local(); note = 'Couldn\u2019t reach the shared leaderboard, so you\u2019re seeing this device only.'; }
        loading = false; draw();
      }
      ui.actions['lb-refresh'] = refresh;
      ui.actions['lb-open'] = (el) => { const pl = data.players.find((x) => String(x.id) === el.dataset.pid); if (pl) ui.profileDialog(pl); };
      draw();
      if (remote) refresh();
    }
  };
})();
