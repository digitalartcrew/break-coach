import { MockPoseEstimator } from './MockPoseEstimator';
import { PoseEstimator } from './PoseEstimator';
// import { MediaPipePoseEstimator } from './mediapipe';

export * from './PoseEstimator';

/**
 * The single active pose estimator for the app. To ship real on-device
 * analysis, build a dev client and switch this to MediaPipePoseEstimator
 * (see ./mediapipe.ts). Everything else in the app is unaffected.
 */
export const poseEstimator: PoseEstimator = new MockPoseEstimator();
// export const poseEstimator: PoseEstimator = new MediaPipePoseEstimator();
