import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function deletionClient(result, error) {
  const calls = [];
  const source = readFileSync(new URL('../src/api/account-deletion.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.equal(name, './client');
      return {
        apiRequest: async (...args) => {
          calls.push(args);
          if (error) throw error;
          return result;
        },
      };
    },
  });
  return { api: exports, calls };
}

test('account deletion makes an authenticated, uncached DELETE request with explicit confirmation', async () => {
  const { api, calls } = deletionClient({ deleted: true });
  await api.deleteAccount();
  assert.equal(calls[0][0], '/wp-json/ttn/v1/account');
  assert.equal(calls[0][1].method, 'DELETE');
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].body, '{"confirm":true}');
});

test('account deletion sends a password only when supplied for password verification', async () => {
  const { api, calls } = deletionClient({ deleted: true });
  await api.deleteAccount('correct horse');
  assert.equal(calls[0][1].body, '{"confirm":true,"password":"correct horse"}');
});

test('account deletion requires positive server confirmation and surfaces request failures', async () => {
  for (const result of [undefined, null, {}, { deleted: false }, { deleted: 'true' }]) {
    await assert.rejects(deletionClient(result).api.deleteAccount(), /did not confirm/);
  }
  await assert.rejects(deletionClient(undefined, new Error('Deletion is temporarily unavailable.')).api.deleteAccount(), /temporarily unavailable/);
});

test('Profile presents a two-step permanent deletion flow and explains booking and retention effects', () => {
  const profile = readFileSync(new URL('../src/components/ProfileScreen.tsx', import.meta.url), 'utf8');
  assert.match(profile, /accessibilityLabel="Delete account"/);
  assert.match(profile, /This permanently deletes your account/);
  assert.match(profile, /does not cancel reservations or payment obligations or issue refunds/);
  assert.match(profile, /Permanently delete account\?/);
  assert.match(profile, /Verify & Delete Account/);
  assert.match(profile, /reauthenticateWithPasskey\(user\.id\)/);
  assert.match(profile, /reauthenticateWithApple/);
  assert.match(profile, /Contact customer service at sales@teetimenexus\.com/);
  assert.match(profile, /await deleteAccount\(password\)/);
  assert.match(profile, /Alert\.alert\('Account deleted'/);
  assert.match(profile, /accessibilityRole="alert" style={styles\.deleteError}/);
});

test('successful deletion clears local session, Kisi credentials, push state, and account notification history', () => {
  const auth = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
  const deletion = auth.slice(auth.indexOf('deleteAccount: async'));
  assert.ok(deletion.indexOf('await apiDeleteAccount()') < deletion.indexOf('clearTokens()'));
  assert.match(deletion, /releasePushDevice\(\)/);
  assert.match(deletion, /clearKisiCredentials\(\)/);
  assert.match(deletion, /writeNotificationHistory\(`user-\$\{user\.id\}`, '\[\]'\)/);
  assert.match(deletion, /setUser\(null\)/);
});
