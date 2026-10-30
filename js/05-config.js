/* Copilot Feature-dle · configuration
   Everything a facilitator might want to tweak lives here (no build step needed). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  FD.config = {
    version: '1.0.0',
    appName: 'Copilot Feature-dle',

    /* one guess per hint: hint 1 is free, every miss unlocks the next one */
    maxAttempts: 5,
    points: [100, 80, 60, 40, 20],

    /* bonus for fast solves, based on active play time */
    speedBonus: [
      { maxMs: 20000, pts: 20 },
      { maxMs: 40000, pts: 15 },
      { maxMs: 60000, pts: 10 },
      { maxMs: 120000, pts: 5 }
    ],

    /* +10% per win already in a row, capped at x2.0 */
    streakStep: 0.1,
    streakCap: 10,

    /* XP (drives ranks) */
    difficultyXp: { Easy: 0, Medium: 10, Hard: 25, Expert: 50 },
    dailyBonusXp: 25,
    newFeatureXp: 15,
    lossXp: 5,
    dailyStreakXp: 5,
    dailyStreakXpCap: 50,

    ranks: [
      { id: 'newcomer', name: 'Curious Newcomer', xp: 0, color: 'blue' },
      { id: 'explorer', name: 'Prompt Explorer', xp: 150, color: 'green' },
      { id: 'finder', name: 'Feature Finder', xp: 400, color: 'yellow' },
      { id: 'wizard', name: 'Workflow Wizard', xp: 800, color: 'orange' },
      { id: 'ace', name: 'Adoption Ace', xp: 1400, color: 'pink' },
      { id: 'champion', name: 'Copilot Champion', xp: 2200, color: 'purple' },
      { id: 'legend', name: 'Copilot Legend', xp: 3600, color: 'red' }
    ],

    /* difficulty unlocks for Free Play (the Daily Challenge is never gated) */
    unlocks: {
      Medium: { need: 3, from: 'Easy' },
      Hard: { need: 5, from: 'Medium' },
      Expert: { need: 5, from: 'Hard' }
    },
    difficulties: ['Easy', 'Medium', 'Hard', 'Expert'],

    /* Daily Challenge #1 is this date. Sunday..Saturday difficulty plan = a gentle ramp through the week. */
    dailyEpoch: '2026-10-23',
    weekdayPlan: ['Expert', 'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Hard'],

    speedRoundSeconds: 180,

    /* Optional event leaderboard (see README). Leave endpoint empty for a device-only leaderboard. */
    leaderboard: { endpoint: '', eventCode: '' },

    /* Optional: public URL to put on share cards. Empty = use the current page address. */
    shareUrl: ''
  };
})();
