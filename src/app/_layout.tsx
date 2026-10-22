import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNav } from '../components/BottomNav';
import { PasskeyAutoLogin } from '../components/PasskeyAutoLogin';
import { PasskeyEnrollmentPrompt } from '../components/PasskeyEnrollmentPrompt';
import { PublicContentRefresher } from '../components/PublicContentRefresher';
import { AuthProvider } from '../context/AuthContext';
import { BookingLeaveProvider } from '../context/BookingLeaveContext';
import { PushProvider } from '../context/PushContext';
import { colors } from '../theme';

export default function Layout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <BookingLeaveProvider>
        <PushProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          <BottomNav />
          <PasskeyAutoLogin />
          <PasskeyEnrollmentPrompt />
          <PublicContentRefresher />
        </PushProvider>
        </BookingLeaveProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}