/* Copilot Feature-dle · Daily Challenge selection
   Same feature for everyone on a given (local) date. A weekday plan ramps difficulty, a seeded shuffle guarantees no repeats
   within a cycle, and data/features.json "schedule" can pin any date to any feature (events, launches...). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cfg = FD.config;
  const { keyToDay, dayToKey, weekdayOfKey, dateKey, shuffle, seeded, msToMidnight } = FD.u;
  const ORDER = ['Easy', 'Medium', 'Hard', 'Expert'];

  const number = (key) => keyToDay(key) - keyToDay(cfg.dailyEpoch) + 1;
  const plannedDifficulty = (key) => cfg.weekdayPlan[weekdayOfKey(key)];

  function pick(key = dateKey()) {
    const lib = FD.lib;
    const pinned = lib.schedule || {};
    if (pinned[key] && lib.byId[pinned[key]]) return lib.byId[pinned[key]];

    const pinnedIds = new Set(Object.values(pinned));
    const feats = lib.features.filter((f) => !f.community && f.daily && f.packs.includes('core') && !pinnedIds.has(f.id));
    const planned = plannedDifficulty(key);
    const byDiff = (d) => feats.filter((f) => f.difficulty === d).sort((a, b) => (a.id < b.id ? -1 : 1));

    let bucket = byDiff(planned);
    if (!bucket.length) {
      const idx = ORDER.indexOf(planned);
      for (let delta = 1; delta < 4 && !bucket.length; delta++) {
        for (const j of [idx - delta, idx + delta]) if (!bucket.length && j >= 0 && j < 4) bucket = byDiff(ORDER[j]);
      }
    }
    if (!bucket.length) return null;

    /* which occurrence of this weekday-difficulty slot is it since launch? */
    const start = keyToDay(cfg.dailyEpoch), day = keyToDay(key);
    let n = 0;
    for (let t = start; t < day; t++) if (plannedDifficulty(dayToKey(t)) === planned) n++;
    const cycle = Math.floor(n / bucket.length), pos = n % bucket.length;
    const order = shuffle(bucket.map((f) => f.id), seeded(`fd|${planned}|${cycle}`));
    return lib.byId[order[pos]];
  }

  function info(key = dateKey()) {
    const feature = pick(key);
    return { key, number: number(key), planned: plannedDifficulty(key), difficulty: feature ? feature.difficulty : plannedDifficulty(key), feature };
  }

  FD.daily = { pick, info, number, plannedDifficulty, msUntilNext: () => msToMidnight() };
})();
