/* Copilot Feature-dle · Stats dashboard, badges, ranks */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, attrs } = FD.u;
  const ui = FD.ui;

  /* what is showing right now: the month the calendar shows ('' = this month) and which badges. Opening the page starts on this month and All badges. */
  const view = { month: '', badges: 'all' };

  /* ---------- the Daily Challenge calendar: one month at a time, Monday first ---------- */
  const monthOf = (k) => k.slice(0, 7);
  const monthStep = (m, n) => { const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n; return `${Math.floor(t / 12)}-${FD.u.pad2((t % 12) + 1)}`; };
  const monthTitle = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 1)).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  /* the first month worth showing: when the Daily Challenge began, or the first day this player has a result for, whichever is earlier */
  const firstMonth = (p) => { const ks = Object.keys(p.daily.results).sort(), e = FD.config.dailyEpoch; return monthOf(ks.length && ks[0] < e ? ks[0] : e); };
  /* the month on show: never earlier than the first month, and never later than this one (the future has nothing in it yet) */
  const calState = () => {
    const p = FD.store.profile(), today = FD.u.dateKey(), cur = monthOf(today), first = firstMonth(p);
    const m = view.month && view.month >= first && view.month <= cur ? view.month : cur;
    return { p, today, cur, first, m };
  };
  /* green = solved, light red = not solved (a miss always ends the streak), light grey = not played or still to come, dashed = weekend.
     A day that has gone by also gets a diagonal line in the same style. The words are there for screen readers, and as a tooltip. */
  const dayLabel = (k, st, r, today) => {
    const d = FD.u.fmtDateLong(k);
    if (st === 'off') return `${d}: weekend, no challenge`;
    if (st === 'won') return `${d}: solved in ${FD.u.plural(r.hints, r.kind && r.kind !== 'hunt' ? 'pick' : 'hint')}`;
    if (st === 'lost') return `${d}: not solved, which ended your streak`;
    return k === today ? `${d}: today, not played yet` : k > today ? `${d}: still to come` : `${d}: not played`;
  };
  const calCells = (p, today, m) => {
    const count = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    const lead = (FD.u.weekdayOfKey(`${m}-01`) + 6) % 7;
    const out = Array.from({ length: lead }, () => html`<li class="blank" aria-hidden="true"></li>`);
    for (let n = 1; n <= count; n++) {
      const k = `${m}-${FD.u.pad2(n)}`, r = p.daily.results[k];
      if (!r && k < FD.config.dailyEpoch) { out.push(html`<li class="blank" aria-hidden="true"></li>`); continue; } /* before the first challenge there is nothing to show */
      const st = FD.u.isWeekend(k) ? 'off' : r ? (r.won ? 'won' : 'lost') : 'none', past = k < today, label = dayLabel(k, st, r, today);
      out.push(html`<li class="day ${st}${k === today ? ' today' : ''}${past ? ' past' : ''}" title="${label}"><span class="sr-only">${label}</span><span class="day-n" aria-hidden="true">${n}</span>${past ? html`<svg class="day-slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line x1="5" y1="90" x2="95" y2="10"></line></svg>` : ''}</li>`);
    }
    return out;
  };
  const paintCalendar = () => {
    const host = document.getElementById('cal-host'); if (!host) return;
    const { p, today, cur, first, m } = calState();
    host.innerHTML = flat(html`${calCells(p, today, m)}`);
    const t = document.getElementById('cal-month'); if (t) t.textContent = monthTitle(m);
    document.querySelectorAll('.cal-btn').forEach((b) => { if (+b.dataset.dir < 0 ? m > first : m < cur) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); });
  };
  ui.actions['cal-month'] = (el) => {
    const { cur, first, m } = calState(), n = monthStep(m, +el.dataset.dir || 0);
    if (n < first || n > cur) return;
    view.month = n;
    paintCalendar();
  };

  /* ---------- the Daily streak flame: warm from day 1, hot from a week, blazing from a fortnight (FD.config.streakHeat) ---------- */
  const heatOf = (streak) => { const h = FD.config.streakHeat; return streak >= h.blazing ? 3 : streak >= h.hot ? 2 : streak >= 1 ? 1 : 0; };
  const HEAT_WORD = ['', 'warming up', 'hot', 'blazing'];

  /* ---------- the badge filter ---------- */
  const BADGE_VIEWS = [['all', 'All'], ['earned', 'Earned'], ['todo', 'Not earned yet']];

  FD.views.stats = {
    title: 'Stats',
    render(main) {
      view.month = ''; view.badges = 'all';
      const p = FD.store.profile(), lib = FD.lib, s = p.stats, cfg = FD.config, today = FD.u.dateKey();
      const rk = FD.scoring.rank(p.xp);
      const streak = FD.store.dailyStreak(), heat = heatOf(streak);
      const badgeDefs = FD.badges.all(lib), earned = badgeDefs.filter((b) => p.badges[b.id]);
      const badgeCount = { all: badgeDefs.length, earned: earned.length, todo: badgeDefs.length - earned.length };
      const badgeLi = (b) => { const got = p.badges[b.id]; return html`<li class="badge ${got ? 'is-earned' : ''}">${ui.badge(b, !!got)}<div><strong>${b.name}</strong><p>${b.desc}</p>${got ? html`<small>Earned ${FD.u.fmtDateShort(FD.u.dateKey(new Date(got)))}</small>` : html`<small class="muted">Locked</small>`}</div></li>`; };
      const badgeList = (v) => {
        const list = badgeDefs.filter((b) => v === 'all' || (v === 'earned') === !!p.badges[b.id]);
        if (list.length) return html`${list.map(badgeLi)}`;
        return html`<li class="bf-empty">${v === 'earned' ? 'No badges yet. Play a game and your first one is on its way!' : 'You\u2019ve earned every badge. Wow!'}</li>`;
      };
      const badgeSay = (v) => (v === 'all' ? `Showing all ${badgeCount.all} badges` : v === 'earned' ? `Showing the ${badgeCount.earned} badges you have earned` : `Showing the ${badgeCount.todo} badges you have not earned yet`);
      const cal = calState();

      /* the three game modes, one by one: how much you have played, and how many of its puzzles you have done */
      const tot = FD.scoring.totals(p), META = FD.puzzles.META;
      const mastered = lib.features.filter((f) => FD.scoring.layers(p, f).mastered).length;
      const known = lib.features.filter((f) => FD.scoring.known(p, f)).length;
      const doneIn = (eng, seen) => eng.scenarios.filter((x) => FD.scoring.solvedIn(seen, x.id)).length;
      const matched = doneIn(FD.scenarios, p.match && p.match.seen), found = doneIn(FD.prompts, p.prompts && p.prompts.seen);
      const stat = (label, value, sub) => html`<div><dt>${label}</dt><dd>${value}${sub ? html`<small>${sub}</small>` : ''}</dd></div>`;
      const modeCard = (kind, stats) => {
        const M = META[kind];
        return html`<section class="card mode-stat c-${M.color}" aria-labelledby="ms-${kind}">
          <div class="ms-head"><span class="ms-ic" aria-hidden="true">${FD.icon(M.icon, { size: 24 })}</span><div><h3 id="ms-${kind}">${M.name}</h3><p class="muted small">${M.verb}</p></div></div>
          <dl class="pl-stats">${stats}</dl>
        </section>`;
      };

      main.innerHTML = flat(html`<div class="container hub">
        <header class="stats-head card c-blue">
          ${FD.avatar(p.name, p.color, 72, rk.rank.id)}
          <div class="sh-main"><p class="eyebrow">Player stats${FD.account.tag()}</p><h1>${p.name}</h1>
            <p class="sh-rank">${FD.icon('crown', { size: 20 })}<strong>${rk.rank.name}</strong><span>${p.xp} XP${rk.next ? ` \u00B7 ${rk.toNext} to ${rk.next.name}` : ' \u00B7 top rank!'}</span></p>
            ${ui.bar(rk.pct, 'yellow', 'Progress to next rank')}</div>
        </header>
        ${FD.account.note('You\u2019re playing as a guest. Sign in to put your name on the leaderboard.')}

        <section class="num-grid" aria-label="Key numbers">
          <div class="num card"><strong>${tot.puzzles}</strong><span>Puzzles played</span></div>
          <div class="num card num-streak heat-${heat}"><strong><span class="heat-ic" aria-hidden="true">${FD.icon('flame', { size: 24 })}</span>${streak}</strong><span>Daily streak${heat ? html`<span class="sr-only"> (${HEAT_WORD[heat]})</span>` : ''}</span></div>
          <div class="num card"><strong>${p.daily.max}</strong><span>Best daily streak</span></div>
          <div class="num card"><strong>${mastered}</strong><span>Features mastered</span></div>
        </section>

        <div class="stats-cols stats-top">
          <section class="card cal-card" aria-labelledby="cal-h">
            <h2 id="cal-h">Daily Challenge</h2>
            <div class="cal-bar" role="group" aria-label="Choose a month">
              <button class="cal-btn" type="button" data-action="cal-month" data-dir="-1" aria-label="Previous month"${attrs({ 'aria-disabled': cal.m > cal.first ? null : 'true' })}>${FD.icon('left', { size: 20 })}</button>
              <strong class="cal-title" id="cal-month" aria-live="polite">${monthTitle(cal.m)}</strong>
              <button class="cal-btn" type="button" data-action="cal-month" data-dir="1" aria-label="Next month"${attrs({ 'aria-disabled': cal.m < cal.cur ? null : 'true' })}>${FD.icon('right', { size: 20 })}</button>
            </div>
            <ul class="cal-head" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => html`<li>${d}</li>`)}</ul>
            <ol class="cal" id="cal-host" aria-labelledby="cal-h cal-month">${calCells(p, today, cal.m)}</ol>
          </section>
          <section class="card road-card" aria-labelledby="rank-h">
            <h2 id="rank-h">The road to Copilot Champion</h2>
            <ol class="ladder">${cfg.ranks.map((r, i) => html`<li class="c-${r.color} ${i === rk.index ? 'is-here' : i < rk.index ? 'is-done' : ''}"><span class="l-ring">${FD.avatar(p.name, p.color, 30, r.id)}</span><strong>${r.name}</strong><small>${r.xp} XP</small>${i === rk.index ? html`<span class="chip chip-solid c-blue">You are here</span>` : i < rk.index ? html`<span class="sr-only">Reached</span>` : ''}</li>`)}</ol>
          </section>
        </div>

        ${ui.section('Game modes', html`<div class="mode-stats">
          ${modeCard('hunt', html`${stat('Played', s.played)}${stat('Features known', known, ` of ${lib.features.length}`)}`)}
          ${modeCard('match', html`${stat('Played', tot.match.played)}${stat('Scenarios matched', matched, ` of ${FD.scenarios.scenarios.length}`)}`)}
          ${modeCard('prompt', html`${stat('Played', tot.prompt.played)}${stat('Prompts found', found, ` of ${FD.prompts.scenarios.length}`)}`)}
        </div>`, { id: 's-modes' })}

        <section class="card" aria-labelledby="bad-h">
          <div class="section-head"><h2 id="bad-h">Achievement badges <small>${earned.length} of ${badgeDefs.length}</small></h2></div>
          <div class="pill-radios bf" role="radiogroup" aria-label="Which badges to show">${BADGE_VIEWS.map(([v, label]) => html`<label class="pill-radio"><input type="radio" name="bf" value="${v}"${attrs({ checked: view.badges === v })}><span>${label} <small>${badgeCount[v]}</small></span></label>`)}</div>
          <p class="sr-only" id="bf-say" aria-live="polite"></p>
          <ul class="badge-grid" id="bf-grid">${badgeList(view.badges)}</ul>
        </section>
      </div>`);

      /* the badge filter swaps the list in place, and says what it is showing */
      const grid = main.querySelector('#bf-grid'), say = main.querySelector('#bf-say');
      main.querySelectorAll('input[name="bf"]').forEach((r) => r.addEventListener('change', () => {
        view.badges = r.value;
        grid.innerHTML = flat(badgeList(view.badges));
        say.textContent = badgeSay(view.badges);
      }));
    }
  };
})();
