import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations';

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
    }
  ]
});

export default migrations;
