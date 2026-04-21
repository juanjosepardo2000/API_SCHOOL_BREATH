const Gamification = require('../models/gamification.model');
const SessionEvent  = require('../models/sessionEvent.model');
const {
  getConfig,
  computeLevel,
  computeLeague,
  computeStreak,
  computeDailyReset,
  computeWeeklyReset,
  computeTechniqueProgress,
  computeFreezeEligibility,
  updateDailyStats,
  toLocalDateString,
  getCurrentMondayString,
  getLocalHour,
} = require('../services/gamification.service');

// ─── POST /gamification/sync ──────────────────────────────────────────────────
/**
 * Legacy endpoint: accepts the full gamification state from the frontend.
 * The frontend still owns XP calculation here (Phase 1 compatibility).
 *
 * Phase 2 will introduce POST /gamification/session (server-authoritative XP).
 * This endpoint will remain for backward compat but will stop being the
 * source of truth once Phase 2 is live.
 */
exports.sync = async (req, res) => {
  try {
    const userId      = req.user._id;
    const email       = req.user.email;
    const displayName = req.user.fullName || email;

    const {
      totalCalmPoints        = 0,
      currentStreak          = 0,
      longestStreak          = 0,
      totalSessionsCompleted = 0,
      dailyBreathingCompleted = 0,
      breathTrainingCompleted = 0,
      badges                 = [],
      weeklyXPDelta          = 0,
      timezone               = 'UTC',
    } = req.body;

    // Level/league now come from config — no hardcoded tables
    const config              = await getConfig();
    const { level, levelName } = computeLevel(totalCalmPoints, config.levels, config.masteryXPPerStar);
    const league               = computeLeague(level, config.leagues);
    const currentMonday        = getCurrentMondayString(timezone);

    let record = await Gamification.findOne({ userId });
    if (!record) {
      record = new Gamification({ userId, email, displayName });
    }

    // Service handles the weekly reset logic
    const { weeklyXP } = computeWeeklyReset(record, currentMonday);

    record.email       = email;
    record.displayName = displayName;

    // Keep both XP fields in sync during the legacy period
    record.totalCalmPoints = totalCalmPoints;
    record.totalXP         = totalCalmPoints;

    record.weeklyXP          = weeklyXP + weeklyXPDelta;
    record.weeklyXPResetDate = currentMonday;

    record.level     = level;
    record.levelName = levelName;
    record.league    = league;

    record.currentStreak           = currentStreak;
    record.longestStreak           = longestStreak;
    record.totalSessionsCompleted  = totalSessionsCompleted;
    record.dailyBreathingCompleted = dailyBreathingCompleted;
    record.morningRitualCompleted  = dailyBreathingCompleted; // mirror
    record.breathTrainingCompleted = breathTrainingCompleted;
    record.badges                  = badges;

    await record.save();

    return res.status(200).json({
      success: true,
      message: 'Progress saved',
      data: {
        totalXP:       record.totalXP,
        weeklyXP:      record.weeklyXP,
        currentStreak: record.currentStreak,
        longestStreak: record.longestStreak,
        level:         record.level,
        levelName:     record.levelName,
        league:        record.league,
        badges:        record.badges,
      },
    });

  } catch (error) {
    console.error('[Gamification] sync error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error saving progress',
      error: error.message,
    });
  }
};

// ─── GET /gamification/profile ────────────────────────────────────────────────
/**
 * Returns the full gamification profile for the authenticated user, plus the
 * active config (levels, leagues, xpRules) so the frontend can render progress
 * bars and rule tooltips without additional round-trips.
 *
 * For brand-new users (no record yet), returns a zeroed-out blank profile
 * without creating a document — the first sync/session call does that.
 *
 * Query params:
 *   timezone  IANA timezone string, e.g. "America/Guayaquil" (default: "UTC")
 *             Required for accurate weekly XP reset check.
 */
exports.getProfile = async (req, res) => {
  try {
    const userId      = req.user._id;
    const email       = req.user.email;
    const displayName = req.user.fullName || email;
    const timezone    = req.query.timezone || 'UTC';

    const [profile, config] = await Promise.all([
      Gamification.findOne({ userId }).lean(),
      getConfig(),
    ]);

    const currentMonday = getCurrentMondayString(timezone);

    // ── New user: blank profile, no DB write ─────────────────────────────────
    if (!profile) {
      const levelData = computeLevel(0, config.levels, config.masteryXPPerStar);
      const league    = computeLeague(levelData.level, config.leagues);

      return res.status(200).json({
        success: true,
        data: {
          profile: {
            userId,
            email,
            displayName,
            totalXP:        0,
            weeklyXP:       0,
            ...levelData,
            league,
            currentStreak:  0,
            longestStreak:  0,
            lastSessionDate: null,
            freezesRemainingThisWeek: config.streakFreezesPerWeek ?? 1,
            totalSessionsCompleted:  0,
            morningRitualCompleted:  0,
            breathTrainingCompleted: 0,
            techniqueProgress: {},
            dailyStats: [],
            badges:     [],
          },
          config: _safeConfig(config),
        },
      });
    }

    // ── Existing user ─────────────────────────────────────────────────────────
    // Prefer totalXP (new field); fall back to totalCalmPoints for legacy records
    const totalXP = profile.totalXP > 0
      ? profile.totalXP
      : (profile.totalCalmPoints ?? 0);

    const levelData = computeLevel(totalXP, config.levels, config.masteryXPPerStar);
    const league    = computeLeague(levelData.level, config.leagues);

    // Apply weekly reset in-memory for response accuracy (does NOT write to DB)
    const { weeklyXP } = computeWeeklyReset(profile, currentMonday);

    // Mongoose Map → plain object for JSON serialization.
    // .lean() returns a plain object; Map.prototype.entries() only exists on real Maps.
    const techniqueProgress = profile.techniqueProgress instanceof Map
      ? Object.fromEntries(profile.techniqueProgress)
      : (profile.techniqueProgress ?? {});

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          userId:      profile.userId,
          email:       profile.email,
          displayName: profile.displayName,

          totalXP,
          weeklyXP,

          ...levelData,
          league,

          currentStreak:   profile.currentStreak,
          longestStreak:   profile.longestStreak,
          lastSessionDate: profile.lastSessionDate,

          freezesRemainingThisWeek:
            profile.freezesRemainingThisWeek ?? config.streakFreezesPerWeek ?? 1,

          totalSessionsCompleted:  profile.totalSessionsCompleted,
          morningRitualCompleted:
            profile.morningRitualCompleted || profile.dailyBreathingCompleted || 0,
          breathTrainingCompleted: profile.breathTrainingCompleted,

          techniqueProgress,
          dailyStats: profile.dailyStats ?? [],
          badges:     profile.badges     ?? [],
        },
        config: _safeConfig(config),
      },
    });

  } catch (error) {
    console.error('[Gamification] getProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error loading gamification profile',
      error: error.message,
    });
  }
};

// ─── GET /gamification/leaderboard ───────────────────────────────────────────
/**
 * Returns a ranked top-20 list plus the authenticated user's own position.
 *
 * Query params:
 *   type  "weekly" (default) | "alltime" | "streak"
 *         weekly  → top weeklyXP within the user's current league
 *         alltime → top totalXP  globally (all leagues)
 *         streak  → top currentStreak globally (all leagues)
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const type   = req.query.type || 'weekly';

    if (!['weekly', 'alltime', 'streak'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Use: weekly | alltime | streak',
      });
    }

    const [currentUser, config] = await Promise.all([
      Gamification.findOne({ userId }).lean(),
      getConfig(),
    ]);
    const userLeague  = currentUser?.league || 'bronze';

    // Config per leaderboard type
    const TYPE_CONFIG = {
      weekly: {
        filter:    { league: userLeague },
        sort:      { weeklyXP: -1 },
        scoreField: 'weeklyXP',
      },
      alltime: {
        filter:    {},
        sort:      { totalXP: -1 },
        scoreField: 'totalXP',
      },
      streak: {
        filter:    {},
        sort:      { currentStreak: -1 },
        scoreField: 'currentStreak',
      },
    };

    const { filter, sort, scoreField } = TYPE_CONFIG[type];
    const userScore = currentUser?.[scoreField] || 0;

    const normalizeLevelFields = (entry) => {
      const totalXP = (entry.totalXP ?? 0) > 0
        ? entry.totalXP
        : (entry.totalCalmPoints ?? 0);

      const levelData = computeLevel(totalXP, config.levels, config.masteryXPPerStar);
      const league = computeLeague(levelData.level, config.leagues);

      return {
        ...entry,
        level: levelData.level,
        levelName: levelData.levelName,
        league,
      };
    };

    const [top20, userPosition] = await Promise.all([
      Gamification
        .find(filter)
        .sort(sort)
        .limit(20)
        .select('displayName email weeklyXP totalXP currentStreak level levelName league')
        .lean(),
      Gamification.countDocuments({
        ...filter,
        [scoreField]: { $gt: userScore },
      }),
    ]);

    const normalizedTop20 = top20.map(normalizeLevelFields);
    const normalizedUserStats = currentUser ? normalizeLevelFields(currentUser) : null;

    return res.status(200).json({
      success: true,
      data: {
        type,
        league:       type === 'weekly' ? userLeague : null,
        leaderboard:  normalizedTop20,
        userPosition: userPosition + 1,
        userScore,
        userStats:    normalizedUserStats,
      },
    });

  } catch (error) {
    console.error('[Gamification] leaderboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error loading leaderboard',
      error: error.message,
    });
  }
};

// ─── POST /gamification/session ───────────────────────────────────────────────
/**
 * Server-authoritative session endpoint (Phase 2).
 *
 * The client sends raw session data; the server calculates XP, updates the
 * gamification profile, and returns the result. Idempotency is guaranteed by
 * clientSessionId (UUID v4) — safe to retry on network failure.
 *
 * Body:
 *   clientSessionId  string  Required. UUID v4 generated by the client before sending.
 *   sessionType      string  Required. 'morning_ritual' | 'breath_training' | 'breathing_session'
 *   durationSeconds  number  Required. Actual duration of the session.
 *   completionRatio  number  Optional (0-1). How much of the session was completed. Default 1.
 *   techniqueId      string  Optional. Required for breath_training (e.g. "4-7-8").
 *   timezone         string  Optional. IANA timezone. Default "UTC".
 */
exports.postSession = async (req, res) => {
  try {
    const {
      clientSessionId,
      sessionType,
      durationSeconds,
      completionRatio  = 1,
      techniqueId      = null,
      timezone         = 'UTC',
      freezeLevel           = false, // true when the user is practicing at a frozen technique level
      clientTechniqueLevel  = null,  // client-side level (sent when backend hasn't tracked this technique)
    } = req.body;

    // ── Validate required inputs ───────────────────────────────────────────
    if (!clientSessionId || !sessionType || durationSeconds == null) {
      return res.status(400).json({
        success: false,
        message: 'clientSessionId, sessionType, and durationSeconds are required',
      });
    }

    // ── Idempotency check ──────────────────────────────────────────────────
    const existingEvent = await SessionEvent.findOne({ clientSessionId }).lean();
    if (existingEvent) {
      return res.status(200).json({
        success:    true,
        idempotent: true,
        data:       existingEvent.responseSnapshot,
      });
    }

    // ── Load config & validate session type ───────────────────────────────
    const config    = await getConfig();
    const typeRules = config.xpRules.sessionTypes[sessionType];
    if (!typeRules) {
      return res.status(400).json({
        success: false,
        message: `Unknown sessionType: "${sessionType}". Valid: ${Object.keys(config.xpRules.sessionTypes).join(', ')}`,
      });
    }

    // ── Load or create gamification profile ───────────────────────────────
    const userId      = req.user._id;
    const email       = req.user.email;
    const displayName = req.user.fullName || email;

    let profile = await Gamification.findOne({ userId });
    if (!profile) {
      profile = new Gamification({ userId, email, displayName });
    }

    // ── Date/time helpers ─────────────────────────────────────────────────
    const now          = new Date();
    const localDate    = toLocalDateString(timezone, now);
    const localHour    = getLocalHour(timezone, now);
    const currentMonday = getCurrentMondayString(timezone);

    // ── Check if session qualifies for XP ─────────────────────────────────
    const meetsMinDuration   = durationSeconds >= config.xpRules.minDurationSeconds;
    const meetsCompletionRatio = !typeRules.minCompletionRatio
      || completionRatio >= typeRules.minCompletionRatio;

    // morning_ritual: must reach at least the first duration tier (9 min / 540 s)
    let meetsRitualTier = true;
    if (sessionType === 'morning_ritual') {
      const tiers = config.xpRules.morningRitualTiers ?? [];
      meetsRitualTier = tiers.some(t => durationSeconds >= t.minSeconds);
    }

    const qualifiesForXP = meetsMinDuration && meetsCompletionRatio && meetsRitualTier;

    // ── Compute resets ────────────────────────────────────────────────────
    const { dailyXPEarned, dailySessionsCounted, wasReset: dailyWasReset }
      = computeDailyReset(profile, localDate);
    const { weeklyXP, wasReset: weeklyWasReset }
      = computeWeeklyReset(profile, currentMonday);

    // ── Compute streak ────────────────────────────────────────────────────
    const streakBefore = profile.currentStreak ?? 0;
    const streakResult = computeStreak(profile, localDate);

    // ── Technique level snapshot (needed for level-based base XP) ────────
    // Prefer clientTechniqueLevel when provided — adaptive techniques (CALM, REST, FOCUS…)
    // track level client-side and may not have a backend record yet.
    const currentTechniqueLevel = (techniqueId && sessionType === 'breath_training')
      ? (clientTechniqueLevel ?? profile.techniqueProgress?.get?.(techniqueId)?.currentLevel ?? 1)
      : 1;

    // ── Calculate XP ──────────────────────────────────────────────────────
    let xpAwarded      = 0;
    let bonusBreakdown = {};

    if (qualifiesForXP) {
      const configuredMaxSessions = config.xpRules.maxSessionsPerDay;
      const configuredDailyCap    = config.xpRules.dailyCap;
      const maxSessionsPerDay = configuredMaxSessions == null ? Infinity : configuredMaxSessions;
      const dailyCap          = configuredDailyCap == null ? Infinity : configuredDailyCap;

      const withinSessionCap = dailySessionsCounted < maxSessionsPerDay;
      const dailyXPRemaining = dailyCap - dailyXPEarned;

      if (withinSessionCap && dailyXPRemaining > 0) {
        const bonuses = config.xpRules.bonuses;

        // ── Base XP (varies by session type) ──────────────────────────────

        if (sessionType === 'morning_ritual') {
          // Highest matching duration tier wins
          const tiers = [...(config.xpRules.morningRitualTiers ?? [])]
            .sort((a, b) => b.minSeconds - a.minSeconds);
          const matchedTier = tiers.find(t => durationSeconds >= t.minSeconds);
          bonusBreakdown.base = matchedTier?.xp ?? 0;

        } else if (sessionType === 'breath_training') {
          // Flat 5 XP per level/threshold completion, regardless of current level
          bonusBreakdown.base = 5;

          // Freeze level bonus: +3 when practicing at a frozen level
          if (freezeLevel && bonuses.freezeLevelBonus) {
            bonusBreakdown.freezeLevel = bonuses.freezeLevelBonus;
          }

        } else {
          // intention, gratitude, breathing_session — use flat base from config
          bonusBreakdown.base = typeRules.base;
        }

        // ── Streak bonuses ─────────────────────────────────────────────────

        // Return after lapse: user had a streak, broke it, and is coming back
        if (streakResult.streakReset && streakBefore > 0 && bonuses.returnAfterLapse) {
          bonusBreakdown.returnAfterLapse = bonuses.returnAfterLapse;
        }

        // Streak milestones (one-time award on the day the milestone is reached)
        if (streakResult.newStreak === 7 && bonuses.streakMilestone7) {
          bonusBreakdown.streakMilestone = bonuses.streakMilestone7;
        } else if (streakResult.newStreak === 30 && bonuses.streakMilestone30) {
          bonusBreakdown.streakMilestone = bonuses.streakMilestone30;
        }

        const rawXP = Object.values(bonusBreakdown).reduce((a, b) => a + b, 0);
        xpAwarded   = Math.min(rawXP, dailyXPRemaining);
      }
    }

    // ── Technique progress ────────────────────────────────────────────────
    let techniqueResult = null;
    if (techniqueId && sessionType === 'breath_training') {
      const existingEntry = profile.techniqueProgress?.get?.(techniqueId) ?? null;
      techniqueResult     = computeTechniqueProgress(
        existingEntry,
        localDate,
        config.techniqueMaxLevel,
      );
      profile.techniqueProgress.set(techniqueId, techniqueResult.updatedEntry);
    }

    // ── Update level / league ─────────────────────────────────────────────
    const levelBefore  = profile.level ?? 1;
    const newTotalXP   = (profile.totalXP ?? 0) + xpAwarded;
    const levelData    = computeLevel(newTotalXP, config.levels, config.masteryXPPerStar);
    const league       = computeLeague(levelData.level, config.leagues);

    // ── Persist gamification profile ──────────────────────────────────────
    profile.email       = email;
    profile.displayName = displayName;

    profile.totalXP        = newTotalXP;
    profile.totalCalmPoints = newTotalXP; // backward compat

    profile.weeklyXP          = (weeklyWasReset ? 0 : weeklyXP) + xpAwarded;
    profile.weeklyXPResetDate = currentMonday;

    profile.level     = levelData.level;
    profile.levelName = levelData.levelName;
    profile.league    = league;

    // Streak
    if (!streakResult.alreadyPracticedToday) {
      profile.currentStreak  = streakResult.newStreak;
      profile.longestStreak  = streakResult.newLongestStreak;
      profile.lastSessionDate = localDate;
    }

    // Daily counters
    profile.dailyXPDate          = localDate;
    profile.dailyXPEarned        = (dailyWasReset ? 0 : dailyXPEarned) + xpAwarded;
    profile.dailySessionsCounted = (dailyWasReset ? 0 : dailySessionsCounted) + 1;

    // Session type counters
    profile.totalSessionsCompleted = (profile.totalSessionsCompleted ?? 0) + 1;
    if (sessionType === 'morning_ritual') {
      profile.morningRitualCompleted  = (profile.morningRitualCompleted  ?? 0) + 1;
      profile.dailyBreathingCompleted = (profile.dailyBreathingCompleted ?? 0) + 1; // legacy
      profile.morningRitualLastDate   = localDate;
    } else if (sessionType === 'breath_training') {
      profile.breathTrainingCompleted = (profile.breathTrainingCompleted ?? 0) + 1;
    }

    // Daily stats history
    // Convert Mongoose subdocuments to plain objects before passing to pure service function
    const existingDailyStats = (profile.dailyStats ?? []).map(s =>
      typeof s.toObject === 'function' ? s.toObject() : { ...s }
    );
    profile.dailyStats = updateDailyStats(
      existingDailyStats,
      localDate,
      xpAwarded,
      sessionType,
      config.dailyStatsRetentionDays ?? 45,
    );

    await profile.save();

    // ── Build response snapshot ───────────────────────────────────────────
    const responseSnapshot = {
      xpAwarded,
      bonusBreakdown,
      qualifiesForXP,

      totalXP:  newTotalXP,
      weeklyXP: profile.weeklyXP,

      ...levelData,
      league,
      leveledUp: levelData.level > levelBefore,

      streakBefore,
      currentStreak:         profile.currentStreak,
      longestStreak:         profile.longestStreak,
      streakContinued:       streakResult.streakContinued,
      streakReset:           streakResult.streakReset,
      alreadyPracticedToday: streakResult.alreadyPracticedToday,

      ...(techniqueResult && {
        techniqueId,
        techniqueLeveledUp: techniqueResult.leveledUp,
        techniqueLevel:     techniqueResult.newLevel,
      }),
    };

    // ── Persist session event (audit + idempotency store) ─────────────────
    await SessionEvent.create({
      clientSessionId,
      userId,
      sessionType,
      techniqueId,
      durationSeconds,
      completionRatio,
      timezone,
      localDate,
      xpAwarded,
      bonusBreakdown,
      streakBefore,
      streakAfter:  profile.currentStreak,
      levelBefore,
      levelAfter:   levelData.level,
      responseSnapshot,
    });

    return res.status(201).json({
      success: true,
      data:    responseSnapshot,
    });

  } catch (error) {
    console.error('[Gamification] postSession error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing session',
      error:   error.message,
    });
  }
};

// ─── POST /gamification/freeze ────────────────────────────────────────────────
/**
 * Applies one streak freeze to bridge a single missed day.
 *
 * Conditions (all must be true):
 *   - User has freezesRemainingThisWeek > 0 (resets every Monday)
 *   - User has an active streak (currentStreak >= 1)
 *   - User missed exactly one calendar day (lastSessionDate is 2 days ago)
 *
 * Effect:
 *   Sets lastSessionDate to yesterday so the next real session sees
 *   a consecutive day and increments the streak normally.
 *
 * Body: { timezone? }  (IANA timezone, default "UTC")
 */
exports.postFreeze = async (req, res) => {
  try {
    const userId   = req.user._id;
    const timezone = req.body?.timezone || 'UTC';

    const [profile, config] = await Promise.all([
      Gamification.findOne({ userId }),
      getConfig(),
    ]);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'No gamification profile found. Complete a session first.',
      });
    }

    const localDate     = toLocalDateString(timezone);
    const currentMonday = getCurrentMondayString(timezone);

    const freezeResult = computeFreezeEligibility(
      profile,
      localDate,
      currentMonday,
      config.streakFreezesPerWeek ?? 1,
    );

    if (!freezeResult.eligible) {
      return res.status(422).json({
        success: false,
        message: freezeResult.reason,
        data: {
          freezesRemainingThisWeek: freezeResult.freezesRemaining,
          currentStreak:            profile.currentStreak,
          lastSessionDate:          profile.lastSessionDate,
        },
      });
    }

    // Apply freeze
    profile.lastSessionDate          = freezeResult.bridgeDate;
    profile.freezesRemainingThisWeek = freezeResult.freezesRemaining;
    profile.lastFreezeGrantedWeek    = freezeResult.lastFreezeGrantedWeek;

    await profile.save();

    return res.status(200).json({
      success: true,
      message: freezeResult.reason,
      data: {
        freezesRemainingThisWeek: profile.freezesRemainingThisWeek,
        currentStreak:            profile.currentStreak,
        lastSessionDate:          profile.lastSessionDate,
        bridgedDate:              freezeResult.bridgeDate,
      },
    });

  } catch (error) {
    console.error('[Gamification] postFreeze error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error applying streak freeze',
      error: error.message,
    });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips internal config fields before sending to the frontend. */
function _safeConfig(config) {
  return {
    levels:            config.levels,
    leagues:           config.leagues,
    xpRules:           config.xpRules,
    techniqueMaxLevel: config.techniqueMaxLevel,
  };
}
