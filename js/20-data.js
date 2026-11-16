/* Copilot Feature-dle · feature library loader, schema normaliser and pack handling
   The library lives in data/features.json (see README for the schema). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { slug, hash } = FD.u;

  const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2, Expert: 3 };
  const BRAND_KEYS = ['blue', 'red', 'purple', 'orange', 'green', 'yellow', 'pink', 'navy'];

  const lib = (FD.lib = {
    ready: false, features: [], byId: {}, categories: [], catByName: {}, packs: [], packById: {}, themes: [], meta: {}
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

  /* name "shape" for the progressive reveal: the blank tiles appear at hint 4, the first letters at hint 5 */
  function nameShape(name) {
    return name.split(/\s+/).filter(Boolean).map((w) => Array.from(w).map((c) => ({ c, alnum: /[\p{L}\p{N}]/u.test(c) })));
  }
  FD.hints = {
    build: buildHints,
    shape: nameShape,
    /* what the "extras" panel reveals at a given number of visible hints */
    level: (n) => ({ category: n >= 3, shape: n >= 4, first: n >= 5 })
  };

  /* ---------- normalise one feature ---------- */
  function normFeature(f, packId) {
    const name = str(f.name);
    const d = String(f.difficulty || 'Medium').toLowerCase();
    const difficulty = ['Easy', 'Medium', 'Hard', 'Expert'].find((x) => x.toLowerCase() === d) || 'Medium';
    const base = slug(name) || 'feature';
    const id = str(f.id) || base;
    /* the main library's example scenarios live in data/scenarios.json (Scenario Match fills this in when it loads);
       a community pack may still bring a few of its own here */
    const useCases = (Array.isArray(f.useCases) ? f.useCases : [])
      .map((u) => (typeof u === 'string' ? { title: '', text: str(u) } : { title: str(u && u.title), text: str(u && u.text) }))
      .filter((u) => u.text);
    const out = {
      id, name,
      aliases: Array.from(new Set(strList(f.aliases))),
      difficulty,
      category: str(f.category) || 'Copilot',
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
      daily: f.daily !== false
    };
    out.diffRank = DIFF_ORDER[out.difficulty];
    return out;
  }

  /* ---------- build the live library from raw JSON ---------- */
  function build(raw) {
    const meta = { updated: raw.updated || '', schemaVersion: raw.schemaVersion || 1, title: raw.title || '' };
    /* a monthly spotlight with no "year" belongs to the year the library was last updated */
    const themeYear = Number((/^(\d{4})/.exec(raw.updated || '') || [])[1]) || new Date().getFullYear();
    const features = (raw.features || []).map((f) => normFeature(f, 'core'));
    const packs = (raw.packs || []).map((p) => ({ kind: 'official', color: 'blue', icon: 'package', ...p }));
    if (!packs.find((p) => p.id === 'core')) packs.unshift({ id: 'core', name: 'Core library', description: 'Every feature in the main library.', kind: 'official', color: 'blue', icon: 'sparkle' });

    const seen = new Set();
    lib.features = features.filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
    lib.byId = Object.fromEntries(lib.features.map((f) => [f.id, f]));
    lib.packs = packs;
    lib.packById = Object.fromEntries(packs.map((p) => [p.id, p]));
    lib.themes = (raw.themes || []).map((t) => ({ ...t, month: Math.min(12, Math.max(1, Math.round(Number(t.month)) || 1)), year: Math.round(Number(t.year)) || themeYear }));
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
      if (!FD.u.selHas(o.category, f.category)) return false; /* a category, or a list of them */
      if (o.pack && o.pack !== 'all' && !f.packs.includes(o.pack)) return false;
      if (o.tag && !f.tags.includes(o.tag)) return false;
      if (o.exclude && o.exclude.includes(f.id)) return false;
      return true;
    });
  }
  const packFeatures = (id) => lib.features.filter((f) => f.packs.includes(id));
  const themeFeatures = (tag) => lib.features.filter((f) => f.tags.includes(tag));

  FD.data = { load, build, normFeature, pool, packFeatures, themeFeatures, catMeta, catColor, DIFF_ORDER, BRAND_KEYS };
})();
