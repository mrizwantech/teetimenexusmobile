export type PushPreferences = {
  booking_updates: boolean;
  booking_reminders: boolean;
  marketing: boolean;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  booking_updates: true,
  booking_reminders: true,
  marketing: false,
};

export const PUSH_PREFERENCE_KEYS = ['booking_updates', 'booking_reminders', 'marketing'] as const;

export function parsePushPreferences(value: unknown): PushPreferences {
  const preferences = typeof value === 'object' && value !== null ? (value as { preferences?: unknown }).preferences : undefined;
  if (typeof preferences !== 'object' || preferences === null) throw new Error('Notification preferences are unavailable right now.');
  const record = preferences as Record<string, unknown>;
  const parsed = { ...DEFAULT_PUSH_PREFERENCES };
  for (const key of PUSH_PREFERENCE_KEYS) {
    if (typeof record[key] !== 'boolean') throw new Error('Notification preferences are unavailable right now.');
    parsed[key] = record[key];
  }
  return parsed;
}

export type DeviceRegistration = { userId: number; token: string };

export function needsRegistration(current: DeviceRegistration | null, userId: number | null | undefined, token: string | null | undefined) {
  if (!userId || !token) return false;
  return current?.userId !== userId || current.token !== token;
}

/** True only when the website says Firebase rejected this token; older websites return { registered: true }. */
export function isRejectedRegistration(value: unknown) {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { registered?: unknown; reason?: unknown };
  return record.registered === false && record.reason === 'invalid_token';
}
