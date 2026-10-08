import { ActivityIndicator, Text } from 'react-native';
import { Link, Redirect } from 'expo-router';

import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors } from '../theme';

export default function SettingsScreen() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Screen><ActivityIndicator accessibilityLabel="Loading account" color={colors.primary} /></Screen>;
  }

  if (!user) {
    return <Redirect href="/account" />;
  }

  return (
    <Screen>
      <ScreenHeader>
        <BrandMark />
        <Link href="/account"><Text style={{ color: colors.primary }}>Back to profile</Text></Link>
      </ScreenHeader>
      <Text style={styles.title}>Settings</Text>
      <SectionCard>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.body}>Manage push notifications and this device&apos;s notification permissions.</Text>
        <Link href="/notifications" asChild><PrimaryButton label="MANAGE NOTIFICATIONS" /></Link>
      </SectionCard>
    </Screen>
  );
}
