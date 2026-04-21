# School of Breath — Project Context
> Last updated: 2026-04-18

---

## 1. Project Overview

**School of Breath** is a wellness platform focused on breathing techniques, morning rituals, meditation, and mindfulness. Available as a **web app** and **mobile app** (Capacitor). Includes a full server-authoritative gamification engine that rewards users with XP, levels, streaks, leagues, and leaderboard rankings.

### Repositories
| Repo | Description |
|------|-------------|
| `SchoolOfBreathBackendAPIs` | Node.js / Express backend — serverless, deployed on Vercel |
| `SchoolOfBreat_webversion2026` | React / TypeScript / Vite frontend — web + Capacitor mobile |

---

## 2. Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas via Mongoose
- **Auth:** JWT (passport-jwt), Google OAuth, Apple ID
- **Payments:** Stripe webhooks, Systeme.io (CRM / membership sync)
- **Media:** Cloudinary, Google Cloud Storage, GridFS
- **AI:** OpenAI / Google Gemini / Groq (AI chat, RAG knowledge base)
- **Deployment:** Vercel (serverless functions)
- **Local dev entry:** `src/dev.js` → `npm run local` (port 3001)
- **Serverless entry:** `src/index.js` (no app.listen — used by Vercel)

### Frontend
- **Framework:** React 18 + TypeScript
- **Bundler:** Vite
- **Mobile shell:** Capacitor (iOS / Android)
- **HTTP client:** Axios — two separate instances:
  - `apiClient` (in `services/authService.ts`) — production backend, auto-injects JWT, has logout-on-401
  - `gamificationClient` (in `services/gamificationApi.ts`) — points to `VITE_GAMIFICATION_URL` or `VITE_API_URL`, no logout-on-401
- **Animation:** framer-motion v12
- **Icons:** lucide-react
- **State:** React Context (`context/AppContext.tsx`) — single global provider
- **Routing:** React Router v6
- **Storage:** Capacitor Preferences (mobile) + localStorage fallback

---

## 3. Environment Configuration

### Backend — `.env`
```
NODE_ENV=development
PORT=3001
MONGO_URI=mongodb+srv://...@cluster0.j2ulcwk.mongodb.net/test
MONGO_PRODUCTION=mongodb+srv://...@cluster0.j2ulcwk.mongodb.net/test
JWT_SECRET=5up3r53cr3tk3y
```
`vars.js` uses `MONGO_URI` for development and `MONGO_PRODUCTION` for production.

### Frontend — `.env` (local dev)
```
VITE_API_URL=http://localhost:3001
VITE_GAMIFICATION_URL=http://localhost:3001
```
Without `.env`, both clients fall back to: `https://dev-api-music-iota.vercel.app`

---

## 4. MongoDB — Database & Collections

**Database:** `test` (MongoDB Atlas, cluster0.j2ulcwk.mongodb.net)

### Gamification Collections
| Collection | Model file | Description |
|------------|-----------|-------------|
| `gamification` | `gamification.model.js` | One doc per user — XP, level, streak, technique progress Map |
| `gamification_config` | `gamificationConfig.model.js` | Single active global config doc with all XP rules (versioned) |
| `session_events` | `sessionEvent.model.js` | Log of every completed session. TTL: 90 days. Idempotency key: `clientSessionId` |

### Other Collections
| Collection | Description |
|------------|-------------|
| `users` | User accounts (email, roles, membership) |
| `courses` | Course catalog |
| `courseprogresses` | Per-user course progress |
| `mantras` | Mantra library |
| `mantracategories` | Mantra categories |
| `musics` | Music/audio library |
| `chathistories` | AI chat history |
| `guides` | Guided meditation library |
| `userBreathingProgress` | Legacy breathing progress (pre-gamification, no longer primary source) |

---

## 5. Gamification System — Full Detail

### Principles
- **Server-authoritative:** XP is calculated on the backend. Frontend never self-awards XP.
- **Config-driven:** All rules live in `gamification_config` (v1.1). No hardcoded values in logic.
- **Idempotent sessions:** Each session carries a `clientSessionId` (UUID v4). Retrying with the same ID returns the cached result (`idempotent: true`).
- **Optimistic UI:** The `+XP` burst animation fires immediately on the frontend when the action completes — without waiting for the network response. The backend call runs silently in the background to persist the XP.

---

### 5.1 Config Version — v1.1

File: `src/seeds/gamificationConfig.seed.js`
Migration: `src/seeds/updateGamificationConfig.js` (deactivates old, seeds new)

```js
xpRules: {
  dailyCap:           300,
  maxSessionsPerDay:  8,
  minDurationSeconds: 60,
  sessionTypes: {
    morning_ritual:    { base: 0,  minCompletionRatio: 0.8 },
    breath_training:   { base: 0 },   // XP comes from flat rule below
    breathing_session: { base: 15, minCompletionRatio: 0.5 },
    intention:         { base: 5 },
    gratitude:         { base: 10 },
  },
  morningRitualTiers: [
    { label: 'Quick Practice', minSeconds: 540,  xp: 30 },
    { label: 'Self Care',      minSeconds: 720,  xp: 30 },
    { label: 'Expansion',      minSeconds: 1080, xp: 40 },
    { label: 'Ascension',      minSeconds: 1440, xp: 50 },
  ],
  bonuses: {
    streakMilestone7:  40,
    streakMilestone30: 120,
    returnAfterLapse:  15,
    freezeLevelBonus:  3,
  },
}
```

---

### 5.2 XP Rules by Session Type

| Session Type | XP | Condition |
|---|---|---|
| `morning_ritual` | 30 XP (9–12 min) | Tier lookup by duration |
| `morning_ritual` | 30 XP (12–18 min) | |
| `morning_ritual` | 40 XP (18–24 min) | |
| `morning_ritual` | 50 XP (24+ min) | |
| `breath_training` | **5 XP flat** | Per level/threshold completion |
| `breath_training` | **+3 XP bonus** | When `freezeLevel: true` (practicing frozen level) |
| `breathing_session` | 15 XP | Free breathing session, ≥50% completion |
| `intention` | 5 XP | On saving daily intention |
| `gratitude` | 10 XP | On saving gratitude entry |
| Streak 7 days | +40 XP | On reaching 7-day streak |
| Streak 30 days | +120 XP | On reaching 30-day streak |
| Return after lapse | +15 XP | When streak resets but user had one before |

---

### 5.3 Levels & Leagues

**Levels** (stored in `gamification_config.levels`):

| Level | Name | Min XP |
|-------|------|--------|
| 1 | Seed | 0 |
| 2 | Sprout | 100 |
| 3 | Root | 300 |
| 4 | Branch | 600 |
| 5 | Leaf | 1000 |
| 6 | Blossom | 1500 |
| 7 | Canopy | 2200 |
| 8 | Ancient | 3200 |
| 9 | Grove | 4500 |
| 10 | Forest | 6000 |

**Leagues** (based on level):

| League | Levels |
|--------|--------|
| Bronze | 1–3 |
| Silver | 4–6 |
| Gold | 7–9 |
| Prana | 10 |

---

### 5.4 Streak Logic

- Streak increments when the user completes any session on a new calendar day (user's local timezone).
- Streak **resets** if more than 1 day is missed.
- **Streak freeze:** 1 available per week. Bridges exactly 1 missed day.
  - Backend: `POST /gamification/freeze`
  - Frontend: not yet connected to a UI button (backend ready)
- `streakMilestone7` / `streakMilestone30` bonuses fire exactly once per milestone.
- `returnAfterLapse` (+15) fires when a streak resets but the user had a streak > 0 before.

---

### 5.5 Technique Progress

Each technique has its own level tracked in `gamificationProfile.techniqueProgress` (a Map keyed by `techniqueId`).

**Two categories of techniques:**

**Adaptive techniques** (infinite levels — level up every 6 cycles):
| ID | Name |
|----|------|
| `CALM` | Diaphragmatic Breathing |
| `REST` | 4-7-8 Breathing |
| `FOCUS` | Box Breathing |
| `BALANCE` | Alternate Nostril |
| `BHRAMARI` | Humming Bee Breath |

- Level tracked locally in `patternProgress` (AppContext / localStorage).
- `levelUpPattern(patternId)` increments `patternProgress[id].level`.
- `BHRAMARI` behaves like adaptive (earns XP at threshold) but is not in `ADAPTIVE_PATTERN_IDS`.
- No max level — displayed as "Level X" (no cap shown in UI).

**Fire techniques** (max level 6 — shown as "Level X / 6"):
| ID | Name |
|----|------|
| `ENERGY` | Breath of Fire |
| `BHASTRIKA` | Bhastrika |
| `TUMMO` | Tummo Breathing |

- Level tracked via `completeFireLevel()` in BreathingSession → `levelUpPattern`.
- Use `FIRE_LADDER` config for cycles-per-level requirements.

**Two sources of truth for technique level (resolved by `Math.max`):**
1. **Local:** `patternProgress[id].level` (AppContext, persisted in localStorage) — always current.
2. **Backend:** `gamificationProfile.techniqueProgress[id].currentLevel` — only populated when `submitSession('breath_training', techniqueId)` is called.

ProgressTracking displays `Math.max(localLevel, backendLevel)` to avoid showing stale data.

**`clientTechniqueLevel` field:** Frontend sends its local level to the backend via `SessionPayload.clientTechniqueLevel`. The backend uses this preferentially when it has no history for that technique (`clientTechniqueLevel ?? backend level ?? 1`).

---

### 5.6 Freeze State

Users can freeze their current technique level to practice it repeatedly (for mastery) without leveling up.

- Freeze state stored in `patternProgress[id].isFrozen` (AppContext / localStorage).
- `togglePatternFreeze(patternId)` flips the frozen flag.
- In `BreathingSession.tsx`, `freezeState` syncs from `patternProgress` on mount via a `ref`-guarded `useEffect` (handles async loading).
- Frozen technique: displayed with ice-blue styling + Snowflake icon in ProgressTracking.
- Practicing a frozen level earns +3 XP bonus (`freezeLevel: true` sent in session payload).

---

### 5.7 XP Burst Animation — `XPBurst` Component

File: `components/gamification/XPBurst.tsx`

- **Triggered:** Immediately when an action is completed (optimistic — no network wait).
- **Design:** Floating `+X XP` in gold, radial glow, 15 gold particles exploding outward, session type label.
- **Duration:** 3 seconds.
- **Non-blocking:** `pointer-events: none`, fixed positioned at `z-index: 9500`.
- **Auto-dismisses** via `setTimeout(onDone, 3000 + 80ms)`.
- Managed by `triggerXPBurst(xp, sessionType)` in AppContext.

**Where it fires:**
- `completeCycle()` in BreathingSession → immediately on level-up or threshold completion.
- `completeFireLevel()` in BreathingSession → immediately when fire level is done.
- `addGratitudeEntry()` → after backend confirms (awaits response since it's a one-time action).
- `addIntentionEntry()` → after backend confirms (same reason).
- All other `submitSession` calls → after backend responds (unless `{ silent: true }` is passed).

---

## 6. Backend — API Endpoints

**Base URL (production):** `https://dev-api-music-iota.vercel.app`
**Base URL (local):** `http://localhost:3001`

### Gamification Routes (`/gamification`) — all require JWT auth

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/gamification/profile` | Full gamification profile + active config for auth user. Creates profile on first call. |
| `POST` | `/gamification/session` | Server-authoritative XP calculation. Idempotent via `clientSessionId`. |
| `POST` | `/gamification/sync` | Syncs displayName / email from auth profile to gamification profile. |
| `GET` | `/gamification/leaderboard` | Weekly / alltime / streak leaderboard. Query: `?type=weekly\|alltime\|streak` |
| `POST` | `/gamification/freeze` | Applies streak freeze (1 per week). |

### Session Payload (`POST /gamification/session`)
```json
{
  "clientSessionId":      "uuid-v4",
  "sessionType":          "morning_ritual | breath_training | breathing_session | intention | gratitude",
  "durationSeconds":      420,
  "completionRatio":      1.0,
  "techniqueId":          "REST",
  "freezeLevel":          false,
  "clientTechniqueLevel": 4,
  "timezone":             "America/Guayaquil"
}
```

### Session Result (`SessionResult`)
```json
{
  "xpAwarded":      5,
  "bonusBreakdown": { "base": 5 },
  "qualifiesForXP": true,
  "totalXP":        215,
  "weeklyXP":       45,
  "level":          3,
  "levelName":      "Root",
  "nextMinXP":      600,
  "xpToNextLevel":  385,
  "progressPercent": 38,
  "league":         "Bronze",
  "leveledUp":      false,
  "streakBefore":   3,
  "currentStreak":  4,
  "longestStreak":  4,
  "streakContinued": true,
  "streakReset":    false,
  "alreadyPracticedToday": false,
  "techniqueId":    "REST",
  "techniqueLeveledUp": true,
  "techniqueLevel": 5,
  "idempotent":     false
}
```

---

## 7. Backend — Key Files

| File | Description |
|------|-------------|
| `src/configs/server.js` | Express app setup. `express.json()` MUST be before route registration. |
| `src/configs/vars.js` | Env var resolution. `MONGO_URI` for dev, `MONGO_PRODUCTION` for prod. |
| `src/configs/database.js` | Mongoose connection with serverless caching (`global.__mongoose`). |
| `src/index.js` | Serverless entry point for Vercel. |
| `src/dev.js` | Local dev server with `app.listen` on port 3001. |
| `src/models/gamification.model.js` | Gamification profile schema. Collection: `gamification`. |
| `src/models/gamificationConfig.model.js` | XP rules / config schema. Collection: `gamification_config`. |
| `src/models/sessionEvent.model.js` | Session log schema. Collection: `session_events`. TTL 90 days. |
| `src/controllers/gamification.controller.js` | All gamification endpoint handlers. XP logic lives here. |
| `src/routes/gamification.routes.js` | Route definitions for gamification. |
| `src/services/gamification.service.js` | Pure functions: streak, daily reset, technique progress, freeze eligibility. |
| `src/seeds/gamificationConfig.seed.js` | Seeds the `gamification_config` document (config v1.1). |
| `src/seeds/updateGamificationConfig.js` | Migration: deactivates old config, seeds fresh v1.1. Run with `node`. |

### Critical Known Fix (server.js)
`app.use('/gamification', gamificationRoutes)` must be registered **after** `express.json()` and `express.urlencoded()`, otherwise `req.body` is always `{}`.

---

## 8. Frontend — Architecture

### State Management (`context/AppContext.tsx`)

Single React Context provider wrapping the entire app. Key gamification state:

```typescript
gamificationProfile: GamificationProfile | null   // loaded on login, null on logout
patternProgress: Record<string, PatternProgress>   // technique levels + freeze state (localStorage)

// Functions
submitSession(payload, options?)    // POST /gamification/session + update local state
triggerXPBurst(xp, sessionType)    // immediately show +XP animation
refreshGamificationProfile()        // re-fetch full profile from backend
togglePatternFreeze(patternId)      // toggle frozen flag for a technique
levelUpPattern(patternId)           // increment local technique level
```

`submitSession` also calls `addCalmPoints()` and `incrementStreak()` for backward compatibility with legacy UI components. Accepts `{ silent: true }` to skip the XP burst (used when burst was already triggered optimistically).

### Two Sources of Technique Level

| Source | Where | When updated |
|--------|-------|-------------|
| `patternProgress[id].level` | AppContext / localStorage | Immediately on `levelUpPattern()` call |
| `gamificationProfile.techniqueProgress[id].currentLevel` | Backend / memory | When backend processes a `breath_training` session |

ProgressTracking and BreathingProgressCard always use `Math.max(local, backend)`.

---

## 9. Frontend — Key Files

| File | Description |
|------|-------------|
| `services/authService.ts` | `apiClient` axios instance with auto JWT injection. Production URL fallback. |
| `services/gamificationApi.ts` | `gamificationClient` axios instance. Typed wrappers for all gamification endpoints. |
| `context/AppContext.tsx` | Global state. Gamification profile, pattern progress, XP burst, submitSession. |
| `pages/Home.tsx` | Dashboard. `BreathingProgressCard` reads directly from `gamificationProfile` in context. |
| `pages/BreathingSession.tsx` | Breathing technique player. Calls `triggerXPBurst` + `submitSession` on level-up. Syncs freeze state from `patternProgress`. |
| `pages/MorningRitual.tsx` | Morning ritual flow. Calls `submitSession('morning_ritual')` on finish. |
| `pages/ProgressTracking.tsx` | Progress tab: technique levels, streaks, XP bar. Leaderboard tab: weekly/alltime/streak. |
| `components/gamification/XPBurst.tsx` | Floating `+X XP` animation (3s, non-blocking, optimistic). |
| `components/gamification/XPRewardOverlay.tsx` | `SESSION_META` map: session type → emoji + label (used by XPBurst). |

---

## 10. Frontend — Gamification API (`services/gamificationApi.ts`)

```typescript
fetchGamificationProfile(timezone?)       // GET /gamification/profile → { profile, config }
submitGamificationSession(payload)        // POST /gamification/session → SessionResult
fetchLeaderboard(type)                    // GET /gamification/leaderboard?type=weekly|alltime|streak
```

All functions return `null` on error (silent fail — never throws, non-blocking for UX).

---

## 11. Complete Data Flow — Breathing Level-Up

```
1.  User completes 6 cycles in BreathingSession (e.g., 4-7-8 / REST)
2.  completeCycle() detects willLevelUp = true
3.  triggerXPBurst(5, 'breath_training') → +XP animation shows IMMEDIATELY
4.  submitSession(payload, { silent: true }) called async (no await in UI)
5.  levelUpPattern('REST') → local patternProgress.REST.level++
6.  Celebration toast shown in BreathingSession
7.  [~200-500ms later] Backend receives POST /gamification/session
8.  Backend uses clientTechniqueLevel (sent by frontend) for XP calculation
9.  Backend saves updated Gamification profile to MongoDB
10. Backend logs session to session_events (idempotency key = clientSessionId)
11. Backend returns SessionResult
12. AppContext updates gamificationProfile state (totalXP, level, streak, etc.)
13. ProgressTracking / Home reflect new data automatically
```

---

## 12. Complete Data Flow — Morning Ritual

```
1.  User finishes MorningRitual (tracks duration)
2.  submitSession({ sessionType: 'morning_ritual', durationSeconds }) called
3.  Backend finds matching morningRitualTier by duration (30/30/40/50 XP)
4.  Backend checks streakMilestone7 / streakMilestone30 bonuses
5.  Backend returns SessionResult with xpAwarded
6.  AppContext triggers XP burst with real xpAwarded value
```

---

## 13. Current State — What's Implemented

| Feature | Status |
|---------|--------|
| Server-authoritative XP engine | ✅ Done |
| Config-driven XP rules (v1.1) | ✅ Done |
| Morning ritual XP (duration tiers) | ✅ Done |
| Breath training XP (5 XP flat per level) | ✅ Done |
| Breathing session XP (15 XP) | ✅ Done |
| Intention XP (5 XP) | ✅ Done |
| Gratitude XP (10 XP) | ✅ Done |
| Freeze level bonus (+3 XP) | ✅ Done |
| Streak milestone bonuses (7d/30d) | ✅ Done |
| Return after lapse bonus (+15 XP) | ✅ Done |
| Idempotent sessions (clientSessionId) | ✅ Done |
| Levels (1–10) + Leagues (Bronze→Prana) | ✅ Done |
| Streak tracking with timezone | ✅ Done |
| Streak freeze (1/week) | ✅ Backend done — no UI button yet |
| Leaderboard (weekly / alltime / streak) | ✅ Done |
| XPBurst animation (optimistic, 3s) | ✅ Done |
| ProgressTracking — technique levels | ✅ Done (Math.max local+backend) |
| ProgressTracking — infinite vs capped levels | ✅ Done (fire = "X/6", adaptive = "X") |
| ProgressTracking — frozen technique card | ✅ Done (ice-blue + snowflake) |
| Home BreathingProgressCard — real data | ✅ Done (reads gamificationProfile) |
| clientTechniqueLevel (local level to backend) | ✅ Done |
| BHRAMARI XP (adaptive-style, no level cap) | ✅ Done |
| Badges display in UI | ❌ Not yet (profile returns badges array) |
| Level-up global notification (leveledUp flag) | ❌ Not yet (SessionResult has `leveledUp`) |
| Streak freeze UI button | ❌ Not yet |
| Leaderboard alltime / streak tabs in UI | ❌ Only weekly shown |

---

## 14. How to Run Locally

### Backend
```bash
cd SchoolOfBreathBackendAPIs
npm run local
# Runs on http://localhost:3001
# Connects to MongoDB Atlas (test database)
```

### Frontend
```bash
cd SchoolOfBreat_webversion2026
# Create .env:
# VITE_API_URL=http://localhost:3001
# VITE_GAMIFICATION_URL=http://localhost:3001
npm run dev
```

### Re-seed gamification config (run when XP rules change)
```bash
cd SchoolOfBreathBackendAPIs
node src/seeds/updateGamificationConfig.js
# Deactivates old config, seeds fresh v1.1
```

---

## 15. Deployment

- Backend deployed on **Vercel** (managed by senior developer).
- Auto-deploys on `git push` to the connected GitHub repository.
- Frontend connects to production backend via fallback URL in `gamificationApi.ts`: `https://dev-api-music-iota.vercel.app`
- Vercel uses `src/index.js` as the serverless entry (no `app.listen`).

---

## 16. Change Log

| Date | Change |
|------|--------|
| 2026-04-16 | Implemented full gamification system: XP engine, levels, streaks, leaderboard, freeze |
| 2026-04-16 | Created `gamification`, `gamification_config`, `session_events` MongoDB collections |
| 2026-04-16 | Connected MorningRitual.tsx and BreathingSession.tsx to backend via submitSession |
| 2026-04-16 | Connected ProgressTracking.tsx Breathing tab to real backend data |
| 2026-04-16 | Fixed server.js: express.json() must be before route registration |
| 2026-04-16 | Updated vars.js to use MONGO_URI env variable for local development |
| 2026-04-16 | Frontend dual API clients: apiClient (production) + gamificationClient (local/gamification) |
| 2026-04-18 | Config v1.1: replaced flat XP with morningRitualTiers + breath_training flat 5 XP |
| 2026-04-18 | Added intention (5 XP) and gratitude (10 XP) session types |
| 2026-04-18 | Added streak milestone bonuses (7d→+40, 30d→+120) and returnAfterLapse (+15) |
| 2026-04-18 | Added freezeLevelBonus (+3 XP) for practicing frozen technique levels |
| 2026-04-18 | ProgressTracking: infinite techniques show "Level X", fire techniques show "Level X/6" |
| 2026-04-18 | ProgressTracking: frozen technique card with ice-blue styling and Snowflake icon |
| 2026-04-18 | Fixed progress bar: level 1 with 0 sessions shows 0% (was 17%) |
| 2026-04-18 | Fixed freeze state sync: BreathingSession now reads from patternProgress via ref guard |
| 2026-04-18 | Fixed Home BreathingProgressCard: reads gamificationProfile from context (was showing zeros) |
| 2026-04-18 | Fixed technique level display: uses Math.max(local, backend) — adaptive techniques were showing level 1 |
| 2026-04-18 | Added clientTechniqueLevel to SessionPayload — backend uses local level when it has no history |
| 2026-04-18 | Fixed XP for adaptive techniques (CALM, REST, FOCUS, BALANCE, BHRAMARI) — submitSession now called on level-up |
| 2026-04-18 | Replaced XPRewardOverlay modal with XPBurst floating animation (3s, non-blocking, pointer-events:none) |
| 2026-04-18 | XPBurst now fires optimistically (immediate, no network wait) for breathing sessions |
| 2026-04-18 | submitSession accepts { silent: true } to skip XP burst when already shown optimistically |
| 2026-04-18 | triggerXPBurst exposed in AppContext for direct calls from any component |
