import { ALL_JOINTS, Joint, MetricKey, MotionFrame, Pose } from '@/types/motion';
import { lerpPose } from '@/lib/motion/skeleton';
import { centerOfMass, distance, normalizePose } from '@/lib/motion/normalize';

/**
 * Movement metrics. Each compares a user attempt against a coach reference (or,
 * for self-referential metrics like symmetry/rhythm, analyzes the attempt
 * alone) and returns a 0..100 score plus a raw measurement the feedback layer
 * can phrase.
 *
 * NOTE on normalization: poses are normalized so mid-hip is the origin and the
 * torso is unit length. That means mid-hip position itself is ~0 — so "hip
 * height" is measured relative to the ankles (how grounded/low you are), and
 * the timing/rhythm signal is taken from the highest-variance joint channel
 * rather than the (motionless-by-construction) hip center.
 */

const SAMPLES = 48;
type Axis = 'x' | 'y' | 'z';

export interface MetricContext {
  user: Pose[]; // normalized, length SAMPLES
  ref: Pose[]; // normalized, length SAMPLES
  fps: number;
  targetHoldSeconds?: number;
}

/** Build a normalized, fixed-length pose array from raw frames. */
export function resample(frames: MotionFrame[], n = SAMPLES): Pose[] {
  if (frames.length === 0) return [];
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * (frames.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(frames.length - 1, lo + 1);
    const f = pos - lo;
    out.push(normalizePose(lerpPose(frames[lo].joints, frames[hi].joints, f)));
  }
  return out;
}

function scoreFromError(err: number, scale: number): number {
  return Math.round(100 * Math.exp(-err / scale));
}

function clampScore(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)));
}

function meanJointDistance(a: Pose[], b: Pose[], joints: Joint[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    for (const j of joints) {
      sum += distance(a[i][j], b[i][j]);
      count++;
    }
  }
  return count ? sum / count : 0;
}

function meanAnkleY(p: Pose): number {
  return (p[Joint.LeftAnkle].y + p[Joint.RightAnkle].y) / 2;
}

// --- signal extraction -----------------------------------------------------

function channel(poses: Pose[], joint: Joint, axis: Axis): number[] {
  return poses.map((p) => p[joint][axis]);
}

/** Pick the joint+axis that varies most across the sequence (the "motion"). */
function dominantChannel(poses: Pose[]): { joint: Joint; axis: Axis } {
  let best: { joint: Joint; axis: Axis } = { joint: Joint.RightAnkle, axis: 'z' };
  let bestVar = -1;
  for (const j of ALL_JOINTS) {
    for (const axis of ['x', 'y', 'z'] as Axis[]) {
      const vals = channel(poses, j, axis);
      const v = variance(vals);
      if (v > bestVar) {
        bestVar = v;
        best = { joint: j, axis };
      }
    }
  }
  return best;
}

function variance(vals: number[]): number {
  if (vals.length === 0) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length;
}

function demean(vals: number[]): number[] {
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.map((v) => v - m);
}

// --- timing: best-alignment lag on the dominant motion channel -------------

export function timingMetric(ctx: MetricContext): { score: number; lagFrames: number } {
  const ch = dominantChannel(ctx.ref);
  const u = demean(channel(ctx.user, ch.joint, ch.axis));
  const r = demean(channel(ctx.ref, ch.joint, ch.axis));
  const maxLag = Math.floor(SAMPLES * 0.25);

  let bestLag = 0;
  let bestErr = Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let err = 0;
    let count = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const ri = i + lag;
      if (ri < 0 || ri >= SAMPLES) continue;
      err += (u[i] - r[ri]) ** 2;
      count++;
    }
    if (count > 0) {
      err /= count;
      if (err < bestErr) {
        bestErr = err;
        bestLag = lag;
      }
    }
  }
  const lagPenalty = Math.abs(bestLag) / maxLag;
  const score = clampScore(scoreFromError(bestErr, 0.04) * (1 - 0.4 * lagPenalty));
  return { score, lagFrames: bestLag };
}

// --- balance: COM kept over the base of support ----------------------------

export function balanceMetric(ctx: MetricContext): { score: number } {
  let dev = 0;
  for (const p of ctx.user) {
    const com = centerOfMass(p);
    const footX = (p[Joint.LeftAnkle].x + p[Joint.RightAnkle].x) / 2;
    const footZ = (p[Joint.LeftAnkle].z + p[Joint.RightAnkle].z) / 2;
    dev += Math.hypot(com.x - footX, com.z - footZ);
  }
  dev /= ctx.user.length;
  return { score: clampScore(scoreFromError(dev, 0.5)) };
}

// --- placement: ankles / wrists vs reference -------------------------------

export function footPlacementMetric(ctx: MetricContext): {
  score: number;
  err: number;
  worstFrac: number;
} {
  const joints = [Joint.LeftAnkle, Joint.RightAnkle];
  const err = meanJointDistance(ctx.user, ctx.ref, joints);
  let worstFrac = 0;
  let worst = -1;
  for (let i = 0; i < ctx.user.length; i++) {
    const d =
      distance(ctx.user[i][Joint.LeftAnkle], ctx.ref[i][Joint.LeftAnkle]) +
      distance(ctx.user[i][Joint.RightAnkle], ctx.ref[i][Joint.RightAnkle]);
    if (d > worst) {
      worst = d;
      worstFrac = i / (ctx.user.length - 1);
    }
  }
  return { score: clampScore(scoreFromError(err, 0.4)), err, worstFrac };
}

export function handPlacementMetric(ctx: MetricContext): {
  score: number;
  err: number;
  worstFrac: number;
} {
  const err = meanJointDistance(ctx.user, ctx.ref, [Joint.LeftWrist, Joint.RightWrist]);
  let worstFrac = 0;
  let worst = -1;
  for (let i = 0; i < ctx.user.length; i++) {
    const d =
      distance(ctx.user[i][Joint.RightWrist], ctx.ref[i][Joint.RightWrist]) +
      distance(ctx.user[i][Joint.LeftWrist], ctx.ref[i][Joint.LeftWrist]);
    if (d > worst) {
      worst = d;
      worstFrac = i / (ctx.user.length - 1);
    }
  }
  return { score: clampScore(scoreFromError(err, 0.4)), err, worstFrac };
}

// --- hip height: hip-above-ankles vs reference -----------------------------

export function hipHeightMetric(ctx: MetricContext): {
  score: number;
  meanDelta: number; // + = user hips higher above the floor than reference
  worstFrac: number;
} {
  let sum = 0;
  let signed = 0;
  let worst = -1;
  let worstFrac = 0;
  for (let i = 0; i < ctx.user.length; i++) {
    // mid-hip is at origin, so hip-above-ankles == -meanAnkleY
    const uh = -meanAnkleY(ctx.user[i]);
    const rh = -meanAnkleY(ctx.ref[i]);
    const d = uh - rh;
    sum += Math.abs(d);
    signed += d;
    if (Math.abs(d) > worst) {
      worst = Math.abs(d);
      worstFrac = i / (ctx.user.length - 1);
    }
  }
  return {
    score: clampScore(scoreFromError(sum / ctx.user.length, 0.3)),
    meanDelta: signed / ctx.user.length,
    worstFrac,
  };
}

// --- freeze stability: low movement during the hold + hold duration --------

export function freezeStabilityMetric(ctx: MetricContext): {
  score: number;
  holdSeconds: number;
  jitter: number;
} {
  const start = Math.floor(ctx.user.length * 0.4);
  const tracked = [Joint.Nose, Joint.LeftHip, Joint.RightHip, Joint.LeftKnee, Joint.RightKnee];
  let motion = 0;
  let count = 0;
  let holdFrames = 0;
  const moveThreshold = 0.06;
  for (let i = start + 1; i < ctx.user.length; i++) {
    let frameMove = 0;
    for (const j of tracked) frameMove += distance(ctx.user[i][j], ctx.user[i - 1][j]);
    frameMove /= tracked.length;
    motion += frameMove;
    count++;
    if (frameMove < moveThreshold) holdFrames++;
  }
  const jitter = count ? motion / count : 1;
  const clipSeconds = ctx.user.length / ctx.fps;
  const holdSeconds = round1((holdFrames / Math.max(1, count)) * clipSeconds * 0.6);

  const stabilityScore = scoreFromError(jitter, 0.04);
  const durationScore = ctx.targetHoldSeconds
    ? clampScore((holdSeconds / ctx.targetHoldSeconds) * 100)
    : 100;
  return {
    score: clampScore(0.6 * stabilityScore + 0.4 * durationScore),
    holdSeconds,
    jitter,
  };
}

// --- symmetry: left/right balance of the attempt itself --------------------

export function symmetryMetric(ctx: MetricContext): { score: number } {
  const pairs: Array<[Joint, Joint]> = [
    [Joint.LeftShoulder, Joint.RightShoulder],
    [Joint.LeftElbow, Joint.RightElbow],
    [Joint.LeftWrist, Joint.RightWrist],
    [Joint.LeftKnee, Joint.RightKnee],
    [Joint.LeftAnkle, Joint.RightAnkle],
  ];
  let err = 0;
  let count = 0;
  for (const p of ctx.user) {
    for (const [l, r] of pairs) {
      err += Math.abs(Math.abs(p[l].x) - Math.abs(p[r].x));
      err += Math.abs(p[l].y - p[r].y);
      count += 2;
    }
  }
  return { score: clampScore(scoreFromError(count ? err / count : 0, 0.12)) };
}

// --- rhythm: consistency of the dominant channel's periodicity -------------

export function rhythmMetric(ctx: MetricContext): { score: number } {
  const ch = dominantChannel(ctx.user);
  const sig = demean(channel(ctx.user, ch.joint, ch.axis));
  const crossings: number[] = [];
  for (let i = 1; i < sig.length; i++) {
    if (sig[i - 1] === 0 || sig[i - 1] * sig[i] < 0) crossings.push(i);
  }
  if (crossings.length < 3) return { score: 70 }; // too little motion (e.g. a freeze)
  const intervals: number[] = [];
  for (let i = 1; i < crossings.length; i++) intervals.push(crossings[i] - crossings[i - 1]);
  const m = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const cv = m > 0 ? Math.sqrt(variance(intervals)) / m : 1;
  return { score: clampScore(scoreFromError(cv, 0.4)) };
}

export const METRIC_FNS: Record<MetricKey, (ctx: MetricContext) => { score: number }> = {
  timing: timingMetric,
  balance: balanceMetric,
  footPlacement: footPlacementMetric,
  handPlacement: handPlacementMetric,
  hipHeight: hipHeightMetric,
  freezeStability: freezeStabilityMetric,
  rhythm: rhythmMetric,
  symmetry: symmetryMetric,
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
