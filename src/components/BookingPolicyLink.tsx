import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { bookingPolicyUrl } from '../navigation/menu';
import { colors, spacing } from '../theme';

export function BookingPolicyLink() {
  const [opening, setOpening] = useState(false);

  async function openPolicy() {
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(bookingPolicyUrl);
    } catch (error) {
      Alert.alert('Unable to open policy', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable accessibilityRole="link" disabled={opening} onPress={() => void openPolicy()} style={styles.link}>
      <Text style={styles.title}>{opening ? 'Opening...' : 'Booking, Cancellation & Refund Policy'}</Text>
      <Text style={styles.hint}>Opens the website booking page. Tap Terms and Conditions to read the full policy.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { gap: spacing.xs, minHeight: 48, paddingVertical: spacing.sm },
  title: { color: colors.primary, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
