import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing } from '../theme';

type Props = { label: string; onPress?: () => void; secondary?: boolean };

export function PrimaryButton({ label, onPress, secondary = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondary: { backgroundColor: 'transparent', borderColor: colors.borderStrong, borderWidth: 1 },
  pressed: { opacity: 0.72 },
  label: { color: colors.primaryContrast, fontSize: 15, fontWeight: '800' },
  secondaryLabel: { color: colors.heading },
});