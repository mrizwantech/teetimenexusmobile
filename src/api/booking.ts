import { apiRequest } from './client';
import { isRecord } from './home-content';
import { getCachedPublicContent, PUBLIC_CONTENT_CACHE_MAX_AGE_MS } from './public-content-cache';
import { parseBookingOptions, parseBookingQuote, parseFreeHoursBalance } from './booking-rules';

export type Bay = {
    key: string;
    name: string;
    type: 'right-handed' | 'left-handed' | 'dual';
    location: string;
    premium: boolean;
    hourly_price: number;
    thumbnail_url?: string | null;
};

export type TimeSlot = { label: string; start: string };

function isBay(value: unknown): value is Bay {
    return isRecord(value)
        && typeof value.key === 'string'
        && typeof value.name === 'string'
        && (value.type === 'right-handed' || value.type === 'left-handed' || value.type === 'dual')
        && typeof value.location === 'string'
        && typeof value.premium === 'boolean'
        && typeof value.hourly_price === 'number'
        && (value.thumbnail_url === undefined || value.thumbnail_url === null || typeof value.thumbnail_url === 'string');
}

function parseBays(value: unknown): Bay[] {
    if (!Array.isArray(value) || !value.every(isBay)) {
        throw new Error('The website returned invalid bay options. Please try again.');
    }
    return value;
}

function isTimeSlot(value: unknown): value is TimeSlot {
    return isRecord(value) && typeof value.label === 'string' && typeof value.start === 'string';
}

function parseTimeSlots(value: unknown): TimeSlot[] {
    if (!Array.isArray(value) || !value.every(isTimeSlot)) {
        throw new Error('The website returned invalid booking times. Please try again.');
    }
    return value;
}

export function getBays(forceRefresh = false): Promise<Bay[]> {
    return getCachedPublicContent({
        key: 'bays',
        maxAgeMs: PUBLIC_CONTENT_CACHE_MAX_AGE_MS,
        request: () => apiRequest<unknown>('/wp-json/ttn/v1/bays'),
        parse: parseBays,
        forceRefresh,
    });
}

export function getTimeSlots(forceRefresh = false): Promise<TimeSlot[]> {
    return getCachedPublicContent({
        key: 'time-slots',
        maxAgeMs: PUBLIC_CONTENT_CACHE_MAX_AGE_MS,
        request: () => apiRequest<unknown>('/wp-json/ttn/v1/time-slots'),
        parse: parseTimeSlots,
        forceRefresh,
    });
}

export async function getBookingOptions() {
    return parseBookingOptions(await apiRequest<unknown>('/wp-json/ttn/v1/member/time-slots'));
}

export function getAvailability(bay: string, date: string): Promise<{ booked_times: string[] }> {
    const query = new URLSearchParams({ bay, date }).toString();
    return apiRequest<{ booked_times: string[] }>(`/wp-json/ttn/v1/availability?${query}`);
}

export async function getBookingQuote(params: { bay: string; date: string; time: string; duration: number; players: number }) {
    const query = new URLSearchParams({ ...params, duration: String(params.duration), players: String(params.players) }).toString();
    return parseBookingQuote(await apiRequest<unknown>(`/wp-json/ttn/v1/booking-quote?${query}`, { cache: 'no-store' }), params.duration);
}

export async function getFreeHoursBalance(date: string) {
    const query = new URLSearchParams({ date }).toString();
    return parseFreeHoursBalance(await apiRequest<unknown>(`/wp-json/ttn/v1/member/free-hours?${query}`, { cache: 'no-store' }), date);
}
