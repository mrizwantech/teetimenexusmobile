import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { contentRefreshVersion } from './content-refresh-message';
import { mergeNotification, notificationEntry, parseNotificationHistory } from './history';
import { readNotificationHistory, writeNotificationHistory } from './history-storage';
import { toPushMessage } from './message';

export let backgroundHistoryError = '';
let registered = false;

export function registerBackgroundHistory() {
  if (registered || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Register synchronously, but never load Firebase in Expo Go.
    const { getMessaging, setBackgroundMessageHandler }: typeof import('@react-native-firebase/messaging') = require('@react-native-firebase/messaging');
    setBackgroundMessageHandler(getMessaging(), async (message) => {
      const contentVersion = contentRefreshVersion(message.data);
      if (contentVersion) {
        // Silent content refresh: never shown or added to history. Failures keep the old cache for the next check.
        const { applyPublicContentVersion } = await import('../api/public-content-refresh');
        await applyPublicContentVersion(contentVersion);
        return;
      }
      // iOS lists delivered notifications itself; only Android needs background history capture.
      if (Platform.OS !== 'android' || !message.notification) return;
      try {
        const owner = await SecureStore.getItemAsync('ttn_push_history_owner');
        if (!owner) throw new Error('Notification history is not initialized. Open the app to initialize it.');
        const history = parseNotificationHistory(readNotificationHistory(owner));
        const entries = mergeNotification(history, notificationEntry(toPushMessage(message)));
        writeNotificationHistory(owner, JSON.stringify(entries));
      } catch (error) {
        console.error('Unable to save background notification history.');
        throw error;
      }
    });
    registered = true;
    backgroundHistoryError = '';
  } catch (error) {
    backgroundHistoryError = error instanceof Error ? error.message : 'Unable to start background notification history.';
    console.error('Unable to start background notification history. Open Notifications to retry.');
  }
}

registerBackgroundHistory();
