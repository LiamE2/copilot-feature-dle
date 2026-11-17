/* Copilot Feature-dle · account screens: the "Sign in with Microsoft" button, the account card in Settings, the sign-in gate,
   and the "bring your progress with you?" question. The sign-in itself (the protocol) lives in 57-auth.js. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, plural } = FD.u;
  const ui = FD.ui;

  const acct = (FD.account = {});

  /* Microsoft's own button: their logo and wording, in their light colours (Microsoft's "Sign in with Microsoft" branding guidelines) */
  acct.button = (o = {}) => html`<button class="btn-ms ${o.cls || ''}" type="button" data-action="sign-in">${FD.msLogo(21)}<span>${o.label || 'Sign in with Microsoft'}</span></button>`;
  /* text only: Microsoft's full-colour logo is for light backgrounds, and the Stats header is blue */
  acct.tag = () => (FD.store.account() ? html`<span class="ms-tag">Microsoft account</span>` : '');

  const REASONS = {
    offline: 'You\u2019re offline. Connect to the internet to sign in.',
    storage: 'Your browser isn\u2019t letting this page keep a note for a moment, which sign-in needs. Check that private browsing or strict blocking isn\u2019t on.',
    crypto: 'Your browser couldn\u2019t prepare a secure sign-in. Try a current browser.',
    unconfigured: 'Microsoft sign-in isn\u2019t switched on for this copy of Feature-dle.',
    file: 'Microsoft sign-in needs the game to be served from a web address, not opened as a file.',
    insecure: 'Microsoft sign-in needs a secure (https) address.'
  };
  ui.actions['sign-in'] = async (el) => {
    /* from the welcome message: that counts as having met Pip, so it isn't shown again on the way back */
    const dlg = el && el.closest ? el.closest('dialog.dlg-welcome') : null;
    if (dlg) {
      if (!FD.store.onboarded()) { FD.store.setOnboarded(); const t = FD.changelog && FD.changelog.token(); if (t) FD.store.setChangelogSeen(t); }
      dlg.close();
    }
    const r = await FD.auth.signIn();
    if (!r.ok) ui.toast(REASONS[r.reason] || 'Couldn\u2019t start sign-in. Please try again.', { icon: 'x', ms: 6000 });
  };
  ui.actions['sign-out'] = async () => {
    if (!(await ui.confirm('Sign out?', 'Your progress stays saved on this device. Sign in again any time to carry on where you left off, or play as a guest in the meantime.', 'Sign out'))) return;
    FD.auth.signOut();
    ui.toast('Signed out. You\u2019re playing as a guest.', { icon: 'check' });
    ui.render();
  };

  /* ---------- the card in Settings ---------- */
  acct.card = () => {
    const p = FD.store.profile(), a = p.account, rk = FD.scoring.rank(p.xp);
    if (a) {
      return html`<section class="card" aria-labelledby="s-acct"><h2 id="s-acct">Your account</h2>
        <div class="acct-who">${FD.avatar(p.name, p.color, 52, rk.rank.id)}
          <div class="acct-text"><strong>${a.name || p.name}</strong>${a.email ? html`<span>${a.email}</span>` : ''}<span class="ms-tag">${FD.msLogo(14)}Signed in with Microsoft</span></div></div>
        <p class="muted">Your progress is saved on this device under this account. Sign out to hand the game to someone else.</p>
        <div class="btn-row"><button class="btn btn-ghost" type="button" data-action="sign-out">${FD.icon('x', { size: 20 })}Sign out</button></div></section>`;
    }
    if (FD.auth.available()) {
      return html`<section class="card" aria-labelledby="s-acct"><h2 id="s-acct">Your account</h2>
        <p><strong>You\u2019re playing as a guest.</strong> Sign in with your Microsoft account to put your name on the leaderboard. Your progress stays on this device.</p>
        <div class="btn-row">${acct.button()}</div></section>`;
    }
    const why = FD.auth.why(), uri = FD.auth.redirectUri();
    return html`<section class="card" aria-labelledby="s-acct"><h2 id="s-acct">Your account</h2>
      <p><strong>You\u2019re playing as a guest.</strong> ${REASONS[why] || REASONS.unconfigured} Your progress and name stay on this device.</p>
      <details class="acct-setup"><summary>Setting this up? Here\u2019s what to do</summary>
        ${why === 'unconfigured' ? html`<ol>
          <li>Register an app in Microsoft Entra ID, as a <em>Single-page application</em>.</li>
          <li>Add this address as its redirect URI: <code id="acct-uri">${uri}</code> <button class="btn btn-ghost btn-sm" type="button" data-action="copy" data-copy="${uri}">${FD.icon('copy', { size: 16 })}Copy</button></li>
          <li>Paste the app\u2019s Application (client) ID into <code>auth.clientId</code> in <code>js/05-config.js</code>.</li></ol><p class="muted small">The README has the full steps, under \u201CMicrosoft sign-in\u201D.</p>`
          : html`<p class="small">${REASONS[why]} The README explains how to host the game.</p>`}
      </details></section>`;
  };

  /* a small invitation for guests on the Stats and Leaderboard screens */
  acct.note = (text) => (FD.store.account() || !FD.auth.available() ? '' : html`<div class="acct-note"><span>${FD.icon('user', { size: 20 })}<span>${text}</span></span>${acct.button({ cls: 'btn-ms-sm' })}</div>`);

  /* ---------- a brand-new account on a device that already holds a guest's progress ---------- */
  acct.askAdopt = (display, guest) => new Promise((resolve) => {
    const s = FD.scoring.summary(guest, FD.lib), played = s.played;
    ui.dialog({
      title: `Welcome, ${FD.auth.firstName(display)}!`, cls: 'dlg-wide', lock: true,
      body: html`<p>There\u2019s progress on this device from before you signed in:</p>
        <div class="adopt-card">${FD.avatar(guest.name, guest.color, 52, s.rank.rank.id)}
          <div><strong>${guest.name}</strong><span>${s.rank.rank.name} \u00B7 ${guest.xp} XP</span><span>${plural(s.collected, 'feature')} collected \u00B7 ${plural(played, 'puzzle')} played</span></div></div>
        <p><strong>Would you like to add it to your Microsoft account?</strong></p>
        <p class="muted small">If you start fresh instead, that progress stays on this device for the guest player, and nothing is lost.</p>`,
      actions: [{ id: 'fresh', label: 'Start fresh' }, { id: 'adopt', label: 'Add my progress', cls: 'btn-primary' }],
      onClose: (v) => resolve(v === 'adopt' ? 'adopt' : 'fresh')
    });
  });

  /* ---------- the friendly gate (only when config.auth.required is on) ---------- */
  FD.views.gate = {
    title: 'Sign in',
    render(main) {
      main.innerHTML = flat(html`<div class="container hub"><section class="card speed-summary gate" aria-labelledby="gate-h">
        <div class="ss-top">${FD.pip('hello', { size: 130 })}<div><p class="eyebrow">Welcome</p><h1 id="gate-h">Sign in to play</h1>
          <p class="lede">Feature-dle uses your Microsoft account to put your name on the leaderboard and keep your progress with you.</p></div></div>
        <div class="btn-row">${acct.button()}</div>
        <p class="muted small">We only ask Microsoft for your name and email address. Your progress stays on this device.</p>
      </section></div>`);
    }
  };
})();
