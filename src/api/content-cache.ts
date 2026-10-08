export type ContentCacheStore = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
};

type CacheEnvelope = {
  cachedAt: number;
  value: unknown;
};

type CachedContentOptions<T> = {
  key: string;
  maxAgeMs: number;
  request: () => Promise<unknown>;
  parse: (value: unknown) => T;
  forceRefresh?: boolean;
};

export function createContentCache(store: ContentCacheStore, now: () => number = Date.now) {
  const inFlight = new Map<string, Promise<unknown>>();

  return async function getCachedContent<T>({
    key,
    maxAgeMs,
    request,
    parse,
    forceRefresh = false,
  }: CachedContentOptions<T>): Promise<T> {
    if (!/^[a-z0-9-]+$/.test(key)) {
      throw new Error('Content cache keys must contain only lowercase letters, numbers, and hyphens.');
    }

    if (!forceRefresh) {
      try {
        const serialized = await store.read(key);
        if (serialized) {
          const envelope = JSON.parse(serialized) as CacheEnvelope;
          const age = now() - envelope.cachedAt;
          if (Number.isFinite(envelope.cachedAt) && age >= 0 && age < maxAgeMs) {
            return parse(envelope.value);
          }
        }
      } catch (error) {
        console.warn(`Unable to read cached website content (${key}).`, error);
      }
    }

    const existingRequest = inFlight.get(key);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }

    const pending = (async () => {
      const value = parse(await request());
      const envelope: CacheEnvelope = { cachedAt: now(), value };
      try {
        await store.write(key, JSON.stringify(envelope));
      } catch (error) {
        console.warn(`Unable to save cached website content (${key}).`, error);
      }
      return value;
    })();

    inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      if (inFlight.get(key) === pending) {
        inFlight.delete(key);
      }
    }
  };
}
