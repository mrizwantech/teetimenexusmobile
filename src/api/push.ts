import { Platform } from 'react-native';

import { apiRequest } from './client';
import { isRejectedRegistration, parsePushPreferences, PushPreferences } from './push-rules';

export type { PushPreferences } from './push-rules';

/** Returns false when Firebase no longer accepts this token and the app must fetch a fresh one. */
export async function registerPushDevice(token: string) {
  const result = await apiRequest<unknown>('/wp-json/ttn/v1/push/devices', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ token, platform: Platform.OS }),
  });
  return !isRejectedRegistration(result);
}

export async function unregisterPushDevice(token: string) {
  await apiRequest<unknown>('/wp-json/ttn/v1/push/devices/unregister', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ token }),
  });
}

export async function getPushPreferences() {
  return parsePushPreferences(await apiRequest<unknown>('/wp-json/ttn/v1/push/preferences', { cache: 'no-store' }));
}

export async function setPushPreferences(changes: Partial<PushPreferences>) {
  return parsePushPreferences(await apiRequest<unknown>('/wp-json/ttn/v1/push/preferences', {
    method: 'POST', cache: 'no-store', body: JSON.stringify(changes),
  }));
}
