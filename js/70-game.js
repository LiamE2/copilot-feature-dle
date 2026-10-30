/* Copilot Feature-dle · game engine (no DOM): one puzzle = one Game */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  class Game {
    constructor(feature, o = {}) {
      this.f = feature;
      this.mode = o.mode || 'free';
      this.key = o.key || null;
      this.max = FD.config.maxAttempts;
      this.hints = FD.hints.build(feature);
      this.guesses = [];
      this.status = 'playing'; /* playing | won | lost */
      this.activeMs = o.activeMs || 0;
      this.typo = false;
    }
    get hintsShown() { return Math.min(this.guesses.length + 1, this.max); }
    get attemptsLeft() { return this.max - this.guesses.length; }
    get over() { return this.status !== 'playing'; }
    get won() { return this.status === 'won'; }
    /* hints the player saw when they finished (this is what scoring uses) */
    get hintsUsed() { return this.status === 'won' ? this.guesses.length : this.max; }
    get grid() { return this.guesses.map((g) => g.temp); }
    guessedIds() { return this.guesses.filter((g) => g.id).map((g) => g.id); }

    /* returns { ok, reason?, correct?, lost?, guess?, kind? } - invalid input never costs an attempt */
    submit(text) {
      if (this.over) return { ok: false, reason: 'over' };
      const t = String(text || '').trim();
      if (!t) return { ok: false, reason: 'empty' };
      const m = FD.match.resolve(t, FD.lib.features, this.f.id);
      if (!m) return { ok: false, reason: 'unknown' };
      if (m.ambiguous) return { ok: false, reason: 'ambiguous', options: m.options };
      const g = m.feature;
      if (this.guessedIds().includes(g.id)) return { ok: false, reason: 'duplicate', feature: g };
      const correct = g.id === this.f.id;
      const entry = { k: 'g', t, id: g.id, name: g.name, temp: correct ? 'correct' : FD.match.temperature(g, this.f), dir: FD.match.direction(g, this.f), sameCat: g.category === this.f.category, cat: g.category, diff: g.difficulty };
      this.guesses.push(entry);
      if (correct) { this.status = 'won'; this.typo = m.kind === 'fuzzy'; return { ok: true, correct: true, kind: m.kind, guess: entry }; }
      if (this.guesses.length >= this.max) this.status = 'lost';
      return { ok: true, correct: false, lost: this.status === 'lost', guess: entry, kind: m.kind };
    }

    /* "Need a nudge?" - reveal the next hint at the cost of an attempt */
    nudge() {
      if (this.over) return { ok: false };
      const entry = { k: 's', t: '', id: null, name: '', temp: 'skip', dir: null, sameCat: false };
      this.guesses.push(entry);
      if (this.guesses.length >= this.max) this.status = 'lost';
      return { ok: true, lost: this.status === 'lost', guess: entry };
    }
    giveUp() { if (!this.over) this.status = 'lost'; }

    serialize() {
      return { fid: this.f.id, mode: this.mode, key: this.key, guesses: this.guesses.map((g) => ({ ...g })), status: this.status, activeMs: Math.round(this.activeMs), typo: this.typo };
    }
    static restore(d) {
      const f = d && FD.lib.byId[d.fid];
      if (!f) return null;
      const g = new Game(f, { mode: d.mode, key: d.key, activeMs: d.activeMs });
      g.guesses = Array.isArray(d.guesses) ? d.guesses : [];
      g.status = d.status || 'playing'; g.typo = !!d.typo;
      return g;
    }
  }

  /* ---------- Free Play picker ---------- */
  const freeplay = {
    unlocked() { return FD.scoring.unlocks(FD.store.profile(), FD.lib, FD.store.settings()); },
    pool(filters = {}) {
      const un = freeplay.unlocked();
      return FD.data.pool({ difficulty: filters.difficulty, category: filters.category, pack: filters.pack, tag: filters.tag })
        .filter((f) => f.community || un[f.difficulty].unlocked);
    },
    pick(filters = {}, o = {}) {
      const p = FD.store.profile();
      let pool = freeplay.pool(filters);
      if (!pool.length) return null;
      const recent = p.history.slice(0, 5).map((h) => h.id).concat(o.exclude || []);
      const fresh = pool.filter((f) => !recent.includes(f.id));
      if (fresh.length) pool = fresh;
      if (filters.prioritise !== false) {
        const uncollected = pool.filter((f) => !FD.scoring.collected(p, f));
        if (uncollected.length) pool = uncollected;
      }
      return FD.u.pick(pool);
    }
  };

  FD.Game = Game;
  FD.freeplay = freeplay;
})();
