import { getNotificationRoute } from './routes';
import type { NotificationRoute } from './routes';
import type { PushMessage } from './types';

export const HISTORY_LIMIT = 100;

export type NotificationEntry = {
  id: string;
  title: string;
  body: string;
  route: NotificationRoute;
  receivedAt: number;
  read: boolean;
};

export function notificationEntry(message: PushMessage, read = false, now = Date.now()): NotificationEntry {
  const title = message.title || 'Tee Time Nexus';
  const body = message.body || 'You have a new notification.';
  const receivedAt = message.sentAt && Number.isFinite(message.sentAt) && message.sentAt > 0 ? message.sentAt : now;
  return {
    id: message.id || JSON.stringify([receivedAt, title, body, message.route]),
    title,
    body,
    route: getNotificationRoute(message.route) ?? '/',
    receivedAt,
    read,
  };
}

export function mergeNotification(history: NotificationEntry[], entry: NotificationEntry): NotificationEntry[] {
  const previous = history.find((item) => item.id === entry.id);
  if (previous && (previous.read || !entry.read)) return history;
  return [
    ...history.filter((item) => item.id !== entry.id),
    previous ? { ...previous, read: previous.read || entry.read } : entry,
  ].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, HISTORY_LIMIT);
}

export function markNotificationsRead(history: NotificationEntry[], id?: string): NotificationEntry[] {
  return history.map((entry) => id === undefined || entry.id === id ? { ...entry, read: true } : entry);
}

export function unreadNotificationCount(history: NotificationEntry[]): number {
  return history.filter((entry) => !entry.read).length;
}

export function notificationBadge(count: number): string | null {
  return count > 1 ? count > 99 ? '99+' : String(count) : null;
}

export function parseNotificationHistory(raw: string | null): NotificationEntry[] {
  if (raw === null) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.some((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return true;
    const item = entry as Record<string, unknown>;
    return typeof item.id !== 'string' || !item.id
      || typeof item.title !== 'string' || typeof item.body !== 'string'
      || !getNotificationRoute(item.route)
      || typeof item.receivedAt !== 'number' || !Number.isFinite(item.receivedAt) || item.receivedAt <= 0
      || typeof item.read !== 'boolean';
  })) throw new Error('Saved notification history is invalid.');
  return entries.reduce<NotificationEntry[]>((history, entry: NotificationEntry) => mergeNotification(history, entry), []);
}
