import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const {
  HISTORY_LIMIT, notificationEntry, mergeNotification, markNotificationsRead,
  unreadNotificationCount, notificationBadge, parseNotificationHistory,
} = await import('../src/notifications/history.ts');
const { toPushMessage } = await import('../src/notifications/message.ts');
const { readNotificationHistory, writeNotificationHistory } = await import('../src/notifications/history-storage.ts');
hooks.deregister();
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('bell has no badge for zero, a dot for one, and a count for multiple unread notifications', () => {
  let history = [];
  assert.equal(unreadNotificationCount(history), 0);
  assert.equal(notificationBadge(0), null);
  history = mergeNotification(history, notificationEntry({ id: '1' }, false, 100));
  assert.equal(unreadNotificationCount(history), 1);
  assert.equal(notificationBadge(1), null);
  history = mergeNotification(history, notificationEntry({ id: '2' }, false, 200));
  assert.equal(unreadNotificationCount(history), 2);
  assert.equal(notificationBadge(2), '2');
  assert.equal(notificationBadge(99), '99');
  assert.equal(notificationBadge(100), '99+');
  const header = read('src/components/HomeHeader.tsx');
  assert.match(header, /unreadCount > 0/);
  assert.match(header, /badge \? styles\.countBadge : styles\.dot/);
  assert.match(header, /router\.push\('\/notifications'\)/);
  assert.doesNotMatch(header, /hasNotifications/);
});

test('history deduplicates delivery/open/import and never makes a read item unread again', () => {
  const message = { id: 'fcm-1', title: 'Booking confirmed', body: 'Your bay is booked.', route: '/reservations', sentAt: 100 };
  let history = mergeNotification([], notificationEntry(message));
  assert.equal(mergeNotification(history, notificationEntry(message)), history, 'tray refreshes do not rewrite unchanged history');
  assert.equal(history.length, 1);
  assert.equal(unreadNotificationCount(history), 1);
  history = mergeNotification(history, notificationEntry(message, true));
  history = mergeNotification(history, notificationEntry(message));
  assert.equal(history.length, 1);
  assert.equal(unreadNotificationCount(history), 0);
  assert.equal(history[0].route, '/reservations');
});

test('marking one item or all items read keeps the saved history', () => {
  const history = [notificationEntry({ id: '1' }, false, 100), notificationEntry({ id: '2' }, false, 200)];
  const oneRead = markNotificationsRead(history, '1');
  assert.equal(unreadNotificationCount(oneRead), 1);
  assert.equal(history[0].read, false, 'original history is not mutated');
  assert.equal(unreadNotificationCount(markNotificationsRead(oneRead)), 0);
  assert.equal(markNotificationsRead(oneRead).length, 2);
  assert.deepEqual(markNotificationsRead(history, 'missing'), history);
});

test('persists valid history including read state and newest-first ordering, bounded to 100', () => {
  let history = [];
  for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
    history = mergeNotification(history, notificationEntry({ id: String(i) }, false, i));
  }
  assert.equal(history.length, 100);
  assert.equal(history[0].id, '105');
  assert.equal(history.at(-1).id, '6');
  history = markNotificationsRead(history, '105');
  assert.deepEqual(parseNotificationHistory(JSON.stringify(history)), history);
  assert.deepEqual(parseNotificationHistory(null), []);
  assert.deepEqual(parseNotificationHistory('[]'), []);
});

test('defaults missing content and allows only supported internal destinations', () => {
  const entry = notificationEntry({ id: '1', route: 'https://attacker.example', sentAt: -1 }, false, 123);
  assert.equal(entry.title, 'Tee Time Nexus');
  assert.equal(entry.body, 'You have a new notification.');
  assert.equal(entry.route, '/');
  assert.equal(entry.receivedAt, 123);
  assert.equal(notificationEntry({ sentAt: 456 }, false, 123).receivedAt, 456);
  assert.notEqual(notificationEntry({ title: 'A' }, false, 123).id, notificationEntry({ title: 'B' }, false, 123).id);
});

test('malformed saved history is reported rather than silently replaced', () => {
  const entry = notificationEntry({ id: '1' }, false, 123);
  for (const raw of ['invalid JSON', '{}', '[null]', JSON.stringify([{ ...entry, read: 'yes' }]),
    JSON.stringify([{ ...entry, route: '//evil.example' }]), JSON.stringify([{ ...entry, receivedAt: 0 }]),
    JSON.stringify([{ ...entry, id: '' }])]) {
    assert.throws(() => parseNotificationHistory(raw));
  }
});

test('history wiring saves incoming/opened pushes and isolates account and guest files', () => {
  const context = read('src/context/PushContext.tsx');
  assert.match(context, /authLoading \? null : user \? `user-\$\{user\.id\}` : 'guest'/);
  assert.match(context, /saveMessage\(message, true\)/);
  assert.match(context, /saveMessage\(message\)/);
  assert.match(context, /readPresentedPush\(owner\)/);
  const native = read('src/notifications/push.native.ts');
  assert.match(native, /getPresentedNotificationsAsync\(\)/);
  assert.match(native, /dismissAllNotificationsAsync\(\)/);
  assert.match(native, /previousOwner !== owner/);
  assert.match(read('src/notifications/device-registration.ts'), /await withTimeout\(clearPresentedPush\(\), 5000\)/);
  assert.match(native, /toPushMessage/);
  const storage = read('src/notifications/history-storage.native.ts');
  assert.match(storage, /Paths\.document/);
  assert.match(storage, /ttn-notification-history-\$\{owner\}/);
  const screen = read('src/app/notifications.tsx');
  assert.match(screen, /MARK ALL AS READ/);
  assert.match(screen, /markRead\(entry\.id\); router\.push\(entry\.route\)/);
  assert.match(screen, /historyError/);
  assert.match(screen, /onPress=\{retryHistory\}/);
});

test('Firebase messages retain the same identity, timestamp and destination for receipt and open', () => {
  const message = toPushMessage({
    messageId: 'fcm-123', sentTime: 456,
    notification: { title: 'Booking updated', body: 'Your reservation changed.' },
    data: { route: '/reservations' },
  });
  assert.deepEqual(message, {
    id: 'fcm-123', sentAt: 456, title: 'Booking updated', body: 'Your reservation changed.', route: '/reservations',
  });
  const history = mergeNotification([], notificationEntry(message));
  assert.equal(unreadNotificationCount(mergeNotification(history, notificationEntry(message, true))), 0);
});

test('stored history survives reload and is separated by account, with storage errors propagated', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  try {
    const history = [notificationEntry({ id: 'private' }, true, 123)];
    writeNotificationHistory('user-7', JSON.stringify(history));
    assert.deepEqual(parseNotificationHistory(readNotificationHistory('user-7')), history);
    assert.deepEqual(parseNotificationHistory(readNotificationHistory('user-8')), []);
    assert.deepEqual(parseNotificationHistory(readNotificationHistory('guest')), []);
    globalThis.localStorage.setItem = () => { throw new Error('Storage full'); };
    assert.throws(() => writeNotificationHistory('user-7', '[]'), /Storage full/);
    globalThis.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
    assert.throws(() => readNotificationHistory('user-7'), /Storage unavailable/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('the custom Router entry registers Android background history before mounting the app', () => {
  assert.equal(JSON.parse(read('package.json')).main, 'index.ts');
  const entry = read('index.ts');
  assert.ok(entry.indexOf('./src/notifications/background') < entry.indexOf('expo-router/entry'));
  const background = read('src/notifications/background.native.ts');
  assert.match(background, /setBackgroundMessageHandler/);
  // Silent content refreshes are applied first and never reach notification history.
  assert.ok(background.indexOf('contentRefreshVersion(message.data)') < background.indexOf('writeNotificationHistory(owner'));
  assert.match(background, /if \(Platform\.OS !== 'android' \|\| !message\.notification\) return/);
  assert.match(background, /writeNotificationHistory\(owner/);
  assert.match(background, /throw error/);
  assert.match(background, /backgroundHistoryError = error instanceof Error/);
});
