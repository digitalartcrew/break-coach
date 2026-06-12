import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { useAuth } from '@/state/auth';
import { Button, Card, H1, H2, P, Pill, Row, Screen } from '@/components/ui';
import { canRetainRawVideo } from '@/lib/storage/privacy';
import { colors, spacing } from '@/theme';

const ROLE_LABEL: Record<string, string> = {
  child: 'Youth',
  parent: 'Parent / Guardian',
  coach: 'Coach',
  adult: 'Adult',
};
const AGE_LABEL: Record<string, string> = {
  under13: 'Under 13',
  teen: 'Teen (13–17)',
  adult: 'Adult',
};

export function SettingsScreen() {
  const { profile, cloudEnabled, setRawVideoStorage, deleteMyData, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const isMinor = profile.ageGroup !== 'adult';
  // A minor can only retain video if a guardian has granted consent.
  const canToggleRawVideo = !isMinor || profile.consentStatus === 'granted';

  const onToggleRaw = async (v: boolean) => {
    if (v && isMinor) {
      Alert.alert(
        'Guardian setting',
        'Storing raw video for a minor requires explicit guardian approval and is off by default. Only enable this if you are the guardian and understand the privacy tradeoff.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => setRawVideoStorage(true) },
        ]
      );
      return;
    }
    await setRawVideoStorage(v);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete all motion data?',
      'This permanently removes every saved session and motion frame for this account, on this device and in the cloud. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await deleteMyData();
            setBusy(false);
            Alert.alert('Done', 'All motion data has been deleted.');
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <H1>Settings</H1>

      <Card>
        <H2>Account</H2>
        <Row style={{ justifyContent: 'space-between' }}>
          <P dim>Role</P>
          <Pill label={ROLE_LABEL[profile.role] ?? profile.role} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <P dim>Age group</P>
          <Pill label={AGE_LABEL[profile.ageGroup] ?? profile.ageGroup} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <P dim>Consent</P>
          <Pill
            label={profile.consentStatus.replace('_', ' ')}
            color={profile.consentStatus === 'granted' ? colors.good : colors.textDim}
          />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <P dim>Cloud sync</P>
          <Pill
            label={cloudEnabled ? 'on' : 'local only'}
            color={cloudEnabled ? colors.good : colors.textDim}
          />
        </Row>
      </Card>

      <Card>
        <H2>Privacy</H2>
        <P dim>
          Video is processed on-device and deleted after analysis. Only anonymized motion data is
          stored.
        </P>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: spacing(1) }}>
            <P>Store raw video</P>
            <P dim>Off by default. {isMinor ? 'Guardian-only for minors.' : ''}</P>
          </View>
          <Switch
            value={profile.allowRawVideoStorage}
            onValueChange={onToggleRaw}
            disabled={!canToggleRawVideo}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
          />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <P dim>Currently retaining video?</P>
          <Pill
            label={canRetainRawVideo(profile) ? 'Yes' : 'No'}
            color={canRetainRawVideo(profile) ? colors.work : colors.good}
          />
        </Row>
        {isMinor && (
          <P dim>🔒 Public sharing and adult leaderboards are disabled for minors.</P>
        )}
      </Card>

      <Card>
        <H2>Your data</H2>
        <P dim>You can delete all of your motion data at any time.</P>
        <Button title="Delete all my motion data" variant="danger" onPress={confirmDelete} loading={busy} />
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
