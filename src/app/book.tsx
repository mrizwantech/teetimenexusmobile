import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Bay, getAvailability, getBays, getTimeSlots, TimeSlot } from '../api/booking';
import { startCheckout } from '../api/checkout';
import { getVerificationStatus } from '../api/verification';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

type BayType = 'right-handed' | 'left-handed';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isBayVisibleForType(bay: Bay, bayType: BayType): boolean {
  return bay.type === bayType || bay.type === 'dual';
}

export default function BookScreen() {
  const { user } = useAuth();
  const [bays, setBays] = useState<Bay[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadError, setLoadError] = useState('');
  const [continuing, setContinuing] = useState(false);

  const [bayType, setBayType] = useState<BayType | null>(null);
  const [bayKey, setBayKey] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [bayList, slots] = await Promise.all([getBays(), getTimeSlots()]);
        setBays(bayList);
        setTimeSlots(slots);
      } catch {
        setLoadError('Unable to load booking options. Please check your connection and try again.');
      }
    })();
  }, []);

  const selectedBay = useMemo(() => bays.find((bay) => bay.key === bayKey) ?? null, [bays, bayKey]);
  const visibleBays = useMemo(() => (bayType ? bays.filter((bay) => isBayVisibleForType(bay, bayType)) : []), [bays, bayType]);

  useEffect(() => {
    if (!selectedBay || !date) {
      return;
    }

    let cancelled = false;

    async function loadAvailability() {
      setLoadingAvailability(true);
      try {
        const result = await getAvailability(selectedBay!.name, formatDate(date!));
        if (!cancelled) setBookedTimes(result.booked_times);
      } catch {
        if (!cancelled) setBookedTimes([]);
      } finally {
        if (!cancelled) setLoadingAvailability(false);
      }
    }

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [selectedBay, date]);

  function isDurationAvailable(candidateDuration: number): boolean {
    if (!date) return true;
    const now = new Date();
    const isToday = formatDate(date) === formatDate(now);

    for (let index = 0; index < timeSlots.length; index++) {
      if (index + candidateDuration > timeSlots.length) break;

      if (isToday) {
        const [hour, minute] = timeSlots[index].start.split(':').map(Number);
        const slotDate = new Date(date);
        slotDate.setHours(hour, minute, 0, 0);
        if (slotDate < now) continue;
      }

      let fits = true;
      for (let offset = 0; offset < candidateDuration; offset++) {
        if (bookedTimes.includes(timeSlots[index + offset].label)) {
          fits = false;
          break;
        }
      }
      if (fits) return true;
    }

    return false;
  }

  function isTimeSlotAvailable(slotIndex: number): boolean {
    if (!duration) return false;
    if (slotIndex + duration > timeSlots.length) return false;

    const now = new Date();
    if (date && formatDate(date) === formatDate(now)) {
      const [hour, minute] = timeSlots[slotIndex].start.split(':').map(Number);
      const slotDate = new Date(date);
      slotDate.setHours(hour, minute, 0, 0);
      if (slotDate < now) return false;
    }

    for (let offset = 0; offset < duration; offset++) {
      if (bookedTimes.includes(timeSlots[slotIndex + offset].label)) return false;
    }
    return true;
  }

  const totalPrice = selectedBay && duration ? selectedBay.hourly_price * duration : 0;
  const readyToContinue = Boolean(selectedBay && date && duration && players && time);

  function handleBayTypeSelect(nextType: BayType) {
    setBayType(nextType);
    setBayKey(null);
    setDate(null);
    setDuration(null);
    setPlayers(null);
    setTime(null);
    setBookedTimes([]);
  }

  async function handleContinue() {
    if (!selectedBay || !date || !duration || !players || !time) return;

    if (!user) {
      Alert.alert('Log in required', 'Please log in or create an account to complete your booking.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to account', onPress: () => router.push('/account') },
      ]);
      return;
    }

    setContinuing(true);
    try {
      const { verified } = await getVerificationStatus();
      const bookingParams = {
        bay: selectedBay.name,
        date: formatDate(date),
        time,
        duration: String(duration),
        players: String(players),
      };

      if (!verified) {
        router.push({ pathname: '/verify', params: bookingParams });
        return;
      }

      const { bridge_url } = await startCheckout({
        bay: bookingParams.bay,
        date: bookingParams.date,
        time: bookingParams.time,
        duration,
        players,
      });
      await WebBrowser.openBrowserAsync(bridge_url);
    } catch (err) {
      Alert.alert('Unable to continue', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setContinuing(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader>
        <BrandMark />
        <Text style={styles.step}>RESERVE A BAY</Text>
      </ScreenHeader>

      <Text style={styles.title}>Book your session</Text>
      <Text style={styles.body}>Select your bay type, choose a bay, pick your date and time, then proceed to payment.</Text>

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      <SectionCard>
        <Text style={styles.label}>Bay type</Text>
        <View style={styles.options}>
          <Pill label="Right handed" selected={bayType === 'right-handed'} onPress={() => handleBayTypeSelect('right-handed')} />
          <Pill label="Left handed" selected={bayType === 'left-handed'} onPress={() => handleBayTypeSelect('left-handed')} />
        </View>

        {bayType ? (
          <>
            <Text style={styles.label}>Bay</Text>
            <View style={styles.optionsWrap}>
              {visibleBays.map((bay) => (
                <Pill
                  key={bay.key}
                  label={bay.name}
                  selected={bayKey === bay.key}
                  onPress={() => {
                    setBayKey(bay.key);
                    setDuration(null);
                    setTime(null);
                    setBookedTimes([]);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {selectedBay ? (
          <>
            <Text style={styles.label}>Date</Text>
            <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <Text style={date ? styles.dateInputText : styles.dateInputPlaceholder}>{date ? formatDate(date) : 'Select a date'}</Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={date ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setDate(selectedDate);
                    setDuration(null);
                    setTime(null);
                  }
                }}
              />
            ) : null}
          </>
        ) : null}

        {selectedBay && date ? (
          <>
            <Text style={styles.label}>Duration (hours)</Text>
            <View style={styles.optionsWrap}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((hours) => {
                const available = isDurationAvailable(hours);
                return (
                  <Pill
                    key={hours}
                    label={`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`}
                    selected={duration === hours}
                    disabled={!available || loadingAvailability}
                    onPress={() => {
                      setDuration(hours);
                      setTime(null);
                    }}
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {selectedBay && date && duration ? (
          <>
            <Text style={styles.label}>Players</Text>
            <View style={styles.optionsWrap}>
              {[1, 2, 3, 4].map((count) => (
                <Pill key={count} label={String(count)} selected={players === count} onPress={() => setPlayers(count)} />
              ))}
            </View>
          </>
        ) : null}

        {selectedBay && date && duration && players ? (
          <>
            <Text style={styles.label}>Start time</Text>
            <View style={styles.optionsWrap}>
              {timeSlots.map((slot, index) => (
                <Pill
                  key={slot.label}
                  label={slot.label}
                  selected={time === slot.label}
                  disabled={!isTimeSlotAvailable(index)}
                  onPress={() => setTime(slot.label)}
                />
              ))}
            </View>
          </>
        ) : null}

        {readyToContinue ? (
          <Text style={styles.summary}>
            {selectedBay?.name} • {date && formatDate(date)} • {time} ({duration}h) • {players} {players === 1 ? 'player' : 'players'}
            {'\n'}
            <Text style={styles.summaryTotal}>Total: ${totalPrice}</Text>
          </Text>
        ) : null}

        <PrimaryButton label={continuing ? 'Please wait…' : 'Continue to payment'} onPress={handleContinue} />
      </SectionCard>
    </Screen>
  );
}

function Pill({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.selected, disabled && styles.optionDisabled]}
    >
      <Text style={[styles.optionText, selected && styles.selectedText, disabled && styles.optionTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.heading, fontSize: 34, fontWeight: '900', marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 4 },
  label: { color: colors.heading, fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  options: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  selected: { backgroundColor: colors.primary },
  option: { borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11 },
  optionDisabled: { opacity: 0.35 },
  selectedText: { color: colors.primaryContrast, fontWeight: '800' },
  optionText: { color: colors.text, fontWeight: '700' },
  optionTextDisabled: { color: colors.subtle },
  dateInput: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: 22,
  },
  dateInputText: { color: colors.text, fontSize: 15 },
  dateInputPlaceholder: { color: colors.subtle, fontSize: 15 },
  summary: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  summaryTotal: { color: colors.primary, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
});