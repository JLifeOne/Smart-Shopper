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
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'list_items',
          columns: [
            { name: 'delegate_user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'checked_by', type: 'string', isOptional: true },
            { name: 'last_updated_by', type: 'string', isOptional: true },
            { name: 'version', type: 'number', isOptional: true }
          ]
        }),
        addColumns({
          table: 'lists',
          columns: [{ name: 'collaborator_snapshot', type: 'string', isOptional: true }]
        })
      ]
    },
    {
      toVersion: 9,
      steps: [
        createTable({
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
            { name: 'dietary_tags', type: 'string', isOptional: true },
            { name: 'allergen_tags', type: 'string', isOptional: true },
            { name: 'people_count', type: 'number' },
            { name: 'lock_scope', type: 'boolean', isOptional: true },
            { name: 'last_synced_at', type: 'number', isOptional: true },
            { name: 'updated_at', type: 'number' }
          ]
        }),
        createTable({
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
        createTable({
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
        createTable({
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
            { name: 'updated_at', type: 'number' }
          ]
        })
      ]
    },
    {
      toVersion: 10,
      steps: [
        createTable({
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
    },
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: 'menu_preferences',
          columns: [{ name: 'policy_json', type: 'string', isOptional: true }]
        }),
        addColumns({
          table: 'menu_recipes',
          columns: [
            { name: 'version', type: 'number', isOptional: true },
            { name: 'origin', type: 'string', isOptional: true },
            { name: 'edited_by_user', type: 'boolean', isOptional: true },
            { name: 'needs_training', type: 'boolean', isOptional: true }
          ]
        })
      ]
    }
  ]
});

export default migrations;
