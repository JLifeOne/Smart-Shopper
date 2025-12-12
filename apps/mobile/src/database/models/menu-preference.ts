import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MenuPreference extends Model {
  static table = 'menu_preferences';

  @field('remote_id') remoteId!: string;
  @field('locale') locale?: string;
  @field('dietary_tags') dietaryTags?: string;
  @field('allergen_flags') allergenFlags?: string;
  @field('default_people_count') defaultPeopleCount!: number;
  @field('auto_scale') autoScale!: boolean;
  @field('allow_card_lock') allowCardLock!: boolean;
  @field('blur_recipes') blurRecipes!: boolean;
  @field('access_level') accessLevel!: string;
  @field('policy_json') policyJson?: string;
  @field('updated_at') updatedAt!: number;
}
