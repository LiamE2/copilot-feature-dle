/* Copilot Feature-dle · boot, routes, midnight ticker, PWA bits */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$ } = FD.u;
  const ui = FD.ui;

  function routes() {
    ui.route('/', FD.views.home);
    ui.route('/daily', FD.views.daily);
    ui.route('/hunt', FD.views.hunt);
    ui.route('/match', FD.views.match);
    ui.route('/prompts', FD.views.prompts);
    ui.route('/free', FD.views.free);
    ui.route('/speed', { title: 'Free Play', render() { ui.go('/free'); } }); /* the timed round is gone: its old link lands on Free Play */
    ui.route('/packs', FD.views.packs);
    ui.route('/pack/:id', FD.views.pack);
    ui.route('/team', { title: 'Free Play', render() { ui.go('/free'); } }); /* Team Battle is retired: its old link lands on Free Play */
    ui.route('/play/:id', FD.views.play);
    ui.route('/c/:code', FD.views.challenge);
    ui.route('/book/:id?', FD.views.book);
    ui.route('/stats', FD.views.stats);
    ui.route('/leaderboard', FD.views.leaderboard);
    ui.route('/about', FD.views.about);
    ui.route('/settings', FD.views.settings);
  }

  /* once a second: countdowns, the running Daily clock on the home tile, and the roll-over at local midnight */
  function ticker() {
    let key = FD.u.dateKey();
    setInterval(() => {
      const t = FD.daily.countdownText(), end = FD.u.fmtClock(FD.u.msToMidnight());
      $$('[data-countdown]').forEach((el) => { el.textContent = el.dataset.countdown === 'end' ? end : t; });
      $$('.bonus-live').forEach((el) => { const s = +el.dataset.clock; if (s) el.textContent = ui.bonusText(Date.now() - s - (+el.dataset.paused || 0)); });
      const now = FD.u.dateKey();
      if (now !== key) {
        key = now;
        const p = ui.current().path;
        /* someone playing the Daily Challenge at midnight sees it end on their screen; everything else is settled quietly */
        if (p !== '/daily') FD.store.expireDailies();
        if (p === '/' || p === '/daily') ui.render();
      }
    }, 1000);
  }

  function pwa() {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); FD.pwa.deferred = e; if (ui.current().path === '/settings') ui.render(); });
    window.addEventListener('appinstalled', () => { FD.pwa.deferred = null; ui.toast('Feature-dle installed. Find it on your home screen!', { icon: 'check' }); });
    window.addEventListener('offline', () => ui.toast('You\u2019re offline. Feature-dle keeps working!', { icon: 'offline' }));
    window.addEventListener('online', () => ui.toast('Back online', { icon: 'check' }));
    /* an isolated test or demo slot (?ns=) is never served from the offline cache, so what you test is what is on disk */
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/[?&]ns=/.test(location.search)) {
      navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { FD.pwa.controlled = !!navigator.serviceWorker.controller; })
        .catch(() => { /* offline support is a bonus */ });
      /* a new version took over: on the home screen load it straight away, anywhere else (a game may be on screen) say it is ready */
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        FD.pwa.controlled = true;
        if (!hadController) return;
        if (ui.current().path === '/') location.reload();
        else ui.toast('A new version of Feature-dle is ready. It loads next time you open the game.', { icon: 'check' });
      });
    }
  }

  async function boot() {
    FD.store.load();
    FD.store.applySettings();
    /* coming back from Microsoft: the address bar is tidied before anything else looks at it */
    const callback = FD.auth.takeCallback();
    routes();
    ui.renderShell();
    if (callback) $('#main').innerHTML = '<div class="container boot"><p>Signing you in\u2026</p></div>';
    try {
      const raw = await FD.data.load();
      FD.rawLib = raw;
      FD.data.build(raw);
    } catch (e) {
      console.error(e);
      $('#main').innerHTML = flat(html`<div class="container section"><div class="card"><h1>Hmm, the feature library didn\u2019t load</h1><p>Pip couldn\u2019t find <code>data/features.json</code>. If you opened the page straight from a folder, try the single-file edition or serve the folder with <code>tools\\serve.ps1</code>.</p></div></div>`);
      return;
    }
    await FD.changelog.load();
    await FD.prompts.load(); /* the Prompt Lab scenarios (data/prompts.json) */
    await FD.scenarios.load(); /* the Scenario Match scenarios (data/scenarios.json); they are also each feature's example scenarios */
    await FD.daily.load(); /* the Daily plan (data/daily.json), which can name a question as well as a feature; with none, the random rotation covers every day */
    /* finish a sign-in before anything is settled, so everything below happens to the right player */
    const signedIn = callback ? await FD.auth.complete(callback) : null;
    /* anything left over from earlier days is settled before the first screen is drawn */
    FD.store.expireDailies();
    if (location.hash === '' || location.hash === '#') history.replaceState(null, '', '#/');
    ui.render();
    if (signedIn) ui.toast(signedIn.ok ? `Signed in as ${signedIn.display}` : signedIn.message, { icon: signedIn.ok ? 'check' : 'x', ms: signedIn.ok ? 4000 : 8000 });
    /* popups on open (?nowelcome keeps tests and screenshots clean):
       a brand-new player meets Pip; everyone else sees What's new once, whenever the game or the Microsoft updates change */
    const quiet = /[?&]nowelcome\b/.test(location.search);
    const token = FD.changelog.token();
    if (!quiet) {
      if (!FD.store.onboarded()) ui.welcome();
      else if (token && FD.store.changelogSeen() !== token) ui.changelog();
    }
    ticker();
    pwa();
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
