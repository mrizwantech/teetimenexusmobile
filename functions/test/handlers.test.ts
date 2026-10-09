import assert from 'node:assert/strict';
import { test } from 'node:test';

import { processWebhook, sendDueReminders } from '../src/handlers.ts';
import { signPayload } from '../src/signature.ts';
import { makeDeps } from './helpers.ts';
import type { Deps } from '../src/types.ts';

const SECRET = 'webhook-secret-'.padEnd(64, 'x');
const TOKEN_A = 'device-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa:111';
const TOKEN_B = 'device-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb:222';
let counter = 0;

function signed(deps: Deps, type: string, data: Record<string, unknown>, options: { eventId?: string; occurredAt?: number } = {}) {
  const body = JSON.stringify({
    event_id: options.eventId ?? `evt-${++counter}-test-event`,
    type,
    occurred_at: new Date(options.occurredAt ?? deps.now()).toISOString(),
    data,
  });
  const timestamp = Math.floor(deps.now() / 1000);
  return { rawBody: Buffer.from(body), timestamp: String(timestamp), signature: signPayload(SECRET, timestamp, body) };
}

const send = (deps: Deps, type: string, data: Record<string, unknown>, options?: { eventId?: string; occurredAt?: number }) =>
  processWebhook(signed(deps, type, data, options), SECRET, deps);

function bookingData(deps: Deps, overrides: Record<string, unknown> = {}, startOffsetMinutes = 120) {
  const start = deps.now() + startOffsetMinutes * 60_000;
  return {
    booking: {
      booking_id: 42,
      customer_id: 7,
      start_at: new Date(start).toISOString(),
      end_at: new Date(start + 3_600_000).toISOString(),
      timezone: 'America/New_York',
      bay: 'Bay 1',
      ...overrides,
    },
  };
}

test('rejects unsigned and replayed-outside-window requests without touching storage', async () => {
  const { deps, store } = makeDeps();
  const request = signed(deps, 'preferences.get', { user_id: 7 });
  assert.equal((await processWebhook({ ...request, signature: undefined }, SECRET, deps)).status, 401);
  assert.equal((await processWebhook(request, 'other-secret'.padEnd(64, 'y'), deps)).status, 401);
  const later = makeDeps({ store, clock: { now: deps.now() + 10 * 60_000 } });
  assert.equal((await processWebhook(request, SECRET, later.deps)).status, 401);
  assert.equal(store.events.size, 0);
});

test('test mode delivers only to allowlisted users', async () => {
  const { deps, sender } = makeDeps({ testUserIds: new Set([7]) });
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  await send(deps, 'device.register', { user_id: 99, token: TOKEN_B, platform: 'android' });

  const allowed = await send(deps, 'message.user', { user_id: 7, title: 'Test', body: 'Hello', route: '/notifications' });
  const blocked = await send(deps, 'message.user', { user_id: 99, title: 'Test', body: 'Hello', route: '/notifications' });

  assert.equal(allowed.status, 200);
  assert.deepEqual((blocked.body.result as { delivery: unknown }).delivery, { userId: 99, sent: 0, failed: 0, removed: 0, skipped: 'not_allowlisted' });
  assert.deepEqual(sender.sent.map((message) => message.token), [TOKEN_A]);
  assert.equal(sender.sent[0].android.notification.channelId, 'ttn-account');
});

test('a retried event is processed once; reusing its id with different content is refused', async () => {
  const { deps, sender } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  const request = signed(deps, 'booking.confirmed', bookingData(deps), { eventId: 'booking_confirmed-42' });

  const first = await processWebhook(request, SECRET, deps);
  const retry = await processWebhook(request, SECRET, deps);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.duplicate, true);
  assert.equal(sender.sent.length, 1);

  const reused = await send(deps, 'booking.confirmed', bookingData(deps, { bay: 'Bay 2' }), { eventId: 'booking_confirmed-42' });
  assert.equal(reused.status, 409);
  assert.equal(sender.sent.length, 1);
});

test('a failed event can be retried later', async () => {
  const { deps, sender } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  const original = sender.sendEach.bind(sender);
  sender.sendEach = async () => { throw new Error('FCM unavailable'); };
  const request = signed(deps, 'message.user', { user_id: 7, title: 'Hi', body: 'There', route: '/' }, { eventId: 'retry-me-123' });
  assert.equal((await processWebhook(request, SECRET, deps)).status, 500);
  sender.sendEach = original;
  assert.equal((await processWebhook(request, SECRET, deps)).status, 200);
  assert.equal(sender.sent.length, 1);
});

test('booking notifications respect preferences while account messages still arrive', async () => {
  const { deps, sender } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  const prefs = await send(deps, 'preferences.set', { user_id: 7, preferences: { booking_updates: false } });
  assert.deepEqual(prefs.body.result, { preferences: { bookingUpdates: false, bookingReminders: true, marketing: false } });

  const confirmed = await send(deps, 'booking.confirmed', bookingData(deps));
  assert.equal((confirmed.body.result as { delivery: { skipped: string } }).delivery.skipped, 'preference_off');
  await send(deps, 'message.user', { user_id: 7, title: 'Hi', body: 'There', route: '/' });
  assert.equal(sender.sent.length, 1);
});

test('permanently invalid tokens are removed; temporary failures are kept', async () => {
  const { deps, sender, store } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_B, platform: 'android' });
  sender.failures.set(TOKEN_A, 'messaging/registration-token-not-registered');
  sender.failures.set(TOKEN_B, 'messaging/unavailable');

  const result = await send(deps, 'message.user', { user_id: 7, title: 'Hi', body: 'There', route: '/' });
  assert.deepEqual((result.body.result as { delivery: unknown }).delivery, { userId: 7, sent: 0, failed: 2, removed: 1 });
  assert.deepEqual((await store.listDevices(7)).map((device) => device.token), [TOKEN_B]);
});

test('registration rejects tokens FCM no longer accepts so the app fetches a fresh one', async () => {
  const { deps, sender, store } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  sender.failures.set(TOKEN_A, 'messaging/registration-token-not-registered');
  const rejected = await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  assert.deepEqual(rejected.body.result, { registered: false, reason: 'invalid_token' });
  assert.equal((await store.listDevices(7)).length, 0, 'the stale token is dropped');

  sender.failures.set(TOKEN_B, 'messaging/unavailable');
  const temporary = await send(deps, 'device.register', { user_id: 7, token: TOKEN_B, platform: 'ios' });
  assert.deepEqual(temporary.body.result, { registered: true }, 'temporary FCM errors do not block registration');
  assert.deepEqual((await store.listDevices(7)).map((device) => device.token), [TOKEN_B]);
});

test('a phone signed into a different account stops receiving the old account\'s notifications', async () => {
  const { deps, store } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  await send(deps, 'device.register', { user_id: 8, token: TOKEN_A, platform: 'ios' });
  assert.equal((await store.listDevices(7)).length, 0);
  assert.equal((await store.listDevices(8)).length, 1);

  await send(deps, 'device.unregister', { user_id: 7, token: TOKEN_A });
  assert.equal((await store.listDevices(8)).length, 1, 'another user cannot unregister the current owner');
  await send(deps, 'device.unregister', { user_id: 8, token: TOKEN_A });
  assert.equal((await store.listDevices(8)).length, 0);
});

test('reminders are sent once, 15 minutes before start, and follow reschedules and cancellations', async () => {
  const { deps, sender, store, clock } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'android' });
  const start = clock.now;
  await send(deps, 'booking.confirmed', bookingData(deps, {}, 60));
  assert.equal(store.bookings.get(42)?.reminderAt, start + 45 * 60_000);

  clock.now = start + 44 * 60_000;
  assert.deepEqual(await sendDueReminders(deps), { claimed: 0, sent: 0 });

  clock.now = start + 30 * 60_000;
  await send(deps, 'booking.rescheduled', bookingData(deps, {}, 90), { occurredAt: clock.now });
  assert.equal(store.bookings.get(42)?.reminderAt, start + 105 * 60_000);

  clock.now = start + 105 * 60_000;
  assert.deepEqual(await sendDueReminders(deps), { claimed: 1, sent: 1 });
  assert.deepEqual(await sendDueReminders(deps), { claimed: 0, sent: 0 });
  const reminder = sender.sent.at(-1)!;
  assert.equal(reminder.data.type, 'booking_reminder_15m');
  assert.equal(reminder.android.notification.channelId, 'ttn-bookings');

  await send(deps, 'booking.cancelled', bookingData(deps, {}, 15), { occurredAt: clock.now });
  assert.equal(store.bookings.get(42)?.reminderState, 'cancelled');
});

test('cancelled and removed bookings never send reminders; late out-of-order events are ignored', async () => {
  const { deps, sender, store, clock } = makeDeps();
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'ios' });
  const start = clock.now;
  await send(deps, 'booking.confirmed', bookingData(deps, {}, 60), { occurredAt: start });
  await send(deps, 'booking.cancelled', bookingData(deps, {}, 60), { occurredAt: start + 1000 });
  const stale = await send(deps, 'booking.confirmed', bookingData(deps, {}, 60), { occurredAt: start - 1000, eventId: 'late-confirmed-42' });
  assert.deepEqual(stale.body.result, { stale: true });

  const before = sender.sent.length;
  clock.now = start + 50 * 60_000;
  assert.deepEqual(await sendDueReminders(deps), { claimed: 0, sent: 0 });
  assert.equal(sender.sent.length, before);

  await send(deps, 'booking.removed', bookingData(deps, { booking_id: 43 }, 60));
  assert.equal(store.bookings.get(43)?.reminderState, 'cancelled');
  assert.equal(sender.sent.length, before, 'removal is silent');
});

test('bookings made inside the 15-minute window skip the reminder; overdue reminders expire', async () => {
  const { deps, store, clock } = makeDeps();
  await send(deps, 'booking.confirmed', bookingData(deps, { booking_id: 50 }, 10));
  assert.equal(store.bookings.get(50)?.reminderState, 'none');

  await send(deps, 'booking.confirmed', bookingData(deps, { booking_id: 51 }, 30));
  clock.now += 31 * 60_000;
  assert.deepEqual(await sendDueReminders(deps), { claimed: 0, sent: 0 });
  assert.equal(store.bookings.get(51)?.reminderState, 'expired');
});

test('broadcasts reach only opted-in, allowlisted users on the marketing channel', async () => {
  const { deps, sender } = makeDeps({ testUserIds: new Set([7, 8]) });
  await send(deps, 'device.register', { user_id: 7, token: TOKEN_A, platform: 'android' });
  await send(deps, 'device.register', { user_id: 8, token: TOKEN_B, platform: 'ios' });
  await send(deps, 'device.register', { user_id: 9, token: 'device-token-cccccccccccccccccccccccccccc:333', platform: 'ios' });
  await send(deps, 'preferences.set', { user_id: 7, preferences: { marketing: true } });
  await send(deps, 'preferences.set', { user_id: 9, preferences: { marketing: true } });

  const result = await send(deps, 'message.broadcast', { title: 'Offer', body: 'Details', route: '/membership' });
  assert.deepEqual((result.body.result as { delivery: unknown }).delivery, { recipients: 1, sent: 1, failed: 0, removed: 0 });
  assert.deepEqual(sender.sent.map((message) => [message.token, message.android.notification.channelId]), [[TOKEN_A, 'ttn-marketing']]);
});

test('live mode is the only way to reach non-allowlisted users', async () => {
  const { deps, sender } = makeDeps({ mode: 'live', testUserIds: new Set() });
  await send(deps, 'device.register', { user_id: 99, token: TOKEN_A, platform: 'ios' });
  await send(deps, 'message.user', { user_id: 99, title: 'Hi', body: 'There', route: '/' });
  assert.equal(sender.sent.length, 1);
});
