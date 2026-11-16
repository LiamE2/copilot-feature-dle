/* Copilot Feature-dle · quiz engine: the two question-and-answer game modes. No DOM in here.
   - Prompt Lab (FD.prompts, data/prompts.json): a workplace scenario and four prompts, one of them best. It trains Prompt it: how to prompt a feature.
     The four ingredients come from Microsoft's own guidance on writing Copilot prompts: a goal, context, a source and expectations.
   - Scenario Match (FD.scenarios, data/scenarios.json): a first-person need ("I want to ...") and four Copilot features, one of them the best fit.
     It trains Use it: when to use a feature. Each scenario also shows up as an "Example scenario" in the Feature Book.
   Both are a handful of rounds (the player picks how many). Picking a weaker option explains why and lets you try again for fewer points, up to three picks:
   after that the answer is shown, no points are earned and the puzzle goes to Needs Another Look. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { shuffle, seeded, uid, selList } = FD.u;

  const ING = ['goal', 'context', 'source', 'expectations'];
  const ING_DEFAULT = {
    goal: { name: 'Goal', color: 'blue', text: 'What you want Copilot to do.', example: 'Summarise the decisions from Tuesday\'s project review.' },
    context: { name: 'Context', color: 'purple', text: 'Why you need it, and who it is for.', example: 'It\'s for my manager, who missed the meeting.' },
    source: { name: 'Source', color: 'green', text: 'The files, meetings, emails or sites to use.', example: 'Use the meeting transcript and my notes.' },
    expectations: { name: 'Expectations', color: 'orange', text: 'The format, length and tone you want back.', example: 'Give me five friendly bullets, under 100 words.' }
  };
  const OPTIONS = 4; /* four options, exactly one of them best */
  const MAX_AGE = 14 * 24 * 3600 * 1000; /* a game left alone for two weeks is let go */
  const isAll = (v) => !v || v === 'all';
  const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  const safeLink = (v) => { const s = String(v || '').trim(); return /^https:\/\/[^\s"'<>\\]+$/i.test(s) ? s : ''; };
  const ALL = Array.from({ length: OPTIONS }, (_, i) => i); /* [0, 1, 2, 3] */
  const perm = (a) => Array.isArray(a) && a.length === OPTIONS && ALL.every((i) => a.includes(i));

  /* what a wrong feature is for, in one sentence, taken from its own description ("Copilot Pages is a shareable, editable canvas ...") */
  function whatItIs(f) {
    const m = /^(.+?[.!?])(?:\s+[A-Z]|$)/.exec(f.description || '');
    const s = m ? m[1] : (f.description || '');
    if (!s) return f.name;
    const named = new RegExp('^(?:(?:the|a|an)\\s+)?(?:microsoft\\s+)?' + f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (named.test(s)) return s; /* the sentence already starts with what it is called */
    return /^(A|An|The)\s/.test(s) ? `${f.name} is ${s.charAt(0).toLowerCase()}${s.slice(1)}` : `${f.name}: ${s}`;
  }

  function makeQuiz(kind) {
    const prompt = kind === 'prompt';
    const cfg = () => FD.config[prompt ? 'promptLab' : 'scenarioMatch'];
    const q = { kind, key: prompt ? 'prompt' : 'match', ready: false, scenarios: [], byId: {}, problems: [] };
    if (prompt) { q.ingredients = []; q.learn = null; }
    const statsOf = (p) => (p && (prompt ? p.prompts : p.match)) || null;

    /* ---------- the data ---------- */
    function normPrompt(s, i, problems) {
      const at = `scenario ${i + 1}${s && s.id ? ' (' + s.id + ')' : ''}`;
      const id = str(s && s.id, 60);
      if (!/^[a-z0-9-]{3,60}$/.test(id)) { problems.push(`${at}: the id must be 3 to 60 lowercase letters, numbers or dashes`); return null; }
      const situation = str(s.situation, 400);
      if (!situation) { problems.push(`${at}: no situation`); return null; }
      const raw = Array.isArray(s.options) ? s.options : [];
      if (raw.length !== OPTIONS) { problems.push(`${at}: needs exactly ${OPTIONS} prompts`); return null; }
      const options = raw.map((o) => ({
        text: str(o && o.text, 600), why: str(o && o.why, 400), best: !!(o && o.best === true),
        has: Array.from(new Set((Array.isArray(o && o.has) ? o.has : []).map((h) => String(h)).filter((h) => ING.includes(h))))
      }));
      if (options.some((o) => !o.text || !o.why)) { problems.push(`${at}: every prompt needs text and a "why"`); return null; }
      if (options.filter((o) => o.best).length !== 1) { problems.push(`${at}: exactly one prompt must be best`); return null; }
      const f = s.feature && FD.lib && FD.lib.byId ? FD.lib.byId[String(s.feature)] : null;
      return { id, app: str(s.app, 24), feature: f ? f.id : '', situation, options, tip: str(s.tip, 240), bestIndex: options.findIndex((o) => o.best) };
    }
    /* a Scenario Match scenario: the right feature is option 0 and the three wrong ones follow (the order shown to the player is shuffled) */
    function normMatch(s, i, problems) {
      const at = `scenario ${i + 1}${s && s.id ? ' (' + s.id + ')' : ''}`;
      const id = str(s && s.id, 60);
      if (!/^[a-z0-9-]{3,60}$/.test(id)) { problems.push(`${at}: the id must be 3 to 60 lowercase letters, numbers or dashes`); return null; }
      const f = FD.lib && FD.lib.byId ? FD.lib.byId[String(s.feature)] : null;
      if (!f) { problems.push(`${at}: the feature "${s && s.feature}" is not in features.json`); return null; }
      const need = str(s.need, 300);
      if (!need) { problems.push(`${at}: no need (the "I want to ..." line)`); return null; }
      const wrong = [];
      (Array.isArray(s.options) ? s.options : []).forEach((o) => {
        const fid = typeof o === 'string' ? o : o && o.feature, wf = FD.lib.byId[String(fid)];
        if (wf && wf.id !== f.id && !wrong.some((w) => w.f.id === wf.id)) wrong.push({ f: wf, why: typeof o === 'string' ? '' : str(o && o.why, 300) });
      });
      if (wrong.length < OPTIONS - 1) { problems.push(`${at}: needs ${OPTIONS - 1} different wrong features in "options"`); return null; }
      const text = str(s.text, 400);
      const options = [{ feature: f.id, best: true, why: text }].concat(wrong.slice(0, OPTIONS - 1).map((w) => ({ feature: w.f.id, best: false, why: w.why || whatItIs(w.f) })));
      return { id, app: '', feature: f.id, title: str(s.title, 60) || 'Example scenario', need, situation: need, text, options, tip: '', bestIndex: 0 };
    }
    /* takes the parsed file; whatever can't be used is left out and listed in q.problems, so a slip in the file never breaks the game */
    q.setData = function (raw) {
      const problems = [], seen = new Set();
      if (prompt) {
        const given = raw && Array.isArray(raw.ingredients) ? raw.ingredients : [];
        q.ingredients = ING.map((id) => {
          const g = given.find((x) => x && x.id === id) || {}, d = ING_DEFAULT[id];
          return { id, name: str(g.name, 24) || d.name, color: FD.data.BRAND_KEYS.includes(g.color) ? g.color : d.color, text: str(g.text, 120) || d.text, example: str(g.example, 140) || d.example };
        });
        const lm = raw && raw.learnMore;
        q.learn = lm && safeLink(lm.url) ? { url: safeLink(lm.url), label: str(lm.label, 80) || 'How to write Copilot prompts' } : null;
      }
      const norm = prompt ? normPrompt : normMatch;
      q.scenarios = (raw && Array.isArray(raw.scenarios) ? raw.scenarios : []).map((s, i) => norm(s || {}, i, problems)).filter((s) => {
        if (!s) return false;
        if (seen.has(s.id)) { problems.push(`the id "${s.id}" is used twice`); return false; }
        seen.add(s.id); return true;
      });
      q.byId = Object.fromEntries(q.scenarios.map((s) => [s.id, s]));
      q.problems = problems; q.ready = true;
      if (!prompt) attachExamples();
      if (problems.length && typeof console !== 'undefined') console.warn(`${prompt ? 'Prompt Lab (data/prompts.json)' : 'Scenario Match (data/scenarios.json)'}: ${problems.join(' | ')}`);
      return q;
    };
    /* the Feature Book and the answer screen show a feature's scenarios as its "Example scenarios"
       (a feature from a community pack that has no scenarios of its own keeps the example scenarios written in its pack) */
    function attachExamples() {
      if (!FD.lib || !FD.lib.features || !q.scenarios.length) return;
      FD.lib.features.forEach((f) => {
        const mine = q.scenarios.filter((s) => s.feature === f.id);
        if (mine.length) f.useCases = mine.map((s) => ({ id: s.id, title: s.title, text: s.text, need: s.need }));
      });
    }
    const inject = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
    /* embedded data (the single-file edition) -> data/<file>.json -> its script mirror data/<file>.js (for a folder opened from disk) */
    q.load = async function (o = {}) {
      const g = prompt ? 'FD_PROMPTS' : 'FD_SCENARIOS', base = prompt ? 'data/prompts' : 'data/scenarios';
      let raw = window[g] || null;
      if (!raw) { try { const r = await fetch(o.json || base + '.json', { cache: 'no-cache' }); if (r.ok) raw = await r.json(); } catch (e) { /* try the script mirror */ } }
      if (!raw) { try { await inject(o.js || base + '.js'); raw = window[g] || null; } catch (e) { /* no scenarios */ } }
      return q.setData(raw);
    };

    /* ---------- scoring ---------- */
    q.pointsFor = (tries) => cfg().points[Math.min(cfg().points.length, Math.max(1, tries)) - 1] || 0;
    /* how many picks a question allows before the answer is shown (a miss) */
    q.maxTries = () => Math.min(OPTIONS - 1, Math.max(1, cfg().maxTries || OPTIONS - 1));
    /* a game plays between 1 and 10 rounds. With a filter (see q.pool) it can never be longer than the number of scenarios that match it. */
    q.maxRounds = (filter) => (filter ? Math.max(cfg().rounds.min, Math.min(cfg().rounds.max, q.pool(filter).length)) : cfg().rounds.max);
    q.clampRounds = (n, filter) => { const r = cfg().rounds; return Math.min(q.maxRounds(filter), Math.max(r.min, Math.round(+n || r.defaultRounds))); };
    q.maxPoints = (rounds = cfg().rounds.defaultRounds) => cfg().points[0] * q.clampRounds(rounds);
    /* 1st pick right = 50, 2nd = 30, 3rd = 10; three weaker picks and the answer is shown for no points (see FD.config) */
    q.stars = (points, rounds) => { const m = q.maxPoints(rounds); return points >= m * 0.9 ? 3 : points >= m * 0.6 ? 2 : 1; };

    /* ---------- what a game can draw from ----------
       A filter is { category, feature } for Prompt Lab and { category, difficulty } for Scenario Match. A category (or a feature) is a list of the ones allowed;
       an empty list, 'all' or nothing means no limit. A scenario belongs to the category and difficulty of the Copilot feature it is about. */
    q.pool = function (filter) {
      const f = filter || {}, cats = selList(f.category), feats = selList(f.feature);
      return q.scenarios.filter((s) => {
        const ft = FD.lib.byId[s.feature];
        if (!ft) return !feats.length && !cats.length && isAll(f.difficulty);
        if (feats.length && !feats.includes(s.feature)) return false;
        if (cats.length && !cats.includes(ft.category)) return false;
        if (!isAll(f.difficulty) && ft.difficulty !== f.difficulty) return false;
        return true;
      });
    };
    /* what the setup dropdowns offer: only categories and features that have at least one scenario, in the library's own order */
    q.categories = () => FD.lib.categories.map((c) => c.name).filter((name) => q.pool({ category: [name] }).length);
    /* the features inside the given categories (one or several) that have scenarios */
    q.features = (category) => { const cats = selList(category); return FD.lib.features.filter((ft) => cats.includes(ft.category) && q.scenarios.some((s) => s.feature === ft.id)); };
    q.difficulties = () => FD.config.difficulties.filter((d) => q.pool({ difficulty: d }).length);
    /* a filter that can be trusted (it may come from a saved game or from this device's saved choices, or from an earlier version that saved one category as text):
       anything unknown is let go, and a feature only counts inside a category that is chosen */
    q.cleanFilter = function (v) {
      const o = v && typeof v === 'object' ? v : {};
      const have = q.categories(), category = selList(o.category).filter((c) => have.includes(c)).sort((a, b) => have.indexOf(a) - have.indexOf(b));
      if (!prompt) return { category, difficulty: q.difficulties().includes(o.difficulty) ? o.difficulty : 'all' };
      const allowed = category.length ? q.features(category).map((ft) => ft.id) : [];
      return { category, feature: selList(o.feature).filter((id) => allowed.includes(id)) };
    };
    q.isFiltered = (filter) => { const f = q.cleanFilter(filter); return f.category.length > 0 || (prompt ? f.feature.length > 0 : f.difficulty !== 'all'); };
    /* what to call a filter on screen: Prompt Lab names the feature(s) (or the categories), Scenario Match the categories and the level.
       One or two are named; more are counted ("3 categories"). */
    q.focusName = function (filter) {
      const f = q.cleanFilter(filter);
      const some = (list, noun, name) => (list.length <= 2 ? list.map(name).join(', ') : `${list.length} ${noun}`);
      if (prompt) return f.feature.length ? some(f.feature, 'features', (id) => FD.lib.byId[id].name) : f.category.length ? some(f.category, 'categories', (c) => c) : '';
      return [f.category.length ? some(f.category, 'categories', (c) => c) : '', f.difficulty !== 'all' ? f.difficulty : ''].filter(Boolean).join(' \u00B7 ');
    };

    /* ---------- choosing a round: what you haven't met first, then what you met least and longest ago, a mix of apps (or of features) ---------- */
    q.pickIds = function (p, n = cfg().rounds.defaultRounds, rng = Math.random, filter) {
      let pool = q.pool(filter);
      if (!pool.length) pool = q.scenarios.slice(); /* a filter that matches nothing falls back to everything */
      n = Math.min(q.clampRounds(n), pool.length);
      const st = statsOf(p), seen = (st && st.seen) || {};
      const unseenFirst = !filter || filter.prioritise !== false;
      const ranked = shuffle(pool, rng);
      if (unseenFirst) ranked.sort((a, b) => {
        const x = seen[a.id] || { n: 0, last: 0 }, y = seen[b.id] || { n: 0, last: 0 };
        return x.n - y.n || x.last - y.last;
      });
      const spread = prompt ? (s) => s.app : (s) => s.feature, cap = prompt ? 2 : 1;
      const picked = [], per = {};
      ranked.forEach((s) => { const k = spread(s); if (picked.length < n && (per[k] || 0) < cap) { picked.push(s); per[k] = (per[k] || 0) + 1; } });
      ranked.forEach((s) => { if (picked.length < n && !picked.includes(s)) picked.push(s); });
      return shuffle(picked, rng).map((s) => s.id);
    };

    /* ---------- a game in progress (kept in the player's saved game, so it can be picked up again) ---------- */
    /* a game remembers the category, feature or level it was set to ("focus"), so Resume and the results can say what it was about */
    q.newRun = function (p, rounds, filter) {
      const focus = q.cleanFilter(filter);
      const ids = q.pickIds(p, rounds, undefined, Object.assign({}, focus, filter && filter.prioritise === false ? { prioritise: false } : {})), id = uid('r_');
      const run = { v: 1, id, startedAt: Date.now(), savedAt: Date.now(), ids, orders: ids.map((sid) => shuffle(ALL, seeded(id + ':' + sid))), i: 0, wrong: [], done: false, items: [], points: 0 };
      if (q.isFiltered(focus)) run.focus = focus;
      return run;
    };
    /* read the saved game, check it, and drop it if it isn't usable (a backup file could hold anything) */
    q.readRun = function (p) {
      const d = p && p.active && p.active[q.key];
      if (!d) return null;
      const drop = () => { delete p.active[q.key]; FD.store.save(); return null; };
      if (typeof d !== 'object' || d.v !== 1 || !Array.isArray(d.ids) || !d.ids.length || d.ids.length > Math.max(20, cfg().rounds.max) || Date.now() - (+d.savedAt || 0) > MAX_AGE) return drop();
      if (!d.ids.every((id) => q.byId[id]) || !Array.isArray(d.orders) || d.orders.length !== d.ids.length || !d.orders.every(perm)) return drop();
      const i = Math.round(+d.i);
      if (!Number.isFinite(i) || i < 0 || i >= d.ids.length) return drop();
      const items = (Array.isArray(d.items) ? d.items : []).slice(0, d.ids.length).map((it) => ({ id: String(it && it.id), tries: Math.min(q.maxTries(), Math.max(1, Math.round(+(it && it.tries)) || 1)), points: Math.max(0, Math.round(+(it && it.points)) || 0), solved: !!(it && it.solved),
        /* the XP a round gave when it was answered. A game saved by an older version has none (null), and its rounds are counted when the game ends. */
        xp: it && it.xp != null && Number.isFinite(+it.xp) ? Math.max(0, Math.round(+it.xp)) : null }));
      const done = d.done === true;
      if (items.length !== i + (done ? 1 : 0)) return drop(); /* a round that has been answered counts once it is done, and Next moves on */
      const wrong = (Array.isArray(d.wrong) ? d.wrong : []).filter((x, k, a) => ALL.includes(x) && a.indexOf(x) === k && x !== q.byId[d.ids[i]].bestIndex).slice(0, q.maxTries());
      const focus = q.cleanFilter(d.focus);
      const run = { v: 1, id: String(d.id || 'r_x').slice(0, 20), startedAt: +d.startedAt || Date.now(), savedAt: +d.savedAt || Date.now(), ids: d.ids.slice(), orders: d.orders.map((o) => o.slice()), i, wrong, done, items, points: items.reduce((a, it) => a + it.points, 0) };
      if (q.isFiltered(focus)) run.focus = focus;
      return run;
    };
    return q;
  }

  FD.prompts = makeQuiz('prompt');
  FD.scenarios = makeQuiz('match');
  /* the one answer to "which engine?" for a question game mode: 'prompt' -> Prompt Lab, 'match' -> Scenario Match */
  FD.quiz = (kind) => (kind === 'match' ? FD.scenarios : FD.prompts);
  /* what a feature is for, in one sentence (used to explain a weaker pick in Scenario Match) */
  FD.whatItIs = whatItIs;
})();
