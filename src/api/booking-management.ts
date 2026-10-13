import { apiRequest } from './client';
import { parseBookingChange, parseBookingManagement, parseScheduleQuote, ScheduleQuote, ScheduleSelection } from './booking-management-rules';

export async function getBookingManagement(id: number) {
    return parseBookingManagement(await apiRequest<unknown>(`/wp-json/ttn/v1/bookings/${id}/manage`, { cache: 'no-store' }), id);
}

export async function getRescheduleQuote(id: number, selection: ScheduleSelection) {
    return parseScheduleQuote(await apiRequest<unknown>(`/wp-json/ttn/v1/bookings/${id}/reschedule-quote`, {
        method: 'POST', cache: 'no-store', body: JSON.stringify(selection),
    }), id, selection);
}

export async function cancelBooking(id: number, revision: string) {
    return parseBookingChange(await apiRequest<unknown>(`/wp-json/ttn/v1/bookings/${id}/cancel`, {
        method: 'POST', body: JSON.stringify({ revision }),
    }));
}

export async function rescheduleBooking(id: number, quote: ScheduleQuote) {
    return parseBookingChange(await apiRequest<unknown>(`/wp-json/ttn/v1/bookings/${id}/reschedule`, {
        method: 'POST', body: JSON.stringify(quote),
    }));
}
