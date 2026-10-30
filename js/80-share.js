/* Copilot Feature-dle · spoiler-free sharing: emoji text, brand-styled PNG card, Web Share, challenge links */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const B = FD.brand;

  const EMOJI = { correct: '\uD83D\uDFE9', hot: '\uD83D\uDFE7', warm: '\uD83D\uDFE8', cold: '\uD83D\uDFE6', skip: '\u2B1C' };
  const baseUrl = () => FD.config.shareUrl || (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : '');

  /* challenge links: an opaque code (not secret - just stops the answer sitting in plain sight in the URL) */
  const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => { try { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { return ''; } };
  const challengeCode = (id) => b64('fd:' + id);
  const challengeId = (code) => { const v = unb64(code); return v.startsWith('fd:') ? v.slice(3) : ''; };
  const challengeUrl = (id) => `${baseUrl() || 'index.html'}#/c/${challengeCode(id)}`;
  const dailyUrl = () => `${baseUrl() || 'index.html'}#/daily`;

  const title = (r) => (r.mode === 'daily' ? `Copilot Feature-dle #${r.number}` : r.mode === 'speed' ? 'Copilot Feature-dle Speed Round' : 'Copilot Feature-dle');

  function text(r) {
    const max = FD.config.maxAttempts;
    const lines = [];
    if (r.mode === 'speed') {
      lines.push(`${title(r)} \u23F1\uFE0F ${r.solved} solved \u2B50 ${r.score}`);
    } else {
      lines.push(`${title(r)}  ${r.won ? r.hintsUsed : 'X'}/${max}${r.won ? '  \u2B50 ' + r.score : ''}`);
      lines.push((r.grid || []).map((t) => EMOJI[t] || EMOJI.skip).join(''));
    }
    if (r.streak > 1) lines.push(`\uD83D\uDD25 ${r.streak}-day streak`);
    if (r.rank) lines.push(`\uD83C\uDFC5 ${r.rank}`);
    lines.push(r.mode === 'daily' ? dailyUrl() : baseUrl() || 'Copilot Feature-dle by Engage Squared');
    return lines.join('\n');
  }

  /* ---------- canvas card (1080 x 1080) ---------- */
  function rr(g, x, y, w, h, r) {
    const R = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + R, y); g.arcTo(x + w, y, x + w, y + h, R); g.arcTo(x + w, y + h, x, y + h, R); g.arcTo(x, y + h, x, y, R); g.arcTo(x, y, x + w, y, R); g.closePath();
  }
  function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

  function tileIcon(g, kind, cx, cy, s, color) {
    g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = s * 0.14; g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'correct') { g.beginPath(); g.moveTo(cx - s * 0.32, cy + s * 0.02); g.lineTo(cx - s * 0.08, cy + s * 0.28); g.lineTo(cx + s * 0.36, cy - s * 0.26); g.stroke(); }
    else if (kind === 'hot') { g.beginPath(); g.moveTo(cx, cy - s * 0.42); g.bezierCurveTo(cx + s * 0.05, cy - s * 0.15, cx + s * 0.38, cy - s * 0.08, cx + s * 0.38, cy + s * 0.14); g.bezierCurveTo(cx + s * 0.38, cy + s * 0.4, cx - s * 0.38, cy + s * 0.4, cx - s * 0.38, cy + s * 0.14); g.bezierCurveTo(cx - s * 0.38, cy - s * 0.05, cx - s * 0.2, cy - s * 0.12, cx - s * 0.12, cy - s * 0.2); g.bezierCurveTo(cx - s * 0.08, cy - s * 0.05, cx - s * 0.02, cy - s * 0.12, cx, cy - s * 0.42); g.closePath(); g.stroke(); }
    else if (kind === 'warm') { g.beginPath(); g.arc(cx, cy, s * 0.2, 0, Math.PI * 2); g.stroke(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * s * 0.33, cy + Math.sin(a) * s * 0.33); g.lineTo(cx + Math.cos(a) * s * 0.46, cy + Math.sin(a) * s * 0.46); g.stroke(); } }
    else if (kind === 'cold') { for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3 + Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42); g.lineTo(cx - Math.cos(a) * s * 0.42, cy - Math.sin(a) * s * 0.42); g.stroke(); } }
    else { g.beginPath(); g.moveTo(cx - s * 0.28, cy); g.lineTo(cx + s * 0.28, cy); g.stroke(); }
    g.restore();
  }

  async function card(r) {
    try { await document.fonts.load('800 80px Montserrat'); await document.fonts.load('700 40px Montserrat'); await document.fonts.load('400 30px "Noto Sans"'); } catch (e) { /* fall back to system fonts */ }
    const W = 1080, H = 1080;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const MONT = '"Montserrat", Calibri, sans-serif', NOTO = '"Noto Sans", Calibri, sans-serif';

    g.fillStyle = '#E8EEFE'; g.fillRect(0, 0, W, H);

    /* blue pill header (brand arch/pill device) */
    g.fillStyle = B.blue; rr(g, -200, 56, W - 40 + 200, 330, 165); g.fill();
    g.fillStyle = B.yellow; rr(g, 84, 100, r.mode === 'daily' ? 410 : 330, 52, 26); g.fill();
    g.fillStyle = B.navy; g.font = `700 24px ${MONT}`; g.textBaseline = 'middle';
    g.fillText(r.mode === 'daily' ? `DAILY CHALLENGE #${r.number}` : r.mode === 'speed' ? 'SPEED ROUND' : 'FREE PLAY', 108, 127);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    g.font = `700 40px ${MONT}`; g.fillText('Copilot', 84, 218);
    g.font = `800 96px ${MONT}`; g.fillText('Feature-dle', 80, 312);

    /* result card */
    g.fillStyle = '#fff'; rr(g, 60, 430, W - 120, 430, 56); g.fill();
    const tiles = r.mode === 'speed' ? [] : (r.grid || []);
    const n = Math.max(FD.config.maxAttempts, tiles.length), ts = 132, gap = 24;
    const totalW = n * ts + (n - 1) * gap, x0 = (W - totalW) / 2, ty = 476;
    const TILE = { correct: [B.green, B.navy], hot: [B.orange, B.navy], warm: [B.yellow, B.navy], cold: ['#8BADF8', B.navy], skip: ['#E5E5E5', B.grey] };
    if (r.mode !== 'speed') {
      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        if (t) { const [bg, ink] = TILE[t] || TILE.skip; g.fillStyle = bg; rr(g, x0 + i * (ts + gap), ty, ts, ts, 34); g.fill(); tileIcon(g, t, x0 + i * (ts + gap) + ts / 2, ty + ts / 2, ts * 0.62, ink); }
        else { g.strokeStyle = '#E7E7ED'; g.lineWidth = 6; rr(g, x0 + i * (ts + gap) + 3, ty + 3, ts - 6, ts - 6, 31); g.stroke(); }
      }
    }
    g.fillStyle = B.navy; g.textAlign = 'center';
    const headline = r.mode === 'speed' ? `${r.solved} solved` : r.won ? `Solved with ${r.hintsUsed} ${r.hintsUsed === 1 ? 'hint' : 'hints'}` : 'Not this time!';
    g.font = `700 54px ${MONT}`; g.fillText(headline, W / 2, r.mode === 'speed' ? 560 : 676);
    g.font = `800 120px ${MONT}`; g.fillStyle = B.blue;
    g.fillText(String(r.score || 0), W / 2 - 70, r.mode === 'speed' ? 700 : 800);
    g.font = `700 40px ${MONT}`; g.fillStyle = B.navy; g.textAlign = 'left';
    const sw = g.measureText(String(r.score || 0)).width;
    g.font = `800 120px ${MONT}`; const w2 = g.measureText(String(r.score || 0)).width;
    g.font = `700 40px ${MONT}`; g.fillText('points', W / 2 - 70 + w2 / 2 + 14, r.mode === 'speed' ? 700 : 800);
    g.textAlign = 'center';

    /* chips */
    const chips = [];
    if (r.streak > 1) chips.push([`${r.streak}-day streak`, B.orange, B.navy]);
    if (r.rank) chips.push([r.rank, B.purple, '#fff']);
    if (r.difficulty) chips.push([r.difficulty, B.green, B.navy]);
    g.font = `700 28px ${MONT}`;
    const cw = chips.map(([t]) => g.measureText(t).width + 56);
    let cx = (W - (cw.reduce((a, b) => a + b, 0) + (chips.length - 1) * 16)) / 2;
    chips.forEach(([t, bg, fg], i) => { g.fillStyle = bg; rr(g, cx, 806, cw[i], 52, 26); g.fill(); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, cx + 28, 833); cx += cw[i] + 16; });
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';

    /* footer: brandmark in a white tab + CTA */
    g.fillStyle = '#fff'; rr(g, 60, 900, 420, 130, 40); g.fill();
    const img = await loadImg(FD.logoSrc.full);
    if (img) g.drawImage(img, 90, 930, 360, Math.round(360 * 281 / 1200));
    g.textAlign = 'left'; g.fillStyle = B.navy; g.font = `700 34px ${MONT}`;
    g.fillText('Think you can beat that?', 520, 950);
    g.fillStyle = B.grey; g.font = `400 26px ${NOTO}`;
    const u = baseUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
    g.fillText(u ? u.slice(0, 38) : 'Ask your Engage Squared team for the link', 520, 992);
    g.fillStyle = B.blue; g.font = `700 24px ${MONT}`;
    g.fillText('<people> friendly technology', 520, 1022);

    return new Promise((res) => { try { c.toBlob((b) => res(b), 'image/png'); } catch (e) { res(null); } });
  }

  /* pre-render (so navigator.share can be called inside the click) */
  const cache = new Map();
  function prepare(r) { const k = JSON.stringify([r.mode, r.number, r.hintsUsed, r.score, r.grid, r.streak, r.rank, r.solved]); if (!cache.has(k)) cache.set(k, card(r)); return cache.get(k); }

  async function go(r) {
    const txt = text(r);
    if (navigator.share) {
      try {
        const blob = await prepare(r);
        const file = blob ? new File([blob], 'copilot-feature-dle.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: title(r), text: txt, files: [file] });
        else await navigator.share({ title: title(r), text: txt });
        return 'shared';
      } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    return (await FD.u.copyText(txt)) ? 'copied' : 'failed';
  }
  async function copy(r) { return (await FD.u.copyText(text(r))) ? 'copied' : 'failed'; }
  async function save(r) {
    const blob = await prepare(r);
    if (!blob) return 'failed';
    FD.u.download(blob, `copilot-feature-dle-${r.mode === 'daily' ? r.number : 'result'}.png`);
    return 'saved';
  }

  FD.share = { text, card, prepare, go, copy, save, challengeCode, challengeId, challengeUrl, dailyUrl, baseUrl };
})();
