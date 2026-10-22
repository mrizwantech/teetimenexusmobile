import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { createContentCache, normalizeContentVersion } = await import('../src/api/content-cache.ts');
const { contentRefreshVersion, parseContentVersionResponse, PUBLIC_CONTENT_TOPIC } = await import('../src/notifications/content-refresh-message.ts');
hooks.deregister();

const quiet = { warn() {} };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function createStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async read(key) {
      return values.get(key) ?? null;
    },
    async write(key, value) {
      values.set(key, value);
    },
  };
}

const parseObject = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid cached value');
  }
  return value;
};

function counterSource(prefix = 'Response') {
  const source = {
    count: 0,
    fail: false,
    request: async () => {
      source.count += 1;
      if (source.fail) throw new Error('offline');
      return { title: `${prefix} ${source.count}` };
    },
    parse: parseObject,
  };
  return source;
}

test('serves cached content indefinitely until the content version changes', async () => {
  const cache = createContentCache(createStore(), quiet);
  const source = counterSource();
  const getHome = cache.define('home', source);

  assert.deepEqual(await getHome(), { title: 'Response 1' });
  assert.deepEqual(await getHome(), { title: 'Response 1' });
  assert.equal(source.count, 1);

  const result = await cache.applyVersion(2);
  assert.deepEqual(result, { refreshed: ['home'], failed: [] });
  assert.deepEqual(await getHome(), { title: 'Response 2' });
  assert.equal(source.count, 2);

  await cache.applyVersion('2');
  assert.equal(source.count, 2, 'same version does not refetch');
});

test('keeps old content when a background refresh fails and retries on the next check', async () => {
  const cache = createContentCache(createStore(), quiet);
  const source = counterSource();
  const getHours = cache.define('hours', source);
  await getHours();

  source.fail = true;
  assert.deepEqual(await cache.applyVersion('v2'), { refreshed: [], failed: ['hours'] });
  assert.deepEqual(await getHours(), { title: 'Response 1' }, 'old cache is still served');

  source.fail = false;
  await tick();
  assert.deepEqual(await cache.refreshOutdated(), { refreshed: ['hours'], failed: [] });
  const fresh = await getHours();
  assert.match(fresh.title, /^Response \d$/);
  assert.notEqual(fresh.title, 'Response 1');
});

test('rejects invalid replacement content without overwriting the cache', async () => {
  const cache = createContentCache(createStore(), quiet);
  let payload = { title: 'Good' };
  const getBays = cache.define('bays', { request: async () => payload, parse: parseObject });
  await getBays();
  payload = ['not', 'an', 'object'];
  assert.deepEqual(await cache.applyVersion(5), { refreshed: [], failed: ['bays'] });
  assert.deepEqual(await getBays(), { title: 'Good' });
});

test('returns stale content immediately and refreshes it in the background', async () => {
  const store = createStore({ 'content-version': '9', competitions: JSON.stringify({ version: '8', value: { title: 'Old' } }) });
  const cache = createContentCache(store, quiet);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const updates = [];
  cache.subscribe((key, value) => updates.push([key, value]));
  const getCompetitions = cache.define('competitions', {
    request: async () => { await gate; return { title: 'New' }; },
    parse: parseObject,
  });

  assert.deepEqual(await getCompetitions(), { title: 'Old' }, 'did not wait for the network');
  release();
  await tick();
  assert.deepEqual(updates, [['competitions', { title: 'New' }]]);
  assert.deepEqual(JSON.parse(store.values.get('competitions')), { version: '9', value: { title: 'New' } });
});

test('refreshes entries from the former time-based cache format', async () => {
  const store = createStore({ hours: JSON.stringify({ cachedAt: 1, value: { title: 'Legacy' } }) });
  const cache = createContentCache(store, quiet);
  const source = counterSource();
  const getHours = cache.define('hours', source);
  assert.deepEqual(await getHours(), { title: 'Legacy' });
  await tick();
  assert.equal(source.count, 1);
  assert.deepEqual(await getHours(), { title: 'Response 1' });
});

test('only refreshes content that was already cached', async () => {
  const cache = createContentCache(createStore(), quiet);
  const loaded = counterSource();
  const never = counterSource();
  const getHome = cache.define('home', loaded);
  cache.define('membership-packages', never);
  await getHome();
  assert.deepEqual(await cache.applyVersion(3), { refreshed: ['home'], failed: [] });
  assert.equal(never.count, 0);
});

test('persists the version across app launches', async () => {
  const store = createStore();
  const first = createContentCache(store, quiet);
  const firstSource = counterSource();
  first.define('home', firstSource);
  await first.applyVersion(4);

  const second = createContentCache(store, quiet);
  assert.equal(await second.getVersion(), '4');
});

test('membership packages survive relaunch and a forced retry does not bypass later cache reads', async () => {
  const store = createStore();
  const source = counterSource('Membership');
  const first = createContentCache(store, quiet);
  const getFirst = first.define('membership-packages', source);
  await getFirst();

  const second = createContentCache(store, quiet);
  const getPackages = second.define('membership-packages', source);
  assert.deepEqual(await getPackages(), { title: 'Membership 1' });
  assert.equal(source.count, 1, 'a new cache instance reads saved packages without a request');
  assert.deepEqual(await getPackages(true), { title: 'Membership 2' });
  assert.deepEqual(await getPackages(), { title: 'Membership 2' });
  assert.deepEqual(await getPackages(), { title: 'Membership 2' });
  assert.equal(source.count, 2, 'only the explicit retry bypasses the cache');
});

test('deduplicates concurrent loads and allows an explicit refresh to bypass cache', async () => {
  const cache = createContentCache(createStore(), quiet);
  let requestCount = 0;
  let releaseRequest;
  const requestGate = new Promise((resolve) => { releaseRequest = resolve; });
  const getHours = cache.define('hours', {
    request: async () => {
      requestCount += 1;
      await requestGate;
      return { revision: requestCount };
    },
    parse: parseObject,
  });

  const first = getHours();
  const second = getHours();
  await tick();
  assert.equal(requestCount, 1);
  releaseRequest();
  assert.deepEqual(await Promise.all([first, second]), [{ revision: 1 }, { revision: 1 }]);
  assert.deepEqual(await getHours(true), { revision: 2 });
});

test('rejects unsafe or reserved cache keys and invalid versions', async () => {
  const cache = createContentCache(createStore(), quiet);
  const source = counterSource();
  assert.throws(() => cache.define('../home', source), /cache keys/);
  assert.throws(() => cache.define('content-version', source), /cache keys/);
  await assert.rejects(cache.applyVersion('bad version'), /Invalid/);
});

test('normalizes versions the same way as the Firebase function', () => {
  assert.equal(normalizeContentVersion(12), '12');
  assert.equal(normalizeContentVersion(' 2026-11-01.1 '), '2026-11-01.1');
  for (const invalid of [-1, 1.5, '', 'two words', 'x'.repeat(65), null, {}]) {
    assert.equal(normalizeContentVersion(invalid), null);
  }
});

test('recognizes only silent content_refresh messages', () => {
  assert.equal(PUBLIC_CONTENT_TOPIC, 'public-content');
  assert.equal(contentRefreshVersion({ type: 'content_refresh', version: '7' }), '7');
  assert.equal(contentRefreshVersion({ type: 'booking_confirmed', version: '7' }), null);
  assert.equal(contentRefreshVersion({ type: 'content_refresh', version: 'bad value' }), null);
  assert.equal(contentRefreshVersion(undefined), null);
});

test('parses the version endpoint response', () => {
  assert.equal(parseContentVersionResponse({ version: '3' }), '3');
  assert.equal(parseContentVersionResponse({ version: null }), null);
  assert.throws(() => parseContentVersionResponse({}), /invalid response/);
  assert.throws(() => parseContentVersionResponse({ version: 'a b' }), /invalid version/);
});
