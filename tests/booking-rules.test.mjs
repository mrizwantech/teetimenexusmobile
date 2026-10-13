import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isBookingDateAllowed, parseBookingOptions } from '../src/api/booking-rules.ts';

function options(days, memberPackage = '') {
  const today = '2026-10-08';
  const lastDay = new Date(`${today}T00:00:00Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() + days);
  return parseBookingOptions({
    slots: [{ label: '10:00 AM', start: '10:00' }],
    min_booking_date: today,
    max_booking_date: lastDay.toISOString().slice(0, 10),
    booking_window_days: days,
    member_package: memberPackage,
  });
}

test('non-members can book today through day seven inclusive, but not day eight', () => {
  const rules = options(7);
  assert.equal(isBookingDateAllowed('2026-10-07', rules), false);
  assert.equal(isBookingDateAllowed('2026-10-08', rules), true);
  assert.equal(isBookingDateAllowed('2026-10-15', rules), true);
  assert.equal(isBookingDateAllowed('2026-10-16', rules), false);
  assert.equal(isBookingDateAllowed('2026-02-30', rules), false);
});

test('member dates follow the returned website limit without a local tier map', () => {
  for (const [days, tier] of [[7, 'PAR'], [14, 'BIRDIE'], [21, 'ALBATROSS']]) {
    const rules = options(days, tier);
    assert.equal(isBookingDateAllowed(rules.max_booking_date, rules), true);
    const nextDay = new Date(`${rules.max_booking_date}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    assert.equal(isBookingDateAllowed(nextDay.toISOString().slice(0, 10), rules), false);
  }
  assert.equal(options(30, 'FUTURE-TIER').booking_window_days, 30);
});

test('limits cross month/year boundaries using website calendar dates', () => {
  const rules = parseBookingOptions({
    ...options(7),
    min_booking_date: '2026-12-28',
    max_booking_date: '2027-01-04',
  });
  assert.equal(isBookingDateAllowed('2027-01-04', rules), true);
  assert.equal(isBookingDateAllowed('2027-01-05', rules), false);
});

test('missing, malformed, or inconsistent rules fail explicitly instead of allowing unlimited dates', () => {
  const valid = options(7);
  for (const value of [
    null, {}, { ...valid, max_booking_date: '' },
    { ...valid, min_booking_date: '2026-02-30' },
    { ...valid, booking_window_days: 0 },
    { ...valid, booking_window_days: 1.5 },
    { ...valid, max_booking_date: '2026-10-16' },
    { ...valid, slots: [{ label: 'Invalid', start: '25:00' }] },
  ]) {
    assert.throws(() => parseBookingOptions(value), /website returned/);
  }
});

test('booking uses uncached authenticated options and enforces both calendar bounds', () => {
  const api = readFileSync(new URL('../src/api/booking.ts', import.meta.url), 'utf8');
  assert.match(api, /parseBookingOptions\(await apiRequest<unknown>\('\/wp-json\/ttn\/v1\/member\/time-slots'\)\)/);
  const screen = readFileSync(new URL('../src/app/book.tsx', import.meta.url), 'utf8');
  assert.match(screen, /useFocusEffect\(useCallback/);
  assert.match(screen, /getBays\(\), getBookingOptions\(\)/);
  assert.doesNotMatch(screen, /getTimeSlots/);
  const calendar = readFileSync(new URL('../src/components/BookingCalendar.tsx', import.meta.url), 'utf8');
  assert.match(calendar, /isUnavailable = !isBookingDateAllowed/);
  assert.match(calendar, /disabled=\{isUnavailable\}/);
  assert.match(calendar, /disabled=\{!canGoNext\}/);
  assert.match(screen, /Retry booking options/);
});

test('booking total comes from the website quote, including member free hours', async () => {
  const { parseBookingQuote } = await import('../src/api/booking-rules.ts');
  const quote = { hourly_price: 60, duration: 1, member_free_hours: 1, member_guest_charge: 0, total: 0, member_package: 'ALBATROSS' };
  assert.equal(parseBookingQuote(quote, 1).total, 0);
  for (const value of [null, { ...quote, total: -1 }, { ...quote, duration: 2 }, { ...quote, member_free_hours: 2 }, { ...quote, total: '0' }, { ...quote, member_package: null }]) {
    assert.throws(() => parseBookingQuote(value, 1));
  }
  const screen = readFileSync(new URL('../src/app/book.tsx', import.meta.url), 'utf8');
  assert.match(screen, /getBookingQuote\(/);
  assert.match(screen, /currentQuote\.value\.total/);
  assert.doesNotMatch(screen, /Total: \$\{totalPrice\}/);
});

test('members see the website free-hour balance and FREE totals', async () => {
  const { parseFreeHoursBalance } = await import('../src/api/booking-rules.ts');
  const balance = { date: '2026-10-09', daily_allowance: 2, used: 1, remaining: 1 };
  assert.deepEqual(parseFreeHoursBalance(balance, '2026-10-09'), balance);
  for (const value of [null, { ...balance, date: '2026-10-10' }, { ...balance, remaining: 3 }, { ...balance, used: -1 }, { ...balance, remaining: '1' }]) {
    assert.throws(() => parseFreeHoursBalance(value, '2026-10-09'));
  }
  const screen = readFileSync(new URL('../src/app/book.tsx', import.meta.url), 'utf8');
  assert.match(screen, /getFreeHoursBalance\(balanceDate\)/);
  assert.match(screen, /daily_allowance > 0/);
  assert.match(screen, /total === 0 \? 'FREE'/);
});
