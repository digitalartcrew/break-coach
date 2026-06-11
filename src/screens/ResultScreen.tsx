import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionSession, SessionScore } from '@/types/motion';
import { getSession } from '@/lib/storage/motionStore';
import { scoreSession } from '@/lib/scoring/ScoringEngine';
import { getModel, getSkill } from '@/data/skills';
import { getReferenceMotion } from '@/data/referenceMotions';
import { SkeletonReplay } from '@/components/SkeletonReplay';
import { MetricBar, ScoreBadge } from '@/components/Feedback';
import { Button, Card, H2, P, Row, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Result'>;

export function ResultScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [session, setSession] = useState<MotionSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setSession(await getSession(params.sessionId));
      setLoading(false);
    })();
  }, [params.sessionId]);

  const score: SessionScore | null = useMemo(() => {
    if (!session) return null;
    return scoreSession(session.skillId, session.frames, session.fps);
  }, [session]);

  const reference = useMemo(() => {
    if (!session) return undefined;
    const model = getModel(session.skillId);
    return model ? getReferenceMotion(model.referenceMotionId) ?? undefined : undefined;
  }, [session]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!session || !score) {
    return (
      <Screen>
        <P>Couldn’t load this session.</P>
      </Screen>
    );
  }

  const skill = getSkill(session.skillId);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <H2>{skill?.name ?? 'Session'}</H2>
          <P dim>{score.summary}</P>
        </View>
        <ScoreBadge score={score.overall} />
      </Row>

      <Card>
        <P dim>Your motion (purple) vs. coach reference (grey ghost)</P>
        <SkeletonReplay frames={session.frames} reference={reference} />
      </Card>

      <H2>Coaching</H2>
      <Card>
        {score.metrics.map((m) => (
          <MetricBar key={m.key} result={m} />
        ))}
      </Card>

      <Button title="Practice again" onPress={() => nav.replace('Record', { skillId: session.skillId })} />
      <Button title="Back to moves" variant="ghost" onPress={() => nav.navigate('Tabs', { screen: 'Learn' })} />
    </Screen>
  );
}
