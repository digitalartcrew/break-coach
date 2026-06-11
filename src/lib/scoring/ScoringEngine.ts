import {
  MetricKey,
  MetricResult,
  METRIC_LABELS,
  MotionFrame,
  SessionScore,
} from '@/types/motion';
import { getModel } from '@/data/skills';
import { getReferenceMotion } from '@/data/referenceMotions';
import {
  balanceMetric,
  footPlacementMetric,
  freezeStabilityMetric,
  handPlacementMetric,
  hipHeightMetric,
  MetricContext,
  resample,
  rhythmMetric,
  symmetryMetric,
  timingMetric,
} from './metrics';
import * as fb from './feedback';

/**
 * Compares a user attempt against the coach reference for a skill and produces
 * a 0..100 score per weighted metric plus human feedback. Generic across
 * disciplines: which metrics run and how they're weighted comes entirely from
 * the skill's MovementModel.
 */
export function scoreSession(
  skillId: string,
  userFrames: MotionFrame[],
  fps: number
): SessionScore | null {
  const model = getModel(skillId);
  if (!model) return null;
  const refFrames = getReferenceMotion(model.referenceMotionId);
  if (!refFrames) return null;

  const ctx: MetricContext = {
    user: resample(userFrames),
    ref: resample(refFrames),
    fps,
    targetHoldSeconds: model.scoring.targetHoldSeconds,
  };

  const weights = model.scoring.weights;
  const results: MetricResult[] = [];

  for (const key of Object.keys(weights) as MetricKey[]) {
    const weight = weights[key];
    if (!weight) continue;
    results.push(computeMetric(key, ctx, model));
  }

  // weighted overall
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of results) {
    const w = weights[r.key] ?? 0;
    weightedSum += r.score * w;
    totalWeight += w;
  }
  const overall = totalWeight ? Math.round(weightedSum / totalWeight) : 0;

  const ranked = [...results].sort((a, b) => b.score - a.score);
  const summary = fb.buildSummary(overall, ranked);

  return { overall, metrics: results, summary };
}

function computeMetric(
  key: MetricKey,
  ctx: MetricContext,
  model: ReturnType<typeof getModel>
): MetricResult {
  const label = METRIC_LABELS[key];
  switch (key) {
    case 'timing': {
      const r = timingMetric(ctx);
      return { key, score: r.score, message: fb.timingMessage(r.score, r.lagFrames) };
    }
    case 'balance': {
      const r = balanceMetric(ctx);
      return { key, score: r.score, message: fb.balanceMessage(r.score) };
    }
    case 'footPlacement': {
      const r = footPlacementMetric(ctx);
      return {
        key,
        score: r.score,
        message: fb.footPlacementMessage(r.score, model, r.worstFrac),
      };
    }
    case 'handPlacement': {
      const r = handPlacementMetric(ctx);
      return {
        key,
        score: r.score,
        message: fb.handPlacementMessage(r.score, model, r.worstFrac),
      };
    }
    case 'hipHeight': {
      const r = hipHeightMetric(ctx);
      return {
        key,
        score: r.score,
        message: fb.hipHeightMessage(r.score, model, r.meanDelta, r.worstFrac),
      };
    }
    case 'freezeStability': {
      const r = freezeStabilityMetric(ctx);
      return {
        key,
        score: r.score,
        message: fb.freezeStabilityMessage(r.score, r.holdSeconds, ctx.targetHoldSeconds),
      };
    }
    case 'rhythm': {
      const r = rhythmMetric(ctx);
      return { key, score: r.score, message: fb.rhythmMessage(r.score) };
    }
    case 'symmetry': {
      const r = symmetryMetric(ctx);
      return { key, score: r.score, message: fb.symmetryMessage(r.score) };
    }
    default:
      return { key, score: 0, message: label };
  }
}
