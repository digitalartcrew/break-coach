import { MovementModel, Skill } from '@/types/motion';

/**
 * MVP content: breakdance skills. Adding a new discipline later means adding
 * rows here + reference motion data — the engine code does not change.
 */
export const SKILLS: Skill[] = [
  {
    id: 'toprock-basic',
    discipline: 'breakdance',
    name: 'Toprock Basic',
    category: 'toprock',
    difficulty: 'beginner',
    description:
      'The standing foundation. Rhythmic side-to-side steps with relaxed arm swing, on beat.',
    referenceMotionId: 'ref-toprock',
  },
  {
    id: 'backrock-basic',
    discipline: 'breakdance',
    name: 'Backrock Basics',
    category: 'toprock',
    difficulty: 'beginner',
    description: 'Rocking steps that travel backward while keeping balance and rhythm.',
    referenceMotionId: 'ref-backrock',
  },
  {
    id: 'six-step',
    discipline: 'breakdance',
    name: 'Six-Step',
    category: 'footwork',
    difficulty: 'intermediate',
    description:
      'The core footwork pattern: hands planted, hips low, legs circle the body in six counts.',
    referenceMotionId: 'ref-sixstep',
  },
  {
    id: 'ccs',
    discipline: 'breakdance',
    name: "CC's",
    category: 'footwork',
    difficulty: 'intermediate',
    description: 'Low cross-step footwork. Legs cross over each other with one hand for support.',
    referenceMotionId: 'ref-ccs',
  },
  {
    id: 'baby-freeze',
    discipline: 'breakdance',
    name: 'Baby Freeze',
    category: 'freeze',
    difficulty: 'beginner',
    description:
      'A balanced freeze: elbow planted into the core, head low, legs stacked. Hold it steady.',
    referenceMotionId: 'ref-babyfreeze',
  },
];

/**
 * Per-skill scoring configuration. Weights select which metrics matter for a
 * skill and how much; phases drive "during step N" feedback.
 */
export const MOVEMENT_MODELS: Record<string, MovementModel> = {
  'toprock-basic': {
    skillId: 'toprock-basic',
    referenceMotionId: 'ref-toprock',
    scoring: {
      weights: { timing: 0.3, rhythm: 0.3, footPlacement: 0.2, balance: 0.1, symmetry: 0.1 },
      phases: [
        { id: 'step-1', label: 'Step out', startFraction: 0 },
        { id: 'step-2', label: 'Return', startFraction: 0.5 },
      ],
    },
  },
  'backrock-basic': {
    skillId: 'backrock-basic',
    referenceMotionId: 'ref-backrock',
    scoring: {
      weights: { timing: 0.3, rhythm: 0.3, balance: 0.2, footPlacement: 0.2 },
    },
  },
  'six-step': {
    skillId: 'six-step',
    referenceMotionId: 'ref-sixstep',
    scoring: {
      weights: {
        footPlacement: 0.25,
        handPlacement: 0.2,
        hipHeight: 0.2,
        timing: 0.15,
        balance: 0.1,
        symmetry: 0.1,
      },
      phases: [
        { id: 'step-1', label: 'Step 1', startFraction: 0 },
        { id: 'step-2', label: 'Step 2', startFraction: 0.17 },
        { id: 'step-3', label: 'Step 3', startFraction: 0.34 },
        { id: 'step-4', label: 'Step 4', startFraction: 0.5 },
        { id: 'step-5', label: 'Step 5', startFraction: 0.67 },
        { id: 'step-6', label: 'Step 6', startFraction: 0.84 },
      ],
    },
  },
  ccs: {
    skillId: 'ccs',
    referenceMotionId: 'ref-ccs',
    scoring: {
      weights: { footPlacement: 0.3, hipHeight: 0.2, timing: 0.2, balance: 0.15, symmetry: 0.15 },
    },
  },
  'baby-freeze': {
    skillId: 'baby-freeze',
    referenceMotionId: 'ref-babyfreeze',
    scoring: {
      weights: { freezeStability: 0.4, balance: 0.25, handPlacement: 0.2, hipHeight: 0.15 },
      targetHoldSeconds: 3,
      phases: [
        { id: 'entry', label: 'Entry', startFraction: 0 },
        { id: 'hold', label: 'Hold', startFraction: 0.4 },
      ],
    },
  },
};

export function getSkill(skillId: string): Skill | undefined {
  return SKILLS.find((s) => s.id === skillId);
}

export function getModel(skillId: string): MovementModel | undefined {
  return MOVEMENT_MODELS[skillId];
}
