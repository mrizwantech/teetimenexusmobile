import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

type BayTypeCardProps = {
    label: string;
    image: string;
    selected: boolean;
    onPress: () => void;
};

export function BayTypeCard({ label, image, selected, onPress }: BayTypeCardProps) {
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.card, selected && styles.selectedCard]}>
            <ImageBackground source={{ uri: image }} imageStyle={styles.image} style={styles.imageFrame}>
                <View style={styles.check}><Text style={styles.checkText}>{selected ? '✓' : ''}</Text></View>
            </ImageBackground>
            <Text style={styles.label}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, flex: 1, overflow: 'hidden' },
    selectedCard: { borderColor: colors.primary, borderWidth: 2 },
    imageFrame: { height: 120, justifyContent: 'flex-end' },
    image: { borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md },
    check: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong, borderRadius: 10, borderWidth: 1, height: 20, justifyContent: 'center', margin: spacing.xs, width: 20 },
    checkText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
    label: { color: colors.heading, fontSize: 14, fontWeight: '800', padding: spacing.sm },
});
