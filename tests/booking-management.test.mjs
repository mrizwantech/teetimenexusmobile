import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseBookingChange, parseBookingManagement, parseScheduleQuote } from '../src/api/booking-management-rules.ts';
import { nextUpcomingBooking } from '../src/api/booking-rules.ts';

const booking = { ID: 42, bay: 'Apex', date: '2026-10-12', time: '2:00 PM', duration: 1, players: 4, status: 'confirmed' };
const management = { booking, can_manage: true, reason: '', revision: 'current' };
const selection = { bay: 'Apex', date: '2026-10-12', time: '3:00 PM', duration: 2 };
const quote = { ...selection, booking_id: 42, member_free_hours: 2, guest_charge: 30, new_total_price: 30, difference: 15, revision: 'current', quote_id: 'price' };

test('management requires authoritative owner-bound booking and explicit policy state', () => {
    assert.deepEqual(parseBookingManagement(management, 42), management);
    assert.equal(parseBookingManagement({ ...management, can_manage: false, reason: 'Less than 24 hours.' }, 42).can_manage, false);
    for (const value of [null, {}, { ...management, booking: { ...booking, ID: 99 } }, { ...management, can_manage: false }, { ...management, revision: '' }]) {
        assert.throws(() => parseBookingManagement(value, 42));
    }
});

test('reschedule review rejects mismatched selections, malformed prices, and excessive free hours', () => {
    assert.deepEqual(parseScheduleQuote(quote, 42, selection), quote);
    assert.equal(parseScheduleQuote({ ...quote, difference: -15 }, 42, selection).difference, -15);
    for (const value of [null, { ...quote, duration: 3 }, { ...quote, time: '5:00 PM' }, { ...quote, booking_id: 99 }, { ...quote, member_free_hours: 3 }, { ...quote, difference: NaN }, { ...quote, new_total_price: -1 }, { ...quote, quote_id: '' }]) {
        assert.throws(() => parseScheduleQuote(value, 42, selection));
    }
});

test('failed changes and invalid checkout responses never become success', () => {
    assert.deepEqual(parseBookingChange({ success: true, message: 'Cancelled.' }), { success: true, message: 'Cancelled.' });
    for (const value of [undefined, { success: false, message: 'Refund failed.' }, { success: true, message: '' }, { success: true, message: 'Pay', bridge_url: 'javascript:alert(1)' }]) {
        assert.throws(() => parseBookingChange(value));
    }
});

test('native changes use authenticated APIs and never the old support-only popup', () => {
    const details = readFileSync(new URL('../src/components/BookingDetails.tsx', import.meta.url), 'utf8');
    const api = readFileSync(new URL('../src/api/booking-management.ts', import.meta.url), 'utf8');
    const screen = readFileSync(new URL('../src/app/manage-reservation.tsx', import.meta.url), 'utf8');
    const checkout = readFileSync(new URL('../src/app/checkout.tsx', import.meta.url), 'utf8');
    assert.match(details, /pathname: '\/manage-reservation'/);
    assert.doesNotMatch(details, /support to change this reservation/);
    assert.match(api, /apiRequest<unknown>/);
    assert.match(api, /JSON.stringify\(quote\)/);
    assert.match(screen, /getRescheduleQuote/);
    assert.match(screen, /management\.can_manage/);
    assert.match(screen, /managementBookingId/);
    assert.match(checkout, /booking_updated=1/);
});

test('cancelled future reservations never appear in the dashboard upcoming card', () => {
    const now = new Date('2026-10-12T12:00:00').getTime();
    assert.equal(nextUpcomingBooking([{ ...booking, status: 'cancelled' }], now), undefined);
});
