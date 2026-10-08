import { parseHomeContent } from './home-content';
import { apiRequest } from './client';
import { getCachedPublicContent, PUBLIC_CONTENT_CACHE_MAX_AGE_MS } from './public-content-cache';

export function getHomeContent(forceRefresh = false) {
  return getCachedPublicContent({
    key: 'home',
    maxAgeMs: PUBLIC_CONTENT_CACHE_MAX_AGE_MS,
    request: () => apiRequest<unknown>('/wp-json/ttn/v1/home'),
    parse: parseHomeContent,
    forceRefresh,
  });
}
