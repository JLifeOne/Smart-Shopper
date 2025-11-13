import { database } from '@/src/database';
import type { List } from '@/src/database/models/list';
import type { Collaborator } from './collaboration-api';

export async function persistCollaboratorSnapshot(listId: string, collaborators: Collaborator[]) {
  if (!listId) {
    return;
  }
  const ids = collaborators.map((member) => member.user_id).filter((id): id is string => Boolean(id));
  try {
    await database.write(async () => {
      const record = await database.get<List>('lists').find(listId);
      await record.update((list) => {
        list.collaboratorSnapshot = ids.length ? JSON.stringify(ids) : null;
        list.isShared = ids.length > 0;
      });
    });
  } catch (err) {
    console.warn('persistCollaboratorSnapshot failed', err);
  }
}

export function parseCollaboratorSnapshot(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
