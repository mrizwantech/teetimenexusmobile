export type ManagedBooking = {
    ID: number;
    bay: string;
    date: string;
    time: string;
    duration: number;
    players: number;
    status: string;
};
export type BookingManagement = { booking: ManagedBooking; can_manage: boolean; reason: string; revision: string };
export type ScheduleSelection = { bay: string; date: string; time: string; duration: number };
export type ScheduleQuote = ScheduleSelection & {
    booking_id: number;
    member_free_hours: number;
    guest_charge: number;
    new_total_price: number;
    difference: number;
    revision: string;
    quote_id: string;
};
export type BookingChangeResult = { success: true; message: string; bridge_url?: string };

function record(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('The website returned invalid reservation details. Please try again.');
    }
    return value as Record<string, unknown>;
}

function text(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function count(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function parseBookingManagement(value: unknown, id: number): BookingManagement {
    const data = record(value);
    const booking = record(data.booking);
    if (booking.ID !== id || !text(booking.bay) || !text(booking.date) || !text(booking.time)
        || !count(booking.duration, 1, 8) || !count(booking.players, 1, 4) || typeof booking.status !== 'string'
        || typeof data.can_manage !== 'boolean' || typeof data.reason !== 'string'
        || (!data.can_manage && !data.reason) || !text(data.revision)) {
        throw new Error('The website returned invalid reservation details. Please try again.');
    }
    return {
        booking: { ID: id, bay: booking.bay, date: booking.date, time: booking.time, duration: booking.duration, players: booking.players, status: booking.status },
        can_manage: data.can_manage, reason: data.reason, revision: data.revision,
    };
}

export function parseScheduleQuote(value: unknown, id: number, selection: ScheduleSelection): ScheduleQuote {
    const data = record(value);
    if (data.booking_id !== id || data.bay !== selection.bay || data.date !== selection.date
        || data.time !== selection.time || data.duration !== selection.duration
        || !count(data.member_free_hours, 0, selection.duration)
        || typeof data.guest_charge !== 'number' || !Number.isFinite(data.guest_charge) || data.guest_charge < 0
        || typeof data.new_total_price !== 'number' || !Number.isFinite(data.new_total_price) || data.new_total_price < 0
        || typeof data.difference !== 'number' || !Number.isFinite(data.difference)
        || !text(data.revision) || !text(data.quote_id)) {
        throw new Error('The website returned an invalid rescheduling price. Please try again.');
    }
    return {
        ...selection, booking_id: id, member_free_hours: data.member_free_hours, guest_charge: data.guest_charge,
        new_total_price: data.new_total_price, difference: data.difference, revision: data.revision, quote_id: data.quote_id,
    };
}

export function parseBookingChange(value: unknown): BookingChangeResult {
    const data = record(value);
    if (data.success !== true || !text(data.message) || (data.bridge_url !== undefined
        && (typeof data.bridge_url !== 'string' || !/^https:\/\//.test(data.bridge_url)))) {
        throw new Error('The website did not confirm the reservation change. Reload your reservation before trying again.');
    }
    return { success: true, message: data.message, ...(typeof data.bridge_url === 'string' ? { bridge_url: data.bridge_url } : {}) };
}
