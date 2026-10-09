import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';

import { PushListeners, PushMessage, PushState } from './types';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const pushUnavailableReason = isExpoGo ? 'Firebase push requires a rebuilt development client or production app; it does not work in Expo Go.' : '';

async function loadMessaging() {
  const sdk = await import('@react-native-firebase/messaging');
  return { sdk, messaging: sdk.getMessaging() };
}

export async function readPushState(requestPermission = false): Promise<PushState> {
  if (isExpoGo) return { permission: 'unsupported', token: null };
  const notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    // Channel ids must match ANDROID_CHANNELS in functions/src/messages.ts.
    const channels = [
      { id: 'ttn-bookings', name: 'Bookings and reminders', description: 'Booking confirmations, changes, cancellations and 15-minute reminders.', importance: notifications.AndroidImportance.HIGH },
      { id: 'ttn-account', name: 'Account messages', description: 'Important messages about your Tee Time Nexus account.', importance: notifications.AndroidImportance.DEFAULT },
      { id: 'ttn-marketing', name: 'Offers and news', description: 'Promotions and club news you opted into.', importance: notifications.AndroidImportance.LOW },
      { id: 'ttn-updates', name: 'Tee Time Nexus updates', description: 'General updates.', importance: notifications.AndroidImportance.HIGH },
    ];
    await Promise.all(channels.map(({ id, ...channel }) => notifications.setNotificationChannelAsync(id, { ...channel, sound: 'default' })));
  }
  const settings = requestPermission
    ? await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } })
    : await notifications.getPermissionsAsync();
  const status = settings.ios?.status;
  const permission = status === notifications.IosAuthorizationStatus.PROVISIONAL
    ? 'provisional'
    : settings.granted ? 'authorized'
      : settings.status === 'undetermined' ? 'not-determined' : 'denied';
  if (permission !== 'authorized' && permission !== 'provisional') return { permission, token: null };
  if (Platform.OS === 'ios' && !isDevice) {
    return {
      permission,
      token: null,
      notice: 'Notification permission is granted. Firebase push delivery requires a physical iPhone; APNs registration is unavailable in this simulator.',
    };
  }
  try {
    const { sdk, messaging } = await loadMessaging();
    if (Platform.OS === 'ios' && !messaging.isDeviceRegisteredForRemoteMessages) {
      await sdk.registerDeviceForRemoteMessages(messaging);
    }
    const token = await sdk.getToken(messaging);
    if (!token) throw new Error('Firebase did not return a device token. Check the Firebase configuration and rebuild the app.');
    return { permission, token };
  } catch (err) {
    return {
      permission,
      token: null,
      connectionError: err instanceof Error ? err.message : 'Unable to obtain a Firebase device token.',
    };
  }
}

export async function releasePushToken() {
  if (isExpoGo) return;
  const { sdk, messaging } = await loadMessaging();
  await sdk.deleteToken(messaging);
}

export async function listenForPush(listeners: PushListeners): Promise<() => void> {
  if (isExpoGo) return () => {};
  const { sdk, messaging } = await loadMessaging();
  const toMessage = (message: { notification?: { title?: string; body?: string }; data?: { [key: string]: string | object } }): PushMessage => ({
    title: message.notification?.title,
    body: message.notification?.body,
    route: message.data?.route,
  });
  const unsubscribeMessage = sdk.onMessage(messaging, (message) => {
    if (message.notification) listeners.onMessage(toMessage(message));
  });
  const unsubscribeOpen = sdk.onNotificationOpenedApp(messaging, (message) => listeners.onOpen(toMessage(message)));
  const unsubscribeToken = sdk.onTokenRefresh(messaging, () => listeners.onTokenRefresh());
  const unsubscribe = () => { unsubscribeMessage(); unsubscribeOpen(); unsubscribeToken(); };
  try {
    const initial = await sdk.getInitialNotification(messaging);
    if (initial) listeners.onOpen(toMessage(initial));
    return unsubscribe;
  } catch (error) {
    unsubscribe();
    throw error;
  }
}
