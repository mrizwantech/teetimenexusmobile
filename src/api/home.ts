import { parseHomeContent } from './home-content';
import { apiRequest } from './client';
import { publicContentCache } from './public-content-cache';

const load = publicContentCache.define('home', {
  request: () => apiRequest<unknown>('/wp-json/ttn/v1/home', { cache: 'no-store' }),
  parse: parseHomeContent,
});

export function getHomeContent(forceRefresh = false) {
  return load(forceRefresh);
}
