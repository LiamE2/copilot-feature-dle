/* Copilot Feature-dle · configuration
   Everything a facilitator might want to tweak lives here (no build step needed). */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  FD.config = {
    version: '1.5.1',
    appName: 'Copilot Feature-dle',

    /* one guess per hint: hint 1 is free, every miss unlocks the next one */
    maxAttempts: 5,
    points: [100, 80, 60, 40, 20],

    /* The Speed Bonus: extra points for a fast answer, in the Daily Challenge only (whichever game mode the day is). It is worth up to 30, which makes a real difference but
       is still less than a first-hint answer (100) or a first-pick answer (50), and it drops in steps of 5. The Daily Challenge clock runs in real time, so it keeps ticking
       if you leave the game. */
    speedBonus: [
      { maxMs: 15000, pts: 30 },
      { maxMs: 30000, pts: 25 },
      { maxMs: 45000, pts: 20 },
      { maxMs: 60000, pts: 15 },
      { maxMs: 90000, pts: 10 },
      { maxMs: 120000, pts: 5 }
    ],

    /* XP (drives ranks). Points are never multiplied, so scores stay fair for everyone. */
    difficultyXp: { Easy: 0, Medium: 10, Hard: 25, Expert: 50 },
    dailyBonusXp: 25,
    newFeatureXp: 15,
    lossXp: 5,
    /* a live Daily Challenge streak adds bonus XP to every correct answer: +1% per streak day, up to +50% */
    streakXpPerDay: 0.01,
    streakXpMax: 0.5,
    /* the flame on the Stats page gets hotter with the Daily streak: warm from day 1, hot from this many days, blazing from this many */
    streakHeat: { hot: 7, blazing: 14 },

    /* the road to Copilot Champion (Champion is the top rank) */
    ranks: [
      { id: 'newcomer', name: 'Curious Newcomer', xp: 0, color: 'blue' },
      { id: 'explorer', name: 'Prompt Explorer', xp: 350, color: 'green' },
      { id: 'finder', name: 'Feature Finder', xp: 900, color: 'yellow' },
      { id: 'wizard', name: 'Workflow Wizard', xp: 1800, color: 'orange' },
      { id: 'whisperer', name: 'Agent Whisperer', xp: 3100, color: 'pink' },
      { id: 'ace', name: 'Adoption Ace', xp: 5000, color: 'purple' },
      { id: 'coach', name: 'Copilot Coach', xp: 8000, color: 'navy' },
      { id: 'champion', name: 'Copilot Champion', xp: 12000, color: 'red' }
    ],

    /* every difficulty is open from the start, in every game mode */
    /* what each difficulty means: the About page and the "Same difficulty" explainer in the guess list both read from here */
    difficulties: ['Easy', 'Medium', 'Hard', 'Expert'],
    levelInfo: {
      Easy: 'Common features most people have met',
      Medium: 'Newer features worth knowing',
      Hard: 'Niche or recently released functionality',
      Expert: 'Features known mostly by consultants and champions'
    },

    /* Daily Challenge: weekdays only. The difficulty of each weekday is random, but every block of 20 weekdays
       holds exactly this mix, so Easy, Medium, Hard and Expert stay balanced over time. */
    dailyEpoch: '2026-10-23',
    dailyMix: { Easy: 5, Medium: 5, Hard: 5, Expert: 5 },
    /* ...and its game mode. From dailyKindsFrom, every group of three weekdays holds one Feature Hunt, one Scenario Match and one Prompt Lab day, in a random order
       (so the mix stays balanced and the same mode never comes up three times running). Earlier days were all Feature Hunt, as they always were. */
    dailyKinds: ['hunt', 'match', 'prompt'],
    dailyKindsFrom: '2026-11-17',
    /* Challenge numbers count weekdays only, so a Saturday or Sunday never moves the number (Friday #29, then Monday #30).
       This anchor keeps the count in step with the numbers players have already seen: Monday 16 November 2026 is #23. */
    dailyNumber: { date: '2026-11-16', number: 23 },

    /* Feature Hunt and Free Play are played in rounds, like Scenario Match and Prompt Lab: how many (the player chooses on the setup screen, and it remembers the choice).
       A game of one round is a single puzzle. Free Play deals a puzzle from any of the game modes you tick, Feature Hunt deals Feature Hunt puzzles only. */
    featureHunt: { rounds: { min: 1, max: 10, defaultRounds: 5 } },
    freePlay: { rounds: { min: 1, max: 10, defaultRounds: 5 } },
    /* a game of this many rounds or more counts towards the round badges (Round Regular) */
    roundGameMin: 3,

    /* Prompt Lab and Scenario Match: how many rounds a game has (the player chooses on the setup screen), the points for finding the best of the four
       options on the 1st, 2nd and 3rd pick (maxTries picks, then the answer is shown and the puzzle goes to Needs Another Look), and a bonus for a perfect
       game (every pick right first time, with at least perfectMinRounds rounds). Every point is XP, one for one, like every other mode. The points are
       kept small because a round here is much quicker than a Feature Hunt puzzle. */
    promptLab: { rounds: { min: 1, max: 10, defaultRounds: 5 }, points: [50, 30, 10], maxTries: 3, perfectMinRounds: 3, perfectBonusPerRound: 3 },
    scenarioMatch: { rounds: { min: 1, max: 10, defaultRounds: 5 }, points: [50, 30, 10], maxTries: 3, perfectMinRounds: 3, perfectBonusPerRound: 3 },

    /* Microsoft sign-in (see the README, "Microsoft sign-in"). Everything needed is public, so it is safe to keep here.
       Leave clientId empty and the game is guest-only, exactly as before. */
    auth: {
      /* the Application (client) ID of the app you registered in Microsoft Entra ID */
      clientId: '',
      /* who may sign in: 'organizations' (work or school accounts), 'common' (those and personal Microsoft accounts),
         'consumers' (personal only), or your own tenant id / domain to let only your people in */
      tenant: 'organizations',
      /* leave empty to use https://login.microsoftonline.com/<tenant>; set it for a national cloud or a test identity provider */
      authority: '',
      /* where Microsoft sends people back to. Empty = this page's own address, and that address must be registered on the app as a "Single-page application" redirect URI */
      redirectUri: '',
      /* true = people sign in before they can play. It is a friendly gate for a team site, not security (the game runs in the browser) */
      required: false,
      /* 'short' shows "Alex R." (friendlier on a big screen); 'full' shows the whole name */
      nameStyle: 'short'
    },

    /* Optional event leaderboard (see README). Leave endpoint empty for a device-only leaderboard. */
    leaderboard: { endpoint: '', eventCode: '' }
  };
})();
