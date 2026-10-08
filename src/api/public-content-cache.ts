import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { createContentCache, ContentCacheStore } from './content-cache';

const memoryCache = new Map<string, string>();
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://teetimenexus.com';
let cacheNamespaceHash = 2166136261;
for (let index = 0; index < API_BASE_URL.length; index += 1) {
  cacheNamespaceHash = Math.imul(cacheNamespaceHash ^ API_BASE_URL.charCodeAt(index), 16777619);
}
const cacheNamespace = (cacheNamespaceHash >>> 0).toString(36);
const store: ContentCacheStore = Platform.OS === 'web' ? {
  async read(key) {
    return memoryCache.get(key) ?? null;
  },
  async write(key, value) {
    memoryCache.set(key, value);
  },
} : {
  async read(key) {
    const file = new File(Paths.cache, `ttn-content-${cacheNamespace}-${key}.json`);
    return file.exists ? file.text() : null;
  },
  async write(key, value) {
    const file = new File(Paths.cache, `ttn-content-${cacheNamespace}-${key}.json`);
    if (!file.exists) file.create();
    file.write(value);
  },
};

export const PUBLIC_CONTENT_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export const getCachedPublicContent = createContentCache(store);
