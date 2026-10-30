/* Copilot Feature-dle · result screen + Copilot Learning Mode */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, raw, esc, flat, $ } = FD.u;
  const ui = FD.ui;

  const WIN_LINES = { 1: ['Wow \u2013 first hint!', 'You sniffed that one out straight away.'], 2: ['Brilliant!', 'Two hints and you had it.'], 3: ['Nailed it!', 'Right on the money.'], 4: ['Nice work!', 'A little tricky, but you got there.'], 5: ['Phew, just in time!', 'The last hint came through for you.'] };
  const LOSS_LINES = ['So close!', 'Not this time \u2013 but now you know it for next time.'];

  /* ---------- Copilot Learning Mode ---------- */
  function learn(f, o = {}) {
    const cards = [];
    if (f.description) cards.push(html`<article class="learn-card c-blue"><h3>${FD.icon('bulb')}What it does</h3><p>${f.description}</p></article>`);
    if (f.why) cards.push(html`<article class="learn-card c-purple"><h3>${FD.icon('target')}Why it matters</h3><p>${f.why}</p></article>`);
    if (f.useCases.length) cards.push(html`<article class="learn-card c-orange learn-wide"><h3>${FD.icon('users')}Real use cases</h3><ol class="usecases">${f.useCases.slice(0, 3).map((u, i) => html`<li><span class="uc-n" aria-hidden="true">${i + 1}</span><div>${u.title ? html`<strong>${u.title}</strong>` : ''}<p>${u.text}</p></div></li>`)}</ol></article>`);
    if (f.prompt) cards.push(html`<article class="learn-card c-green learn-wide"><h3>${FD.icon('chat')}Try this prompt</h3>
      <figure class="prompt"><blockquote>${f.prompt}</blockquote><button class="btn btn-dark btn-sm" type="button" data-action="copy-prompt" data-copy="${f.prompt}">${FD.icon('copy', { size: 18 })}Copy prompt</button></figure>
      <p class="muted small">Paste it into Copilot and swap in your own details.</p></article>`);
    if (f.learnMore) cards.push(html`<article class="learn-card c-yellow learn-wide learn-link"><div><h3>${FD.icon('book')}Learn more</h3><p>Go deeper with the official Microsoft documentation.</p></div>
      <a class="btn btn-dark" href="${f.learnMore}" target="_blank" rel="noopener noreferrer" data-action="doc-open" data-native>${f.learnLabel || 'Read on Microsoft Learn'}${FD.icon('external', { size: 18 })}<span class="sr-only"> (opens in a new tab)</span></a></article>`);
    if (!cards.length) cards.push(html`<article class="learn-card c-blue learn-wide"><p>This feature doesn\u2019t have a learning card yet.</p></article>`);
    return html`<div class="learn-grid">${cards}</div>`;
  }

  /* ---------- full result ---------- */
  function render(host, d, o = {}) {
    const f = d.feature, won = d.won;
    const lines = won ? WIN_LINES[Math.min(5, Math.max(1, d.hintsUsed))] : LOSS_LINES;
    const rk = FD.scoring.rank(FD.store.profile().xp);
    const b = d.breakdown;
    const share = d.share;
    const gridText = (d.grid || []).map((t) => ({ correct: '\uD83D\uDFE9', hot: '\uD83D\uDFE7', warm: '\uD83D\uDFE8', cold: '\uD83D\uDFE6', skip: '\u2B1C' }[t] || '\u2B1C')).join('');
    const eyebrow = d.mode === 'daily' ? `Daily Challenge #${d.number}` : d.mode === 'speed' ? 'Speed Round' : d.challenge ? 'Friend challenge' : 'Free play';

    host.innerHTML = flat(html`
      <section class="result ${won ? 'is-win' : 'is-loss'}" aria-labelledby="res-h">
        <div class="result-hero">
          <div class="result-pip">${FD.pip(won ? 'cheer' : 'oops', { size: 150 })}</div>
          <div class="result-main">
            <p class="eyebrow">${eyebrow} \u00B7 the answer</p>
            <h2 id="res-h" class="result-title">${lines[0]}</h2>
            <p class="result-sub">${won ? html`${lines[1]} <strong>${d.hintsUsed} ${d.hintsUsed === 1 ? 'hint' : 'hints'}</strong>${d.timeMs != null && !FD.store.settings().relaxed ? html` in <strong>${FD.u.fmtSeconds(d.timeMs)}</strong>` : ''}.` : lines[1]}</p>
            <div class="answer" aria-live="polite"><span class="sr-only">The answer was ${f.name}.</span>${ui.nameTiles(f.name, FD.hints.level(5), true)}</div>
            <div class="chips">${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}</div>
          </div>
        </div>

        <div class="result-grid">
          <div class="card score-card">
            <h3>${won ? 'Your score' : 'What you earned'}</h3>
            ${won && b ? html`<dl class="score-table">
              <div><dt>Hint ${d.hintsUsed} of ${FD.config.maxAttempts}</dt><dd>+${b.base}</dd></div>
              ${b.speed ? html`<div><dt>Speed bonus <small>(${FD.u.fmtSeconds(d.timeMs)})</small></dt><dd>+${b.speed}</dd></div>` : ''}
              ${b.multiplier > 1 ? html`<div><dt>Streak bonus <small>(${Math.round((b.multiplier - 1) * 10)} in a row)</small></dt><dd>\u00D7${b.multiplier.toFixed(1)}</dd></div>` : ''}
              <div class="score-total"><dt>Total</dt><dd>${b.total} <small>pts</small></dd></div>
            </dl>` : html`<p class="muted">No points this time, but you still earned a little XP and the feature is now in your Feature Book as <strong>spotted</strong>.</p>`}
            <div class="xp-row"><span class="xp-pill">${FD.icon('bolt', { size: 18 })}+${d.xp} XP</span>
              ${(d.bonusXp || []).map(([l, v]) => html`<span class="chip">${l} +${v}</span>`)}</div>
            <div class="rank-row"><div><strong>${rk.rank.name}</strong><small class="muted">${rk.next ? ` \u00B7 ${rk.toNext} XP to ${rk.next.name}` : ' \u00B7 top rank!'}</small></div>${ui.bar(rk.pct, rk.rank.color, 'Progress to next rank')}</div>
            ${d.firstTime ? html`<p class="note c-green">${FD.icon('book', { size: 18 })} New in your Feature Book!</p>` : ''}
            ${d.dailyStreak > 0 ? html`<p class="note c-orange">${FD.icon('flame', { size: 18 })} ${d.dailyStreak}-day Daily Challenge streak</p>` : ''}
          </div>

          <div class="card share-card">
            <h3>Share your result</h3>
            ${d.mode === 'speed' ? '' : html`<div class="emoji-grid" aria-label="Your guesses: ${(d.grid || []).join(', ')}"><span aria-hidden="true">${gridText}</span><span class="emoji-score">${won ? d.hintsUsed : 'X'}/${FD.config.maxAttempts}</span></div>`}
            <p class="muted small">Spoiler-free: shares your score and a colour grid, never the answer.</p>
            <div class="btn-row">
              <button class="btn btn-primary" type="button" data-action="share-go">${FD.icon('share', { size: 20 })}Share</button>
              <button class="btn btn-ghost" type="button" data-action="share-copy">${FD.icon('copy', { size: 20 })}Copy text</button>
              <button class="btn btn-ghost" type="button" data-action="share-save">${FD.icon('download', { size: 20 })}Save image</button>
            </div>
            ${d.mode !== 'daily' ? html`<button class="btn btn-link" type="button" data-action="copy" data-copy="${FD.share.challengeUrl(f.id)}">${FD.icon('link', { size: 18 })}Copy a link to challenge a friend with this feature</button>` : ''}
            ${d.mode === 'daily' ? html`<p class="next-daily">${FD.icon('calendar', { size: 18 })} Next challenge in <strong data-countdown>${FD.u.fmtClock(FD.u.msToMidnight())}</strong></p>` : ''}
          </div>
        </div>
      </section>

      <section class="learn" aria-labelledby="learn-h">
        <div class="section-head"><div><p class="eyebrow">Copilot learning mode</p><h2 id="learn-h">Meet ${f.name}</h2></div></div>
        ${learn(f)}
        <div class="result-actions">${(o.actions || []).map((a) => a.href
          ? html`<a class="btn ${a.cls || 'btn-ghost'}" href="${a.href}">${a.icon ? FD.icon(a.icon, { size: 20 }) : ''}${a.label}</a>`
          : html`<button class="btn ${a.cls || 'btn-ghost'}" type="button" data-action="${a.action}">${a.icon ? FD.icon(a.icon, { size: 20 }) : ''}${a.label}</button>`)}</div>
      </section>`);

    /* the share buttons act on whichever result is currently on screen */
    FD.result.current = share;
  }

  /* ---------- compact result for Speed Round / Team Battle ---------- */
  function compact(host, d, o = {}) {
    const f = d.feature;
    host.innerHTML = flat(html`<section class="result-compact ${d.won ? 'is-win' : 'is-loss'}" aria-live="polite">
      <div class="rc-top">${FD.pip(d.won ? 'cheer' : 'oops', { size: 84 })}
        <div><p class="eyebrow">${d.won ? (d.who ? `${d.who} got it!` : 'Got it!') : 'The answer was\u2026'}</p>
          <div class="answer">${ui.nameTiles(f.name, FD.hints.level(5), true)}</div>
          <div class="chips">${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}${d.points != null ? html`<span class="chip chip-solid c-green">+${d.points} pts</span>` : ''}</div></div></div>
      ${o.learn ? html`<details class="rc-learn"><summary>${FD.icon('bulb', { size: 18 })}Show the learning card</summary>${learn(f)}</details>` : ''}
      ${o.footer || ''}
    </section>`);
  }

  /* ---------- shared actions (copy prompt, open doc, share) ---------- */
  ui.actions['copy-prompt'] = async (el) => {
    const ok = await FD.u.copyText(el.dataset.copy || '');
    ui.toast(ok ? 'Prompt copied \u2013 paste it into Copilot!' : 'Could not copy automatically.', { icon: ok ? 'check' : 'x' });
    if (ok) ui.celebrate({ newBadges: FD.store.bump('promptCopies') });
  };
  ui.actions['doc-open'] = () => { ui.celebrate({ newBadges: FD.store.bump('docOpens') }); };
  const shareOf = () => FD.result.current;
  ui.actions['share-go'] = async (el) => {
    const r = shareOf(el); if (!r) return;
    const res = await FD.share.go(r);
    if (res === 'copied') ui.toast('Result copied \u2013 paste it anywhere!', { icon: 'check' });
    if (res === 'shared' || res === 'copied') ui.celebrate({ newBadges: FD.store.bump('shares') });
  };
  ui.actions['share-copy'] = async (el) => {
    const r = shareOf(el); if (!r) return;
    const res = await FD.share.copy(r);
    ui.toast(res === 'copied' ? 'Result copied \u2013 paste it anywhere!' : 'Could not copy automatically.', { icon: res === 'copied' ? 'check' : 'x' });
    if (res === 'copied') ui.celebrate({ newBadges: FD.store.bump('shares') });
  };
  ui.actions['share-save'] = async (el) => {
    const r = shareOf(el); if (!r) return;
    const res = await FD.share.save(r);
    ui.toast(res === 'saved' ? 'Image saved to your downloads' : 'Could not create the image here. Try the hosted version.', { icon: res === 'saved' ? 'check' : 'x' });
    if (res === 'saved') ui.celebrate({ newBadges: FD.store.bump('shares') });
  };

  FD.result = { render, compact, learn };
})();
