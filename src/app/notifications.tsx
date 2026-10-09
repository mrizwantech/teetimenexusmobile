import { useEffect, useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { getPushPreferences, PushPreferences, setPushPreferences } from '../api/push';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { usePush } from '../context/PushContext';
import { pushUnavailableReason } from '../notifications/push';
import { accountStyles as styles, colors, spacing } from '../theme';

const preferenceOptions: { key: keyof PushPreferences; label: string; description: string }[] = [
  { key: 'booking_updates', label: 'Booking updates', description: 'Confirmations, changes and cancellations.' },
  { key: 'booking_reminders', label: 'Booking reminders', description: 'A reminder 15 minutes before your bay time.' },
  { key: 'marketing', label: 'Offers and news', description: 'Promotions and club news. Off unless you turn it on.' },
];

function NotificationPreferences() {
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [saving, setSaving] = useState<keyof PushPreferences | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPushPreferences()
      .then((next) => { if (!cancelled) { setPreferences(next); setError(''); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load notification preferences.'); });
    return () => { cancelled = true; };
  }, [attempt]);

  async function toggle(key: keyof PushPreferences, value: boolean) {
    if (!preferences || saving) return;
    const previous = preferences;
    setPreferences({ ...previous, [key]: value });
    setSaving(key);
    setError('');
    try {
      setPreferences(await setPushPreferences({ [key]: value }));
    } catch (err) {
      setPreferences(previous);
      setError(err instanceof Error ? err.message : 'Unable to save notification preferences.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <SectionCard accent>
      <Text style={styles.cardTitle}>What to notify me about</Text>
      {preferences ? preferenceOptions.map((option, index) => (
        <View
          key={option.key}
          style={{
            alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.md,
            ...(index < preferenceOptions.length - 1 ? { borderBottomColor: colors.borderStrong, borderBottomWidth: 1 } : null),
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.bookingTitle}>{option.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 3 }}>{option.description}</Text>
          </View>
          <Switch
            accessibilityLabel={option.label}
            value={preferences[option.key]}
            disabled={saving !== null}
            onValueChange={(value) => void toggle(option.key, value)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )) : error ? null : <Text style={styles.body}>Loading preferences...</Text>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {error && !preferences ? <PrimaryButton secondary label="TRY AGAIN" onPress={() => setAttempt((value) => value + 1)} /> : null}
    </SectionCard>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { permission, token, notice, loading, error, registrationError, refresh } = usePush();
  const [settingsError, setSettingsError] = useState('');
  const enabled = permission === 'authorized' || permission === 'provisional';

  async function openSettings() {
    setSettingsError('');
    try {
      await Linking.openSettings();
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to open device settings.');
    }
  }

  return (
    <Screen>
      <ScreenHeader><BrandMark /><Link href={user ? '/settings' : '/account'}><Text style={{ color: colors.primary }}>{user ? 'Back to settings' : 'Back to account'}</Text></Link></ScreenHeader>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: 22, lineHeight: 28 }]}>Notifications</Text>
      {!loading && (!enabled || notice || error || settingsError || (user && token && registrationError)) ? (
        <SectionCard accent>
          {notice ? <Text style={styles.body}>{notice}</Text> : null}
          {error || settingsError ? <Text style={styles.error}>{error || settingsError}</Text> : null}
          {user && token && registrationError ? <Text style={styles.error}>Notifications are not linked to your account yet: {registrationError}</Text> : null}
          {permission === 'unsupported' ? <Text style={styles.body}>{pushUnavailableReason}</Text>
            : notice ? null
            : !enabled ? (
              // iOS/Android only show the permission prompt once; after a denial it must be changed in device settings.
              <PrimaryButton label="ENABLE NOTIFICATIONS" onPress={() => { if (permission === 'denied') void openSettings(); else void refresh(true); }} />
            )
            : <PrimaryButton label="TRY AGAIN" onPress={() => void refresh()} />}
        </SectionCard>
      ) : null}
      {user && Platform.OS !== 'web' ? <NotificationPreferences /> : null}
    </Screen>
  );
}
