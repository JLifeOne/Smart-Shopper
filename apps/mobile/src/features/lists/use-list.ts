import { useEffect, useMemo, useState } from 'react';
import { database } from '@/src/database';
import type { List } from '@/src/database/models/list';

export function useList(listId?: string) {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listId) {
      setList(null);
      setLoading(false);
      setError('List not found');
      return undefined;
    }

    let active = true;
    let subscription: { unsubscribe(): void } | undefined;

    database
      .get<List>('lists')
      .find(listId)
      .then((record) => {
        if (!active) {
          return;
        }
        setList(record);
        setLoading(false);
        subscription = record.observe().subscribe({
          next: (nextRecord) => setList(nextRecord),
          error: (err) => {
            console.error('useList: observe failed', err);
            setError(err instanceof Error ? err.message : 'Unable to load list');
          }
        });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        console.error('useList: find failed', err);
        setError('List not found');
        setLoading(false);
      });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [listId]);

  return useMemo(() => ({ list, loading, error }), [list, loading, error]);
}
