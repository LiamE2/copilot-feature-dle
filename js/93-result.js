/* Copilot Feature-dle · result screen + Copilot Learning Mode
   Completion order, top to bottom: the answer block (acknowledgement + score) -> hints and guesses -> Copilot Learning Mode.
   Copilot Learning Mode and the Feature Book's popup show the same thing, built here: where you stand with the feature in each layer (Know it, Use it, Prompt it),
   then a section for each layer, then a link to Microsoft Learn. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat } = FD.u;
  const ui = FD.ui;

  const WIN_LINES = { 1: ['Wow \u2013 first hint!', 'You sniffed that one out straight away.'], 2: ['Brilliant!', 'Two hints and you had it.'], 3: ['Nailed it!', 'Right on the money.'], 4: ['Nice work!', 'A little tricky, but you got there.'], 5: ['Phew, just in time!', 'The last hint came through for you.'] };
  const LOSS_LINES = ['So close!', 'Not this time \u2013 but now you know it for next time.'];
  const EXPIRED_LINES = ['Time\u2019s up!', 'The day ended before you finished. Here\u2019s the answer, so you still learn something.'];

  /* ---------- Copilot Learning Mode: the three layers of a feature ---------- */
  const META = (kind) => FD.puzzles.META[kind];
  /* how far along a layer is, for the pie and the words beside it */
  const progressOf = (kind, L) => (kind === 'hunt' ? { done: L.know ? 1 : 0, total: 1 } : kind === 'match' ? { done: L.use.done, total: L.use.total } : { done: L.prompt.done, total: L.prompt.total });
  const progressText = (kind, L) => {
    const { done, total } = progressOf(kind, L);
    if (kind === 'hunt') return done ? 'Done' : 'Not yet';
    return total ? `${done} of ${total}` : kind === 'match' ? 'No scenarios yet' : 'No prompts yet';
  };

  /* three trackers at the top: one for each layer, a pie that fills as that layer's puzzles are done */
  function trackers(f) {
    const L = FD.scoring.layers(FD.store.profile(), f);
    return html`<ul class="layer-row" aria-label="Your progress with ${f.name}">${FD.puzzles.KINDS.map((k) => {
      const M = META(k), pr = progressOf(k, L);
      return html`<li class="lyr c-${M.color}${pr.done > 0 ? ' is-on' : ''}">${ui.pie(k, pr.done, pr.total, { size: 38 })}<span class="lyr-t"><strong>${M.verb}</strong><small>${progressText(k, L)}</small></span></li>`;
    })}</ul>`;
  }
  const sectionHead = (kind, id) => { const M = META(kind); return html`<h3 class="dsec-h c-${M.color}" id="${id}"><span class="dsec-ic" aria-hidden="true">${FD.icon(M.icon, { size: 20 })}</span>${M.verb}<small>${M.name}</small></h3>`; };

  /* Know it: what the feature is and why it matters (both blue) */
  function knowSection(f, idp) {
    const cards = [];
    if (f.description) cards.push(html`<article class="learn-card c-blue"><h4>${FD.icon('bulb')}What it does</h4><p>${f.description}</p></article>`);
    if (f.why) cards.push(html`<article class="learn-card c-blue"><h4>${FD.icon('target')}Why it matters</h4><p>${f.why}</p></article>`);
    return html`<section class="dsec" aria-labelledby="${idp}know">${sectionHead('hunt', idp + 'know')}
      ${cards.length ? html`<div class="learn-grid">${cards}</div>` : html`<p class="muted">This feature doesn\u2019t have a description yet.</p>`}</section>`;
  }
  /* Use it: its example scenarios (the title and what Copilot does for you; o.max shows only the first few, with a way to see them all) */
  function useSection(f, idp, o) {
    const list = f.useCases || [], shown = o.max ? list.slice(0, o.max) : list;
    return html`<section class="dsec" aria-labelledby="${idp}use">${sectionHead('match', idp + 'use')}
      ${list.length ? html`<h4 class="dsec-sub">Example scenarios</h4>
        <ol class="usecases usecases-book">${shown.map((u, i) => html`<li><span class="uc-n" aria-hidden="true">${i + 1}</span><div>${u.title ? html`<strong>${u.title}</strong>` : ''}<p>${u.text}</p></div></li>`)}</ol>
        ${shown.length < list.length ? html`<p class="dsec-more"><button class="btn btn-link btn-sm" type="button" data-action="met-open" data-id="${f.id}">See all ${list.length} in the Feature Book</button></p>` : ''}`
        : html`<p class="muted">Example scenarios for this feature are on their way.</p>`}</section>`;
  }
  /* Prompt it: one list of prompts, and every one of them is shown: the feature's starter prompt, then the best prompt from each of its Prompt Lab scenarios.
     Each prompt has its Copy button in the top right corner. */
  const promptCard = (title, text) => html`<li class="pr is-open"><div class="pr-top"><strong class="pr-title">${title}</strong><button class="btn btn-ghost btn-sm" type="button" data-action="copy-prompt" data-copy="${text}">${FD.icon('copy', { size: 16 })}Copy prompt</button></div><blockquote class="pr-text">${text}</blockquote></li>`;
  function promptSection(f, idp) {
    const prompts = FD.prompts.ready ? FD.prompts.scenarios.filter((s) => s.feature === f.id) : [];
    const cards = [].concat(f.prompt ? [promptCard('Try this prompt', f.prompt)] : [], prompts.map((s) => promptCard(s.situation, s.options[s.bestIndex].text)));
    return html`<section class="dsec" aria-labelledby="${idp}prompt">${sectionHead('prompt', idp + 'prompt')}
      ${cards.length ? html`<p class="dsec-intro muted">Copy a prompt and try it in Copilot with your own details.</p><ul class="pr-list">${cards}</ul>` : html`<p class="muted">Prompts for this feature are on their way.</p>`}</section>`;
  }
  const learnMoreCard = (f) => (f.learnMore ? html`<article class="learn-card c-yellow learn-wide learn-link dsec-link"><div><h4>${FD.icon('book')}Learn more</h4><p>Go deeper with the official Microsoft documentation.</p></div>
      <a class="btn btn-dark" href="${f.learnMore}" target="_blank" rel="noopener noreferrer" data-action="doc-open" data-native>${f.learnLabel || 'Read on Microsoft Learn'}${FD.icon('external', { size: 18 })}<span class="sr-only"> (opens in a new tab)</span></a></article>` : '');

  /* Everything about a feature: the trackers, the three layers and the Microsoft Learn link.
     o.idp: a prefix for the section ids, so two copies on one page never share an id. o.max: how many example scenarios to show (all by default). */
  function learn(f, o = {}) {
    const idp = o.idp || 'lm-';
    return html`<div class="layers">${trackers(f)}${knowSection(f, idp)}${useSection(f, idp, o)}${promptSection(f, idp)}${learnMoreCard(f)}</div>`;
  }

  const actionButtons = (list) => (list || []).map((a) => {
    const ic = a.icon ? FD.icon(a.icon, { size: 20 }) : '';
    return a.href
      ? html`<a class="btn ${a.cls || 'btn-ghost'}" href="${a.href}">${a.after ? '' : ic}${a.label}${a.after ? ic : ''}</a>`
      : html`<button class="btn ${a.cls || 'btn-ghost'}" type="button" data-action="${a.action}"${FD.u.attrs({ 'data-id': a.id })}>${a.after ? '' : ic}${a.label}${a.after ? ic : ''}</button>`;
  });

  /* ---------- full result: the answer block goes in `host`, Learning Mode in o.learnHost ---------- */
  function render(host, d, o = {}) {
    const f = d.feature, won = d.won;
    const lines = won ? WIN_LINES[Math.min(5, Math.max(1, d.hintsUsed))] : d.expired ? EXPIRED_LINES : LOSS_LINES;
    const rk = FD.scoring.rank(FD.store.profile().xp);
    const b = d.breakdown;
    const eyebrow = d.mode === 'daily' ? `Daily Challenge${d.number ? ' #' + d.number : ''}` : (o.eyebrow || 'Free Play');
    const pk = d.pack;
    const notes = [
      d.firstTime ? html`<p class="note c-green">${FD.icon('book', { size: 18 })} New in your Feature Book!</p>` : '',
      d.review === 'cleared' ? html`<p class="note c-green">${FD.icon('check', { size: 18 })} Off your Needs Another Look list. Nicely done!</p>` : '',
      d.review === 'added' ? html`<p class="note c-orange">${FD.icon('refresh', { size: 18 })} Added to Needs Another Look. <a href="#/pack/review">Play it from Packs</a> whenever you like.</p>` : '',
      d.review === 'stays' ? html`<p class="note c-orange">${FD.icon('refresh', { size: 18 })} Still on your Needs Another Look list. Get it right next time and it comes off.</p>` : '',
      d.dailyStreak > 0 ? html`<p class="note c-orange">${FD.icon('flame', { size: 18 })} ${d.dailyStreak}-day Daily Challenge streak${FD.daily.weekendSafeDay() ? ' \u00B7 weekends won\u2019t reset it' : ''}</p>` : '',
      pk ? html`<p class="note c-purple">${FD.icon('package', { size: 18 })} ${pk.complete ? html`<strong>${pk.name} complete!</strong> You\u2019ve played everything in it.` : html`${pk.name}: <strong>${pk.done} of ${pk.total}</strong> played`}</p>` : '',
      d.mode === 'daily' ? html`<p class="next-daily">${FD.icon('calendar', { size: 18 })} Next challenge in <strong data-countdown>${FD.daily.countdownText()}</strong></p>` : ''
    ].filter(Boolean);

    host.innerHTML = flat(html`
      <section class="result ${won ? 'is-win' : 'is-loss'}" aria-labelledby="res-h">
        <div class="result-hero">
          <div class="result-pip">${FD.pip(won ? 'cheer' : 'oops', { size: 150 })}</div>
          <div class="result-main">
            <p class="eyebrow">${eyebrow} \u00B7 the answer</p>
            <h1 id="res-h" class="result-title">${lines[0]}</h1>
            <p class="result-sub">${won ? html`${lines[1]} <strong>${d.hintsUsed} ${d.hintsUsed === 1 ? 'hint' : 'hints'}</strong>${d.mode === 'daily' && d.timeMs != null ? html` in <strong>${FD.u.fmtSeconds(d.timeMs)}</strong>` : ''}.` : lines[1]}</p>
            <div class="answer" aria-live="polite"><span class="sr-only">The answer was ${f.name}.</span>${ui.nameTiles(f.name, FD.hints.level(5), true)}</div>
            <div class="chips">${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}</div>
            ${o.next ? html`<div class="btn-row result-next"><button class="btn btn-primary btn-lg" type="button" data-action="${o.next.action}" id="result-next">${o.next.label} ${FD.icon(o.next.icon || 'right', { size: 18 })}</button></div>` : ''}
          </div>
          <div class="result-score">
            <h2 class="mini-h">${won ? 'Your score' : 'What you earned'}</h2>
            ${won && b ? html`<p class="rs-total"><strong>${b.total}</strong><span>points</span></p>
              <dl class="score-table">
                <div><dt>Hint ${d.hintsUsed} of ${FD.config.maxAttempts}</dt><dd>+${b.base}</dd></div>
                ${b.speed ? html`<div><dt>Speed bonus <small>(${FD.u.fmtSeconds(d.timeMs)})</small></dt><dd>+${b.speed}</dd></div>` : ''}
              </dl>` : html`<p class="muted rs-none">${d.revisit ? 'No points for this one.' : html`No points this time, but you still earned a little XP${FD.scoring.bookState(FD.store.profile(), f) === 'spotted' ? html` and the feature is now in your Feature Book as <strong>spotted</strong>` : ''}.`}</p>`}
            ${d.xp ? html`<div class="xp-row"><span class="xp-pill">${FD.icon('bolt', { size: 18 })}+${d.xp} XP</span>${(d.bonusXp || []).map(([l, v]) => html`<span class="chip">${l} +${v}</span>`)}</div>` : ''}
            <div class="rank-row"><div><strong>${rk.rank.name}</strong><small class="muted">${rk.next ? ` \u00B7 ${rk.toNext} XP to ${rk.next.name}` : ' \u00B7 top rank!'}</small></div>${ui.bar(rk.pct, rk.rank.color, 'Progress to the next rank')}</div>
          </div>
          ${notes.length ? html`<div class="result-notes">${notes}</div>` : ''}
        </div>
      </section>`);

    const learnHtml = html`<section class="learn" aria-labelledby="learn-h">
        <div class="section-head"><div><p class="eyebrow">Copilot learning mode</p><h2 id="learn-h">Meet ${f.name}</h2></div></div>
        ${learn(f, { max: 3, idp: 'lm-' })}
        <div class="result-actions">${actionButtons(o.actions)}</div>
      </section>`;
    if (o.learnHost) o.learnHost.innerHTML = flat(learnHtml); else host.insertAdjacentHTML('beforeend', flat(learnHtml));
  }

  /* ---------- a Daily Challenge that was a Scenario Match or Prompt Lab question: the same answer block, scored by the pick it was found on plus the Speed Bonus ---------- */
  const Q_WIN_LINES = { 1: ['Spot on, first pick!', 'You went straight to the right one.'], 2: ['Great stuff!', 'Second pick and you had it.'], 3: ['Phew, got there!', 'The last pick came through for you.'] };
  function renderQuestion(host, d, o = {}) {
    const f = d.feature, won = d.won, M = FD.puzzles.META[d.kind], b = d.breakdown, max = FD.quiz(d.kind).maxTries(), tries = Math.min(max, Math.max(1, d.tries || 1));
    const lines = won ? Q_WIN_LINES[tries] : d.expired ? EXPIRED_LINES : LOSS_LINES;
    const rk = FD.scoring.rank(FD.store.profile().xp);
    const notes = [
      d.review === 'added' ? html`<p class="note c-orange">${FD.icon('refresh', { size: 18 })} Added to Needs Another Look. <a href="#/pack/review">Play it from Packs</a> whenever you like.</p>` : '',
      d.dailyStreak > 0 ? html`<p class="note c-orange">${FD.icon('flame', { size: 18 })} ${d.dailyStreak}-day Daily Challenge streak${FD.daily.weekendSafeDay() ? ' \u00B7 weekends won\u2019t reset it' : ''}</p>` : '',
      html`<p class="next-daily">${FD.icon('calendar', { size: 18 })} Next challenge in <strong data-countdown>${FD.daily.countdownText()}</strong></p>`
    ].filter(Boolean);
    host.innerHTML = flat(html`
      <section class="result ${won ? 'is-win' : 'is-loss'}" aria-labelledby="res-h">
        <div class="result-hero">
          <div class="result-pip">${FD.pip(won ? 'cheer' : 'oops', { size: 150 })}</div>
          <div class="result-main">
            <p class="eyebrow">Daily Challenge${d.number ? ' #' + d.number : ''} \u00B7 ${M.name} \u00B7 the answer</p>
            <h1 id="res-h" class="result-title">${lines[0]}</h1>
            <p class="result-sub">${won ? html`${lines[1]} <strong>${tries} ${tries === 1 ? 'pick' : 'picks'}</strong>${d.timeMs != null ? html` in <strong>${FD.u.fmtSeconds(d.timeMs)}</strong>` : ''}.` : lines[1]}</p>
            <div class="answer" aria-live="polite"><span class="sr-only">The answer was ${f.name}.</span>${ui.nameTiles(f.name, FD.hints.level(5), true)}</div>
            <div class="chips">${ui.kindChip(d.kind)}${ui.diffChip(f.difficulty)}${ui.catChip(f.category)}</div>
          </div>
          <div class="result-score">
            <h2 class="mini-h">${won ? 'Your score' : 'What you earned'}</h2>
            ${won && b ? html`<p class="rs-total"><strong>${b.total}</strong><span>points</span></p>
              <dl class="score-table">
                <div><dt>Pick ${tries} of ${max}</dt><dd>+${b.base}</dd></div>
                ${b.speed ? html`<div><dt>Speed bonus <small>(${FD.u.fmtSeconds(d.timeMs)})</small></dt><dd>+${b.speed}</dd></div>` : ''}
              </dl>` : html`<p class="muted rs-none">${d.revisit ? 'No points for this one.' : 'No points this time, but you still earned a little XP.'}</p>`}
            ${d.xp ? html`<div class="xp-row"><span class="xp-pill">${FD.icon('bolt', { size: 18 })}+${d.xp} XP</span>${(d.bonusXp || []).map(([l, v]) => html`<span class="chip">${l} +${v}</span>`)}</div>` : ''}
            <div class="rank-row"><div><strong>${rk.rank.name}</strong><small class="muted">${rk.next ? ` \u00B7 ${rk.toNext} XP to ${rk.next.name}` : ' \u00B7 top rank!'}</small></div>${ui.bar(rk.pct, rk.rank.color, 'Progress to the next rank')}</div>
          </div>
          <div class="result-notes">${notes}</div>
        </div>
      </section>`);
    const learnHtml = html`<section class="learn" aria-labelledby="learn-h">
        <div class="section-head"><div><p class="eyebrow">Copilot learning mode</p><h2 id="learn-h">Meet ${f.name}</h2></div></div>
        ${learn(f, { max: 3, idp: 'lm-' })}
        <div class="result-actions">${actionButtons(o.actions)}</div>
      </section>`;
    if (o.learnHost) o.learnHost.innerHTML = flat(learnHtml); else host.insertAdjacentHTML('beforeend', flat(learnHtml));
  }

  /* ---------- shared actions (copy prompt, open doc) ---------- */
  ui.actions['copy-prompt'] = async (el) => {
    const ok = await FD.u.copyText(el.dataset.copy || '');
    ui.toast(ok ? 'Prompt copied \u2013 paste it into Copilot!' : 'Could not copy automatically.', { icon: ok ? 'check' : 'x' });
    if (ok) ui.celebrate({ newBadges: FD.store.bump('promptCopies') });
  };
  ui.actions['doc-open'] = () => { ui.celebrate({ newBadges: FD.store.bump('docOpens') }); };

  FD.result = { render, renderQuestion, learn, trackers, progressOf, progressText };
})();
