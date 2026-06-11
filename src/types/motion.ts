/**
 * Core domain types for the BreakCoach motion engine.
 *
 * Everything here is intentionally SPORT-AGNOSTIC. Breakdance is just the first
 * dataset that plugs into this engine. Boxing, basketball, wrestling, soccer,
 * martial arts and fitness can all be added later by supplying new `Skill` +
 * `MovementModel` definitions and reference motion data — no schema changes.
 */

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Canonical joints we persist. This is a reduced, anonymized skeleton — enough
 * to analyze movement, not enough to identify a person. It maps onto the
 * MediaPipe Pose Landmarker output (see src/lib/pose/mediapipe.ts) but is
 * defined independently so the engine never depends on a specific detector.
 */
export enum Joint {
  Nose = 'nose',
  LeftShoulder = 'leftShoulder',
  RightShoulder = 'rightShoulder',
  LeftElbow = 'leftElbow',
  RightElbow = 'rightElbow',
  LeftWrist = 'leftWrist',
  RightWrist = 'rightWrist',
  LeftHip = 'leftHip',
  RightHip = 'rightHip',
  LeftKnee = 'leftKnee',
  RightKnee = 'rightKnee',
  LeftAnkle = 'leftAnkle',
  RightAnkle = 'rightAnkle',
}

export const ALL_JOINTS: Joint[] = Object.values(Joint);

/** A single 3D landmark with detector confidence in [0, 1]. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** Detector confidence / visibility, 0..1. */
  confidence: number;
}

/** All tracked joints for a single point in time. */
export type Pose = Record<Joint, Landmark>;

/** Bones, used purely for rendering the stick figure. */
export const BONES: ReadonlyArray<readonly [Joint, Joint]> = [
  [Joint.LeftShoulder, Joint.RightShoulder],
  [Joint.LeftHip, Joint.RightHip],
  [Joint.LeftShoulder, Joint.LeftHip],
  [Joint.RightShoulder, Joint.RightHip],
  [Joint.LeftShoulder, Joint.LeftElbow],
  [Joint.LeftElbow, Joint.LeftWrist],
  [Joint.RightShoulder, Joint.RightElbow],
  [Joint.RightElbow, Joint.RightWrist],
  [Joint.LeftHip, Joint.LeftKnee],
  [Joint.LeftKnee, Joint.LeftAnkle],
  [Joint.RightHip, Joint.RightKnee],
  [Joint.RightKnee, Joint.RightAnkle],
  [Joint.Nose, Joint.LeftShoulder],
  [Joint.Nose, Joint.RightShoulder],
] as const;

// ---------------------------------------------------------------------------
// Motion capture (the only personal data we keep — and it's anonymized)
// ---------------------------------------------------------------------------

/** One normalized frame of skeleton data. Persisted; raw video never is. */
export interface MotionFrame {
  /** Milliseconds from session start. */
  timestamp: number;
  joints: Pose;
}

export interface MotionSession {
  id: string;
  userId: string;
  skillId: string;
  createdAt: string; // ISO 8601
  /** Seconds. */
  duration: number;
  fps: number;
  /** Overall 0..100 score, null until scored. */
  score: number | null;
  feedbackSummary: string | null;
  frames: MotionFrame[];
}

// ---------------------------------------------------------------------------
// Content: Skills + the model that scores them
// ---------------------------------------------------------------------------

export type SkillCategory =
  // breakdance categories (MVP)
  | 'toprock'
  | 'footwork'
  | 'freeze'
  | 'power'
  // reserved for future disciplines — kept here so the type is the only place
  // that needs touching when a new sport is added.
  | 'striking'
  | 'grappling'
  | 'ballhandling'
  | 'conditioning';

export type Discipline =
  | 'breakdance'
  | 'boxing'
  | 'basketball'
  | 'wrestling'
  | 'soccer'
  | 'martial-arts'
  | 'fitness';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** Which scoring dimensions to run for a skill, and how to weight them. */
export interface ScoringConfig {
  weights: Partial<Record<MetricKey, number>>;
  /**
   * Phases of the movement, in order. Used for timing analysis and for
   * "your hips are too high during step 3" style feedback. Optional — a simple
   * skill can omit phases.
   */
  phases?: MovementPhase[];
  /** For freezes: target hold time in seconds. */
  targetHoldSeconds?: number;
}

export interface MovementPhase {
  /** Stable id, e.g. "step-3". */
  id: string;
  label: string;
  /** Fraction of total duration where this phase is expected to start, 0..1. */
  startFraction: number;
}

/**
 * A MovementModel ties a Skill to the reference motion and scoring config used
 * to analyze it. Swapping disciplines = supplying new models, nothing else.
 */
export interface MovementModel {
  skillId: string;
  referenceMotionId: string;
  scoring: ScoringConfig;
}

/** A learnable movement. (Was "Move" in the original breakdance-only spec.) */
export interface Skill {
  id: string;
  discipline: Discipline;
  name: string;
  category: SkillCategory;
  difficulty: Difficulty;
  description: string;
  referenceMotionId: string;
}

// ---------------------------------------------------------------------------
// Scoring + feedback
// ---------------------------------------------------------------------------

export type MetricKey =
  | 'timing'
  | 'balance'
  | 'footPlacement'
  | 'handPlacement'
  | 'hipHeight'
  | 'freezeStability'
  | 'rhythm'
  | 'symmetry';

export const METRIC_LABELS: Record<MetricKey, string> = {
  timing: 'Timing',
  balance: 'Balance',
  footPlacement: 'Foot placement',
  handPlacement: 'Hand placement',
  hipHeight: 'Hip height',
  freezeStability: 'Freeze stability',
  rhythm: 'Rhythm',
  symmetry: 'Symmetry',
};

export interface MetricResult {
  key: MetricKey;
  /** 0..100. */
  score: number;
  /** Human-readable coaching note. */
  message: string;
}

export interface SessionScore {
  overall: number; // 0..100
  metrics: MetricResult[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Users, roles, consent (youth-safe by design)
// ---------------------------------------------------------------------------

export type UserRole = 'child' | 'parent' | 'coach' | 'adult';

export type AgeGroup = 'under13' | 'teen' | 'adult';

export type ConsentStatus =
  | 'not_required' // adult / teen
  | 'pending' // under 13, awaiting parent
  | 'granted'
  | 'revoked';

export interface UserProfile {
  id: string;
  role: UserRole;
  ageGroup: AgeGroup;
  consentStatus: ConsentStatus;
  /** Parent profile id, for a `child` account. */
  guardianId?: string | null;
  /** Off by default and only changeable by a guardian for minors. */
  allowRawVideoStorage: boolean;
  allowPublicSharing: boolean;
}
