import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { readNotificationHistory, writeNotificationHistory } from './history-storage';
import { markNotificationsRead, mergeNotification, notificationEntry, parseNotificationHistory, unreadNotificationCount } from './history';
import type { NotificationEntry } from './history';
import type { PushMessage } from './types';

type Snapshot = { owner: string; entries: NotificationEntry[]; loaded: boolean };

export function useNotificationHistory(owner: string | null) {
  const snapshot = useRef<Snapshot | null>(null);
  const pending = useRef<{ owner: string; entry: NotificationEntry }[]>([]);
  const [state, setState] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');

  const persist = useCallback((next: Snapshot) => {
    snapshot.current = next;
    setState(next);
    try {
      writeNotificationHistory(next.owner, JSON.stringify(next.entries));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save notification history.');
    }
  }, []);

  const reload = useCallback(() => {
    if (!owner) return;
    setError('');
    try {
      let entries = parseNotificationHistory(readNotificationHistory(owner));
      if (snapshot.current?.owner === owner && snapshot.current.loaded) {
        entries = snapshot.current.entries.reduce(mergeNotification, entries);
      }
      for (const item of pending.current.filter((item) => item.owner === owner)) {
        entries = mergeNotification(entries, item.entry);
      }
      pending.current = pending.current.filter((item) => item.owner !== owner);
      const next = { owner, entries, loaded: true };
      snapshot.current = next;
      setState(next);
      persist(next);
    } catch (err) {
      if (snapshot.current?.owner !== owner) snapshot.current = { owner, entries: [], loaded: false };
      setState(snapshot.current);
      setError(err instanceof Error ? err.message : 'Unable to load notification history.');
    }
  }, [owner, persist]);

  useEffect(() => {
    let cancelled = false;
    snapshot.current = null;
    pending.current = [];
    void Promise.resolve().then(() => { if (!cancelled) reload(); });
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') reload();
    });
    return () => { cancelled = true; subscription.remove(); };
  }, [reload]);

  const saveMessages = useCallback((messages: PushMessage[], read = false) => {
    if (!owner) return;
    const incoming = messages.map((message) => notificationEntry(message, read));
    const current = snapshot.current;
    if (!current?.loaded || current.owner !== owner) {
      pending.current.push(...incoming.map((entry) => ({ owner, entry })));
      return;
    }
    const entries = incoming.reduce(mergeNotification, current.entries);
    if (entries !== current.entries) persist({ ...current, entries });
  }, [owner, persist]);

  const saveMessage = useCallback((message: PushMessage, read = false) => {
    saveMessages([message], read);
  }, [saveMessages]);

  const markRead = useCallback((id?: string) => {
    const current = snapshot.current;
    if (current?.loaded && current.owner === owner) {
      persist({ ...current, entries: markNotificationsRead(current.entries, id) });
    }
  }, [owner, persist]);

  const retry = useCallback(() => {
    const current = snapshot.current;
    if (current?.loaded && current.owner === owner) persist(current);
    else reload();
  }, [owner, persist, reload]);

  const entries = state?.owner === owner ? state.entries : [];
  return {
    history: entries,
    historyLoading: owner === null || state?.owner !== owner,
    historyError: state?.owner === owner ? error : '',
    unreadCount: unreadNotificationCount(entries),
    saveMessage,
    saveMessages,
    markRead,
    retryHistory: retry,
  };
}
