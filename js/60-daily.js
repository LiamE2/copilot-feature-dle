/* Copilot Feature-dle · Daily Challenge selection
   The same puzzle for everyone on a given (local) date, weekdays only. The puzzle is one of the three game modes:
     hunt   (Feature Hunt)   guess the feature from hints
     match  (Scenario Match) pick the feature that fits a first-person need
     prompt (Prompt Lab)     pick the best of four prompts for a scenario

   1. data/daily.json is the plan: a list of "on this date, this puzzle". A weekday that is in the plan shows exactly that puzzle.
   2. Any weekday that is NOT in the plan, including every day after the plan's last date, falls back to the random rotation below.
      So the plan can run out (or have gaps) and the game simply carries on; add more dates to the file whenever you like.

   The random rotation gives each weekday a random but balanced difficulty: every block of 20 weekdays holds the same number of Easy,
   Medium, Hard and Expert days in a seeded shuffled order, and within a difficulty a seeded shuffle guarantees no repeats until that list
   is used up. It also gives each weekday a game mode: from cfg.dailyKindsFrom, every group of three weekdays holds one Feature Hunt,
   one Scenario Match and one Prompt Lab day in a seeded random order. Neither ever looks at the plan, so adding, changing or removing
   plan entries can't move the puzzle on any other day.
   A feature marked "daily": false in features.json is never picked by the rotation (the plan can still choose it). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cfg = FD.config;
  const { keyToDay, dayToKey, isWeekend, lastWeekday, nextWeekday, dateKey, shuffle, seeded, slug, msToNextChallenge, fmtCountdown } = FD.u;
  const ORDER = ['Easy', 'Medium', 'Hard', 'Expert'];
  const KINDS = cfg.dailyKinds;
  const isKind = (k) => KINDS.includes(k);
  const KIND_NAME = { hunt: 'Feature Hunt', match: 'Scenario Match', prompt: 'Prompt Lab' };

  const isPuzzleDay = (key) => !isWeekend(key);
  const dow = (t) => (((t + 4) % 7) + 7) % 7; /* 0 = Sunday, from a day number */

  /* how many weekdays have passed since launch (this is the position of `key` in the weekday sequence) */
  function weekdayIndex(key) {
    let n = 0;
    for (let t = keyToDay(cfg.dailyEpoch), end = keyToDay(key); t < end; t++) { const w = dow(t); if (w !== 0 && w !== 6) n++; }
    return n;
  }
  /* "Daily Challenge #29": only weekdays are numbered, so Friday #29 is followed by Monday #30 and a weekend has no number */
  const number = (key) => (isPuzzleDay(key) ? cfg.dailyNumber.number + weekdayIndex(key) - weekdayIndex(cfg.dailyNumber.date) : null);
  const bagSize = () => ORDER.reduce((a, d) => a + (cfg.dailyMix[d] || 0), 0);
  const bagCache = new Map();
  function bag(block) {
    if (!bagCache.has(block)) {
      const items = [];
      ORDER.forEach((d) => { for (let i = 0; i < (cfg.dailyMix[d] || 0); i++) items.push(d); });
      bagCache.set(block, shuffle(items, seeded('fd|mix|' + block)));
    }
    return bagCache.get(block);
  }

  /* the (random but balanced) difficulty planned for the n-th weekday, plus how many earlier days had the same one */
  function planAt(n) {
    const size = bagSize(), block = Math.floor(n / size), pos = n % size;
    const order = bag(block), planned = order[pos];
    const before = block * (cfg.dailyMix[planned] || 0) + order.slice(0, pos).filter((d) => d === planned).length;
    return { planned, occurrence: before };
  }
  const plan = (key) => planAt(weekdayIndex(key));

  /* ---------- the game mode of the random rotation ---------- */
  const kindsFrom = () => weekdayIndex(cfg.dailyKindsFrom);
  const kindGroup = (g) => shuffle(KINDS.slice(), seeded('fd|kinds|' + g));
  function kindAt(n) {
    const from = kindsFrom();
    if (n < from) return 'hunt';
    return kindGroup(Math.floor((n - from) / KINDS.length))[(n - from) % KINDS.length];
  }

  /* ---------- the plan: data/daily.json ----------
     { "days": [ { "date": "2026-11-17", "feature": "copilot-pages", "note": "optional" },
                 { "date": "2026-11-18", "type": "match", "scenario": "chat-web-and-work-files" },
                 { "date": "2026-11-19", "type": "prompt", "feature": "copilot-chat" } ] }
     "type" is hunt (the default), match or prompt. "feature" is a feature's id or its name (capitals, spaces and dashes don't matter).
     For match and prompt, "scenario" is the id of the question to ask; leave it out to use the feature's first question (then "feature" is needed).
     The library and the two scenario files must be loaded before the plan is set. */
  const sched = { days: new Map(), problems: [], loaded: false };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isRealDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && dayToKey(keyToDay(s)) === s;

  function featureFor(ref) {
    const lib = FD.lib, s = slug(ref);
    if (!s) return null;
    if (own(lib.byId, ref)) return lib.byId[ref];
    if (own(lib.byId, s)) return lib.byId[s];
    return lib.features.find((f) => slug(f.name) === s) || null;
  }

  /* takes the parsed file (or null for "no plan"); anything that can't be used is left out and listed in scheduleInfo().problems,
     so a typo in the file never breaks the game: that day just uses the random rotation */
  function setSchedule(raw) {
    const days = new Map(), problems = [];
    if (raw && !Array.isArray(raw.days)) problems.push('the file should look like { "days": [ { "date": "2026-11-17", "feature": "copilot-pages" } ] }');
    (raw && Array.isArray(raw.days) ? raw.days : []).forEach((e, i) => {
      const date = String((e && e.date) || '').trim(), ref = String((e && e.feature) || '').trim(), at = `entry ${i + 1}${date ? ' (' + date + ')' : ''}`;
      const kind = e && e.type != null && String(e.type).trim() ? String(e.type).trim().toLowerCase() : 'hunt', sid = String((e && e.scenario) || '').trim();
      if (!isRealDate(date)) { problems.push(`${at}: the date must be a real day written like 2026-11-17`); return; }
      if (!isKind(kind)) { problems.push(`${at}: the type must be hunt, match or prompt (not "${kind}")`); return; }
      if (isWeekend(date)) { problems.push(`${at}: there is no Daily Challenge on a Saturday or Sunday, so this entry is ignored`); return; }
      if (days.has(date)) { problems.push(`${at}: ${date} is listed twice, so only the first one is used`); return; }
      let f = ref ? featureFor(ref) : null, scenario = null;
      if (kind === 'hunt') {
        if (!ref) { problems.push(`${at}: no feature given`); return; }
        if (!f) { problems.push(`${at}: no feature is called "${ref}", so the random rotation covers that day`); return; }
      } else {
        const Q = FD.quiz(kind);
        if (sid) {
          const s = Q.byId[sid];
          if (!s) { problems.push(`${at}: no ${KIND_NAME[kind]} scenario has the id "${sid}", so the random rotation covers that day`); return; }
          if (f && f.id !== s.feature) { problems.push(`${at}: the scenario "${sid}" is about ${FD.lib.byId[s.feature].name}, not ${f.name}, so the random rotation covers that day`); return; }
          f = FD.lib.byId[s.feature]; scenario = s.id;
        } else {
          if (!ref) { problems.push(`${at}: give a "scenario" id or a "feature" for a ${KIND_NAME[kind]} day`); return; }
          if (!f) { problems.push(`${at}: no feature is called "${ref}", so the random rotation covers that day`); return; }
          if (!Q.scenarios.some((s) => s.feature === f.id)) { problems.push(`${at}: ${f.name} has no ${KIND_NAME[kind]} scenarios, so the random rotation covers that day`); return; }
        }
      }
      days.set(date, { kind, feature: f.id, scenario });
    });
    sched.days = days; sched.problems = problems; sched.loaded = true;
    if (problems.length && typeof console !== 'undefined') console.warn('Daily Challenge plan (data/daily.json): ' + problems.join(' | '));
    return scheduleInfo();
  }
  function scheduleInfo() {
    const dates = Array.from(sched.days.keys()).sort();
    const kinds = { hunt: 0, match: 0, prompt: 0 }; sched.days.forEach((d) => { kinds[d.kind]++; });
    return { loaded: sched.loaded, count: dates.length, first: dates[0] || '', last: dates[dates.length - 1] || '', kinds, problems: sched.problems.slice() };
  }
  /* what the plan chooses for a weekday ({ kind, feature, scenario }), or null when the plan has nothing for it */
  function scheduled(key) {
    if (!isPuzzleDay(key)) return null;
    const e = sched.days.get(key);
    const feature = e && FD.lib.byId[e.feature];
    if (!feature) return null;
    if (e.kind === 'hunt') return { kind: 'hunt', feature, scenario: null };
    const Q = FD.quiz(e.kind), scenario = (e.scenario && Q.byId[e.scenario]) || Q.scenarios.find((s) => s.feature === feature.id) || null;
    return scenario ? { kind: e.kind, feature, scenario } : null;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  /* embedded data (the single-file edition) -> data/daily.json -> its script mirror data/daily.js (for a folder opened from disk).
     If none of them can be read there is just no plan, and the random rotation covers every day. */
  async function load(o = {}) {
    let raw = window.FD_DAILY || null;
    if (!raw) { try { const r = await fetch(o.json || 'data/daily.json', { cache: 'no-cache' }); if (r.ok) raw = await r.json(); } catch (e) { /* try the script mirror */ } }
    if (!raw) { try { await loadScript(o.js || 'data/daily.js'); raw = window.FD_DAILY || null; } catch (e) { /* no plan */ } }
    return setSchedule(raw);
  }

  /* ---------- the random rotation ---------- */
  const eligible = (f) => !!f && !f.community && f.daily && f.packs.includes('core');
  /* the nearest difficulty to the planned one that has anything to choose from */
  function nearest(planned, has) {
    if (has(planned)) return planned;
    const idx = ORDER.indexOf(planned);
    for (let delta = 1; delta < 4; delta++) for (const j of [idx - delta, idx + delta]) if (j >= 0 && j < 4 && has(ORDER[j])) return ORDER[j];
    return null;
  }
  /* a Feature Hunt feature */
  function rotation(key) {
    const lib = FD.lib;
    const feats = lib.features.filter(eligible);
    const { planned, occurrence } = plan(key);
    const byDiff = (d) => feats.filter((f) => f.difficulty === d).sort((a, b) => (a.id < b.id ? -1 : 1));
    const diff = nearest(planned, (d) => byDiff(d).length);
    if (!diff) return null;
    const bucket = byDiff(diff);
    const cycle = Math.floor(occurrence / bucket.length), pos = occurrence % bucket.length;
    const order = shuffle(bucket.map((f) => f.id), seeded(`fd|${diff}|${cycle}`));
    return lib.byId[order[pos]];
  }
  /* a Scenario Match or Prompt Lab question for the n-th weekday: the planned difficulty, then a seeded shuffle of that level's questions
     that never repeats one until the list is used up (it counts the earlier days of this game mode that were at the same level) */
  function questionRotation(kind, n) {
    const Q = FD.quiz(kind);
    if (!Q.ready) return null;
    const pool = Q.scenarios.filter((s) => eligible(FD.lib.byId[s.feature]));
    if (!pool.length) return null;
    const byDiff = (d) => pool.filter((s) => FD.lib.byId[s.feature].difficulty === d).sort((a, b) => (a.id < b.id ? -1 : 1));
    const level = (planned) => nearest(planned, (d) => byDiff(d).length);
    const diff = level(planAt(n).planned);
    if (!diff) return null;
    const from = kindsFrom(), size = KINDS.length, g = Math.floor((n - from) / size);
    let occ = 0;
    for (let j = 0; j < g; j++) { const at = from + j * size + kindGroup(j).indexOf(kind); if (level(planAt(at).planned) === diff) occ++; }
    const bucket = byDiff(diff), cycle = Math.floor(occ / bucket.length), pos = occ % bucket.length;
    const order = shuffle(bucket.map((s) => s.id), seeded(`fd|${kind}|${diff}|${cycle}`));
    return Q.byId[order[pos]];
  }

  /* what the Daily Challenge is on a day: { kind, feature, scenario }. The plan's puzzle if it has one, otherwise the random rotation's. */
  function choose(key) {
    const fixed = scheduled(key);
    if (fixed) return { ...fixed, source: 'schedule' };
    const n = weekdayIndex(key), kind = kindAt(n);
    if (kind !== 'hunt') {
      const scenario = questionRotation(kind, n);
      if (scenario) return { kind, feature: FD.lib.byId[scenario.feature], scenario, source: 'random' };
    }
    return { kind: 'hunt', feature: rotation(key), scenario: null, source: 'random' };
  }

  /* the feature the Daily Challenge is about on a day */
  function pick(key = dateKey()) {
    if (!isPuzzleDay(key)) return null;
    return choose(key).feature;
  }

  function info(key = dateKey()) {
    if (!isPuzzleDay(key)) return { key, weekend: true, number: null, feature: null, kind: null, scenario: null, next: nextWeekday(key), lastPuzzleDay: lastWeekday(key) };
    const c = choose(key), feature = c.feature;
    return { key, weekend: false, number: number(key), planned: plan(key).planned, difficulty: feature ? feature.difficulty : plan(key).planned, kind: c.kind, feature, scenario: c.scenario, source: c.source };
  }

  FD.daily = {
    KINDS, pick, info, number, isPuzzleDay, plan, rotation, kindAt: (key = dateKey()) => (isPuzzleDay(key) ? kindAt(weekdayIndex(key)) : null), load, setSchedule, scheduleInfo, featureFor,
    /* 'schedule' (the plan chose it), 'random' (the rotation did) or 'none' (a weekend) */
    sourceOf: (key = dateKey()) => (!isPuzzleDay(key) ? 'none' : scheduled(key) ? 'schedule' : 'random'),
    msUntilNext: () => msToNextChallenge(),
    countdownText: () => fmtCountdown(msToNextChallenge()),
    /* Fridays and weekends: the streak is safe over the weekend */
    weekendSafeDay: (key = dateKey()) => { const w = new Date(keyToDay(key) * 86400000).getUTCDay(); return w === 5 || w === 6 || w === 0; }
  };
})();
