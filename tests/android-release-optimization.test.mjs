import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import withAndroidReleaseOptimization from '../plugins/with-android-release-optimization.js';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

async function optimize(contents, language = 'groovy') {
  const config = withAndroidReleaseOptimization({ name: 'test', slug: 'test' });
  const result = await config.mods.android.appBuildGradle({
    ...config,
    modRequest: { platform: 'android', modName: 'appBuildGradle' },
    modResults: { contents, language },
  });
  return result.modResults.contents;
}

test('release builds enable R8 and resource shrinking through persistent Expo config', () => {
  const properties = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')[1];
  assert.equal(properties.android.enableMinifyInReleaseBuilds, true);
  assert.equal(properties.android.enableShrinkResourcesInReleaseBuilds, true);
  assert.ok(app.plugins.includes('./plugins/with-android-release-optimization'));
  assert.equal(properties.ios.useFrameworks, 'dynamic');
});

test('optimizing rules replace the Expo default and preserve application keep rules', async () => {
  for (const quote of ['"', "'"]) {
    const input = `proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), "proguard-rules.pro"`;
    const expected = 'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"';
    assert.equal(await optimize(input), expected);
    assert.equal(await optimize(await optimize(input)), expected);
  }
});

test('unsupported Gradle templates fail explicitly instead of silently disabling optimization', async () => {
  await assert.rejects(optimize('android {}'), /could not find the default ProGuard configuration/);
  await assert.rejects(optimize('android {}', 'kotlin'), /requires the Expo Groovy/);
});

test('Kisi beacon scanning packages its runtime dependency rather than suppressing R8 errors', () => {
  const gradle = readFileSync(new URL('../modules/kisi-access/android/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /implementation 'com\.github\.agap:luch:0\.4'/);
  assert.match(gradle, /url 'https:\/\/jitpack\.io'/);
  assert.match(gradle, /content \{ includeGroup 'com\.github\.agap' \}/);
  const plugin = readFileSync(new URL('../plugins/with-android-release-optimization.js', import.meta.url), 'utf8');
  assert.doesNotMatch(plugin, /-dontwarn|-ignorewarnings/);
});
