import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';

import { Bay, getBays, getBookingOptions } from '../api/booking';
import { cancelBooking, getBookingManagement, getRescheduleQuote, rescheduleBooking } from '../api/booking-management';
import { BookingManagement, ScheduleQuote } from '../api/booking-management-rules';
import { BookingOptions, isBookingDateAllowed } from '../api/booking-rules';
import { BayCard } from '../components/BayCard';
import { BookingCalendar, formatBookingDate } from '../components/BookingCalendar';
import { BookingPolicyLink } from '../components/BookingPolicyLink';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { bookingStyles as styles, colors } from '../theme';

function money(amount: number) {
    return `$${amount.toFixed(2)}`;
}

export default function ManageReservationScreen() {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const id = Number(bookingId);
    const requestId = useRef(0);
    const submitting = useRef(false);
    const [management, setManagement] = useState<BookingManagement | null>(null);
    const [options, setOptions] = useState<BookingOptions | null>(null);
    const [bays, setBays] = useState<Bay[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [bay, setBay] = useState('');
    const [date, setDate] = useState<Date | null>(null);
    const [month, setMonth] = useState(() => new Date());
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(1);
    const [quote, setQuote] = useState<ScheduleQuote | null>(null);

    const load = useCallback(async () => {
        const current = ++requestId.current;
        setLoading(true);
        setError('');
        setQuote(null);
        try {
            if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Reservation ID is missing.');
            const details = await getBookingManagement(id);
            const [nextBays, nextOptions] = details.can_manage ? await Promise.all([getBays(), getBookingOptions()]) : [[], null];
            if (current !== requestId.current) return;
            setManagement(details);
            setBays(nextBays);
            setOptions(nextOptions);
            setBay(nextBays.find((entry) => entry.key === details.booking.bay || entry.name === details.booking.bay)?.name ?? details.booking.bay);
            const initialDate = new Date(`${details.booking.date}T12:00:00`);
            setDate(initialDate);
            setMonth(initialDate);
            setTime(details.booking.time);
            setDuration(details.booking.duration);
        } catch (cause) {
            if (current === requestId.current) {
                setManagement(null);
                setError(cause instanceof Error ? cause.message : 'Unable to load your reservation.');
            }
        } finally {
            if (current === requestId.current) setLoading(false);
        }
    }, [id]);

    useFocusEffect(useCallback(() => {
        void load();
        return () => { requestId.current += 1; };
    }, [load]));

    function changed(update: () => void) {
        update();
        setQuote(null);
        setError('');
    }

    async function review() {
        if (!date || !options || !isBookingDateAllowed(formatBookingDate(date), options) || !time) {
            setError('Choose a date within your booking window and a start time.');
            return;
        }
        if (submitting.current) return;
        submitting.current = true;
        const current = requestId.current;
        setBusy(true);
        setError('');
        try {
            const nextQuote = await getRescheduleQuote(id, { bay, date: formatBookingDate(date), time, duration });
            if (current === requestId.current) setQuote(nextQuote);
        } catch (cause) {
            if (current === requestId.current) setError(cause instanceof Error ? cause.message : 'Unable to review this change.');
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    async function confirm(cancel: boolean) {
        if (!management || (!cancel && !quote) || submitting.current) return;
        submitting.current = true;
        const current = requestId.current;
        setBusy(true);
        setError('');
        try {
            const result = cancel || !quote ? await cancelBooking(id, management.revision) : await rescheduleBooking(id, quote);
            if (current !== requestId.current) return;
            if (result.bridge_url) {
                router.push({ pathname: '/checkout', params: { url: result.bridge_url, managementBookingId: String(id) } });
            } else {
                Alert.alert(cancel ? 'Reservation cancelled' : 'Reservation updated', result.message);
                router.replace('/reservations');
            }
        } catch (cause) {
            if (current === requestId.current) {
                setQuote(null);
                setError(cause instanceof Error ? cause.message : 'Unable to change your reservation. Reload it before trying again.');
            }
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <Screen>
            <ScreenHeader>
                <PrimaryButton label="Back" secondary small disabled={busy} onPress={() => router.back()} />
                <Text style={styles.title}>Manage reservation</Text>
            </ScreenHeader>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {!loading ? <PrimaryButton label="Reload reservation" secondary disabled={busy} onPress={() => { void load(); }} /> : null}
            {!loading && management ? <>
                <SectionCard>
                    <Text style={styles.sectionHeading}>{management.booking.bay}</Text>
                    <Text style={styles.hint}>{management.booking.date} at {management.booking.time}</Text>
                    <Text style={styles.hint}>{management.booking.duration} hour(s) · {management.booking.players} player(s)</Text>
                    {management.can_manage ? <Text style={styles.hint}>Changes are available until 24 hours before your reservation.</Text>
                        : <Text style={styles.hint}>{management.reason}</Text>}
                </SectionCard>
                {!management.can_manage && management.booking.status !== 'cancelled' ? <PrimaryButton label="Call Tee Time Nexus" onPress={() => {
                    Linking.openURL('tel:+19805033288').catch(() => setError('Unable to open the phone app. Call +1 (980) 503-3288.'));
                }} /> : null}
                {management.can_manage ? <>
                    <PrimaryButton label={editing ? 'Close rescheduling' : 'Reschedule'} secondary disabled={busy} onPress={() => { setEditing(!editing); setQuote(null); }} />
                    {editing && options ? <View style={styles.bayList}>
                        <Text style={styles.sectionHeading}>Choose your bay</Text>
                        {bays.map((entry, index) => <BayCard key={entry.key} bay={entry} index={index} fullWidth selected={bay === entry.name}
                            onPress={() => { if (!busy) changed(() => setBay(entry.name)); }} />)}
                        <Text style={styles.sectionHeading}>Choose a date</Text>
                        <Text style={styles.hint}>You can book up to {options.booking_window_days} days ahead.</Text>
                        <BookingCalendar month={month} selectedDate={date} bookingOptions={options} onMonthChange={setMonth}
                            onSelectDate={(next) => { if (!busy) changed(() => { setDate(next); setTime(''); }); }} />
                        <Text style={styles.sectionHeading}>Duration</Text>
                        <View style={styles.optionsWrap}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((hours) => <Choice key={hours} label={`${hours} hour(s)`} selected={duration === hours} disabled={busy}
                                onPress={() => changed(() => setDuration(hours))} />)}
                        </View>
                        <Text style={styles.sectionHeading}>Start time</Text>
                        <Text style={styles.hint}>Availability is checked when you review and confirm.</Text>
                        <View style={styles.optionsWrap}>
                            {options.slots.map((slot) => <Choice key={slot.label} label={slot.label} selected={time === slot.label} disabled={busy}
                                onPress={() => changed(() => setTime(slot.label))} />)}
                        </View>
                        <PrimaryButton label={busy ? 'Please wait…' : 'Review change'} disabled={busy || !date || !time} onPress={() => { void review(); }} />
                        {quote ? <SectionCard>
                            <Text style={styles.sectionHeading}>New total: {quote.new_total_price === 0 ? 'FREE' : money(quote.new_total_price)}</Text>
                            <Text style={styles.hint}>{quote.date} at {quote.time} · {quote.duration} hour(s)</Text>
                            <Text style={styles.hint}>{quote.member_free_hours} free member hour(s) · Guest charge {money(quote.guest_charge)}</Text>
                            <Text style={styles.hint}>{quote.difference > 0 ? `${money(quote.difference)} additional payment. Your original booking stays unchanged until payment succeeds.`
                                : quote.difference < 0 ? `${money(-quote.difference)} refund through the original payment method.` : 'No additional payment.'}</Text>
                            <PrimaryButton label={quote.difference > 0 ? 'Continue to payment' : 'Confirm reschedule'} disabled={busy} onPress={() => {
                                Alert.alert('Confirm reschedule', 'Apply this change to your reservation?', [
                                    { text: 'Keep reservation', style: 'cancel' },
                                    { text: 'Continue', onPress: () => { void confirm(false); } },
                                ]);
                            }} />
                        </SectionCard> : null}
                    </View> : null}
                    <PrimaryButton label="Cancel reservation" secondary disabled={busy} onPress={() => {
                        Alert.alert('Cancel reservation?', 'This releases your bay and returns used member free hours for this booking date. Any eligible refund is processed by the website through the original payment method.', [
                            { text: 'Keep reservation', style: 'cancel' },
                            { text: 'Cancel reservation', style: 'destructive', onPress: () => { void confirm(true); } },
                        ]);
                    }} />
                </> : null}
            </> : null}
            <BookingPolicyLink />
        </Screen>
    );
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
            style={[styles.option, selected && styles.selected, disabled && styles.optionDisabled]}>
            <Text style={[styles.optionText, selected && styles.selectedText]}>{label}</Text>
        </Pressable>
    );
}
