import type { Logger } from './types.ts';

/** Firestore document an administrator edits in the Firebase Console to refresh all public app content. */
export const PUBLIC_CONTENT_DOCUMENT = 'appConfig/publicContent';
/** Every app installation subscribes to this topic; it carries no personal data. */
export const PUBLIC_CONTENT_TOPIC = 'public-content';
export const CONTENT_REFRESH_TYPE = 'content_refresh';

/** Accepts a non-negative integer or a short token such as "2026-11-01.1". Must match the app's normalizeContentVersion. */
export function parseContentVersion(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{1,64}$/.test(trimmed) ? trimmed : null;
}

export type ContentRefreshMessage = {
  topic: string;
  data: { type: string; version: string };
  android: { priority: 'high'; collapseKey: string; ttl: number };
  apns: { headers: Record<string, string>; payload: { aps: { contentAvailable: true } } };
};

/** Silent, data-only message: no alert, sound or tray entry, and never added to notification history. */
export function contentRefreshMessage(version: string): ContentRefreshMessage {
  return {
    topic: PUBLIC_CONTENT_TOPIC,
    data: { type: CONTENT_REFRESH_TYPE, version },
    android: { priority: 'high', collapseKey: PUBLIC_CONTENT_TOPIC, ttl: 7 * 24 * 60 * 60 * 1000 },
    apns: {
      headers: { 'apns-push-type': 'background', 'apns-priority': '5', 'apns-collapse-id': PUBLIC_CONTENT_TOPIC },
      payload: { aps: { contentAvailable: true } },
    },
  };
}

export type ContentVersionChange = {
  before: Record<string, unknown> | undefined;
  after: Record<string, unknown> | undefined;
};

/** Sends one topic message when the document's version changes. Returns the version sent, if any. */
export async function handleContentVersionWrite(
  change: ContentVersionChange,
  send: (message: ContentRefreshMessage) => Promise<string>,
  log: Logger,
): Promise<string | null> {
  if (!change.after) {
    log.info('Public content version document deleted; apps keep their cached content.');
    return null;
  }
  const version = parseContentVersion(change.after.version);
  if (version === null) {
    log.error('Ignoring public content version: set "version" to a whole number or a short token (letters, numbers, . _ : -).');
    return null;
  }
  if (version === parseContentVersion(change.before?.version)) return null;
  const messageId = await send(contentRefreshMessage(version));
  log.info('Public content refresh sent.', { version, messageId });
  return version;
}
