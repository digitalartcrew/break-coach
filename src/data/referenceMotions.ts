import { Joint, MotionFrame, Pose } from '@/types/motion';
import { clonePose, restPose } from '@/lib/motion/skeleton';

/**
 * Coach reference motion data.
 *
 * In production these come from coach recordings run through the same pose
 * pipeline and stored as anonymized MotionFrame[] (no video). For the scaffold
 * we synthesize plausible, distinct motions procedurally so the full pipeline —
 * compare, score, replay — works end-to-end offline.
 *
 * A recipe maps phase t in [0,1] to a Pose. Build a frame list with sample().
 */

type Recipe = (t: number) => Pose;

const TAU = Math.PI * 2;

/** Apply small per-joint deltas onto a fresh rest pose. */
function pose(deltas: Partial<Record<Joint, [number, number, number]>>): Pose {
  const p = restPose();
  for (const key of Object.keys(deltas) as Joint[]) {
    const d = deltas[key]!;
    p[key].x += d[0];
    p[key].y += d[1];
    p[key].z += d[2];
  }
  return p;
}

// --- Recipes --------------------------------------------------------------

// Toprock: upright, rhythmic side-to-side step + arm swing, 2 cycles.
const toprock: Recipe = (t) => {
  const swing = Math.sin(t * TAU * 2);
  const step = Math.sin(t * TAU * 2);
  return pose({
    [Joint.LeftAnkle]: [0, 0, step * 0.25],
    [Joint.RightAnkle]: [0, 0, -step * 0.25],
    [Joint.LeftKnee]: [0, 0, step * 0.12],
    [Joint.RightKnee]: [0, 0, -step * 0.12],
    [Joint.LeftWrist]: [swing * 0.12, swing * 0.15, 0.1],
    [Joint.RightWrist]: [swing * 0.12, -swing * 0.15, 0.1],
    [Joint.LeftHip]: [swing * 0.05, 0, 0],
    [Joint.RightHip]: [swing * 0.05, 0, 0],
  });
};

// Backrock: like toprock but rocking backward (z negative) on the back step.
const backrock: Recipe = (t) => {
  const rock = Math.sin(t * TAU * 2);
  return pose({
    [Joint.LeftAnkle]: [0, 0, -Math.max(0, rock) * 0.35],
    [Joint.RightAnkle]: [0, 0, -Math.max(0, -rock) * 0.35],
    [Joint.Nose]: [0, 0, -rock * 0.1],
    [Joint.LeftWrist]: [0, rock * 0.1, 0.15],
    [Joint.RightWrist]: [0, -rock * 0.1, 0.15],
  });
};

// Six-step: low to the floor, hands planted, legs circling. Hips drop.
const sixStep: Recipe = (t) => {
  const circle = t * TAU;
  return pose({
    [Joint.LeftHip]: [0, -0.55, 0.3],
    [Joint.RightHip]: [0, -0.55, 0.3],
    [Joint.Nose]: [0, -0.7, 0.4],
    [Joint.LeftWrist]: [-0.1, -1.0, 0.5], // planted on floor
    [Joint.RightWrist]: [0.1, -1.0, 0.5],
    [Joint.LeftElbow]: [-0.15, -0.6, 0.4],
    [Joint.RightElbow]: [0.15, -0.6, 0.4],
    [Joint.LeftAnkle]: [Math.cos(circle) * 0.4, -1.0, Math.sin(circle) * 0.3],
    [Joint.RightAnkle]: [
      Math.cos(circle + Math.PI) * 0.4,
      -1.0,
      Math.sin(circle + Math.PI) * 0.3,
    ],
  });
};

// CCs: low cross-step footwork; legs cross over, hips low, one hand support.
const ccs: Recipe = (t) => {
  const cross = Math.sin(t * TAU * 2);
  return pose({
    [Joint.LeftHip]: [0, -0.4, 0.2],
    [Joint.RightHip]: [0, -0.4, 0.2],
    [Joint.LeftKnee]: [cross * 0.25, -0.7, 0.2],
    [Joint.RightKnee]: [-cross * 0.25, -0.7, 0.2],
    [Joint.LeftAnkle]: [cross * 0.35, -1.0, 0.2],
    [Joint.RightAnkle]: [-cross * 0.35, -1.0, 0.2],
    [Joint.RightWrist]: [0.15, -0.9, 0.4], // support hand
    [Joint.RightElbow]: [0.2, -0.5, 0.3],
  });
};

// Baby freeze: transition in (t<0.4) then HOLD a balanced, head-down freeze.
const babyFreeze: Recipe = (t) => {
  const entry = Math.min(1, t / 0.4); // 0..1 during entry, then stays 1
  const held = pose({
    [Joint.Nose]: [0.1, -1.3, 0.3], // head low toward floor
    [Joint.LeftShoulder]: [0.05, -0.6, 0.2],
    [Joint.RightShoulder]: [0.05, -0.5, 0.2],
    [Joint.LeftElbow]: [-0.05, -0.9, 0.35], // elbow planted into core
    [Joint.LeftWrist]: [-0.1, -1.15, 0.45],
    [Joint.RightElbow]: [0.25, -1.0, 0.4],
    [Joint.RightWrist]: [0.2, -1.2, 0.5],
    [Joint.LeftHip]: [0.1, 0.2, 0.1],
    [Joint.RightHip]: [0.2, 0.35, 0.1], // hips up, stacked
    [Joint.LeftKnee]: [0.0, 0.5, -0.1],
    [Joint.RightKnee]: [0.35, 0.45, -0.1],
    [Joint.LeftAnkle]: [-0.1, 0.7, -0.3], // legs tucked / up
    [Joint.RightAnkle]: [0.45, 0.6, -0.3],
  });
  // interpolate rest -> held during entry; afterwards hold (static = stable)
  const r = restPose();
  const out = clonePose(r);
  for (const key of Object.keys(out) as Joint[]) {
    out[key].x = r[key].x + (held[key].x - r[key].x) * entry;
    out[key].y = r[key].y + (held[key].y - r[key].y) * entry;
    out[key].z = r[key].z + (held[key].z - r[key].z) * entry;
  }
  return out;
};

const RECIPES: Record<string, Recipe> = {
  'ref-toprock': toprock,
  'ref-backrock': backrock,
  'ref-sixstep': sixStep,
  'ref-ccs': ccs,
  'ref-babyfreeze': babyFreeze,
};

const META: Record<string, { duration: number; fps: number }> = {
  'ref-toprock': { duration: 4, fps: 15 },
  'ref-backrock': { duration: 4, fps: 15 },
  'ref-sixstep': { duration: 4, fps: 15 },
  'ref-ccs': { duration: 4, fps: 15 },
  'ref-babyfreeze': { duration: 4, fps: 15 },
};

function sample(recipe: Recipe, duration: number, fps: number): MotionFrame[] {
  const count = Math.max(2, Math.round(duration * fps));
  const frames: MotionFrame[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    frames.push({ timestamp: Math.round((i / fps) * 1000), joints: recipe(t) });
  }
  return frames;
}

const cache = new Map<string, MotionFrame[]>();

/** Get the reference MotionFrame[] for a reference id, or null if unknown. */
export function getReferenceMotion(referenceId: string): MotionFrame[] | null {
  if (cache.has(referenceId)) return cache.get(referenceId)!;
  const recipe = RECIPES[referenceId];
  const meta = META[referenceId];
  if (!recipe || !meta) return null;
  const frames = sample(recipe, meta.duration, meta.fps);
  cache.set(referenceId, frames);
  return frames;
}

export function getReferenceMeta(
  referenceId: string
): { duration: number; fps: number } | null {
  return META[referenceId] ?? null;
}
