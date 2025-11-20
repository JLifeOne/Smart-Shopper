import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { List } from '@/src/database/models/list';
import type { ListItem } from '@/src/database/models/list-item';
import { parseCollaboratorSnapshot } from './collaborator-snapshot';

export type ListSummary = {
  id: string;
  remoteId: string | null;
  name: string;
  ownerId: string | null;
  itemCount: number;
  updatedAt: number;
  isShared: boolean;
  collaboratorIds: string[];
};

export type UseListsOptions = {
  ownerId?: string | null;
};

export function useLists(options: UseListsOptions = {}) {
  const { ownerId } = options;
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const collection = database.get<ListItem>('list_items');
    const query = collection.query(Q.where('is_deleted', false));
    const observable =
      typeof (query as any).observeWithColumns === 'function'
        ? (query as any).observeWithColumns(['list_id'])
        : query.observe();

    const subscription = (observable as any).subscribe({
      next: (records: ListItem[]) => {
        const counts: Record<string, number> = {};
        records.forEach((record) => {
          const listId = record.listId;
          counts[listId] = (counts[listId] ?? 0) + 1;
        });
        setItemCounts(counts);
      },
      error: (err: unknown) => {
        console.error('useLists: item count subscription error', err);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
          const summaries = records.map((record) => ({
            id: record.id,
            remoteId: record.remoteId,
            name: record.name,
            ownerId: record.ownerId,
            isShared: record.isShared,
            updatedAt: record.updatedAt,
            collaboratorIds: parseCollaboratorSnapshot(record.collaboratorSnapshot),
            itemCount: itemCounts[record.id] ?? 0
          }));
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
  }, [ownerId, itemCounts]);

  return useMemo(
    () => ({ lists, loading, error }),
    [lists, loading, error]
  );
}
