/* Copilot Feature-dle · guess matching
   Full names, aliases, brand-prefix variants ("Pages" = "Copilot Pages"), plurals, typos and missing spaces. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  /* words that do not help identify a feature on their own */
  const WEAK = new Set(['microsoft', 'ms', '365', 'm365', 'office', 'copilot', 'in', 'the', 'a', 'an', 'for', 'of', 'with', 'and', 'to', 'app', 'apps', 'my', 'your']);
  const NOISE = new Set(['microsoft', 'ms', '365', 'm365', 'the', 'a', 'an', 'my', 'your']);

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ').replace(/\+/g, ' plus ')
      .replace(/['\u2019`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  const stem = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
  function strongOf(n) {
    const toks = n ? n.split(' ').map(stem) : [];
    const strong = toks.filter((t) => !WEAK.has(t));
    return strong.length ? strong : toks.filter((t) => !NOISE.has(t));
  }
  const mkForm = (raw) => { const n = norm(raw); return { raw, n, strong: strongOf(n), squash: n.replace(/ /g, '') }; };

  /* Optimal-string-alignment distance with early exit */
  function dl(a, b, max) {
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: bl + 1 }, (_, j) => j), cur = new Array(bl + 1);
    for (let i = 1; i <= al; i++) {
      cur[0] = i; let rowMin = i;
      for (let j = 1; j <= bl; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur; cur = new Array(bl + 1);
    }
    return prev[bl];
  }
  const maxEdits = (len) => (len <= 3 ? 0 : len <= 7 ? 1 : len <= 13 ? 2 : 3);

  function tokEq(a, b) {
    if (a === b) return true;
    const m = maxEdits(Math.min(a.length, b.length));
    if (!m) return false;
    if (Math.abs(a.length - b.length) > m) {
      const s = a.length < b.length ? a : b, l = a.length < b.length ? b : a;
      return s.length >= 5 && l.startsWith(s) && s.length / l.length >= 0.75; /* "research" ~ "researcher" */
    }
    return dl(a, b, m) <= m;
  }

  /* 0 = no match; otherwise { s: confidence, kind: exact | alias | fuzzy } */
  function scoreForm(g, c, isName) {
    if (!g.n || !c.n) return { s: 0, kind: 'none' };
    if (g.n === c.n) return { s: 1, kind: isName ? 'exact' : 'alias' };
    if (g.strong.length && g.strong.length === c.strong.length) {
      const used = new Array(c.strong.length).fill(false);
      let ok = true, fuzzy = false;
      for (const gt of g.strong) {
        let found = -1;
        for (let i = 0; i < c.strong.length; i++) if (!used[i] && gt === c.strong[i]) { found = i; break; }
        if (found < 0) for (let i = 0; i < c.strong.length; i++) if (!used[i] && tokEq(gt, c.strong[i])) { found = i; fuzzy = true; break; }
        if (found < 0) { ok = false; break; }
        used[found] = true;
      }
      if (ok) return { s: fuzzy ? 0.9 : 0.97, kind: fuzzy ? 'fuzzy' : 'alias' };
    }
    const a = g.squash, b = c.squash;
    const m = maxEdits(Math.min(a.length, b.length));
    if (m && Math.abs(a.length - b.length) <= m) {
      const d = dl(a, b, m);
      if (d <= m) return { s: 0.85 - d * 0.05, kind: 'fuzzy' };
    }
    return { s: 0, kind: 'none' };
  }

  const formsOf = (f) => f._forms || (f._forms = [{ ...mkForm(f.name), isName: true }].concat(f.aliases.map((a) => ({ ...mkForm(a), isName: false }))));

  /* Find the library feature the player most likely means.
     If several different features tie on a non-exact match ("Wave"), the result is flagged `ambiguous` so the game can ask for more detail. */
  function resolve(text, features, preferId) {
    const g = mkForm(text);
    if (!g.n) return null;
    const hits = [];
    for (const f of features) {
      let top = null;
      for (const c of formsOf(f)) {
        const r = scoreForm(g, c, c.isName);
        if (r.s > 0 && (!top || r.s > top.s)) top = { feature: f, s: r.s, kind: r.kind };
      }
      if (top) hits.push(top);
    }
    if (!hits.length) return null;
    const max = Math.max(...hits.map((h) => h.s));
    const tied = hits.filter((h) => h.s === max);
    const best = tied.find((h) => h.feature.id === preferId) || tied[0];
    return tied.length > 1 && max < 1 ? { ...best, ambiguous: true, options: tied.map((h) => h.feature) } : best;
  }

  /* autocomplete: prefix > word-prefix > multi-word prefix > substring > fuzzy */
  function suggest(text, features, limit = 7, skipIds = []) {
    const q = norm(text);
    if (!q) return [];
    const qt = q.split(' ');
    const qForm = { n: q, strong: strongOf(q), squash: q.replace(/ /g, '') };
    const out = [];
    for (const f of features) {
      if (skipIds.includes(f.id)) continue;
      let best = 0;
      for (const c of formsOf(f)) {
        const words = c.n.split(' ');
        let s = 0;
        if (c.n.startsWith(q)) s = 100 - Math.min(40, c.n.length - q.length);
        else if (words.some((t) => t.startsWith(q))) s = 80;
        else if (qt.length > 1 && qt.every((t) => words.some((ct) => ct.startsWith(t)))) s = 70;
        else if (q.length >= 3 && c.n.includes(q)) s = 60;
        else { const r = scoreForm(qForm, c, c.isName); if (r.s > 0) s = 50 + r.s * 10; }
        if (s > best) best = s;
      }
      if (best) out.push({ feature: f, score: best });
    }
    out.sort((a, b) => b.score - a.score || a.feature.name.localeCompare(b.feature.name));
    return out.slice(0, limit).map((o) => o.feature);
  }

  /* feedback for a wrong guess: how "warm" is it, and is the answer easier or harder? */
  function temperature(g, target) {
    if (g.id === target.id) return 'correct';
    const shared = g.tags.some((t) => target.tags.includes(t)) || (target.related || []).includes(g.id) || (g.related || []).includes(target.id);
    const sameCat = g.category === target.category;
    if ((sameCat && shared) || (target.related || []).includes(g.id) || (g.related || []).includes(target.id)) return 'hot';
    if (sameCat || shared) return 'warm';
    return 'cold';
  }
  const direction = (g, target) => (target.diffRank > g.diffRank ? 'up' : target.diffRank < g.diffRank ? 'down' : 'same');

  FD.match = { norm, resolve, suggest, temperature, direction, dl };
})();
