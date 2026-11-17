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
      const hintStep = cfg.points[0] - cfg.points[1], pk = cfg.promptLab.points, mins = Math.round(FD.scoring.speedWindowMs / 60000);

      main.innerHTML = flat(html`<div class="container hub about">
        <header class="hub-head about-head">
          <div><h1>About Copilot Feature-dle</h1>
          <p class="lede">Build Microsoft Copilot knowledge and skills through short, interactive games. Discover features, tackle real work scenarios and practice better prompting techniques across multiple game modes. Made by Engage Squared.</p></div>
          <div class="about-art" aria-hidden="true">${FD.pip('hello', { size: 170 })}</div>
        </header>

        ${ui.section('Three ways to build your Copilot skills', html`<div class="about-cols">
          <div class="card c-blue about-mode"><h3>${FD.icon('search', { size: 22 })}Feature Hunt</h3><p><strong>Know it.</strong> Work through a series of hints and try to identify the Copilot feature. Each guess narrows down the possibilities and reveals another clue about what the feature does.</p><a class="btn btn-ghost btn-sm" href="#/hunt">Play Feature Hunt</a></div>
          <div class="card c-purple about-mode"><h3>${FD.icon('puzzle', { size: 22 })}Scenario Match</h3><p><strong>Use it.</strong> Read a real work scenario and choose the Copilot feature that fits best. Once you\u2019ve made your choice, see why that feature is the right fit and learn how it can help in that situation.</p><a class="btn btn-ghost btn-sm" href="#/match">Play Scenario Match</a></div>
          <div class="card c-blue-50 about-mode"><h3>${FD.icon('flask', { size: 22 })}Prompt Lab</h3><p><strong>Prompt it.</strong> Read a real work scenario and choose the prompt most likely to get the best result. After you answer, see how each option uses goal, context, source and expectations and learn what makes a stronger prompt.</p><a class="btn btn-ghost btn-sm" href="#/prompts">Play Prompt Lab</a></div>
        </div>`, { id: 'a-modes' })}

        ${ui.section('How Feature Hunt works', html`<ol class="steps">
          <li class="c-blue"><span class="step-n">1</span><h3>Read the hint</h3><p>You start with the sneakiest clue. It\u2019s deliberately obscure but always accurate.</p></li>
          <li class="c-purple"><span class="step-n">2</span><h3>Make a guess</h3><p>Type a feature name. Full names, short names and even typos all work, and suggestions pop up as you type.</p></li>
          <li class="c-green"><span class="step-n">3</span><h3>Read the clue</h3><p>A wrong guess shows <strong>hot, warm or cold</strong>, whether the category matches, and if the answer is easier or harder. Pip\u2019s extras unlock as you go.</p></li>
        </ol>`, { id: 'a-how' })}

        ${ui.section('How Scenario Match and Prompt Lab work', html`<ol class="steps">
          <li class="c-blue"><span class="step-n">1</span><h3>Read the scenario</h3><p>Start with a realistic work situation and think about what the person is trying to achieve.</p></li>
          <li class="c-purple"><span class="step-n">2</span><h3>Choose the best answer</h3><p>In Scenario Match, choose the Copilot feature that fits best. In Prompt Lab, choose the prompt most likely to get the best result.</p></li>
          <li class="c-green"><span class="step-n">3</span><h3>See why</h3><p>Reveal the best answer and learn why it works. In Scenario Match, see why the feature fits the situation. In Prompt Lab, see what makes the stronger prompt and how each option uses goal, context, source and expectations.</p></li>
        </ol>`, { id: 'a-quiz' })}

        ${ui.section('Scoring', html`<div class="about-cols about-score">
          <div class="card"><h3>Daily Challenge speed bonus</h3><p>Answer quickly in the Daily Challenge to earn up to <strong>+${cfg.speedBonus.max} bonus points</strong>. The bonus drops by 1 point every ${cfg.speedBonus.secondsPerPoint} seconds and reaches 0 after ${mins} minutes. Once started, the timer keeps running even if you leave the challenge.</p></div>
          <div class="card"><h3>Feature Hunt points</h3><p>The fewer hints you need, the more points you earn. Score ${cfg.points[0]} points with one hint, decreasing by ${hintStep} points for each additional hint used.</p><table class="table"><thead><tr><th scope="col">Hints used</th><th scope="col">Points</th></tr></thead><tbody>${cfg.points.map((p, i) => html`<tr><th scope="row">${i + 1}</th><td>${p}</td></tr>`)}</tbody></table></div>
          <div class="card"><h3>Scenario Match &amp; Prompt Lab points</h3><p>You have three chances to find the best answer. Score ${pk[0]} points on your first pick, ${pk[1]} on your second or ${pk[2]} on your third. If all three picks are incorrect, the answer is revealed and no points are awarded.</p><table class="table"><thead><tr><th scope="col">Correct Pick</th><th scope="col">Points</th></tr></thead><tbody>${pk.map((p, i) => html`<tr><th scope="row">${['1st', '2nd', '3rd'][i]}</th><td>${p}</td></tr>`)}</tbody></table></div>
          <div class="card"><h3>XP &amp; ranks</h3><p>Every point you earn becomes 1 XP. Earn bonus XP for harder features, new discoveries and Daily Challenge streaks. Build your XP to climb the ranks from <strong>${cfg.ranks[0].name}</strong> to <strong>${top.name}</strong>.</p></div>
        </div>`, { id: 'a-score' })}

        ${ui.section('Difficulty & the Daily Challenge', html`<div class="about-cols">
          <div class="card"><h3>Four difficulties</h3><ul class="plain about-diffs">
            ${cfg.difficulties.map((d) => html`<li>${ui.diffChip(d)}<span>${cfg.levelInfo[d]} (${byDiff[d]}).</span></li>`)}</ul></div>
          <div class="card"><h3>The Daily Challenge</h3><p>Everyone gets the same Daily Challenge each weekday. The game mode and difficulty are randomly selected, with a mix of Feature Hunt, Scenario Match and Prompt Lab challenges.</p><ul class="plain">
            <li>${FD.icon('target', { size: 18 })}<span>Fail to complete the puzzle in the number of allowed guesses, Feature Hunt (${cfg.maxAttempts}) / Scenario Match (${cfg.scenarioMatch.maxTries}) / Prompt Lab (${cfg.promptLab.maxTries}), counts as a missed day.</span></li>
            <li>${FD.icon('calendar', { size: 18 })}<span>No Daily Challenges on weekends. Weekends don\u2019t break your streak.</span></li>
            <li>${FD.icon('timer', { size: 18 })}<span>A new challenge starts at midnight local time. If the day ends before you finish, that challenge closes.</span></li></ul></div>
        </div>`, { id: 'a-diff' })}

        ${ui.section('More ways to play', html`<div class="about-cols">
          <div class="card"><h3>Free Play</h3><p>Mix and match one, two or all three game modes. Choose your difficulty, categories and number of rounds, then play your way.</p></div>
          <div class="card"><h3>Packs</h3><p>Explore Official Packs focused on specific Copilot topics, plus Monthly Spotlights featuring new features and the latest Microsoft updates.</p></div>
          <div class="card"><h3>Needs Another Look</h3><p>Find it in <a href="#/packs">Packs</a>. Revisit puzzles you\u2019ve missed and try them again.</p></div>
        </div>`, { id: 'a-more' })}

        ${ui.section('Accessibility & privacy', html`<div class="about-cols">
          <div class="card"><h3>Built for everyone</h3><p>Designed to be keyboard and screen reader friendly, with clear labels, strong contrast and scalable text. Adjust motion, contrast and text size in <a href="#/settings">Settings</a>. Colour is never the only way information is communicated.</p><p class="muted small">Keyboard: <kbd>Tab</kbd> to move, <kbd>\u2191</kbd> <kbd>\u2193</kbd> to browse suggestions, <kbd>Enter</kbd> to choose or guess, <kbd>Esc</kbd> to close.</p></div>
          <div class="card"><h3>Data usage</h3><p>Your game data is used to track your progress and power features such as your organisation\u2019s leaderboard. You can delete your game data at any time in <a href="#/settings">Settings</a>.</p></div>
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
