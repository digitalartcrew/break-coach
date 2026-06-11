import { MetricKey, MovementModel } from '@/types/motion';

/**
 * Turns raw metric measurements into the short, encouraging, specific coaching
 * lines from the spec ("Your hips are too high during step 3.").
 */

/** Map a 0..1 position in the clip to a human phase label, e.g. "step 3". */
export function phaseAt(model: MovementModel | undefined, frac: number): string | null {
  const phases = model?.scoring.phases;
  if (!phases || phases.length === 0) return null;
  let current = phases[0];
  for (const p of phases) {
    if (frac >= p.startFraction) current = p;
  }
  return current.label;
}

function grade(score: number): 'good' | 'ok' | 'work' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  return 'work';
}

export function timingMessage(score: number, lagFrames: number): string {
  if (grade(score) === 'good') return 'Your timing locks in with the count nicely.';
  const dir = lagFrames > 0 ? 'a beat behind' : 'a beat ahead of';
  return `Your timing is ${dir} the reference. Count it out loud as you move.`;
}

export function balanceMessage(score: number): string {
  if (grade(score) === 'good') return 'Great balance — your weight stays centered.';
  if (grade(score) === 'ok') return 'Balance is decent; keep your weight stacked over your base.';
  return 'You drift off balance. Keep your center of mass over your hands and feet.';
}

export function footPlacementMessage(
  score: number,
  model: MovementModel | undefined,
  worstFrac: number
): string {
  if (grade(score) === 'good') return 'Foot placement matches the reference well.';
  const phase = phaseAt(model, worstFrac);
  const where = phase ? ` during ${phase.toLowerCase()}` : '';
  return `Your foot placement drifts${where}. Watch where each foot lands.`;
}

export function handPlacementMessage(
  score: number,
  model: MovementModel | undefined,
  worstFrac: number
): string {
  if (grade(score) === 'good') return 'Hands plant right where they should.';
  const phase = phaseAt(model, worstFrac);
  const where = phase ? ` during ${phase.toLowerCase()}` : '';
  return `Your right hand plants late${where}. Set it down sooner to support your weight.`;
}

export function hipHeightMessage(
  score: number,
  model: MovementModel | undefined,
  meanDelta: number,
  worstFrac: number
): string {
  if (grade(score) === 'good') return 'Hip height is on point.';
  const phase = phaseAt(model, worstFrac);
  const where = phase ? ` during ${phase.toLowerCase()}` : '';
  const dir = meanDelta > 0 ? 'too high' : 'too low';
  return `Your hips are ${dir}${where}. ${
    meanDelta > 0 ? 'Sink lower to stay grounded.' : 'Lift slightly to keep mobility.'
  }`;
}

export function freezeStabilityMessage(
  score: number,
  holdSeconds: number,
  targetHold: number | undefined
): string {
  const target = targetHold ?? 3;
  if (holdSeconds >= target * 0.95) {
    return `Solid freeze — you held for ${holdSeconds}s.`;
  }
  return `Your freeze held for ${holdSeconds}s. Try to reach ${target}s — engage your core and stop the wobble.`;
}

export function rhythmMessage(score: number): string {
  if (grade(score) === 'good') return 'Your rhythm is steady and consistent.';
  if (grade(score) === 'ok') return 'Your footwork timing is improving — keep it even.';
  return 'Your rhythm is uneven. Move to a steady beat and keep the spacing equal.';
}

export function symmetryMessage(score: number): string {
  if (grade(score) === 'good') return 'Nicely balanced left-to-right.';
  return 'One side leads the other. Practice the mirrored version to even it out.';
}

/** Build the one-line session summary from the metric results. */
export function buildSummary(
  overall: number,
  ranked: Array<{ key: MetricKey; score: number; message: string }>
): string {
  const lowest = ranked[ranked.length - 1];
  const best = ranked[0];
  if (overall >= 85) {
    return `Excellent rep — ${labelFor(best.key)} especially. Keep it up!`;
  }
  if (overall >= 65) {
    return `Good work. Biggest win: ${labelFor(best.key)}. Focus next on ${labelFor(lowest.key)}.`;
  }
  return `Keep practicing. Start by working on your ${labelFor(lowest.key)}.`;
}

function labelFor(key: MetricKey): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase();
}
