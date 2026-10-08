import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { Link } from 'expo-router';

import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { usePush } from '../context/PushContext';
import { pushUnavailableReason } from '../notifications/push';
import { accountStyles as styles, colors } from '../theme';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { permission, token, notice, loading, error, refresh } = usePush();
  const [settingsError, setSettingsError] = useState('');
  const [showToken, setShowToken] = useState(false);

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
      <Text style={styles.title}>Notifications</Text>
      <SectionCard>
        <Text style={styles.cardTitle}>Stay connected</Text>
        <Text style={styles.body}>Enable notifications to receive Tee Time Nexus updates. You can change notification permissions in your device settings at any time.</Text>
        <Text style={styles.body}>Status: {loading ? 'Checking...' : permission.replace('-', ' ')}</Text>
        {notice ? <Text style={styles.body}>{notice}</Text> : null}
        {error || settingsError ? <Text style={styles.error}>{error || settingsError}</Text> : null}
        {permission === 'unsupported' ? <Text style={styles.body}>{pushUnavailableReason}</Text> : notice ? null : (
          <PrimaryButton
            label={loading ? 'PLEASE WAIT...' : permission === 'denied' ? 'OPEN DEVICE SETTINGS' : permission === 'authorized' || permission === 'provisional' ? 'REFRESH CONNECTION' : 'ENABLE NOTIFICATIONS'}
            disabled={loading}
            onPress={() => { if (permission === 'denied') void openSettings(); else void refresh(permission === 'not-determined'); }}
          />
        )}
        {permission !== 'unsupported' && permission !== 'denied' ? (
          <PrimaryButton secondary label="OPEN DEVICE SETTINGS" onPress={() => void openSettings()} />
        ) : null}
      </SectionCard>
      {token ? (
        <SectionCard>
          <Text style={styles.cardTitle}>Firebase test connection</Text>
          <Text style={styles.body}>Use this device token in Firebase Console Cloud Messaging under Send test message. Keep it private. It can change after reinstalling the app.</Text>
          <PrimaryButton secondary label={showToken ? 'HIDE TEST TOKEN' : 'SHOW TEST TOKEN'} onPress={() => setShowToken((value) => !value)} />
          {showToken ? <Text selectable style={styles.body}>{token}</Text> : null}
        </SectionCard>
      ) : null}
    </Screen>
  );
}
