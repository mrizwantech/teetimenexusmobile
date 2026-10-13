import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isDaySlotAvailable } from '../src/api/booking-rules.ts';
import { getCalendarEvent, getCalendarStartDate, getGoogleCalendarUrl, VENUE_ADDRESS } from '../src/api/calendar-rules.ts';

test('calendar times parse AM/PM and 24-hour labels in the venue timezone', () => {
    assert.equal(getCalendarStartDate('2026-10-12', '2:00 PM').toISOString(), '2026-10-12T18:00:00.000Z');
    assert.equal(getCalendarStartDate('2026-10-12', '14:00').toISOString(), '2026-10-12T18:00:00.000Z');
    assert.equal(getCalendarStartDate('2026-10-12', '12:00 AM').toISOString(), '2026-10-12T04:00:00.000Z');
    assert.equal(getCalendarStartDate('2026-10-12', '12:00 PM').toISOString(), '2026-10-12T16:00:00.000Z');
    assert.equal(getCalendarStartDate('2026-12-12', '2:30 pm').toISOString(), '2026-12-12T19:30:00.000Z');
});

test('calendar events include full reservation details and end correctly across midnight', () => {
    const event = getCalendarEvent('Apex', '2026-10-12', '11:00 PM', 2, 4);
    assert.equal(event.title, 'Tee Time Nexus - Apex');
    assert.equal(event.startDate.toISOString(), '2026-10-13T03:00:00.000Z');
    assert.equal(event.endDate.toISOString(), '2026-10-13T05:00:00.000Z');
    assert.equal(event.notes, '4 players · 2 hours');
    assert.equal(event.location, VENUE_ADDRESS);
    assert.equal(event.allDay, false);
});

test('invalid dates, labels, missing details and nonexistent DST times fail explicitly', () => {
    for (const [date, time] of [
        ['2026-02-30', '2:00 PM'], ['', '2:00 PM'], ['2026-10-12', '13:00 PM'],
        ['2026-10-12', '24:00'], ['2026-10-12', '2:60 PM'], ['2026-03-08', '2:00 AM'],
    ]) assert.throws(() => getCalendarStartDate(date, time));
    for (const [duration, players] of [[0, 1], [9, 1], [1, 5], [NaN, 1]]) {
        assert.throws(() => getCalendarEvent('Apex', '2026-10-12', '2:00 PM', duration, players));
    }
});

test('Google URL includes a valid UTC range, venue timezone and encoded details', () => {
    const url = new URL(getGoogleCalendarUrl('Apex & Nexus', '2026-10-12', '2:00 PM', 1, 1));
    assert.equal(url.origin, 'https://calendar.google.com');
    assert.equal(url.searchParams.get('dates'), '20261012T180000Z/20261012T190000Z');
    assert.equal(url.searchParams.get('text'), 'Tee Time Nexus - Apex & Nexus');
    assert.equal(url.searchParams.get('ctz'), 'America/New_York');
    assert.equal(url.searchParams.get('details'), '1 player · 1 hour');
});

test('Apple uses SDK 57 event form, permission handling, and complete details on both surfaces', () => {
    const card = readFileSync(new URL('../src/components/CalendarCard.tsx', import.meta.url), 'utf8');
    const details = readFileSync(new URL('../src/components/BookingDetails.tsx', import.meta.url), 'utf8');
    const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
    assert.match(card, /requestCalendarPermissions\(true\)/);
    assert.match(card, /getDefaultCalendarSync\(\)\.addEventWithForm\(event\)/);
    assert.match(card, /Unable to open Apple Calendar/);
    assert.match(card, /Unable to open Google Calendar/);
    assert.doesNotMatch(card, /calshow:|createEventInCalendarAsync/);
    assert.match(card, /openAppleCalendar\(bay, date, time, duration, players\)/);
    assert.match(details, /openAppleCalendar\(bay, date, time, duration, players\)/);
    assert.match(details, /Platform\.OS === 'ios'/);
    assert.equal(config.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-calendar')[1].writeOnlyAccess, true);
});

test('today is disabled when all daily slots are in the past, but future days remain available', () => {
    const slots = [
        { label: '10:00 AM', start: '10:00' },
        { label: '2:00 PM', start: '14:00' },
        { label: '9:00 PM', start: '21:00' },
    ];
    const today = new Date(2026, 9, 12, 22, 0, 0); // 10:00 PM on Oct 12, 2026
    const tomorrow = new Date(2026, 9, 13);
    const dayAfter = new Date(2026, 9, 14);

    // When now is 10 PM, all slots (10:00, 14:00, 21:00) on today have passed
    assert.equal(isDaySlotAvailable(new Date(2026, 9, 12), slots, today), false);

    // Future days are not affected by today's time passing
    assert.equal(isDaySlotAvailable(tomorrow, slots, today), true);
    assert.equal(isDaySlotAvailable(dayAfter, slots, today), true);

    // If now is 1:00 PM, 2:00 PM and 9:00 PM are still in the future
    const midDay = new Date(2026, 9, 12, 13, 0, 0);
    assert.equal(isDaySlotAvailable(new Date(2026, 9, 12), slots, midDay), true);
});
