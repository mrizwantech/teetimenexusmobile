export type ContentCacheStore = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
};

export type ContentSource<T> = {
  request: () => Promise<unknown>;
  parse: (value: unknown) => T;
};

export type ContentRefreshResult = { refreshed: string[]; failed: string[] };
type CacheEnvelope = { version: string | null; value: unknown };
type Listener = (key: string, value: unknown) => void;
type Log = { warn: (message: string, ...details: unknown[]) => void };

const VERSION_KEY = 'content-version';

/** Must match parseContentVersion in functions/src/content-refresh.ts. */
export function normalizeContentVersion(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{1,64}$/.test(trimmed) ? trimmed : null;
}

/**
 * Version-controlled cache: cached content is served until the content version changes. A changed version
 * keeps serving the old content while a background refresh fetches and validates the replacement.
 */
export function createContentCache(store: ContentCacheStore, log: Log = console) {
  const sources = new Map<string, ContentSource<unknown>>();
  const inFlight = new Map<string, Promise<unknown>>();
  const listeners = new Set<Listener>();
  let currentVersion: Promise<string> | null = null;
  let running: Promise<ContentRefreshResult> | null = null;
  let queued: Promise<ContentRefreshResult> | null = null;

  function getVersion() {
    currentVersion ??= store.read(VERSION_KEY)
      .then((value) => normalizeContentVersion(value) ?? '')
      .catch((error: unknown) => {
        log.warn('Unable to read the cached content version.', error);
        return '';
      });
    return currentVersion;
  }

  async function readEnvelope(key: string): Promise<CacheEnvelope | null> {
    try {
      const serialized = await store.read(key);
      if (!serialized) return null;
      const envelope: unknown = JSON.parse(serialized);
      if (typeof envelope !== 'object' || envelope === null || !('value' in envelope)) return null;
      // Entries from the former time-based cache have no version and are refreshed in the background.
      const version = 'version' in envelope && typeof envelope.version === 'string' ? envelope.version : null;
      return { version, value: envelope.value };
    } catch (error) {
      log.warn(`Unable to read cached website content (${key}).`, error);
      return null;
    }
  }

  function fetchAndStore(key: string): Promise<unknown> {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const source = sources.get(key)!;
    const pending = (async () => {
      // Stamp with the version known before fetching so a version change mid-request triggers another refresh.
      const version = await getVersion();
      const value = source.parse(await source.request());
      try {
        await store.write(key, JSON.stringify({ version, value } satisfies CacheEnvelope));
      } catch (error) {
        log.warn(`Unable to save cached website content (${key}).`, error);
      }
      for (const listener of listeners) {
        try {
          listener(key, value);
        } catch (error) {
          log.warn(`Content update listener failed (${key}).`, error);
        }
      }
      return value;
    })();
    inFlight.set(key, pending);
    void pending.then(
      () => { if (inFlight.get(key) === pending) inFlight.delete(key); },
      () => { if (inFlight.get(key) === pending) inFlight.delete(key); },
    );
    return pending;
  }

  function refreshInBackground(key: string) {
    fetchAndStore(key).catch((error: unknown) => {
      log.warn(`Background refresh failed; keeping cached website content (${key}).`, error);
    });
  }

  async function refreshAll(): Promise<ContentRefreshResult> {
    const version = await getVersion();
    const result: ContentRefreshResult = { refreshed: [], failed: [] };
    await Promise.all([...sources.keys()].map(async (key) => {
      const cached = await readEnvelope(key);
      // Content that was never loaded is fetched when a screen first needs it.
      if (!cached || cached.version === version) return;
      try {
        await fetchAndStore(key);
        result.refreshed.push(key);
      } catch (error) {
        log.warn(`Background refresh failed; keeping cached website content (${key}).`, error);
        result.failed.push(key);
      }
    }));
    return result;
  }

  /** Refreshes every cached entry whose version differs from the current one. Never rejects. */
  function refreshOutdated(): Promise<ContentRefreshResult> {
    if (!running) {
      running = refreshAll();
      void running.finally(() => { running = null; });
      return running;
    }
    queued ??= running.then(() => {
      queued = null;
      return refreshOutdated();
    });
    return queued;
  }

  /** Records a new content version (from push or the version endpoint) and refreshes outdated entries. */
  async function applyVersion(value: unknown): Promise<ContentRefreshResult> {
    const version = normalizeContentVersion(value);
    if (version === null) throw new Error('Invalid public content version.');
    if (version !== await getVersion()) {
      currentVersion = Promise.resolve(version);
      try {
        await store.write(VERSION_KEY, version);
      } catch (error) {
        log.warn('Unable to save the content version.', error);
      }
    }
    return refreshOutdated();
  }

  function define<T>(key: string, source: ContentSource<T>) {
    if (!/^[a-z0-9-]+$/.test(key) || key === VERSION_KEY) {
      throw new Error('Content cache keys must contain only lowercase letters, numbers, and hyphens.');
    }
    // Re-definition replaces the source so Fast Refresh can re-evaluate API modules.
    sources.set(key, source);

    return async function getCachedContent(forceRefresh = false): Promise<T> {
      if (!forceRefresh) {
        const cached = await readEnvelope(key);
        if (cached) {
          try {
            const value = source.parse(cached.value);
            if (cached.version !== await getVersion()) refreshInBackground(key);
            return value;
          } catch (error) {
            log.warn(`Discarding invalid cached website content (${key}).`, error);
          }
        }
      }
      return fetchAndStore(key) as Promise<T>;
    };
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  return { define, applyVersion, refreshOutdated, subscribe, getVersion };
}
