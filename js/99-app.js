/* Copilot Feature-dle · boot, routes, midnight ticker, PWA bits */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$ } = FD.u;
  const ui = FD.ui;

  function routes() {
    ui.route('/', FD.views.home);
    ui.route('/daily', FD.views.daily);
    ui.route('/free', FD.views.free);
    ui.route('/speed', FD.views.speed);
    ui.route('/team', FD.views.team);
    ui.route('/play/:id', FD.views.play);
    ui.route('/c/:code', FD.views.challenge);
    ui.route('/book/:id?', FD.views.book);
    ui.route('/stats', FD.views.stats);
    ui.route('/leaderboard', FD.views.leaderboard);
    ui.route('/about', FD.views.about);
    ui.route('/settings', FD.views.settings);
    ui.route('/packs', FD.views.packs);
  }

  /* countdown to the next Daily Challenge + roll the page over at local midnight */
  function ticker() {
    let key = FD.u.dateKey();
    setInterval(() => {
      const t = FD.u.fmtClock(FD.u.msToMidnight());
      $$('[data-countdown]').forEach((el) => { el.textContent = t; });
      const now = FD.u.dateKey();
      if (now !== key) { key = now; const p = ui.current().path; if (p === '/' || p === '/daily') ui.render(); }
    }, 1000);
  }

  function pwa() {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); FD.pwa.deferred = e; if (ui.current().path === '/settings') ui.render(); });
    window.addEventListener('appinstalled', () => { FD.pwa.deferred = null; ui.toast('Feature-dle installed. Find it on your home screen!', { icon: 'check' }); });
    window.addEventListener('offline', () => ui.toast('You\u2019re offline. Feature-dle keeps working!', { icon: 'offline' }));
    window.addEventListener('online', () => ui.toast('Back online', { icon: 'check' }));
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { FD.pwa.controlled = !!navigator.serviceWorker.controller; })
        .catch(() => { /* offline support is a bonus */ });
      navigator.serviceWorker.addEventListener('controllerchange', () => { FD.pwa.controlled = true; });
    }
  }

  /* live event board: share a link like  https://your-host/?event=LUNCH26  and everyone who opens it joins the same board
     (needs an endpoint such as the one built into tools\serve.ps1, see README) */
  const cleanCode = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  /* a link may only point the board at this same site - never at a third-party endpoint */
  const sameSiteEndpoint = (v) => {
    if (!v) return '';
    try { const u = new URL(String(v), location.href); return u.origin === location.origin ? u.pathname + u.search : ''; } catch (e) { return ''; }
  };
  function applyEvent() {
    const ev = FD.store.state.meta.event;
    if (!FD.config.leaderboard.endpoint && ev && cleanCode(ev.code)) FD.config.leaderboard = { endpoint: sameSiteEndpoint(ev.endpoint) || 'api/leaderboard', eventCode: cleanCode(ev.code) };
  }
  function joinEventFromUrl() {
    const sp = new URLSearchParams(location.search), code = cleanCode(sp.get('event'));
    if (code) { FD.store.state.meta.event = { code, endpoint: sameSiteEndpoint(sp.get('board')) || 'api/leaderboard' }; FD.store.save(); }
    applyEvent();
  }
  FD.joinEvent = (code) => {
    const c = cleanCode(code);
    if (c) FD.store.state.meta.event = { code: c, endpoint: 'api/leaderboard' }; else delete FD.store.state.meta.event;
    FD.config.leaderboard = c ? { endpoint: 'api/leaderboard', eventCode: c } : { endpoint: '', eventCode: '' };
    FD.store.save();
    return c;
  };

  async function boot() {
    FD.store.load();
    FD.store.applySettings();
    routes();
    ui.renderShell();
    try {
      const raw = await FD.data.load();
      FD.rawLib = raw;
      FD.data.build(raw, FD.store.community());
    } catch (e) {
      console.error(e);
      $('#main').innerHTML = flat(html`<div class="container section"><div class="card"><h1>Hmm, the feature library didn\u2019t load</h1><p>Pip couldn\u2019t find <code>data/features.json</code>. If you opened the page straight from a folder, try the single-file edition or serve the folder with <code>tools\\serve.ps1</code>.</p></div></div>`);
      return;
    }
    if (location.hash === '' || location.hash === '#') history.replaceState(null, '', '#/');
    joinEventFromUrl();
    ui.render();
    if (!FD.store.onboarded() && !/[?&]nowelcome\b/.test(location.search)) ui.firstRun();
    ticker();
    pwa();
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
