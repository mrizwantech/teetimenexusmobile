import { Pressable, Text } from 'react-native';

import { primaryButtonStyles as styles } from '../theme';

type Props = { label: string; onPress?: () => void; secondary?: boolean; disabled?: boolean };

export function PrimaryButton({ label, onPress, secondary = false, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  );
}
