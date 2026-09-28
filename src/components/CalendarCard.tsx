import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

type CalendarCardProps = {
    bay: string;
    date: string;
    time: string;
    duration: number;
    players: number;
};

export function getCalendarStartDate(date: string, time: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
}

function formatGoogleDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function CalendarCard({ bay, date, time, duration, players }: CalendarCardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.title}>Add to Calendar</Text>
            <Text style={styles.subtitle}>{bay} · {date} at {time}</Text>
            <View style={styles.actions}>
                {Platform.OS === 'ios' ? (
                    <Pressable accessibilityRole="button" onPress={() => openAppleCalendar(date, time)} style={styles.action}>
                        <Text style={styles.icon}>▣</Text>
                        <Text style={styles.actionText}>Apple Calendar</Text>
                    </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => openGoogleCalendar(bay, date, time, duration, players)} style={styles.action}>
                    <Text style={styles.icon}>▣</Text>
                    <Text style={styles.actionText}>Google Calendar</Text>
                </Pressable>
            </View>
        </View>
    );
}

export function openGoogleCalendar(bay: string, date: string, time: string, duration: number, players: number) {
    const start = getCalendarStartDate(date, time);
    const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `Tee Time Nexus - ${bay}`,
        dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
        details: `${players} ${players === 1 ? 'player' : 'players'} · ${duration} hour${duration === 1 ? '' : 's'}`,
        location: 'Tee Time Nexus',
    });
    Linking.openURL(`https://calendar.google.com/calendar/render?${params.toString()}`);
}

export function openAppleCalendar(date: string, time: string) {
    Linking.openURL(`calshow:${getCalendarStartDate(date, time).getTime()}`);
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
    title: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    subtitle: { color: colors.muted, fontSize: 12 },
    actions: { flexDirection: 'row', gap: spacing.sm },
    action: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 42, paddingHorizontal: spacing.sm },
    icon: { color: colors.primary, fontSize: 17 },
    actionText: { color: colors.text, flexShrink: 1, fontSize: 11, fontWeight: '700' },
});
