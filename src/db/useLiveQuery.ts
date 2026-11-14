import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

export function useDexieLiveQuery<T>(
  querier: () => Promise<T>,
  deps: readonly unknown[],
  initialValue: T
): { data: T; isLoading: boolean; error: Error | null } {
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const subscription = liveQuery(querier).subscribe({
      next: (value) => {
        if (!active) return;
        setData(value);
        setIsLoading(false);
        setError(null);
      },
      error: (err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, error };
}

