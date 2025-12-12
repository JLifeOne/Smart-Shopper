import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 11,
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
        { name: 'store_id', type: 'string', isOptional: true },
        { name: 'store_label', type: 'string', isOptional: true },
        { name: 'store_region', type: 'string', isOptional: true },
        { name: 'aisle_order', type: 'string', isOptional: true },
        { name: 'collaborator_snapshot', type: 'string', isOptional: true },
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
        { name: 'is_checked', type: 'boolean', isOptional: true },
        { name: 'dirty', type: 'boolean' },
        { name: 'brand_remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'brand_confidence', type: 'number', isOptional: true },
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'category_confidence', type: 'number', isOptional: true },
        { name: 'category_band', type: 'string', isOptional: true },
        { name: 'category_source', type: 'string', isOptional: true },
        { name: 'category_canonical', type: 'string', isOptional: true },
        { name: 'delegate_user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'checked_by', type: 'string', isOptional: true },
        { name: 'last_updated_by', type: 'string', isOptional: true },
        { name: 'version', type: 'number', isOptional: true },
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
        { name: 'region', type: 'string', isIndexed: true, isOptional: true },
        { name: 'variant', type: 'string', isOptional: true },
        { name: 'size_value', type: 'number' },
        { name: 'size_unit', type: 'string' },
        { name: 'barcode', type: 'string', isOptional: true },
        { name: 'tags', type: 'string', isOptional: true },
        { name: 'source_url', type: 'string', isOptional: true },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'search_key', type: 'string', isIndexed: true, isOptional: true },
        { name: 'brand_remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'brand_confidence', type: 'number', isOptional: true },
        { name: 'brand_source', type: 'string', isOptional: true },
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
        { name: 'source', type: 'string' },
        { name: 'brand_remote_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'brand_confidence', type: 'number', isOptional: true }
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
    }),
    tableSchema({
      name: 'menu_recipes',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'course', type: 'string', isOptional: true },
        { name: 'cuisine_style', type: 'string', isOptional: true },
        { name: 'servings_json', type: 'string' },
        { name: 'ingredients_json', type: 'string' },
        { name: 'method_json', type: 'string' },
        { name: 'tips', type: 'string', isOptional: true },
        { name: 'packaging_notes', type: 'string', isOptional: true },
        { name: 'packaging_guidance', type: 'string', isOptional: true },
        { name: 'premium_required', type: 'boolean' },
        { name: 'version', type: 'number', isOptional: true },
        { name: 'origin', type: 'string', isOptional: true },
        { name: 'edited_by_user', type: 'boolean', isOptional: true },
        { name: 'needs_training', type: 'boolean', isOptional: true },
        { name: 'dietary_tags', type: 'string', isOptional: true },
        { name: 'allergen_tags', type: 'string', isOptional: true },
        { name: 'people_count', type: 'number' },
        { name: 'lock_scope', type: 'boolean', isOptional: true },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' }
      ]
    }),
    tableSchema({
      name: 'menu_sessions',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' },
        { name: 'source_asset_url', type: 'string', isOptional: true },
        { name: 'intent_route', type: 'string', isOptional: true },
        { name: 'dish_titles', type: 'string', isOptional: true },
        { name: 'warnings', type: 'string', isOptional: true },
        { name: 'payload', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'last_synced_at', type: 'number', isOptional: true }
      ]
    }),
    tableSchema({
      name: 'menu_pairs',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'dish_ids', type: 'string' },
        { name: 'locale', type: 'string', isOptional: true },
        { name: 'is_default', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
        { name: 'last_synced_at', type: 'number', isOptional: true }
      ]
    }),
    tableSchema({
      name: 'menu_preferences',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'locale', type: 'string', isOptional: true },
        { name: 'dietary_tags', type: 'string', isOptional: true },
        { name: 'allergen_flags', type: 'string', isOptional: true },
        { name: 'default_people_count', type: 'number' },
        { name: 'auto_scale', type: 'boolean' },
        { name: 'allow_card_lock', type: 'boolean' },
        { name: 'blur_recipes', type: 'boolean' },
        { name: 'access_level', type: 'string' },
        { name: 'policy_json', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' }
      ]
    }),
    tableSchema({
      name: 'menu_reviews',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' },
        { name: 'card_id', type: 'string', isOptional: true },
        { name: 'session_id', type: 'string', isOptional: true },
        { name: 'dish_title', type: 'string', isOptional: true },
        { name: 'reason', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'reviewed_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'last_synced_at', type: 'number', isOptional: true }
      ]
    })
  ]
});

export default schema;
