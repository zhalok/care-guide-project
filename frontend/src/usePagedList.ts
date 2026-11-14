import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import type { Page } from './types';

export interface PagedList<T> {
  items: T[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  /** HTTP status of the failure, when the error came from the API. */
  errorStatus: number | null;
  loadMore: () => void;
}

/**
 * Loads the first page when `fetchPage` changes, then appends further pages
 * with the cursor from the previous response.
 */
export function usePagedList<T>(
  fetchPage: (cursor?: string) => Promise<Page<T>>,
  onUnauthorized: () => void,
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  // Ignore responses from a previous list (tab switched mid-request).
  const generation = useRef(0);

  const load = useCallback(
    async (cursor: string | undefined, replace: boolean) => {
      const mine = ++generation.current;
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      try {
        const page = await fetchPage(cursor);
        if (mine !== generation.current) return;
        setItems((previous) =>
          replace ? page.items : [...previous, ...page.items],
        );
        setNextCursor(page.nextCursor);
      } catch (caught) {
        if (mine !== generation.current) return;
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorized();
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Request failed');
        setErrorStatus(caught instanceof ApiError ? caught.status : null);
      } finally {
        if (mine === generation.current) setLoading(false);
      }
    },
    [fetchPage, onUnauthorized],
  );

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    void load(undefined, true);
    return () => {
      generation.current++;
    };
  }, [load]);

  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor, false);
  }, [load, nextCursor]);

  return {
    items,
    hasMore: nextCursor !== null,
    loading,
    error,
    errorStatus,
    loadMore,
  };
}
