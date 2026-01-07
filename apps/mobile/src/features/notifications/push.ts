import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import OneSignal from 'react-native-onesignal';
import { featureFlags, supabaseEnv } from '@/src/lib/env';
import { registerNotificationDevice, updateNotificationPreferences } from './api';

const DEVICE_ID_KEY = 'smartshopper:notification_device_id';
type PushProvider = 'expo' | 'onesignal';

const resolvePushProvider = (): PushProvider => {
  const raw = (supabaseEnv.notificationsProvider ?? '').toLowerCase();
  if (raw === 'onesignal') {
    return 'onesignal';
  }
  if (raw === 'auto') {
    return supabaseEnv.oneSignalAppId ? 'onesignal' : 'expo';
  }
  return 'expo';
};

let oneSignalInitialized = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

const generateDeviceId = () => {
  const random = Math.random().toString(36).slice(2, 12);
  return `device-${random}-${Date.now().toString(36)}`;
};

async function getOrCreateDeviceId() {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    return stored;
  }
  const next = generateDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

async function registerExpoNotifications() {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== 'granted') {
    try {
      await updateNotificationPreferences({ push_enabled: false });
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to update push preference', error);
      }
    }
    return;
  }

  const projectId =
    supabaseEnv.expoProjectId ||
    (Constants.expoConfig?.extra?.expoProjectId as string | undefined) ||
    undefined;
  if (!projectId) {
    if (__DEV__) {
      console.warn('EXPO_PUBLIC_EXPO_PROJECT_ID is missing; push token registration skipped.');
    }
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  if (!token) {
    if (__DEV__) {
      console.warn('Expo push token missing; registration skipped.');
    }
    return;
  }

  try {
    await registerNotificationDevice({
      provider: 'expo',
      providerSubscriptionId: token,
      deviceId: await getOrCreateDeviceId(),
      platform: Device.osName?.toLowerCase() === 'ios' ? 'ios' : 'android',
      deviceInfo: {
        modelName: Device.modelName ?? null,
        osName: Device.osName ?? null,
        osVersion: Device.osVersion ?? null
      },
      pushEnabled: true
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to register device for push notifications', error);
    }
  }
}

async function ensureOneSignalInitialized() {
  if (oneSignalInitialized) {
    return true;
  }
  const appId = supabaseEnv.oneSignalAppId || (Constants.expoConfig?.extra?.oneSignalAppId as string | undefined);
  if (!appId) {
    if (__DEV__) {
      console.warn('EXPO_PUBLIC_ONESIGNAL_APP_ID is missing; OneSignal registration skipped.');
    }
    return false;
  }
  const oneSignalApi = OneSignal as unknown as { initialize?: (id: string) => void };
  oneSignalApi.initialize?.(appId);
  oneSignalInitialized = true;
  return true;
}

async function waitForOneSignalSubscriptionId(timeoutMs = 5000): Promise<string | null> {
  const start = Date.now();
  // OneSignal SDK types differ across versions; rely on runtime checks for safety.
  const oneSignalApi = OneSignal as any;
  while (Date.now() - start < timeoutMs) {
    const id = oneSignalApi?.User?.pushSubscription?.id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function registerOneSignalNotifications(userId?: string | null) {
  const initialized = await ensureOneSignalInitialized();
  if (!initialized) {
    return;
  }
  const oneSignalApi = OneSignal as any;
  if (userId && typeof oneSignalApi?.login === 'function') {
    oneSignalApi.login(userId);
  }
  if (typeof oneSignalApi?.Notifications?.requestPermission === 'function') {
    const granted = await oneSignalApi.Notifications.requestPermission(true);
    if (!granted) {
      try {
        await updateNotificationPreferences({ push_enabled: false });
      } catch (error) {
        if (__DEV__) {
          console.warn('Failed to update push preference', error);
        }
      }
      return;
    }
  }

  const subscriptionId = await waitForOneSignalSubscriptionId();
  if (!subscriptionId) {
    if (__DEV__) {
      console.warn('OneSignal subscription ID missing; registration skipped.');
    }
    return;
  }

  try {
    await registerNotificationDevice({
      provider: 'onesignal',
      providerSubscriptionId: subscriptionId,
      deviceId: await getOrCreateDeviceId(),
      platform: Device.osName?.toLowerCase() === 'ios' ? 'ios' : 'android',
      deviceInfo: {
        modelName: Device.modelName ?? null,
        osName: Device.osName ?? null,
        osVersion: Device.osVersion ?? null
      },
      pushEnabled: true
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to register device for OneSignal notifications', error);
    }
  }
}

export async function registerForPromoNotifications(userId?: string | null) {
  if (!featureFlags.promoNotifications) {
    return;
  }
  if (!Device.isDevice) {
    if (__DEV__) {
      console.warn('Push notifications require a physical device.');
    }
    return;
  }

  const provider = resolvePushProvider();
  if (provider === 'onesignal') {
    await registerOneSignalNotifications(userId);
    return;
  }

  await registerExpoNotifications();
}

export function disconnectPromoNotifications() {
  const provider = resolvePushProvider();
  if (provider !== 'onesignal') {
    return;
  }
  const oneSignalApi = OneSignal as any;
  if (typeof oneSignalApi?.logout === 'function') {
    oneSignalApi.logout();
  }
}
