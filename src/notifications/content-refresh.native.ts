import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';

import { contentRefreshVersion, PUBLIC_CONTENT_TOPIC } from './content-refresh-message';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Subscribes this installation (guest or signed in) to silent content-refresh messages. No notification
 * permission is requested; iOS registers for remote messages, which does not prompt the user.
 */
export async function subscribeToContentRefresh() {
  // The iOS Simulator cannot register with APNs; launch/foreground version checks still apply.
  if (isExpoGo || (Platform.OS === 'ios' && !isDevice)) return;
  const sdk = await import('@react-native-firebase/messaging');
  const messaging = sdk.getMessaging();
  if (Platform.OS === 'ios' && !messaging.isDeviceRegisteredForRemoteMessages) {
    await sdk.registerDeviceForRemoteMessages(messaging);
  }
  await sdk.subscribeToTopic(messaging, PUBLIC_CONTENT_TOPIC);
}

export async function listenForContentRefresh(onVersion: (version: string) => void): Promise<() => void> {
  if (isExpoGo) return () => {};
  const sdk = await import('@react-native-firebase/messaging');
  const messaging = sdk.getMessaging();
  const unsubscribeMessage = sdk.onMessage(messaging, (message) => {
    const version = contentRefreshVersion(message.data);
    if (version) onVersion(version);
  });
  // A replacement token (for example after sign-out deletes the old one) loses topic subscriptions.
  const unsubscribeToken = sdk.onTokenRefresh(messaging, () => {
    subscribeToContentRefresh().catch((error: unknown) => console.warn('Unable to subscribe to content updates.', error));
  });
  return () => { unsubscribeMessage(); unsubscribeToken(); };
}
