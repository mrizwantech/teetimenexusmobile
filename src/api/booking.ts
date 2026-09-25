import { apiRequest } from './client';

export type Bay = {
    key: string;
    name: string;
    type: 'right-handed' | 'left-handed' | 'dual';
    location: string;
    premium: boolean;
    hourly_price: number;
};

export type TimeSlot = { label: string; start: string };

export function getBays(): Promise<Bay[]> {
    return apiRequest<Bay[]>('/wp-json/ttn/v1/bays');
}

export function getTimeSlots(): Promise<TimeSlot[]> {
    return apiRequest<TimeSlot[]>('/wp-json/ttn/v1/time-slots');
}

export function getAvailability(bay: string, date: string): Promise<{ booked_times: string[] }> {
    const query = new URLSearchParams({ bay, date }).toString();
    return apiRequest<{ booked_times: string[] }>(`/wp-json/ttn/v1/availability?${query}`);
}
