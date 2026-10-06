import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { Bay } from '../api/booking';
import { colors, radii, spacing } from '../theme';

const bayImages = [
    'https://images.unsplash.com/photo-1592919505780-303950717480?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=900&q=85',
];

type BayCardProps = {
    bay: Bay;
    index: number;
    selected: boolean;
    onPress: () => void;
    fullWidth?: boolean;
};

export function BayCard({ bay, index, selected, onPress, fullWidth = false }: BayCardProps) {
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.card, fullWidth && styles.fullWidth, selected && styles.selectedCard]}>
            <ImageBackground source={{ uri: bay.thumbnail_url || bayImages[index % bayImages.length] }} imageStyle={styles.image} style={styles.imageFrame}>
                <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            </ImageBackground>
            <View style={styles.details}>
                <Text numberOfLines={1} style={styles.name}>{bay.name}</Text>
                <Text style={styles.location}>{bay.location}</Text>
                <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.status}>Available</Text>
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, flexBasis: '48%', flexGrow: 0, flexShrink: 0, overflow: 'hidden' },
    fullWidth: { alignSelf: 'stretch', flexBasis: '100%' },
    selectedCard: { borderColor: colors.primary, borderWidth: 2 },
    imageFrame: { height: 104, justifyContent: 'flex-start' },
    image: { borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md },
    number: { alignItems: 'center', backgroundColor: colors.heading, borderRadius: 10, height: 20, justifyContent: 'center', margin: spacing.xs, width: 20 },
    numberText: { color: colors.primaryContrast, fontSize: 11, fontWeight: '900' },
    details: { gap: 3, padding: spacing.sm },
    name: { color: colors.heading, fontSize: 15, fontWeight: '800' },
    location: { color: colors.muted, fontSize: 10 },
    statusRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2 },
    statusDot: { backgroundColor: colors.primary, borderRadius: 4, height: 7, width: 7 },
    status: { color: colors.primary, fontSize: 10, fontWeight: '800' },
});
