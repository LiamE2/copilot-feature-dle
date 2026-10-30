/* Copilot Feature-dle · leaderboards
   Default = everyone who has played on THIS device (great for a shared laptop at a workshop) plus clearly-labelled sample players.
   Optional = a shared event board via a tiny HTTP endpoint (config.leaderboard.endpoint, see README). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { dateKey, seeded } = FD.u;

  const SAMPLE = [
    ['Aroha T.', 'green'], ['Priya S.', 'purple'], ['Jordan M.', 'orange'], ['Mei L.', 'pink'], ['Tariq H.', 'blue'],
    ['Chloe B.', 'red'], ['Luca R.', 'yellow'], ['Sam W.', 'navy'], ['Ngozi A.', 'green'], ['Ben K.', 'blue']
  ];

  function samplePlayers(today) {
    return SAMPLE.map(([name, color], i) => {
      const r = seeded('sample|' + name);
      const played = 14 + Math.floor(r() * 120);
      const rd = seeded('sample-day|' + name + '|' + today);
      const playedToday = rd() < 0.75;
      const hints = 1 + Math.floor(rd() * 4);
      const mult = 1 + Math.floor(rd() * 4) * 0.1;
      return {
        id: 'sample-' + i, sample: true, name, color, played,
        maxStreak: 2 + Math.floor(r() * 24), bestScore: 120 + Math.floor(r() * 110), totalScore: Math.round(played * (55 + r() * 35)),
        today: playedToday ? { score: Math.round(FD.config.points[hints - 1] * mult) + (rd() < 0.4 ? 10 : 0), hints, timeMs: 9000 + Math.floor(rd() * 70000), won: true } : null
      };
    });
  }

  function localPlayers(today) {
    const me = FD.store.profile().id;
    return FD.store.profiles().map((p) => {
      const t = p.daily.results[today];
      return {
        id: p.id, sample: false, you: p.id === me, name: p.name, color: p.color, played: p.stats.played,
        maxStreak: p.daily.max, bestScore: p.stats.bestScore, totalScore: p.stats.totalScore,
        today: t ? { score: t.score, hints: t.hints, timeMs: t.timeMs, won: t.won } : null
      };
    });
  }

  function rank(players) {
    const byDaily = players.filter((p) => p.today).sort((a, b) => b.today.score - a.today.score || (a.today.timeMs || 0) - (b.today.timeMs || 0));
    return {
      daily: byDaily,
      streak: players.filter((p) => p.maxStreak > 0).sort((a, b) => b.maxStreak - a.maxStreak || b.totalScore - a.totalScore),
      score: players.filter((p) => p.totalScore > 0).sort((a, b) => b.totalScore - a.totalScore),
      games: players.filter((p) => p.played > 0).sort((a, b) => b.played - a.played),
      players
    };
  }
  function local() {
    const today = dateKey();
    const players = localPlayers(today).concat(FD.store.settings().sampleBoard ? samplePlayers(today) : []);
    return rank(players);
  }

  /* ---------- optional shared event board ---------- */
  const lb = () => FD.config.leaderboard || {};
  const remoteEnabled = () => !!lb().endpoint;

  async function fetchRemote() {
    const u = new URL(lb().endpoint, location.href);
    u.searchParams.set('eventCode', lb().eventCode || '');
    u.searchParams.set('date', dateKey());
    const r = await fetch(u.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const me = FD.store.profile().id;
    const BRAND = ['blue', 'red', 'purple', 'orange', 'green', 'pink', 'yellow', 'navy'];
    const players = (Array.isArray(j.players) ? j.players : []).filter((p) => p && typeof p === 'object').slice(0, 500).map((p) => ({
      id: String(p.playerId || p.name || ''), sample: false, live: true, you: String(p.playerId || '') === me, name: String(p.name || 'Player').slice(0, 24), color: BRAND.includes(p.color) ? p.color : 'blue',
      played: +p.played || 0, maxStreak: +p.maxStreak || 0, bestScore: +p.bestScore || 0, totalScore: +p.totalScore || 0,
      today: p.today ? { score: +p.today.score || 0, hints: +p.today.hints || 0, timeMs: +p.today.timeMs || 0, won: p.today.won !== false } : null
    }));
    return rank(players);
  }

  /* fire-and-forget: never block or break gameplay if the endpoint is down */
  function submit(r, out) {
    if (!remoteEnabled() || r.mode !== 'daily') return;
    const p = FD.store.profile();
    const body = {
      eventCode: lb().eventCode || '', date: r.dateKey, playerId: p.id, name: p.name, color: p.color,
      today: { score: out.breakdown ? out.breakdown.total : 0, hints: r.hintsUsed, timeMs: r.timeMs, won: !!r.won },
      maxStreak: p.daily.max, totalScore: p.stats.totalScore, bestScore: p.stats.bestScore, played: p.stats.played
    };
    try { fetch(lb().endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  FD.board = { local, fetchRemote, remoteEnabled, submit };
})();
