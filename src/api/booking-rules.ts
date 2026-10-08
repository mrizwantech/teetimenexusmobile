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
