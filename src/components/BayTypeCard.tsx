import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing } from '../theme';

type BayTypeCardProps = {
    label: string;
    description: string;
    selected: boolean;
    onPress: () => void;
};

export function BayTypeCard({ label, description, selected, onPress }: BayTypeCardProps) {
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${description}`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.card, selected && styles.selectedCard, pressed && styles.pressed]}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.description}>{description}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, flex: 1, minHeight: 116, padding: spacing.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    selectedCard: { backgroundColor: colors.surfaceStrong },
    pressed: { backgroundColor: colors.surfaceSoft },
    label: { color: colors.primary, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
    description: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
