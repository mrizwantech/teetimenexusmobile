import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { Bay, getAvailability, getBays, getTimeSlots, TimeSlot } from '../api/booking';
import { startCheckout } from '../api/checkout';
import { getVerificationStatus, submitVerification } from '../api/verification';
import { BrandMark } from '../components/BrandMark';
import { BayCard } from '../components/BayCard';
import { BayTypeCard } from '../components/BayTypeCard';
import { BookingProgress } from '../components/BookingProgress';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
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
  const [bays, setBays] = useState<Bay[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadError, setLoadError] = useState('');
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

  const signatureRef = useRef<SignaturePadHandle>(null);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [idImage, setIdImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getVerificationStatus()
      .then((result) => {
        if (!cancelled) setAlreadyVerified(result.verified);
      })
      .catch(() => {
        if (!cancelled) setAlreadyVerified(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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
  const selectionsComplete = Boolean(selectedBay && date && duration && players && time);
  const verificationComplete = alreadyVerified || Boolean(idImage && hasSignature && termsAccepted);
  const readyToContinue = selectionsComplete && verificationComplete;
  const bookingProgress = [
    Boolean(bayType),
    Boolean(selectedBay),
    Boolean(date),
    Boolean(duration),
    Boolean(players),
    Boolean(time),
    verificationComplete,
  ];

  function scrollToLatestStep() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  function selectDate(nextDate: Date) {
    setDate(nextDate);
    setDuration(null);
    setPlayers(null);
    setTime(null);
    setCurrentStep(3);
    scrollToLatestStep();
  }

  async function pickIdDocument() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to upload your ID.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setIdImage(result.assets[0]);
    }
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

    if (!user) {
      Alert.alert('Log in required', 'Please log in or create an account to complete your booking.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to account', onPress: () => router.push('/account') },
      ]);
      return;
    }

    setContinuing(true);
    try {
      if (!alreadyVerified) {
        if (!idImage || !signatureRef.current?.hasSignature()) {
          Alert.alert('Verification incomplete', 'Please upload your ID and sign before continuing.');
          return;
        }

        const signatureDataUrl = await signatureRef.current.capture();
        await submitVerification({
          idDocumentUri: idImage.uri,
          idDocumentName: idImage.fileName ?? 'id-document.jpg',
          idDocumentType: idImage.mimeType ?? 'image/jpeg',
          signatureDataUrl,
        });
        setAlreadyVerified(true);
      }

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
      <ScreenHeader>
        <BrandMark />
        <Text style={styles.step}>RESERVE A BAY</Text>
      </ScreenHeader>
      <BookingProgress completed={bookingProgress} activeIndex={currentStep} onStepPress={setCurrentStep} />

      <Text style={styles.title}>Book your session</Text>
      <Text style={styles.body}>Select your bay type, choose a bay, pick your date and time, then proceed to payment.</Text>

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      <SectionCard>
        {currentStep === 0 ? (
          <>
            <Text style={styles.sectionHeading}>Choose your bay type</Text>
            <Text style={styles.hint}>Select the setup that matches your swing.</Text>
            <View style={styles.bayGrid}>
              <BayTypeCard
                label="Right handed"
                image="https://images.unsplash.com/photo-1593111774278-0b6b02b7961c?auto=format&fit=crop&w=900&q=85"
                selected={bayType === 'right-handed'}
                onPress={() => handleBayTypeSelect('right-handed')}
              />
              <BayTypeCard
                label="Left handed"
                image="https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=900&q=85"
                selected={bayType === 'left-handed'}
                onPress={() => handleBayTypeSelect('left-handed')}
              />
            </View>
          </>
        ) : null}

        {currentStep === 1 ? (
          <>
            <Text style={styles.sectionHeading}>Choose your bay</Text>
            <View style={styles.bayGrid}>
              {visibleBays.map((bay, index) => (
                <BayCard
                  key={bay.key}
                  bay={bay}
                  index={index}
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
            <InlineCalendar month={calendarMonth} selectedDate={date} onMonthChange={setCalendarMonth} onSelectDate={selectDate} />
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

            <Text style={styles.sectionHeading}>Verify your reservation</Text>
            {alreadyVerified ? (
              <Text style={styles.verifiedNote}>✓ Using the ID, signature, and terms already on file for your account.</Text>
            ) : (
              <>
                <Text style={styles.label}>Upload a photo of your government-issued ID</Text>
                {idImage ? <Image source={{ uri: idImage.uri }} style={styles.idPreview} resizeMode="cover" /> : null}
                <Pressable style={styles.uploadButton} onPress={pickIdDocument}>
                  <Text style={styles.uploadButtonText}>{idImage ? 'Change photo' : 'Choose photo'}</Text>
                </Pressable>
                <Text style={styles.hint}>JPG or PNG, up to 8MB. Stored encrypted and only viewable by our staff.</Text>

                <Text style={[styles.label, styles.labelSpacer]}>Sign to confirm your reservation</Text>
                <SignaturePad ref={signatureRef} onChange={setHasSignature} />
                <Pressable style={styles.clearButton} onPress={() => { signatureRef.current?.clear(); setHasSignature(false); }}>
                  <Text style={styles.clearButtonText}>Clear signature</Text>
                </Pressable>

                <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((prev) => !prev)}>
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.termsText}>I have read and agree to the Terms and Conditions.</Text>
                </Pressable>
              </>
            )}

            <PrimaryButton
              label={continuing ? 'Please wait…' : 'Continue to payment'}
              onPress={handleContinue}
              disabled={!readyToContinue || continuing}
            />
          </>
        ) : null}

        {currentStep > 0 ? <PrimaryButton label="Back" onPress={goBack} secondary /> : null}
      </SectionCard>
    </Screen>
  );
}

function InlineCalendar({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: {
  month: Date;
  selectedDate: Date | null;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: leadingDays + daysInMonth }, (_, index) => {
    if (index < leadingDays) return null;
    return new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1);
  });
  const canGoPrevious = month.getFullYear() > today.getFullYear() || month.getMonth() > today.getMonth();

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
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          style={styles.monthButton}
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
          const isPast = formatDate(day) < formatDate(today);
          const isSelected = selectedDate && formatDate(selectedDate) === formatDate(day);
          return (
            <Pressable
              key={formatDate(day)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isPast, selected: Boolean(isSelected) }}
              disabled={isPast}
              onPress={() => onSelectDate(day)}
              style={[styles.dayCell, isSelected && styles.selectedDay, isPast && styles.pastDay]}
            >
              <Text style={[styles.dayText, isSelected && styles.selectedDayText, isPast && styles.pastDayText]}>{day.getDate()}</Text>
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
