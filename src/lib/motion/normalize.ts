import { ALL_JOINTS, Joint, Landmark, Pose } from '@/types/motion';
import { midHip, midShoulder } from './skeleton';

/**
 * Normalize a raw pose into the engine's canonical, person-size-independent
 * frame: translate so mid-hip is the origin, then scale so the torso (mid-hip
 * to mid-shoulder) is unit length. This makes scoring invariant to how big the
 * person appears, how far they stand from the camera, and where in frame they
 * are — only the *shape and motion* of the movement matter.
 */
export function normalizePose(raw: Pose): Pose {
  const origin = midHip(raw);
  const shoulder = midShoulder(raw);
  const torso = distance(origin, shoulder);
  const scale = torso > 1e-4 ? 1 / torso : 1;

  const out = {} as Pose;
  for (const j of ALL_JOINTS) {
    const l = raw[j];
    out[j] = {
      x: (l.x - origin.x) * scale,
      y: (l.y - origin.y) * scale,
      z: (l.z - origin.z) * scale,
      confidence: l.confidence,
    };
  }
  return out;
}

export function distance(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Angle (degrees) at joint `b` formed by segments b->a and b->c. */
export function jointAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBa = Math.hypot(ba.x, ba.y, ba.z);
  const magBc = Math.hypot(bc.x, bc.y, bc.z);
  if (magBa < 1e-6 || magBc < 1e-6) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magBa * magBc)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Center of mass approximation, weighting torso/hips more heavily. */
export function centerOfMass(p: Pose): Landmark {
  const weights: Partial<Record<Joint, number>> = {
    [Joint.Nose]: 0.08,
    [Joint.LeftShoulder]: 0.1,
    [Joint.RightShoulder]: 0.1,
    [Joint.LeftHip]: 0.15,
    [Joint.RightHip]: 0.15,
    [Joint.LeftKnee]: 0.07,
    [Joint.RightKnee]: 0.07,
    [Joint.LeftElbow]: 0.04,
    [Joint.RightElbow]: 0.04,
    [Joint.LeftWrist]: 0.02,
    [Joint.RightWrist]: 0.02,
    [Joint.LeftAnkle]: 0.03,
    [Joint.RightAnkle]: 0.03,
  };
  let x = 0,
    y = 0,
    z = 0,
    total = 0;
  for (const j of ALL_JOINTS) {
    const w = weights[j] ?? 0.05;
    x += p[j].x * w;
    y += p[j].y * w;
    z += p[j].z * w;
    total += w;
  }
  return { x: x / total, y: y / total, z: z / total, confidence: 1 };
}

/** Deterministic PRNG so mock data + perturbations are reproducible per seed. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Stable 32-bit hash of a string (used to seed the mock from a video uri). */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
