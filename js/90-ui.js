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

  /* Clicking the tab you are already on always takes you to that tab's own landing screen, even from the middle of a game or its results (the address does not change, so the
     router would never hear about it): Play goes back to the game mode selector, and a game that was left half-played waits there to be resumed. */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.nav-link, a.bn-item, a.brand');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.getAttribute('href') === location.hash) { e.preventDefault(); ui.render(); }
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

  /* lock: a choice that has to be made. There is no close button, and Esc or a click outside does nothing, so the buttons are the only way out. */
  ui.dialog = ({ title, body, actions = [], cls = '', onClose, lock = false }) => {
    const d = document.createElement('dialog');
    d.className = 'dlg ' + cls;
    const id = 'dlg-' + Math.random().toString(36).slice(2, 7);
    d.setAttribute('aria-labelledby', id);
    d.innerHTML = flat(html`<div class="dlg-card">
      <header class="dlg-head"><h2 id="${id}">${title}</h2>${lock ? '' : html`<button class="btn btn-icon btn-ghost" type="button" data-close aria-label="Close dialog">${FD.icon('x')}</button>`}</header>
      <div class="dlg-body">${body}</div>
      ${actions.length ? html`<footer class="dlg-foot">${actions.map((a) => html`<button class="btn ${a.cls || 'btn-ghost'}" type="button" data-dlg="${a.id}">${a.label}</button>`)}</footer>` : ''}
    </div>`);
    document.body.appendChild(d);
    let done = false;
    const end = (v) => { if (done) return; done = true; try { d.close(); } catch (e) { /* already closed */ } d.remove(); if (onClose) onClose(v); };
    d.addEventListener('click', (e) => { if (e.target === d && !lock) end(''); });
    if (lock) d.addEventListener('cancel', (e) => e.preventDefault());
    d.addEventListener('close', () => end(d.returnValue));
    const x = d.querySelector('[data-close]');
    if (x) x.addEventListener('click', () => end(''));
    d.querySelectorAll('[data-dlg]').forEach((b) => b.addEventListener('click', () => end(b.dataset.dlg)));
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    /* a long message with nothing to tab to still has to be scrollable from the keyboard */
    const scroller = d.querySelector('.dlg-body');
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1 && !scroller.querySelector('a[href], button, input, select, textarea, summary, [tabindex]')) {
      scroller.tabIndex = 0; scroller.setAttribute('role', 'region'); scroller.setAttribute('aria-labelledby', id);
    }
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
  /* The Daily Challenge Speed Bonus clock counts DOWN from 2 minutes: "Speed bonus ends in 85s", then "Speed bonus ended". Anything with the .bonus-live class is kept fresh
     once a second by the page-wide ticker (it reads data-clock, the moment the puzzle was opened, and data-paused, any time the clock was stopped). */
  ui.bonusText = (ms) => {
    const left = FD.scoring.speedWindowMs - Math.max(0, ms);
    return left > 0 ? `Speed bonus ends in ${Math.ceil(left / 1000)}s` : 'Speed bonus ended';
  };
  ui.bonusChip = (startedAt, pausedMs = 0) => html`<span class="chip timer-chip">${FD.icon('timer', { size: 16 })}<span class="bonus-live" data-clock="${startedAt}" data-paused="${pausedMs || 0}">${ui.bonusText(Date.now() - startedAt - (pausedMs || 0))}</span></span>`;
  ui.catChip = (name) => html`<span class="chip c-${FD.data.catColor(name)}"><span class="dot" aria-hidden="true"></span>${name}</span>`;

  /* How the Feature Book describes a feature: Not collected, Spotted, Collected or Mastered (see FD.scoring.bookState). One look for all four, wherever it is shown. */
  ui.STATE_TEXT = { new: 'Not collected', spotted: 'Spotted', collected: 'Collected', mastered: 'Mastered' };
  const STATE_ICON = { new: 'minus', spotted: 'eye', collected: 'check', mastered: 'crown' };
  ui.stateChip = (state, color) => html`<span class="fstate is-${state}${color ? ' c-' + color : ''}">${FD.icon(STATE_ICON[state] || 'minus', { size: 14 })}${ui.STATE_TEXT[state] || ui.STATE_TEXT.new}</span>`;

  /* A layer's icon that fills in like a pie chart as its puzzles are done: Know it (Feature Hunt), Use it (Scenario Match) or Prompt it (Prompt Lab).
     One puzzle done of two is half a pie. The icon is drawn twice, once on the empty part and once (in the fill's own text colour) on the filled part. */
  ui.pie = (kind, done, total, o = {}) => {
    const M = FD.puzzles.META[kind], size = o.size || 28, d = Math.max(0, Math.min(done, total)), pct = total ? Math.round((d / total) * 100) : 0;
    const full = total > 0 && d >= total, icon = FD.icon(M.icon, { size: Math.round(size * 0.58) });
    return html`<span class="pie c-${M.color}${full ? ' is-full' : ''}" style="--p:${pct};--sz:${size}px" title="${M.verb}: ${total ? `${d} of ${total}` : 'nothing to play yet'}" aria-hidden="true"><span class="pie-g">${icon}</span><span class="pie-g pie-top">${icon}</span></span>`;
  };

  /* The guess-feedback chips explain themselves: hover, focus or tap "Same category" or "Same difficulty" to read what the word means.
     The definitions describe the idea only, and read the same whatever the guess was, so they never give the answer away. */
  let infoSeq = 0;
  ui.categoryDef = () => {
    const names = FD.lib.categories.filter((c) => FD.lib.features.some((f) => f.category === c.name)).map((c) => c.name);
    return html`<strong>What is a category?</strong><span class="def-line">Every feature belongs to one family, grouped by where you find it and the job it does.</span><span class="def-tags">${names.map((n) => html`<span>${n}</span> `)}</span>`;
  };
  ui.levelDef = () => {
    const info = FD.config.levelInfo;
    return html`<strong>What is difficulty?</strong><span class="def-line">Every feature has a difficulty for how well known it is.</span><span class="def-levels">${FD.config.difficulties.map((d) => html`<span><b>${d}</b> ${info[d]}.</span> `)}</span>`;
  };
  ui.defChip = (iconName, label, kind) => {
    const id = 'def-' + (++infoSeq);
    return html`<span class="info-wrap def-wrap"><button class="chip chip-def" type="button" data-action="info-toggle" aria-describedby="${id}">${FD.icon(iconName, { size: 14 })}${label}</button><span class="info-pop def-pop" id="${id}" role="tooltip">${kind === 'level' ? ui.levelDef() : ui.categoryDef()}</span></span>`;
  };
  ui.actions['info-toggle'] = (el) => {
    const w = el.closest('.info-wrap'), open = !w.classList.contains('is-open');
    $$('.info-wrap.is-open').forEach((x) => x.classList.remove('is-open'));
    w.classList.remove('is-dismissed');
    if (open) { placeInfo(w); w.classList.add('is-open'); }
  };
  /* keep the bubble on screen, whatever side of the page the chip sits (clientWidth leaves out any scrollbar) */
  const placeInfo = (w) => {
    const b = w.querySelector('.chip-def'), p = w.querySelector('.info-pop');
    if (!b || !p) return;
    const cw = document.documentElement.clientWidth;
    const r = b.getBoundingClientRect(), pw = Math.round(Math.min(320, cw * 0.86));
    const left = Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, cw - pw - 8));
    p.style.width = pw + 'px';
    p.style.setProperty('--pop-x', Math.round(left - r.left) + 'px');
    p.style.setProperty('--arrow-x', Math.round(r.left + r.width / 2 - left) + 'px');
  };
  const infoOf = (e) => (e.target && e.target.closest ? e.target.closest('.info-wrap') : null);
  document.addEventListener('mouseover', (e) => { const w = infoOf(e); if (w) placeInfo(w); });
  document.addEventListener('focusin', (e) => { const w = infoOf(e); if (w) placeInfo(w); });
  /* Esc hides the bubble without moving focus or the pointer (WCAG 1.4.13); it comes back next time you hover or focus */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.info-wrap').forEach((x) => { if (x.classList.contains('is-open') || x.matches(':hover, :focus-within')) { x.classList.remove('is-open'); x.classList.add('is-dismissed'); } });
  });
  const clearDismiss = (e) => { const w = infoOf(e); if (w && !w.contains(e.relatedTarget)) w.classList.remove('is-dismissed'); };
  document.addEventListener('mouseout', clearDismiss);
  document.addEventListener('focusout', clearDismiss);
  document.addEventListener('click', (e) => { if (!e.target.closest('.info-wrap')) $$('.info-wrap.is-open').forEach((x) => x.classList.remove('is-open')); });

  /* range sliders paint their filled part from --fill */
  ui.rangeFill = (el) => { const min = +el.min || 0, max = +el.max || 100; el.style.setProperty('--fill', (max > min ? ((+el.value - min) / (max - min)) * 100 : 0).toFixed(1) + '%'); };
  document.addEventListener('input', (e) => { if (e.target && e.target.matches && e.target.matches('input.range')) ui.rangeFill(e.target); });

  /* ---------- multi-select dropdown: a button that opens a list of tick boxes ----------
     For choosing several categories (or features) at once. Nothing ticked means "all" (no limit): ticking "All ..." clears the others, and ticking the last one off brings
     "All ..." back. The button says what is chosen: the names of one or two, or a count ("3 categories"). It is made of real checkboxes, so it works with a keyboard and a
     screen reader: Enter, Space or Down opens it, Tab and the arrow keys move through the boxes, Esc closes it (and focus goes back to the button).
     Options are { value, label, group? }; a group name puts a heading above its options. Everything else is looked after here, so a form only has to read ui.msel.values(root)
     when a 'change' event comes up from it. */
  const mselRows = (options, selected, allLabel) => {
    const sel = new Set(selected), row = (o) => html`<label class="msel-opt"><input type="checkbox" value="${o.value}"${FD.u.attrs({ checked: sel.has(o.value) })}><span>${o.label}</span></label>`;
    const groups = [];
    options.forEach((o) => { const name = o.group || '', last = groups[groups.length - 1]; if (last && last.name === name) last.items.push(o); else groups.push({ name, items: [o] }); });
    return html`<label class="msel-opt msel-all"><input type="checkbox" data-all${FD.u.attrs({ checked: !selected.length })}><span>${allLabel}</span></label>${groups.map((g) => (g.name ? html`<fieldset class="msel-set"><legend>${g.name}</legend>${g.items.map(row)}</fieldset>` : html`${g.items.map(row)}`))}`;
  };
  const mselBoxes = (root) => Array.from(root.querySelectorAll('.msel-panel input[type="checkbox"]'));
  const mselNames = (root) => mselBoxes(root).filter((b) => !b.hasAttribute('data-all') && b.checked).map((b) => b.nextElementSibling.textContent);
  function mselRefresh(root) {
    const names = mselNames(root), btn = root.querySelector('.msel-btn');
    root.querySelector('.msel-text').textContent = !names.length ? root.dataset.all : names.length <= 2 ? names.join(', ') : `${names.length} ${root.dataset.noun}`;
    btn.title = names.length > 1 ? names.join(', ') : '';
    root.dataset.count = String(names.length);
  }
  const mselClose = (root, back) => {
    if (!root.classList.contains('is-open')) return;
    root.classList.remove('is-open');
    root.querySelector('.msel-panel').hidden = true;
    const btn = root.querySelector('.msel-btn'); btn.setAttribute('aria-expanded', 'false');
    if (back) btn.focus();
  };
  const mselOpen = (root, focus) => {
    if (root.classList.contains('is-disabled')) return;
    $$('.msel.is-open').forEach((r) => { if (r !== root) mselClose(r); });
    root.classList.add('is-open');
    const panel = root.querySelector('.msel-panel'); panel.hidden = false;
    root.querySelector('.msel-btn').setAttribute('aria-expanded', 'true');
    if (focus) { const first = mselBoxes(root).find((b) => b.checked) || mselBoxes(root)[0]; if (first) first.focus({ preventScroll: true }); }
    panel.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  };
  ui.msel = {
    /* spec: { id, label, options, selected, allLabel ("All categories"), noun ("categories"), hint (shown beside the label while it is switched off), disabled } */
    html(o) {
      const have = o.options.map((x) => x.value), selected = FD.u.selList(o.selected).filter((v) => have.includes(v));
      const names = o.options.filter((x) => selected.includes(x.value)).map((x) => x.label);
      const text = !names.length ? o.allLabel : names.length <= 2 ? names.join(', ') : `${names.length} ${o.noun}`;
      return html`<div class="field msel${o.disabled ? ' is-disabled' : ''}" id="${o.id}" data-msel data-all="${o.allLabel}" data-noun="${o.noun}" data-count="${names.length}">
        <label id="${o.id}-l" for="${o.id}-b">${o.label}${o.hint ? html` <span class="label-hint" id="${o.id}-hint"${FD.u.attrs({ hidden: !o.disabled })}>${o.hint}</span>` : ''}</label>
        <button class="select msel-btn" type="button" id="${o.id}-b" aria-haspopup="true" aria-expanded="false" aria-controls="${o.id}-p"${FD.u.attrs({ disabled: !!o.disabled })}><span class="msel-text">${text}</span></button>
        <div class="msel-panel" id="${o.id}-p" role="group" aria-labelledby="${o.id}-l" tabindex="-1" hidden>${mselRows(o.options, selected, o.allLabel)}</div>
      </div>`;
    },
    /* the values ticked ([] means all) */
    values(root) { return mselBoxes(root).filter((b) => !b.hasAttribute('data-all') && b.checked).map((b) => b.value); },
    /* new options (a feature list that follows the categories chosen), keeping whichever of the old choices are still on offer */
    setOptions(root, options, selected) {
      const have = options.map((x) => x.value), keep = FD.u.selList(selected == null ? ui.msel.values(root) : selected).filter((v) => have.includes(v));
      root.querySelector('.msel-panel').innerHTML = flat(mselRows(options, keep, root.dataset.all));
      mselRefresh(root);
    },
    /* switched off (and, while it is, the little hint beside its label says why) or back on */
    setDisabled(root, off) {
      root.classList.toggle('is-disabled', !!off);
      root.querySelector('.msel-btn').disabled = !!off;
      const hint = root.querySelector('.label-hint'); if (hint) hint.hidden = !off;
      if (off) mselClose(root);
    },
    refresh: mselRefresh
  };
  /* the "All" box and the others stay in step. This listens before any form does (the capture phase), so a form always reads the settled choice. */
  document.addEventListener('change', (e) => {
    const box = e.target, root = box && box.closest ? box.closest('.msel') : null;
    if (!root || box.type !== 'checkbox') return;
    const all = root.querySelector('input[data-all]'), others = mselBoxes(root).filter((b) => b !== all);
    if (box === all) { if (all.checked) others.forEach((b) => { b.checked = false; }); else if (!others.some((b) => b.checked)) all.checked = true; }
    else all.checked = !others.some((b) => b.checked);
    mselRefresh(root);
  }, true);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.msel-btn');
    if (btn) { const root = btn.closest('.msel'); if (root.classList.contains('is-open')) mselClose(root); else mselOpen(root, e.detail === 0); return; } /* a keyboard press (detail 0) moves into the list, a mouse click leaves focus on the button */
    $$('.msel.is-open').forEach((r) => { if (!r.contains(e.target)) mselClose(r); });
  });
  document.addEventListener('focusout', (e) => { const r = e.target.closest && e.target.closest('.msel.is-open'); if (r && !r.contains(e.relatedTarget)) mselClose(r); });
  document.addEventListener('keydown', (e) => {
    const root = e.target.closest && e.target.closest('.msel'); if (!root) return;
    const open = root.classList.contains('is-open');
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); mselClose(root, true); return; }
    if (e.target.classList.contains('msel-btn')) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); mselOpen(root, true); } return; }
    if (!open || e.target.type !== 'checkbox') return;
    const boxes = mselBoxes(root), i = boxes.indexOf(e.target);
    const to = e.key === 'ArrowDown' ? (i + 1) % boxes.length : e.key === 'ArrowUp' ? (i - 1 + boxes.length) % boxes.length : e.key === 'Home' ? 0 : e.key === 'End' ? boxes.length - 1 : -1;
    if (to >= 0) { e.preventDefault(); boxes[to].focus(); }
  });

  ui.tempChip = (t) => {
    const m = { hot: ['flame', 'Hot', 'orange'], warm: ['sun', 'Warm', 'yellow'], cold: ['snow', 'Cold', 'blue-50'], correct: ['check', 'Correct', 'green'], skip: ['bulb', 'Nudge', 'grey-10'], time: ['timer', 'Time\u2019s up', 'grey-10'] }[t] || ['snow', 'Cold', 'blue-50'];
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

  /* The round tracker: one line, the same in every game of rounds (Free Play, Feature Hunt, Scenario Match, Prompt Lab) and in Packs, and always in the same place, under the heading.
     It says which round you are on in plain words ("Round 2 of 5"; a pack counts puzzles, so it says "Puzzle 2 of 46") and, where a game keeps score, the points so far. Nothing else
     in the heading says the round. o = { noun, n, total, points } (leave points out when there is no running score). */
  const trackPoints = (p) => html`<strong>${p}</strong> ${p === 1 ? 'point' : 'points'}`;
  ui.roundTracker = (o) => html`<div class="round-track" id="round-track"><p class="rt-n">${o.noun || 'Round'} ${o.n} of ${o.total}</p>${o.points == null ? '' : html`<p class="rt-pts">${trackPoints(o.points)}</p>`}</div>`;
  ui.setRoundPoints = (root, p) => { const el = root && root.querySelector('#round-track .rt-pts'); if (el) el.innerHTML = flat(trackPoints(p)); };
  /* A bar with two fills, for features. The grey track is every feature, the striped fill the ones collected (at least one puzzle done) and the solid fill the ones mastered (every
     puzzle done). Mastered is part of collected, so the solid fill sits over the start of the striped one and is never added to it. The bar is only a picture: the numbers beside it
     say the same in words, so it is hidden from screen readers. */
  ui.nbar = (have, mastered, total, color = 'blue') => {
    const pct = (n) => (total > 0 ? Math.round(Math.max(0, Math.min(100, (n / total) * 100)) * 10) / 10 : 0);
    return html`<span class="nbar c-${color}" aria-hidden="true"><span class="nbar-have" style="width:${pct(have)}%"></span><span class="nbar-done" style="width:${pct(Math.min(mastered, have))}%"></span></span>`;
  };

  /* answer / name-shape tiles. lvl = FD.hints.level(n); reveal = show the whole answer (flip).
     --ml is the longest word's tile count, so a narrow card (Pip's extras) can shrink its tiles to fit instead of growing wider than its column. */
  ui.nameTiles = (name, lvl, reveal) => {
    const words = FD.hints.shape(name);
    let idx = 0, label;
    if (reveal) label = name;
    else if (lvl.first) label = 'Starts with ' + words.map((w) => w[0].c.toUpperCase()).join(' and ');
    else label = 'Word lengths: ' + words.map((w) => w.filter((c) => c.alnum).length).join(', ');
    const longest = Math.max(1, ...words.map((w) => w.length));
    return html`<div class="name-tiles" role="img" aria-label="${label}" style="--ml:${longest}">${words.map((w) => html`<span class="name-word">${w.map((ch, i) => {
      if (!ch.alnum) return html`<span class="tile tile-punct" aria-hidden="true">${ch.c}</span>`;
      const show = reveal || (lvl.first && i === 0);
      return html`<span class="tile ${show ? 'is-on' : ''} ${reveal ? 'is-flip' : ''}" style="--i:${idx++}" aria-hidden="true">${show ? ch.c.toUpperCase() : ''}</span>`;
    })}</span>`)}</div>`;
  };

  /* badge medallion */
  ui.badge = (b, earned, big) => html`<span class="medal ${earned ? 'is-earned' : 'is-locked'} c-${b.color} ${big ? 'medal-lg' : ''}" aria-hidden="true">${FD.icon(earned ? b.icon : 'lock', { size: big ? 34 : 26 })}</span>`;

  ui.section = (title, body, o = {}) => html`<section class="section ${o.cls || ''}" ${FD.u.attrs({ 'aria-labelledby': o.id })}><div class="section-head"><h2${FD.u.attrs({ id: o.id })}>${title}</h2>${o.aside || ''}</div>${body}</section>`;

  /* ---------- router (hash based: #/daily, #/book/copilot-pages, #/pack/wave-2) ---------- */
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
    /* when this copy of the game asks everyone to sign in, nobody sees a screen until they have */
    if (FD.auth && FD.auth.gated() && FD.views.gate) { route = { view: FD.views.gate, keys: [] }; params = {}; }
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
    { href: '#/free', label: 'Play', icon: 'shuffle', re: /^\/(hunt|match|prompts|free|speed|packs|pack|team|play|c)(\/|$)/ },
    { href: '#/book', label: 'Feature Book', short: 'Book', icon: 'book', re: /^\/(book|ask)(\/|$)/ },
    { href: '#/stats', label: 'Stats', icon: 'chart', re: /^\/stats/ },
    { href: '#/leaderboard', label: 'Leaderboard', icon: 'trophy', re: /^\/leaderboard/ },
    { href: '#/about', label: 'About', icon: 'info', re: /^\/about/ }
  ];
  /* the phone's "More" sheet: the bottom bar has Home, Daily, Play and Feature Book (every game mode is on the Play tab), so only the rest is here */
  const MORE = [
    { href: '#/stats', label: 'Stats & badges', icon: 'chart' },
    { href: '#/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { href: '#/settings', label: 'Settings', icon: 'sliders' },
    { href: '#/about', label: 'About & how to play', icon: 'info' }
  ];

  ui.markNav = (path) => {
    $$('[data-nav]').forEach((a) => {
      const n = NAV[+a.dataset.nav];
      if (n && n.re.test(path)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };

  /* the top bar is just the sound switch and your profile: the Daily streak lives on the home tile and the stats page.
     A guest who could sign in sees a Microsoft sign-in button where the profile would be. */
  function toolsHtml() {
    const p = FD.store.profile(), st = FD.store.settings();
    const rk = FD.scoring.rank(p.xp);
    const sound = html`<button class="tool tool-sound" type="button" data-action="sound" aria-pressed="${String(!!st.sound)}" aria-label="Sound effects" title="Sound effects">${FD.icon(st.sound ? 'volume' : 'mute', { size: 20 })}</button>`;
    if (!p.account && FD.auth && FD.auth.available()) {
      return html`${sound}<button class="tool tool-player tool-signin" type="button" data-action="sign-in" aria-label="Sign in with Microsoft. You are playing as a guest." title="Sign in with Microsoft">${FD.msLogo(24)}<span class="tool-player-text"><strong>Sign in</strong><small>Playing as a guest</small></span></button>`;
    }
    return html`${sound}
      <a class="tool tool-player" href="#/stats" aria-label="Your profile: ${p.name}, ${rk.rank.name}. Open your stats">
        ${FD.avatar(p.name, p.color, 28, rk.rank.id)}<span class="tool-player-text"><strong>${p.name}</strong><small>${rk.rank.name}</small></span>
      </a>`;
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
      <p class="footer-note"><strong>Copilot Feature-dle</strong> is an independent, community-style learning game from Engage Squared. It isn't affiliated with or endorsed by Microsoft. Microsoft, Microsoft 365, Copilot, Teams, Word, Excel, PowerPoint, Outlook, OneNote, SharePoint and other product names are trademarks of the Microsoft group of companies.</p>
      <nav class="footer-links" aria-label="Footer"><a href="#/about">About</a><button class="link-btn" type="button" data-action="changelog">What\u2019s new</button><a href="#/settings">Settings</a></nav>
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
    const guest = !FD.store.account() && FD.auth && FD.auth.available();
    const d = ui.dialog({
      title: 'More from Feature-dle', cls: 'dlg-sheet',
      body: html`${guest ? html`<div class="more-signin"><p class="muted small">Playing as a guest. Sign in to put your name on the leaderboard.</p>${FD.account.button({ cls: 'btn-ms-block' })}</div>` : ''}<ul class="more-list">${MORE.map((m) => html`<li><a class="more-link" href="${m.href}" data-close-dlg>${FD.icon(m.icon)}<span>${m.label}</span>${FD.icon('right', { size: 18 })}</a></li>`)}</ul>`
    });
    d.addEventListener('click', (e) => { if (e.target.closest('[data-close-dlg]') || e.target.closest('[data-action="sign-in"]')) d.close(); });
  };

  /* ---------- player profile (opened from the leaderboard) ---------- */
  ui.profileDialog = (pl) => {
    /* a profile shows a player's rank and four numbers: no XP, so nobody can read off how close they are to the next rank */
    const rk = FD.scoring.rank(pl.xp || 0);
    const stat = (label, value) => html`<div class="pf-stat"><strong>${value}</strong><span>${label}</span></div>`;
    return ui.dialog({
      title: pl.name, cls: 'dlg-profile',
      body: html`<div class="pf-head">${FD.avatar(pl.name, pl.color, 84, rk.rank.id)}
          <div class="pf-who"><p class="pf-rank">${FD.icon('crown', { size: 18 })}<strong>${rk.rank.name}</strong></p>
            ${pl.you ? html`<span class="chip chip-solid c-blue">That\u2019s you</span>` : ''}</div></div>
        <div class="pf-grid">
          ${stat('Longest Daily streak', html`${pl.maxStreak || 0}<small> ${pl.maxStreak === 1 ? 'day' : 'days'}</small>`)}${stat('Total score', pl.totalScore || 0)}
          ${stat('Puzzles played', pl.played || 0)}${stat('Features mastered', pl.mastered || 0)}
        </div>`
    });
  };

  /* what each way to play says about itself: the Play tab headers, the Home tiles and Pip's welcome all read these, so they never drift apart */
  ui.MODE_TEXT = {
    free: 'Mix and match game modes and play your way.',
    hunt: 'Read the hints and guess which Copilot feature they describe.',
    match: 'Read a work scenario and choose the Copilot feature that fits best',
    prompts: 'Read the scenario and choose the strongest prompt for the job.',
    packs: 'Curated bundles that mix all three game modes together.',
    book: 'Explore every Copilot feature and learn what it is, when to use it and how.'
  };

  /* ---------- welcome: the first time someone opens the game (no name to type: the player is "Player" until sign-in arrives) ---------- */
  const WELCOME_ITEMS = [
    ['calendar', 'Daily Challenge', 'A new puzzle every weekday, with the same challenge for everyone', 'yellow'],
    ['shuffle', 'Free Play', ui.MODE_TEXT.free, 'orange'],
    ['search', 'Feature Hunt', ui.MODE_TEXT.hunt, 'blue'],
    ['puzzle', 'Scenario Match', ui.MODE_TEXT.match, 'purple'],
    ['flask', 'Prompt Lab', ui.MODE_TEXT.prompts, 'blue-50'],
    ['package', 'Packs', ui.MODE_TEXT.packs, 'red'],
    ['book', 'Feature Book', ui.MODE_TEXT.book, 'green']
  ];
  ui.welcome = (o = {}) => {
    /* only a brand-new player has nothing to catch up on in What's new: someone who clicks Pip to hear it again still gets their update popup */
    const first = !FD.store.onboarded();
    return ui.dialog({
      title: 'Hi, I\u2019m Pip!', cls: 'dlg-wide dlg-welcome',
      body: html`<div class="welcome">
        <div class="welcome-art">${FD.pip('hello', { size: 120 })}</div>
        <div class="welcome-intro">
          <p class="welcome-lede">I\u2019ll help you get to know Microsoft Copilot three ways: <strong>Know it</strong>, <strong>Use it</strong> and <strong>Prompt it</strong>. Answer early for more points, and learn something new every time.</p>
        </div>
      </div>
      <h3 class="welcome-h">Here\u2019s what you can do</h3>
      <ul class="welcome-grid">${WELCOME_ITEMS.map(([icon, name, text, color]) => html`<li class="welcome-item c-${color}"><span class="welcome-ic" aria-hidden="true">${FD.icon(icon, { size: 22 })}</span><div><strong>${name}</strong><span>${text}</span></div></li>`)}</ul>
      <p class="welcome-foot">${FD.icon('crown', { size: 18 })}<span>Earn XP and badges as you go, and climb from ${FD.config.ranks[0].name} to ${FD.config.ranks[FD.config.ranks.length - 1].name}.</span></p>
      ${FD.auth && FD.auth.available() && !FD.store.account() ? html`<div class="welcome-signin"><div><strong>Want your name on the leaderboard?</strong><span>Sign in with your Microsoft account. It only takes a few seconds, and you can always play as a guest instead.</span></div>${FD.account.button()}</div>` : ''}`,
      actions: [{ id: 'go', label: 'Let\u2019s play', cls: 'btn-primary btn-lg' }],
      onClose: () => {
        FD.store.setOnboarded();
        const t = FD.changelog && FD.changelog.token();
        if (first && t) FD.store.setChangelogSeen(t);
        if (o.afterClose) o.afterClose();
      }
    });
  };
  /* Pip on the home screen: click (or press Enter) to hear the welcome again */
  ui.actions.welcome = () => {
    if (document.querySelector('dialog.dlg-welcome[open]')) return;
    /* saying hello to Pip again earns a badge (announced once the popup is closed, so the toast isn't hidden behind it) */
    ui.welcome({ afterClose: () => ui.celebrate({ newBadges: FD.store.bump('pipHellos') }) });
  };

  /* ---------- What's new: data/changelog.json is the one place to edit (see the README) ---------- */
  const fmtLongDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? FD.u.fmtDateLong(`${m[1]}-${m[2]}-${m[3]}`).replace(/^\w+ /, '') + ' ' + m[1] : String(s || ''); };
  const fmtMonth = (s) => { const m = /^(\d{4})-(\d{2})/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''; };
  ui.changelog = () => {
    const c = FD.changelog && FD.changelog.data;
    if (!c) { ui.toast('What\u2019s new isn\u2019t available right now.', { icon: 'x' }); return null; }
    const list = (items) => html`<ul class="cl-list">${items.map((it) => html`<li><strong>${it.title}</strong>${it.text ? html`<span>${it.text}</span>` : ''}</li>`)}</ul>`;
    const ms = (c.microsoft || []).map((it) => html`<li><div class="cl-ms-top"><strong>${it.title}</strong>${it.date ? html`<span class="chip">${fmtMonth(it.date)}</span>` : ''}</div>${it.text ? html`<span>${it.text}</span>` : ''}${it.link && /^https:\/\//i.test(it.link) ? html`<a href="${it.link}" target="_blank" rel="noopener noreferrer">${it.linkLabel || 'Read more'}<span class="sr-only"> (opens in a new tab)</span></a>` : ''}</li>`);
    const history = (c.history || []);
    const msHead = html`<h3 id="cl-ms">${FD.icon('agent', { size: 20 })}Microsoft updates</h3>`;
    return ui.dialog({
      title: 'What\u2019s new', cls: 'dlg-wide dlg-changelog',
      body: html`<div class="cl">
        <p class="cl-ver"><span class="chip chip-solid c-blue">Version ${c.version}</span><span class="muted">${fmtLongDate(c.date)}</span></p>
        ${c.intro ? html`<p class="lede cl-intro">${c.intro}</p>` : ''}
        <section aria-labelledby="cl-game"><h3 id="cl-game">${FD.icon('sparkle', { size: 20 })}Game updates</h3>${list(c.game || [])}</section>
        ${ms.length ? html`<section aria-labelledby="cl-ms">${msHead}<ul class="cl-list cl-ms">${ms}</ul></section>` : c.microsoftEmpty ? html`<section aria-labelledby="cl-ms">${msHead}<p class="cl-empty">${c.microsoftEmpty}</p></section>` : ''}
        ${history.length ? html`<details class="cl-history"><summary>Earlier versions</summary>${history.map((h) => html`<div class="cl-old"><h4>Version ${h.version} <small>${fmtLongDate(h.date)}</small></h4><ul>${(h.notes || []).map((n) => html`<li>${n}</li>`)}</ul></div>`)}</details>` : ''}
      </div>`,
      actions: [{ id: 'ok', label: 'Got it', cls: 'btn-primary' }],
      onClose: () => FD.store.setChangelogSeen(FD.changelog.token())
    });
  };
  ui.actions.changelog = () => ui.changelog();

  /* ---------- rank-up celebration (held back during a game of rounds so it doesn't interrupt the game) ---------- */
  let pendingRank = null, holdRank = false;
  /* a game that has several rounds (Free Play, Feature Hunt, Scenario Match, Prompt Lab) holds a rank-up until it is over or you leave it; letting go shows it a moment later, once the next screen is up */
  ui.holdRankUp = (on) => { holdRank = !!on; if (!on && pendingRank) setTimeout(ui.flushRankUp, 450); };
  ui.queueRankUp = (rank) => { if (!pendingRank || rank.xp > pendingRank.xp) pendingRank = rank; if (!holdRank) setTimeout(ui.flushRankUp, 650); };
  ui.flushRankUp = () => {
    if (!pendingRank || holdRank) return;
    const rank = pendingRank; pendingRank = null;
    const p = FD.store.profile(), rk = FD.scoring.rank(p.xp);
    FD.fx.confetti({ count: 260 }); FD.fx.play('badge'); FD.fx.haptic([30, 40, 60]);
    announce(`Rank up! You are now ${rank.name}.`);
    ui.dialog({
      title: 'Rank up!', cls: 'dlg-rankup',
      body: html`<div class="rankup">
        <div class="rankup-art">${FD.pip('cheer', { size: 128 })}<span class="rankup-avatar">${FD.avatar(p.name, p.color, 88, rank.id)}</span></div>
        <p class="rankup-lead">You\u2019ve reached</p>
        <h3 class="rankup-name">${rank.name}</h3>
        <p class="muted">${rk.next ? html`${rk.toNext} XP to <strong>${rk.next.name}</strong>. Keep going!` : 'You\u2019re at the very top. Brilliant!'}</p>
      </div>`,
      actions: [{ id: 'ok', label: 'Keep going', cls: 'btn-primary btn-lg' }]
    });
  };

  /* announce earned badges / rank-ups after every game */
  ui.celebrate = (out) => {
    if (!out) return;
    let delay = 0;
    if (out.levelUp) ui.queueRankUp(out.levelUp);
    (out.newBadges || []).forEach((b) => { setTimeout(() => { ui.toast(`Badge unlocked: ${b.name}`, { icon: b.icon, kind: 'good', ms: 5000 }); FD.fx.play('badge'); }, delay); delay += 900; });
  };
})();
