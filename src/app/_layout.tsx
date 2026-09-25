import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNav } from '../components/BottomNav';
import { AuthProvider } from '../context/AuthContext';
import { colors } from '../theme';

export default function Layout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        <BottomNav />
      </SafeAreaProvider>
    </AuthProvider>
  );
}