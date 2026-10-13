import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Bay, getAvailability, getBays, getBookingOptions, getBookingQuote, getFreeHoursBalance, TimeSlot } from '../api/booking';
import { BookingOptions, BookingQuote, FreeHoursBalance, isBookingDateAllowed } from '../api/booking-rules';
import { BookingCalendar as InlineCalendar, formatBookingDate as formatDate, isDaySlotAvailable } from '../components/BookingCalendar';
import { startCheckout } from '../api/checkout';
import { BrandMark } from '../components/BrandMark';
import { BayCard } from '../components/BayCard';
import { BayTypeCard } from '../components/BayTypeCard';
import { BookingAuthGate } from '../components/BookingAuthGate';
import { BookingProgress } from '../components/BookingProgress';
import { BookingPolicyLink } from '../components/BookingPolicyLink';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { bookingStyles as styles } from '../theme';

type BayType = 'right-handed' | 'left-handed';

function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function formatBalanceDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function isBayVisibleForType(bay: Bay, bayType: BayType): boolean {
  return bay.type === bayType || bay.type === 'dual';
}

export default function BookScreen() {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const optionsRequestId = useRef(0);
  const [bays, setBays] = useState<Bay[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadError, setLoadError] = useState('');
  const [bookingOptions, setBookingOptions] = useState<BookingOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [continuing, setContinuing] = useState(false);

  const [bayType, setBayType] = useState<BayType | null>(null);
  const [bayKey, setBayKey] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [duration, setDuration] = useState<number | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [freeHours, setFreeHours] = useState<FreeHoursBalance | null>(null);
  const [quote, setQuote] = useState<{ key: string; value?: BookingQuote; error?: string } | null>(null);

  const loadBookingOptions = useCallback(async () => {
    if (!user) return;
    const requestId = ++optionsRequestId.current;
    setLoadingOptions(true);
    setLoadError('');
    setBookingOptions(null);
    try {
      const [bayList, options] = await Promise.all([getBays(), getBookingOptions()]);
      if (requestId !== optionsRequestId.current) return;
      setBays(bayList);
      setTimeSlots(options.slots);
      setBookingOptions(options);
      setDate((previous) => previous && isBookingDateAllowed(formatDate(previous), options) ? previous : null);
      setCalendarMonth((previous) => {
        const month = formatDate(previous).slice(0, 7);
        if (month >= options.min_booking_date.slice(0, 7) && month <= options.max_booking_date.slice(0, 7)) return previous;
        const [year, monthNumber] = options.min_booking_date.split('-').map(Number);
        return new Date(year, monthNumber - 1, 1);
      });
    } catch (error) {
      if (requestId === optionsRequestId.current) setLoadError(error instanceof Error ? error.message : 'Unable to load booking options. Please try again.');
    } finally {
      if (requestId === optionsRequestId.current) setLoadingOptions(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void loadBookingOptions();
    return () => { optionsRequestId.current += 1; };
  }, [loadBookingOptions]));

  const balanceDate = date ? formatDate(date) : bookingOptions?.min_booking_date ?? null;

  // bookingOptions is reloaded on focus, so returning from checkout refreshes the balance too.
  useEffect(() => {
    if (!balanceDate || !bookingOptions) return;
    let cancelled = false;
    getFreeHoursBalance(balanceDate)
      .then((value) => {
        if (!cancelled) setFreeHours(value);
      })
      .catch(() => {
        if (!cancelled) setFreeHours(null);
      });
    return () => {
      cancelled = true;
    };
  }, [balanceDate, bookingOptions]);

  const visibleFreeHours = freeHours && freeHours.date === balanceDate && freeHours.daily_allowance > 0 ? freeHours : null;

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

  const standardTotal = selectedBay && duration ? selectedBay.hourly_price * duration : 0;
  const selectionsComplete = Boolean(selectedBay && date && bookingOptions && isBookingDateAllowed(formatDate(date), bookingOptions) && duration && players && time);
  const quoteKey = selectionsComplete && selectedBay && date && time && duration && players
    ? JSON.stringify([selectedBay.name, formatDate(date), time, duration, players])
    : null;
  const currentQuote = quote && quote.key === quoteKey ? quote : null;

  // The website prices member free hours and guest charges; the app only displays its quote.
  useEffect(() => {
    if (!quoteKey) return;
    let cancelled = false;
    const [bay, quoteDate, quoteTime, quoteDuration, quotePlayers] = JSON.parse(quoteKey) as [string, string, string, number, number];
    getBookingQuote({ bay, date: quoteDate, time: quoteTime, duration: quoteDuration, players: quotePlayers })
      .then((value) => {
        if (!cancelled) setQuote({ key: quoteKey, value });
      })
      .catch((error: unknown) => {
        if (!cancelled) setQuote({ key: quoteKey, error: error instanceof Error ? error.message : 'Unable to confirm your price.' });
      });
    return () => {
      cancelled = true;
    };
  }, [quoteKey]);
  const readyToContinue = selectionsComplete;
  const bookingProgress = [
    Boolean(bayType),
    Boolean(selectedBay),
    Boolean(date),
    Boolean(date && duration),
    Boolean(date && players),
    Boolean(date && time),
    selectionsComplete,
  ];

  function scrollToLatestStep() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  function selectDate(nextDate: Date) {
    if (!bookingOptions || !isBookingDateAllowed(formatDate(nextDate), bookingOptions) || !isDaySlotAvailable(nextDate, bookingOptions.slots)) {
      Alert.alert('Date unavailable', 'No tee times are available for this date. Please choose another date.');
      return;
    }
    setDate(nextDate);
    setDuration(null);
    setPlayers(null);
    setTime(null);
    setCurrentStep(3);
    scrollToLatestStep();
  }

  function handleBayTypeSelect(nextType: BayType) {
    setBayType(nextType);
    setBayKey(null);
    setDate(null);
    setDuration(null);
    setPlayers(null);
    setTime(null);
    setBookedTimes([]);
    setCurrentStep(1);
  }

  function goBack() {
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  async function handleContinue() {
    if (!selectedBay || !date || !duration || !players || !time) return;
    if (!bookingOptions || !isBookingDateAllowed(formatDate(date), bookingOptions)) {
      Alert.alert('Date unavailable', 'Please choose a date within your booking window.');
      return;
    }

    setContinuing(true);
    try {
      const { bridge_url } = await startCheckout({
        bay: selectedBay.name,
        date: formatDate(date),
        time,
        duration,
        players,
      });
      router.push({
        pathname: '/checkout',
        params: {
          url: bridge_url,
          bay: selectedBay.name,
          date: formatDate(date),
          time,
          duration: String(duration),
          players: String(players),
        },
      });
    } catch (err) {
      Alert.alert('Unable to continue', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setContinuing(false);
    }
  }

  return (
    <Screen scrollRef={scrollRef}>
      {!user ? <BookingAuthGate /> : null}
      {user ? <>
        <ScreenHeader>
          <BrandMark />
          <Text style={styles.step}>RESERVE A BAY</Text>
        </ScreenHeader>
        <BookingProgress completed={bookingProgress} activeIndex={currentStep} onStepPress={setCurrentStep} />

        <Text style={styles.title}>Book your session</Text>

        {visibleFreeHours ? (
          <View style={styles.freeHoursBanner} accessibilityRole="summary">
            <Text style={styles.freeHoursLabel}>
              FREE HOURS {visibleFreeHours.date === bookingOptions?.min_booking_date ? 'TODAY' : `· ${formatBalanceDate(visibleFreeHours.date).toUpperCase()}`}
            </Text>
            <Text style={styles.freeHoursValue}>
              {visibleFreeHours.remaining} of {visibleFreeHours.daily_allowance} {visibleFreeHours.daily_allowance === 1 ? 'hour' : 'hours'} remaining
            </Text>
          </View>
        ) : null}

        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {loadError ? <PrimaryButton label="Retry booking options" onPress={() => void loadBookingOptions()} /> : null}
        {loadingOptions ? <Text style={styles.hint}>Loading booking options...</Text> : null}

        {bookingOptions && !loadingOptions ? <SectionCard>
          {currentStep === 0 ? (
            <>
              <Text style={styles.setupHeading}>Select a bay that matches your swing</Text>
              <View style={styles.bayGrid}>
                <BayTypeCard
                  label="Right-Handed"
                  description="For right-handed golfers only"
                  selected={bayType === 'right-handed'}
                  onPress={() => handleBayTypeSelect('right-handed')}
                />
                <BayTypeCard
                  label="Dual-Handed"
                  description="Play both left- and right-handed"
                  selected={bayType === 'left-handed'}
                  onPress={() => handleBayTypeSelect('left-handed')}
                />
              </View>
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <Text style={styles.sectionHeading}>Choose your bay</Text>
              <View style={styles.bayList}>
                {visibleBays.map((bay, index) => (
                  <BayCard
                    key={bay.key}
                    bay={bay}
                    index={index}
                    fullWidth
                    selected={bayKey === bay.key}
                    onPress={() => {
                      setBayKey(bay.key);
                      setDuration(null);
                      setTime(null);
                      setBookedTimes([]);
                      setCurrentStep(2);
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <Text style={styles.sectionHeading}>Choose a date</Text>
              <Text style={styles.hint}>You can book up to {bookingOptions.booking_window_days} days ahead.</Text>
              <InlineCalendar month={calendarMonth} selectedDate={date} bookingOptions={bookingOptions} onMonthChange={setCalendarMonth} onSelectDate={selectDate} />
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <Text style={styles.sectionHeading}>Choose duration</Text>
              {!loadingAvailability && !isDurationAvailable(1) ? (
                <View style={{ marginTop: 8, gap: 12 }}>
                  <Text style={styles.error}>
                    No tee times are available on {date && formatDate(date)} for {selectedBay?.name}. Please choose another date.
                  </Text>
                  <PrimaryButton label="Choose another date" onPress={() => setCurrentStep(2)} />
                </View>
              ) : (
                <View style={styles.optionsWrap}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((hours) => (
                    <Pill
                      key={hours}
                      label={`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`}
                      selected={duration === hours}
                      disabled={!isDurationAvailable(hours) || loadingAvailability}
                      onPress={() => {
                        setDuration(hours);
                        setTime(null);
                        setCurrentStep(4);
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}

          {currentStep === 4 ? (
            <>
              <Text style={styles.sectionHeading}>How many players?</Text>
              <View style={styles.optionsWrap}>
                {[1, 2, 3, 4].map((count) => (
                  <Pill
                    key={count}
                    label={String(count)}
                    selected={players === count}
                    onPress={() => {
                      setPlayers(count);
                      setCurrentStep(5);
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          {currentStep === 5 ? (
            <>
              <Text style={styles.sectionHeading}>Choose a start time</Text>
              <View style={styles.optionsWrap}>
                {timeSlots.map((slot, index) => (
                  <Pill
                    key={slot.label}
                    label={slot.label}
                    selected={time === slot.label}
                    disabled={!isTimeSlotAvailable(index)}
                    onPress={() => {
                      setTime(slot.label);
                      setCurrentStep(6);
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          {currentStep === 6 ? (
            <>
              <Text style={styles.summary}>
                {selectedBay?.name} • {date && formatDate(date)} • {time} ({duration}h) • {players} {players === 1 ? 'player' : 'players'}
                {'\n'}
                <Text style={styles.summaryTotal}>
                  {currentQuote?.value ? `Total: ${currentQuote.value.total === 0 ? 'FREE' : formatMoney(currentQuote.value.total)}`
                    : currentQuote?.error ? `Standard rate: ${formatMoney(standardTotal)}`
                    : 'Total: Calculating…'}
                </Text>
                {currentQuote?.value && currentQuote.value.member_free_hours > 0 && currentQuote.value.total > 0 ? `\nIncludes ${currentQuote.value.member_free_hours} free member ${currentQuote.value.member_free_hours === 1 ? 'hour' : 'hours'}` : null}
                {currentQuote?.value && currentQuote.value.total === 0 && currentQuote.value.member_free_hours > 0 ? `\nCovered by ${currentQuote.value.member_free_hours} free member ${currentQuote.value.member_free_hours === 1 ? 'hour' : 'hours'}` : null}
                {currentQuote?.value && currentQuote.value.member_guest_charge > 0 ? `\nIncludes ${formatMoney(currentQuote.value.member_guest_charge)} additional guest charge` : null}
                {currentQuote?.error ? '\nMember free hours and guest charges are confirmed at checkout.' : null}
              </Text>

              <Text style={styles.sectionHeading}>Review your reservation</Text>

              <BookingPolicyLink />
              <PrimaryButton
                label={continuing ? 'Please wait…' : 'Continue to payment'}
                onPress={handleContinue}
                disabled={!readyToContinue || continuing}
              />
            </>
          ) : null}

          {currentStep > 0 ? <PrimaryButton label="Back" onPress={goBack} secondary /> : null}
        </SectionCard> : null}
      </> : null}
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
