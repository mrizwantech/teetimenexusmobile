import { parseHoursContent } from './hours-content';
import { apiRequest } from './client';
import { publicContentCache } from './public-content-cache';

const load = publicContentCache.define('hours', {
  request: () => apiRequest<unknown>('/wp-json/ttn/v1/hours', { cache: 'no-store' }),
  parse: parseHoursContent,
});

export function getHoursContent(forceRefresh = false) {
  return load(forceRefresh);
}
