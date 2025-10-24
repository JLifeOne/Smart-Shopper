import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { ListItem } from '@/src/database/models/list-item';

export type ListItemSummary = {
  id: string;
  label: string;
  desiredQty: number;
  substitutionsOk: boolean;
  notes: string | null;
  updatedAt: number;
};

export function useListItems(listId: string | null | undefined) {
  const [items, setItems] = useState<ListItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const collection = database.get<ListItem>('list_items');
    const query = collection.query(
      Q.where('list_id', listId),
      Q.where('is_deleted', false),
      Q.sortBy('updated_at', Q.desc)
    );

    const subscription = query.observe().subscribe({
      next: (records) => {
        setItems(
          records.map((record) => ({
            id: record.id,
            label: record.label,
            desiredQty: record.desiredQty,
            substitutionsOk: record.substitutionsOk,
            notes: record.notes,
            updatedAt: record.updatedAt
          }))
        );
        setLoading(false);
        setError(null);
      },
      error: (err) => {
        console.error('useListItems: subscription error', err);
        setError(err instanceof Error ? err.message : 'Unable to load items');
      }
    });

    return () => subscription.unsubscribe();
  }, [listId]);

  return useMemo(
    () => ({ items, loading, error }),
    [items, loading, error]
  );
}
