import { parseCompetitions } from './competitions-content';
import { apiRequest } from './client';
import { getCachedPublicContent, PUBLIC_CONTENT_CACHE_MAX_AGE_MS } from './public-content-cache';

export function getCompetitions(forceRefresh = false) {
  return getCachedPublicContent({
    key: 'competitions',
    maxAgeMs: PUBLIC_CONTENT_CACHE_MAX_AGE_MS,
    request: () => apiRequest<unknown>('/wp-json/ttn/v1/competitions?limit=50'),
    parse: parseCompetitions,
    forceRefresh,
  });
}

export type { Competition, CompetitionType, CompetitionsResponse } from './competitions-content';
