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
      /* the clock counts time spent playing: leaving the game (another screen, another tab, closing the app) pauses it.
         The one exception is the Daily Challenge, which runs in real time and never pauses. */
      this.startedAt = o.startedAt || Date.now();
      this.pausedMs = o.pausedMs || 0;
      this.pausedAt = o.pausedAt || null; /* set while the clock is stopped */
      this.endedAt = o.endedAt || null;
      this.typo = false;
      this.expired = false; /* the day ended before a Daily Challenge was finished */
    }
    get activeMs() {
      const end = this.endedAt || Date.now();
      const paused = this.pausedMs + (this.pausedAt && !this.endedAt ? end - this.pausedAt : 0);
      return Math.max(0, end - this.startedAt - paused);
    }
    get hintsShown() { return Math.min(this.guesses.length + 1, this.max); }
    get attemptsLeft() { return this.max - this.guesses.length; }
    get over() { return this.status !== 'playing'; }
    get won() { return this.status === 'won'; }
    /* hints the player saw when they finished (this is what scoring uses) */
    get hintsUsed() { return this.status === 'won' ? this.guesses.length : this.max; }
    get grid() { return this.guesses.map((g) => g.temp); }
    guessedIds() { return this.guesses.filter((g) => g.id).map((g) => g.id); }

    pause() { if (!this.pausedAt && !this.over) this.pausedAt = Date.now(); }
    resume() { if (this.pausedAt) { this.pausedMs += Date.now() - this.pausedAt; this.pausedAt = null; } }
    _end() {
      this.resume();
      if (!this.endedAt) this.endedAt = Date.now();
    }

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
      if (correct) { this.status = 'won'; this.typo = m.kind === 'fuzzy'; this._end(); return { ok: true, correct: true, kind: m.kind, guess: entry }; }
      if (this.guesses.length >= this.max) { this.status = 'lost'; this._end(); }
      return { ok: true, correct: false, lost: this.status === 'lost', guess: entry, kind: m.kind };
    }

    /* "Need a nudge?": reveal the next hint at the cost of an attempt */
    skip(kind = 's') {
      if (this.over) return { ok: false };
      const entry = { k: kind, t: '', id: null, name: '', temp: 'skip', dir: null, sameCat: false };
      this.guesses.push(entry);
      if (this.guesses.length >= this.max) { this.status = 'lost'; this._end(); }
      return { ok: true, lost: this.status === 'lost', guess: entry };
    }
    nudge() { return this.skip('s'); }
    giveUp() { if (!this.over) { this.status = 'lost'; this._end(); } }
    expire() { if (!this.over) { this.expired = true; this.status = 'lost'; this._end(); } }

    serialize() {
      return {
        fid: this.f.id, mode: this.mode, key: this.key, guesses: this.guesses.map((g) => ({ ...g })), status: this.status,
        startedAt: this.startedAt, pausedMs: this.pausedMs, pausedAt: this.pausedAt, endedAt: this.endedAt,
        activeMs: Math.round(this.activeMs), typo: this.typo, expired: this.expired
      };
    }
    static restore(d, o = {}) {
      const f = d && FD.lib.byId[d.fid];
      if (!f) return null;
      const g = new Game(f, { mode: d.mode, key: d.key });
      g.guesses = Array.isArray(d.guesses) ? d.guesses : [];
      g.status = d.status || 'playing'; g.typo = !!d.typo; g.expired = !!d.expired;
      if (g.status !== 'playing') {
        /* a finished game just remembers how long it took */
        g.startedAt = 0; g.pausedMs = 0; g.pausedAt = null; g.endedAt = Math.max(1, Number(d.activeMs) || 0);
      } else if (d.startedAt) {
        g.startedAt = Number(d.startedAt) || Date.now(); g.pausedMs = Number(d.pausedMs) || 0; g.pausedAt = d.pausedAt ? Number(d.pausedAt) : null;
        /* the Daily Challenge runs in real time: a pause saved by an earlier version is dropped, and the time since counts */
        if (o.realtime) g.pausedAt = null;
      } else {
        g.startedAt = Date.now() - Math.max(0, Number(d.activeMs) || 0); /* saves from before the real-time clock */
      }
      return g;
    }
  }

  /* ---------- Feature Hunt / Free Play picker ---------- */
  const freeplay = {
    /* filters: { difficulty, category (one, or a list of them), pack, tag } */
    pool(filters = {}) {
      return FD.data.pool({ difficulty: filters.difficulty, category: filters.category, pack: filters.pack, tag: filters.tag });
    },
    /* o: { exclude: [ids to avoid], from: [features to choose from instead of the whole pool] } */
    pick(filters = {}, o = {}) {
      const p = FD.store.profile();
      let pool = o.from ? o.from.slice() : freeplay.pool(filters);
      if (!pool.length) return null;
      const recent = p.history.slice(0, 5).map((h) => h.id).concat(o.exclude || []);
      const fresh = pool.filter((f) => !recent.includes(f.id));
      if (fresh.length) pool = fresh;
      if (filters.prioritise !== false) {
        /* a hunt prefers features whose own Feature Hunt puzzle you haven't solved yet */
        const uncollected = pool.filter((f) => !FD.scoring.known(p, f));
        if (uncollected.length) pool = uncollected;
      }
      return FD.u.pick(pool);
    }
  };

  FD.Game = Game;
  FD.freeplay = freeplay;
})();
