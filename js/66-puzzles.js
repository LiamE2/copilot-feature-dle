/* Copilot Feature-dle · puzzles: the three game modes as one idea.
   A puzzle is one thing to answer about a Copilot feature:
     hunt   (Feature Hunt)   guess the feature from hints                      -> Know it
     match  (Scenario Match) pick the feature that fits a first-person need   -> Use it
     prompt (Prompt Lab)     pick the best of four prompts for a scenario     -> Prompt it
   Free Play (a game of rounds, from any game mode), Feature Hunt (a game of rounds, hunts only), Packs and the Daily Challenge choose from these; every puzzle belongs to a feature, so the same filters
   (difficulty, categories) work for each kind. This file has no screens: it only knows what the kinds are and how to pick one. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  const KINDS = ['hunt', 'match', 'prompt'];
  const META = {
    hunt: { id: 'hunt', name: 'Feature Hunt', route: '#/hunt', icon: 'search', color: 'blue', verb: 'Know it' },
    match: { id: 'match', name: 'Scenario Match', route: '#/match', icon: 'puzzle', color: 'purple', verb: 'Use it' },
    prompt: { id: 'prompt', name: 'Prompt Lab', route: '#/prompts', icon: 'flask', color: 'blue-50', verb: 'Prompt it' }
  };
  const isKind = (k) => KINDS.includes(k);
  const engine = (kind) => (kind === 'match' ? FD.scenarios : kind === 'prompt' ? FD.prompts : null);

  /* the kinds a filter asks for (all three unless it says otherwise), keeping only the ones that have anything to play */
  function kindsOf(filters) {
    const want = filters && Array.isArray(filters.kinds) ? filters.kinds.filter(isKind) : [];
    return want.length ? want : KINDS.slice();
  }

  /* everything a filter allows, by kind (every difficulty level is open from the start).
     filters.category is the categories allowed (a list, or nothing for all of them). */
  function pool(filters = {}) {
    const out = { hunt: [], match: [], prompt: [] };
    const want = kindsOf(filters);
    if (want.includes('hunt')) out.hunt = FD.freeplay.pool(filters);
    ['match', 'prompt'].forEach((k) => {
      if (!want.includes(k) || !engine(k) || !engine(k).ready) return;
      out[k] = engine(k).pool({ category: filters.category, difficulty: filters.difficulty }).filter((s) => !!FD.lib.byId[s.feature]);
    });
    return out;
  }
  const count = (filters) => { const p = pool(filters); return p.hunt.length + p.match.length + p.prompt.length; };

  /* a key for "already used in this session": kind + id, so a feature id can never be mistaken for a scenario id */
  const keyOf = (kind, id) => kind + ':' + id;

  /* pick one puzzle: first which kind (all of the chosen kinds that have something to play are equally likely), then what you haven't met yet
     (unless filters.prioritise is false), then something other than what you just played. o.exclude lists keys (see keyOf) to avoid. */
  function pick(filters = {}, o = {}) {
    const pools = pool(filters), openKinds = KINDS.filter((k) => pools[k].length);
    if (!openKinds.length) return null;
    const exclude = o.exclude || [], p = FD.store.profile();
    /* a kind with nothing left after the exclusions is skipped, unless nothing else is left */
    const left = (k) => pools[k].filter((x) => !exclude.includes(keyOf(k, x.id)));
    const kinds = openKinds.filter((k) => left(k).length);
    const kind = FD.u.pick(kinds.length ? kinds : openKinds);
    if (kind === 'hunt') {
      const f = FD.freeplay.pick(filters, { from: pools.hunt, exclude: exclude.filter((k) => k.startsWith('hunt:')).map((k) => k.slice(5)) });
      return f ? { kind, feature: f } : null;
    }
    const seen = (p[kind === 'match' ? 'match' : 'prompts'] || {}).seen || {};
    let cands = left(kind); if (!cands.length) cands = pools[kind];
    if (filters.prioritise !== false) {
      const unseen = cands.filter((s) => !seen[s.id]);
      if (unseen.length) cands = unseen;
      else { const oldest = Math.min(...cands.map((s) => (seen[s.id] || {}).last || 0)); cands = cands.filter((s) => ((seen[s.id] || {}).last || 0) === oldest); }
    }
    /* not the same feature twice in a row, if there is a choice */
    const lastFeature = p.history.length ? p.history[0].id : '';
    const fresh = cands.filter((s) => s.feature !== lastFeature);
    const scn = FD.u.pick(fresh.length ? fresh : cands);
    return { kind, feature: FD.lib.byId[scn.feature], scn };
  }

  /* how many puzzles of each kind a feature has: the layers of the Feature Book */
  function forFeature(f) {
    return {
      hunt: 1,
      match: engine('match') && engine('match').ready ? engine('match').scenarios.filter((s) => s.feature === f.id) : [],
      prompt: engine('prompt') && engine('prompt').ready ? engine('prompt').scenarios.filter((s) => s.feature === f.id) : []
    };
  }

  FD.puzzles = { KINDS, META, isKind, engine, kindsOf, pool, count, pick, keyOf, forFeature, name: (k) => (META[k] ? META[k].name : '') };
})();
