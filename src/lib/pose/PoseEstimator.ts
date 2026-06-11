import { MotionFrame } from '@/types/motion';

export interface PoseEstimationOptions {
  /** Target sampling rate for extracted frames. */
  fps?: number;
  /** Progress callback, 0..1, for UI. */
  onProgress?: (fraction: number) => void;
  /**
   * DEV-ONLY hint: the skill being practiced. A real on-device detector ignores
   * this (it reads pixels). The mock estimator uses it to synthesize a realistic
   * "learner attempt" derived from the coach reference, so the end-to-end demo
   * produces meaningful scores instead of noise.
   */
  skillHint?: string;
}

export interface PoseEstimationResult {
  frames: MotionFrame[];
  fps: number;
  /** Seconds. */
  duration: number;
}

/**
 * The engine only ever talks to this interface. Today it's backed by a mock
 * (MockPoseEstimator). To ship real on-device analysis, implement this with
 * MediaPipe Pose Landmarker in a dev build — see ./mediapipe.ts — and swap the
 * export in ./index.ts. Nothing downstream changes.
 *
 * Contract: implementations MUST process frames locally and MUST NOT upload or
 * persist the raw video. They return normalized skeleton frames only.
 */
export interface PoseEstimator {
  readonly id: string;
  /**
   * Extract skeleton frames from a locally recorded video file.
   * @param videoUri local file:// uri produced by the camera.
   */
  estimateFromVideo(
    videoUri: string,
    options?: PoseEstimationOptions
  ): Promise<PoseEstimationResult>;
}
