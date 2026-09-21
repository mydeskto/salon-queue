"use client";

import { useCallback, useEffect, useState } from 'react';

interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Loads data once and re-loads on demand (socket events) or on an interval. */
export function useLoader<T>(
  load: () => Promise<T>,
  deps: unknown[],
  intervalMs?: number,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    load()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, deps);

  useEffect(() => {
    run();
    if (!intervalMs) return;
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }, [run, intervalMs]);

  return { data, error, loading, reload: run };
}
