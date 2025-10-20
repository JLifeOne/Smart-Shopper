import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'Smart Shopper';
const APP_SLUG = 'smart-shopper';
const VERSION = '0.1.0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  version: VERSION,
  orientation: 'portrait',
  scheme: 'smartshopper',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  updates: {
    url: 'https://u.expo.dev/placeholder',
    fallbackToCacheTimeout: 0
  },
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0C1D37'
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.smartshopper.app',
    runtimeVersion: {
      policy: 'sdkVersion'
    }
  },
  android: {
    package: 'com.smartshopper.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF'
    },
    permissions: []
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png'
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-image-picker', 'expo-system-ui'],
  experiments: {
    typedRoutes: true
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    enableMockAuth: process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH === 'true',
    featureNewNav: process.env.EXPO_PUBLIC_FEATURE_NEW_NAV === 'true',
    featureCreateWorkflow: process.env.EXPO_PUBLIC_FEATURE_CREATE_WORKFLOW === 'true',
    featureHeatmapV2: process.env.EXPO_PUBLIC_FEATURE_HEATMAP_V2 === 'true',
    featureInventoryView: process.env.EXPO_PUBLIC_FEATURE_INVENTORY_VIEW === 'true',
    featureThemeSelection: process.env.EXPO_PUBLIC_FEATURE_THEME_SELECTION === 'true',
    featureListParserV2: process.env.EXPO_PUBLIC_FEATURE_LIST_PARSER_V2 === 'true',
    featureListSharing: process.env.EXPO_PUBLIC_FEATURE_LIST_SHARING === 'true',
    featureAiSuggestions: process.env.EXPO_PUBLIC_FEATURE_AI_SUGGESTIONS === 'true',
    recoServiceUrl: process.env.EXPO_PUBLIC_RECO_SERVICE_URL ?? ''
  }
});
