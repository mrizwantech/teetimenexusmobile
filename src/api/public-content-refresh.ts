// Importing every public content module registers its cache source so a refresh covers all of them,
// including in Firebase's background handler where no screen has loaded yet.
import './booking';
import './competitions';
import './home';
import './hours';
import './membership';
import { parseContentVersionResponse } from '../notifications/content-refresh-message';
import { publicContentCache } from './public-content-cache';

export const CONTENT_VERSION_URL = process.env.EXPO_PUBLIC_CONTENT_VERSION_URL
  ?? 'https://us-east1-tee-time-nexus.cloudfunctions.net/publicContentVersion';

export async function fetchPublicContentVersion(): Promise<string | null> {
  const response = await fetch(CONTENT_VERSION_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`The content version service failed with status ${response.status}.`);
  return parseContentVersionResponse(await response.json());
}

export function applyPublicContentVersion(version: unknown) {
  return publicContentCache.applyVersion(version);
}

/** Checks the published version and refreshes outdated entries; previously failed refreshes are retried. */
export async function checkPublicContentVersion() {
  const version = await fetchPublicContentVersion();
  return version === null ? publicContentCache.refreshOutdated() : publicContentCache.applyVersion(version);
}

export function onPublicContentUpdated(key: string, listener: (value: unknown) => void) {
  return publicContentCache.subscribe((updatedKey, value) => {
    if (updatedKey === key) listener(value);
  });
}
