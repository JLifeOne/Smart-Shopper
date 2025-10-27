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
    }
  ]
});

export default migrations;
