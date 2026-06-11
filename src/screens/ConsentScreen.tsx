import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/state/auth';
import { Button, Card, H1, H2, P, Screen } from '@/components/ui';

/**
 * Parental consent gate for users under 13 (COPPA-style). Recording is blocked
 * until a guardian grants consent. In production this should be a verifiable
 * parental consent flow (e.g. email/charge verification, separate parent login)
 * — this screen is the placeholder for that step.
 */
export function ConsentScreen() {
  const { grantGuardianConsent, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    Alert.alert(
      'Parent / Guardian Consent',
      'By continuing you confirm you are the parent or legal guardian and consent to your child using BreakCoach. Video is processed on-device and deleted; only anonymized motion data is stored. You can delete all data at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I consent',
          onPress: async () => {
            setBusy(true);
            await grantGuardianConsent();
            setBusy(false);
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <H1>A grown-up first 👋</H1>
      <Card>
        <H2>Parent / guardian needed</H2>
        <P>
          Because this account is for a child under 13, a parent or guardian must give consent
          before recording.
        </P>
        <P dim>What we do to protect your child:</P>
        <P dim>• Video is analyzed on the device and deleted right away.</P>
        <P dim>• We only store an anonymous stick-figure of the movement.</P>
        <P dim>• No public sharing for minors.</P>
        <P dim>• You can delete all data anytime.</P>
      </Card>
      <Button title="I’m the parent / guardian — I consent" onPress={confirm} loading={busy} />
      <Button title="Not now" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
