import KisiAccessModule from './src/KisiAccessModule';
import appConfig from '../../app.json';
import type { KisiDeviceCredential } from './src/KisiAccess.types';
import { PermissionsAndroid, Platform } from 'react-native';
import { waitForReaderProof } from './src/reader-proof';

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

export function isKisiAvailable() {
  return typeof KisiAccessModule?.startReaderScan === 'function'
    && typeof KisiAccessModule?.proximityProof === 'function';
}

export async function startKisiReaderScan() {
  if (!KisiAccessModule) throw new Error('Reader scanning requires a rebuilt native app.');
  if (Platform.OS === 'android') {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ...(Number(Platform.Version) >= 31 ? [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      ] : []),
    ];
    const results = await PermissionsAndroid.requestMultiple(permissions);
    if (permissions.some((permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('Allow location and nearby-device permissions in device settings to use the entrance reader.');
    }
  }
  await KisiAccessModule.startReaderScan();
}

export async function stopKisiReaderScan() {
  if (KisiAccessModule) await KisiAccessModule.stopReaderScan();
}

export async function getKisiProximityProof(lockId: number, ensureActive: () => void = () => {}) {
  if (!KisiAccessModule) throw new Error('Reader scanning requires a rebuilt native app.');
  const nativeModule = KisiAccessModule;
  return waitForReaderProof(async () => {
    ensureActive();
    return nativeModule.proximityProof(lockId);
  });
}

export function onKisiReaderError(listener: (event: { message: string }) => void) {
  if (!KisiAccessModule) throw new Error('The native Kisi module is not installed in this app build.');
  return KisiAccessModule.addListener('onReaderError', listener);
}
