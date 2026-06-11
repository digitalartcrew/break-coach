import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionSession } from '@/types/motion';
import { listSessions } from '@/lib/storage/motionStore';
import { getSkill } from '@/data/skills';
import { useAuth } from '@/state/auth';
import { Card, H1, H2, P, Pill, Row, Screen } from '@/components/ui';
import { ScoreBadge } from '@/components/Feedback';
import { colors, scoreColor, spacing } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProgressScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<MotionSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const list = await listSessions(profile?.id);
        if (active) setSessions(list);
      })();
      return () => {
        active = false;
      };
    }, [profile?.id])
  );

  const scored = sessions.filter((s) => s.score != null);
  const avg = scored.length
    ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length)
    : 0;

  // best score per skill
  const bestPerSkill = new Map<string, number>();
  for (const s of scored) {
    const cur = bestPerSkill.get(s.skillId) ?? 0;
    if ((s.score ?? 0) > cur) bestPerSkill.set(s.skillId, s.score ?? 0);
  }

  return (
    <Screen>
      <H1>Progress</H1>

      <Row style={{ gap: spacing(2) }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <P dim>Sessions</P>
          <H2>{sessions.length}</H2>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <P dim>Avg score</P>
          <H2>{avg}</H2>
        </Card>
      </Row>

      {bestPerSkill.size > 0 && (
        <>
          <H2>Personal bests</H2>
          {[...bestPerSkill.entries()].map(([skillId, best]) => (
            <Card key={skillId}>
              <Row style={{ justifyContent: 'space-between' }}>
                <P>{getSkill(skillId)?.name ?? skillId}</P>
                <Pill label={`${best}`} color={scoreColor(best)} />
              </Row>
            </Card>
          ))}
        </>
      )}

      <H2>History</H2>
      {sessions.length === 0 ? (
        <Card>
          <P dim>No sessions yet. Head to Learn and record your first move!</P>
        </Card>
      ) : (
        sessions.map((s) => (
          <Card key={s.id} onPress={() => nav.navigate('Result', { sessionId: s.id })}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing(1) }}>
                <P>{getSkill(s.skillId)?.name ?? s.skillId}</P>
                <P dim>{new Date(s.createdAt).toLocaleString()}</P>
                {s.feedbackSummary ? <P dim>{s.feedbackSummary}</P> : null}
              </View>
              {s.score != null && <ScoreBadge score={s.score} size={56} />}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
