/* Copilot Feature-dle · "What's new" data loader.
   The words live in ONE place: data/changelog.json. tools\build.ps1 mirrors it to data/changelog.js (for file:// and the single-file edition).
   Everyone sees the "What's new" popup once, automatically, whenever the version OR the game / Microsoft updates in that file change. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const cl = (FD.changelog = { data: null });

  /* "seen" is remembered as the version plus a fingerprint of what the popup says. Adding a Microsoft update or a game update
     therefore shows it once more to everyone, even if the version number was left alone. */
  cl.token = function token() {
    const d = cl.data;
    if (!d) return '';
    const part = (a) => (Array.isArray(a) ? a : []).map((i) => [i && i.title, i && i.text, i && i.date, i && i.link].map((x) => x || '').join('\u241F')).join('\u241E');
    const s = [d.version, d.intro || '', part(d.game), part(d.microsoft)].join('\u241D');
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return d.version + '+' + h.toString(36);
  };

  const valid = (d) => !!d && typeof d === 'object' && typeof d.version === 'string' && Array.isArray(d.game);
  const inject = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });

  cl.load = async function load() {
    if (valid(window.FD_CHANGELOG)) { cl.data = window.FD_CHANGELOG; return cl.data; }
    try {
      const r = await fetch('data/changelog.json', { cache: 'no-cache' });
      if (r.ok) { const d = await r.json(); if (valid(d)) { cl.data = d; return d; } }
    } catch (e) { /* fall back to the script mirror */ }
    try { await inject('data/changelog.js'); if (valid(window.FD_CHANGELOG)) cl.data = window.FD_CHANGELOG; } catch (e) { /* the popup is a bonus */ }
    return cl.data;
  };
})();
