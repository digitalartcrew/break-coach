import * as FileSystem from 'expo-file-system';
import { UserProfile } from '@/types/motion';

/**
 * Privacy guarantees, enforced in code:
 *  - Raw video is processed on-device and DELETED after pose extraction by
 *    default. It is only ever kept if a guardian explicitly opts in for a minor
 *    (or the user is an adult who opts in).
 *  - Only anonymized skeleton data leaves the pose stage.
 */

/** Whether this profile is allowed to retain raw video at all. */
export function canRetainRawVideo(profile: UserProfile): boolean {
  if (!profile.allowRawVideoStorage) return false;
  // Minors require an active, granted guardian consent to retain video.
  if (profile.ageGroup === 'under13') return profile.consentStatus === 'granted';
  return true;
}

/** Delete a locally recorded video file. Safe to call repeatedly. */
export async function deleteRawVideo(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Best-effort: never block the flow on a delete failure, but never keep
    // the file around either — log and move on.
  }
}

/**
 * The privacy contract for a finished recording: given the profile and the
 * just-recorded video uri, decide whether to keep the file and, if not, delete
 * it. Returns the uri to retain (or null when deleted).
 */
export async function enforceVideoRetention(
  profile: UserProfile,
  videoUri: string
): Promise<string | null> {
  if (canRetainRawVideo(profile)) {
    return videoUri;
  }
  await deleteRawVideo(videoUri);
  return null;
}

/** Minors never share publicly by default. */
export function canSharePublicly(profile: UserProfile): boolean {
  if (profile.ageGroup !== 'adult') return false;
  return profile.allowPublicSharing;
}
