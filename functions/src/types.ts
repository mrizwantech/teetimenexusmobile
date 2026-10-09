export type DevicePlatform = 'ios' | 'android';

export type Preferences = {
  bookingUpdates: boolean;
  bookingReminders: boolean;
  marketing: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  bookingUpdates: true,
  bookingReminders: true,
  marketing: false,
};

/** Booking/reminder/account messages are operational; marketing is opt-in only. */
export type NotificationCategory = 'booking' | 'reminder' | 'account' | 'marketing';

export const APP_ROUTES = ['/', '/book', '/membership', '/reservations', '/account', '/notifications'] as const;
export type AppRoute = typeof APP_ROUTES[number];

export type BookingDetails = {
  bookingId: number;
  customerId: number;
  /** Epoch milliseconds (UTC). */
  startAt: number;
  endAt: number;
  /** IANA timezone of the facility, used only for display. */
  timezone: string;
  bay: string;
};

export const BOOKING_EVENT_TYPES = ['booking.confirmed', 'booking.rescheduled', 'booking.cancelled', 'booking.removed'] as const;
export type BookingEventType = typeof BOOKING_EVENT_TYPES[number];

type EventBase = { id: string; occurredAt: number };

export type WordPressEvent = EventBase & (
  | { type: 'device.register'; userId: number; token: string; platform: DevicePlatform }
  | { type: 'device.unregister'; userId: number; token: string }
  | { type: 'preferences.get'; userId: number }
  | { type: 'preferences.set'; userId: number; preferences: Partial<Preferences> }
  | { type: BookingEventType; booking: BookingDetails }
  | { type: 'message.user'; userId: number; title: string; body: string; route: AppRoute }
  | { type: 'message.broadcast'; title: string; body: string; route: AppRoute }
);

export type WordPressEventType = WordPressEvent['type'];

export type Notification = {
  title: string;
  body: string;
  category: NotificationCategory;
  route: AppRoute;
  /** Extra string-only FCM data (never secrets or personal details). */
  data?: Record<string, string>;
};

export type ReminderState = 'none' | 'pending' | 'sent' | 'expired' | 'cancelled';

export type BookingRecord = BookingDetails & {
  status: 'confirmed' | 'cancelled' | 'removed';
  reminderAt: number | null;
  reminderState: ReminderState;
  lastEventAt: number;
  updatedAt: number;
};

export type DeviceRecord = { id: string; token: string; platform: DevicePlatform };

export type ClaimResult =
  | { state: 'claimed' }
  | { state: 'done'; result: unknown }
  | { state: 'busy' }
  | { state: 'conflict' };

export interface NotificationStore {
  claimEvent(eventId: string, type: string, payloadHash: string, now: number): Promise<ClaimResult>;
  completeEvent(eventId: string, result: unknown, now: number): Promise<void>;
  releaseEvent(eventId: string): Promise<void>;
  registerDevice(userId: number, token: string, platform: DevicePlatform, now: number): Promise<void>;
  unregisterDevice(userId: number, token: string): Promise<void>;
  listDevices(userId: number): Promise<DeviceRecord[]>;
  removeDevices(userId: number, deviceIds: string[]): Promise<void>;
  getPreferences(userId: number): Promise<Preferences>;
  setPreferences(userId: number, preferences: Partial<Preferences>, now: number): Promise<Preferences>;
  listMarketingUserIds(): Promise<number[]>;
  /** Atomically replaces a booking record; return null from `update` to leave it unchanged. */
  updateBooking(bookingId: number, update: (previous: BookingRecord | null) => BookingRecord | null): Promise<BookingRecord | null>;
  /** Atomically moves due reminders out of `pending` and returns the ones that should be sent. */
  claimDueReminders(now: number, limit: number): Promise<BookingRecord[]>;
}

export type OutgoingMessage = {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
  android: { priority: 'high' | 'normal'; notification: { channelId: string; sound: 'default' } };
  apns: { payload: { aps: { sound: 'default' } } };
};

export type SendOutcome = { ok: true } | { ok: false; code: string };

export interface MessageSender {
  sendEach(messages: OutgoingMessage[]): Promise<SendOutcome[]>;
  /** Asks FCM whether a token is still accepted, without showing anything on the device. */
  validateToken(token: string): Promise<SendOutcome>;
}

export type Logger = {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

export type DeliveryMode = 'test' | 'live';

export type Deps = {
  store: NotificationStore;
  sender: MessageSender;
  mode: DeliveryMode;
  testUserIds: ReadonlySet<number>;
  now: () => number;
  log: Logger;
};
