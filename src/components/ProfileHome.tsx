import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { AuthUser } from '../api/auth';
import { BookingRecord, getMyBookings, getMyMembership } from '../api/account';
import { PrimaryButton } from './PrimaryButton';
import { colors, radii, spacing } from '../theme';

type ProfileHomeProps = {
    user: AuthUser;
};

export function ProfileHome({ user }: ProfileHomeProps) {
    const [bookings, setBookings] = useState<BookingRecord[]>([]);
    const [membership, setMembership] = useState<Awaited<ReturnType<typeof getMyMembership>>>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useFocusEffect(useCallback(() => {
        if (!user.id) return;
        let cancelled = false;
        setIsLoading(true);
        setError('');
        Promise.all([getMyBookings(), getMyMembership()])
            .then(([nextBookings, nextMembership]) => {
                if (!cancelled) {
                    setBookings(nextBookings);
                    setMembership(nextMembership);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Unable to refresh your account. Please try again.');
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user.id]));

    const firstName = user.display_name.trim().split(/\s+/)[0] || 'Golfer';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const upcomingBooking = bookings[0];
    const membershipName = membership?.package_name || 'Founding Member';
    const membershipStatus = membership?.status || 'Your membership is ready when you are.';

    return (
        <View style={styles.container}>
            <View style={styles.greetingBlock}>
                <Text style={styles.greeting}>{greeting}, {firstName} <Text style={styles.wave}>👋</Text></Text>
                <Text style={styles.ready}>Ready to play?</Text>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.emptyText}>{error}</Text> : null}

            <Link href="/book" asChild>
                <PrimaryButton label="BOOK A BAY   →" />
            </Link>

            <View style={styles.panel}>
                <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Upcoming Reservation</Text>
                    <Link href="/reservations"><Text style={styles.panelLink}>View all</Text></Link>
                </View>
                {isLoading ? (
                    <ActivityIndicator color={colors.primary} />
                ) : upcomingBooking ? (
                    <View style={styles.reservationBody}>
                        <View style={styles.reservationIcon}><Text style={styles.reservationIconText}>⌁</Text></View>
                        <View style={styles.reservationCopy}>
                            <Text style={styles.reservationTitle}>{upcomingBooking.bay || 'Simulator bay'}</Text>
                            <Text style={styles.reservationMeta}>{upcomingBooking.date} · {upcomingBooking.time}</Text>
                            <Text style={styles.reservationMeta}>{upcomingBooking.players} players · {upcomingBooking.duration}h</Text>
                        </View>
                        <Link
                            href={{
                                pathname: '/reservation',
                                params: {
                                    bookingId: String(upcomingBooking.ID),
                                    bay: upcomingBooking.bay,
                                    date: upcomingBooking.date,
                                    time: upcomingBooking.time,
                                    duration: String(upcomingBooking.duration),
                                    players: String(upcomingBooking.players),
                                },
                            }}
                            asChild
                        >
                            <PrimaryButton label="VIEW DETAILS" />
                        </Link>
                    </View>
                ) : (
                    <Text style={styles.emptyText}>No upcoming reservations. Your next round starts here.</Text>
                )}
            </View>

            <View style={styles.panel}>
                <View style={styles.membershipRow}>
                    <View style={styles.membershipIcon}><Text style={styles.membershipIconText}>✦</Text></View>
                    <View style={styles.membershipCopy}>
                        <Text style={styles.membershipTitle}>{membershipName}</Text>
                        <Text style={styles.membershipMeta}>{membershipStatus}</Text>
                    </View>
                    <Link href="/membership"><Text style={styles.panelLink}>Manage membership</Text></Link>
                </View>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.lg },
    greetingBlock: { gap: 4, paddingTop: spacing.xs },
    greeting: { color: colors.heading, fontSize: 21, fontWeight: '800' },
    wave: { fontSize: 18 },
    ready: { color: colors.muted, fontSize: 16 },
    panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, padding: spacing.lg },
    panelHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between', marginBottom: spacing.sm },
    panelTitle: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    panelLink: { color: colors.primary, fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
    reservationBody: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    reservationIcon: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radii.sm, height: 54, justifyContent: 'center', width: 54 },
    reservationIconText: { color: colors.primary, fontSize: 30 },
    reservationCopy: { flex: 1, gap: 3 },
    reservationTitle: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    reservationMeta: { color: colors.muted, fontSize: 14 },
    emptyText: { color: colors.text, fontSize: 17, fontWeight: '500', lineHeight: 26 },
    membershipRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    membershipIcon: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
    membershipIconText: { color: colors.primary, fontSize: 18 },
    membershipCopy: { flex: 1, gap: 3 },
    membershipTitle: { color: colors.heading, fontSize: 14, fontWeight: '800' },
    membershipMeta: { color: colors.primary, fontSize: 14 },
});
