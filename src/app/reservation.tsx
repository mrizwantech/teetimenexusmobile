import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { BookingRecord, getMyBookings } from '../api/account';
import { BookingDetails } from '../components/BookingDetails';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors } from '../theme';

export default function ReservationScreen() {
    const { bookingId = '', bayIndex = '0' } = useLocalSearchParams<{
        bookingId?: string;
        bay?: string;
        date?: string;
        time?: string;
        duration?: string;
        players?: string;
        bayIndex?: string;
    }>();
    const [booking, setBooking] = useState<BookingRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const requestId = useRef(0);
    const load = useCallback(() => {
        const currentRequest = ++requestId.current;
        setLoading(true);
        setError('');
        getMyBookings().then((bookings) => {
            if (currentRequest !== requestId.current) return;
            const current = bookings.find((entry) => entry.ID === Number(bookingId));
            if (!current) throw new Error('Reservation not found.');
            setBooking(current);
        }).catch((cause) => {
            if (currentRequest === requestId.current) {
                setBooking(null);
                setError(cause instanceof Error ? cause.message : 'Unable to load your reservation.');
            }
        }).finally(() => {
            if (currentRequest === requestId.current) setLoading(false);
        });
    }, [bookingId]);
    useFocusEffect(useCallback(() => {
        load();
        return () => { requestId.current += 1; };
    }, [load]));

    return (
        <Screen>
            {loading ? <ActivityIndicator color={colors.primary} /> : error ? <>
                <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 16 }}>{error}</Text>
                <PrimaryButton label="Retry" onPress={load} />
            </> : booking ? <BookingDetails
                bookingId={Number(bookingId)}
                bay={booking.bay}
                date={booking.date}
                time={booking.time}
                duration={Number(booking.duration)}
                players={Number(booking.players)}
                status={booking.status}
                bayIndex={Number(bayIndex)}
            /> : null}
        </Screen>
    );
}
