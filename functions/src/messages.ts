import type {
  BookingDetails,
  BookingEventType,
  DeliveryMode,
  Notification,
  NotificationCategory,
  OutgoingMessage,
  Preferences,
} from './types.ts';

export const DEFAULT_REMINDER_LEAD_MINUTES = 15;

export function parseReminderLeadMinutes(value: string | undefined): number {
  const minutes = Number(value?.trim());
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 120 ? minutes : DEFAULT_REMINDER_LEAD_MINUTES;
}

// Overridable via REMINDER_LEAD_MINUTES (e.g. a short lead for device testing).
export const REMINDER_LEAD_MINUTES = parseReminderLeadMinutes(process.env.REMINDER_LEAD_MINUTES);
export const REMINDER_LEAD_MS = REMINDER_LEAD_MINUTES * 60 * 1000;

export const ANDROID_CHANNELS: Record<NotificationCategory, string> = {
  booking: 'ttn-bookings',
  reminder: 'ttn-bookings',
  account: 'ttn-account',
  marketing: 'ttn-marketing',
};

const PREFERENCE_FOR_CATEGORY: Record<NotificationCategory, keyof Preferences | null> = {
  booking: 'bookingUpdates',
  reminder: 'bookingReminders',
  account: null,
  marketing: 'marketing',
};

export function allowsCategory(preferences: Preferences, category: NotificationCategory): boolean {
  const key = PREFERENCE_FOR_CATEGORY[category];
  return key === null || preferences[key];
}

export function parseDeliveryMode(value: string | undefined): DeliveryMode {
  return value?.trim().toLowerCase() === 'live' ? 'live' : 'test';
}

export function parseTestUserIds(value: string | undefined): Set<number> {
  const ids = new Set<number>();
  for (const part of (value ?? '').split(',')) {
    const trimmed = part.trim();
    if (/^[1-9]\d{0,9}$/.test(trimmed)) ids.add(Number(trimmed));
  }
  return ids;
}

export function isRecipientAllowed(mode: DeliveryMode, testUserIds: ReadonlySet<number>, userId: number): boolean {
  return mode === 'live' || testUserIds.has(userId);
}

function formatDay(time: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(time);
}

function formatTime(time: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(time);
}

export function bookingNotification(type: Exclude<BookingEventType, 'booking.removed'>, booking: BookingDetails): Notification {
  const when = `${formatDay(booking.startAt, booking.timezone)} at ${formatTime(booking.startAt, booking.timezone)}`;
  const data = { booking_id: String(booking.bookingId) };
  switch (type) {
    case 'booking.confirmed':
      return { title: 'Booking confirmed', body: `${booking.bay} is booked for ${when}.`, category: 'booking', route: '/reservations', data: { ...data, type: 'booking_confirmed' } };
    case 'booking.rescheduled':
      return { title: 'Booking updated', body: `Your ${booking.bay} booking is now ${when}.`, category: 'booking', route: '/reservations', data: { ...data, type: 'booking_rescheduled' } };
    case 'booking.cancelled':
      return { title: 'Booking cancelled', body: `Your ${booking.bay} booking for ${when} was cancelled.`, category: 'booking', route: '/reservations', data: { ...data, type: 'booking_cancelled' } };
  }
}

export function reminderNotification(booking: BookingDetails): Notification {
  return {
    title: `Your tee time starts in ${REMINDER_LEAD_MINUTES} minutes`,
    body: `${booking.bay} starts at ${formatTime(booking.startAt, booking.timezone)}. See you soon!`,
    category: 'reminder',
    route: '/reservations',
    data: { booking_id: String(booking.bookingId), type: `booking_reminder_${REMINDER_LEAD_MINUTES}m` },
  };
}

export function toOutgoingMessage(token: string, notification: Notification): OutgoingMessage {
  return {
    token,
    notification: { title: notification.title, body: notification.body },
    data: { ...notification.data, category: notification.category, route: notification.route },
    android: {
      priority: notification.category === 'marketing' ? 'normal' : 'high',
      notification: { channelId: ANDROID_CHANNELS[notification.category], sound: 'default' },
    },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

/** FCM errors that mean the token will never work again and should be deleted. */
export const PERMANENT_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
