/**
 * gamification.service.js
 *
 * Pure business-logic functions for the gamification system.
 * No Express, no req/res — fully unit-testable in isolation.
 *
 * All rules come from the GamificationConfig document; nothing is hardcoded here.
 */

const GamificationConfig = require('../models/gamificationConfig.model');

// ─── Config cache ─────────────────────────────────────────────────────────────

let _cache    = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — safe for serverless warm instances

/**
 * Returns the active GamificationConfig, using an in-process cache.
 *
 * Why cache? Config rarely changes; re-querying on every session would add
 * unnecessary latency on serverless cold-warm cycles.
 *
 * @returns {Promise<Object>} lean config document
 * @throws  if no active config exists in the DB (run the seed first)
 */
async function getConfig() {
  const now = Date.now();
  if (_cache && now - _cachedAt < CACHE_TTL_MS) return _cache;

  const config = await GamificationConfig.findOne({ isActive: true }).lean();
  if (!config) {
    throw new Error(
      '[GamificationService] No active gamification config found. ' +
      'Run: node src/seeds/gamificationConfig.seed.js'
    );
  }

  _cache    = config;
  _cachedAt = now;
  return config;
}

/** Clears the in-memory cache (useful in tests or after an admin config update). */
function invalidateConfigCache() {
  _cache    = null;
  _cachedAt = 0;
}

// ─── Level & League ───────────────────────────────────────────────────────────

/**
 * Determines the user's current level, name, and progress toward the next level.
 * Pure — no DB calls.
 *
 * @param {number} totalXP
 * @param {Array<{level, name, minXP}>} levels - from config
 * @returns {{
 *   level: number,
 *   levelName: string,
 *   nextMinXP: number|null,
 *   xpToNextLevel: number,
 *   progressPercent: number   // 0-100
 * }}
 */
function computeLevel(totalXP, levels, masteryXPPerStar = 2500) {
  const asc  = [...levels].sort((a, b) => a.minXP - b.minXP);
  const desc = [...asc].reverse();

  const current = desc.find(l => totalXP >= l.minXP) ?? asc[0];
  const idx     = asc.findIndex(l => l.level === current.level);
  const next    = asc[idx + 1] ?? null;

  let progressPercent, xpToNextLevel, nextMinXP, masteryStars = 0;

  if (!next) {
    // Crown / max stage — mastery stars replace levels
    const extraXP       = Math.max(0, totalXP - current.minXP);
    masteryStars        = Math.floor(extraXP / masteryXPPerStar);
    const xpIntoStar    = extraXP % masteryXPPerStar;
    progressPercent     = Math.min(100, Math.round((xpIntoStar / masteryXPPerStar) * 100));
    xpToNextLevel       = masteryXPPerStar - xpIntoStar;
    nextMinXP           = current.minXP + (masteryStars + 1) * masteryXPPerStar;
  } else {
    const levelRange    = next.minXP - current.minXP;
    const xpIntoLevel   = totalXP - current.minXP;
    progressPercent     = Math.min(100, Math.round((xpIntoLevel / levelRange) * 100));
    xpToNextLevel       = Math.max(0, next.minXP - totalXP);
    nextMinXP           = next.minXP;
  }

  return {
    level:          current.level,
    levelName:      current.name,
    masteryStars,
    nextMinXP,
    xpToNextLevel,
    progressPercent,
  };
}

/**
 * Determines the league name for a given level.
 * Pure — no DB calls.
 *
 * @param {number} level
 * @param {Array<{name, minLevel, maxLevel}>} leagues - from config
 * @returns {string}
 */
function computeLeague(level, leagues) {
  const found = leagues.find(l => level >= l.minLevel && level <= l.maxLevel);
  return found?.name ?? 'bronze';
}

// ─── Date utilities ───────────────────────────────────────────────────────────

/**
 * Converts a JS Date to a YYYY-MM-DD string in the user's local timezone.
 * Falls back to UTC if the timezone string is invalid.
 *
 * Using the user's local date (not UTC) prevents streak breaks caused by
 * sessions done just after midnight in their timezone.
 *
 * @param {string} timezone - IANA, e.g. "America/Guayaquil"
 * @param {Date}   [date]
 * @returns {string} "2026-04-15"
 */
function toLocalDateString(timezone, date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns the YYYY-MM-DD of the most recent Monday in a given timezone.
 * Used to determine when weekly XP should reset.
 *
 * @param {string} timezone
 * @returns {string} "2026-04-14"
 */
function getCurrentMondayString(timezone) {
  const localDate = toLocalDateString(timezone);
  // Use midday UTC to avoid DST-edge-case off-by-ones
  const d   = new Date(localDate + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, …
  const daysToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + daysToMonday);
  return d.toISOString().slice(0, 10);
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Computes the new streak state given the user's last session date and today.
 *
 * Rules:
 *  - No prior session → streak = 1
 *  - Same day         → streak unchanged (already practiced today)
 *  - Next consecutive day (dayDiff === 1) → streak + 1
 *  - Gap ≥ 2 days     → streak resets to 1
 *
 * Pure — does NOT write to DB.
 *
 * @param {{ currentStreak: number, longestStreak: number, lastSessionDate: string|null }} profile
 * @param {string} localDate - "YYYY-MM-DD" in the user's timezone
 * @returns {{
 *   newStreak: number,
 *   newLongestStreak: number,
 *   streakContinued: boolean,
 *   streakReset: boolean,
 *   alreadyPracticedToday: boolean
 * }}
 */
function computeStreak(profile, localDate) {
  const currentStreak   = profile.currentStreak  ?? 0;
  const longestStreak   = profile.longestStreak  ?? 0;
  const lastSessionDate = profile.lastSessionDate ?? null;

  if (!lastSessionDate) {
    return {
      newStreak: 1,
      newLongestStreak: Math.max(longestStreak, 1),
      streakContinued: false,
      streakReset: false,
      alreadyPracticedToday: false,
    };
  }

  if (lastSessionDate === localDate) {
    return {
      newStreak: currentStreak,
      newLongestStreak: longestStreak,
      streakContinued: false,
      streakReset: false,
      alreadyPracticedToday: true,
    };
  }

  // Midday avoids DST off-by-ones in day difference calculation
  const last  = new Date(lastSessionDate + 'T12:00:00Z');
  const today = new Date(localDate       + 'T12:00:00Z');
  const dayDiff = Math.round((today - last) / 86_400_000);

  if (dayDiff === 1) {
    const newStreak = currentStreak + 1;
    return {
      newStreak,
      newLongestStreak: Math.max(longestStreak, newStreak),
      streakContinued: true,
      streakReset: false,
      alreadyPracticedToday: false,
    };
  }

  // Gap ≥ 2 days — streak broken
  return {
    newStreak: 1,
    newLongestStreak: longestStreak,
    streakContinued: false,
    streakReset: true,
    alreadyPracticedToday: false,
  };
}

// ─── Daily cap ────────────────────────────────────────────────────────────────

/**
 * Returns the current daily XP/session state, resetting counters if the
 * calendar date has changed since the last session.
 *
 * Pure — does NOT write to DB.
 *
 * @param {{ dailyXPDate: string|null, dailyXPEarned: number, dailySessionsCounted: number }} profile
 * @param {string} localDate
 * @returns {{ dailyXPEarned: number, dailySessionsCounted: number, wasReset: boolean }}
 */
function computeDailyReset(profile, localDate) {
  if (profile.dailyXPDate !== localDate) {
    return { dailyXPEarned: 0, dailySessionsCounted: 0, wasReset: true };
  }
  return {
    dailyXPEarned:        profile.dailyXPEarned        ?? 0,
    dailySessionsCounted: profile.dailySessionsCounted ?? 0,
    wasReset: false,
  };
}

// ─── Weekly reset ─────────────────────────────────────────────────────────────

/**
 * Returns the current weekly XP, resetting to 0 if the Monday has changed.
 *
 * Pure — does NOT write to DB.
 *
 * @param {{ weeklyXP: number, weeklyXPResetDate: string|null }} profile
 * @param {string} currentMonday - "YYYY-MM-DD"
 * @returns {{ weeklyXP: number, wasReset: boolean }}
 */
function computeWeeklyReset(profile, currentMonday) {
  if (profile.weeklyXPResetDate !== currentMonday) {
    return { weeklyXP: 0, wasReset: true };
  }
  return { weeklyXP: profile.weeklyXP ?? 0, wasReset: false };
}

// ─── Daily stats ──────────────────────────────────────────────────────────────

/**
 * Merges a session result into the user's dailyStats array.
 * Caps the array at retentionDays entries, sorted newest-first.
 * Idempotent for multiple sessions on the same date.
 *
 * Pure — does NOT write to DB.
 *
 * @param {Array<{date, xpEarned, sessionsCounted, types}>} existing
 * @param {string} localDate
 * @param {number} xpEarned
 * @param {string} sessionType
 * @param {number} retentionDays
 * @returns {Array}
 */
function updateDailyStats(existing = [], localDate, xpEarned, sessionType, retentionDays = 45) {
  const stats = [...existing];
  const idx   = stats.findIndex(s => s.date === localDate);

  if (idx >= 0) {
    stats[idx] = {
      ...stats[idx],
      xpEarned:        stats[idx].xpEarned + xpEarned,
      sessionsCounted: stats[idx].sessionsCounted + (xpEarned > 0 ? 1 : 0),
      types:           [...new Set([...(stats[idx].types ?? []), sessionType])],
    };
  } else {
    stats.push({
      date:            localDate,
      xpEarned,
      sessionsCounted: xpEarned > 0 ? 1 : 0,
      types:           [sessionType],
    });
  }

  return stats
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, retentionDays);
}

// ─── Streak freeze ────────────────────────────────────────────────────────────

/**
 * Determines whether a streak freeze can be applied right now, and computes
 * the updated freeze state if it can.
 *
 * A freeze is valid when:
 *   1. The user has at least one freeze remaining this week (after weekly reset).
 *   2. The user missed exactly ONE calendar day (dayDiff === 2):
 *      - dayDiff 0 → practiced today, no freeze needed.
 *      - dayDiff 1 → practiced yesterday, streak is intact, no freeze needed.
 *      - dayDiff 2 → missed one day, freeze can bridge the gap.
 *      - dayDiff 3+ → gap too large, freeze cannot help.
 *   3. The user has an existing streak worth protecting (currentStreak >= 1).
 *
 * Effect when applied:
 *   Sets lastSessionDate to yesterday (localDate minus 1 day) so that the
 *   next real session will see dayDiff === 1 and continue the streak normally.
 *
 * Pure — does NOT write to DB.
 *
 * @param {{ currentStreak, lastSessionDate, freezesRemainingThisWeek, lastFreezeGrantedWeek }} profile
 * @param {string} localDate    - user's current local date "YYYY-MM-DD"
 * @param {string} currentMonday - "YYYY-MM-DD" of this week's Monday
 * @param {number} freezesPerWeek - from config
 * @returns {{
 *   eligible: boolean,
 *   reason: string,
 *   freezesRemaining: number,       // after applying this freeze (if eligible)
 *   bridgeDate: string|null,        // the date to set as lastSessionDate
 *   lastFreezeGrantedWeek: string,  // the current Monday (for DB write)
 * }}
 */
function computeFreezeEligibility(profile, localDate, currentMonday, freezesPerWeek) {
  // Apply weekly reset to freeze allowance
  const freezesRemaining = profile.lastFreezeGrantedWeek !== currentMonday
    ? freezesPerWeek
    : (profile.freezesRemainingThisWeek ?? 0);

  if (freezesRemaining <= 0) {
    return {
      eligible: false,
      reason: 'No streak freezes remaining this week',
      freezesRemaining: 0,
      bridgeDate: null,
      lastFreezeGrantedWeek: currentMonday,
    };
  }

  if (!profile.lastSessionDate || profile.currentStreak < 1) {
    return {
      eligible: false,
      reason: 'No active streak to protect',
      freezesRemaining,
      bridgeDate: null,
      lastFreezeGrantedWeek: currentMonday,
    };
  }

  // Compute day difference using midday-UTC to avoid DST off-by-ones
  const last  = new Date(profile.lastSessionDate + 'T12:00:00Z');
  const today = new Date(localDate               + 'T12:00:00Z');
  const dayDiff = Math.round((today - last) / 86_400_000);

  if (dayDiff <= 1) {
    return {
      eligible: false,
      reason: dayDiff === 0
        ? 'You already practiced today — no freeze needed'
        : 'Your streak is intact — no freeze needed',
      freezesRemaining,
      bridgeDate: null,
      lastFreezeGrantedWeek: currentMonday,
    };
  }

  if (dayDiff > 2) {
    return {
      eligible: false,
      reason: `Streak gap is ${dayDiff} days — a freeze can only bridge one missed day`,
      freezesRemaining,
      bridgeDate: null,
      lastFreezeGrantedWeek: currentMonday,
    };
  }

  // dayDiff === 2: exactly one missed day — freeze applies
  // Bridge date = yesterday in the user's local calendar
  const yesterday = new Date(localDate + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const bridgeDate = yesterday.toISOString().slice(0, 10);

  return {
    eligible: true,
    reason: 'Freeze applied — streak preserved',
    freezesRemaining: freezesRemaining - 1,
    bridgeDate,
    lastFreezeGrantedWeek: currentMonday,
  };
}

// ─── Local hour ───────────────────────────────────────────────────────────────

/**
 * Returns the current hour (0-23) in the user's local timezone.
 * Used for optimal-time XP bonuses (morning 6-9, evening 19-22).
 *
 * @param {string} timezone - IANA, e.g. "America/Guayaquil"
 * @param {Date}   [date]
 * @returns {number} 0-23
 */
function getLocalHour(timezone, date = new Date()) {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour:     'numeric',
      hour12:   false,
    }).format(date);
    const h = parseInt(formatted, 10);
    return isNaN(h) ? date.getUTCHours() : h;
  } catch {
    return date.getUTCHours();
  }
}

// ─── Technique progress ───────────────────────────────────────────────────────

/**
 * Computes the updated progress entry for a single breathing technique.
 *
 * Level-up formula: level = floor(sessionsCompleted / 5) + 1, capped at techniqueMaxLevel.
 * i.e. every 5 sessions the technique advances one level.
 *
 * Pure — does NOT write to DB.
 *
 * @param {Object|null} existing - current Map entry for this techniqueId (or null if new)
 * @param {string}      localDate
 * @param {number}      techniqueMaxLevel - from config
 * @returns {{
 *   updatedEntry: { currentLevel, cyclesCompleted, sessionsCompleted, lastPracticeDate },
 *   leveledUp: boolean,
 *   newLevel: number
 * }}
 */
function computeTechniqueProgress(existing, localDate, techniqueMaxLevel) {
  const current = existing ?? {
    currentLevel:      1,
    cyclesCompleted:   0,
    sessionsCompleted: 0,
    lastPracticeDate:  null,
  };

  const newSessionsCompleted = current.sessionsCompleted + 1;
  const newLevel = Math.min(
    Math.floor(newSessionsCompleted / 5) + 1,
    techniqueMaxLevel,
  );
  const leveledUp = newLevel > current.currentLevel;

  return {
    updatedEntry: {
      currentLevel:      newLevel,
      cyclesCompleted:   current.cyclesCompleted,
      sessionsCompleted: newSessionsCompleted,
      lastPracticeDate:  localDate,
    },
    leveledUp,
    newLevel,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Config
  getConfig,
  invalidateConfigCache,
  // Level & League
  computeLevel,
  computeLeague,
  // Dates
  toLocalDateString,
  getCurrentMondayString,
  getLocalHour,
  // Streak
  computeStreak,
  // Resets
  computeDailyReset,
  computeWeeklyReset,
  // Stats
  updateDailyStats,
  // Technique
  computeTechniqueProgress,
  // Freeze
  computeFreezeEligibility,
};
