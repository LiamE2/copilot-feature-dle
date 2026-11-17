/* Copilot Feature-dle · Settings (comfort, accessibility, sound, leaderboard, app, data) */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, attrs } = FD.u;
  const ui = FD.ui;

  /* the browser's install prompt is captured by 99-app.js */
  FD.pwa = FD.pwa || { deferred: null, controlled: false };

  const sw = (key, label, desc, on) => html`<label class="switch"><input type="checkbox" role="switch" data-setting="${key}"${attrs({ checked: on })}><span class="track" aria-hidden="true"></span><span class="switch-text"><strong>${label}</strong><small>${desc}</small></span></label>`;
  const onIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const onPhone = () => onIOS() || /Android/i.test(navigator.userAgent);
  const standalone = () => !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true);
  const radio = (name, value, label, on, desc) => html`<label class="pill-radio"><input type="radio" name="${name}" value="${value}"${attrs({ checked: on })}><span>${label}${desc ? html`<small>${desc}</small>` : ''}</span></label>`;

  FD.views.settings = {
    title: 'Settings',
    render(main) {
      const draw = () => {
        const s = FD.store.settings();
        main.innerHTML = flat(html`<div class="container hub">
          <header class="hub-head"><p class="eyebrow">Make it yours</p><h1>Settings</h1><p class="lede">Comfort, accessibility and profile options</p></header>
          <div class="settings-grid">
            ${FD.account.card()}
            <section class="card" aria-labelledby="s-comfort"><h2 id="s-comfort">Comfort &amp; accessibility</h2>
              <fieldset class="field"><legend>Motion &amp; animation</legend><div class="pill-radios">
                ${radio('motion', 'system', 'Match my device', s.motion === 'system')}${radio('motion', 'reduce', 'Reduce motion', s.motion === 'reduce')}${radio('motion', 'full', 'Full motion', s.motion === 'full')}</div></fieldset>
              <fieldset class="field"><legend>Text size</legend><div class="pill-radios">
                ${radio('textScale', '1', 'Standard', +s.textScale === 1)}${radio('textScale', '1.125', 'Large', +s.textScale === 1.125)}${radio('textScale', '1.25', 'Larger', +s.textScale === 1.25)}</div></fieldset>
              ${sw('contrast', 'High contrast', 'Stronger borders and plain navy-on-white colours.', s.contrast)}
            </section>

            <section class="card" aria-labelledby="s-feel"><h2 id="s-feel">Sound &amp; feedback</h2>
              ${sw('sound', 'Sound effects', 'Tiny blips for hints, wins and badges. Off by default.', s.sound)}
              ${sw('haptics', 'Vibration (phones)', 'A gentle buzz on guesses and wins.', s.haptics)}
              ${sw('confetti', 'Confetti', 'Celebrate wins in Engage Squared colours.', s.confetti)}
            </section>

            <section class="card" aria-labelledby="s-fac"><h2 id="s-fac">Leaderboard</h2>
              ${sw('hideFromBoard', 'Hide my profile from the leaderboard', 'You won\u2019t appear on any leaderboard, and nobody can open your profile.', s.hideFromBoard)}
            </section>

            <section class="card" aria-labelledby="s-app"><h2 id="s-app">Desktop/Phone App</h2>
              ${standalone() ? html`<p class="status-line">${FD.icon('check', { size: 20 })}<span>You\u2019re using the app right now.</span></p>` : html`<p class="muted">Put Feature-dle on your computer or phone so it opens like any other app.</p>`}
              <div class="btn-row">
                <button class="btn btn-primary" type="button" data-action="app-install" data-device="desktop">${FD.icon('apps', { size: 20 })}Create desktop app</button>
                <button class="btn btn-primary" type="button" data-action="app-install" data-device="phone">${FD.icon('mobile', { size: 20 })}Create phone app</button>
              </div>
              <p class="muted small">The app opens Feature-dle from wherever the game is hosted, so it needs a connection to play.</p></section>

            <section class="card" aria-labelledby="s-data"><h2 id="s-data">Your data</h2>
              <p class="muted">Back up your progress to move it to another device, or erase it to start fresh.</p>
              <div class="btn-row">
                <button class="btn btn-ghost" type="button" data-action="data-export">${FD.icon('download', { size: 20 })}Export backup</button>
                <label class="btn btn-ghost" for="import-file">${FD.icon('upload', { size: 20 })}Import backup</label><input id="import-file" class="sr-only" type="file" accept="application/json,.json">
              </div>
              <div class="btn-row">
                <button class="btn btn-danger-ghost" type="button" data-action="data-erase">${FD.icon('trash', { size: 20 })}Erase account data</button>
              </div></section>
          </div></div>`);
        bind();
      };
      function bind() {
        $$('[data-setting]', main).forEach((el) => el.addEventListener('change', () => { FD.store.setSetting(el.dataset.setting, el.checked); if (el.dataset.setting === 'sound' && el.checked) FD.fx.play('hint'); }));
        $$('input[name="motion"]', main).forEach((el) => el.addEventListener('change', () => FD.store.setSetting('motion', el.value)));
        $$('input[name="textScale"]', main).forEach((el) => el.addEventListener('change', () => FD.store.setSetting('textScale', +el.value)));
        $('#import-file', main).addEventListener('change', (e) => {
          const file = e.target.files[0]; if (!file) return;
          const r = new FileReader();
          r.onload = () => { const res = FD.store.importJSON(String(r.result)); ui.toast(res.ok ? 'Backup imported' : res.error, { icon: res.ok ? 'check' : 'x' }); if (res.ok) draw(); };
          r.readAsText(file);
        });
      }
      ui.actions['data-export'] = () => { FD.u.download(FD.store.exportJSON(), 'copilot-feature-dle-backup.json', 'application/json'); ui.toast('Backup downloaded', { icon: 'check' }); };
      ui.actions['data-erase'] = async () => { if (await ui.confirm('Erase your account data?', 'This removes your progress, stats, badges, settings and sign-in from this device. It can\u2019t be undone (unless you exported a backup).', 'Erase account data', true)) { FD.store.resetAll(); ui.toast('Account data erased', { icon: 'check' }); ui.render(); } };
      /* "Create desktop app" and "Create phone app": the browser's own install prompt when this device can show one, and plain steps (or a link to open on the other device) when it can't */
      ui.actions['app-install'] = async (el) => {
        const want = el.dataset.device === 'phone' ? 'phone' : 'desktop', here = onPhone() ? 'phone' : 'desktop';
        if (standalone()) { ui.toast('You\u2019re already using the app', { icon: 'check' }); return; }
        if (want === here && FD.pwa.deferred) { const d = FD.pwa.deferred; d.prompt(); try { await d.userChoice; } catch (e) { /* ignore */ } FD.pwa.deferred = null; draw(); return; }
        const url = location.href.split('#')[0], hosted = /^https?:$/.test(location.protocol);
        const steps = want === 'phone'
          ? (onIOS() ? 'In Safari, tap the Share button, then choose Add to Home Screen.' : 'In your browser, open the menu (the three dots), then choose Install app or Add to Home screen.')
          : 'In Microsoft Edge or Google Chrome, look for the install icon at the right of the address bar, or open the menu and choose Install Feature-dle. In Safari, choose File, then Add to Dock.';
        ui.dialog({
          title: want === 'phone' ? 'Create the phone app' : 'Create the desktop app',
          body: !hosted ? html`<p>The app can be created once Feature-dle is hosted on a website. Open the hosted game, then come back to Settings.</p>`
            : html`${want === here ? '' : html`<p>Open Feature-dle on your ${want} to add it there. This is its address:</p><p class="dlg-link"><code>${url}</code></p><p><button class="btn btn-ghost btn-sm" type="button" data-action="copy" data-copy="${url}">${FD.icon('copy', { size: 16 })}Copy link</button></p><p class="muted">Then:</p>`}<p>${steps}</p>`,
          actions: [{ id: 'close', label: 'Got it', cls: 'btn-primary' }]
        });
      };
      draw();
    }
  };
})();
