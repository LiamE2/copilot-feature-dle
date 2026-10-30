/* Copilot Feature-dle · Settings (comfort, accessibility, facilitator mode, data) */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount, attrs } = FD.u;
  const ui = FD.ui;

  /* PWA install + offline status are tracked by 99-app.js */
  FD.pwa = FD.pwa || { deferred: null, controlled: false };

  const sw = (key, label, desc, on) => html`<label class="switch"><input type="checkbox" role="switch" data-setting="${key}"${attrs({ checked: on })}><span class="track" aria-hidden="true"></span><span class="switch-text"><strong>${label}</strong><small>${desc}</small></span></label>`;
  const radio = (name, value, label, on, desc) => html`<label class="pill-radio"><input type="radio" name="${name}" value="${value}"${attrs({ checked: on })}><span>${label}${desc ? html`<small>${desc}</small>` : ''}</span></label>`;

  FD.views.settings = {
    title: 'Settings',
    render(main) {
      const draw = () => {
        const s = FD.store.settings(), p = FD.store.profile();
        const offline = FD.pwa.controlled;
        main.innerHTML = flat(html`<div class="container hub">
          <header class="hub-head"><p class="eyebrow">Make it yours</p><h1>Settings</h1><p class="lede">Comfort, accessibility and event options. Everything saves automatically.</p></header>
          <div class="settings-grid">
            <section class="card" aria-labelledby="s-player"><h2 id="s-player">Player</h2>
              <div class="player-now">${FD.avatar(p.name, p.color, 56)}<div><strong>${p.name}</strong><small class="muted">${FD.scoring.rank(p.xp).rank.name} \u00B7 ${p.xp} XP</small></div></div>
              <div class="btn-row"><button class="btn btn-primary" type="button" data-action="profile">${FD.icon('users', { size: 20 })}Switch, add or rename</button></div>
              <p class="muted small">Sharing a laptop at an event? Add a player for each person so everyone keeps their own stats.</p></section>

            <section class="card" aria-labelledby="s-comfort"><h2 id="s-comfort">Comfort &amp; accessibility</h2>
              <fieldset class="field"><legend>Motion &amp; animation</legend><div class="pill-radios">
                ${radio('motion', 'system', 'Match my device', s.motion === 'system')}${radio('motion', 'reduce', 'Reduce motion', s.motion === 'reduce')}${radio('motion', 'full', 'Full motion', s.motion === 'full')}</div></fieldset>
              <fieldset class="field"><legend>Text size</legend><div class="pill-radios">
                ${radio('textScale', '1', 'Standard', +s.textScale === 1)}${radio('textScale', '1.125', 'Large', +s.textScale === 1.125)}${radio('textScale', '1.25', 'Larger', +s.textScale === 1.25)}</div></fieldset>
              ${sw('contrast', 'High contrast', 'Stronger borders and plain navy-on-white colours.', s.contrast)}
              ${sw('relaxed', 'Relaxed timing', 'No on-screen clock and no speed bonus. Speed round gets double time.', s.relaxed)}
            </section>

            <section class="card" aria-labelledby="s-feel"><h2 id="s-feel">Sound &amp; feedback</h2>
              ${sw('sound', 'Sound effects', 'Tiny blips for hints, wins and badges. Off by default.', s.sound)}
              ${sw('haptics', 'Vibration (phones)', 'A gentle buzz on guesses and wins.', s.haptics)}
              ${sw('confetti', 'Confetti', 'Celebrate wins in Engage Squared colours.', s.confetti)}
            </section>

            <section class="card" aria-labelledby="s-fac"><h2 id="s-fac">Events &amp; facilitators</h2>
              ${sw('unlockAll', 'Facilitator mode', 'Unlock every difficulty in Free play and open the whole Feature Book. Great for demos and training.', s.unlockAll)}
              ${sw('sampleBoard', 'Show sample players on the leaderboard', 'Friendly placeholders (clearly labelled) so the board never looks lonely.', s.sampleBoard)}
              <div class="field event-field"><label for="event-code">Live event code <span class="muted">(optional)</span></label>
                <div class="inline-form"><input id="event-code" class="input" maxlength="40" value="${(FD.store.state.meta.event || {}).code || ''}" placeholder="e.g. LUNCH26" autocomplete="off"><button class="btn btn-ghost" type="button" data-action="event-set">${FD.config.leaderboard.endpoint ? 'Update' : 'Join'}</button></div>
                <p class="muted small">Join a shared leaderboard run by your facilitator (see the README). Leave blank to keep scores on this device.</p></div>
            </section>

            <section class="card" aria-labelledby="s-app"><h2 id="s-app">App &amp; offline</h2>
              <p class="status-line">${FD.icon(offline ? 'check' : 'offline', { size: 20 })}<span>${offline ? 'Ready for offline play. Feature-dle works without a connection.' : 'Offline play is available when the game is hosted (or use the single-file edition).'}</span></p>
              <div class="btn-row">
                ${FD.pwa.deferred ? html`<button class="btn btn-primary" type="button" data-action="pwa-install">${FD.icon('download', { size: 20 })}Install as an app</button>` : html`<span class="muted small">To install, use your browser\u2019s <em>Install app</em> or <em>Add to Home Screen</em> option.</span>`}
              </div></section>

            <section class="card" aria-labelledby="s-data"><h2 id="s-data">Your data</h2>
              <p class="muted">Everything is stored in this browser. Back it up to move to another device, or clear it to start fresh.</p>
              <div class="btn-row">
                <button class="btn btn-ghost" type="button" data-action="data-export">${FD.icon('download', { size: 20 })}Export backup</button>
                <label class="btn btn-ghost" for="import-file">${FD.icon('upload', { size: 20 })}Import backup</label><input id="import-file" class="sr-only" type="file" accept="application/json,.json">
              </div>
              <div class="btn-row">
                <button class="btn btn-ghost" type="button" data-action="reset-player">${FD.icon('refresh', { size: 20 })}Reset ${p.name}</button>
                <button class="btn btn-danger-ghost" type="button" data-action="reset-all">${FD.icon('trash', { size: 20 })}Erase everything</button>
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
          r.onload = () => { const res = FD.store.importJSON(String(r.result)); ui.toast(res.ok ? `Backup imported (${FD.u.plural(res.players, 'player')})` : res.error, { icon: res.ok ? 'check' : 'x' }); if (res.ok) draw(); };
          r.readAsText(file);
        });
      }
      ui.actions['data-export'] = () => { FD.u.download(FD.store.exportJSON(), 'copilot-feature-dle-backup.json', 'application/json'); ui.toast('Backup downloaded', { icon: 'check' }); };
      ui.actions['event-set'] = () => { const v = FD.joinEvent((($('#event-code', main) || {}).value || '').trim()); ui.toast(v ? `Joined event ${v}` : 'Back to device-only scores', { icon: 'check' }); draw(); };
      ui.actions['reset-player'] = async () => { if (await ui.confirm('Reset this player?', `This clears ${FD.store.profile().name}\u2019s stats, streaks, badges and collection. Other players are untouched.`, 'Reset player', true)) { FD.store.resetProfile(); ui.toast('Player reset', { icon: 'check' }); draw(); } };
      ui.actions['reset-all'] = async () => { if (await ui.confirm('Erase everything?', 'This removes every player, all stats, settings and community packs from this device. It can\u2019t be undone (unless you exported a backup).', 'Erase everything', true)) { FD.store.resetAll(); ui.toast('All data erased', { icon: 'check' }); ui.render(); } };
      ui.actions['pwa-install'] = async () => { const d = FD.pwa.deferred; if (!d) return; d.prompt(); try { await d.userChoice; } catch (e) { /* ignore */ } FD.pwa.deferred = null; draw(); };
      draw();
    }
  };
})();
