export type FoodCategoryId =
  | 'produce'
  | 'dairy'
  | 'meat_seafood'
  | 'bakery'
  | 'pantry'
  | 'beverages'
  | 'frozen'
  | 'snacks'
  | 'household'
  | 'personal_care'
  | 'baby'
  | 'pet';

export type FoodDictionaryEntry = {
  canonicalName: string;
  category: FoodCategoryId;
  aliases: string[];
  tags: string[];
  packaging: string[];
};

export type SeedConfig = {
  product: string;
  brand?: string;
  variants?: string[];
  sizes?: string[];
  tags?: string[];
  packaging?: string[];
  aliases?: string[];
};

export type ExpandableSeed = SeedConfig & { category: FoodCategoryId };
