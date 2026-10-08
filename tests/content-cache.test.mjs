import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { createContentCache } = await import('../src/api/content-cache.ts');
hooks.deregister();

function createStore() {
  const values = new Map();
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

test('uses fresh cached content and fetches again after the TTL expires', async () => {
  const store = createStore();
  let time = 100;
  let requestCount = 0;
  const getCachedContent = createContentCache(store, () => time);
  const options = {
    key: 'home',
    maxAgeMs: 500,
    request: async () => ({ title: `Response ${++requestCount}` }),
    parse: parseObject,
  };

  assert.deepEqual(await getCachedContent(options), { title: 'Response 1' });
  time += 499;
  assert.deepEqual(await getCachedContent(options), { title: 'Response 1' });
  assert.equal(requestCount, 1);

  time += 1;
  assert.deepEqual(await getCachedContent(options), { title: 'Response 2' });
  assert.equal(requestCount, 2);
});

test('deduplicates concurrent loads and allows an explicit refresh to bypass cache', async () => {
  const store = createStore();
  const getCachedContent = createContentCache(store);
  let requestCount = 0;
  let releaseRequest;
  const requestGate = new Promise((resolve) => { releaseRequest = resolve; });
  const options = {
    key: 'hours',
    maxAgeMs: 60_000,
    request: async () => {
      requestCount += 1;
      await requestGate;
      return { revision: requestCount };
    },
    parse: parseObject,
  };

  const first = getCachedContent(options);
  const second = getCachedContent(options);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requestCount, 1);
  releaseRequest();
  assert.deepEqual(await Promise.all([first, second]), [{ revision: 1 }, { revision: 1 }]);

  const refreshed = await getCachedContent({ ...options, forceRefresh: true });
  assert.deepEqual(refreshed, { revision: 2 });
  assert.equal(requestCount, 2);
});

test('rejects unsafe cache keys before reading or requesting', async () => {
  const store = createStore();
  const getCachedContent = createContentCache(store);
  await assert.rejects(getCachedContent({
    key: '../home',
    maxAgeMs: 1000,
    request: async () => ({ title: 'unused' }),
    parse: parseObject,
  }), /cache keys/);
});
