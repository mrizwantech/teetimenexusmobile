import { parseCompetitions } from './competitions-content';
import { apiRequest } from './client';
import { publicContentCache } from './public-content-cache';

const load = publicContentCache.define('competitions', {
  request: () => apiRequest<unknown>('/wp-json/ttn/v1/competitions?limit=50', { cache: 'no-store' }),
  parse: parseCompetitions,
});

export function getCompetitions(forceRefresh = false) {
  return load(forceRefresh);
}

export type { Competition, CompetitionType, CompetitionsResponse } from './competitions-content';
