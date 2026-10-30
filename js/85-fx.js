/* Copilot Feature-dle · delight: confetti in brand colours, tiny synthesised sounds, haptics */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const B = FD.brand;

  /* ---------- confetti ---------- */
  let raf = 0, parts = [], ctx2d = null, cvs = null;
  function confetti(opts = {}) {
    if (FD.u.reduceMotion() || !FD.store.settings().confetti) return;
    cvs = cvs || document.getElementById('confetti');
    if (!cvs) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr;
    cvs.style.width = innerWidth + 'px'; cvs.style.height = innerHeight + 'px';
    ctx2d = cvs.getContext('2d'); ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = [B.red, B.yellow, B.orange, B.purple, B.blue, B.pink, B.green];
    const count = opts.count || 150;
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      parts.push({
        x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * (0.45 + Math.random() * 0.2),
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9), vy: -(8 + Math.random() * 11),
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, s: 7 + Math.random() * 8, c: colors[i % colors.length],
        shape: Math.random() < 0.35 ? 'dot' : 'bar', life: 0
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step() {
    ctx2d.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.life++; p.vy += 0.32; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx2d.save(); ctx2d.translate(p.x, p.y); ctx2d.rotate(p.r); ctx2d.fillStyle = p.c;
      ctx2d.globalAlpha = Math.max(0, 1 - Math.max(0, p.life - 120) / 60);
      if (p.shape === 'dot') { ctx2d.beginPath(); ctx2d.arc(0, 0, p.s / 2, 0, 6.28); ctx2d.fill(); }
      else { ctx2d.beginPath(); ctx2d.roundRect ? ctx2d.roundRect(-p.s / 2, -p.s / 4, p.s, p.s / 2, 3) : ctx2d.rect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx2d.fill(); }
      ctx2d.restore();
    });
    parts = parts.filter((p) => p.life < 180 && p.y < innerHeight + 40);
    if (parts.length) raf = requestAnimationFrame(step);
    else { raf = 0; ctx2d.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- sounds (off by default; toggle in the header or Settings) ---------- */
  let ac = null;
  const SOUNDS = {
    tap: [[660, 0, 0.06]],
    hint: [[523, 0, 0.08], [784, 0.07, 0.1]],
    wrong: [[220, 0, 0.12, 'triangle'], [165, 0.1, 0.18, 'triangle']],
    win: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]],
    lose: [[392, 0, 0.15, 'triangle'], [330, 0.14, 0.15, 'triangle'], [262, 0.28, 0.3, 'triangle']],
    badge: [[880, 0, 0.08], [1319, 0.08, 0.22]]
  };
  function play(name) {
    if (!FD.store.settings().sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      (SOUNDS[name] || []).forEach(([f, t0, dur, type]) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
      });
    } catch (e) { /* audio unavailable */ }
  }
  const haptic = (ms) => { if (FD.store.settings().haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } };

  FD.fx = { confetti, play, haptic };
})();
