# BreakCoach 🤸

Teach breakdance through video-based movement analysis — **privacy-first**. The
app records a short clip, extracts an anonymized 3D skeleton **on device**,
**deletes the raw video**, and stores only motion data. It then compares your
movement against coach reference data and returns specific coaching feedback.

The motion engine is **sport-agnostic** by design. Breakdance is just the first
dataset. Boxing, basketball, wrestling, soccer, martial arts and fitness can be
added later by supplying new `Skill` + `MovementModel` content and reference
motion — no engine or schema changes.

---

## Status

**Phase 1 scaffold, runnable today.** The full pipeline works end-to-end
(record → pose → store → replay → score → feedback) in Expo Go using a **mock
on-device pose estimator** so nothing native is required to try it. Real
MediaPipe is wired behind a swappable interface (see below).

Verified locally:
- `npm test` — scoring-engine unit tests pass.
- `npx tsc --noEmit` — clean.
- `npx expo export` — Metro bundles the whole app (894 modules) with no errors.

## Quick start

```bash
npm install
npm start          # then press i / a, or scan the QR with Expo Go
npm test           # scoring engine tests
npm run typecheck
```

No camera (simulator)? On the record screen tap **“Simulate a clip”** — it runs
the exact same pipeline on synthetic input.

Supabase is **optional**. Without credentials the app is fully local-first
(AsyncStorage). To enable cloud sync, set `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (or `app.json` → `expo.extra`) and run the SQL
in `supabase/migrations/0001_init.sql`.

---

## Architecture

```
Record clip ─▶ On-device pose estimation ─▶ Normalize skeleton
                                                   │
                          Delete raw video ◀───────┤  (privacy gate)
                                                   ▼
                              Save anonymized MotionFrame[]  ──▶ (optional Supabase sync)
                                                   │
              Compare vs coach reference  ◀────────┤
                                                   ▼
                       Score + feedback  ─▶  3D skeleton replay
```

### The pose layer is pluggable
Everything talks to the `PoseEstimator` interface
([src/lib/pose/PoseEstimator.ts](src/lib/pose/PoseEstimator.ts)):

- `MockPoseEstimator` (active) — synthesizes a realistic "learner attempt" from
  the coach reference so the demo produces meaningful scores in Expo Go.
- `MediaPipePoseEstimator` (stub, [src/lib/pose/mediapipe.ts](src/lib/pose/mediapipe.ts))
  — the real on-device path. Enabling it needs an **Expo dev build** (MediaPipe
  is native; it won't run in Expo Go). The file documents the exact steps and
  the MediaPipe→canonical-joint index mapping. Swap one line in
  [src/lib/pose/index.ts](src/lib/pose/index.ts) to activate; nothing else
  changes.

### The scoring engine is data-driven
`scoreSession(skillId, frames, fps)`
([src/lib/scoring/ScoringEngine.ts](src/lib/scoring/ScoringEngine.ts)) runs only
the metrics a skill's `MovementModel` declares, with its weights. Metrics
([src/lib/scoring/metrics.ts](src/lib/scoring/metrics.ts)): timing, balance,
foot/hand placement, hip height, freeze stability, rhythm, symmetry. Feedback
phrasing — including phase-aware lines like *"Your hips are too high during
step 3"* — lives in [src/lib/scoring/feedback.ts](src/lib/scoring/feedback.ts).

Poses are normalized (mid-hip at origin, torso = unit length) so scoring is
invariant to body size, camera distance, and screen position — only the *shape
and motion* of the movement matter.

---

## Privacy (youth-safe by design)

Enforced in code, not just policy ([src/lib/storage/privacy.ts](src/lib/storage/privacy.ts)):

- **On-device processing.** Pose extraction happens locally.
- **Raw video deleted by default** after extraction. Retention is only possible
  if an adult opts in, or a guardian explicitly enables it for a minor.
- **Only anonymized skeleton data is stored** (3D joints, timestamps,
  confidence, move metadata).
- **Parental consent gate** for under-13 accounts blocks recording until a
  guardian consents ([src/screens/ConsentScreen.tsx](src/screens/ConsentScreen.tsx)).
- **Delete-all.** Users/guardians can wipe all motion data, locally and in the
  cloud (Settings → "Delete all my motion data").
- **No public sharing for minors**, ever, by default.
- Supabase **row-level security** ([supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql))
  scopes data to its owner, with guardian read access to a child's sessions.

---

## Data model (generic names)

| Type | Notes |
|------|-------|
| `UserProfile` | role (child/parent/coach/adult), age group, consent status, privacy flags |
| `Skill` | a learnable movement (was "Move"): discipline, category, difficulty, reference |
| `MovementModel` | ties a skill to its reference motion + scoring config (metrics, weights, phases) |
| `MotionSession` | one analyzed attempt: duration, fps, score, feedback summary |
| `MotionFrame` | timestamp + per-joint `[x, y, z, confidence]` — the only retained "personal" data |

Defined in [src/types/motion.ts](src/types/motion.ts).

---

## Project layout

```
App.tsx                      app entry (providers + navigation)
src/types/motion.ts          sport-agnostic domain types
src/lib/pose/                PoseEstimator interface, mock, MediaPipe stub
src/lib/motion/              skeleton math + normalization
src/lib/scoring/             metrics, engine, feedback (+ tests)
src/lib/storage/             local-first store + privacy enforcement
src/data/                    breakdance skills + procedural coach references
src/state/auth.tsx           profile / role / consent
src/components/              3D SkeletonReplay, score/feedback UI, primitives
src/screens/                 onboarding, consent, learn, record, result, progress, settings
supabase/migrations/         schema + RLS
```

## Roadmap

- **Phase 1 (done):** auth/onboarding, move library, record, pose extraction,
  motion storage, 3D skeleton replay, scoring + coach comparison, progress.
- **Phase 2:** richer scoring (DTW alignment), progress trends, coach uploads.
- **Phase 3:** verified parent accounts, coach review, gamification/badges,
  adult-only leaderboards.
- **Beyond breakdance:** add a discipline by dropping in `Skill` +
  `MovementModel` rows and reference motion — the engine is already generic.
