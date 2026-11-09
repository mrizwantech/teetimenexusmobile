import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test, { after } from 'node:test';
import { VENUE_ADDRESS } from '../src/api/calendar-rules.ts';

const secureStoreMock = `data:text/javascript,${encodeURIComponent(`
    export const state = { value: null, error: null, writes: [] };
    export async function getItemAsync(key) {
        if (state.error) throw state.error;
        return state.value;
    }
    export async function setItemAsync(key, value) {
        if (state.error) throw state.error;
        state.writes.push({ key, value });
        state.value = value;
    }
`)}`;
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'expo-secure-store') return { url: secureStoreMock, shortCircuit: true };
        return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
    },
});
const { getDirectionsOptions, getSavedDirectionsOption, saveDirectionsOption } = await import('../src/api/directions.ts');
const { state: nativeStore } = await import(secureStoreMock);
after(() => hooks.deregister());

test('iOS offers Apple Maps, Google Maps, and Waze rather than launching Apple immediately', () => {
    const options = getDirectionsOptions('ios');
    assert.deepEqual(options.map((option) => option.label), ['Apple Maps', 'Google Maps', 'Waze']);
    assert.equal(new URL(options[1].url).protocol, 'comgooglemaps:');
    assert.equal(new URL(options[2].url).protocol, 'waze:');
});

test('Android offers two maps apps plus Cancel within its three-alert-button limit', () => {
    const options = getDirectionsOptions('android');
    assert.deepEqual(options.map((option) => option.label), ['Google Maps', 'Waze']);
    assert.equal(new URL(options[0].url).protocol, 'google.navigation:');
    assert.equal(new URL(options[1].url).protocol, 'waze:');
    assert.equal(options.length + 1, 3);
});

test('every map targets the shared venue address and offers HTTPS browser directions', () => {
    for (const platform of ['ios', 'android', 'web']) {
        for (const option of getDirectionsOptions(platform)) {
            assert.ok(decodeURIComponent(option.url).includes(`Tee Time Nexus, ${VENUE_ADDRESS}`));
            const webUrl = new URL(option.webUrl);
            assert.equal(webUrl.protocol, 'https:');
            assert.ok(decodeURIComponent(webUrl.href).includes(VENUE_ADDRESS));
            assert.match(option.url, /dirflg=d|mode=d|directionsmode=driving|travelmode=driving|navigate=yes/);
            if (platform === 'web') assert.equal(option.url, option.webUrl);
        }
    }
});

test('reservation Directions uses a cancellable chooser with visible native and browser errors', () => {
    const source = readFileSync(new URL('../src/components/BookingDetails.tsx', import.meta.url), 'utf8');
    assert.match(source, /Alert\.alert\('Directions', 'Choose a maps app\. We will remember your choice on this device\.'/);
    assert.match(source, /getDirectionsOptions\(Platform\.OS\)\.map/);
    assert.match(source, /await Linking\.openURL\(option\.url\)/);
    assert.match(source, /Unable to open \$\{option\.label\}/);
    assert.match(source, /text: 'Open in browser'/);
    assert.match(source, /Linking\.openURL\(option\.webUrl\)\.catch/);
    assert.match(source, /Unable to open directions/);
    assert.doesNotMatch(source, /Linking\.openURL\('http:\/\/maps\.apple/);
});

test('native maps choice is persisted on-device and restored on subsequent reads', async () => {
    nativeStore.value = null;
    nativeStore.writes = [];
    nativeStore.error = null;
    assert.equal(await getSavedDirectionsOption('android'), null);
    await saveDirectionsOption('android', 'Google Maps');
    assert.deepEqual(nativeStore.writes, [{ key: 'ttn_directions_app', value: 'Google Maps' }]);
    for (let visit = 0; visit < 3; visit++) {
        assert.equal((await getSavedDirectionsOption('android')).label, 'Google Maps');
    }
    await saveDirectionsOption('android', 'Waze');
    assert.equal((await getSavedDirectionsOption('android')).label, 'Waze');
    await saveDirectionsOption('ios', 'Apple Maps');
    assert.equal((await getSavedDirectionsOption('ios')).label, 'Apple Maps');
    await assert.rejects(getSavedDirectionsOption('android'), /no longer supported/);
    await assert.rejects(saveDirectionsOption('android', 'Apple Maps'), /not supported/);
    assert.equal(nativeStore.value, 'Apple Maps');
});

test('storage failures propagate rather than silently forgetting a maps choice', async () => {
    nativeStore.error = new Error('Storage unavailable');
    try {
        await assert.rejects(getSavedDirectionsOption('ios'), /Storage unavailable/);
        await assert.rejects(saveDirectionsOption('ios', 'Google Maps'), /Storage unavailable/);
    } finally {
        nativeStore.error = null;
        nativeStore.value = null;
    }
});

test('web persists the same preference without invoking native storage', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    });
    nativeStore.error = new Error('Native storage must not be used on web');
    try {
        assert.equal(await getSavedDirectionsOption('web'), null);
        await saveDirectionsOption('web', 'Waze');
        assert.equal((await getSavedDirectionsOption('web')).label, 'Waze');
        assert.equal(values.get('ttn_directions_app'), 'Waze');
    } finally {
        nativeStore.error = null;
        if (original) Object.defineProperty(globalThis, 'localStorage', original);
        else delete globalThis.localStorage;
    }
});

test('saved choice bypasses the chooser, successful launches save, and errors allow switching', () => {
    const source = readFileSync(new URL('../src/components/BookingDetails.tsx', import.meta.url), 'utf8');
    assert.match(source, /option = await getSavedDirectionsOption\(Platform\.OS\)/);
    assert.match(source, /if \(option\) \{\s*await launchDirections\(option\);\s*\} else \{\s*chooseDirectionsApp\(\)/);
    assert.ok(source.indexOf('await Linking.openURL(option.url)') < source.indexOf('await saveDirectionsOption(Platform.OS, option.label)'));
    assert.match(source, /text: 'Choose another app', onPress: chooseDirectionsApp/);
    assert.match(source, /onPress=\{chooseDirectionsApp\}>\s*<Text[^>]*>Change maps app/);
    assert.match(source, /Maps preference not saved/);
    assert.match(source, /Unable to load maps preference/);
});
