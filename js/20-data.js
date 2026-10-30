/* Copilot Feature-dle · feature library loader, schema normaliser and pack handling
   The library lives in data/features.json (see README for the schema). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { slug, hash } = FD.u;

  const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2, Expert: 3 };
  const BRAND_KEYS = ['blue', 'red', 'purple', 'orange', 'green', 'yellow', 'pink', 'navy'];
  const MAX_COMMUNITY_FEATURES = 200;

  const lib = (FD.lib = {
    ready: false, features: [], byId: {}, categories: [], catByName: {}, packs: [], packById: {}, themes: [], schedule: {}, meta: {}
  });

  const str = (v) => (v == null ? '' : String(v).trim());
  const strList = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  /* only plain https links are ever rendered as hrefs (blocks javascript: and data: URLs from imported packs) */
  const safeLink = (v) => { const s = str(v); return /^https:\/\/[^\s"'<>\\]+$/i.test(s) ? s : ''; };

  /* ---------- hint helpers: authors give 3-5 hints, the game pads to a full ladder of 5 ---------- */
  function buildHints(f) {
    const max = FD.config.maxAttempts;
    const hints = f.hints.slice(0, max);
    const words = f.name.split(/\s+/).filter(Boolean);
    const fillers = [
      `It lives in the "${f.category}" family.`,
      `Its name is ${words.length} word${words.length === 1 ? '' : 's'} long.`,
      `It starts with "${f.name.charAt(0).toUpperCase()}".`,
      `The last word of its name starts with "${words[words.length - 1].charAt(0).toUpperCase()}".`
    ];
    let i = 0;
    while (hints.length < max && i < fillers.length) hints.push(fillers[i++]);
    return hints;
  }

  /* name "shape" for the progressive reveal (letters hidden until hint 4 / 5) */
  function nameShape(name) {
    return name.split(/\s+/).filter(Boolean).map((w) => Array.from(w).map((c) => ({ c, alnum: /[\p{L}\p{N}]/u.test(c) })));
  }
  FD.hints = {
    build: buildHints,
    shape: nameShape,
    /* what the "extras" panel reveals at a given number of visible hints */
    level: (n) => ({ category: n >= 3, count: n >= 3, lengths: n >= 4, first: n >= 5 })
  };

  /* ---------- normalise one feature ---------- */
  function normFeature(f, packId, opts = {}) {
    const name = str(f.name);
    const d = String(f.difficulty || 'Medium').toLowerCase();
    const difficulty = ['Easy', 'Medium', 'Hard', 'Expert'].find((x) => x.toLowerCase() === d) || 'Medium';
    const base = slug(name) || 'feature';
    const id = str(f.id) || (opts.prefix ? `${opts.prefix}--${base}` : base);
    const useCases = (Array.isArray(f.useCases) ? f.useCases : [])
      .map((u) => (typeof u === 'string' ? { title: '', text: str(u) } : { title: str(u && u.title), text: str(u && u.text) }))
      .filter((u) => u.text);
    const out = {
      id, name,
      aliases: Array.from(new Set(strList(f.aliases))),
      difficulty,
      category: str(f.category) || 'Community',
      tags: strList(f.tags).map((t) => t.toLowerCase()),
      packs: strList(f.packs).length ? strList(f.packs) : [packId || 'core'],
      hints: strList(f.hints),
      description: str(f.description),
      why: str(f.why),
      useCases,
      prompt: str(f.prompt),
      learnMore: safeLink(f.learnMore),
      learnLabel: str(f.learnLabel) || 'Read more on Microsoft Learn',
      introduced: str(f.introduced),
      related: strList(f.related),
      daily: f.daily !== false,
      community: !!opts.community
    };
    out.diffRank = DIFF_ORDER[out.difficulty];
    return out;
  }

  /* ---------- community / AI-generated pack validation (friendly errors for the import screen) ---------- */
  function validatePack(json) {
    const errors = [], warnings = [];
    let data = json;
    if (Array.isArray(data)) data = { features: data };
    if (!data || typeof data !== 'object' || !Array.isArray(data.features)) {
      return { ok: false, errors: ['I could not find a "features" list. Paste a JSON object like { "name": "My pack", "features": [ ... ] } or just an array of features.'], warnings, pack: null };
    }
    if (!data.features.length) errors.push('The "features" list is empty.');
    if (data.features.length > MAX_COMMUNITY_FEATURES) errors.push(`That is a big pack! Please keep it to ${MAX_COMMUNITY_FEATURES} features or fewer.`);
    const seen = new Set();
    const features = [];
    data.features.slice(0, MAX_COMMUNITY_FEATURES).forEach((f, i) => {
      const label = `Feature ${i + 1}${f && f.name ? ` ("${str(f.name)}")` : ''}`;
      if (!f || typeof f !== 'object') { errors.push(`${label}: expected an object.`); return; }
      if (!str(f.name)) { errors.push(`${label}: needs a "name".`); return; }
      const hints = strList(f.hints);
      if (hints.length < 3) { errors.push(`${label}: needs at least 3 hints (5 is ideal).`); return; }
      if (hints.length > 5) warnings.push(`${label}: only the first 5 hints are used.`);
      if (hints.length < 5) warnings.push(`${label}: has ${hints.length} hints, so the game will add a couple of simple ones at the end.`);
      if (f.difficulty && !['easy', 'medium', 'hard', 'expert'].includes(String(f.difficulty).toLowerCase())) warnings.push(`${label}: difficulty should be Easy, Medium, Hard or Expert (using Medium).`);
      if (f.learnMore && !safeLink(f.learnMore)) warnings.push(`${label}: "learnMore" should be a full https:// link (it will be ignored).`);
      const key = str(f.name).toLowerCase();
      if (seen.has(key)) { warnings.push(`${label}: duplicate name, skipped.`); return; }
      seen.add(key);
      features.push(f);
    });
    if (!features.length && !errors.length) errors.push('No usable features found.');
    const pack = {
      id: 'community-' + (slug(str(data.name) || 'my-pack') || 'my-pack'),
      name: str(data.name) || 'My community pack',
      description: str(data.description) || 'A pack created by the community.',
      author: str(data.author),
      features
    };
    return { ok: errors.length === 0, errors, warnings, pack };
  }

  /* ---------- build the live library from raw JSON (+ any community packs) ---------- */
  function build(raw, community) {
    const meta = { updated: raw.updated || '', schemaVersion: raw.schemaVersion || 1, title: raw.title || '' };
    const features = (raw.features || []).map((f) => normFeature(f, 'core'));
    const packs = (raw.packs || []).map((p) => ({ kind: 'official', color: 'blue', icon: 'package', ...p }));
    if (!packs.find((p) => p.id === 'core')) packs.unshift({ id: 'core', name: 'Core library', description: 'Every feature in the main library.', kind: 'official', color: 'blue', icon: 'sparkle' });

    (Array.isArray(community) ? community : []).forEach((cp) => {
      if (!cp || typeof cp !== 'object' || typeof cp.id !== 'string' || !cp.id) return;
      const prefix = cp.id;
      packs.push({ id: cp.id, name: str(cp.name) || 'Community pack', description: str(cp.description), author: str(cp.author), kind: 'community', color: BRAND_KEYS.includes(cp.color) ? cp.color : 'purple', icon: 'users' });
      (Array.isArray(cp.features) ? cp.features : []).forEach((f) => {
        if (!f || typeof f !== 'object') return;
        const nf = normFeature({ ...f, packs: [cp.id], daily: false }, cp.id, { prefix, community: true });
        if (nf.name && nf.hints.length) features.push(nf);
      });
    });

    const seen = new Set();
    lib.features = features.filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
    lib.byId = Object.fromEntries(lib.features.map((f) => [f.id, f]));
    lib.packs = packs;
    lib.packById = Object.fromEntries(packs.map((p) => [p.id, p]));
    lib.themes = raw.themes || [];
    lib.schedule = raw.schedule || {};
    lib.meta = meta;

    /* categories: metadata from JSON, anything else gets a colour from the brand palette */
    const cats = [];
    (raw.categories || []).forEach((c) => cats.push({ blurb: '', icon: 'sparkle', color: 'blue', ...c }));
    lib.features.forEach((f) => {
      if (!cats.find((c) => c.name === f.category)) cats.push({ name: f.category, color: BRAND_KEYS[hash(f.category) % BRAND_KEYS.length], icon: 'sparkle', blurb: '' });
    });
    lib.categories = cats;
    lib.catByName = Object.fromEntries(cats.map((c) => [c.name, c]));
    lib.ready = true;
  }

  /* ---------- loading: embedded data -> fetch JSON -> script mirror (file:// fallback) ---------- */
  function injectScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  async function load() {
    if (window.FD_DATA) return window.FD_DATA;
    try {
      const r = await fetch('data/features.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      await injectScript('data/features.js');
      if (window.FD_DATA) return window.FD_DATA;
      throw e;
    }
  }

  /* ---------- query helpers ---------- */
  const catMeta = (name) => lib.catByName[name] || { name, color: 'blue', icon: 'sparkle', blurb: '' };
  const catColor = (name) => catMeta(name).color;
  function pool(o = {}) {
    return lib.features.filter((f) => {
      if (o.difficulty && o.difficulty !== 'all' && f.difficulty !== o.difficulty) return false;
      if (o.category && o.category !== 'all' && f.category !== o.category) return false;
      if (o.pack && o.pack !== 'all' && !f.packs.includes(o.pack)) return false;
      if (o.tag && !f.tags.includes(o.tag)) return false;
      if (o.exclude && o.exclude.includes(f.id)) return false;
      return true;
    });
  }
  const packFeatures = (id) => lib.features.filter((f) => f.packs.includes(id));
  const coreFeatures = () => lib.features.filter((f) => f.packs.includes('core') && !f.community);

  FD.data = { load, build, validatePack, normFeature, pool, packFeatures, coreFeatures, catMeta, catColor, DIFF_ORDER, BRAND_KEYS };
})();
