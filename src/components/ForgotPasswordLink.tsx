import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { getPasswordResetUrl } from '../navigation/password-reset';
import { colors, spacing } from '../theme';

export function ForgotPasswordLink() {
  const [opening, setOpening] = useState(false);

  async function openPasswordReset() {
    setOpening(true);
    try {
      const url = getPasswordResetUrl(process.env.EXPO_PUBLIC_API_URL ?? 'https://teetimenexus.com');
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      Alert.alert('Unable to open password reset', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Forgot password?" accessibilityState={{ disabled: opening }} disabled={opening} onPress={() => void openPasswordReset()} style={styles.link}>
      <Text style={styles.title}>{opening ? 'Opening...' : 'Forgot password?'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: spacing.sm },
  title: { color: colors.primary, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
});
