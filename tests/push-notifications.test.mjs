import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { needsRegistration, parsePushPreferences } from '../src/api/push-rules.ts';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('preferences require every category as a boolean', () => {
  const preferences = { booking_updates: true, booking_reminders: false, marketing: true };
  assert.deepEqual(parsePushPreferences({ preferences }), preferences);
  for (const invalid of [null, {}, { preferences: null }, { preferences: { ...preferences, marketing: 'yes' } }, { preferences: { booking_updates: true } }]) {
    assert.throws(() => parsePushPreferences(invalid));
  }
});

test('a device is registered once per account and token', () => {
  assert.equal(needsRegistration(null, 7, 'token-a'), true);
  assert.equal(needsRegistration({ userId: 7, token: 'token-a' }, 7, 'token-a'), false);
  assert.equal(needsRegistration({ userId: 7, token: 'token-a' }, 7, 'token-b'), true);
  assert.equal(needsRegistration({ userId: 7, token: 'token-a' }, 8, 'token-a'), true);
  assert.equal(needsRegistration(null, null, 'token-a'), false);
  assert.equal(needsRegistration(null, 7, null), false);
});

test('signing out releases the device before the session is cleared', () => {
  const auth = read('src/context/AuthContext.tsx');
  const logout = auth.slice(auth.indexOf('logout: async'));
  assert.ok(logout.indexOf('releasePushDevice()') !== -1);
  assert.ok(logout.indexOf('releasePushDevice()') < logout.indexOf('apiLogout()'));
  assert.match(read('src/notifications/device-registration.ts'), /releasePushToken\(\)/);
});

test('Android channels match the ones the Firebase backend sends to', () => {
  const app = read('src/notifications/push.native.ts');
  const backend = read('functions/src/messages.ts');
  for (const channel of ['ttn-bookings', 'ttn-account', 'ttn-marketing']) {
    assert.ok(app.includes(`id: '${channel}'`), `app creates ${channel}`);
    assert.ok(backend.includes(`'${channel}'`), `backend uses ${channel}`);
  }
});

test('the app never talks to Firebase delivery directly or embeds server credentials', () => {
  for (const file of ['src/api/push.ts', 'src/notifications/device-registration.ts', 'src/app/notifications.tsx']) {
    const source = read(file);
    assert.doesNotMatch(source, /cloudfunctions\.net|run\.app|private_key|TTN_NOTIFY_WEBHOOK_SECRET/);
  }
});
