/* Copilot Feature-dle · scoring, XP, ranks and achievement badges */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cfg = FD.config;
  const { slug, weekdayOfKey, addDays } = FD.u;

  /* ---------- points (never multiplied: everyone plays on the same scale) ---------- */
  const base = (hints) => cfg.points[Math.min(cfg.points.length, Math.max(1, hints)) - 1];
  /* the Speed Bonus starts at 40 for an instant answer and drops 1 point every 3 seconds, so it is 0 from 2 minutes on */
  const speedWindowMs = cfg.speedBonus.max * cfg.speedBonus.secondsPerPoint * 1000;
  function speed(ms) {
    if (ms == null) return 0;
    return Math.max(0, cfg.speedBonus.max - Math.floor(Math.max(0, ms) / (cfg.speedBonus.secondsPerPoint * 1000)));
  }
  /* the Speed Bonus belongs to the Daily Challenge (whichever game mode the day is); every other way to play scores the answer alone */
  const speedApplies = (mode) => mode === 'daily';
  const withSpeed = (b, ms, mode) => { const s = speedApplies(mode) ? speed(ms) : 0; return { base: b, speed: s, total: b + s }; };
  /* a Feature Hunt answer: the points for the hint it was solved on, plus the Speed Bonus on a Daily Challenge */
  const compute = ({ hints, ms, mode }) => withSpeed(base(hints), ms, mode);
  /* a Scenario Match or Prompt Lab answer: the points for the pick it was found on, plus the Speed Bonus on a Daily Challenge */
  const computeQuiz = ({ points, ms, mode }) => withSpeed(Math.max(0, points || 0), ms, mode);
  /* what the score would be right now if the player nailed it (for the live score panel) */
  const potential = (hintsShown, ms, mode) => compute({ hints: hintsShown, ms, mode });

  /* a live Daily Challenge streak earns extra XP on every correct answer */
  const streakXpPct = (days) => Math.min(cfg.streakXpMax, Math.max(0, days) * cfg.streakXpPerDay);

  /* ---------- ranks ---------- */
  function rank(xp) {
    const r = cfg.ranks;
    let i = 0;
    for (let k = 0; k < r.length; k++) if (xp >= r[k].xp) i = k;
    const cur = r[i], next = r[i + 1] || null;
    const pct = next ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100)) : 100;
    return { index: i, rank: cur, next, pct, toNext: next ? next.xp - xp : 0 };
  }

  /* ---------- what a player has done with a feature ----------
     Every feature has up to three layers of puzzles: KNOW it (its Feature Hunt, always one), USE it (its Scenario Match scenarios) and PROMPT it (its Prompt Lab scenarios,
     which not every feature has yet). A puzzle is done once it has been solved (a Feature Hunt solved, the best option picked within the allowed picks). A puzzle that was
     missed is not done: it waits in Needs Another Look until it is solved.
       known      its Feature Hunt is solved
       collected  at least one of its puzzles is done (the Feature Book colours it)
       mastered   every one of its puzzles is done (the Feature Book fills it with colour)
       spotted    seen but nothing done yet (a missed puzzle showed its answer) */
  const known = (p, f) => !!(p.collection[f.id] && p.collection[f.id].solved > 0);
  const byFeature = new WeakMap();
  /* a quiz engine's scenarios grouped by the feature they are about (worked out once per load of the scenarios) */
  const scenariosOf = (eng) => {
    if (!eng || !eng.ready) return {};
    let m = byFeature.get(eng.scenarios);
    if (!m) { m = {}; eng.scenarios.forEach((s) => { (m[s.feature] = m[s.feature] || []).push(s); }); byFeature.set(eng.scenarios, m); }
    return m;
  };
  /* a scenario counts as done once it has been solved (an entry saved by an earlier version has no "won" count, and every scenario it holds was solved) */
  const solvedIn = (seen, id) => { const e = seen && seen[id]; return !!e && (e.won != null ? e.won : e.n) > 0; };
  function layers(p, f) {
    const have = (eng, seen) => { const all = scenariosOf(eng)[f.id] || []; return { total: all.length, done: all.filter((s) => solvedIn(seen, s.id)).length, met: all.filter((s) => seen && seen[s.id]).length }; };
    const use = have(FD.scenarios, p.match && p.match.seen), prompt = have(FD.prompts, p.prompts && p.prompts.seen);
    const know = known(p, f), done = (know ? 1 : 0) + use.done + prompt.done, total = 1 + use.total + prompt.total;
    return {
      know, use, prompt, done, total,
      any: done > 0,
      /* every puzzle this feature has is done (a layer with nothing to play in it is simply not asked) */
      mastered: done === total,
      /* a puzzle done in each of the three layers (so only a feature that has Prompt Lab prompts can be one) */
      triple: know && use.done > 0 && prompt.done > 0
    };
  }
  const collected = (p, f) => layers(p, f).any;
  /* Not collected, Spotted, Collected or Mastered: how the Feature Book shows a feature */
  function bookState(p, f) {
    const L = layers(p, f);
    if (L.mastered) return 'mastered';
    if (L.any) return 'collected';
    const e = p.collection[f.id];
    return (e && e.seen > 0) || L.use.met > 0 || L.prompt.met > 0 ? 'spotted' : 'new';
  }

  /* ---------- Needs Another Look: the puzzles you missed. A Feature Hunt you missed (revealed, or out of hints), or a Scenario Match or Prompt Lab question you missed (three
     picks, no best one). Get one right, in any number of hints or picks, and it comes off the list. The rule reads the latest try.
     A Feature Hunt save from before that was tracked is judged on what the Feature Book already knew (seen, but never solved). ---------- */
  const needsLook = (e) => {
    if (!e) return false;
    if (e.last) return !e.last.won;
    return e.solved === 0 && e.seen > 0;
  };
  /* the features whose Feature Hunt needs another look, the most recent miss first */
  function lookList(p, lib) {
    return lib.features
      .filter((f) => needsLook(p.collection[f.id]))
      .sort((a, b) => { const x = p.collection[a.id], y = p.collection[b.id]; return ((y.last && y.last.t) || 0) - ((x.last && x.last.t) || 0) || (a.name < b.name ? -1 : 1); });
  }
  /* everything that needs another look, from all three game modes, the most recent miss first:
     { key, kind: 'feature' | 'match' | 'prompt', id, feature }. A pack stores a Feature Hunt puzzle under its feature's id, and a question as 'match:<id>' or 'prompt:<id>'. */
  function lookItems(p, lib) {
    const out = lookList(p, lib).map((f) => ({ key: f.id, kind: 'feature', id: f.id, feature: f.id, t: (p.collection[f.id].last && p.collection[f.id].last.t) || 0 }));
    [['match', FD.scenarios, p.match], ['prompt', FD.prompts, p.prompts]].forEach(([kind, eng, st]) => {
      const seen = (st && st.seen) || {};
      if (!eng || !eng.ready) return;
      eng.scenarios.forEach((s) => { const e = seen[s.id]; if (e && e.miss && lib.byId[s.feature]) out.push({ key: kind + ':' + s.id, kind, id: s.id, feature: s.feature, t: e.last || 0 }); });
    });
    return out.sort((a, b) => b.t - a.t || (a.key < b.key ? -1 : 1));
  }

  /* ---------- badges ---------- */
  const officialByCat = (lib, cat) => lib.features.filter((f) => f.category === cat);
  const solvedCount = (p, lib, pred) => lib.features.filter((f) => (!pred || pred(f)) && collected(p, f)).length;
  const dailyWins = (p) => Object.values(p.daily.results).filter((r) => r && r.won);
  /* every weekday of a Monday-to-Friday week won (a weekend never matters) */
  const perfectWeek = (p) => Object.keys(p.daily.results).some((k) => weekdayOfKey(k) === 1 && [0, 1, 2, 3, 4].every((n) => { const r = p.daily.results[addDays(k, n)]; return !!(r && r.won); }));
  const masteredCount = (p, lib) => lib.features.filter((f) => layers(p, f).mastered).length;
  const tripleCount = (p, lib) => lib.features.filter((f) => layers(p, f).triple).length;

  /* everything played across the three game modes: Feature Hunt games, then Scenario Match and Prompt Lab questions (each counts when it is answered) */
  function totals(p) {
    const h = p.stats, m = p.match || {}, l = p.prompts || {};
    const hunt = { played: h.played || 0, solved: h.won || 0 };
    const match = { played: m.questions || 0, solved: m.correct || 0, firstTry: m.firstTry || 0 };
    const prompt = { played: l.questions || 0, solved: l.correct || 0, firstTry: l.firstTry || 0 };
    return { hunt, match, prompt, puzzles: hunt.played + match.played + prompt.played, solved: hunt.solved + match.solved + prompt.solved };
  }

  /* which of the game modes and ways to play this player has tried (older saves are read from what they already hold) */
  const modesTried = (p) => ({
    hunt: (p.stats.played || 0) > 0 || (p.counters.played_hunt || 0) > 0 || p.history.some((h) => h.kind === 'hunt'),
    match: (p.match.questions || 0) > 0 || (p.match.runs || 0) > 0,
    prompt: (p.prompts.runs || 0) > 0 || (p.prompts.questions || 0) > 0,
    free: (p.counters.played_free || 0) > 0 || p.history.some((h) => h.mode === 'free'),
    pack: (p.counters.played_pack || 0) > 0 || Object.values(p.packs).some((e) => e && Array.isArray(e.done) && e.done.length > 0)
  });
  const STATIC = [
    { id: 'first-spark', name: 'First Spark', desc: 'Solve your very first feature.', color: 'yellow', icon: 'sparkle', check: (p) => p.stats.won >= 1 },
    { id: 'one-hint', name: 'One-Hint Wonder', desc: 'Guess a feature from the very first hint.', color: 'pink', icon: 'bulb', check: (p, c) => c.won && c.hintsUsed === 1 },
    { id: 'quick-draw', name: 'Quick Draw', desc: 'Solve a Daily Challenge in under 20 seconds, in any game mode.', color: 'green', icon: 'bolt', check: (p, c) => c.won && c.mode === 'daily' && c.timeMs != null && c.timeMs < 20000 },
    { id: 'comeback', name: 'Comeback Kid', desc: 'Solve a feature on your very last hint.', color: 'blue', icon: 'refresh', check: (p, c) => c.won && c.hintsUsed === FD.config.maxAttempts },
    { id: 'typo-ninja', name: 'Typo? No problem!', desc: 'Win even though you made a typo.', color: 'purple', icon: 'pencil', check: (p, c) => c.won && c.typo },
    { id: 'daily-3', name: 'Daily Devotee', desc: 'Win 3 Daily Challenges in a row.', color: 'blue', icon: 'calendar', check: (p) => p.daily.max >= 3 },
    { id: 'daily-7', name: 'Week Warrior', desc: 'Win 7 Daily Challenges in a row.', color: 'orange', icon: 'flame', check: (p) => p.daily.max >= 7 },
    { id: 'daily-30', name: 'Month Maestro', desc: 'Win 30 Daily Challenges in a row. Wow.', color: 'red', icon: 'crown', check: (p) => p.daily.max >= 30 },
    { id: 'daily-10', name: 'Daily Regular', desc: 'Win 10 Daily Challenges.', color: 'green', icon: 'calendar', check: (p) => Object.values(p.daily.results).filter((r) => r.won).length >= 10 },
    { id: 'collector-10', name: 'Collector', desc: 'Collect 10 features in your Feature Book.', color: 'yellow', icon: 'book', check: (p, c, lib) => solvedCount(p, lib) >= 10 },
    { id: 'collector-25', name: 'Curator', desc: 'Collect 25 features in your Feature Book.', color: 'orange', icon: 'book', check: (p, c, lib) => solvedCount(p, lib) >= 25 },
    { id: 'feature-master', name: 'Feature Master', desc: 'Master every feature in the library: complete every one of its puzzles.', color: 'purple', icon: 'crown', check: (p, c, lib) => { const all = lib.features; return all.length > 0 && all.every((f) => layers(p, f).mastered); } },
    { id: 'hard-hero', name: 'Hard Mode Hero', desc: 'Solve a Hard feature.', color: 'red', icon: 'medal', check: (p, c, lib) => solvedCount(p, lib, (f) => f.difficulty === 'Hard') >= 1 },
    { id: 'expert-insider', name: 'Expert Insider', desc: 'Solve an Expert feature.', color: 'navy', icon: 'star', check: (p, c, lib) => solvedCount(p, lib, (f) => f.difficulty === 'Expert') >= 1 },
    { id: 'prompt-pilot', name: 'Prompt Pilot', desc: 'Copy an example prompt to try in Copilot.', color: 'pink', icon: 'copy', check: (p) => (p.counters.promptCopies || 0) >= 1 },
    { id: 'doc-diver', name: 'Doc Diver', desc: 'Open a Microsoft Learn link to dig deeper.', color: 'blue', icon: 'external', check: (p) => (p.counters.docOpens || 0) >= 1 },
    { id: 'rounds-5', name: 'Five Alive', desc: 'Solve 5 puzzles in one game of Free Play or Feature Hunt.', color: 'pink', icon: 'target', check: (p) => (p.counters.roundBestSolved || 0) >= 5 },
    { id: 'match-first', name: 'Scenario Starter', desc: 'Finish a Scenario Match game.', color: 'purple', icon: 'puzzle', check: (p) => p.match.runs >= 1 },
    { id: 'pack-leader', name: 'Pack Leader', desc: 'Finish a whole pack or monthly spotlight.', color: 'orange', icon: 'package', check: (p) => (p.counters.packsFinished || 0) >= 1 },
    { id: 'second-look', name: 'Second Look', desc: 'Clear a puzzle from Needs Another Look.', color: 'orange', icon: 'refresh', check: (p) => (p.counters.reviewCleared || 0) >= 1 },
    { id: 'prompt-crafter', name: 'Prompt Crafter', desc: 'Pick the best prompt first time, 10 times in Prompt Lab.', color: 'blue', icon: 'pencil', check: (p) => (p.counters.promptFirstTry || 0) >= 10 },
    { id: 'prompt-pro', name: 'Prompt Pro', desc: 'Get every pick right first time in a Prompt Lab game of 3 or more rounds.', color: 'purple', icon: 'flask', check: (p) => (p.counters.promptPerfect || 0) >= 1 },

    /* ----- the harder ones, and the badges for the newer ways to play (rounds in Free Play and Feature Hunt, Packs, Needs Another Look, Scenario Match, Prompt Lab) ----- */
    { id: 'daily-14', name: 'Fortnight Flame', desc: 'Win 14 Daily Challenges in a row. Your flame is blazing.', color: 'red', icon: 'flame', check: (p) => p.daily.max >= 14 },
    { id: 'daily-flawless', name: 'Flawless Daily', desc: 'Solve a Daily Challenge from the very first hint.', color: 'pink', icon: 'target', check: (p) => dailyWins(p).some((r) => r.hints === 1) },
    { id: 'daily-perfect-week', name: 'Perfect Week', desc: 'Win all five Daily Challenges in one week, Monday to Friday.', color: 'green', icon: 'calendar', check: (p) => perfectWeek(p) },
    { id: 'perfect-score', name: 'Perfect Score', desc: 'Solve a Daily Challenge Feature Hunt from the first hint in under 15 seconds, for the most points a feature can earn.', color: 'yellow', icon: 'star', check: (p, c) => c.won && c.mode === 'daily' && c.hintsUsed === 1 && c.timeMs != null && c.timeMs < cfg.perfectScoreMs },
    { id: 'level-climber', name: 'Difficulty Climber', desc: 'Solve at least one feature at every difficulty.', color: 'blue', icon: 'up', check: (p, c, lib) => cfg.difficulties.every((d) => solvedCount(p, lib, (f) => f.difficulty === d) >= 1) },
    { id: 'collector-50', name: 'Bookworm', desc: 'Collect 50 features in your Feature Book.', color: 'green', icon: 'book', check: (p, c, lib) => solvedCount(p, lib) >= 50 },
    { id: 'expert-10', name: 'Expert Hunter', desc: 'Collect 10 Expert features.', color: 'navy', icon: 'medal', check: (p, c, lib) => solvedCount(p, lib, (f) => f.difficulty === 'Expert') >= 10 },
    { id: 'mode-explorer', name: 'Mode Explorer', desc: 'Try every game mode and way to play: Feature Hunt, Scenario Match, Prompt Lab, Free Play and Packs.', color: 'orange', icon: 'shuffle', check: (p) => Object.values(modesTried(p)).every(Boolean) },
    { id: 'rounds-games', name: 'Round Regular', desc: `Finish 5 games of ${cfg.roundGameMin} or more rounds in Free Play or Feature Hunt.`, color: 'pink', icon: 'shuffle', check: (p) => (p.counters.roundGames || 0) >= 5 },
    { id: 'rounds-10', name: 'Clean Sweep', desc: 'Solve all 10 puzzles in a 10-round game of Free Play or Feature Hunt.', color: 'red', icon: 'star', check: (p) => (p.counters.roundBestSolved || 0) >= 10 },
    { id: 'match-10', name: 'Good Instincts', desc: 'Match the right feature first time, 10 times in Scenario Match.', color: 'orange', icon: 'target', check: (p) => (p.counters.matchFirstTry || 0) >= 10 },
    { id: 'match-50', name: 'Scenario Sage', desc: 'Match the right feature first time, 50 times in Scenario Match.', color: 'green', icon: 'bulb', check: (p) => (p.counters.matchFirstTry || 0) >= 50 },
    { id: 'match-pro', name: 'Perfect Match', desc: 'Get every pick right first time in a Scenario Match game of 3 or more rounds.', color: 'pink', icon: 'puzzle', check: (p) => (p.counters.matchPerfect || 0) >= 1 },
    { id: 'spotlight', name: 'Spotlight Seeker', desc: 'Finish a monthly spotlight.', color: 'yellow', icon: 'sparkle', check: (p) => (p.counters.spotlightsFinished || 0) >= 1 },
    { id: 'review-run', name: 'Back for More', desc: 'Play through everything in Needs Another Look.', color: 'orange', icon: 'refresh', check: (p) => (p.counters.reviewRuns || 0) >= 1 },
    { id: 'review-10', name: 'Redemption Arc', desc: 'Clear 10 puzzles from Needs Another Look.', color: 'red', icon: 'shield', check: (p) => (p.counters.reviewCleared || 0) >= 10 },
    { id: 'prompt-5', name: 'Prompt Regular', desc: 'Finish 5 Prompt Lab games.', color: 'blue', icon: 'flask', check: (p) => p.prompts.runs >= 5 },
    { id: 'prompt-50', name: 'Prompt Master', desc: 'Pick the best prompt first time, 50 times in Prompt Lab.', color: 'pink', icon: 'pencil', check: (p) => (p.counters.promptFirstTry || 0) >= 50 },
    { id: 'prompt-ten', name: 'Perfect Ten', desc: 'Get all 10 picks right first time in a 10-round Prompt Lab game.', color: 'purple', icon: 'crown', check: (p) => (p.counters.promptPerfectTen || 0) >= 1 },
    { id: 'triple-threat', name: 'Triple Threat', desc: 'Know it, Use it and Prompt it: solve a feature in Feature Hunt, match one of its scenarios and pick its best prompt.', color: 'blue', icon: 'crown', check: (p, c, lib) => tripleCount(p, lib) >= 1 },
    { id: 'toolkit-10', name: 'Toolkit Builder', desc: 'Master 10 features: complete every puzzle they have, in every game mode.', color: 'red', icon: 'medal', check: (p, c, lib) => masteredCount(p, lib) >= 10 },
    { id: 'pip-friend', name: 'Pip\u2019s Friend', desc: 'Click Pip on the home page to say hello again.', color: 'green', icon: 'sparkle', check: (p) => (p.counters.pipHellos || 0) >= 1 },
    { id: 'champion', name: 'Copilot Champion', desc: 'Reach the Copilot Champion rank.', color: 'purple', icon: 'crown', check: (p) => rank(p.xp).index >= cfg.ranks.length - 1 }
  ];

  /* one "Category Master" per category (this is the Feature Master status): every feature in it mastered */
  function masterBadges(lib) {
    return lib.categories
      .filter((c) => officialByCat(lib, c.name).length >= 2)
      .map((c) => ({
        id: 'master-' + slug(c.name), name: c.name + ' Master', desc: `Master every ${c.name} feature: complete all of its puzzles.`, color: c.color, icon: c.icon || 'crown', master: true, category: c.name,
        check: (p, ctx, l) => { const fs = officialByCat(l, c.name); return fs.length >= 2 && fs.every((f) => layers(p, f).mastered); }
      }));
  }
  const all = (lib) => STATIC.concat(masterBadges(lib));

  /* award anything newly earned; returns the badge definitions that were just unlocked */
  function evaluate(p, ctx, lib) {
    const earned = [];
    all(lib).forEach((b) => {
      if (p.badges[b.id]) return;
      let ok = false;
      try { ok = b.check(p, ctx || {}, lib); } catch (e) { ok = false; }
      if (ok) { p.badges[b.id] = Date.now(); earned.push(b); }
    });
    return earned;
  }

  /* Feature Master status = categories with every feature mastered. Each row also says how many features are collected, and how many of the category's puzzles are done in each game mode. */
  function masterStatus(p, lib) {
    const cats = lib.categories.filter((c) => officialByCat(lib, c.name).length >= 2);
    const rows = cats.map((c) => {
      const fs = officialByCat(lib, c.name);
      const ls = fs.map((f) => layers(p, f));
      const have = ls.filter((L) => L.any).length, mastered = ls.filter((L) => L.mastered).length;
      const sum = (pick) => ls.reduce((a, L) => ({ done: a.done + pick(L).done, total: a.total + pick(L).total }), { done: 0, total: 0 });
      const puzzles = { know: sum((L) => ({ done: L.know ? 1 : 0, total: 1 })), use: sum((L) => L.use), prompt: sum((L) => L.prompt) };
      return { category: c, have, mastered, total: fs.length, master: mastered === fs.length, puzzles, features: fs, layers: ls };
    });
    return { rows, mastered: rows.filter((r) => r.master).length, total: rows.length };
  }

  /* a player's total score: every point scored in Feature Hunt, Scenario Match and Prompt Lab. The Stats page, the leaderboard, a player's profile and the shared board all use this one sum. */
  const totalScore = (p) => (p.stats.totalScore || 0) + ((p.match && p.match.points) || 0) + ((p.prompts && p.prompts.points) || 0);

  /* a player's headline numbers, used by the leaderboard profile and the stats page */
  function summary(p, lib) {
    const badgeDefs = all(lib);
    const rk = rank(p.xp);
    return {
      played: totals(p).puzzles, maxStreak: p.daily.max, bestScore: p.stats.bestScore, xp: p.xp, rank: rk,
      collected: lib.features.filter((f) => collected(p, f)).length, collectedTotal: lib.features.length,
      achievements: badgeDefs.filter((b) => p.badges[b.id]).length, achievementsTotal: badgeDefs.length
    };
  }

  FD.scoring = { base, speed, speedWindowMs, speedApplies, compute, computeQuiz, potential, streakXpPct, rank, known, collected, bookState, solvedIn, solvedCount, summary, needsLook, lookList, lookItems, modesTried, layers, masteredCount, tripleCount, totals, totalScore };
  FD.badges = { all, evaluate, masterStatus };
})();
