import { normalizeContentVersion } from '../api/content-cache';

export const PUBLIC_CONTENT_TOPIC = 'public-content';

/** Returns the version from a silent `content_refresh` data message, or null for any other message. */
export function contentRefreshVersion(data: Record<string, unknown> | undefined): string | null {
  return data?.type === 'content_refresh' ? normalizeContentVersion(data.version) : null;
}

/** `null` means no version has been published yet, so cached content stays as-is. */
export function parseContentVersionResponse(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('version' in body)) {
    throw new Error('The content version service returned an invalid response.');
  }
  if (body.version === null) return null;
  const version = normalizeContentVersion(body.version);
  if (version === null) throw new Error('The content version service returned an invalid version.');
  return version;
}
