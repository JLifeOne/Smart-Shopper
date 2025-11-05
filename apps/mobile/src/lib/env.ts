import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  enableMockAuth?: boolean;
  featureNewNav?: boolean;
  featureCreateWorkflow?: boolean;
  featureHeatmapV2?: boolean;
  featureInventoryView?: boolean;
  featureThemeSelection?: boolean;
  featureListParserV2?: boolean;
  featureListSharing?: boolean;
  featureAiSuggestions?: boolean;
  recoServiceUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const env = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
  enableMockAuth: extra.enableMockAuth ?? false,
  recoServiceUrl: extra.recoServiceUrl ?? ''
};

const flags = {
  newNav: extra.featureNewNav ?? false,
  createWorkflow: extra.featureCreateWorkflow ?? false,
  heatmapV2: extra.featureHeatmapV2 ?? false,
  inventoryView: extra.featureInventoryView ?? false,
  themeSelection: extra.featureThemeSelection ?? false,
  listParserV2: extra.featureListParserV2 ?? false,
  listSharing: extra.featureListSharing ?? false,
  aiSuggestions: extra.featureAiSuggestions ?? false
};

if (__DEV__) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.warn(
      'Supabase credentials are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.'
    );
  }
}

export const supabaseEnv = env;
export const featureFlags = flags;

export type SupabaseEnvironment = typeof env;
export type FeatureFlags = typeof flags;
