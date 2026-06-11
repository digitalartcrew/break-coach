import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotionSession } from '@/types/motion';
import { supabase } from '@/config/supabase';

/**
 * Local-first motion data store. Sessions are written to on-device storage by
 * default (honoring "video processed on device" / minimal data egress). When
 * Supabase is configured and the caller opts to sync, the anonymized session
 * is also upserted to the backend — never the raw video.
 */

const KEY = '@breakcoach/sessions';

async function readAll(): Promise<MotionSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MotionSession[];
  } catch {
    return [];
  }
}

async function writeAll(sessions: MotionSession[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sessions));
}

export async function saveSession(
  session: MotionSession,
  opts?: { sync?: boolean }
): Promise<void> {
  const all = await readAll();
  const next = [session, ...all.filter((s) => s.id !== session.id)];
  await writeAll(next);
  if (opts?.sync) await syncSession(session);
}

export async function listSessions(userId?: string): Promise<MotionSession[]> {
  const all = await readAll();
  const filtered = userId ? all.filter((s) => s.userId === userId) : all;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSession(id: string): Promise<MotionSession | null> {
  const all = await readAll();
  return all.find((s) => s.id === id) ?? null;
}

/** Privacy: user/parent can delete ALL motion data, locally and remotely. */
export async function deleteAllMotionData(userId: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((s) => s.userId !== userId));
  if (supabase) {
    await supabase.from('motion_frames').delete().eq('user_id', userId);
    await supabase.from('motion_sessions').delete().eq('user_id', userId);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((s) => s.id !== id));
  if (supabase) {
    await supabase.from('motion_frames').delete().eq('session_id', id);
    await supabase.from('motion_sessions').delete().eq('id', id);
  }
}

/** Push one anonymized session (+ frames) to Supabase. Never uploads video. */
async function syncSession(session: MotionSession): Promise<void> {
  if (!supabase) return;
  const { error: sErr } = await supabase.from('motion_sessions').upsert({
    id: session.id,
    user_id: session.userId,
    skill_id: session.skillId,
    created_at: session.createdAt,
    duration: session.duration,
    fps: session.fps,
    score: session.score,
    feedback_summary: session.feedbackSummary,
  });
  if (sErr) return;

  const rows = session.frames.map((f) => ({
    session_id: session.id,
    user_id: session.userId,
    timestamp: f.timestamp,
    joints: f.joints,
  }));
  await supabase.from('motion_frames').delete().eq('session_id', session.id);
  // chunk to stay within payload limits
  for (let i = 0; i < rows.length; i += 200) {
    await supabase.from('motion_frames').insert(rows.slice(i, i + 200));
  }
}
