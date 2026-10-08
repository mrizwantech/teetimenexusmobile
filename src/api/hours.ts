import { parseHoursContent } from './hours-content';
import { apiRequest } from './client';
import { getCachedPublicContent, PUBLIC_CONTENT_CACHE_MAX_AGE_MS } from './public-content-cache';

export function getHoursContent(forceRefresh = false) {
  return getCachedPublicContent({
    key: 'hours',
    maxAgeMs: PUBLIC_CONTENT_CACHE_MAX_AGE_MS,
    request: () => apiRequest<unknown>('/wp-json/ttn/v1/hours'),
    parse: parseHoursContent,
    forceRefresh,
  });
}
