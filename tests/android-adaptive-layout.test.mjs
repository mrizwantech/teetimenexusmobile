import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import withAndroidAdaptiveLayout from '../plugins/with-android-adaptive-layout.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = JSON.parse(read('app.json')).expo;

async function adapt(manifest) {
  const config = withAndroidAdaptiveLayout({ name: 'test', slug: 'test', orientation: 'portrait' });
  assert.equal(config.mods.ios, undefined);
  const result = await config.mods.android.manifest({
    ...config,
    modRequest: { platform: 'android', modName: 'manifest' },
    modResults: manifest,
  });
  return result.modResults;
}

test('Android removes orientation/aspect restrictions and enables resizing without changing iOS', async () => {
  assert.equal(app.orientation, 'portrait');
  assert.ok(app.plugins.includes('./plugins/with-android-adaptive-layout'));
  const manifest = { manifest: { application: [{
    $: { 'android:name': '.MainApplication' },
    activity: [
      { $: {
        'android:name': '.MainActivity',
        'android:screenOrientation': 'portrait',
        'android:resizeableActivity': 'false',
        'android:minAspectRatio': '1.3',
        'android:maxAspectRatio': '2.1',
        'android:windowSoftInputMode': 'adjustResize',
        'android:configChanges': 'orientation|screenSize',
      } },
      { $: { 'android:name': 'third.party.Activity', 'android:screenOrientation': 'portrait' } },
    ],
  }] } };
  const result = await adapt(structuredClone(manifest));
  const [main, other] = result.manifest.application[0].activity;
  assert.deepEqual(main.$, {
    'android:name': '.MainActivity',
    'android:resizeableActivity': 'true',
    'android:windowSoftInputMode': 'adjustResize',
    'android:configChanges': 'orientation|screenSize',
  });
  assert.deepEqual(other, manifest.manifest.application[0].activity[1]);
  assert.deepEqual(await adapt(structuredClone(result)), result);
  await assert.rejects(adapt({ manifest: { application: [] } }), /MainActivity/);
});

test('landscape screens, checkout, and navigation respect side cutouts without double bottom insets', () => {
  for (const file of ['src/components/Screen.tsx', 'src/app/checkout.tsx', 'src/components/DoorAccess.tsx']) {
    assert.match(read(file), /edges=\{\['top', 'left', 'right'\]\}/, file);
  }
  assert.match(read('src/components/BottomNav.tsx'), /edges=\{\['bottom', 'left', 'right'\]\}/);
  const door = read('src/components/DoorAccess.tsx');
  assert.match(door, /<\/SafeAreaView>\s*<BottomNav onNavigate=\{onClose\}/);
  const menu = read('src/components/MenuSheet.tsx');
  assert.match(menu, /paddingLeft: insets\.left/);
  assert.match(menu, /paddingRight: insets\.right/);
});

test('media remains scrollable in short landscape or split-screen windows', () => {
  const panels = read('src/components/HomePanels.tsx');
  assert.match(panels, /<SafeAreaView style=\{homeStyles\.modalBackdrop\}>\s*<ScrollView/);
  assert.match(panels, /label="CLOSE MEDIA"/);
  const hero = read('src/components/HeroCarousel.tsx');
  assert.match(hero, /onLayout=.*setViewportWidth/);
  assert.match(hero, /scrollTo\(\{ x: currentIndexRef\.current \* cardInterval, animated: false \}\)/);
});

test('app-owned system bar configuration avoids deprecated color and translucency options', () => {
  assert.equal(app.androidStatusBar, undefined);
  assert.equal(app.androidNavigationBar, undefined);
  assert.notEqual(app.android.edgeToEdgeEnabled, false);
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /<StatusBar style="light" \/>/);
  assert.doesNotMatch(layout, /statusBarColor|navigationBarColor|statusBarTranslucent|setStatusBarBackgroundColor/);
});
