import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import withAndroidReleaseOptimization from '../plugins/with-android-release-optimization.js';
import { checkOptimization } from '../scripts/check-android-release.mjs';

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

const releaseMetadata = {
  options: {
    isDebugModeEnabled: false,
    isOptimizationsEnabled: true,
    isShrinkingEnabled: true,
    isObfuscationEnabled: true,
  },
  stats: {
    noOptimizationPercentage: 19.69,
    noShrinkingPercentage: 19.14,
    noObfuscationPercentage: 19.27,
  },
};

test('release verification uses R8 excluded-code percentages, not class-renaming counts', () => {
  const scores = checkOptimization(releaseMetadata);
  assert.equal(scores.optimization.toFixed(2), '80.31');
  assert.equal(scores.shrinking.toFixed(2), '80.86');
  assert.equal(scores.obfuscation.toFixed(2), '80.73');
});

test('each category enforces the exact 25% boundary', () => {
  for (const [stat, category] of [
    ['noOptimizationPercentage', 'optimization'],
    ['noShrinkingPercentage', 'shrinking'],
    ['noObfuscationPercentage', 'obfuscation'],
  ]) {
    const metadata = structuredClone(releaseMetadata);
    metadata.stats[stat] = 75;
    assert.equal(checkOptimization(metadata)[category], 25);
    metadata.stats[stat] = 75.01;
    assert.throws(() => checkOptimization(metadata), new RegExp(`${category}:.*below the 25%`));
    metadata.stats[stat] = 99;
    assert.throws(() => checkOptimization(metadata), /1\.00% is below/);
    for (const value of [undefined, null, '19', NaN, Infinity, -1, 101]) {
      metadata.stats[stat] = value;
      assert.throws(() => checkOptimization(metadata), /Missing or invalid/);
    }
  }
});

test('missing metadata, debug builds, and disabled R8 phases cannot pass verification', () => {
  for (const metadata of [undefined, null, {}, { options: {} }]) {
    assert.throws(() => checkOptimization(metadata), /release-mode R8/);
  }
  for (const option of Object.keys(releaseMetadata.options)) {
    const metadata = structuredClone(releaseMetadata);
    metadata.options[option] = !metadata.options[option];
    assert.throws(() => checkOptimization(metadata), /release-mode R8|disabled/);
  }
  assert.throws(() => checkOptimization({ options: releaseMetadata.options }), /Missing or invalid/);
});
