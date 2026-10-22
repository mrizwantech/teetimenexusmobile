import { useEffect, useRef } from 'react';

import { onPublicContentUpdated } from '../api/public-content-refresh';

/** Calls `onUpdate` with validated content when a background refresh replaces the cached entry for `key`. */
export function usePublicContentUpdate<T>(key: string, onUpdate: (value: T) => void) {
  const callback = useRef(onUpdate);
  useEffect(() => { callback.current = onUpdate; });
  useEffect(() => onPublicContentUpdated(key, (value) => callback.current(value as T)), [key]);
}
