import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'category_signals',
          columns: [
            { name: 'product_key', type: 'string', isIndexed: true },
            { name: 'category', type: 'string' },
            { name: 'confidence', type: 'number' },
            { name: 'source', type: 'string' },
            { name: 'merchant_code', type: 'string', isOptional: true },
            { name: 'payload', type: 'string', isOptional: true },
            { name: 'updated_at', type: 'number' }
          ]
        })
      ]
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'region', type: 'string', isOptional: true },
            { name: 'variant', type: 'string', isOptional: true },
            { name: 'tags', type: 'string', isOptional: true },
            { name: 'source_url', type: 'string', isOptional: true },
            { name: 'image_url', type: 'string', isOptional: true },
            { name: 'search_key', type: 'string', isOptional: true, isIndexed: true }
          ]
        })
      ]
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'list_items',
          columns: [
            { name: 'is_checked', type: 'boolean', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'lists',
          columns: [
            { name: 'store_id', type: 'string', isOptional: true },
            { name: 'store_label', type: 'string', isOptional: true },
            { name: 'store_region', type: 'string', isOptional: true },
            { name: 'aisle_order', type: 'string', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'brand_remote_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'brand_confidence', type: 'number', isOptional: true },
            { name: 'brand_source', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'list_items',
          columns: [
            { name: 'brand_remote_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'brand_confidence', type: 'number', isOptional: true }
          ]
        }),
        addColumns({
          table: 'price_snapshots',
          columns: [
            { name: 'brand_remote_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'brand_confidence', type: 'number', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'list_items',
          columns: [
            { name: 'category_id', type: 'string', isOptional: true },
            { name: 'category_confidence', type: 'number', isOptional: true },
            { name: 'category_band', type: 'string', isOptional: true },
            { name: 'category_source', type: 'string', isOptional: true },
            { name: 'category_canonical', type: 'string', isOptional: true }
          ]
        })
      ]
    }
  ]
});

export default migrations;
