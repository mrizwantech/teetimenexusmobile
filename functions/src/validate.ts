import {
  APP_ROUTES,
  BOOKING_EVENT_TYPES,
  type AppRoute,
  type BookingDetails,
  type BookingEventType,
  type DevicePlatform,
  type Preferences,
  type WordPressEvent,
} from './types.ts';

export const MAX_BODY_BYTES = 16 * 1024;
export const TITLE_MAX = 65;
export const BODY_MAX = 240;

const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/;
// FCM registration tokens are printable ASCII without whitespace.
const FCM_TOKEN_PATTERN = /^[\x21-\x7e]{20,4096}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const PREFERENCE_KEYS: Record<string, keyof Preferences> = {
  booking_updates: 'bookingUpdates',
  booking_reminders: 'bookingReminders',
  marketing: 'marketing',
};

export type ParseResult = { ok: true; event: WordPressEvent } | { ok: false; error: string };

class ValidationError extends Error {}

function fail(message: string): never {
  throw new ValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    fail(`${field} must be a positive integer.`);
  }
  return value;
}

function isoTime(value: unknown, field: string): number {
  if (typeof value !== 'string' || !ISO_WITH_OFFSET.test(value)) fail(`${field} must be an ISO 8601 time with a UTC offset.`);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) fail(`${field} is not a valid time.`);
  return time;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') fail(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || CONTROL_CHARS.test(trimmed)) fail(`${field} must be 1-${max} characters without control characters.`);
  return trimmed;
}

function token(value: unknown): string {
  if (typeof value !== 'string' || !FCM_TOKEN_PATTERN.test(value)) fail('token is not a valid device token.');
  return value;
}

function platform(value: unknown): DevicePlatform {
  if (value !== 'ios' && value !== 'android') fail('platform must be ios or android.');
  return value;
}

function route(value: unknown): AppRoute {
  const match = APP_ROUTES.find((candidate) => candidate === value);
  if (!match) fail('route is not an allowed app destination.');
  return match;
}

function timezone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64) fail('timezone must be an IANA timezone.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
  } catch {
    fail('timezone must be an IANA timezone.');
  }
  return value;
}

function preferences(value: unknown): Partial<Preferences> {
  if (!isRecord(value)) fail('preferences must be an object.');
  const result: Partial<Preferences> = {};
  for (const [key, setting] of Object.entries(value)) {
    const mapped = PREFERENCE_KEYS[key];
    if (!mapped) fail(`Unknown preference ${key}.`);
    if (typeof setting !== 'boolean') fail(`${key} must be true or false.`);
    result[mapped] = setting;
  }
  if (Object.keys(result).length === 0) fail('preferences must include at least one setting.');
  return result;
}

function booking(value: unknown): BookingDetails {
  if (!isRecord(value)) fail('booking must be an object.');
  const startAt = isoTime(value.start_at, 'booking.start_at');
  const endAt = isoTime(value.end_at, 'booking.end_at');
  if (endAt <= startAt) fail('booking.end_at must be after booking.start_at.');
  return {
    bookingId: positiveId(value.booking_id, 'booking.booking_id'),
    customerId: positiveId(value.customer_id, 'booking.customer_id'),
    startAt,
    endAt,
    timezone: timezone(value.timezone),
    bay: text(value.bay, 'booking.bay', 80),
  };
}

export function parseEvent(value: unknown): ParseResult {
  try {
    if (!isRecord(value)) fail('Body must be a JSON object.');
    const id = value.event_id;
    if (typeof id !== 'string' || !EVENT_ID_PATTERN.test(id)) fail('event_id is invalid.');
    const occurredAt = isoTime(value.occurred_at, 'occurred_at');
    const data = value.data;
    if (!isRecord(data)) fail('data must be an object.');
    const base = { id, occurredAt };
    const type = value.type;

    switch (type) {
      case 'device.register':
        return { ok: true, event: { ...base, type, userId: positiveId(data.user_id, 'user_id'), token: token(data.token), platform: platform(data.platform) } };
      case 'device.unregister':
        return { ok: true, event: { ...base, type, userId: positiveId(data.user_id, 'user_id'), token: token(data.token) } };
      case 'preferences.get':
        return { ok: true, event: { ...base, type, userId: positiveId(data.user_id, 'user_id') } };
      case 'preferences.set':
        return { ok: true, event: { ...base, type, userId: positiveId(data.user_id, 'user_id'), preferences: preferences(data.preferences) } };
      case 'message.user':
        return {
          ok: true,
          event: { ...base, type, userId: positiveId(data.user_id, 'user_id'), title: text(data.title, 'title', TITLE_MAX), body: text(data.body, 'body', BODY_MAX), route: route(data.route) },
        };
      case 'message.broadcast':
        return { ok: true, event: { ...base, type, title: text(data.title, 'title', TITLE_MAX), body: text(data.body, 'body', BODY_MAX), route: route(data.route) } };
      default:
        if (BOOKING_EVENT_TYPES.includes(type as BookingEventType)) {
          return { ok: true, event: { ...base, type: type as BookingEventType, booking: booking(data.booking) } };
        }
        return fail('type is not supported.');
    }
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    throw error;
  }
}
