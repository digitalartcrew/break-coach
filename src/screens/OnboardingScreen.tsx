import React from 'react';
import { AgeGroup, UserRole } from '@/types/motion';
import { useAuth } from '@/state/auth';
import { Button, Card, H1, H2, P, Screen } from '@/components/ui';
import { colors } from '@/theme';

const OPTIONS: Array<{
  key: string;
  label: string;
  sub: string;
  role: UserRole;
  ageGroup: AgeGroup;
}> = [
  { key: 'kid', label: 'I’m a kid (under 13)', sub: 'A grown-up will need to say it’s okay first', role: 'child', ageGroup: 'under13' },
  { key: 'teen', label: 'I’m a teen (13–17)', sub: 'Private by default', role: 'child', ageGroup: 'teen' },
  { key: 'adult', label: 'I’m an adult', sub: 'Full access', role: 'adult', ageGroup: 'adult' },
  { key: 'parent', label: 'I’m a parent / guardian', sub: 'Manage a child’s account & consent', role: 'parent', ageGroup: 'adult' },
  { key: 'coach', label: 'I’m a coach', sub: 'Provide reference moves & review', role: 'coach', ageGroup: 'adult' },
];

export function OnboardingScreen() {
  const { onboard } = useAuth();
  return (
    <Screen>
      <H1>BreakCoach</H1>
      <P dim>
        Learn breakdance with movement analysis. Your video is analyzed on your device and deleted —
        we only keep an anonymous stick-figure of your motion.
      </P>
      <H2>Who’s practicing?</H2>
      {OPTIONS.map((o) => (
        <Card key={o.key} onPress={() => onboard({ role: o.role, ageGroup: o.ageGroup })}>
          <P>{o.label}</P>
          <P dim>{o.sub}</P>
        </Card>
      ))}
      <P dim>You can change this anytime in Settings.</P>
    </Screen>
  );
}
