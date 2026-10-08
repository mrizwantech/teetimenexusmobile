import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Bay, getAvailability, getBays, getBookingOptions, TimeSlot } from '../api/booking';
import { BookingOptions, isBookingDateAllowed } from '../api/booking-rules';
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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const selectionsComplete = Boolean(selectedBay && date && bookingOptions && isBookingDateAllowed(formatDate(date), bookingOptions) && duration && players && time);
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
    if (!bookingOptions || !isBookingDateAllowed(formatDate(nextDate), bookingOptions)) {
      Alert.alert('Date unavailable', 'Please choose a date within your booking window.');
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
                <Text style={styles.summaryTotal}>Total: ${totalPrice}</Text>
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

function InlineCalendar({
  month,
  selectedDate,
  bookingOptions,
  onMonthChange,
  onSelectDate,
}: {
  month: Date;
  selectedDate: Date | null;
  bookingOptions: BookingOptions;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
}) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: leadingDays + daysInMonth }, (_, index) => {
    if (index < leadingDays) return null;
    return new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1);
  });
  const monthKey = formatDate(month).slice(0, 7);
  const canGoPrevious = monthKey > bookingOptions.min_booking_date.slice(0, 7);
  const canGoNext = monthKey < bookingOptions.max_booking_date.slice(0, 7);

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          disabled={!canGoPrevious}
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          style={[styles.monthButton, !canGoPrevious && styles.monthButtonDisabled]}
        >
          <Text style={styles.monthButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          disabled={!canGoNext}
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          style={[styles.monthButton, !canGoNext && styles.monthButtonDisabled]}
        >
          <Text style={styles.monthButtonText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const isUnavailable = !isBookingDateAllowed(formatDate(day), bookingOptions);
          const isSelected = selectedDate && formatDate(selectedDate) === formatDate(day);
          return (
            <Pressable
              key={formatDate(day)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isUnavailable, selected: Boolean(isSelected) }}
              disabled={isUnavailable}
              onPress={() => onSelectDate(day)}
              style={[styles.dayCell, isSelected && styles.selectedDay, isUnavailable && styles.pastDay]}
            >
              <Text style={[styles.dayText, isSelected && styles.selectedDayText, isUnavailable && styles.pastDayText]}>{day.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
