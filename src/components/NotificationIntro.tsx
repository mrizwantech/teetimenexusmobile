import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { usePush } from '../context/PushContext';
import { accountStyles as styles, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function NotificationIntro() {
  const { showIntro, dismissIntro, refresh } = usePush();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  async function choose(enable: boolean) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (enable && !await refresh(true)) {
        throw new Error('Unable to enable notifications. Open notification settings to retry.');
      }
      await dismissIntro();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your notification choice. Please try again.');
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  if (!showIntro) return null;

  return (
    <SectionCard>
      <Text style={styles.cardTitle}>Stay in the loop</Text>
      <Text style={styles.body}>Allow Tee Time Nexus to send notifications about launch news and updates. Your phone will ask for permission next. You can change your choice anytime in Profile &gt; Notifications.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton label={busy ? 'PLEASE WAIT...' : 'ENABLE NOTIFICATIONS'} disabled={busy} onPress={() => { void choose(true); }} />
        <PrimaryButton label="NOT NOW" secondary disabled={busy} onPress={() => { void choose(false); }} />
      </View>
    </SectionCard>
  );
}
