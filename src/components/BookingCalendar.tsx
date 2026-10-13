import { Pressable, Text, View } from 'react-native';

import { BookingOptions, formatBookingDate, isBookingDateAllowed, isDaySlotAvailable } from '../api/booking-rules';
import { bookingStyles as styles } from '../theme';

export { formatBookingDate, isDaySlotAvailable };

export function BookingCalendar({ month, selectedDate, bookingOptions, onMonthChange, onSelectDate, isDateDisabled, now = new Date() }: {
    month: Date;
    selectedDate: Date | null;
    bookingOptions: BookingOptions;
    onMonthChange: (month: Date) => void;
    onSelectDate: (date: Date) => void;
    isDateDisabled?: (date: Date) => boolean;
    now?: Date;
}) {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const leadingDays = (firstDay.getDay() + 6) % 7;
    const days = Array.from({ length: leadingDays + daysInMonth }, (_, index) =>
        index < leadingDays ? null : new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1));
    const monthKey = formatBookingDate(month).slice(0, 7);
    const canGoPrevious = monthKey > bookingOptions.min_booking_date.slice(0, 7);
    const canGoNext = monthKey < bookingOptions.max_booking_date.slice(0, 7);
    return (
        <View style={styles.calendar}>
            <View style={styles.calendarHeader}>
                <Pressable accessibilityLabel="Previous month" accessibilityRole="button" disabled={!canGoPrevious}
                    onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    style={[styles.monthButton, !canGoPrevious && styles.monthButtonDisabled]}>
                    <Text style={styles.monthButtonText}>‹</Text>
                </Pressable>
                <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
                <Pressable accessibilityLabel="Next month" accessibilityRole="button" disabled={!canGoNext}
                    onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    style={[styles.monthButton, !canGoNext && styles.monthButtonDisabled]}>
                    <Text style={styles.monthButtonText}>›</Text>
                </Pressable>
            </View>
            <View style={styles.weekRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>)}
            </View>
            <View style={styles.calendarGrid}>
                {days.map((day, index) => {
                    if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
                    const isUnavailable = !isBookingDateAllowed(formatBookingDate(day), bookingOptions)
                        || !isDaySlotAvailable(day, bookingOptions.slots, now)
                        || Boolean(isDateDisabled?.(day));
                    const isSelected = selectedDate && formatBookingDate(selectedDate) === formatBookingDate(day);
                    return (
                        <Pressable key={formatBookingDate(day)} accessibilityLabel={day.toLocaleDateString()}
                            accessibilityRole="button" accessibilityState={{ disabled: isUnavailable, selected: Boolean(isSelected) }}
                            disabled={isUnavailable} onPress={() => onSelectDate(day)}
                            style={[styles.dayCell, isSelected && styles.selectedDay, isUnavailable && styles.pastDay]}>
                            <Text style={[styles.dayText, isSelected && styles.selectedDayText, isUnavailable && styles.pastDayText]}>{day.getDate()}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
