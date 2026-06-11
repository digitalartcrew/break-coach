import {
  PoseEstimationOptions,
  PoseEstimationResult,
  PoseEstimator,
} from './PoseEstimator';

/**
 * MediaPipe Pose Landmarker adapter — STUB.
 *
 * This is the real on-device path. It is intentionally not active in the
 * managed-Expo scaffold because MediaPipe needs native code and therefore an
 * Expo *dev build* (it will not run in Expo Go).
 *
 * To enable it:
 *   1. Create a dev build:  npx expo prebuild  &&  npx expo run:ios|android
 *   2. Add a pose frame-processor. The common stack is:
 *        - react-native-vision-camera        (camera + frame processors)
 *        - a MediaPipe Tasks Vision plugin    (e.g. a VisionCamera frame
 *          processor wrapping the MediaPipe PoseLandmarker .task model)
 *      or call MediaPipe per-extracted-frame via a small native module.
 *   3. Map MediaPipe's 33 landmarks -> our canonical Joint set with the table
 *      below, then run normalizePose() on each frame.
 *   4. Process locally and NEVER upload the frames or the video. Delete the
 *      video file as soon as extraction finishes (see storage/privacy.ts).
 *   5. Swap the active estimator in ./index.ts to `new MediaPipePoseEstimator()`.
 *
 * MediaPipe Pose landmark indices we consume:
 *   0  nose
 *   11 left_shoulder    12 right_shoulder
 *   13 left_elbow       14 right_elbow
 *   15 left_wrist       16 right_wrist
 *   23 left_hip         24 right_hip
 *   25 left_knee        26 right_knee
 *   27 left_ankle       28 right_ankle
 * Use the world-landmark output (metric, origin at hip center) for x/y/z and
 * the `visibility`/`presence` score for confidence.
 */
export const MEDIAPIPE_INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export class MediaPipePoseEstimator implements PoseEstimator {
  readonly id = 'mediapipe';

  async estimateFromVideo(
    _videoUri: string,
    _options?: PoseEstimationOptions
  ): Promise<PoseEstimationResult> {
    throw new Error(
      'MediaPipePoseEstimator is not wired up. Create a dev build and follow ' +
        'the steps in src/lib/pose/mediapipe.ts, then enable it in index.ts.'
    );
  }
}
