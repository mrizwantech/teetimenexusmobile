import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function BrandMark() {
  return (
    <View style={styles.container}>
      <Text style={styles.top}>TEE TIME</Text>
      <Text style={styles.bottom}>NEXUS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 1 },
  top: {
    color: colors.heading,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  bottom: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
});