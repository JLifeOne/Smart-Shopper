import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { List } from '@/src/database/models/list';
import type { ListItem } from '@/src/database/models/list-item';
import type { Product } from '@/src/database/models/product';
import { SearchIndex } from './searchIndex';
import type { SearchEntity } from './types';
import { categoryLabel } from '@/src/categorization';

const featureActions: SearchEntity[] = [
  {
    id: 'feature-browse-library',
    kind: 'feature',
    title: 'Browse Library',
    subtitle: 'See your staples and price history',
    route: '/(app)/library'
  },
  {
    id: 'feature-create-list',
    kind: 'feature',
    title: 'Create a new list',
    subtitle: 'Start planning your next shop',
    route: '/(app)/home'
  }
];

class SearchService {
  private index = new SearchIndex();
  private builtOnce = false;
  private reindexTimer: ReturnType<typeof setTimeout> | null = null;

  async buildIndex() {
    try {
      const productCollection = database.get<Product>('products');
      const listCollection = database.get<List>('lists');
      const listItemCollection = database.get<ListItem>('list_items');

      const [products, lists] = await Promise.all([
        productCollection.query().fetch(),
        listCollection.query(Q.where('is_deleted', false)).fetch()
      ]);

      const productEntities: SearchEntity[] = products.map((product) => {
        const label = categoryLabel(product.category);
        const parts: string[] = [];
        if (product.variant) { parts.push(product.variant); }
        parts.push(label);
        if (product.brand) { parts.push(product.brand); }
        if (product.region) { parts.push(product.region); }
        const subtitle = parts.join(' | ') || label;
        const tags: string[] = [label];
        if (product.region) { tags.push(product.region); }
        if (product.variant) { tags.push(product.variant); }
        return {
          id: product.id,
          kind: 'product',
          title: product.name,
          subtitle,
          tags,
          route: '/(app)/library',
          payload: { productId: product.id }
        } satisfies SearchEntity;
      });
      const listEntities: SearchEntity[] = await Promise.all(
        lists.map(async (list) => {
          const itemCount = await listItemCollection
            .query(Q.where('list_id', list.id), Q.where('is_deleted', false))
            .fetchCount();

          return {
            id: list.id,
            kind: 'list',
            title: list.name,
            subtitle: itemCount ? `${itemCount} items` : undefined,
            tags: list.isShared ? ['shared'] : undefined,
            route: `/(app)/lists/${list.id}`,
            payload: { listId: list.id }
          } satisfies SearchEntity;
        })
      );

      const merged = [...productEntities, ...listEntities, ...featureActions];
      this.index.set(merged);
      this.builtOnce = true;
      return merged.length;
    } catch (error) {
      console.error('searchService.buildIndex failed', error);
      return 0;
    }
  }

  search(query: string) {
    if (!this.builtOnce) {
      return [];
    }
    return this.index.query(query);
  }

  requestReindex(delayMs = 400) {
    if (this.reindexTimer) {
      clearTimeout(this.reindexTimer);
    }
    this.reindexTimer = setTimeout(() => {
      this.buildIndex().catch((error) => {
        console.error('searchService.reindex failed', error);
      });
    }, delayMs);
  }

  attachLiveReindex() {
    const products$ = database.get<Product>('products').query().observe();
    const lists$ = database.get<List>('lists').query(Q.where('is_deleted', false)).observe();

    const sub1 = products$.subscribe(() => this.requestReindex());
    const sub2 = lists$.subscribe(() => this.requestReindex());

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  }
}

export const searchService = new SearchService();


