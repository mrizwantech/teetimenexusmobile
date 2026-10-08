import { apiRequest } from './client';
import { parseCompetitions } from './competitions-content';

export async function getCompetitions() {
  return parseCompetitions(await apiRequest<unknown>('/wp-json/ttn/v1/competitions?limit=50'));
}

export type { Competition, CompetitionType, CompetitionsResponse } from './competitions-content';
