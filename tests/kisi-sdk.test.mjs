import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Kisi module is discoverable on both native platforms with partner ID 1053', () => {
  const config = JSON.parse(read('modules/kisi-access/expo-module.config.json'));
  assert.deepEqual(config.apple.modules, ['KisiAccessModule']);
  assert.deepEqual(config.android.modules, ['expo.modules.kisiaccess.KisiAccessModule']);
  assert.equal(JSON.parse(read('app.json')).expo.extra.kisi.partnerId, 1053);
  assert.match(read('modules/kisi-access/index.ts'), /appConfig\.expo\.extra\.kisi\.partnerId/);
});

test('official SDK binaries are packaged and Android artifact matches the downloaded release', () => {
  const artifact = new URL('../modules/kisi-access/android/vendor/de/kisi/st2u/0.16/st2u-0.16.aar', import.meta.url);
  assert.equal(createHash('sha256').update(readFileSync(artifact)).digest('hex'), 'eb2856b9c5d976b0d7d0b1a08f3423f1467dfde05ade4a193abbac4d4ae199f6');
  assert.ok(existsSync(new URL('../modules/kisi-access/ios/vendor/SecureAccess.xcframework/Info.plist', import.meta.url)));
  assert.match(read('modules/kisi-access/ios/KisiAccess.podspec'), /vendored_frameworks = 'vendor\/SecureAccess\.xcframework'/);
  assert.match(read('modules/kisi-access/android/build.gradle'), /implementation 'de\.kisi:st2u:0\.16'/);
  assert.ok(JSON.parse(read('app.json')).expo.plugins.includes('./plugins/with-kisi-sdk'));
  assert.match(read('plugins/with-kisi-sdk.js'), /allprojects/);
});

test('credentials are scoped by organization and time and cleared on logout', () => {
  const swift = read('modules/kisi-access/ios/KisiAccessModule.swift');
  const kotlin = read('modules/kisi-access/android/src/main/java/expo/modules/kisiaccess/KisiAccessModule.kt');
  assert.match(swift, /now >= value\.validFrom, now < value\.validUntil/);
  assert.match(swift, /organization == value\.organizationId/);
  assert.match(kotlin, /now < current\.validFrom \|\| now >= current\.validUntil/);
  assert.match(kotlin, /organizationId != current\.organizationId/);
  assert.match(kotlin, /error == UnlockError\.NONE/);
  assert.match(swift, /AsyncFunction\("clearCredentials"\)/);
  assert.match(kotlin, /AsyncFunction\("clearCredentials"\)/);
  assert.match(read('src/context/AuthContext.tsx'), /await clearKisiCredentials\(\);\s+await apiLogout\(\)/);
  assert.doesNotMatch(swift + kotlin, /print\(|Log\.|console\.log|777|35B8ACFC/);
});

test('old native builds fail explicitly and initialization is never automatic', () => {
  const adapter = read('modules/kisi-access/index.ts');
  assert.match(read('modules/kisi-access/src/KisiAccessModule.ts'), /requireOptionalNativeModule/);
  assert.match(adapter, /throw new Error\('Kisi requires a rebuilt/);
  assert.doesNotMatch(read('src/context/AuthContext.tsx'), /initializeKisi/);
  const app = JSON.parse(read('app.json')).expo;
  assert.ok(app.ios.infoPlist.UIBackgroundModes.includes('bluetooth-peripheral'));
  assert.ok(app.ios.infoPlist.NSBluetoothAlwaysUsageDescription);
});
