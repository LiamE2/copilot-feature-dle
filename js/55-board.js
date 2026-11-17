/* Copilot Feature-dle · leaderboards
   Default = everyone who has played on THIS device plus a few sample players (delete SAMPLE below once real players fill the board).
   Optional = a shared organisation board via a tiny HTTP endpoint (config.leaderboard.endpoint, see README).
   A player can hide their own profile in Settings (settings.hideFromBoard): they leave the board and nothing of theirs is sent to a shared one. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { dateKey, seeded } = FD.u;

  const SAMPLE = [
    ['Aroha T.', 'green'], ['Priya S.', 'purple'], ['Jordan M.', 'orange'], ['Mei L.', 'pink'], ['Tariq H.', 'blue'],
    ['Chloe B.', 'red'], ['Luca R.', 'yellow'], ['Sam W.', 'navy'], ['Ngozi A.', 'green'], ['Ben K.', 'blue']
  ];

  /* one sample player is already a Copilot Champion, past the top rank's XP, so the champion look can be seen on the board without weeks of play */
  const CHAMPION = 'Priya S.';

  /* hunt, match or prompt: the day's game mode is the same for everyone, so a board that doesn't say (a shared event board) is talking about it too */
  const dayKindOf = (day) => { try { const i = FD.daily.info(day); return i && !i.weekend && i.kind ? i.kind : 'hunt'; } catch (e) { return 'hunt'; } };

  function samplePlayers(today) {
    const totalFeatures = FD.lib.features.length, totalBadges = FD.badges.all(FD.lib).length;
    const topXp = FD.config.ranks[FD.config.ranks.length - 1].xp;
    /* a Scenario Match or Prompt Lab day is answered in up to three picks, worth 50, 30 and 10, not in hints */
    const dayKind = dayKindOf(today), qcfg = dayKind === 'match' ? FD.config.scenarioMatch : dayKind === 'prompt' ? FD.config.promptLab : null;
    return SAMPLE.map(([name, color], i) => {
      const r = seeded('sample|' + name), champ = name === CHAMPION;
      const played = champ ? 188 : 14 + Math.floor(r() * 120);
      const rd = seeded('sample-day|' + name + '|' + today);
      const playedToday = rd() < 0.75;
      const hints = 1 + Math.floor(rd() * 4), tries = qcfg ? Math.min(hints, qcfg.points.length) : hints;
      const totalScore = Math.round(played * (55 + r() * 35));
      const collected = champ ? Math.max(0, totalFeatures - 3) : Math.min(totalFeatures, Math.round(played * (0.35 + r() * 0.3)));
      const mastered = champ ? Math.max(0, totalFeatures - 9) : Math.min(collected, Math.round(played * (0.03 + r() * 0.09)));
      return {
        id: 'sample-' + i, sample: true, name, color, played,
        maxStreak: champ ? 36 : 2 + Math.floor(r() * 24), bestScore: champ ? 120 : 120 + Math.floor(r() * 110), totalScore,
        xp: champ ? topXp + 1480 : Math.min(topXp - 1, Math.round(totalScore * (0.9 + r() * 0.4))), collected, collectedTotal: totalFeatures, mastered,
        achievements: champ ? Math.round(totalBadges * 0.8) : Math.min(totalBadges, 2 + Math.round(collected / 5 + r() * 3)), achievementsTotal: totalBadges,
        today: playedToday ? { score: (qcfg ? qcfg.points[tries - 1] : FD.config.points[hints - 1]) + (rd() < 0.5 ? Math.floor(rd() * FD.config.speedBonus.max) : 0), hints: tries, timeMs: 9000 + Math.floor(rd() * 70000), won: true, kind: dayKind } : null
      };
    });
  }

  function localPlayers(today) {
    const me = FD.store.profile().id;
    return FD.store.profiles().map((p) => {
      const t = p.daily.results[today], s = FD.scoring.summary(p, FD.lib), tot = FD.scoring.totals(p);
      return {
        id: p.id, sample: false, you: p.id === me, name: p.name, color: p.color, played: tot.puzzles,
        maxStreak: p.daily.max, bestScore: p.stats.bestScore, totalScore: FD.scoring.totalScore(p),
        xp: p.xp, collected: s.collected, collectedTotal: s.collectedTotal, mastered: FD.scoring.masteredCount(p, FD.lib), achievements: s.achievements, achievementsTotal: s.achievementsTotal,
        today: t ? { score: t.score, hints: t.hints, timeMs: t.timeMs, won: t.won, kind: t.kind || 'hunt' } : null
      };
    });
  }

  function rank(players) {
    const byDaily = players.filter((p) => p.today).sort((a, b) => b.today.score - a.today.score || (a.today.timeMs || 0) - (b.today.timeMs || 0));
    return {
      daily: byDaily,
      streak: players.filter((p) => p.maxStreak > 0).sort((a, b) => b.maxStreak - a.maxStreak || b.totalScore - a.totalScore),
      score: players.filter((p) => p.totalScore > 0).sort((a, b) => b.totalScore - a.totalScore),
      puzzles: players.filter((p) => p.played > 0).sort((a, b) => b.played - a.played),
      mastery: players.filter((p) => p.mastered > 0).sort((a, b) => b.mastered - a.mastered || b.collected - a.collected),
      players
    };
  }
  const hidden = () => !!FD.store.settings().hideFromBoard;
  function local() {
    const today = dateKey();
    const players = localPlayers(today).filter((p) => !(p.you && hidden())).concat(samplePlayers(today));
    return rank(players);
  }

  /* ---------- optional shared board ---------- */
  const lb = () => FD.config.leaderboard || {};
  const remoteEnabled = () => !!lb().endpoint;

  async function fetchRemote() {
    const u = new URL(lb().endpoint, location.href);
    u.searchParams.set('date', dateKey());
    const r = await fetch(u.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const me = FD.store.profile().id;
    const BRAND = ['blue', 'red', 'purple', 'orange', 'green', 'pink', 'yellow', 'navy'];
    const int = (v, max) => Math.min(max, Math.max(0, Math.round(+v || 0)));
    const dayKind = dayKindOf(dateKey());
    const players = (Array.isArray(j.players) ? j.players : []).filter((p) => p && typeof p === 'object').slice(0, 500).filter((p) => !(hidden() && String(p.playerId || '') === me)).map((p) => ({
      id: String(p.playerId || p.name || ''), sample: false, live: true, you: String(p.playerId || '') === me, name: String(p.name || 'Player').slice(0, 24), color: BRAND.includes(p.color) ? p.color : 'blue',
      played: +p.played || 0, maxStreak: +p.maxStreak || 0, bestScore: +p.bestScore || 0, totalScore: +p.totalScore || 0,
      xp: int(p.xp, 1e7), collected: int(p.collected, 1000), collectedTotal: FD.lib.features.length, mastered: int(p.mastered, 1000), achievements: int(p.achievements, 200), achievementsTotal: FD.badges.all(FD.lib).length,
      today: p.today ? { score: +p.today.score || 0, hints: +p.today.hints || 0, timeMs: +p.today.timeMs || 0, won: p.today.won !== false, kind: dayKind } : null
    }));
    return rank(players);
  }

  /* fire-and-forget: never block or break gameplay if the endpoint is down */
  function submit(r, out) {
    if (!remoteEnabled() || r.mode !== 'daily' || hidden()) return;
    const p = FD.store.profile(), sm = FD.scoring.summary(p, FD.lib), tot = FD.scoring.totals(p);
    const body = {
      date: r.dateKey, playerId: p.id, name: p.name, color: p.color,
      today: { score: out.breakdown ? out.breakdown.total : 0, hints: r.hintsUsed, timeMs: r.timeMs, won: !!r.won },
      maxStreak: p.daily.max, totalScore: FD.scoring.totalScore(p), bestScore: p.stats.bestScore, played: tot.puzzles,
      xp: p.xp, collected: sm.collected, mastered: FD.scoring.masteredCount(p, FD.lib), achievements: sm.achievements
    };
    try { fetch(lb().endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  FD.board = { local, fetchRemote, remoteEnabled, submit, hidden };
})();
