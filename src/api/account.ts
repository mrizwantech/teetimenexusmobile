import { apiRequest } from './client';
import { getCurrentMembership, MembershipRecord } from './membership';

export type BookingRecord = {
    ID: number;
    bay: string;
    date: string;
    time: string;
    duration: number;
    players: number;
    status: string;
    payment_status: string;
    booking_reference: string;
};

export function getMyBookings(): Promise<BookingRecord[]> {
    return apiRequest<BookingRecord[]>('/wp-json/ttn/v1/bookings/me');
}

export function getMyMembership(): Promise<MembershipRecord | null> {
    return getCurrentMembership();
}
