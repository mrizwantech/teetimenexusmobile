import { apiRequest } from './client';
import { parseHomeContent } from './home-content';

export async function getHomeContent() {
  return parseHomeContent(await apiRequest<unknown>('/wp-json/ttn/v1/home'));
}
