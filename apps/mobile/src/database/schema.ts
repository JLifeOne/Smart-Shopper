import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'lists',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'owner_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'is_shared', type: 'boolean' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'dirty', type: 'boolean' },
        { name: 'device_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'last_synced_at', type: 'number', isOptional: true }
      ]
    }),
    tableSchema({
      name: 'list_items',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'list_id', type: 'string', isIndexed: true },
        { name: 'product_remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'label', type: 'string' },
        { name: 'desired_qty', type: 'number' },
        { name: 'substitutions_ok', type: 'boolean' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'dirty', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'last_synced_at', type: 'number', isOptional: true }
      ]
    }),
    tableSchema({
      name: 'products',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'size_value', type: 'number' },
        { name: 'size_unit', type: 'string' },
        { name: 'barcode', type: 'string', isOptional: true },
        { name: 'dirty', type: 'boolean' },
        { name: 'last_synced_at', type: 'number', isOptional: true }
      ]
    }),
    tableSchema({
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
    }),
    tableSchema({
      name: 'price_snapshots',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'product_remote_id', type: 'string', isIndexed: true },
        { name: 'store_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'unit_price', type: 'number' },
        { name: 'currency', type: 'string' },
        { name: 'captured_at', type: 'number' },
        { name: 'source', type: 'string' }
      ]
    }),
    tableSchema({
      name: 'receipt_uploads',
      columns: [
        { name: 'local_uri', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string', isOptional: true },
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'retry_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),
    tableSchema({
      name: 'sync_events',
      columns: [
        { name: 'event_type', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'retry_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'last_attempt_at', type: 'number', isOptional: true }
      ]
    })
  ]
});

export default schema;
