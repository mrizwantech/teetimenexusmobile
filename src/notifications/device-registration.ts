import { registerPushDevice, unregisterPushDevice } from '../api/push';
import { DeviceRegistration, needsRegistration } from '../api/push-rules';
import { releasePushToken } from './push';

// The device token is linked to the signed-in account on the server so notifications are personal.
let registered: DeviceRegistration | null = null;
// Tokens already renewed this session, so a rejected token is only replaced once and can't loop.
const renewedTokens = new Set<string>();

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out.')), ms))]);
}

/** Returns 'renew' when Firebase rejected the token; the caller should delete it and fetch a fresh one. */
export async function syncDeviceRegistration(userId: number | null | undefined, token: string | null | undefined): Promise<'ok' | 'renew'> {
  if (!userId || !token || !needsRegistration(registered, userId, token)) return 'ok';
  if (!(await registerPushDevice(token))) {
    if (renewedTokens.has(token)) throw new Error('This phone could not get a working notification token. Try again later.');
    renewedTokens.add(token);
    return 'renew';
  }
  registered = { userId, token };
  return 'ok';
}

/** Deletes the rejected token so Firebase issues a new one on the next read. */
export async function discardPushToken() {
  registered = null;
  await withTimeout(releasePushToken(), 5000);
}

/** Called before sign-out so this phone stops receiving the account's notifications. */
export async function releasePushDevice() {
  const current = registered;
  registered = null;
  if (current) await withTimeout(unregisterPushDevice(current.token), 5000).catch(() => undefined);
  // Deleting the token guarantees the old account can't reach this phone even if the server call failed.
  await withTimeout(releasePushToken(), 5000).catch(() => undefined);
}
