/* Copilot Feature-dle · core helpers
   Classic scripts on a shared FD namespace so the game also runs from file:// (no ES-module CORS issues). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  /* ---------- escaping + tiny templating ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  class Safe {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
  }
  const raw = (s) => new Safe(String(s));
  const flat = (v) => {
    if (v == null || v === false || v === true) return '';
    if (v instanceof Safe) return v.s;
    if (Array.isArray(v)) return v.map(flat).join('');
    return esc(v);
  };
  /* html`<p>${userText}</p>` escapes interpolations unless they are html`` / raw() results */
  const html = (strings, ...vals) => {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += flat(vals[i]) + strings[i + 1];
    return new Safe(out);
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const mount = (el, content) => { el.innerHTML = flat(content); return el; };

  /* ---------- safe storage (falls back to memory in private / sandboxed contexts) ---------- */
  const mem = {};
  const storage = {
    ok: (() => {
      try { const k = '__fd_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
    })(),
    get(k) {
      try { return storage.ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; }
    },
    set(k, v) {
      try { if (storage.ok) localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; }
    },
    del(k) { try { if (storage.ok) localStorage.removeItem(k); } catch (e) { /* ignore */ } delete mem[k]; }
  };

  /* ---------- deterministic randomness (daily challenge must be identical for everyone) ---------- */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seeded = (str) => mulberry32(xmur3(String(str))());
  const hash = (str) => xmur3(String(str))();
  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

  /* ---------- dates: "date keys" are local calendar days, YYYY-MM-DD ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const keyToDay = (k) => { const [y, m, d] = k.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  const dayToKey = (n) => { const d = new Date(n * 86400000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
  const addDays = (k, n) => dayToKey(keyToDay(k) + n);
  const weekdayOfKey = (k) => new Date(keyToDay(k) * 86400000).getUTCDay();
  const msToMidnight = (now = new Date()) => { const n = new Date(now); n.setHours(24, 0, 0, 0); return n - now; };
  const fmtClock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
  };
  const fmtSeconds = (ms) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))}s` : fmtClock(ms));
  const fmtDateLong = (k) => new Date(keyToDay(k) * 86400000).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const fmtDateShort = (k) => new Date(keyToDay(k) * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  /* ---------- misc ---------- */
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = () => document.documentElement.dataset.motion === 'reduce';

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  function download(data, filename, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* polite screen-reader announcements */
  function announce(msg) {
    const el = document.getElementById('sr-live');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 40);
  }

  /* tiny pub/sub */
  function emitter() {
    const subs = new Set();
    return { on(fn) { subs.add(fn); return () => subs.delete(fn); }, emit(...a) { subs.forEach((f) => { try { f(...a); } catch (e) { console.error(e); } }); } };
  }

  /* html attributes from an object: attrs({ checked: true, disabled: false, 'aria-current': 'page' }) */
  const attrs = (o) => raw(Object.entries(o).filter(([, v]) => v !== false && v != null && v !== '').map(([k, v]) => (v === true ? ' ' + k : ` ${k}="${esc(v)}"`)).join(''));

  FD.u = {
    esc, raw, html, flat, Safe, attrs, $, $$, mount, storage, seeded, hash, shuffle, pick,
    pad2, dateKey, keyToDay, dayToKey, addDays, weekdayOfKey, msToMidnight, fmtClock, fmtSeconds, fmtDateLong, fmtDateShort,
    clamp, uid, slug, debounce, plural, ordinal, sleep, reduceMotion, copyText, download, announce, emitter
  };
})();
