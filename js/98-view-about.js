/* Copilot Feature-dle · About / how to play / scoring */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat } = FD.u;
  const ui = FD.ui;

  FD.views.about = {
    title: 'About',
    render(main) {
      const cfg = FD.config, lib = FD.lib;
      const byDiff = Object.fromEntries(cfg.difficulties.map((d) => [d, lib.features.filter((f) => f.difficulty === d).length]));
      const top = cfg.ranks[cfg.ranks.length - 1];

      main.innerHTML = flat(html`<div class="container hub about">
        <header class="hub-head about-head">
          <div><h1>About Copilot Feature-dle</h1>
          <p class="lede">A friendly puzzle game for getting to know Microsoft Copilot, one clue at a time. Guess the feature, match it to a real work moment, then pick the prompt that gets the best result: Know it, Use it, Prompt it. Made by Engage Squared, with a dash of friendly technology.</p></div>
          <div class="about-art" aria-hidden="true">${FD.pip('hello', { size: 170 })}</div>
        </header>

        ${ui.section('Three ways to learn every feature', html`<div class="about-cols">
          <div class="card c-blue about-mode"><h3>${FD.icon('search', { size: 22 })}Feature Hunt</h3><p><strong>Know it.</strong> Five sneaky hints, one Copilot feature. Guess it and find out what it does. Play one hunt, or up to ${cfg.featureHunt.rounds.max} rounds in a row.</p><a class="btn btn-ghost btn-sm" href="#/hunt">Play Feature Hunt</a></div>
          <div class="card c-purple about-mode"><h3>${FD.icon('puzzle', { size: 22 })}Scenario Match</h3><p><strong>Use it.</strong> Read a real work scenario and pick the Copilot feature that fits best.</p><a class="btn btn-ghost btn-sm" href="#/match">Play Scenario Match</a></div>
          <div class="card c-blue-50 about-mode"><h3>${FD.icon('flask', { size: 22 })}Prompt Lab</h3><p><strong>Prompt it.</strong> Read the scenario, then pick the prompt that will get the best result. Every answer shows which of the four prompting ingredients each option had: goal, context, source and expectations.</p><a class="btn btn-ghost btn-sm" href="#/prompts">Play Prompt Lab</a></div>
        </div>
        <p class="muted about-note">Every feature in the Feature Book brings the three together: Know it, Use it and Prompt it.</p>`, { id: 'a-modes' })}

        ${ui.section('How Feature Hunt works', html`<ol class="steps">
          <li class="c-blue"><span class="step-n">1</span><h3>Read the hint</h3><p>You start with the sneakiest clue. It\u2019s deliberately obscure but always accurate.</p></li>
          <li class="c-purple"><span class="step-n">2</span><h3>Make a guess</h3><p>Type a feature name. Full names, short names and even typos all work, and suggestions pop up as you type.</p></li>
          <li class="c-pink"><span class="step-n">3</span><h3>Read the clue</h3><p>A wrong guess shows <strong>hot, warm or cold</strong>, whether the category matches, and if the answer is easier or harder. Pip\u2019s extras unlock as you go.</p></li>
          <li class="c-green"><span class="step-n">4</span><h3>Learn it</h3><p>Every answer comes with what it does, why it matters, example scenarios and a prompt to try.</p></li>
        </ol>`, { id: 'a-how' })}

        ${ui.section('How Scenario Match and Prompt Lab work', html`<ol class="steps">
          <li class="c-blue"><span class="step-n">1</span><h3>Read the scenario</h3><p>A real work moment, said the way a person would say it.</p></li>
          <li class="c-purple"><span class="step-n">2</span><h3>Pick the best answer</h3><p>Four Copilot features in Scenario Match, four prompts in Prompt Lab. One is the best.</p></li>
          <li class="c-green"><span class="step-n">3</span><h3>See why</h3><p>A weaker pick explains itself, and you can try again for fewer points. Miss all three picks and the answer is shown for no points, and the puzzle goes to Needs Another Look. Choose how many rounds a game has, from 1 to 10.</p></li>
        </ol>`, { id: 'a-quiz' })}

        ${ui.section('Scoring', html`<div class="about-cols about-score">
          <div class="card"><h3>Feature Hunt points</h3><table class="table"><thead><tr><th scope="col">Hints used</th><th scope="col">Points</th></tr></thead><tbody>${cfg.points.map((p, i) => html`<tr><th scope="row">${i + 1}</th><td>${p}</td></tr>`)}</tbody></table></div>
          <div class="card"><h3>Speed bonus</h3><table class="table"><thead><tr><th scope="col">Solved within</th><th scope="col">Bonus</th></tr></thead><tbody>${cfg.speedBonus.map((s) => html`<tr><th scope="row">${s.maxMs / 1000}s</th><td>+${s.pts}</td></tr>`)}</tbody></table><p class="muted small">Daily Challenge only, in any game mode. The timer keeps ticking if you leave the game after starting.</p></div>
          <div class="card"><h3>Scenario Match and Prompt Lab points</h3><table class="table"><thead><tr><th scope="col">Pick that is right</th><th scope="col">Points</th></tr></thead><tbody>${cfg.promptLab.points.map((p, i) => html`<tr><th scope="row">${['1st', '2nd', '3rd'][i]}</th><td>${p}</td></tr>`)}</tbody></table><p class="muted small">Miss all three picks and you earn nothing: the answer is shown and the puzzle goes to Needs Another Look. Finish a game of ${cfg.promptLab.perfectMinRounds} or more rounds with every pick right first time for a bonus of ${cfg.promptLab.perfectBonusPerRound} XP a round.</p></div>
          <div class="card"><h3>XP &amp; ranks</h3><p>Points become XP, one for one in every game mode, with bonuses for harder features, new discoveries and the Daily Challenge. Keep a Daily Challenge streak going and every correct answer earns up to <strong>+${Math.round(cfg.streakXpMax * 100)}% bonus XP</strong> (+${Math.round(cfg.streakXpPerDay * 100)}% for each day of your streak). Climb from <strong>${cfg.ranks[0].name}</strong> all the way to <strong>${top.name}</strong>.</p></div>
        </div>`, { id: 'a-score' })}

        ${ui.section('Difficulty & the Daily Challenge', html`<div class="about-cols">
          <div class="card"><h3>Four levels</h3><ul class="plain">
            ${cfg.difficulties.map((d) => html`<li>${ui.diffChip(d)}<span>${cfg.levelInfo[d]} (${byDiff[d]}).</span></li>`)}</ul>
            <p class="muted small">Every level is open from the start, in every game mode.</p></div>
          <div class="card"><h3>The Daily Challenge</h3><p>Everyone gets the same Daily Challenge every weekday. It can be a Feature Hunt, a Scenario Match or a Prompt Lab question, in a balanced mix. Each day\u2019s difficulty is random too, with a balanced mix of Easy, Medium, Hard and Expert over time.</p><ul class="plain">
            <li>${FD.icon('target', { size: 18 })}<span>In a Scenario Match or Prompt Lab Daily Challenge you get three picks, worth ${cfg.scenarioMatch.points.join(', ')} points. Miss all three and it counts as a missed day.</span></li>
            <li>${FD.icon('timer', { size: 18 })}<span>Finish fast for a Speed Bonus on top, whichever game mode the day is.</span></li>
            <li>${FD.icon('calendar', { size: 18 })}<span>There\u2019s no challenge on Saturdays and Sundays.</span></li>
            <li>${FD.icon('shield', { size: 18 })}<span>Weekends never break your streak.</span></li>
            <li>${FD.icon('timer', { size: 18 })}<span>A new challenge opens at midnight your local time. If the day ends before you finish, that challenge is over.</span></li></ul></div>
        </div>`, { id: 'a-diff' })}

        ${ui.section('More ways to play', html`<div class="about-cols">
          <div class="card"><h3>Free Play</h3><p>Unlimited puzzles from any game mode, with no pressure. Choose the game modes, level and categories, pick how many rounds (${cfg.freePlay.rounds.min} to ${cfg.freePlay.rounds.max}), then play a mix of puzzles at your own pace.</p></div>
          <div class="card"><h3>Packs</h3><p>Themed sets that mix all three game modes: official packs like Copilot Essentials, and a monthly spotlight. A puzzle you have played won\u2019t come back until you finish the pack.</p></div>
          <div class="card"><h3>Needs Another Look</h3><p>Find it in <a href="#/packs">Packs</a>. It\u2019s made for you based on all the puzzles you missed.</p></div>
        </div>`, { id: 'a-more' })}

        ${ui.section('Accessibility & privacy', html`<div class="about-cols">
          <div class="card"><h3>Built for everyone</h3><p>Fully keyboard friendly, screen reader labelled and designed to meet WCAG 2.2 AA contrast. You can reduce motion, boost contrast and enlarge text in <a href="#/settings">Settings</a>. Colours are never the only clue.</p><p class="muted small">Keyboard: <kbd>Tab</kbd> to move, <kbd>\u2191</kbd> <kbd>\u2193</kbd> to browse suggestions, <kbd>Enter</kbd> to choose or guess, <kbd>Esc</kbd> to close.</p></div>
          <div class="card"><h3>Your data stays yours</h3>${FD.auth.available()
            ? html`<p>No tracking. Your stats and collection are saved in your browser on this device only. Play as a guest, or sign in with Microsoft to put your name on the leaderboard: the game only asks Microsoft for your name and email address, and keeps them on this device too. You can export or erase everything in <a href="#/settings">Settings</a>.</p>`
            : html`<p>No accounts, no tracking. Your stats and collection are saved in your browser on this device only. You can export or erase everything in <a href="#/settings">Settings</a>.</p>`}</div>
        </div>`, { id: 'a-acc' })}

        <section class="about-brand c-blue" aria-labelledby="a-brand">
          <div><h2 id="a-brand">Made with care by Engage Squared</h2>
            <p>We understand the Microsoft tech. Equally, we understand that people are at the heart of technological transformation, and that we all think and work differently. So we tailor the tech until it fits.</p>
            <p class="tagline-big">${FD.tagline()}</p></div>
          <div class="brand-tab">${FD.logo({ width: 220 })}</div>
        </section>
      </div>`);
    }
  };
})();
