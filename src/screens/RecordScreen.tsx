import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionSession } from '@/types/motion';
import { getSkill } from '@/data/skills';
import { poseEstimator } from '@/lib/pose';
import { enforceVideoRetention } from '@/lib/storage/privacy';
import { saveSession } from '@/lib/storage/motionStore';
import { scoreSession } from '@/lib/scoring/ScoringEngine';
import { useAuth } from '@/state/auth';
import { uid } from '@/lib/id';
import { Button, Card, H2, P, Screen } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Record'>;

const MAX_SECONDS = 6;

export function RecordScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const skill = getSkill(params.skillId);
  const { profile, cloudEnabled } = useAuth();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!skill) {
    return (
      <Screen>
        <P>Unknown move.</P>
      </Screen>
    );
  }

  async function processVideo(videoUri: string) {
    if (!profile) return;
    setPhase('processing');
    setProgress(0);
    setError(null);
    try {
      // 1) On-device pose extraction
      const result = await poseEstimator.estimateFromVideo(videoUri, {
        fps: 15,
        skillHint: skill!.id,
        onProgress: setProgress,
      });
      // 2) Privacy: delete raw video unless explicitly retained
      await enforceVideoRetention(profile, videoUri);
      // 3) Score against coach reference
      const score = scoreSession(skill!.id, result.frames, result.fps);
      // 4) Persist anonymized motion only
      const id = uid('session');
      const session: MotionSession = {
        id,
        userId: profile.id,
        skillId: skill!.id,
        createdAt: new Date().toISOString(),
        duration: result.duration,
        fps: result.fps,
        score: score?.overall ?? null,
        feedbackSummary: score?.summary ?? null,
        frames: result.frames,
      };
      await saveSession(session, { sync: cloudEnabled });
      // 5) Show results
      nav.replace('Result', { sessionId: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong analyzing the clip.');
      setPhase('idle');
    }
  }

  async function startRecording() {
    if (!cameraRef.current) return;
    setPhase('recording');
    setError(null);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_SECONDS });
      if (video?.uri) await processVideo(video.uri);
      else setPhase('idle');
    } catch {
      setError('Recording failed. You can use “Simulate a clip” to try the analysis.');
      setPhase('idle');
    }
  }

  function stopRecording() {
    cameraRef.current?.stopRecording();
  }

  // Works in simulators / when no camera is available: runs the exact same
  // pipeline on a synthetic clip so the demo is always functional.
  function simulate() {
    void processVideo(`simulated://${skill!.id}/${uid('clip')}`);
  }

  if (phase === 'processing') {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <H2>Analyzing on device…</H2>
          <P dim>Extracting your skeleton, then deleting the video.</P>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <P dim>{Math.round(progress * 100)}%</P>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <H2>{skill.name}</H2>
      <P dim>{skill.description}</P>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mode="video" />
        ) : (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🎥</Text>
            <P dim>Camera access lets you record a short clip.</P>
            <Button title="Enable camera" onPress={requestPermission} />
          </View>
        )}
        {phase === 'recording' && (
          <View style={styles.recBadge}>
            <Text style={styles.recText}>● REC</Text>
          </View>
        )}
      </View>

      <Card>
        <P dim>
          🔒 Your video is processed on this device and deleted after analysis. Only an anonymous
          stick-figure of your motion is saved.
        </P>
      </Card>

      {error && <P>{error}</P>}

      {permission?.granted &&
        (phase === 'recording' ? (
          <Button title="Stop" variant="danger" onPress={stopRecording} />
        ) : (
          <Button title={`Record (max ${MAX_SECONDS}s)`} onPress={startRecording} />
        ))}
      <Button title="Simulate a clip (no camera)" variant="ghost" onPress={simulate} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    flex: 1,
    minHeight: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginVertical: spacing(1),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(1.5), padding: spacing(2) },
  recBadge: {
    position: 'absolute',
    top: spacing(1.5),
    left: spacing(1.5),
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    borderRadius: radius.sm,
  },
  recText: { color: colors.work, fontWeight: '800' },
  track: {
    width: '80%',
    height: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: { height: 10, backgroundColor: colors.primary },
});
