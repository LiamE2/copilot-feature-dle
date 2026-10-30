/* Copilot Feature-dle · scoring, XP, ranks, difficulty unlocks and achievement badges */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cfg = FD.config;
  const { slug } = FD.u;

  /* ---------- points ---------- */
  const base = (hints) => cfg.points[Math.min(cfg.points.length, Math.max(1, hints)) - 1];
  function speed(ms, relaxed) {
    if (relaxed || ms == null) return 0;
    for (const t of cfg.speedBonus) if (ms <= t.maxMs) return t.pts;
    return 0;
  }
  const multiplier = (streakBefore) => Math.round((1 + cfg.streakStep * Math.min(Math.max(0, streakBefore), cfg.streakCap)) * 100) / 100;
  function compute({ hints, ms, streakBefore, relaxed }) {
    const b = base(hints), s = speed(ms, relaxed), m = multiplier(streakBefore);
    return { base: b, speed: s, multiplier: m, subtotal: b + s, total: Math.round((b + s) * m) };
  }
  /* what the score would be right now if the player nailed it (for the live score panel) */
  const potential = (hintsShown, ms, streakBefore, relaxed) => compute({ hints: hintsShown, ms, streakBefore, relaxed });

  /* ---------- ranks ---------- */
  function rank(xp) {
    const r = cfg.ranks;
    let i = 0;
    for (let k = 0; k < r.length; k++) if (xp >= r[k].xp) i = k;
    const cur = r[i], next = r[i + 1] || null;
    const pct = next ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100)) : 100;
    return { index: i, rank: cur, next, pct, toNext: next ? next.xp - xp : 0 };
  }

  /* ---------- difficulty unlocks (Free Play only) ---------- */
  const collected = (p, f) => !!(p.collection[f.id] && p.collection[f.id].solved > 0);
  function unlocks(p, lib, settings) {
    const res = {};
    cfg.difficulties.forEach((d) => {
      if (d === 'Easy' || (settings && settings.unlockAll)) { res[d] = { unlocked: true, have: 0, need: 0, from: null }; return; }
      const u = cfg.unlocks[d];
      const have = lib.features.filter((f) => !f.community && f.difficulty === u.from && collected(p, f)).length;
      res[d] = { unlocked: have >= u.need, have: Math.min(have, u.need), need: u.need, from: u.from };
    });
    return res;
  }

  /* ---------- badges ---------- */
  const officialByCat = (lib, cat) => lib.features.filter((f) => !f.community && f.category === cat);
  const solvedCount = (p, lib, pred) => lib.features.filter((f) => !f.community && (!pred || pred(f)) && collected(p, f)).length;

  const STATIC = [
    { id: 'first-spark', name: 'First Spark', desc: 'Solve your very first feature.', color: 'yellow', icon: 'sparkle', check: (p) => p.stats.won >= 1 },
    { id: 'hat-trick', name: 'Hat-trick', desc: 'Win 3 games in a row.', color: 'orange', icon: 'flame', check: (p) => p.stats.maxWinStreak >= 3 },
    { id: 'unstoppable', name: 'Unstoppable', desc: 'Win 10 games in a row.', color: 'red', icon: 'flame', check: (p) => p.stats.maxWinStreak >= 10 },
    { id: 'one-hint', name: 'One-Hint Wonder', desc: 'Guess a feature from the very first hint.', color: 'pink', icon: 'bulb', check: (p, c) => c.won && c.hintsUsed === 1 },
    { id: 'quick-draw', name: 'Quick Draw', desc: 'Solve a feature in under 20 seconds.', color: 'green', icon: 'bolt', check: (p, c) => c.won && !c.relaxed && c.timeMs != null && c.timeMs < 20000 },
    { id: 'comeback', name: 'Comeback Kid', desc: 'Solve a feature on your very last hint.', color: 'blue', icon: 'refresh', check: (p, c) => c.won && c.hintsUsed === FD.config.maxAttempts },
    { id: 'typo-ninja', name: 'Typo? No problem!', desc: 'Win even though you made a typo.', color: 'purple', icon: 'pencil', check: (p, c) => c.won && c.typo },
    { id: 'daily-3', name: 'Daily Devotee', desc: 'Win the Daily Challenge 3 days in a row.', color: 'blue', icon: 'calendar', check: (p) => p.daily.max >= 3 },
    { id: 'daily-7', name: 'Week Warrior', desc: 'Win the Daily Challenge 7 days in a row.', color: 'orange', icon: 'flame', check: (p) => p.daily.max >= 7 },
    { id: 'daily-30', name: 'Month Maestro', desc: 'A 30-day Daily Challenge winning streak. Wow.', color: 'red', icon: 'crown', check: (p) => p.daily.max >= 30 },
    { id: 'daily-10', name: 'Daily Regular', desc: 'Win 10 Daily Challenges.', color: 'green', icon: 'calendar', check: (p) => Object.values(p.daily.results).filter((r) => r.won).length >= 10 },
    { id: 'collector-10', name: 'Collector', desc: 'Collect 10 features in your Feature Book.', color: 'yellow', icon: 'book', check: (p, c, lib) => solvedCount(p, lib) >= 10 },
    { id: 'collector-25', name: 'Curator', desc: 'Collect 25 features in your Feature Book.', color: 'orange', icon: 'book', check: (p, c, lib) => solvedCount(p, lib) >= 25 },
    { id: 'feature-master', name: 'Feature Master', desc: 'Collect every feature in the library.', color: 'purple', icon: 'crown', check: (p, c, lib) => { const all = lib.features.filter((f) => !f.community); return all.length > 0 && all.every((f) => collected(p, f)); } },
    { id: 'hard-hero', name: 'Hard Mode Hero', desc: 'Solve a Hard feature.', color: 'red', icon: 'medal', check: (p, c, lib) => solvedCount(p, lib, (f) => f.difficulty === 'Hard') >= 1 },
    { id: 'expert-insider', name: 'Expert Insider', desc: 'Solve an Expert feature.', color: 'navy', icon: 'star', check: (p, c, lib) => solvedCount(p, lib, (f) => f.difficulty === 'Expert') >= 1 },
    { id: 'prompt-pilot', name: 'Prompt Pilot', desc: 'Copy an example prompt to try in Copilot.', color: 'pink', icon: 'copy', check: (p) => (p.counters.promptCopies || 0) >= 1 },
    { id: 'doc-diver', name: 'Doc Diver', desc: 'Open a Microsoft Learn link to dig deeper.', color: 'blue', icon: 'external', check: (p) => (p.counters.docOpens || 0) >= 1 },
    { id: 'sharer', name: 'Sharing is Caring', desc: 'Share a result with a colleague.', color: 'green', icon: 'share', check: (p) => (p.counters.shares || 0) >= 1 },
    { id: 'speed-demon', name: 'Speed Demon', desc: 'Solve 5 features in one Speed Round.', color: 'pink', icon: 'timer', check: (p) => (p.counters.speedBestSolved || 0) >= 5 },
    { id: 'team-player', name: 'Team Player', desc: 'Finish a Team Battle.', color: 'purple', icon: 'users', check: (p) => (p.counters.teamBattles || 0) >= 1 },
    { id: 'pack-leader', name: 'Pack Leader', desc: 'Import a community feature pack.', color: 'orange', icon: 'package', check: (p) => (p.counters.packsImported || 0) >= 1 },
    { id: 'champion', name: 'Copilot Champion', desc: 'Reach the Copilot Champion rank.', color: 'purple', icon: 'crown', check: (p) => rank(p.xp).index >= cfg.ranks.findIndex((r) => r.id === 'champion') }
  ];

  /* one "Category Master" per official category (this is the Feature Master status) */
  function masterBadges(lib) {
    return lib.categories
      .filter((c) => officialByCat(lib, c.name).length >= 2)
      .map((c) => ({
        id: 'master-' + slug(c.name), name: c.name + ' Master', desc: `Collect every ${c.name} feature.`, color: c.color, icon: c.icon || 'crown', master: true, category: c.name,
        check: (p, ctx, l) => { const fs = officialByCat(l, c.name); return fs.length >= 2 && fs.every((f) => collected(p, f)); }
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

  /* Feature Master status = categories fully collected */
  function masterStatus(p, lib) {
    const cats = lib.categories.filter((c) => officialByCat(lib, c.name).length >= 2);
    const rows = cats.map((c) => {
      const fs = officialByCat(lib, c.name);
      const have = fs.filter((f) => collected(p, f)).length;
      return { category: c, have, total: fs.length, master: have === fs.length };
    });
    return { rows, mastered: rows.filter((r) => r.master).length, total: rows.length };
  }

  FD.scoring = { base, speed, multiplier, compute, potential, rank, unlocks, collected, solvedCount };
  FD.badges = { all, evaluate, masterStatus };
})();
