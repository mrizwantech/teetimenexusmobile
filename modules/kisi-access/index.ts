import KisiAccessModule from './src/KisiAccessModule';
import appConfig from '../../app.json';
import type { KisiDeviceCredential } from './src/KisiAccess.types';

export type { KisiDeviceCredential } from './src/KisiAccess.types';

export async function initializeKisi(credential: KisiDeviceCredential) {
  if (!KisiAccessModule) {
    throw new Error('Kisi requires a rebuilt iOS or Android development app. It is unavailable in Expo Go and on web.');
  }
  await KisiAccessModule.initialize(appConfig.expo.extra.kisi.partnerId, credential);
}

export async function clearKisiCredentials() {
  if (KisiAccessModule) await KisiAccessModule.clearCredentials();
}

export function onKisiUnlock(listener: (event: { success: boolean; error?: string }) => void) {
  if (!KisiAccessModule) throw new Error('The native Kisi module is not installed in this app build.');
  return KisiAccessModule.addListener('onUnlock', listener);
}
