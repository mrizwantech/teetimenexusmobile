import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCalendarEvent, getGoogleCalendarUrl } from '../api/calendar-rules';
import { colors, radii, spacing } from '../theme';

type CalendarCardProps = {
    bay: string;
    date: string;
    time: string;
    duration: number;
    players: number;
};

export function CalendarCard({ bay, date, time, duration, players }: CalendarCardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.title}>Add to Calendar</Text>
            <Text style={styles.subtitle}>{bay} · {date} at {time}</Text>
            <View style={styles.actions}>
                {Platform.OS === 'ios' ? (
                    <Pressable accessibilityRole="button" onPress={() => { void openAppleCalendar(bay, date, time, duration, players); }} style={styles.action}>
                        <Text style={styles.icon}>▣</Text>
                        <Text style={styles.actionText}>Apple Calendar</Text>
                    </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => { void openGoogleCalendar(bay, date, time, duration, players); }} style={styles.action}>
                    <Text style={styles.icon}>▣</Text>
                    <Text style={styles.actionText}>Google Calendar</Text>
                </Pressable>
            </View>
        </View>
    );
}

export async function openGoogleCalendar(bay: string, date: string, time: string, duration: number, players: number) {
    try {
        await Linking.openURL(getGoogleCalendarUrl(bay, date, time, duration, players));
    } catch (error) {
        Alert.alert('Unable to open Google Calendar', error instanceof Error ? error.message : 'Please try again.');
    }
}

export async function openAppleCalendar(bay: string, date: string, time: string, duration: number, players: number) {
    try {
        if (Platform.OS !== 'ios') throw new Error('Apple Calendar is available on iPhone and iPad. Please use Google Calendar.');
        const event = getCalendarEvent(bay, date, time, duration, players);
        const Calendar = await import('expo-calendar');
        const permission = await Calendar.requestCalendarPermissions(true);
        if (!permission.granted) {
            Alert.alert('Calendar permission needed', 'Allow Tee Time Nexus to add calendar events in device settings.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                    Linking.openSettings().catch(() => Alert.alert('Unable to open settings', 'Open your device Settings app to change calendar access.'));
                } },
            ]);
            return;
        }
        await Calendar.getDefaultCalendarSync().addEventWithForm(event);
    } catch (error) {
        Alert.alert('Unable to open Apple Calendar', error instanceof Error ? error.message : 'Please try again.');
    }
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
    title: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    subtitle: { color: colors.muted, fontSize: 14 },
    actions: { flexDirection: 'row', gap: spacing.sm },
    action: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    icon: { color: colors.primary, fontSize: 17 },
    actionText: { color: colors.text, flexShrink: 1, fontSize: 14, fontWeight: '700' },
});
