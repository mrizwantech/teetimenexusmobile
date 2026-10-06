import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Link, router, useRootNavigationState } from 'expo-router';

import { listenForPush, readPushState } from '../notifications/push';
import { getNotificationRoute, NotificationRoute } from '../notifications/routes';
import { PushMessage, PushState } from '../notifications/types';
import { colors, spacing } from '../theme';

type PushContextValue = PushState & {
  loading: boolean;
  error: string;
  refresh: (requestPermission?: boolean) => Promise<boolean>;
  introReady: boolean;
  showIntro: boolean;
  dismissIntro: () => Promise<void>;
};

const PushContext = createContext<PushContextValue | undefined>(undefined);

export function PushProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PushState>({ permission: 'not-determined', token: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listenerError, setListenerError] = useState('');
  const [listenerAttempt, setListenerAttempt] = useState(0);
  const [pendingOpen, setPendingOpen] = useState<{ route: NotificationRoute } | null>(null);
  const [introDismissed, setIntroDismissed] = useState<boolean | null>(null);
  const [introError, setIntroError] = useState('');
  const navigation = useRootNavigationState();
  const activeRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const readIntro = Platform.OS === 'web'
      ? Promise.resolve('seen')
      : SecureStore.getItemAsync('ttn_push_intro_seen');
    readIntro.then((value) => {
      if (!cancelled) setIntroDismissed(value === 'seen');
    }).catch((err: unknown) => {
      if (!cancelled) {
        setIntroError(err instanceof Error ? err.message : 'Unable to read notification preferences.');
        setIntroDismissed(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback((requestPermission = false) => {
    const requestId = ++requestIdRef.current;
    return readPushState(requestPermission)
      .then((next) => {
        if (activeRef.current && requestId === requestIdRef.current) {
          setState(next);
          setError(next.connectionError ?? '');
        }
        return !next.connectionError;
      })
      .catch((err: unknown) => {
        if (activeRef.current && requestId === requestIdRef.current) {
          setState((previous) => ({ ...previous, token: null }));
          setError(err instanceof Error ? err.message : 'Unable to connect to Firebase notifications.');
        }
        return false;
      })
      .finally(() => {
        if (activeRef.current && requestId === requestIdRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      activeRef.current = false;
      requestIdRef.current += 1;
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const handleOpen = (message: PushMessage) => {
      if (!cancelled) {
        const route = getNotificationRoute(message.route);
        if (message.route !== undefined && !route) console.warn('Ignored an unsupported push notification route.');
        setPendingOpen({ route: route ?? '/' });
      }
    };
    listenForPush({
      onOpen: handleOpen,
      onTokenRefresh: () => { if (!cancelled) void refresh(); },
      onMessage: (message) => {
        if (cancelled) return;
        Alert.alert(message.title || 'Tee Time Nexus', message.body || 'You have a new notification.', [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'Open', onPress: () => handleOpen(message) },
        ]);
      },
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else {
        unsubscribe = cleanup;
        setListenerError('');
      }
    }).catch((err: unknown) => {
      if (!cancelled) setListenerError(err instanceof Error ? err.message : 'Unable to start Firebase notification listeners.');
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [refresh, listenerAttempt]);

  useEffect(() => {
    if (navigation?.key && pendingOpen) router.push(pendingOpen.route);
  }, [navigation?.key, pendingOpen]);

  async function refreshConnection(requestPermission = false) {
    setLoading(true);
    if (listenerError) setListenerAttempt((attempt) => attempt + 1);
    return refresh(requestPermission);
  }

  async function dismissIntro() {
    setIntroError('');
    try {
      await SecureStore.setItemAsync('ttn_push_intro_seen', 'seen');
      if (activeRef.current) setIntroDismissed(true);
    } catch (err) {
      if (activeRef.current) setIntroError(err instanceof Error ? err.message : 'Unable to save notification preferences.');
      throw err;
    }
  }

  const showIntro = introDismissed === false && !loading && !error && !listenerError && state.permission === 'not-determined';

  return (
    <PushContext.Provider value={{ ...state, loading, error: error || listenerError || introError, refresh: refreshConnection, introReady: introDismissed !== null, showIntro, dismissIntro }}>
      {children}
      {error || listenerError || introError ? (
        <View style={{ padding: spacing.sm, backgroundColor: colors.surface }}>
          <Link href="/notifications"><Text style={{ color: colors.danger }}>Push notifications need attention. Open notification settings.</Text></Link>
        </View>
      ) : null}
    </PushContext.Provider>
  );
}

export function usePush() {
  const context = useContext(PushContext);
  if (!context) throw new Error('usePush must be used within PushProvider.');
  return context;
}
