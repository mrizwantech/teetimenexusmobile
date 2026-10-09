import { registerPushDevice, unregisterPushDevice } from '../api/push';
import { DeviceRegistration, needsRegistration } from '../api/push-rules';
import { releasePushToken } from './push';

// The device token is linked to the signed-in account on the server so notifications are personal.
let registered: DeviceRegistration | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out.')), ms))]);
}

export async function syncDeviceRegistration(userId: number | null | undefined, token: string | null | undefined) {
  if (!userId || !token || !needsRegistration(registered, userId, token)) return;
  await registerPushDevice(token);
  registered = { userId, token };
}

/** Called before sign-out so this phone stops receiving the account's notifications. */
export async function releasePushDevice() {
  const current = registered;
  registered = null;
  if (current) await withTimeout(unregisterPushDevice(current.token), 5000).catch(() => undefined);
  // Deleting the token guarantees the old account can't reach this phone even if the server call failed.
  await withTimeout(releasePushToken(), 5000).catch(() => undefined);
}
