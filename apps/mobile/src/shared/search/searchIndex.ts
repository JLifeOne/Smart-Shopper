import Fuse from 'fuse.js';
import type { SearchEntity } from './types';

export class SearchIndex {
  private fuse: Fuse<SearchEntity> | null = null;
  private data: SearchEntity[] = [];

  set(entities: SearchEntity[]) {
    this.data = entities;
    this.fuse = new Fuse(entities, {
      keys: ['title', 'subtitle', 'tags'],
      threshold: 0.34,
      ignoreLocation: true,
      includeScore: true
    });
  }

  query(query: string): SearchEntity[] {
    const trimmed = query.trim();
    if (!trimmed || !this.fuse) {
      return [];
    }

    return this.fuse
      .search(trimmed)
      .map((result) => ({ ...result.item, score: result.score ?? undefined }))
      .slice(0, 25);
  }
}
