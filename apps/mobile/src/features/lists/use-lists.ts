import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { List } from '@/src/database/models/list';
import type { ListItem } from '@/src/database/models/list-item';

export type ListSummary = {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: number;
  isShared: boolean;
};

export type UseListsOptions = {
  ownerId?: string | null;
};

export function useLists(options: UseListsOptions = {}) {
  const { ownerId } = options;
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const collection = database.get<List>('lists');
    const clauses: any[] = [Q.where('is_deleted', false)];
    if (ownerId) {
      clauses.push(Q.where('owner_id', ownerId));
    }
    clauses.push(Q.sortBy('updated_at', Q.desc));
    const query = collection.query(...clauses);

    const subscription = query.observe().subscribe({
      next: async (records) => {
        try {
          const summaries = await Promise.all(
            records.map(async (record) => ({
              id: record.id,
              name: record.name,
              isShared: record.isShared,
              updatedAt: record.updatedAt,
              itemCount: await database
                .get<ListItem>('list_items')
                .query(Q.where('list_id', record.id), Q.where('is_deleted', false))
                .fetchCount()
            }))
          );
          setLists(summaries);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('useLists: failed to build summaries', err);
          setError(err instanceof Error ? err.message : 'Unable to load lists');
        }
      },
      error: (err) => {
        console.error('useLists: subscription error', err);
        setError(err instanceof Error ? err.message : 'Unable to load lists');
      }
    });

    return () => subscription.unsubscribe();
  }, [ownerId]);

  return useMemo(
    () => ({ lists, loading, error }),
    [lists, loading, error]
  );
}
