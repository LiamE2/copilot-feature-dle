/* Copilot Feature-dle · persistence (localStorage with in-memory fallback), the player profile, stats, XP, collection, pack progress */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cfg = FD.config;
  const { storage, uid, dateKey, addDays, debounce, isWeekend, lastWeekday, prevWeekday } = FD.u;
  /* every project on a github.io address shares one storage area, so the key is specific to this game.
     ?ns=name gives tests and demos their own save slot, so they can never touch a real player's progress. */
  const ns = (new URLSearchParams(location.search).get('ns') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  const KEY = 'copilot-feature-dle.v1' + (ns ? '.' + ns : '');
  const bus = FD.u.emitter();

  const defaultSettings = () => ({ sound: false, motion: 'system', contrast: false, textScale: 1, hideFromBoard: false, confetti: true, haptics: true });
  const COLORS = ['blue', 'red', 'purple', 'orange', 'green', 'pink', 'yellow', 'navy'];
  /* what each question-and-answer game mode (Prompt Lab, Scenario Match) remembers: rounds answered, first-pick answers, points, games and best game, and which scenarios have been met.
     A scenario that has been met is { n: times played, firstTry, last: when, won: times solved, miss: 1 while the latest try was a miss (it is in Needs Another Look) }. */
  const newQuizStats = () => ({ questions: 0, firstTry: 0, correct: 0, points: 0, runs: 0, bestRun: 0, perfectRuns: 0, seen: {} });
  const newProfile = (name, color) => ({
    id: uid('p_'), name: name || 'Player', color: color || 'blue', created: Date.now(), xp: 0,
    stats: { played: 0, won: 0, lost: 0, totalScore: 0, bestScore: 0, hist: [0, 0, 0, 0, 0], fails: 0, totalTimeMs: 0, fastestMs: null },
    daily: { streak: 0, max: 0, last: null, results: {} },
    collection: {}, badges: {}, active: {}, counters: {}, packs: {}, history: [], roundsBest: 0, prompts: newQuizStats(), match: newQuizStats()
  });

  let state = null;

  const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, max);
  const whole = (v) => Math.max(0, Math.round(Number(v) || 0));

  function cleanQuiz(src, qcfg) {
    const ps = src && typeof src === 'object' && !Array.isArray(src) ? src : {}, out = newQuizStats();
    ['questions', 'firstTry', 'correct', 'points', 'runs', 'bestRun', 'perfectRuns'].forEach((k) => { out[k] = whole(ps[k]); });
    /* a best game can never be more than the most a game can score (an older scoring scale could have left a bigger number behind) */
    out.bestRun = Math.min(out.bestRun, qcfg.points[0] * qcfg.rounds.max);
    if (ps.seen && typeof ps.seen === 'object' && !Array.isArray(ps.seen)) {
      Object.keys(ps.seen).slice(0, 700).forEach((id) => {
        const e = ps.seen[id];
        if (/^[\w-]{1,60}$/.test(id) && id !== '__proto__' && e && typeof e === 'object') {
          const n = whole(e.n);
          /* an entry saved before a scenario could be missed has no "won": every time it was played it was solved */
          out.seen[id] = { n, firstTry: whole(e.firstTry), last: Number(e.last) || 0, won: e.won == null ? n : Math.min(n, whole(e.won)) };
          if (e.miss) out.seen[id].miss = 1;
        }
      });
    }
    return out;
  }
  function ensureProfile(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    const d = newProfile(p.name, p.color);
    p.id = typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) && p.id !== '__proto__' ? p.id : d.id;
    p.name = String(p.name == null ? '' : p.name).trim().slice(0, 24) || 'Player';
    p.color = COLORS.includes(p.color) ? p.color : 'blue';
    p.xp = Math.max(0, Number(p.xp) || 0);
    p.stats = Object.assign(d.stats, p.stats && typeof p.stats === 'object' ? p.stats : {});
    delete p.stats.winStreak; delete p.stats.maxWinStreak; /* ordinary win streaks are gone: only the Daily streak counts */
    if (!Array.isArray(p.stats.hist) || p.stats.hist.length !== 5) p.stats.hist = [0, 0, 0, 0, 0];
    p.daily = Object.assign(d.daily, p.daily && typeof p.daily === 'object' ? p.daily : {});
    p.daily.results = p.daily.results && typeof p.daily.results === 'object' ? p.daily.results : {};
    ['collection', 'badges', 'active', 'counters', 'packs'].forEach((k) => { p[k] = p[k] && typeof p[k] === 'object' && !Array.isArray(p[k]) ? p[k] : {}; });
    Object.keys(p.packs).forEach((k) => {
      const e = p.packs[k];
      if (!e || typeof e !== 'object' || Array.isArray(e)) { delete p.packs[k]; return; }
      e.done = Array.isArray(e.done) ? e.done.filter((x) => typeof x === 'string') : [];
      if (e.queue !== undefined) e.queue = Array.isArray(e.queue) ? e.queue.filter((x) => typeof x === 'string').slice(0, 80) : [];
    });
    p.history = Array.isArray(p.history) ? p.history : [];
    /* the best score in a game of rounds (Free Play or Feature Hunt) */
    p.roundsBest = Number(p.roundsBest) || 0;
    /* the timer is gone from Free Play: a timed round left unfinished, the best score and the counters it kept are let go, and so are the one-puzzle games older versions kept
       under 'free' and 'hunt' (a game of rounds is saved under 'rounds:free' and 'rounds:hunt') */
    delete p.speedBest;
    ['speedRounds', 'speedBestSolved', 'played_speed'].forEach((k) => { delete p.counters[k]; });
    ['speed', 'free', 'hunt'].forEach((k) => { delete p.active[k]; });
    delete p.badges['speed-demon']; delete p.badges['speed-5']; delete p.badges['speed-10'];
    /* Prompt Lab and Scenario Match results (the same shape) */
    p.prompts = cleanQuiz(p.prompts, cfg.promptLab);
    p.match = cleanQuiz(p.match, cfg.scenarioMatch);
    /* Team Battle is gone: a game left unfinished in it is let go, and every other game mode is a hint game, a scenario or a prompt */
    delete p.active.team;
    p.history.forEach((h) => { if (h && typeof h === 'object' && !h.kind) h.kind = h.mode === 'prompt' ? 'prompt' : h.mode === 'match' ? 'match' : 'hunt'; });
    /* a Microsoft account belongs to the one profile that carries its id */
    if (p.account && typeof p.account === 'object' && !Array.isArray(p.account) && /^ms_[0-9a-f]{24}$/.test(p.id)) {
      const a = p.account;
      p.account = { provider: 'microsoft', name: clean(a.name, 120), email: clean(a.email, 160), tenant: clean(a.tenant, 64), at: Number(a.at) || Date.now() };
    } else delete p.account;
    return p;
  }
  function fresh() {
    const p = newProfile('Player', 'blue');
    return { v: 2, activeProfile: p.id, profiles: { [p.id]: p }, settings: defaultSettings(), meta: { created: Date.now(), onboarded: false } };
  }
  function load() {
    try { const raw = storage.get(KEY); state = raw ? JSON.parse(raw) : fresh(); } catch (e) { state = fresh(); }
    if (!state || typeof state !== 'object') state = fresh();
    state.settings = Object.assign(defaultSettings(), state.settings || {});
    ['relaxed', 'unlockAll', 'sampleBoard'].forEach((k) => { delete state.settings[k]; }); /* settings from older versions that no longer exist */
    delete state.community; /* community packs were retired */
    state.meta = state.meta || {};
    delete state.meta.event; /* the live event code was retired */
    if (!state.profiles || !Object.keys(state.profiles).length) { const f = fresh(); state.profiles = f.profiles; state.activeProfile = f.activeProfile; }
    Object.values(state.profiles).forEach(ensureProfile);
    if (!state.profiles[state.activeProfile]) state.activeProfile = Object.keys(state.profiles)[0];
    state.v = 2;
    return state;
  }
  const saveNow = () => { try { storage.set(KEY, JSON.stringify(state)); } catch (e) { /* quota */ } };
  const save = debounce(saveNow, 200);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });

  const profile = () => state.profiles[state.activeProfile];
  const settings = () => state.settings;
  const changed = () => { save(); bus.emit('change'); };

  /* ---------- settings -> DOM ---------- */
  function applySettings() {
    const s = state.settings, root = document.documentElement;
    const sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.dataset.motion = s.motion === 'reduce' || (s.motion === 'system' && sys) ? 'reduce' : 'full';
    root.dataset.contrast = s.contrast ? 'high' : 'normal';
    root.style.fontSize = Math.round(100 * Math.min(2, Math.max(0.8, Number(s.textScale) || 1))) + '%';
  }
  function setSetting(k, v) { state.settings[k] = v; applySettings(); changed(); }

  /* ---------- the player (one profile per device; every other profile on a shared device only shows on the leaderboard) ---------- */
  function renameProfile(name, color) {
    const p = profile();
    p.name = (name || '').trim().slice(0, 24) || p.name;
    if (COLORS.includes(color)) p.color = color;
    changed();
  }

  /* ---------- in-progress games (Daily Challenge, games of rounds in Free Play and Feature Hunt) ---------- */
  const getActive = (key) => profile().active[key] || null;
  function setActive(key, data) { profile().active[key] = data; save(); }
  function clearActive(key) { delete profile().active[key]; save(); }

  /* ---------- streaks: Saturdays and Sundays have no challenge, so they neither extend nor break a streak ---------- */
  function dailyStreak(p = profile(), today = dateKey()) {
    const d = p.daily;
    if (!d.last) return 0;
    const last = lastWeekday(d.last);
    const alive = isWeekend(today) ? last === lastWeekday(today) : last === today || last === prevWeekday(today);
    return alive ? d.streak : 0;
  }
  const dailyResult = (key, p = profile()) => p.daily.results[key] || null;

  /* ---------- the big one: record a finished game ---------- */
  function recordGame(r) {
    const p = profile(), s = p.stats, f = r.feature;
    const rankBefore = FD.scoring.rank(p.xp).index;
    const out = { won: !!r.won, expired: !!r.expired, feature: f, hints: r.hintsUsed, timeMs: r.timeMs, breakdown: null, xp: 0, levelUp: null, newBadges: [], firstTime: false, dailyStreak: null, bonusXp: [] };
    const entry = p.collection[f.id] || (p.collection[f.id] = { solved: 0, seen: 0, bestHints: null, first: null });
    const lookBefore = FD.scoring.needsLook(entry);
    s.played++;
    if (r.mode) p.counters['played_' + r.mode] = (p.counters['played_' + r.mode] || 0) + 1; /* how many games in each way to play (daily, free, hunt, pack) */

    if (r.won) {
      const b = FD.scoring.compute({ hints: r.hintsUsed, ms: r.timeMs, mode: r.mode });
      out.breakdown = b;
      s.won++;
      s.totalScore += b.total; s.bestScore = Math.max(s.bestScore, b.total);
      s.hist[Math.min(4, Math.max(0, r.hintsUsed - 1))]++;
      if (r.timeMs != null) { s.totalTimeMs += r.timeMs; s.fastestMs = s.fastestMs == null ? r.timeMs : Math.min(s.fastestMs, r.timeMs); }
      out.firstTime = entry.solved === 0;
      entry.solved++; entry.bestHints = entry.bestHints == null ? r.hintsUsed : Math.min(entry.bestHints, r.hintsUsed);
      entry.first = entry.first || Date.now();
    } else {
      s.lost++; s.fails++; entry.seen++;
    }

    /* Needs Another Look follows the latest try: a miss puts the feature on the list, getting it right (in any number of hints) takes it off */
    entry.last = { won: !!r.won, hints: r.hintsUsed, t: Date.now() };
    const lookAfter = FD.scoring.needsLook(entry);
    out.review = lookAfter ? (lookBefore ? 'stays' : 'added') : (lookBefore ? 'cleared' : null);
    if (out.review === 'cleared') p.counters.reviewCleared = (p.counters.reviewCleared || 0) + 1;

    /* daily bookkeeping */
    if (r.mode === 'daily' && r.dateKey) {
      const d = p.daily;
      const continues = !!d.last && lastWeekday(d.last) === prevWeekday(r.dateKey);
      d.results[r.dateKey] = { id: f.id, won: !!r.won, hints: r.hintsUsed, score: out.breakdown ? out.breakdown.total : 0, timeMs: r.timeMs, grid: r.grid || [], expired: !!r.expired };
      if (r.won) { d.streak = d.last === r.dateKey ? d.streak : (continues ? d.streak + 1 : 1); d.max = Math.max(d.max, d.streak); }
      else d.streak = 0;
      d.last = r.dateKey;
      out.dailyStreak = d.streak;
      delete p.active['daily:' + r.dateKey];
    }

    /* XP: a correct answer earns its score plus bonuses; a live Daily streak lifts every correct answer */
    let xp = r.won ? out.breakdown.total : cfg.lossXp;
    if (r.won) {
      if (cfg.difficultyXp[f.difficulty]) { xp += cfg.difficultyXp[f.difficulty]; out.bonusXp.push([`${f.difficulty} difficulty`, cfg.difficultyXp[f.difficulty]]); }
      if (out.firstTime) { xp += cfg.newFeatureXp; out.bonusXp.push(['New feature collected', cfg.newFeatureXp]); }
      if (r.mode === 'daily') { xp += cfg.dailyBonusXp; out.bonusXp.push(['Daily Challenge bonus', cfg.dailyBonusXp]); }
      const days = r.mode === 'daily' ? p.daily.streak : dailyStreak(p);
      const pct = FD.scoring.streakXpPct(days);
      if (pct > 0) { const extra = Math.max(1, Math.round(xp * pct)); xp += extra; out.bonusXp.push([`${days}-day Daily streak +${Math.round(pct * 100)}%`, extra]); }
    }
    out.xp = xp; p.xp += xp;
    if (r.mode === 'daily' && r.dateKey && p.daily.results[r.dateKey]) {
      Object.assign(p.daily.results[r.dateKey], { breakdown: out.breakdown, xp, bonusXp: out.bonusXp, guesses: r.guesses || [] });
    }
    const rankAfter = FD.scoring.rank(p.xp);
    if (rankAfter.index > rankBefore) out.levelUp = rankAfter.rank;

    p.history.unshift({ t: Date.now(), mode: r.mode, kind: 'hunt', id: f.id, name: f.name, won: !!r.won, hints: r.hintsUsed, score: out.breakdown ? out.breakdown.total : 0, timeMs: r.timeMs });
    if (p.history.length > 60) p.history.length = 60;

    out.newBadges = FD.badges.evaluate(p, { won: !!r.won, hintsUsed: r.hintsUsed, timeMs: r.timeMs, typo: !!r.typo, mode: r.mode, feature: f }, FD.lib);
    changed();
    if (FD.board && FD.board.submit) FD.board.submit(r, out);
    return out;
  }

  /* a Daily Challenge that was started but not finished when its day ended is over: it counts as missed.
     (Weekend keys can only come from older versions: they never touch a streak, so they are just cleared.) */
  function expireDailies(today = dateKey()) {
    const p = profile(), done = [];
    Object.keys(p.active).filter((k) => k.startsWith('daily:') && k.slice(6) < today).sort().forEach((k) => {
      const date = k.slice(6), saved = p.active[k];
      delete p.active[k];
      if (isWeekend(date) || p.daily.results[date]) return;
      if (saved && (saved.kind === 'match' || saved.kind === 'prompt')) {
        const scn = FD.quiz(saved.kind).byId[saved.id], qf = scn && FD.lib.byId[scn.feature];
        if (qf) { recordDailyQuiz(saved.kind, { scn, feature: qf, tries: FD.quiz(saved.kind).maxTries(), timeMs: 0, dateKey: date, won: false, expired: true }); done.push(date); }
        return;
      }
      const g = FD.Game.restore(saved);
      if (!g) return;
      g.expire();
      recordGame({ mode: 'daily', dateKey: date, feature: g.f, won: false, expired: true, hintsUsed: g.max, timeMs: Math.round(g.activeMs), grid: g.grid, guesses: g.guesses });
      done.push(date);
    });
    if (!done.length) changed();
    return done;
  }

  /* counters for engagement badges (prompt copies, doc opens...) */
  function bump(name, n = 1, max) {
    const p = profile();
    p.counters[name] = max ? Math.max(p.counters[name] || 0, n) : (p.counters[name] || 0) + n;
    const earned = FD.badges.evaluate(p, { event: name }, FD.lib);
    changed();
    return earned;
  }

  /* ---------- pack and spotlight progress: features already played in a pack are not offered again until it is finished ---------- */
  /* a pack counts as started once a feature is finished, or while one is left half-played (that game waits for you, paused) */
  function packProgress(id, ids) {
    const p = profile(), e = p.packs[id];
    const done = e ? e.done.filter((x) => ids.includes(x)) : [];
    return { done, count: done.length, total: ids.length, pct: ids.length ? Math.round((done.length / ids.length) * 100) : 0, started: done.length > 0 || !!(ids.length && p.active['pack:' + id]), complete: ids.length > 0 && done.length >= ids.length };
  }
  function packMarkDone(id, featureId, ids) {
    const p = profile(), e = p.packs[id] || (p.packs[id] = { done: [], runs: 0, finished: null });
    if (!e.done.includes(featureId)) e.done.push(featureId);
    const finished = ids.length > 0 && ids.every((x) => e.done.includes(x)) && !e.finished;
    if (finished) e.finished = Date.now();
    changed();
    return finished;
  }
  function packRestart(id) {
    const p = profile(), e = p.packs[id] || (p.packs[id] = { done: [], runs: 0, finished: null });
    e.done = []; e.finished = null; e.runs = (e.runs || 0) + 1;
    delete p.active['pack:' + id]; /* a half-played feature is let go too: the pack starts from the beginning */
    changed();
  }
  /* Needs Another Look is a pack that is made for you: each run plays what needs another look at that moment (its queue).
     The queue holds keys: a Feature Hunt puzzle is its feature's id, a question is 'match:<scenario id>' or 'prompt:<scenario id>'. */
  function reviewStart(keys) {
    const p = profile(), e = p.packs.review || (p.packs.review = { done: [], runs: 0, finished: null });
    e.queue = keys.filter((x) => typeof x === 'string').slice(0, 80); e.done = []; e.finished = null; e.runs = (e.runs || 0) + 1;
    delete p.active['pack:review'];
    changed();
  }

  /* ---------- Scenario Match and Prompt Lab: every round you answer is recorded straight away. Its points are XP one for one (like every other mode),
     it is added to your play history, and a finished game adds a bonus when every pick was right first time.
     A question is solved when its best option is picked within the allowed picks (it.solved is true). Miss them all (it.solved is false) and it earns nothing and goes to
     Needs Another Look, until it is solved.
     ctx.mode says which way it was played: 'free', 'pack', 'daily' (see recordDailyQuiz), or the game mode's own name when it is played on its own page. ---------- */
  const statsFor = (p, kind) => (kind === 'match' ? p.match : p.prompts);
  const qcfg = (kind) => (kind === 'match' ? cfg.scenarioMatch : cfg.promptLab);
  const KIND_NAME = { hunt: 'Feature Hunt', match: 'Scenario Match', prompt: 'Prompt Lab' };
  /* note a question as played in its stats: met once more, solved or missed. Returns 'added', 'stays', 'cleared' or null (the Needs Another Look change). */
  function markSeen(p, s, id, solved, first) {
    const e = s.seen[id] || (s.seen[id] = { n: 0, firstTry: 0, last: 0, won: 0 });
    const missBefore = !!e.miss;
    e.n++; if (first) e.firstTry++; e.last = Date.now();
    if (solved) { e.won = (e.won || 0) + 1; delete e.miss; } else e.miss = 1;
    const review = e.miss ? (missBefore ? 'stays' : 'added') : (missBefore ? 'cleared' : null);
    if (review === 'cleared') p.counters.reviewCleared = (p.counters.reviewCleared || 0) + 1;
    return review;
  }
  function recordQuizRound(kind, it, feature, ctx = {}) {
    const p = profile(), s = statsFor(p, kind);
    const rankBefore = FD.scoring.rank(p.xp).index;
    const solved = it.solved !== false, pts = solved ? Math.max(0, it.points || 0) : 0, first = solved && it.tries === 1, way = ctx.mode || kind;
    const out = { kind, solved, points: pts, xp: pts, firstTry: first, review: null, levelUp: null, newBadges: [] };
    s.questions++; s.points += pts; if (solved) s.correct++; if (first) s.firstTry++;
    out.review = markSeen(p, s, it.id, solved, first);
    p.xp += out.xp;
    if (first) { const c = kind === 'match' ? 'matchFirstTry' : 'promptFirstTry'; p.counters[c] = (p.counters[c] || 0) + 1; }
    p.counters['played_' + way] = (p.counters['played_' + way] || 0) + 1;
    p.history.unshift({ t: Date.now(), mode: way, kind, id: feature ? feature.id : '', name: feature ? feature.name : KIND_NAME[kind], won: solved, hints: it.tries, tries: it.tries, score: pts, timeMs: ctx.timeMs == null ? null : ctx.timeMs, sid: it.id });
    if (p.history.length > 60) p.history.length = 60;
    const after = FD.scoring.rank(p.xp);
    if (after.index > rankBefore) out.levelUp = after.rank;
    out.newBadges = FD.badges.evaluate(p, { event: kind }, FD.lib);
    changed();
    return out;
  }
  /* the end of a game: it counts as played, may be a new best, and a perfect one earns a bonus */
  function recordQuizGame(kind, items) {
    const p = profile(), s = statsFor(p, kind), pl = qcfg(kind), pre = kind === 'match' ? 'match' : 'prompt';
    const rankBefore = FD.scoring.rank(p.xp).index;
    const out = { kind, rounds: items.length, points: items.reduce((a, it) => a + (it.points || 0), 0), firstTry: items.filter((it) => it.solved !== false && it.tries === 1).length, missed: items.filter((it) => it.solved === false).length, perfect: false, best: false, bonusXp: 0, levelUp: null, newBadges: [] };
    out.perfect = items.length >= pl.perfectMinRounds && out.firstTry === items.length;
    out.best = out.points > s.bestRun;
    s.runs++; s.bestRun = Math.max(s.bestRun, out.points); if (out.perfect) s.perfectRuns++;
    out.bonusXp = out.perfect ? items.length * pl.perfectBonusPerRound : 0;
    p.xp += out.bonusXp;
    if (out.perfect) p.counters[pre + 'Perfect'] = (p.counters[pre + 'Perfect'] || 0) + 1;
    if (out.perfect && kind === 'prompt' && items.length >= pl.rounds.max) p.counters.promptPerfectTen = (p.counters.promptPerfectTen || 0) + 1; /* a perfect game of the longest length (Perfect Ten) */
    const after = FD.scoring.rank(p.xp);
    if (after.index > rankBefore) out.levelUp = after.rank;
    out.newBadges = FD.badges.evaluate(p, { event: kind }, FD.lib);
    changed();
    return out;
  }
  const recordPromptRound = (it, feature, ctx) => recordQuizRound('prompt', it, feature, ctx);
  const recordPromptGame = (items) => recordQuizGame('prompt', items);

  /* the end of a game of rounds in Free Play or Feature Hunt (every puzzle in it was recorded as it was answered, so this only adds the game itself): it may be a new best score,
     and a game of enough rounds counts towards the round badges. items: [{ won, points, ... }] */
  function recordRoundsGame(mode, items) {
    const p = profile();
    const solved = items.filter((it) => it.won).length, points = items.reduce((a, it) => a + (it.points || 0), 0);
    const out = { mode, rounds: items.length, solved, points, best: points > (p.roundsBest || 0), newBadges: [] };
    p.roundsBest = Math.max(p.roundsBest || 0, points);
    p.counters.roundBestSolved = Math.max(p.counters.roundBestSolved || 0, solved);
    if (items.length >= cfg.roundGameMin) p.counters.roundGames = (p.counters.roundGames || 0) + 1;
    out.newBadges = FD.badges.evaluate(p, { event: 'rounds' }, FD.lib);
    changed();
    return out;
  }

  /* The Daily Challenge can be a Scenario Match or Prompt Lab question. It scores the points for the pick it was found on (50, 30 or 10) plus the Speed Bonus, keeps the Daily
     streak, and adds the same Daily bonuses. Miss all the picks (or let the day end) and it is a missed day that ends the streak, and goes to Needs Another Look.
     r = { scn, feature, tries, timeMs, dateKey, won, expired } */
  function recordDailyQuiz(kind, r) {
    const p = profile(), f = r.feature, s = statsFor(p, kind), d = p.daily;
    const rankBefore = FD.scoring.rank(p.xp).index, won = !!r.won;
    const out = { kind, won, expired: !!r.expired, feature: f, hints: r.tries, hintsUsed: r.tries, timeMs: r.timeMs, breakdown: null, xp: 0, levelUp: null, newBadges: [], firstTime: false, dailyStreak: null, bonusXp: [], mode: 'daily', dateKey: r.dateKey, review: null };
    /* a question that was missed or ran out of time was still played (a missed hunt counts too), but it only counts as solved when it was */
    s.questions++;
    if (won) {
      out.breakdown = FD.scoring.computeQuiz({ points: FD.quiz(kind).pointsFor(r.tries), ms: r.timeMs, mode: 'daily' });
      s.correct++; if (r.tries === 1) { s.firstTry++; const c = kind === 'match' ? 'matchFirstTry' : 'promptFirstTry'; p.counters[c] = (p.counters[c] || 0) + 1; }
      s.points += out.breakdown.total; /* the score the player was shown, with the Speed Bonus */
    }
    out.review = markSeen(p, s, r.scn.id, won, won && r.tries === 1);
    p.counters.played_daily = (p.counters.played_daily || 0) + 1;
    const continues = !!d.last && lastWeekday(d.last) === prevWeekday(r.dateKey);
    d.results[r.dateKey] = { id: f.id, kind, sid: r.scn.id, won, hints: r.tries, score: out.breakdown ? out.breakdown.total : 0, timeMs: r.timeMs, grid: [], expired: !!r.expired };
    if (won) { d.streak = d.last === r.dateKey ? d.streak : (continues ? d.streak + 1 : 1); d.max = Math.max(d.max, d.streak); } else d.streak = 0;
    d.last = r.dateKey; out.dailyStreak = d.streak;
    delete p.active['daily:' + r.dateKey];
    let xp = won ? out.breakdown.total : cfg.lossXp;
    if (won) {
      if (cfg.difficultyXp[f.difficulty]) { xp += cfg.difficultyXp[f.difficulty]; out.bonusXp.push([`${f.difficulty} difficulty`, cfg.difficultyXp[f.difficulty]]); }
      xp += cfg.dailyBonusXp; out.bonusXp.push(['Daily Challenge bonus', cfg.dailyBonusXp]);
      const pct = FD.scoring.streakXpPct(d.streak);
      if (pct > 0) { const extra = Math.max(1, Math.round(xp * pct)); xp += extra; out.bonusXp.push([`${d.streak}-day Daily streak +${Math.round(pct * 100)}%`, extra]); }
    }
    out.xp = xp; p.xp += xp;
    Object.assign(d.results[r.dateKey], { breakdown: out.breakdown, xp, bonusXp: out.bonusXp });
    const after = FD.scoring.rank(p.xp);
    if (after.index > rankBefore) out.levelUp = after.rank;
    p.history.unshift({ t: Date.now(), mode: 'daily', kind, id: f.id, name: f.name, won, hints: r.tries, tries: r.tries, score: out.breakdown ? out.breakdown.total : 0, timeMs: r.timeMs, sid: r.scn.id });
    if (p.history.length > 60) p.history.length = 60;
    out.newBadges = FD.badges.evaluate(p, { event: kind + 'Daily', won, timeMs: r.timeMs, mode: 'daily' }, FD.lib);
    changed();
    if (FD.board && FD.board.submit) FD.board.submit({ mode: 'daily', dateKey: r.dateKey, hintsUsed: r.tries, timeMs: r.timeMs, won }, out);
    return out;
  }
  /* ---------- accounts: a Microsoft sign-in gives the player a profile of their own, in place of the guest ("Player") profile ---------- */
  const hasProgress = (p) => !!(p.stats.played || p.xp || Object.keys(p.collection).length || Object.keys(p.daily.results).length || (p.prompts && p.prompts.questions) || (p.match && p.match.questions));
  const guestProfile = () => Object.values(state.profiles).find((p) => !p.account) || null;
  const accountColor = (id) => COLORS[FD.u.hash(id) % COLORS.length];
  /* a = { id: 'ms_' + 24 hex, name, display, email, tenant }.  o.adopt: this device's guest progress moves into a brand-new account */
  function signIn(a, o = {}) {
    const cur = profile();
    let p = state.profiles[a.id], created = false, adopted = false;
    if (!p) {
      if (o.adopt && !cur.account) { p = cur; delete state.profiles[cur.id]; p.id = a.id; adopted = true; }
      else { p = newProfile(a.display, accountColor(a.id)); p.id = a.id; }
      p.color = accountColor(a.id);
      state.profiles[a.id] = p; created = true;
    }
    p.account = { provider: 'microsoft', name: clean(a.name, 120), email: clean(a.email, 160), tenant: clean(a.tenant, 64), at: p.account && p.account.at ? p.account.at : Date.now() };
    p.name = clean(a.display, 24) || 'Player';
    state.activeProfile = a.id;
    changed();
    return { created, adopted };
  }
  /* back to the guest profile (a new one if the guest's progress moved into an account). The account's progress waits for the next sign-in. */
  function signOut() {
    if (!profile().account) return false;
    let g = guestProfile();
    if (!g) { g = newProfile('Player', 'blue'); state.profiles[g.id] = g; }
    state.activeProfile = g.id;
    changed();
    return true;
  }

  /* ---------- backup / restore (one player per device: a backup replaces this player's progress, never who they are) ---------- */
  function exportJSON() {
    const p = JSON.parse(JSON.stringify(profile()));
    delete p.account; /* a backup file never carries a Microsoft identity */
    return JSON.stringify({ app: 'copilot-feature-dle', version: 2, exported: new Date().toISOString(), data: { activeProfile: state.activeProfile, profiles: { [state.activeProfile]: p }, settings: state.settings } }, null, 1);
  }
  function importJSON(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'That does not look like a Feature-dle backup (not valid JSON).' }; }
    if (!j || j.app !== 'copilot-feature-dle' || !j.data || !j.data.profiles || typeof j.data.profiles !== 'object') return { ok: false, error: 'That file is not a Feature-dle backup.' };
    const id = j.data.activeProfile && j.data.profiles[j.data.activeProfile] ? j.data.activeProfile : Object.keys(j.data.profiles).find((k) => j.data.profiles[k] && typeof j.data.profiles[k] === 'object');
    if (!id) return { ok: false, error: 'That backup does not contain a player.' };
    const mine = state.activeProfile, cur = state.profiles[mine];
    const q = ensureProfile(j.data.profiles[id]);
    q.id = mine;
    if (cur && cur.account) { q.account = cur.account; q.name = cur.name; } else delete q.account;
    state.profiles[mine] = q;
    changed();
    return { ok: true };
  }
  function resetAll() { state = fresh(); applySettings(); saveNow(); bus.emit('change'); }

  /* ---------- first run + changelog ---------- */
  function onboarded() { return !!state.meta.onboarded; }
  function setOnboarded() { state.meta.onboarded = true; changed(); }
  const changelogSeen = () => state.meta.changelogSeen || '';
  function setChangelogSeen(v) { state.meta.changelogSeen = String(v || ''); changed(); }

  FD.store = {
    load, save, saveNow, on: bus.on, emit: () => bus.emit('change'),
    key: KEY,
    get state() { return state; },
    profile, settings, setSetting, applySettings, profiles: () => Object.values(state.profiles),
    renameProfile, resetAll,
    getActive, setActive, clearActive, dailyStreak, dailyResult, recordGame, expireDailies, bump,
    packProgress, packMarkDone, packRestart, reviewStart, recordQuizRound, recordQuizGame, recordRoundsGame, recordDailyQuiz, recordPromptRound, recordPromptGame,
    account: () => profile().account || null, signIn, signOut, hasProgress, guestProfile,
    exportJSON, importJSON, onboarded, setOnboarded, changelogSeen, setChangelogSeen, COLORS
  };
})();
