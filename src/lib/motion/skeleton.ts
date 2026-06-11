import { ALL_JOINTS, Joint, Landmark, Pose } from '@/types/motion';

/**
 * Skeleton math. Coordinate convention (normalized, see normalize.ts):
 *   x: left(-) .. right(+)
 *   y: up(+)   .. down(-)   (so a higher hip = larger y)
 *   z: toward camera(+) .. away(-)
 * Units are roughly "torso lengths"; the figure is centered on the mid-hip.
 */

export function makeLandmark(
  x: number,
  y: number,
  z = 0,
  confidence = 1
): Landmark {
  return { x, y, z, confidence };
}

/** Neutral standing pose, centered at mid-hip (0,0,0). */
export function restPose(): Pose {
  return {
    [Joint.Nose]: makeLandmark(0, 1.55, 0.05),
    [Joint.LeftShoulder]: makeLandmark(-0.22, 1.3, 0),
    [Joint.RightShoulder]: makeLandmark(0.22, 1.3, 0),
    [Joint.LeftElbow]: makeLandmark(-0.3, 1.0, 0),
    [Joint.RightElbow]: makeLandmark(0.3, 1.0, 0),
    [Joint.LeftWrist]: makeLandmark(-0.34, 0.7, 0),
    [Joint.RightWrist]: makeLandmark(0.34, 0.7, 0),
    [Joint.LeftHip]: makeLandmark(-0.16, 0, 0),
    [Joint.RightHip]: makeLandmark(0.16, 0, 0),
    [Joint.LeftKnee]: makeLandmark(-0.18, -0.55, 0),
    [Joint.RightKnee]: makeLandmark(0.18, -0.55, 0),
    [Joint.LeftAnkle]: makeLandmark(-0.18, -1.1, 0),
    [Joint.RightAnkle]: makeLandmark(0.18, -1.1, 0),
  };
}

export function clonePose(p: Pose): Pose {
  const out = {} as Pose;
  for (const j of ALL_JOINTS) {
    const l = p[j];
    out[j] = { x: l.x, y: l.y, z: l.z, confidence: l.confidence };
  }
  return out;
}

export function lerpLandmark(a: Landmark, b: Landmark, t: number): Landmark {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    confidence: Math.min(a.confidence, b.confidence),
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const j of ALL_JOINTS) out[j] = lerpLandmark(a[j], b[j], t);
  return out;
}

/** Mid-point between two joints (used for mid-hip, mid-shoulder). */
export function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    confidence: Math.min(a.confidence, b.confidence),
  };
}

export function midHip(p: Pose): Landmark {
  return midpoint(p[Joint.LeftHip], p[Joint.RightHip]);
}

export function midShoulder(p: Pose): Landmark {
  return midpoint(p[Joint.LeftShoulder], p[Joint.RightShoulder]);
}
