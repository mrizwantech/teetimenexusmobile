import { apiRequest } from './client';
import { parseTechnologyContent } from './technology-content';

export async function getTechnologyContent() {
  return parseTechnologyContent(await apiRequest<unknown>('/wp-json/ttn/v1/technology'));
}
