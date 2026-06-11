import { scoreSession } from '@/lib/scoring/ScoringEngine';
import { getReferenceMotion } from '@/data/referenceMotions';
import { ALL_JOINTS, Joint, MotionFrame } from '@/types/motion';

function clone(frames: MotionFrame[]): MotionFrame[] {
  return frames.map((f) => ({
    timestamp: f.timestamp,
    joints: Object.fromEntries(
      ALL_JOINTS.map((j) => [j, { ...f.joints[j] }])
    ) as MotionFrame['joints'],
  }));
}

describe('scoreSession', () => {
  it('returns null for an unknown skill', () => {
    expect(scoreSession('does-not-exist', [], 15)).toBeNull();
  });

  it('scores a perfect copy of the reference highly', () => {
    const ref = getReferenceMotion('ref-sixstep')!;
    const score = scoreSession('six-step', clone(ref), 15);
    expect(score).not.toBeNull();
    expect(score!.overall).toBeGreaterThan(85);
    expect(score!.metrics.length).toBeGreaterThan(0);
  });

  it('penalizes raised hips on hipHeight relative to a clean copy', () => {
    const ref = getReferenceMotion('ref-sixstep')!;
    const baseline = scoreSession('six-step', clone(ref), 15)!;

    // Raise the whole skeleton's legs so the dancer is far less grounded:
    // move ankles/knees UP toward the hips (less bent legs => hips "too high").
    const raised = clone(ref);
    for (const f of raised) {
      for (const j of [Joint.LeftAnkle, Joint.RightAnkle, Joint.LeftKnee, Joint.RightKnee]) {
        f.joints[j].y += 0.6;
      }
    }
    const got = scoreSession('six-step', raised, 15)!;

    const baseHip = baseline.metrics.find((m) => m.key === 'hipHeight')!;
    const raisedHip = got.metrics.find((m) => m.key === 'hipHeight')!;
    expect(raisedHip.score).toBeLessThan(baseHip.score);
  });

  it('flags a short freeze hold below the target', () => {
    const ref = getReferenceMotion('ref-babyfreeze')!;
    // Inject wobble into the back half so it never settles into a hold. We
    // perturb non-hip joints only: a uniform shift of every joint would be
    // cancelled by normalization (translation-invariant by design), so the
    // wobble has to be differential to register as instability.
    const wobbly = clone(ref);
    const shakyJoints = [Joint.Nose, Joint.LeftKnee, Joint.RightKnee, Joint.LeftAnkle, Joint.RightAnkle];
    for (let i = Math.floor(wobbly.length * 0.4); i < wobbly.length; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      for (const j of shakyJoints) {
        wobbly[i].joints[j].x += sign * 0.18;
        wobbly[i].joints[j].y += sign * 0.18;
      }
    }
    const clean = scoreSession('baby-freeze', clone(ref), 15)!;
    const shaky = scoreSession('baby-freeze', wobbly, 15)!;
    const cleanFreeze = clean.metrics.find((m) => m.key === 'freezeStability')!;
    const shakyFreeze = shaky.metrics.find((m) => m.key === 'freezeStability')!;
    expect(shakyFreeze.score).toBeLessThan(cleanFreeze.score);
  });
});
