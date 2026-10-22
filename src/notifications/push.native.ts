import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { PushListeners, PushMessage, PushState } from './types';
import { toPushMessage } from './message';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const pushUnavailableReason = isExpoGo ? 'Firebase push requires a rebuilt development client or production app; it does not work in Expo Go.' : '';
let initialNotificationRead = false;
let presentedQueue: Promise<unknown> = Promise.resolve();

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
    // Omitting `sound` uses the system default; on Android a string is resolved as a bundled raw sound file.
    await Promise.all(channels.map(({ id, ...channel }) => notifications.setNotificationChannelAsync(id, channel)));
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

export async function clearPresentedPush() {
  if (isExpoGo) return;
  const notifications = await import('expo-notifications');
  await notifications.dismissAllNotificationsAsync();
}

export async function readPresentedPush(owner: string): Promise<PushMessage[]> {
  if (isExpoGo) return [];
  const collect = presentedQueue.then(() => collectPresentedPush(owner));
  // Keep later refreshes retryable; each caller still receives its own error.
  presentedQueue = collect.catch(() => undefined);
  return collect;
}

async function collectPresentedPush(owner: string): Promise<PushMessage[]> {
  const notifications = await import('expo-notifications');
  const previousOwner = await SecureStore.getItemAsync('ttn_push_history_owner');
  if (previousOwner !== owner && (previousOwner !== null || owner === 'guest')) {
    await notifications.dismissAllNotificationsAsync();
  }
  await SecureStore.setItemAsync('ttn_push_history_owner', owner);
  return (await notifications.getPresentedNotificationsAsync()).flatMap(({ request, date }) => {
    const { content } = request;
    const trigger = request.trigger;
    const pushTrigger = trigger && 'type' in trigger && trigger.type === 'push' ? trigger : undefined;
    const remoteMessage = pushTrigger?.remoteMessage;
    const payload = pushTrigger?.payload;
    const data = { ...payload, ...content.data, ...remoteMessage?.data };
    const id = remoteMessage?.messageId ?? data['gcm.message_id'] ?? data['google.message_id'];
    const sentAt = remoteMessage?.sentTime ?? Number(data['google.sent_time']);
    // RNFirebase's Android tray entries omit delivery IDs; the background handler saves those.
    if (Platform.OS === 'android' && typeof id !== 'string') return [];
    return [{
      id: typeof id === 'string' ? id : request.identifier,
      sentAt: Number.isFinite(sentAt) && sentAt > 0 ? sentAt : date,
      title: content.title ?? undefined,
      body: content.body ?? undefined,
      route: data.route,
    }];
  });
}

export async function listenForPush(listeners: PushListeners): Promise<() => void> {
  if (isExpoGo) return () => {};
  const { sdk, messaging } = await loadMessaging();
  const unsubscribeMessage = sdk.onMessage(messaging, (message) => {
    if (message.notification) listeners.onMessage(toPushMessage(message));
  });
  const unsubscribeOpen = sdk.onNotificationOpenedApp(messaging, (message) => listeners.onOpen(toPushMessage(message)));
  const unsubscribeToken = sdk.onTokenRefresh(messaging, () => listeners.onTokenRefresh());
  const unsubscribe = () => { unsubscribeMessage(); unsubscribeOpen(); unsubscribeToken(); };
  try {
    const initial = initialNotificationRead ? null : await sdk.getInitialNotification(messaging);
    if (initial) {
      initialNotificationRead = listeners.onOpen(toPushMessage(initial)) !== false;
    }
    return unsubscribe;
  } catch (error) {
    unsubscribe();
    throw error;
  }
}
