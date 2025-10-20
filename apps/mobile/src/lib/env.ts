import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  enableMockAuth?: boolean;
  featureNewNav?: boolean;
  featureCreateWorkflow?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const env = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
  enableMockAuth: extra.enableMockAuth ?? false
};

const flags = {
  newNav: extra.featureNewNav ?? false,
  createWorkflow: extra.featureCreateWorkflow ?? false
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
