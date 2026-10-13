import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {
    parsePasskeyLoginOptions, parsePasskeyCreateOptions, parsePasskeySession,
    parseAccountPasskeys, passkeyErrorMessage,
} from '../src/api/passkey-rules.ts';

const challenge = 'a'.repeat(43);
const loginOptions = () => ({ challenge_id: challenge, publicKey: {
    challenge, rpId: 'teetimenexus.com', timeout: 60000, userVerification: 'required',
} });
const createOptions = () => ({ challenge_id: challenge, publicKey: {
    challenge, timeout: 60000, rp: { id: 'teetimenexus.com', name: 'Tee Time Nexus' },
    user: { id: challenge, name: 'member@example.test', displayName: 'Member' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }], excludeCredentials: [{ type: 'public-key', id: 'aGFzaA' }],
    authenticatorSelection: { userVerification: 'required', residentKey: 'required', requireResidentKey: true, authenticatorAttachment: 'platform' },
    attestation: 'none',
} });

test('passkey options preserve discoverable, verified, domain-bound native requests', () => {
    assert.equal(parsePasskeyLoginOptions(loginOptions()).request.userVerification, 'required');
    const create = parsePasskeyCreateOptions(createOptions());
    assert.equal(create.challengeId, challenge);
    assert.equal(create.request.user.id, challenge);
    assert.equal(create.request.authenticatorSelection.residentKey, 'required');
    assert.deepEqual(create.request.excludeCredentials, [{ type: 'public-key', id: 'aGFzaA' }]);
    for (const value of [undefined, null, {}, { challenge_id: 'x', publicKey: {} }]) {
        assert.throws(() => parsePasskeyLoginOptions(value));
        assert.throws(() => parsePasskeyCreateOptions(value));
    }
    for (const override of [
        { rpId: 'evil.test' }, { userVerification: 'preferred' }, { timeout: 100 },
        { allowCredentials: [{ id: 'someone-else' }] }, { challenge: 'not/base64' },
    ]) assert.throws(() => parsePasskeyLoginOptions({ ...loginOptions(), publicKey: { ...loginOptions().publicKey, ...override } }));
    for (const override of [
        { rp: { id: 'evil.test' } }, { authenticatorSelection: { userVerification: 'preferred' } },
        { pubKeyCredParams: [{ type: 'public-key', alg: -257 }] }, { excludeCredentials: null },
        { excludeCredentials: [{ type: 'password', id: challenge }] }, { user: {} },
    ]) assert.throws(() => parsePasskeyCreateOptions({ ...createOptions(), publicKey: { ...createOptions().publicKey, ...override } }));
});

test('only a complete verified session can be stored', () => {
    const session = { access_token: 'access', refresh_token: 'refresh', expires_in: 900, token_type: 'Bearer',
        user: { id: 13, email: 'member@example.test', display_name: 'Member' } };
    assert.deepEqual(parsePasskeySession(session), session);
    for (const override of [
        { access_token: '' }, { refresh_token: undefined }, { expires_in: 0 }, { expires_in: NaN },
        { token_type: 'Basic' }, { user: { id: -1 } }, { user: null },
    ]) assert.throws(() => parsePasskeySession({ ...session, ...override }));
});

test('account passkeys validate identifiers, timestamps and duplicate records', () => {
    const item = { id: 'a'.repeat(64), label: 'iPhone passkey', created_at: '2026-10-12T12:00:00+00:00', last_used_at: null };
    assert.deepEqual(parseAccountPasskeys({ passkeys: [item] }), [item]);
    assert.deepEqual(parseAccountPasskeys({ passkeys: [] }), []);
    for (const passkeys of [[item, item], [{ ...item, id: 'bad' }], [{ ...item, created_at: 'bad' }],
        [{ ...item, last_used_at: 'bad' }], [{ ...item, label: '' }], null]) {
        assert.throws(() => parseAccountPasskeys({ passkeys }));
    }
});

test('native cancellation, missing keys and configuration errors have actionable fallback text', () => {
    assert.match(passkeyErrorMessage({ error: 'UserCancelled' }), /cancelled/);
    assert.match(passkeyErrorMessage({ error: 'NoCredentials' }), /Settings/);
    assert.match(passkeyErrorMessage({ error: 'BadConfiguration' }), /another sign-in method/);
    assert.match(passkeyErrorMessage({ error: 'TimedOut' }), /try again/);
    assert.match(passkeyErrorMessage({ error: 'NotSupported' }), /not available/);
    assert.equal(passkeyErrorMessage(new Error('Server unavailable')), 'Server unavailable');
    assert.match(passkeyErrorMessage({ error: 'Unrecognized', message: 'native text' }), /Unrecognized.*native text/);
    assert.match(passkeyErrorMessage({ error: 'RequestFailed', message: 'AuthorizationError error 1004' }), /RequestFailed.*1004/);
    assert.match(passkeyErrorMessage({ error: 'Unknown error', message: 'Application is not associated with domain' }), /not associated with domain/);
});

test('native module is lazy and unsupported environments are gated before importing', () => {
    const native = readFileSync(new URL('../src/api/passkey-native.ts', import.meta.url), 'utf8');
    assert.match(native, /Constants\.executionEnvironment === ExecutionEnvironment\.StoreClient/);
    assert.match(native, /Platform\.OS !== 'ios' && Platform\.OS !== 'android'/);
    assert.match(native, /passkeyPlatform\(\);[\s\S]*await import\('react-native-passkey'\)/);
    assert.doesNotMatch(native, /import \{ Passkey \} from/);
    assert.match(native, /passkey\.create\(request\)/);
    assert.match(native, /passkey\.get\(request\)/);
});

test('passkey infrastructure and management remain while login keeps password and Apple', () => {
    const auth = readFileSync(new URL('../src/api/auth.ts', import.meta.url), 'utf8');
    const context = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
    const account = readFileSync(new URL('../src/app/account.tsx', import.meta.url), 'utf8');
    const settings = readFileSync(new URL('../src/app/settings.tsx', import.meta.url), 'utf8');
    const manage = readFileSync(new URL('../src/app/passkeys.tsx', import.meta.url), 'utf8');
    const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
    assert.match(auth, /parsePasskeySession\(await request\('verify',[\s\S]*await storeTokens\(data\)/);
    assert.match(context, /await apiLoginWithPasskey\(\)/);
    assert.doesNotMatch(account, /Sign in with a passkey|handlePasskeyLogin|Additional sign-in options/);
    assert.match(account, /returnTo === '\/book'/);
    assert.match(account, /await login\(username, password\)/);
    assert.match(account, /await loginWithApple\(/);
    assert.match(settings, /href="\/passkeys"/);
    assert.match(manage, /if \(isLoading\)/);
    assert.match(manage, /if \(!user\) return <Redirect href="\/account"/);
    assert.match(manage, /Alert\.alert\('Remove passkey\?'/);
    assert.match(manage, /submitting\.current/);
    assert.deepEqual(config.expo.ios.associatedDomains, ['webcredentials:teetimenexus.com']);
    assert.equal(config.expo.ios.appleTeamId, '437X3V3YF8');
});

test('login omits additional options while layout includes auto-login and post-login enrollment', () => {
    const account = readFileSync(new URL('../src/app/account.tsx', import.meta.url), 'utf8');
    const prompt = readFileSync(new URL('../src/components/PasskeyEnrollmentPrompt.tsx', import.meta.url), 'utf8');
    const layout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(account, /additionalOptions|Additional sign-in options|Sign in with a passkey/);
    assert.match(layout, /<PasskeyAutoLogin \/>/);
    assert.match(layout, /<PasskeyEnrollmentPrompt \/>/);
    assert.match(prompt, /!signInSequence/);
    assert.match(prompt, /ttn_passkey_prompt_\$\{userId\}/);
    assert.match(prompt, /SecureStore\.getItemAsync\(key\) === 'shown'/);
    assert.match(prompt, /passkeys\.length > 0/);
    assert.match(prompt, /text: 'Not now'/);
    assert.match(prompt, /text: 'Enable', onPress/);
    assert.ok(prompt.indexOf('await addAccountPasskey') < prompt.indexOf('async function offer'));
    assert.doesNotMatch(prompt.slice(prompt.indexOf('async function offer')), /await addAccountPasskey/);
});

function loadModule(path, dependencies, globals = {}) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
        exports, Error, URLSearchParams, JSON,
        require(name) {
            assert.ok(name in dependencies, `Unexpected import: ${name}`);
            return typeof dependencies[name] === 'function' ? dependencies[name]() : dependencies[name];
        },
        ...globals,
    });
    return exports;
}

const rules = { parsePasskeyLoginOptions, parsePasskeyCreateOptions, parsePasskeySession, parseAccountPasskeys, passkeyErrorMessage };
function nativeFixture({ os = 'ios', environment = 'standalone', missing = false, supported = true, error } = {}) {
    const calls = [];
    const adapter = loadModule('../src/api/passkey-native.ts', {
        'expo-constants': { __esModule: true, default: { executionEnvironment: environment }, ExecutionEnvironment: { StoreClient: 'storeClient' } },
        'react-native': { Platform: { OS: os } }, './passkey-rules': rules,
        'react-native-passkey': () => {
            calls.push('import');
            if (missing) throw new Error('Native module missing');
            return { Passkey: {
                isSupported: () => supported,
                async get(request) { calls.push(['get', request]); if (error) throw error; return { id: 'native-id', response: {} }; },
                async getImmediate(request) { calls.push(['getImmediate', request]); if (error) throw error; return { id: 'native-id', response: {} }; },
                async create(request) { calls.push(['create', request]); if (error) throw error; return { id: 'native-id', response: {} }; },
            } };
        },
    });
    return { adapter, calls };
}

test('enrollment offer checks server keys and waits for Enable before creating a passkey', async () => {
    async function scenario({ saved = null, keys = [], sequence = 1, os = 'ios', failure } = {}) {
        const effects = [];
        const alerts = [];
        const writes = [];
        let creates = 0;
        let reads = 0;
        const component = loadModule('../src/components/PasskeyEnrollmentPrompt.tsx', {
            react: { useEffect: (callback) => effects.push(callback), useRef: (value) => ({ current: value }) },
            'react-native': { Platform: { OS: os }, Alert: { alert: (...args) => alerts.push(args) } },
            'expo-constants': { __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } },
            'expo-secure-store': { getItemAsync: async () => saved, setItemAsync: async (...args) => writes.push(args) },
            '../api/passkeys': {
                getAccountPasskeys: async () => { reads++; if (failure) throw failure; return keys; },
                addAccountPasskey: async () => { creates++; },
            },
            '../context/AuthContext': { useAuth: () => ({ user: { id: 13 }, isLoading: false, signInSequence: sequence }) },
        });
        component.PasskeyEnrollmentPrompt();
        const cleanups = effects.map((effect) => effect());
        await new Promise(setImmediate);
        return { alerts, writes, cleanups, reads, creates: () => creates };
    }
    const offer = await scenario();
    assert.equal(offer.alerts[0][0], 'Enable passkey?');
    assert.deepEqual(offer.writes[0], ['ttn_passkey_prompt_13', 'shown']);
    assert.equal(offer.creates(), 0);
    assert.equal(offer.alerts[0][2][0].text, 'Not now');
    offer.alerts[0][2][1].onPress();
    await new Promise(setImmediate);
    assert.equal(offer.creates(), 1);
    assert.equal(offer.alerts[1][0], 'Passkey enabled');
    for (const config of [{ saved: 'shown' }, { keys: [{}] }, { sequence: 0 }, { os: 'web' }]) {
        const skipped = await scenario(config);
        assert.equal(skipped.alerts.length, 0);
        assert.equal(skipped.creates(), 0);
    }
    const stale = await scenario();
    stale.cleanups.forEach((cleanup) => cleanup?.());
    stale.alerts[0][2][1].onPress();
    await new Promise(setImmediate);
    assert.equal(stale.creates(), 0);
    const failed = await scenario({ failure: new Error('Server unavailable') });
    assert.equal(failed.alerts[0][0], 'Unable to check passkeys');
    assert.equal(failed.writes.length, 0);
});

test('native adapter executes lazily and never imports native code on web or Expo Go', async () => {
    for (const config of [{ os: 'web' }, { environment: 'storeClient' }]) {
        const { adapter, calls } = nativeFixture(config);
        await assert.rejects(adapter.getNativePasskey(loginOptions().publicKey), /installed iOS or Android app/);
        assert.deepEqual(calls, []);
    }
    const { adapter, calls } = nativeFixture();
    assert.deepEqual(calls, []);
    assert.equal((await adapter.getNativePasskey(parsePasskeyLoginOptions(loginOptions()).request)).id, 'native-id');
    assert.equal(calls[1][0], 'get');
    await adapter.createNativePasskey(parsePasskeyCreateOptions(createOptions()).request);
    assert.equal(calls[3][0], 'create');
    await assert.rejects(nativeFixture({ missing: true }).adapter.getNativePasskey({}), /rebuild the app/);
    await assert.rejects(nativeFixture({ supported: false }).adapter.getNativePasskey({}), /not supported/);
    await assert.rejects(nativeFixture({ error: { error: 'UserCancelled' } }).adapter.getNativePasskey({}), /cancelled/);
    await assert.rejects(nativeFixture({ error: { error: 'RequestFailed', message: 'Missing associated domain' } }).adapter.createNativePasskey({}), /RequestFailed.*Missing associated domain/);
});

test('passkey authentication stores only server-verified tokens and stops after native cancellation', async () => {
    const session = { access_token: 'verified-access', refresh_token: 'verified-refresh', expires_in: 900, token_type: 'Bearer',
        user: { id: 13, email: 'member@example.test', display_name: 'Member' } };
    async function run({ nativeError, serverError, invalidSession } = {}) {
        const stored = [];
        const requests = [];
        const { adapter } = nativeFixture({ error: nativeError });
        const auth = loadModule('../src/api/auth.ts', {
            'expo-secure-store': { async setItemAsync(...args) { stored.push(args); } },
            './passkey-native': adapter, './passkey-rules': rules,
        }, {
            process: { env: { EXPO_PUBLIC_API_URL: 'https://teetimenexus.com' } },
            async fetch(url, options) {
                requests.push({ url, body: JSON.parse(options.body) });
                const verifying = url.endsWith('/verify');
                const value = verifying ? (invalidSession ? {} : session) : loginOptions();
                return {
                    ok: !(verifying && serverError),
                    text: async () => JSON.stringify(value),
                    json: async () => ({ message: 'Signature verification failed.' }),
                };
            },
        });
        let result;
        let error;
        try { result = await auth.loginWithPasskey(); } catch (caught) { error = caught; }
        return { result, error, stored, requests };
    }
    const success = await run();
    assert.equal(success.result.user.id, 13);
    assert.equal(success.requests.length, 2);
    assert.equal(success.requests[0].body.platform, 'ios');
    assert.equal(success.requests[1].body.challenge_id, challenge);
    assert.equal(success.requests[1].body.credential.id, 'native-id');
    assert.deepEqual(success.stored, [['ttn_access_token', 'verified-access'], ['ttn_refresh_token', 'verified-refresh']]);
    for (const config of [{ nativeError: { error: 'UserCancelled' } }, { serverError: true }, { invalidSession: true }]) {
        const failed = await run(config);
        assert.ok(failed.error);
        assert.deepEqual(failed.stored, []);
        if (config.nativeError) assert.equal(failed.requests.length, 1);
    }
});

test('authenticated enrollment and removal require server confirmation', async () => {
    const calls = [];
    let registered = true;
    let removed = true;
    const { adapter } = nativeFixture();
    const api = loadModule('../src/api/passkeys.ts', {
        './passkey-native': adapter, './passkey-rules': rules,
        './client': { async apiRequest(path, options) {
            calls.push({ path, options });
            if (path.endsWith('/register/options')) return createOptions();
            if (path.endsWith('/register/verify')) return { registered };
            if (options?.method === 'DELETE') return { removed };
            return { passkeys: [] };
        } },
    });
    assert.equal((await api.getAccountPasskeys()).length, 0);
    await api.addAccountPasskey(' iPhone ');
    assert.equal(JSON.parse(calls[2].options.body).label, 'iPhone');
    await api.removeAccountPasskey('a'.repeat(64));
    assert.equal(calls[3].options.method, 'DELETE');
    registered = false;
    await assert.rejects(api.addAccountPasskey('iPhone'), /did not confirm/);
    removed = false;
    await assert.rejects(api.removeAccountPasskey('a'.repeat(64)), /did not confirm/);
    const before = calls.length;
    await assert.rejects(api.removeAccountPasskey('../account'), /Invalid passkey ID/);
    assert.equal(calls.length, before);
});

test('immediate passkey login uses getImmediate and silently returns null on errors', async () => {
    const session = { access_token: 'verified-access', refresh_token: 'verified-refresh', expires_in: 900, token_type: 'Bearer',
        user: { id: 13, email: 'member@example.test', display_name: 'Member' } };
    async function runImmediate({ nativeError, serverError } = {}) {
        const stored = [];
        const { adapter, calls } = nativeFixture({ error: nativeError });
        const auth = loadModule('../src/api/auth.ts', {
            'expo-secure-store': { async setItemAsync(...args) { stored.push(args); } },
            './passkey-native': adapter, './passkey-rules': rules,
        }, {
            process: { env: { EXPO_PUBLIC_API_URL: 'https://teetimenexus.com' } },
            async fetch(url, options) {
                const verifying = url.endsWith('/verify');
                const value = verifying ? session : loginOptions();
                return {
                    ok: !(verifying && serverError),
                    text: async () => JSON.stringify(value),
                    json: async () => ({ message: 'Failed' }),
                };
            },
        });
        const result = await auth.loginWithPasskey({ immediate: true });
        return { result, stored, calls };
    }
    const success = await runImmediate();
    assert.equal(success.result.user.id, 13);
    assert.deepEqual(success.calls, ['import', ['getImmediate', parsePasskeyLoginOptions(loginOptions()).request]]);
    assert.deepEqual(success.stored, [['ttn_access_token', 'verified-access'], ['ttn_refresh_token', 'verified-refresh']]);

    for (const error of [{ error: 'NoCredentials' }, { error: 'UserCancelled' }, { error: 'RequestFailed' }]) {
        const failed = await runImmediate({ nativeError: error });
        assert.equal(failed.result, null);
        assert.deepEqual(failed.stored, []);
    }
    const serverFail = await runImmediate({ serverError: true });
    assert.equal(serverFail.result, null);
    assert.deepEqual(serverFail.stored, []);
});

test('PasskeyAutoLogin triggers once on cold launch and skips if logged in or unsupported', async () => {
    async function scenario({ user = null, isLoading = false, os = 'ios', environment = 'standalone', supported = true } = {}) {
        const effects = [];
        const logins = [];
        const timers = [];
        const component = loadModule('../src/components/PasskeyAutoLogin.tsx', {
            react: {
                useEffect: (callback) => effects.push(callback),
                useRef: (value) => ({ current: value }),
            },
            'react-native': {
                Platform: { OS: os },
                AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
            },
            'expo-constants': {
                __esModule: true,
                default: { executionEnvironment: environment },
                ExecutionEnvironment: { StoreClient: 'storeClient' },
            },
            '../api/passkey-native': {
                isPasskeySupported: () => (os === 'ios' || os === 'android') && environment !== 'storeClient',
                isPasskeyAvailable: async () => supported,
            },
            '../context/AuthContext': {
                useAuth: () => ({
                    user,
                    isLoading,
                    loginWithPasskey: async (opts) => { logins.push(opts); return true; },
                }),
            },
        }, {
            setTimeout: (fn, ms) => {
                timers.push({ fn, ms });
                return 1;
            },
            clearTimeout: () => {},
        });
        component.PasskeyAutoLogin();
        effects.forEach((effect) => effect());
        for (const timer of timers) {
            timer.fn();
        }
        await new Promise(setImmediate);
        return { logins, timers };
    }

    const launch = await scenario();
    assert.equal(launch.logins.length, 1);
    assert.equal(launch.logins[0].immediate, true);

    // Skip if user already authenticated
    const authenticated = await scenario({ user: { id: 13 } });
    assert.equal(authenticated.logins.length, 0);

    // Skip if still loading session
    const loading = await scenario({ isLoading: true });
    assert.equal(loading.logins.length, 0);

    // Skip if unsupported environment (Expo Go or web)
    const expoGo = await scenario({ environment: 'storeClient' });
    assert.equal(expoGo.logins.length, 0);
    const web = await scenario({ os: 'web' });
    assert.equal(web.logins.length, 0);
});
