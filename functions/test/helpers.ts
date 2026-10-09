import { reminderOutcome } from '../src/handlers.ts';
import { sha256Hex } from '../src/signature.ts';
import {
  DEFAULT_PREFERENCES,
  type BookingRecord,
  type ClaimResult,
  type Deps,
  type DevicePlatform,
  type DeviceRecord,
  type MessageSender,
  type NotificationStore,
  type OutgoingMessage,
  type Preferences,
  type SendOutcome,
} from '../src/types.ts';

type EventRow = { payloadHash: string; status: 'processing' | 'done' | 'failed'; leaseUntil: number; result?: unknown };

/** In-memory twin of FirestoreNotificationStore with the same semantics. */
export class MemoryStore implements NotificationStore {
  events = new Map<string, EventRow>();
  devices = new Map<number, Map<string, DeviceRecord>>();
  owners = new Map<string, number>();
  preferences = new Map<number, Preferences>();
  bookings = new Map<number, BookingRecord>();

  async claimEvent(eventId: string, _type: string, payloadHash: string, now: number): Promise<ClaimResult> {
    const row = this.events.get(eventId);
    if (row) {
      if (row.payloadHash !== payloadHash) return { state: 'conflict' };
      if (row.status === 'done') return { state: 'done', result: row.result };
      if (row.status === 'processing' && row.leaseUntil > now) return { state: 'busy' };
    }
    this.events.set(eventId, { payloadHash, status: 'processing', leaseUntil: now + 120_000 });
    return { state: 'claimed' };
  }

  async completeEvent(eventId: string, result: unknown): Promise<void> {
    const row = this.events.get(eventId)!;
    this.events.set(eventId, { ...row, status: 'done', result: structuredClone(result) });
  }

  async releaseEvent(eventId: string): Promise<void> {
    const row = this.events.get(eventId)!;
    this.events.set(eventId, { ...row, status: 'failed', leaseUntil: 0 });
  }

  async registerDevice(userId: number, token: string, platform: DevicePlatform): Promise<void> {
    const id = sha256Hex(token);
    const previous = this.owners.get(id);
    if (previous !== undefined && previous !== userId) this.devices.get(previous)?.delete(id);
    this.owners.set(id, userId);
    const devices = this.devices.get(userId) ?? new Map<string, DeviceRecord>();
    devices.set(id, { id, token, platform });
    this.devices.set(userId, devices);
  }

  async unregisterDevice(userId: number, token: string): Promise<void> {
    const id = sha256Hex(token);
    if (this.owners.get(id) === userId) this.owners.delete(id);
    this.devices.get(userId)?.delete(id);
  }

  async listDevices(userId: number): Promise<DeviceRecord[]> {
    return [...(this.devices.get(userId)?.values() ?? [])];
  }

  async removeDevices(userId: number, deviceIds: string[]): Promise<void> {
    for (const id of deviceIds) {
      if (this.owners.get(id) === userId) this.owners.delete(id);
      this.devices.get(userId)?.delete(id);
    }
  }

  async getPreferences(userId: number): Promise<Preferences> {
    return { ...DEFAULT_PREFERENCES, ...this.preferences.get(userId) };
  }

  async setPreferences(userId: number, preferences: Partial<Preferences>): Promise<Preferences> {
    const next = { ...(await this.getPreferences(userId)), ...preferences };
    this.preferences.set(userId, next);
    return next;
  }

  async listMarketingUserIds(): Promise<number[]> {
    return [...this.preferences.entries()].filter(([, value]) => value.marketing).map(([id]) => id);
  }

  async updateBooking(bookingId: number, update: (previous: BookingRecord | null) => BookingRecord | null): Promise<BookingRecord | null> {
    const next = update(this.bookings.get(bookingId) ?? null);
    if (next) this.bookings.set(bookingId, next);
    return next;
  }

  async claimDueReminders(now: number, limit: number): Promise<BookingRecord[]> {
    const due = [...this.bookings.values()]
      .filter((record) => record.reminderState === 'pending' && record.reminderAt !== null && record.reminderAt <= now)
      .slice(0, limit);
    const claimed: BookingRecord[] = [];
    for (const record of due) {
      const outcome = reminderOutcome(record, now);
      this.bookings.set(record.bookingId, { ...record, reminderState: outcome });
      if (outcome === 'sent') claimed.push(record);
    }
    return claimed;
  }
}

export class FakeSender implements MessageSender {
  sent: OutgoingMessage[] = [];
  failures = new Map<string, string>();

  async sendEach(messages: OutgoingMessage[]): Promise<SendOutcome[]> {
    return messages.map((message) => {
      const code = this.failures.get(message.token);
      if (code) return { ok: false, code };
      this.sent.push(message);
      return { ok: true };
    });
  }

  async validateToken(token: string): Promise<SendOutcome> {
    const code = this.failures.get(token);
    return code ? { ok: false, code } : { ok: true };
  }
}

export const silentLog = { info() {}, warn() {}, error() {} };

export function makeDeps(overrides: Partial<Deps> & { clock?: { now: number } } = {}) {
  const clock = overrides.clock ?? { now: Date.parse('2026-10-08T16:00:00Z') };
  const store = (overrides.store as MemoryStore | undefined) ?? new MemoryStore();
  const sender = (overrides.sender as FakeSender | undefined) ?? new FakeSender();
  const deps: Deps = {
    store,
    sender,
    mode: overrides.mode ?? 'test',
    testUserIds: overrides.testUserIds ?? new Set([7, 8]),
    now: () => clock.now,
    log: silentLog,
  };
  return { deps, store, sender, clock };
}
