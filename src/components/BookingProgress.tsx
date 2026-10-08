import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

const steps = ['Bay type', 'Bay', 'Date', 'Duration', 'Players', 'Start time', 'Review'];

type BookingProgressProps = {
    completed: boolean[];
    activeIndex: number;
    onStepPress: (index: number) => void;
};

export function BookingProgress({ completed, activeIndex, onStepPress }: BookingProgressProps) {
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ x: Math.max(0, (activeIndex - 1) * 80), animated: true });
    }, [activeIndex]);

    return (
        <ScrollView ref={scrollRef} horizontal accessibilityLabel="Booking progress" contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
                {steps.map((step, index) => (
                    <Pressable
                        key={step}
                        accessibilityLabel={`Go to ${step}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !completed[index] && index !== activeIndex, selected: index === activeIndex }}
                        disabled={!completed[index] && index !== activeIndex}
                        onPress={() => onStepPress(index)}
                        style={styles.step}
                    >
                        <View style={styles.track}>
                            <View style={[styles.line, index <= activeIndex && styles.activeLine, index === 0 && styles.hiddenLine]} />
                            <View style={[styles.circle, completed[index] && styles.completedCircle, index === activeIndex && styles.activeCircle]}>
                                <Text style={[styles.number, completed[index] && styles.completedNumber, index === activeIndex && styles.activeNumber]}>{index + 1}</Text>
                            </View>
                            <View style={[styles.line, index < activeIndex && styles.activeLine, index === steps.length - 1 && styles.hiddenLine]} />
                        </View>
                        <Text style={[styles.label, index === activeIndex && styles.activeLabel]}>{step}</Text>
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { flexGrow: 1 },
    container: { flex: 1, flexDirection: 'row', minWidth: 560, paddingVertical: spacing.xs },
    step: { flex: 1, alignItems: 'center', gap: spacing.xs },
    track: { alignItems: 'center', flexDirection: 'row', width: '100%', minHeight: 44 },
    line: { backgroundColor: colors.borderStrong, flex: 1, height: 1 },
    activeLine: { backgroundColor: colors.primary },
    hiddenLine: { opacity: 0 },
    circle: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, minHeight: 32, justifyContent: 'center', minWidth: 32, padding: spacing.xs },
    activeCircle: { backgroundColor: colors.primary, borderColor: colors.primary },
    completedCircle: { backgroundColor: colors.surfaceSoft, borderColor: colors.primary },
    number: { color: colors.muted, fontSize: 14, fontWeight: '800' },
    completedNumber: { color: colors.primary },
    activeNumber: { color: colors.bg },
    label: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: spacing.xs },
    activeLabel: { color: colors.heading, fontWeight: '800' },
});
