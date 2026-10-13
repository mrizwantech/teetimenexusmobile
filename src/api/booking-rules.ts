export type BookingOptions = {
    slots: { label: string; start: string }[];
    min_booking_date: string;
    max_booking_date: string;
    booking_window_days: number;
    member_package: string;
};

function isDateString(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseBookingOptions(value: unknown): BookingOptions {
    if (typeof value !== 'object' || value === null
        || !('slots' in value) || !Array.isArray(value.slots)
        || !value.slots.every((slot) => typeof slot === 'object' && slot !== null
            && typeof slot.label === 'string' && typeof slot.start === 'string'
            && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.start))
        || !('min_booking_date' in value) || !isDateString(value.min_booking_date)
        || !('max_booking_date' in value) || !isDateString(value.max_booking_date)
        || !('booking_window_days' in value) || typeof value.booking_window_days !== 'number'
        || !Number.isInteger(value.booking_window_days) || value.booking_window_days < 1
        || !('member_package' in value) || typeof value.member_package !== 'string') {
        throw new Error('The website returned invalid booking rules. Please try again.');
    }
    const days = (Date.parse(value.max_booking_date) - Date.parse(value.min_booking_date)) / 86_400_000;
    if (days !== value.booking_window_days) {
        throw new Error('The website returned inconsistent booking dates. Please try again.');
    }
    return {
        slots: value.slots,
        min_booking_date: value.min_booking_date,
        max_booking_date: value.max_booking_date,
        booking_window_days: value.booking_window_days,
        member_package: value.member_package,
    };
}

export function isBookingDateAllowed(date: string, options: BookingOptions): boolean {
    return isDateString(date) && date >= options.min_booking_date && date <= options.max_booking_date;
}

export function formatBookingDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isDaySlotAvailable(day: Date, slots: { label: string; start: string }[], now: Date = new Date()): boolean {
    const isToday = formatBookingDate(day) === formatBookingDate(now);
    if (!isToday) return true;
    return slots.some((slot) => {
        const [hour, minute] = slot.start.split(':').map(Number);
        const slotDate = new Date(day);
        slotDate.setHours(hour, minute, 0, 0);
        return slotDate >= now;
    });
}

// Booking times are venue-local labels like "2:00 PM"; returns the end as epoch ms, or null if unparseable.
export function bookingEndTime(date: string, time: string, durationHours: number): number | null {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const timeMatch = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(time.trim());
    if (!dateMatch || !timeMatch || !Number.isFinite(durationHours) || durationHours <= 0) return null;
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const period = timeMatch[3]?.toUpperCase();
    if (period ? hour < 1 || hour > 12 : hour > 23) return null;
    if (minute > 59) return null;
    if (period) hour = (hour % 12) + (period === 'PM' ? 12 : 0);
    const start = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hour, minute);
    if (start.getMonth() !== Number(dateMatch[2]) - 1 || start.getDate() !== Number(dateMatch[3])) return null;
    return start.getTime() + durationHours * 60 * 60 * 1000;
}

function localDateKey(now: number): string {
    const today = new Date(now);
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Upcoming until the reservation ends; unparseable times fall back to the local calendar date.
export function isBookingUpcoming(booking: { date: string; time: string; duration: number }, now = Date.now()): boolean {
    const endsAt = bookingEndTime(booking.date, booking.time, Number(booking.duration));
    return endsAt === null ? booking.date >= localDateKey(now) : endsAt > now;
}

export function nextUpcomingBooking<T extends { date: string; time: string; duration: number; status?: string }>(bookings: T[], now = Date.now()): T | undefined {
    const upcoming = bookings.filter((booking) => booking.status?.toLowerCase() !== 'cancelled' && isBookingUpcoming(booking, now));
    const end = (booking: T) => bookingEndTime(booking.date, booking.time, Number(booking.duration)) ?? Number.MAX_SAFE_INTEGER;
    return upcoming.sort((a, b) => end(a) - end(b))[0];
}

export type BookingQuote = {
    hourly_price: number;
    duration: number;
    member_free_hours: number;
    member_guest_charge: number;
    total: number;
    member_package: string;
};

export function parseBookingQuote(value: unknown, duration: number): BookingQuote {
    const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
    const money = (field: unknown) => typeof field === 'number' && Number.isFinite(field) && field >= 0;
    if (!record || !money(record.hourly_price) || !money(record.member_guest_charge) || !money(record.total)
        || record.duration !== duration
        || !Number.isInteger(record.member_free_hours) || Number(record.member_free_hours) < 0 || Number(record.member_free_hours) > duration
        || typeof record.member_package !== 'string') {
        throw new Error('The website returned an invalid booking price. Please try again.');
    }
    return {
        hourly_price: Number(record.hourly_price),
        duration,
        member_free_hours: Number(record.member_free_hours),
        member_guest_charge: Number(record.member_guest_charge),
        total: Number(record.total),
        member_package: record.member_package,
    };
}

export type FreeHoursBalance = { date: string; daily_allowance: number; used: number; remaining: number };

export function parseFreeHoursBalance(value: unknown, date: string): FreeHoursBalance {
    const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
    const count = (field: unknown) => Number.isInteger(field) && Number(field) >= 0;
    if (!record || record.date !== date || !count(record.daily_allowance) || !count(record.used) || !count(record.remaining)
        || Number(record.remaining) > Number(record.daily_allowance)) {
        throw new Error('The website returned an invalid free-hour balance. Please try again.');
    }
    return { date, daily_allowance: Number(record.daily_allowance), used: Number(record.used), remaining: Number(record.remaining) };
}
