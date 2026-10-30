/* Copilot Feature-dle · UI kit: delegated actions, router, dialogs, toasts, shell (header / nav / footer), shared components */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, raw, esc, flat, $, $$, mount, announce } = FD.u;
  const ui = (FD.ui = { actions: {} });
  FD.views = {};

  /* ---------- one click handler for every [data-action] ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = ui.actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A' && !el.hasAttribute('data-native')) e.preventDefault();
    fn(el, e);
  });

  /* ---------- toasts + dialogs ---------- */
  ui.toast = (msg, o = {}) => {
    const host = $('#toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast' + (o.kind ? ' toast-' + o.kind : '');
    t.innerHTML = flat(html`${o.icon ? FD.icon(o.icon, { size: 20 }) : ''}<span>${msg}</span>`);
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, o.ms || 3600);
  };

  ui.dialog = ({ title, body, actions = [], cls = '', onClose }) => {
    const d = document.createElement('dialog');
    d.className = 'dlg ' + cls;
    const id = 'dlg-' + Math.random().toString(36).slice(2, 7);
    d.setAttribute('aria-labelledby', id);
    d.innerHTML = flat(html`<div class="dlg-card">
      <header class="dlg-head"><h2 id="${id}">${title}</h2><button class="btn btn-icon btn-ghost" type="button" data-close aria-label="Close dialog">${FD.icon('x')}</button></header>
      <div class="dlg-body">${body}</div>
      ${actions.length ? html`<footer class="dlg-foot">${actions.map((a) => html`<button class="btn ${a.cls || 'btn-ghost'}" type="button" data-dlg="${a.id}">${a.label}</button>`)}</footer>` : ''}
    </div>`);
    document.body.appendChild(d);
    let done = false;
    const end = (v) => { if (done) return; done = true; try { d.close(); } catch (e) { /* already closed */ } d.remove(); if (onClose) onClose(v); };
    d.addEventListener('click', (e) => { if (e.target === d) end(''); });
    d.addEventListener('close', () => end(d.returnValue));
    d.querySelector('[data-close]').addEventListener('click', () => end(''));
    d.querySelectorAll('[data-dlg]').forEach((b) => b.addEventListener('click', () => end(b.dataset.dlg)));
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    return d;
  };
  ui.confirm = (title, message, okLabel = 'Yes', danger = false) => new Promise((res) => {
    ui.dialog({ title, body: html`<p>${message}</p>`, actions: [{ id: 'no', label: 'Cancel' }, { id: 'yes', label: okLabel, cls: danger ? 'btn-danger' : 'btn-primary' }], onClose: (v) => res(v === 'yes') });
  });

  /* ---------- small components ---------- */
  const DIFF_COLOR = { Easy: 'green', Medium: 'yellow', Hard: 'orange', Expert: 'purple' };
  ui.DIFF_COLOR = DIFF_COLOR;

  ui.diffChip = (d) => {
    const n = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 }[d] || 2;
    return html`<span class="chip chip-solid c-${DIFF_COLOR[d] || 'yellow'}" title="Difficulty: ${d}"><span class="dots" aria-hidden="true">${[1, 2, 3, 4].map((i) => html`<i class="${i <= n ? 'on' : ''}"></i>`)}</span>${d}</span>`;
  };
  ui.catChip = (name) => html`<span class="chip c-${FD.data.catColor(name)}"><span class="dot" aria-hidden="true"></span>${name}</span>`;
  ui.tempChip = (t) => {
    const m = { hot: ['flame', 'Hot', 'orange'], warm: ['sun', 'Warm', 'yellow'], cold: ['snow', 'Cold', 'blue-50'], correct: ['check', 'Correct', 'green'], skip: ['bulb', 'Nudge', 'grey-10'] }[t] || ['snow', 'Cold', 'blue-50'];
    return html`<span class="chip chip-solid temp temp-${t}">${FD.icon(m[0], { size: 16 })}${m[1]}</span>`;
  };

  ui.ring = (pct, o = {}) => {
    const { size = 88, stroke = 10, color = 'blue', label = '', sub = '' } = o;
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return html`<div class="ring c-${color}" style="--sz:${size}px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/><circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
      <span class="ring-label"><strong>${label}</strong>${sub ? html`<small>${sub}</small>` : ''}</span></div>`;
  };
  ui.bar = (pct, color = 'blue', label = '') => html`<div class="bar c-${color}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" ${FD.u.attrs({ 'aria-label': label })}><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;

  /* answer / name-shape tiles. lvl = FD.hints.level(n); reveal = show the whole answer (flip) */
  ui.nameTiles = (name, lvl, reveal) => {
    const words = FD.hints.shape(name);
    let idx = 0, label;
    if (reveal) label = name;
    else if (lvl.first) label = 'Starts with ' + words.map((w) => w[0].c.toUpperCase()).join(' and ');
    else if (lvl.lengths) label = 'Word lengths: ' + words.map((w) => w.filter((c) => c.alnum).length).join(', ');
    else label = `${words.length} word${words.length === 1 ? '' : 's'}`;
    return html`<div class="name-tiles" role="img" aria-label="${label}">${words.map((w) => html`<span class="name-word">${w.map((ch, i) => {
      if (!ch.alnum) return html`<span class="tile tile-punct" aria-hidden="true">${ch.c}</span>`;
      const show = reveal || (lvl.first && i === 0);
      return html`<span class="tile ${show ? 'is-on' : ''} ${reveal ? 'is-flip' : ''}" style="--i:${idx++}" aria-hidden="true">${show ? ch.c.toUpperCase() : ''}</span>`;
    })}</span>`)}</div>`;
  };

  /* badge medallion */
  ui.badge = (b, earned, big) => html`<span class="medal ${earned ? 'is-earned' : 'is-locked'} c-${b.color} ${big ? 'medal-lg' : ''}" aria-hidden="true">${FD.icon(earned ? b.icon : 'lock', { size: big ? 34 : 26 })}</span>`;

  ui.stars = (n, max = 3) => html`<span class="stars" role="img" aria-label="${n} of ${max} stars">${Array.from({ length: max }, (_, i) => html`<span class="star ${i < n ? 'on' : ''}">${FD.icon('star', { size: 16 })}</span>`)}</span>`;
  /* mastery: 3 stars = solved with the 1st hint, 2 = by hint 2, 1 = solved */
  ui.mastery = (entry) => (!entry || !entry.solved ? 0 : entry.bestHints <= 1 ? 3 : entry.bestHints <= 2 ? 2 : 1);

  ui.section = (title, body, o = {}) => html`<section class="section ${o.cls || ''}" ${FD.u.attrs({ 'aria-labelledby': o.id })}><div class="section-head"><h2${FD.u.attrs({ id: o.id })}>${title}</h2>${o.aside || ''}</div>${body}</section>`;

  /* ---------- router (hash based: #/daily, #/book/copilot-pages, #/free?tag=security) ---------- */
  const routes = [];
  ui.route = (pattern, view, nav) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([a-z]+)(\?)?/g, (m, k, opt) => { keys.push(k); return opt ? '(?:/([^/]+))?' : '/([^/]+)'; }) + '/?$');
    routes.push({ re, keys, view, nav });
  };
  const parse = () => {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    return { path: path || '/', query };
  };
  ui.go = (path) => { if (('#' + path) === location.hash) render(); else location.hash = '#' + path; };
  ui.current = () => parse();
  let cleanup = null, token = 0;

  async function render() {
    const my = ++token;
    const { path, query } = parse();
    let route = null, params = {};
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m) { route = r; r.keys.forEach((k, i) => { params[k] = m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined; }); break; }
    }
    if (!route) { route = routes[0]; params = {}; }
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    const main = $('#main');
    main.className = 'main';
    main.innerHTML = '';
    const ctx = { params, query, path, setTitle: (t) => { ctx.title = t; } };
    let res;
    try { res = await route.view.render(main, ctx); } catch (e) { console.error(e); main.innerHTML = flat(html`<div class="container section"><div class="card"><h1>Oops, something went wrong</h1><p>Pip tripped over a cable. Try refreshing the page, or head <a href="#/">back home</a>.</p></div></div>`); }
    if (my !== token) { if (typeof res === 'function') res(); return; }
    cleanup = typeof res === 'function' ? res : null;
    const t = ctx.title || route.view.title || '';
    document.title = (t ? t + ' \u00B7 ' : '') + 'Copilot Feature-dle';
    ui.markNav(path);
    const h1 = main.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
    announce((t || 'Home') + ' page');
  }
  ui.render = render;
  window.addEventListener('hashchange', render);

  /* ---------- shell ---------- */
  const NAV = [
    { href: '#/', label: 'Home', icon: 'home', re: /^\/$/ },
    { href: '#/daily', label: 'Daily', icon: 'calendar', re: /^\/daily/ },
    { href: '#/free', label: 'Free play', icon: 'shuffle', re: /^\/(free|speed|team|play|c)(\/|$)/ },
    { href: '#/book', label: 'Feature Book', short: 'Book', icon: 'book', re: /^\/book/ },
    { href: '#/stats', label: 'Stats', icon: 'chart', re: /^\/stats/ },
    { href: '#/leaderboard', label: 'Leaderboard', icon: 'trophy', re: /^\/leaderboard/ },
    { href: '#/about', label: 'About', icon: 'info', re: /^\/about/ }
  ];
  const MORE = [
    { href: '#/stats', label: 'Stats & badges', icon: 'chart' },
    { href: '#/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { href: '#/packs', label: 'Packs & themes', icon: 'package' },
    { href: '#/settings', label: 'Settings', icon: 'sliders' },
    { href: '#/about', label: 'About & how to play', icon: 'info' }
  ];

  ui.markNav = (path) => {
    $$('[data-nav]').forEach((a) => {
      const n = NAV[+a.dataset.nav];
      if (n && n.re.test(path)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };

  function toolsHtml() {
    const p = FD.store.profile(), st = FD.store.settings();
    const streak = FD.store.dailyStreak(), rk = FD.scoring.rank(p.xp);
    return html`
      <a class="tool tool-streak ${streak ? 'is-on' : ''}" href="#/stats" aria-label="Daily streak: ${FD.u.plural(streak, 'day')}. Open stats">${FD.icon('flame', { size: 20 })}<strong>${streak}</strong></a>
      <button class="tool tool-sound" type="button" data-action="sound" aria-pressed="${String(!!st.sound)}" aria-label="Sound effects" title="Sound effects">${FD.icon(st.sound ? 'volume' : 'mute', { size: 20 })}</button>
      <button class="tool tool-player" type="button" data-action="profile" aria-label="Player: ${p.name}, ${rk.rank.name}. Switch player">
        ${FD.avatar(p.name, p.color, 34)}<span class="tool-player-text"><strong>${p.name}</strong><small>${rk.rank.name}</small></span>
      </button>`;
  }

  ui.renderTools = () => { const t = $('#header-tools'); if (t) mount(t, toolsHtml()); };

  ui.renderShell = () => {
    mount($('#site-header'), html`<div class="container header-inner">
      <a class="brand" href="#/" aria-label="Copilot Feature-dle by Engage Squared, home">
        ${FD.logo({ width: 150, cls: 'brand-logo' })}<span class="brand-sep" aria-hidden="true"></span><span class="brand-game" aria-hidden="true">Feature-dle</span>
      </a>
      <nav class="nav" aria-label="Main">${NAV.map((n, i) => html`<a class="nav-link" href="${n.href}" data-nav="${i}">${n.label}</a>`)}</nav>
      <div class="header-tools" id="header-tools"></div>
    </div>`);
    mount($('#bottom-nav'), html`<nav class="bottom-nav" aria-label="Quick navigation">
      ${[0, 1, 2, 3].map((i) => html`<a class="bn-item" href="${NAV[i].href}" data-nav="${i}">${FD.icon(NAV[i].icon, { size: 22 })}<span>${NAV[i].short || NAV[i].label}</span></a>`)}
      <button class="bn-item" type="button" data-action="more">${FD.icon('menu', { size: 22 })}<span>More</span></button>
    </nav>`);
    mount($('#site-footer'), html`<div class="container footer-inner">
      <div class="footer-brand">${FD.logo({ width: 170 })}<p>${FD.tagline()}</p></div>
      <p class="footer-note"><strong>Copilot Feature-dle</strong> is an independent, community-style learning game from Engage Squared. It isn't affiliated with or endorsed by Microsoft. Microsoft, Microsoft 365, Copilot, Teams, Word, Excel, PowerPoint, Outlook, OneNote, SharePoint and other product names are trademarks of the Microsoft group of companies. Your progress lives only on this device.</p>
      <nav class="footer-links" aria-label="Footer"><a href="#/about">About</a><a href="#/packs">Packs</a><a href="#/settings">Settings</a><a href="#/leaderboard">Leaderboard</a></nav>
    </div>`);
    ui.renderTools();
    FD.store.on(ui.renderTools);
  };

  /* ---------- global actions ---------- */
  ui.actions.skip = () => { const m = $('#main'); m.setAttribute('tabindex', '-1'); m.focus(); };
  ui.actions.nav = (el) => ui.go(el.dataset.href);
  ui.actions.sound = () => { const on = !FD.store.settings().sound; FD.store.setSetting('sound', on); if (on) FD.fx.play('tap'); announce('Sound effects ' + (on ? 'on' : 'off')); };
  ui.actions.copy = async (el) => {
    const ok = await FD.u.copyText(el.dataset.copy || '');
    ui.toast(ok ? 'Copied to your clipboard' : 'Could not copy. Select the text and copy it manually.', { icon: ok ? 'check' : 'x' });
  };
  ui.actions.more = () => {
    const d = ui.dialog({
      title: 'More from Feature-dle', cls: 'dlg-sheet',
      body: html`<ul class="more-list">${MORE.map((m) => html`<li><a class="more-link" href="${m.href}" data-close-dlg>${FD.icon(m.icon)}<span>${m.label}</span>${FD.icon('right', { size: 18 })}</a></li>`)}</ul>`
    });
    d.addEventListener('click', (e) => { if (e.target.closest('[data-close-dlg]')) d.close(); });
  };
  ui.actions.profile = () => ui.profileDialog();

  /* ---------- player dialog (also handy for shared laptops at events) ---------- */
  ui.profileDialog = () => {
    const draw = () => {
      const me = FD.store.profile();
      return html`
        <p class="muted">Sharing this device? Everyone gets their own stats, streaks and Feature Book.</p>
        <ul class="player-list">${FD.store.profiles().map((p) => {
          const rk = FD.scoring.rank(p.xp);
          return html`<li><button type="button" class="player-row ${p.id === me.id ? 'is-me' : ''}" data-switch="${p.id}" aria-pressed="${String(p.id === me.id)}">${FD.avatar(p.name, p.color, 40)}<span class="pr-text"><strong>${p.name}</strong><small>${rk.rank.name} \u00B7 ${p.xp} XP</small></span>${p.id === me.id ? html`<span class="chip chip-solid c-green">Playing</span>` : ''}</button></li>`;
        })}</ul>
        <form class="inline-form" data-newplayer><label class="sr-only" for="np-name">New player name</label><input id="np-name" class="input" maxlength="24" placeholder="Add a player (name)" autocomplete="off"><button class="btn btn-primary" type="submit">${FD.icon('plus', { size: 18 })}Add</button></form>
        <form class="inline-form" data-rename><label class="sr-only" for="rn-name">Rename current player</label><input id="rn-name" class="input" maxlength="24" value="${me.name}" autocomplete="off"><button class="btn btn-ghost" type="submit">Rename</button></form>`;
    };
    const d = ui.dialog({ title: 'Who\u2019s playing?', body: draw(), actions: [{ id: 'stats', label: 'Open my stats', cls: 'btn-ghost' }, { id: 'ok', label: 'Done', cls: 'btn-primary' }], onClose: (v) => { if (v === 'stats') ui.go('/stats'); } });
    const body = d.querySelector('.dlg-body');
    const redraw = () => { mount(body, draw()); };
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-switch]'); if (b) { FD.store.switchProfile(b.dataset.switch); redraw(); ui.render(); } });
    body.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.matches('[data-newplayer]')) { const v = $('#np-name', body).value.trim(); if (!v) return; FD.store.createProfile(v); redraw(); ui.render(); ui.toast(`Welcome, ${v}!`, { icon: 'sparkle' }); }
      if (e.target.matches('[data-rename]')) { FD.store.renameProfile(FD.store.profile().id, $('#rn-name', body).value); redraw(); ui.toast('Name updated', { icon: 'check' }); }
    });
  };

  /* ---------- first run ---------- */
  ui.firstRun = () => {
    let input = null;
    const d = ui.dialog({
      title: 'Hi, I\u2019m Pip!', cls: 'dlg-welcome',
      body: html`<div class="welcome">
        <div class="welcome-art">${FD.pip('hello', { size: 132 })}</div>
        <div>
          <p>I\u2019ll give you <strong>five sneaky hints</strong> about a Microsoft Copilot feature. Guess it early for more points, and learn something new every time.</p>
          <ul class="ticks"><li>${FD.icon('check', { size: 18 })}Every miss unlocks an easier hint</li><li>${FD.icon('check', { size: 18 })}Typos are fine \u2013 I\u2019m friendly like that</li><li>${FD.icon('check', { size: 18 })}Collect features, earn badges, climb the ranks</li></ul>
          <form data-welcome><label for="wel-name" class="label">What should we call you? <span class="muted">(optional)</span></label><input id="wel-name" class="input" maxlength="24" placeholder="Your first name" autocomplete="given-name"></form>
        </div></div>`,
      actions: [{ id: 'go', label: 'Let\u2019s play', cls: 'btn-primary btn-lg' }],
      onClose: () => {
        const v = input ? input.value.trim() : '';
        if (v) FD.store.renameProfile(FD.store.profile().id, v);
        FD.store.setOnboarded();
        ui.render();
      }
    });
    input = d.querySelector('#wel-name');
    d.querySelector('form[data-welcome]').addEventListener('submit', (e) => { e.preventDefault(); d.querySelector('[data-dlg="go"]').click(); });
  };

  /* announce earned badges / rank-ups with toasts (used after every game) */
  ui.celebrate = (out) => {
    if (!out) return;
    let delay = 0;
    if (out.levelUp) { setTimeout(() => { ui.toast(`New rank: ${out.levelUp.name}!`, { icon: 'crown', kind: 'good', ms: 5000 }); FD.fx.play('badge'); }, delay); delay += 900; }
    (out.newBadges || []).forEach((b) => { setTimeout(() => { ui.toast(`Badge unlocked: ${b.name}`, { icon: b.icon, kind: 'good', ms: 5000 }); FD.fx.play('badge'); }, delay); delay += 900; });
  };
})();
