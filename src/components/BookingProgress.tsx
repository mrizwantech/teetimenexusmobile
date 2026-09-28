import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

const steps = ['Bay type', 'Bay', 'Date', 'Duration', 'Players', 'Start time', 'Verify'];

type BookingProgressProps = {
    completed: boolean[];
    activeIndex: number;
    onStepPress: (index: number) => void;
};

export function BookingProgress({ completed, activeIndex, onStepPress }: BookingProgressProps) {
    return (
        <View accessibilityLabel="Booking progress" style={styles.container}>
            <View style={styles.track}>
                {steps.map((step, index) => (
                    <View key={step} style={styles.stepWrap}>
                        <View style={[styles.line, index > 0 && index <= activeIndex && styles.activeLine]} />
                        <Pressable
                            accessibilityLabel={`Go to ${step}`}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !completed[index] && index !== activeIndex, selected: index === activeIndex }}
                            disabled={!completed[index] && index !== activeIndex}
                            onPress={() => onStepPress(index)}
                            style={[styles.circle, completed[index] && styles.completedCircle, index === activeIndex && styles.activeCircle]}
                        >
                            <Text style={[styles.number, completed[index] && styles.completedNumber]}>{index + 1}</Text>
                        </Pressable>
                    </View>
                ))}
            </View>
            <View style={styles.labels}>
                {steps.map((step, index) => (
                    <Text key={step} numberOfLines={1} style={[styles.label, index === activeIndex && styles.activeLabel]}>{step}</Text>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xs, paddingVertical: spacing.xs },
    track: { alignItems: 'center', flexDirection: 'row' },
    stepWrap: { alignItems: 'center', flex: 1, flexDirection: 'row' },
    line: { backgroundColor: colors.borderStrong, flex: 1, height: 1 },
    activeLine: { backgroundColor: colors.primary },
    circle: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: 12, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
    activeCircle: { backgroundColor: colors.primary, borderColor: colors.primary },
    completedCircle: { backgroundColor: colors.surfaceSoft, borderColor: colors.primary },
    number: { color: colors.muted, fontSize: 11, fontWeight: '800' },
    completedNumber: { color: colors.primary },
    labels: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { color: colors.muted, flex: 1, fontSize: 8, textAlign: 'center' },
    activeLabel: { color: colors.heading, fontWeight: '800' },
});
