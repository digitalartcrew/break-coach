import { ALL_JOINTS, Joint, MotionFrame, Pose } from '@/types/motion';
import { hashString, seededRandom } from '@/lib/motion/normalize';
import { clonePose, restPose } from '@/lib/motion/skeleton';
import { getModel, getSkill } from '@/data/skills';
import { getReferenceMeta, getReferenceMotion } from '@/data/referenceMotions';
import {
  PoseEstimationOptions,
  PoseEstimationResult,
  PoseEstimator,
} from './PoseEstimator';

/**
 * Mock estimator: simulates on-device pose extraction so the whole pipeline
 * runs in Expo Go without native modules or a real model.
 *
 * If a skillHint is provided, it derives a "learner attempt" from that skill's
 * coach reference and applies realistic imperfections (a timing offset, hip
 * drift, a late hand plant, slight asymmetry, jitter). That makes scoring +
 * feedback meaningful in the demo. With no hint it returns a generic idle sway.
 */
export class MockPoseEstimator implements PoseEstimator {
  readonly id = 'mock';

  async estimateFromVideo(
    videoUri: string,
    options?: PoseEstimationOptions
  ): Promise<PoseEstimationResult> {
    const rand = seededRandom(hashString(videoUri));
    const fps = options?.fps ?? 15;

    const skill = options?.skillHint ? getSkill(options.skillHint) : undefined;
    const reference = skill ? getReferenceMotion(skill.referenceMotionId) : null;
    const meta = skill ? getReferenceMeta(skill.referenceMotionId) : null;
    const duration = meta?.duration ?? 4;

    // Simulate work so the progress UI is exercised.
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      await delay(40);
      options?.onProgress?.(i / steps);
    }

    const frames = reference
      ? perturbReference(reference, skill!.id, rand)
      : idleSway(duration, fps, rand);

    return { frames, fps, duration };
  }
}

// --- learner-attempt synthesis -------------------------------------------

function perturbReference(
  reference: MotionFrame[],
  skillId: string,
  rand: () => number
): MotionFrame[] {
  const model = getModel(skillId);
  const isFreeze = !!model?.scoring.targetHoldSeconds;

  // Per-attempt error characteristics (vary run to run via the seed).
  const timingOffset = Math.round((rand() - 0.5) * 4); // shift frames +/-
  const hipDrift = (rand() - 0.3) * 0.18; // tends slightly high
  const handLateFrames = Math.floor(rand() * 4); // late right-hand plant
  const asymmetry = (rand() - 0.5) * 0.1;
  const jitter = 0.015 + rand() * 0.02;
  // A freeze learner often can't hold the whole clip — wobble grows late.
  const holdBreakdown = isFreeze ? 0.4 + rand() * 0.4 : 0;

  const n = reference.length;
  const out: MotionFrame[] = [];
  for (let i = 0; i < n; i++) {
    const src = clampIndex(i + timingOffset, n);
    const base = clonePose(reference[src].joints);
    const tFrac = i / (n - 1);

    for (const j of ALL_JOINTS) {
      const l = base[j];
      // hip height drift
      if (j === Joint.LeftHip || j === Joint.RightHip) l.y += hipDrift;
      // lateral asymmetry on the right side
      if (j === Joint.RightShoulder || j === Joint.RightHip) l.x += asymmetry;
      // late right-hand plant: hold the wrist higher for the first few frames
      if (j === Joint.RightWrist && i < handLateFrames) l.y += 0.25;
      // freeze breakdown: increasing wobble in the back half
      if (holdBreakdown && tFrac > 0.5) {
        const w = (tFrac - 0.5) * 2 * holdBreakdown;
        l.x += (rand() - 0.5) * w * 0.3;
        l.y += (rand() - 0.5) * w * 0.3;
      }
      // sensor jitter + confidence
      l.x += (rand() - 0.5) * jitter;
      l.y += (rand() - 0.5) * jitter;
      l.z += (rand() - 0.5) * jitter;
      l.confidence = 0.8 + rand() * 0.2;
    }
    out.push({ timestamp: reference[i].timestamp, joints: base });
  }
  return out;
}

function idleSway(duration: number, fps: number, rand: () => number): MotionFrame[] {
  const count = Math.max(2, Math.round(duration * fps));
  const frames: MotionFrame[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const sway = Math.sin(t * Math.PI * 2) * 0.04;
    const p: Pose = clonePose(restPose());
    for (const j of ALL_JOINTS) {
      p[j].x += sway + (rand() - 0.5) * 0.02;
      p[j].confidence = 0.85 + rand() * 0.15;
    }
    frames.push({ timestamp: Math.round((i / fps) * 1000), joints: p });
  }
  return frames;
}

function clampIndex(i: number, n: number): number {
  return Math.min(n - 1, Math.max(0, i));
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
