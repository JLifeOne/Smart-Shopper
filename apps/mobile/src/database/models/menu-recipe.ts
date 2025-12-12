import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MenuRecipe extends Model {
  static table = 'menu_recipes';

  @field('remote_id') remoteId!: string;
  @field('title') title!: string;
  @field('course') course?: string;
  @field('cuisine_style') cuisineStyle?: string;
  @field('servings_json') servingsJson!: string;
  @field('ingredients_json') ingredientsJson!: string;
  @field('method_json') methodJson!: string;
  @field('tips') tips?: string;
  @field('packaging_notes') packagingNotes?: string;
  @field('packaging_guidance') packagingGuidance?: string;
  @field('premium_required') premiumRequired!: boolean;
  @field('version') version?: number;
  @field('origin') origin?: string;
  @field('edited_by_user') editedByUser?: boolean;
  @field('needs_training') needsTraining?: boolean;
  @field('dietary_tags') dietaryTags?: string;
  @field('allergen_tags') allergenTags?: string;
  @field('people_count') peopleCount!: number;
  @field('lock_scope') lockScope?: boolean;
  @field('last_synced_at') lastSyncedAt?: number;
  @field('updated_at') updatedAt!: number;
}
