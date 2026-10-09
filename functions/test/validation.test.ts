import assert from 'node:assert/strict';
import { test } from 'node:test';

import { signPayload, verifySignature } from '../src/signature.ts';
import { parseEvent } from '../src/validate.ts';
import { allowsCategory, parseDeliveryMode, parseReminderLeadMinutes, parseTestUserIds, toOutgoingMessage } from '../src/messages.ts';
import { DEFAULT_PREFERENCES } from '../src/types.ts';

const SECRET = 'a'.repeat(64);
const NOW = 1_791_500_000;
const TOKEN = 'fcm-token-abcdefghijklmnopqrstuvwxyz:0123456789';

test('accepts a correctly signed, fresh payload', () => {
  const body = '{"hello":"world"}';
  const result = verifySignature({ secret: SECRET, timestampHeader: String(NOW), signatureHeader: signPayload(SECRET, NOW, body), rawBody: body, nowSeconds: NOW + 10 });
  assert.deepEqual(result, { ok: true, timestamp: NOW });
});

test('rejects tampered, expired, malformed, unsigned and misconfigured requests', () => {
  const body = '{"hello":"world"}';
  const signature = signPayload(SECRET, NOW, body);
  const check = (overrides: Partial<Parameters<typeof verifySignature>[0]>) => verifySignature({
    secret: SECRET, timestampHeader: String(NOW), signatureHeader: signature, rawBody: body, nowSeconds: NOW, ...overrides,
  });
  assert.deepEqual(check({ rawBody: '{"hello":"there"}' }), { ok: false, reason: 'mismatch' });
  assert.deepEqual(check({ secret: 'b'.repeat(64) }), { ok: false, reason: 'mismatch' });
  assert.deepEqual(check({ nowSeconds: NOW + 301 }), { ok: false, reason: 'expired' });
  assert.deepEqual(check({ nowSeconds: NOW - 301 }), { ok: false, reason: 'expired' });
  assert.deepEqual(check({ signatureHeader: 'sha256=abc' }), { ok: false, reason: 'malformed' });
  assert.deepEqual(check({ timestampHeader: '12ab' }), { ok: false, reason: 'malformed' });
  assert.deepEqual(check({ signatureHeader: undefined }), { ok: false, reason: 'missing' });
  assert.deepEqual(check({ secret: 'short' }), { ok: false, reason: 'misconfigured' });
});

const envelope = (type: string, data: Record<string, unknown>) => ({ event_id: 'evt-12345678', type, occurred_at: '2026-10-08T12:00:00-04:00', data });
const booking = {
  booking_id: 42, customer_id: 7, start_at: '2026-10-09T18:00:00-04:00', end_at: '2026-10-09T19:00:00-04:00', timezone: 'America/New_York', bay: 'Bay 1',
};

test('parses every supported event type', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['device.register', { user_id: 7, token: TOKEN, platform: 'ios' }],
    ['device.unregister', { user_id: 7, token: TOKEN }],
    ['preferences.get', { user_id: 7 }],
    ['preferences.set', { user_id: 7, preferences: { marketing: true } }],
    ['booking.confirmed', { booking }],
    ['booking.rescheduled', { booking }],
    ['booking.cancelled', { booking }],
    ['booking.removed', { booking }],
    ['message.user', { user_id: 7, title: 'Hello', body: 'Test', route: '/notifications' }],
    ['message.broadcast', { title: 'Offer', body: 'Details', route: '/membership' }],
  ];
  for (const [type, data] of cases) {
    const parsed = parseEvent(envelope(type, data));
    assert.equal(parsed.ok, true, `${type}: ${parsed.ok ? '' : parsed.error}`);
  }
  const parsed = parseEvent(envelope('booking.confirmed', { booking }));
  assert.ok(parsed.ok && 'booking' in parsed.event);
  if (parsed.ok && 'booking' in parsed.event) {
    assert.equal(parsed.event.booking.startAt, Date.parse('2026-10-09T22:00:00Z'));
  }
});

test('rejects invalid or unsafe payloads', () => {
  const invalid: unknown[] = [
    null,
    [],
    { ...envelope('preferences.get', { user_id: 7 }), event_id: 'short' },
    { ...envelope('preferences.get', { user_id: 7 }), occurred_at: '2026-10-08 12:00' },
    envelope('unknown.type', {}),
    envelope('preferences.get', { user_id: 0 }),
    envelope('preferences.get', { user_id: '7' }),
    envelope('device.register', { user_id: 7, token: 'has spaces in the token value', platform: 'ios' }),
    envelope('device.register', { user_id: 7, token: TOKEN, platform: 'web' }),
    envelope('preferences.set', { user_id: 7, preferences: {} }),
    envelope('preferences.set', { user_id: 7, preferences: { admin: true } }),
    envelope('preferences.set', { user_id: 7, preferences: { marketing: 'yes' } }),
    envelope('booking.confirmed', { booking: { ...booking, end_at: booking.start_at } }),
    envelope('booking.confirmed', { booking: { ...booking, start_at: '2026-10-09T18:00:00' } }),
    envelope('booking.confirmed', { booking: { ...booking, timezone: 'Mars/Olympus' } }),
    envelope('booking.confirmed', { booking: { ...booking, bay: 'Bay\n1' } }),
    envelope('message.user', { user_id: 7, title: 'Hi', body: 'Test', route: 'https://evil.example' }),
    envelope('message.user', { user_id: 7, title: 'x'.repeat(66), body: 'Test', route: '/' }),
    envelope('message.broadcast', { title: 'Hi', body: '', route: '/' }),
  ];
  for (const value of invalid) assert.equal(parseEvent(value).ok, false, JSON.stringify(value));
});

test('development mode defaults to the test allowlist', () => {
  assert.equal(parseDeliveryMode(undefined), 'test');
  assert.equal(parseDeliveryMode('production'), 'test');
  assert.equal(parseDeliveryMode(' LIVE '), 'live');
  assert.deepEqual([...parseTestUserIds(' 7, 8,abc,,-1,0, 12 ')], [7, 8, 12]);
});

test('preferences separate booking, reminder and marketing categories', () => {
  const prefs = { ...DEFAULT_PREFERENCES, bookingUpdates: false };
  assert.equal(allowsCategory(prefs, 'booking'), false);
  assert.equal(allowsCategory(prefs, 'reminder'), true);
  assert.equal(allowsCategory(prefs, 'account'), true);
  assert.equal(allowsCategory(DEFAULT_PREFERENCES, 'marketing'), false);
});

test('outgoing messages use the category channel and only string data', () => {
  const message = toOutgoingMessage(TOKEN, { title: 'T', body: 'B', category: 'marketing', route: '/membership', data: { type: 'marketing' } });
  assert.equal(message.android.notification.channelId, 'ttn-marketing');
  assert.equal(message.android.priority, 'normal');
  assert.deepEqual(message.data, { type: 'marketing', category: 'marketing', route: '/membership' });
  assert.equal(toOutgoingMessage(TOKEN, { title: 'T', body: 'B', category: 'reminder', route: '/reservations' }).android.notification.channelId, 'ttn-bookings');
});

test('reminder lead time defaults to 15 minutes and accepts only sane overrides', () => {
  assert.equal(parseReminderLeadMinutes(undefined), 15);
  assert.equal(parseReminderLeadMinutes(''), 15);
  assert.equal(parseReminderLeadMinutes('5'), 5);
  assert.equal(parseReminderLeadMinutes(' 30 '), 30);
  for (const bad of ['0', '-5', '2.5', '121', 'abc']) assert.equal(parseReminderLeadMinutes(bad), 15, bad);
});
