/* Copilot Feature-dle · persistence (localStorage with in-memory fallback), profiles, stats, XP, collection */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cfg = FD.config;
  const { storage, uid, dateKey, addDays, debounce } = FD.u;
  /* every project on a github.io address shares one storage area, so the key is specific to this game.
     ?ns=name gives tests and demos their own save slot, so they can never touch a real player's progress. */
  const ns = (new URLSearchParams(location.search).get('ns') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  const KEY = 'copilot-feature-dle.v1' + (ns ? '.' + ns : '');
  const bus = FD.u.emitter();

  const defaultSettings = () => ({ sound: false, motion: 'system', contrast: false, textScale: 1, relaxed: false, unlockAll: false, sampleBoard: true, confetti: true, haptics: true });
  const newProfile = (name, color) => ({
    id: uid('p_'), name: name || 'Player', color: color || 'blue', created: Date.now(), xp: 0,
    stats: { played: 0, won: 0, lost: 0, winStreak: 0, maxWinStreak: 0, totalScore: 0, bestScore: 0, hist: [0, 0, 0, 0, 0], fails: 0, totalTimeMs: 0, fastestMs: null },
    daily: { streak: 0, max: 0, last: null, results: {} },
    collection: {}, badges: {}, active: {}, counters: {}, history: [], speedBest: 0
  });

  let state = null;

  function ensureProfile(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    const d = newProfile(p.name, p.color);
    p.id = typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) && p.id !== '__proto__' ? p.id : d.id;
    p.name = String(p.name == null ? '' : p.name).trim().slice(0, 24) || 'Player';
    p.color = COLORS.includes(p.color) ? p.color : 'blue';
    p.xp = Math.max(0, Number(p.xp) || 0);
    p.stats = Object.assign(d.stats, p.stats && typeof p.stats === 'object' ? p.stats : {});
    if (!Array.isArray(p.stats.hist) || p.stats.hist.length !== 5) p.stats.hist = [0, 0, 0, 0, 0];
    p.daily = Object.assign(d.daily, p.daily && typeof p.daily === 'object' ? p.daily : {});
    p.daily.results = p.daily.results && typeof p.daily.results === 'object' ? p.daily.results : {};
    ['collection', 'badges', 'active', 'counters'].forEach((k) => { p[k] = p[k] && typeof p[k] === 'object' && !Array.isArray(p[k]) ? p[k] : {}; });
    p.history = Array.isArray(p.history) ? p.history : [];
    p.speedBest = Number(p.speedBest) || 0;
    return p;
  }
  function fresh() {
    const p = newProfile('Player', 'blue');
    return { v: 1, activeProfile: p.id, profiles: { [p.id]: p }, settings: defaultSettings(), community: [], meta: { created: Date.now(), onboarded: false } };
  }
  function load() {
    try { const raw = storage.get(KEY); state = raw ? JSON.parse(raw) : fresh(); } catch (e) { state = fresh(); }
    if (!state || typeof state !== 'object') state = fresh();
    state.settings = Object.assign(defaultSettings(), state.settings || {});
    state.community = Array.isArray(state.community) ? state.community : [];
    state.meta = state.meta || {};
    if (!state.profiles || !Object.keys(state.profiles).length) { const f = fresh(); state.profiles = f.profiles; state.activeProfile = f.activeProfile; }
    Object.values(state.profiles).forEach(ensureProfile);
    if (!state.profiles[state.activeProfile]) state.activeProfile = Object.keys(state.profiles)[0];
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

  /* ---------- profiles ---------- */
  const COLORS = ['blue', 'red', 'purple', 'orange', 'green', 'pink', 'yellow', 'navy'];
  function createProfile(name, color) {
    const p = newProfile((name || '').trim().slice(0, 24) || 'Player', color || COLORS[Object.keys(state.profiles).length % COLORS.length]);
    state.profiles[p.id] = p; state.activeProfile = p.id; changed(); return p;
  }
  function switchProfile(id) { if (state.profiles[id]) { state.activeProfile = id; changed(); } }
  function renameProfile(id, name, color) {
    const p = state.profiles[id]; if (!p) return;
    p.name = (name || '').trim().slice(0, 24) || p.name; if (color) p.color = color; changed();
  }
  function removeProfile(id) {
    if (Object.keys(state.profiles).length < 2 || !state.profiles[id]) return false;
    delete state.profiles[id];
    if (state.activeProfile === id) state.activeProfile = Object.keys(state.profiles)[0];
    changed(); return true;
  }

  /* ---------- in-progress games ---------- */
  const getActive = (key) => profile().active[key] || null;
  function setActive(key, data) { profile().active[key] = data; save(); }
  function clearActive(key) { delete profile().active[key]; save(); }

  /* ---------- streaks ---------- */
  function dailyStreak(p = profile(), today = dateKey()) {
    const d = p.daily;
    if (!d.last) return 0;
    return d.last === today || d.last === addDays(today, -1) ? d.streak : 0;
  }
  const dailyResult = (key, p = profile()) => p.daily.results[key] || null;

  /* ---------- the big one: record a finished game ---------- */
  function recordGame(r) {
    const p = profile(), s = p.stats, f = r.feature, relaxed = state.settings.relaxed;
    const rankBefore = FD.scoring.rank(p.xp).index;
    const out = { won: !!r.won, feature: f, hints: r.hintsUsed, timeMs: r.timeMs, breakdown: null, xp: 0, levelUp: null, newBadges: [], firstTime: false, dailyStreak: null, bonusXp: [] };
    const entry = p.collection[f.id] || (p.collection[f.id] = { solved: 0, seen: 0, bestHints: null, first: null });
    s.played++;

    if (r.won) {
      const b = FD.scoring.compute({ hints: r.hintsUsed, ms: r.timeMs, streakBefore: s.winStreak, relaxed });
      out.breakdown = b;
      s.won++; s.winStreak++; s.maxWinStreak = Math.max(s.maxWinStreak, s.winStreak);
      s.totalScore += b.total; s.bestScore = Math.max(s.bestScore, b.total);
      s.hist[Math.min(4, Math.max(0, r.hintsUsed - 1))]++;
      if (r.timeMs != null) { s.totalTimeMs += r.timeMs; s.fastestMs = s.fastestMs == null ? r.timeMs : Math.min(s.fastestMs, r.timeMs); }
      out.firstTime = entry.solved === 0;
      entry.solved++; entry.bestHints = entry.bestHints == null ? r.hintsUsed : Math.min(entry.bestHints, r.hintsUsed);
      entry.first = entry.first || Date.now();
    } else {
      s.lost++; s.fails++; s.winStreak = 0; entry.seen++;
    }

    /* daily bookkeeping */
    if (r.mode === 'daily' && r.dateKey) {
      const d = p.daily;
      d.results[r.dateKey] = { id: f.id, won: !!r.won, hints: r.hintsUsed, score: out.breakdown ? out.breakdown.total : 0, timeMs: r.timeMs, grid: r.grid || [] };
      if (r.won) { d.streak = d.last === addDays(r.dateKey, -1) ? d.streak + 1 : (d.last === r.dateKey ? d.streak : 1); d.max = Math.max(d.max, d.streak); }
      else d.streak = 0;
      d.last = r.dateKey;
      out.dailyStreak = d.streak;
      delete p.active['daily:' + r.dateKey];
    }

    /* XP */
    let xp = r.won ? out.breakdown.total + (cfg.difficultyXp[f.difficulty] || 0) : cfg.lossXp;
    if (r.won && out.firstTime) { xp += cfg.newFeatureXp; out.bonusXp.push(['New feature collected', cfg.newFeatureXp]); }
    if (r.won && r.mode === 'daily') {
      const streakXp = Math.min(cfg.dailyStreakXpCap, Math.max(0, p.daily.streak - 1) * cfg.dailyStreakXp);
      xp += cfg.dailyBonusXp + streakXp;
      out.bonusXp.push(['Daily Challenge bonus', cfg.dailyBonusXp]);
      if (streakXp) out.bonusXp.push([`${p.daily.streak}-day streak`, streakXp]);
    }
    if (r.won && (cfg.difficultyXp[f.difficulty] || 0)) out.bonusXp.unshift([`${f.difficulty} difficulty`, cfg.difficultyXp[f.difficulty]]);
    out.xp = xp; p.xp += xp;
    if (r.mode === 'daily' && r.dateKey && p.daily.results[r.dateKey]) {
      Object.assign(p.daily.results[r.dateKey], { breakdown: out.breakdown, xp, bonusXp: out.bonusXp, guesses: r.guesses || [] });
    }
    const rankAfter = FD.scoring.rank(p.xp);
    if (rankAfter.index > rankBefore) out.levelUp = rankAfter.rank;

    p.history.unshift({ t: Date.now(), mode: r.mode, id: f.id, name: f.name, won: !!r.won, hints: r.hintsUsed, score: out.breakdown ? out.breakdown.total : 0, timeMs: r.timeMs });
    if (p.history.length > 60) p.history.length = 60;

    out.newBadges = FD.badges.evaluate(p, { won: !!r.won, hintsUsed: r.hintsUsed, timeMs: r.timeMs, typo: !!r.typo, mode: r.mode, feature: f, relaxed }, FD.lib);
    changed();
    if (FD.board && FD.board.submit) FD.board.submit(r, out);
    return out;
  }

  /* counters for engagement badges (shares, prompt copies, doc opens...) */
  function bump(name, n = 1, max) {
    const p = profile();
    p.counters[name] = max ? Math.max(p.counters[name] || 0, n) : (p.counters[name] || 0) + n;
    const earned = FD.badges.evaluate(p, { event: name }, FD.lib);
    changed();
    return earned;
  }

  /* ---------- community packs ---------- */
  function rebuildLibrary() { if (FD.rawLib) FD.data.build(FD.rawLib, state.community); }
  function addCommunityPack(pack) {
    state.community = state.community.filter((c) => c.id !== pack.id);
    state.community.push({ id: pack.id, name: pack.name, description: pack.description, author: pack.author || '', added: Date.now(), features: pack.features });
    rebuildLibrary(); const earned = bump('packsImported'); return earned;
  }
  function removeCommunityPack(id) {
    state.community = state.community.filter((c) => c.id !== id);
    rebuildLibrary(); changed();
  }

  /* ---------- backup / restore ---------- */
  function exportJSON() { return JSON.stringify({ app: 'copilot-feature-dle', version: 1, exported: new Date().toISOString(), data: state }, null, 1); }
  function importJSON(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'That does not look like a Feature-dle backup (not valid JSON).' }; }
    if (!j || j.app !== 'copilot-feature-dle' || !j.data || !j.data.profiles || typeof j.data.profiles !== 'object') return { ok: false, error: 'That file is not a Feature-dle backup.' };
    let players = 0;
    Object.entries(j.data.profiles).forEach(([id, p]) => {
      if (!/^[\w-]{1,40}$/.test(id) || id === '__proto__' || !p || typeof p !== 'object') return;
      const q = ensureProfile(p); q.id = id;
      state.profiles[id] = q; players++;
    });
    if (!players) return { ok: false, error: 'That backup does not contain any players.' };
    (Array.isArray(j.data.community) ? j.data.community : []).forEach((c) => {
      if (c && typeof c.id === 'string' && Array.isArray(c.features) && !state.community.find((x) => x.id === c.id)) {
        state.community.push({ id: c.id, name: String(c.name || 'Community pack').slice(0, 80), description: String(c.description || '').slice(0, 300), author: String(c.author || '').slice(0, 80), added: Number(c.added) || Date.now(), features: c.features });
      }
    });
    if (j.data.activeProfile && state.profiles[j.data.activeProfile]) state.activeProfile = j.data.activeProfile;
    rebuildLibrary(); changed();
    return { ok: true, players };
  }
  function resetAll() { state = fresh(); applySettings(); rebuildLibrary(); saveNow(); bus.emit('change'); }
  function resetProfile() {
    const old = profile(); const p = newProfile(old.name, old.color); p.id = old.id; state.profiles[old.id] = p; changed();
  }

  function onboarded() { return !!state.meta.onboarded; }
  function setOnboarded() { state.meta.onboarded = true; changed(); }

  FD.store = {
    load, save, saveNow, on: bus.on, emit: () => bus.emit('change'),
    key: KEY,
    get state() { return state; },
    profile, settings, setSetting, applySettings, profiles: () => Object.values(state.profiles),
    createProfile, switchProfile, renameProfile, removeProfile, resetProfile, resetAll,
    getActive, setActive, clearActive, dailyStreak, dailyResult, recordGame, bump,
    addCommunityPack, removeCommunityPack, community: () => state.community,
    exportJSON, importJSON, onboarded, setOnboarded, COLORS
  };
})();
