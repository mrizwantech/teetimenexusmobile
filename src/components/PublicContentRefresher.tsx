import { useEffect } from 'react';
import { AppState } from 'react-native';

import { applyPublicContentVersion, checkPublicContentVersion } from '../api/public-content-refresh';
import { listenForContentRefresh, subscribeToContentRefresh } from '../notifications/content-refresh';

const MIN_CHECK_INTERVAL_MS = 60_000;

/**
 * Non-blocking background service: screens keep showing cached content while this checks the Firebase
 * content version on launch/foreground, listens for silent refresh pushes, and swaps in validated content.
 */
export function PublicContentRefresher() {
  useEffect(() => {
    let active = true;
    let lastCheck = 0;
    let stopListening = () => {};

    const warn = (message: string) => (error: unknown) => console.warn(message, error);
    const check = () => {
      if (Date.now() - lastCheck < MIN_CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      checkPublicContentVersion().catch((error: unknown) => {
        lastCheck = 0;
        warn('Unable to check for website content updates; cached content remains in use.')(error);
      });
      subscribeToContentRefresh().catch(warn('Unable to subscribe to content updates.'));
    };

    check();
    listenForContentRefresh((version) => {
      applyPublicContentVersion(version).catch(warn('Unable to apply the content update.'));
    }).then((stop) => {
      if (active) stopListening = stop;
      else stop();
    }).catch(warn('Unable to listen for content updates.'));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      active = false;
      subscription.remove();
      stopListening();
    };
  }, []);

  return null;
}
