import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';

import { reminderOutcome } from './handlers.ts';
import { sha256Hex } from './signature.ts';
import {
  DEFAULT_PREFERENCES,
  type BookingRecord,
  type ClaimResult,
  type DevicePlatform,
  type DeviceRecord,
  type NotificationStore,
  type Preferences,
} from './types.ts';

const EVENT_LEASE_MS = 2 * 60 * 1000;
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DEVICES_PER_USER = 10;

const userDocId = (userId: number) => `wp_${userId}`;
const toTimestamp = (millis: number | null) => (millis === null ? null : Timestamp.fromMillis(millis));
const toMillis = (value: unknown): number | null => (value instanceof Timestamp ? value.toMillis() : null);

function readPreferences(value: unknown): Preferences {
  const stored = (value ?? {}) as Partial<Record<keyof Preferences, unknown>>;
  return {
    bookingUpdates: typeof stored.bookingUpdates === 'boolean' ? stored.bookingUpdates : DEFAULT_PREFERENCES.bookingUpdates,
    bookingReminders: typeof stored.bookingReminders === 'boolean' ? stored.bookingReminders : DEFAULT_PREFERENCES.bookingReminders,
    marketing: typeof stored.marketing === 'boolean' ? stored.marketing : DEFAULT_PREFERENCES.marketing,
  };
}

function bookingToDoc(record: BookingRecord) {
  return {
    bookingId: record.bookingId,
    customerId: record.customerId,
    startAt: toTimestamp(record.startAt),
    endAt: toTimestamp(record.endAt),
    timezone: record.timezone,
    bay: record.bay,
    status: record.status,
    reminderAt: toTimestamp(record.reminderAt),
    reminderState: record.reminderState,
    lastEventAt: toTimestamp(record.lastEventAt),
    updatedAt: toTimestamp(record.updatedAt),
  };
}

function bookingFromDoc(data: DocumentData): BookingRecord {
  return {
    bookingId: data.bookingId,
    customerId: data.customerId,
    startAt: toMillis(data.startAt) ?? 0,
    endAt: toMillis(data.endAt) ?? 0,
    timezone: data.timezone,
    bay: data.bay,
    status: data.status,
    reminderAt: toMillis(data.reminderAt),
    reminderState: data.reminderState,
    lastEventAt: toMillis(data.lastEventAt) ?? 0,
    updatedAt: toMillis(data.updatedAt) ?? 0,
  };
}

export class FirestoreNotificationStore implements NotificationStore {
  private readonly db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  private eventRef(eventId: string) {
    return this.db.collection('wpEvents').doc(sha256Hex(eventId));
  }

  private userRef(userId: number) {
    return this.db.collection('users').doc(userDocId(userId));
  }

  async claimEvent(eventId: string, type: string, payloadHash: string, now: number): Promise<ClaimResult> {
    const ref = this.eventRef(eventId);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = snapshot.data();
      if (data) {
        if (data.payloadHash !== payloadHash) return { state: 'conflict' } as const;
        if (data.status === 'done') return { state: 'done', result: data.result ?? null } as const;
        if (data.status === 'processing' && (toMillis(data.leaseUntil) ?? 0) > now) return { state: 'busy' } as const;
      }
      tx.set(ref, {
        type,
        payloadHash,
        status: 'processing',
        leaseUntil: Timestamp.fromMillis(now + EVENT_LEASE_MS),
        createdAt: data?.createdAt ?? Timestamp.fromMillis(now),
        expireAt: Timestamp.fromMillis(now + EVENT_RETENTION_MS),
      });
      return { state: 'claimed' } as const;
    });
  }

  async completeEvent(eventId: string, result: unknown, now: number): Promise<void> {
    await this.eventRef(eventId).update({ status: 'done', result, completedAt: Timestamp.fromMillis(now), leaseUntil: FieldValue.delete() });
  }

  async releaseEvent(eventId: string): Promise<void> {
    await this.eventRef(eventId).update({ status: 'failed', leaseUntil: Timestamp.fromMillis(0) });
  }

  async registerDevice(userId: number, token: string, platform: DevicePlatform, now: number): Promise<void> {
    const deviceId = sha256Hex(token);
    const ownerRef = this.db.collection('deviceOwners').doc(deviceId);
    const userRef = this.userRef(userId);
    const deviceRef = userRef.collection('devices').doc(deviceId);
    await this.db.runTransaction(async (tx) => {
      const [owner, device] = await Promise.all([tx.get(ownerRef), tx.get(deviceRef)]);
      const previousOwner = owner.data()?.wpUserId;
      // A phone signed into a new account must stop receiving the previous account's notifications.
      if (typeof previousOwner === 'number' && previousOwner !== userId) {
        tx.delete(this.userRef(previousOwner).collection('devices').doc(deviceId));
      }
      tx.set(ownerRef, { wpUserId: userId, updatedAt: Timestamp.fromMillis(now) });
      tx.set(userRef, { wpUserId: userId, updatedAt: Timestamp.fromMillis(now) }, { merge: true });
      tx.set(deviceRef, {
        token,
        platform,
        createdAt: device.data()?.createdAt ?? Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
    });

    const devices = await userRef.collection('devices').orderBy('updatedAt', 'desc').get();
    const extra = devices.docs.slice(MAX_DEVICES_PER_USER).map((doc) => doc.id);
    if (extra.length > 0) await this.removeDevices(userId, extra);
  }

  async unregisterDevice(userId: number, token: string): Promise<void> {
    const deviceId = sha256Hex(token);
    const ownerRef = this.db.collection('deviceOwners').doc(deviceId);
    await this.db.runTransaction(async (tx) => {
      const owner = await tx.get(ownerRef);
      if (owner.data()?.wpUserId === userId) tx.delete(ownerRef);
      tx.delete(this.userRef(userId).collection('devices').doc(deviceId));
    });
  }

  async listDevices(userId: number): Promise<DeviceRecord[]> {
    const snapshot = await this.userRef(userId).collection('devices').get();
    return snapshot.docs.flatMap((doc) => {
      const data = doc.data();
      return typeof data.token === 'string' && (data.platform === 'ios' || data.platform === 'android')
        ? [{ id: doc.id, token: data.token, platform: data.platform }]
        : [];
    });
  }

  async removeDevices(userId: number, deviceIds: string[]): Promise<void> {
    for (const deviceId of deviceIds) {
      const ownerRef = this.db.collection('deviceOwners').doc(deviceId);
      await this.db.runTransaction(async (tx) => {
        const owner = await tx.get(ownerRef);
        if (owner.data()?.wpUserId === userId) tx.delete(ownerRef);
        tx.delete(this.userRef(userId).collection('devices').doc(deviceId));
      });
    }
  }

  async getPreferences(userId: number): Promise<Preferences> {
    const snapshot = await this.userRef(userId).get();
    return readPreferences(snapshot.data()?.preferences);
  }

  async setPreferences(userId: number, preferences: Partial<Preferences>, now: number): Promise<Preferences> {
    const ref = this.userRef(userId);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const next = { ...readPreferences(snapshot.data()?.preferences), ...preferences };
      tx.set(ref, { wpUserId: userId, preferences: next, updatedAt: Timestamp.fromMillis(now) }, { merge: true });
      return next;
    });
  }

  async listMarketingUserIds(): Promise<number[]> {
    const snapshot = await this.db.collection('users').where('preferences.marketing', '==', true).select('wpUserId').get();
    return snapshot.docs.map((doc) => doc.data().wpUserId).filter((id): id is number => Number.isSafeInteger(id) && id > 0);
  }

  async updateBooking(bookingId: number, update: (previous: BookingRecord | null) => BookingRecord | null): Promise<BookingRecord | null> {
    const ref = this.db.collection('bookings').doc(String(bookingId));
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const next = update(snapshot.exists ? bookingFromDoc(snapshot.data()!) : null);
      if (next) tx.set(ref, bookingToDoc(next));
      return next;
    });
  }

  async claimDueReminders(now: number, limit: number): Promise<BookingRecord[]> {
    const due = await this.db.collection('bookings')
      .where('reminderState', '==', 'pending')
      .where('reminderAt', '<=', Timestamp.fromMillis(now))
      .orderBy('reminderAt')
      .limit(limit)
      .get();
    const claimed: BookingRecord[] = [];
    for (const doc of due.docs) {
      const record = await this.db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists) return null;
        const current = bookingFromDoc(fresh.data()!);
        if (current.reminderState !== 'pending' || current.reminderAt === null || current.reminderAt > now) return null;
        const outcome = reminderOutcome(current, now);
        // Marked before sending so overlapping scheduler runs can never send a reminder twice.
        tx.update(doc.ref, { reminderState: outcome, reminderProcessedAt: Timestamp.fromMillis(now) });
        return outcome === 'sent' ? current : null;
      });
      if (record) claimed.push(record);
    }
    return claimed;
  }
}
