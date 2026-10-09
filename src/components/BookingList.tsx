import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BookingRecord, getMyBookings } from '../api/account';
import { colors, radii, spacing } from '../theme';

const bayImages = [
    'https://images.unsplash.com/photo-1592919505780-303950717480?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=900&q=85',
];

type BookingListProps = {
    userId: number;
};

type BookingTab = 'upcoming' | 'past';

export function BookingList({ userId }: BookingListProps) {
    const [bookings, setBookings] = useState<BookingRecord[]>([]);
    const [tab, setTab] = useState<BookingTab>('upcoming');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        getMyBookings()
            .then((nextBookings) => {
                if (!cancelled) setBookings(nextBookings);
            })
            .catch(() => {
                if (!cancelled) setError('Unable to load your reservations.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId]);

    const visibleBookings = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return bookings.filter((booking) => tab === 'upcoming' ? booking.date >= today : booking.date < today);
    }, [bookings, tab]);

    return (
        <View style={styles.container}>
            <View style={styles.tabs}>
                <Tab label="Upcoming" active={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
                <Tab label="Past" active={tab === 'past'} onPress={() => setTab('past')} />
            </View>
            {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && !error && visibleBookings.length === 0 ? <Text style={styles.empty}>No {tab} reservations.</Text> : null}
            {visibleBookings.map((booking, index) => <BookingRow key={booking.ID} booking={booking} index={index} />)}
        </View>
    );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text></Pressable>;
}

function BookingRow({ booking, index }: { booking: BookingRecord; index: number }) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/reservation', params: { bookingId: String(booking.ID), bay: booking.bay, date: booking.date, time: booking.time, duration: String(booking.duration), players: String(booking.players), bayIndex: String(index) } })}
            style={styles.bookingCard}
        >
            <ImageBackground source={{ uri: bayImages[index % bayImages.length] }} imageStyle={styles.bookingImage} style={styles.imageFrame} />
            <View style={styles.copy}>
                <Text style={styles.bayName}>{booking.bay}</Text>
                <Text style={styles.meta}>{booking.date} · {booking.time}</Text>
                <Text style={styles.meta}>{booking.players} {booking.players === 1 ? 'Player' : 'Players'}</Text>
                <Text style={[styles.status, booking.status.toLowerCase() === 'cancelled' && styles.cancelled]}>{booking.status || 'Confirmed'}</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.sm },
    tabs: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
    tab: { alignItems: 'center', flex: 1, minHeight: 40, justifyContent: 'center' },
    activeTab: { backgroundColor: colors.primary },
    tabText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
    activeTabText: { color: colors.primaryContrast },
    loader: { marginVertical: spacing.xl },
    error: { color: colors.danger, fontSize: 14 },
    empty: { color: colors.muted, fontSize: 14, paddingVertical: spacing.xl, textAlign: 'center' },
    bookingCard: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
    imageFrame: { height: 108, width: 112 },
    bookingImage: { borderTopLeftRadius: radii.md, borderBottomLeftRadius: radii.md },
    copy: { flex: 1, gap: 4, padding: spacing.sm },
    bayName: { color: colors.heading, fontSize: 16, fontWeight: '900' },
    meta: { color: colors.muted, fontSize: 14 },
    status: { color: colors.primary, fontSize: 14, fontWeight: '800', marginTop: 2, textTransform: 'capitalize' },
    cancelled: { color: colors.danger },
});
