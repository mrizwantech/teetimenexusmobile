import { PushListeners, PushMessage, PushState } from './types';

export const pushUnavailableReason = 'Firebase push notifications are supported in the iOS and Android apps, not in the web version.';

export async function readPushState(_requestPermission = false): Promise<PushState> {
  return { permission: 'unsupported', token: null };
}

export async function releasePushToken() {}

export async function clearPresentedPush() {}

export async function readPresentedPush(_owner: string): Promise<PushMessage[]> {
  return [];
}

export async function listenForPush(_listeners: PushListeners): Promise<() => void> {
  return () => {};
}
