import {
  allowsCategory,
  bookingNotification,
  isRecipientAllowed,
  PERMANENT_TOKEN_ERRORS,
  reminderNotification,
  REMINDER_LEAD_MS,
  toOutgoingMessage,
} from './messages.ts';
import { sha256Hex, verifySignature } from './signature.ts';
import { MAX_BODY_BYTES, parseEvent } from './validate.ts';
import type { BookingRecord, Deps, Notification, OutgoingMessage, ReminderState, WordPressEvent } from './types.ts';

export type DeliveryResult = {
  userId: number;
  sent: number;
  failed: number;
  removed: number;
  skipped?: 'not_allowlisted' | 'preference_off' | 'no_devices';
};

export type HttpResult = { status: number; body: Record<string, unknown> };

const FCM_BATCH_LIMIT = 500;

export async function deliverToUser(userId: number, notification: Notification, deps: Deps): Promise<DeliveryResult> {
  if (!isRecipientAllowed(deps.mode, deps.testUserIds, userId)) {
    return { userId, sent: 0, failed: 0, removed: 0, skipped: 'not_allowlisted' };
  }
  const preferences = await deps.store.getPreferences(userId);
  if (!allowsCategory(preferences, notification.category)) {
    return { userId, sent: 0, failed: 0, removed: 0, skipped: 'preference_off' };
  }
  const devices = await deps.store.listDevices(userId);
  if (devices.length === 0) return { userId, sent: 0, failed: 0, removed: 0, skipped: 'no_devices' };

  const result: DeliveryResult = { userId, sent: 0, failed: 0, removed: 0 };
  const invalid: string[] = [];
  for (let start = 0; start < devices.length; start += FCM_BATCH_LIMIT) {
    const batch = devices.slice(start, start + FCM_BATCH_LIMIT);
    const messages: OutgoingMessage[] = batch.map((device) => toOutgoingMessage(device.token, notification));
    const outcomes = await deps.sender.sendEach(messages);
    outcomes.forEach((outcome, index) => {
      if (outcome.ok) {
        result.sent += 1;
        return;
      }
      result.failed += 1;
      if (PERMANENT_TOKEN_ERRORS.has(outcome.code)) invalid.push(batch[index].id);
      else deps.log.warn('Push delivery failed', { userId, code: outcome.code, category: notification.category });
    });
  }
  if (invalid.length > 0) {
    await deps.store.removeDevices(userId, invalid);
    result.removed = invalid.length;
  }
  return result;
}

export function reminderStateFor(startAt: number, now: number): { reminderAt: number | null; reminderState: ReminderState } {
  const reminderAt = startAt - REMINDER_LEAD_MS;
  return reminderAt > now ? { reminderAt, reminderState: 'pending' } : { reminderAt: null, reminderState: 'none' };
}

/** Decides what a due, pending reminder becomes when the scheduler picks it up. */
export function reminderOutcome(record: BookingRecord, now: number): 'sent' | 'expired' {
  return record.status === 'confirmed' && record.startAt > now ? 'sent' : 'expired';
}

type BookingEvent = Extract<WordPressEvent, { booking: unknown }>;

/** Returns null for out-of-order events so a late retry never overwrites newer state. */
export function nextBookingRecord(event: BookingEvent, previous: BookingRecord | null, now: number): BookingRecord | null {
  if (previous && previous.lastEventAt > event.occurredAt) return null;
  const booking = event.booking;
  const base = { ...booking, lastEventAt: event.occurredAt, updatedAt: now };
  if (event.type === 'booking.cancelled' || event.type === 'booking.removed') {
    return { ...base, status: event.type === 'booking.cancelled' ? 'cancelled' : 'removed', reminderAt: null, reminderState: 'cancelled' };
  }
  const unchangedStart = previous?.status === 'confirmed' && previous.startAt === booking.startAt;
  if (unchangedStart && (previous.reminderState === 'sent' || previous.reminderState === 'expired')) {
    return { ...base, status: 'confirmed', reminderAt: previous.reminderAt, reminderState: previous.reminderState };
  }
  return { ...base, status: 'confirmed', ...reminderStateFor(booking.startAt, now) };
}

export async function handleEvent(event: WordPressEvent, deps: Deps): Promise<Record<string, unknown>> {
  const now = deps.now();
  switch (event.type) {
    case 'device.register': {
      const check = await deps.sender.validateToken(event.token);
      if (!check.ok && PERMANENT_TOKEN_ERRORS.has(check.code)) {
        // Tell the app to fetch a fresh token instead of storing one FCM will never deliver to.
        await deps.store.unregisterDevice(event.userId, event.token);
        return { registered: false, reason: 'invalid_token' };
      }
      // Temporary FCM problems must not block registration; delivery cleans up bad tokens later.
      if (!check.ok) deps.log.warn('Token check failed; registering anyway', { userId: event.userId, code: check.code });
      await deps.store.registerDevice(event.userId, event.token, event.platform, now);
      return { registered: true };
    }
    case 'device.unregister':
      await deps.store.unregisterDevice(event.userId, event.token);
      return { unregistered: true };
    case 'preferences.get':
      return { preferences: await deps.store.getPreferences(event.userId) };
    case 'preferences.set':
      return { preferences: await deps.store.setPreferences(event.userId, event.preferences, now) };
    case 'message.user':
      return { delivery: await deliverToUser(event.userId, { title: event.title, body: event.body, route: event.route, category: 'account', data: { type: 'admin_message' } }, deps) };
    case 'message.broadcast': {
      const notification: Notification = { title: event.title, body: event.body, route: event.route, category: 'marketing', data: { type: 'marketing' } };
      const userIds = (await deps.store.listMarketingUserIds()).filter((id) => isRecipientAllowed(deps.mode, deps.testUserIds, id));
      const totals = { recipients: userIds.length, sent: 0, failed: 0, removed: 0 };
      for (const userId of userIds) {
        const result = await deliverToUser(userId, notification, deps);
        totals.sent += result.sent;
        totals.failed += result.failed;
        totals.removed += result.removed;
      }
      return { delivery: totals };
    }
    default: {
      const stored = await deps.store.updateBooking(event.booking.bookingId, (previous) => nextBookingRecord(event, previous, now));
      if (!stored) return { stale: true };
      if (event.type === 'booking.removed') return { reminderState: stored.reminderState };
      const delivery = await deliverToUser(event.booking.customerId, bookingNotification(event.type, event.booking), deps);
      return { reminderState: stored.reminderState, delivery };
    }
  }
}

export async function processWebhook(
  request: { rawBody: Buffer | undefined; timestamp: string | undefined; signature: string | undefined },
  secret: string,
  deps: Deps,
): Promise<HttpResult> {
  const rawBody = request.rawBody ?? Buffer.alloc(0);
  if (rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: 'invalid_body_size' } };

  const check = verifySignature({ secret, timestampHeader: request.timestamp, signatureHeader: request.signature, rawBody, nowSeconds: Math.floor(deps.now() / 1000) });
  if (!check.ok) {
    deps.log.warn('Rejected WordPress event', { reason: check.reason });
    return check.reason === 'misconfigured'
      ? { status: 500, body: { ok: false, error: 'server_misconfigured' } }
      : { status: 401, body: { ok: false, error: 'invalid_signature' } };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { status: 400, body: { ok: false, error: 'invalid_json' } };
  }
  const parsed = parseEvent(json);
  if (!parsed.ok) return { status: 400, body: { ok: false, error: 'invalid_event', message: parsed.error } };
  const event = parsed.event;

  const claim = await deps.store.claimEvent(event.id, event.type, sha256Hex(rawBody), deps.now());
  if (claim.state === 'done') return { status: 200, body: { ok: true, duplicate: true, result: claim.result } };
  if (claim.state === 'busy') return { status: 409, body: { ok: false, error: 'event_in_progress' } };
  if (claim.state === 'conflict') return { status: 409, body: { ok: false, error: 'event_id_reused' } };

  try {
    const result = await handleEvent(event, deps);
    await deps.store.completeEvent(event.id, result, deps.now());
    deps.log.info('Processed WordPress event', { eventId: event.id, type: event.type, mode: deps.mode, delivery: result.delivery ?? null });
    return { status: 200, body: { ok: true, result } };
  } catch (error) {
    deps.log.error('WordPress event failed', { eventId: event.id, type: event.type, error: error instanceof Error ? error.message : 'unknown' });
    await deps.store.releaseEvent(event.id).catch(() => undefined);
    return { status: 500, body: { ok: false, error: 'processing_failed' } };
  }
}

export async function sendDueReminders(deps: Deps, limit = 200): Promise<{ claimed: number; sent: number }> {
  const due = await deps.store.claimDueReminders(deps.now(), limit);
  let sent = 0;
  for (const record of due) {
    try {
      const result = await deliverToUser(record.customerId, reminderNotification(record), deps);
      sent += result.sent;
    } catch (error) {
      deps.log.error('Booking reminder failed', { bookingId: record.bookingId, error: error instanceof Error ? error.message : 'unknown' });
    }
  }
  if (due.length > 0) deps.log.info('Processed booking reminders', { claimed: due.length, sent, mode: deps.mode });
  return { claimed: due.length, sent };
}
