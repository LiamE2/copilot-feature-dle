/* Copilot Feature-dle · About / how to play / scoring / facilitator tips */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat } = FD.u;
  const ui = FD.ui;

  FD.views.about = {
    title: 'About',
    render(main) {
      const cfg = FD.config, lib = FD.lib;
      const official = lib.features.filter((f) => !f.community);
      const byDiff = Object.fromEntries(cfg.difficulties.map((d) => [d, official.filter((f) => f.difficulty === d).length]));
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const plan = [1, 2, 3, 4, 5, 6, 0].map((i) => [days[i], cfg.weekdayPlan[i]]);

      main.innerHTML = flat(html`<div class="container hub about">
        <header class="hub-head about-head">
          <div><p class="eyebrow">${FD.tagline('learning')}</p><h1>About Copilot Feature-dle</h1>
          <p class="lede">A friendly guessing game that helps people get to know Microsoft Copilot \u2013 one sneaky hint at a time. Think <em>Wordle</em> meets <em>Microsoft Learn</em>, with a dash of Engage Squared.</p></div>
          <div class="about-art" aria-hidden="true">${FD.pip('hello', { size: 170 })}</div>
        </header>

        ${ui.section('How to play', html`<ol class="steps">
          <li class="c-blue"><span class="step-n">1</span><h3>Read the hint</h3><p>You start with the sneakiest clue. It\u2019s deliberately obscure but always accurate.</p></li>
          <li class="c-purple"><span class="step-n">2</span><h3>Make a guess</h3><p>Type a feature name. Full names, short names and even typos all work, and suggestions pop up as you type.</p></li>
          <li class="c-pink"><span class="step-n">3</span><h3>Read the clue</h3><p>A wrong guess shows <strong>hot, warm or cold</strong>, whether the category matches, and if the answer is easier or harder.</p></li>
          <li class="c-green"><span class="step-n">4</span><h3>Learn it</h3><p>Every answer comes with what it does, why it matters, three real use cases and a prompt to try.</p></li>
        </ol>`, { id: 'a-how' })}

        ${ui.section('Scoring', html`<div class="about-cols">
          <div class="card"><h3>Points for fewer hints</h3><table class="table"><thead><tr><th scope="col">Hints used</th><th scope="col">Points</th></tr></thead><tbody>${cfg.points.map((p, i) => html`<tr><th scope="row">${i + 1}</th><td>${p}</td></tr>`)}</tbody></table></div>
          <div class="card"><h3>Speed bonus</h3><table class="table"><thead><tr><th scope="col">Solved within</th><th scope="col">Bonus</th></tr></thead><tbody>${cfg.speedBonus.map((s) => html`<tr><th scope="row">${s.maxMs / 1000}s</th><td>+${s.pts}</td></tr>`)}</tbody></table><p class="muted small">Only your active play time counts. Prefer no clock? Turn on <a href="#/settings">relaxed timing</a>.</p></div>
          <div class="card"><h3>Streak multiplier</h3><p>Every win in a row adds <strong>+${Math.round(cfg.streakStep * 100)}%</strong> to your score, up to <strong>\u00D7${(1 + cfg.streakStep * cfg.streakCap).toFixed(1)}</strong> after ${cfg.streakCap} wins. A miss resets it.</p><h3>XP &amp; ranks</h3><p>Points become XP, with bonuses for harder features, new discoveries and Daily streaks. Climb from <strong>${cfg.ranks[0].name}</strong> to <strong>Copilot Champion</strong> and beyond.</p></div>
        </div>`, { id: 'a-score' })}

        ${ui.section('Difficulty & the Daily Challenge', html`<div class="about-cols">
          <div class="card"><h3>Four levels</h3><ul class="plain">
            <li>${ui.diffChip('Easy')} Common features most people have met (${byDiff.Easy}).</li>
            <li>${ui.diffChip('Medium')} Newer features worth knowing (${byDiff.Medium}).</li>
            <li>${ui.diffChip('Hard')} Niche or recently released functionality (${byDiff.Hard}).</li>
            <li>${ui.diffChip('Expert')} Champion and consultant territory (${byDiff.Expert}).</li></ul>
            <p class="muted small">In Free play, Medium unlocks after collecting ${cfg.unlocks.Medium.need} Easy features, Hard after ${cfg.unlocks.Hard.need} Medium and Expert after ${cfg.unlocks.Expert.need} Hard.</p></div>
          <div class="card"><h3>The weekly ramp</h3><p>Everyone gets the same Daily Challenge. Difficulty eases you in on Monday and builds through the week:</p><ul class="plain ramp">${plan.map(([d, lvl]) => html`<li><span>${d}</span>${ui.diffChip(lvl)}</li>`)}</ul><p class="muted small">A new challenge unlocks at midnight your local time.</p></div>
        </div>`, { id: 'a-diff' })}

        ${ui.section('Running a session? Tips for facilitators', html`<div class="about-cols">
          <div class="card"><h3>Team battle</h3><p>Project the screen, split the room into teams and let them take turns. Each wrong guess passes the turn and unlocks an easier hint. After every round, open the learning card and talk through the use cases.</p></div>
          <div class="card"><h3>Facilitator mode</h3><p>In <a href="#/settings">Settings</a>, switch on <em>Facilitator mode</em> to unlock every difficulty and open the whole Feature Book, handy for demos and training.</p></div>
          <div class="card"><h3>Your own packs</h3><p>Build a pack for your customer, event or team (even with Copilot\u2019s help) in <a href="#/packs">Packs &amp; themes</a>. Shared device? Everyone can add their own player.</p></div>
          <div class="card"><h3>Shared leaderboards</h3><p>By default the leaderboard lives on each device. To run a live event board, point <code>js/05-config.js</code> at a small endpoint. The README has the (very short) contract.</p></div>
        </div>`, { id: 'a-fac' })}

        ${ui.section('Accessibility & privacy', html`<div class="about-cols">
          <div class="card"><h3>Built for everyone</h3><p>Fully keyboard friendly, screen reader labelled and designed to WCAG 2.1 AA contrast. You can reduce motion, boost contrast, enlarge text and turn off timers in <a href="#/settings">Settings</a>. Colours are never the only clue.</p><p class="muted small">Keyboard: <kbd>Tab</kbd> to move, <kbd>\u2191</kbd> <kbd>\u2193</kbd> to browse suggestions, <kbd>Enter</kbd> to choose or guess, <kbd>Esc</kbd> to close.</p></div>
          <div class="card"><h3>Your data stays yours</h3><p>No accounts, no tracking. Your name, stats and collection are saved in your browser on this device only. You can export or erase everything in <a href="#/settings">Settings</a>.</p></div>
        </div>`, { id: 'a-acc' })}

        <section class="about-brand c-blue" aria-labelledby="a-brand">
          <div><h2 id="a-brand">Made with care by Engage Squared</h2>
            <p>We understand the Microsoft tech. Equally, we understand that people are at the heart of technological transformation, and that we all think and work differently. So we tailor the tech until it fits.</p>
            <p class="tagline-big">${FD.tagline()}</p></div>
          <div class="brand-tab">${FD.logo({ width: 220 })}</div>
        </section>

        <section class="section fine" aria-labelledby="a-fine">
          <h2 id="a-fine">The fine print</h2>
          <p>Copilot Feature-dle is an independent learning game created by Engage Squared. It is not affiliated with, endorsed by or sponsored by Microsoft. Microsoft, Microsoft 365, Copilot, Copilot Studio, Teams, Word, Excel, PowerPoint, Outlook, OneNote, OneDrive, SharePoint, Loop, Edge, Windows and related names are trademarks of the Microsoft group of companies. Feature descriptions are written for learning and may change as Microsoft updates its products, so always check Microsoft Learn for the latest.</p>
          <p class="muted small">Fonts: Montserrat and Noto Sans (SIL Open Font License). Library: ${official.length} features${lib.meta.updated ? `, updated ${lib.meta.updated}` : ''}. Version ${cfg.version}.</p>
        </section>
      </div>`);
    }
  };
})();
