import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ensureSupabaseClient } from '@/src/lib/supabase';
import { withTimeout } from '@/src/lib/retry';
import { AppError } from '@/src/lib/errors';

export type CameraListItem = {
  label: string;
  quantity: number;
  unit?: string | null;
  category?: string | null;
  categoryLabel?: string | null;
  confidence?: number;
};

export type CameraListCaptureResult = {
  items: CameraListItem[];
  rawText: string;
  confidence: number;
  warnings?: string[];
  imageUri: string;
};

export type PromoCaptureResult = {
  title: string;
  description?: string;
  price?: { current: number; currency: string; previous?: number | null };
  store?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  tags?: string[];
  confidence: number;
  rawText?: string;
  imageUri: string;
};

export type CameraCaptureMode = 'list' | 'promo';

async function ensureCameraPermission() {
  const { granted } = await (ImagePicker as any).requestCameraPermissionsAsync();
  if (!granted) {
    throw new AppError({
      code: 'input/validation',
      message: 'camera-permission-denied',
      safeMessage: 'Camera access is required to capture a photo.',
      retryable: false
    });
  }
}

async function capturePhoto(): Promise<ImagePicker.ImagePickerAsset> {
  await ensureCameraPermission();
  const result = await (ImagePicker as any).launchCameraAsync({
    allowsEditing: false,
    quality: 0.85,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: false
  });
  if ((result as any).cancelled || result.canceled) {
    throw new AppError({
      code: 'input/validation',
      message: 'capture-cancelled',
      safeMessage: 'Capture cancelled.',
      retryable: false
    });
  }
  const asset = (result.assets && result.assets[0]) as ImagePicker.ImagePickerAsset | undefined;
  if (!asset?.uri) {
    throw new AppError({
      code: 'unknown',
      message: 'capture-missing-uri',
      safeMessage: 'Could not read the camera result.',
      retryable: true
    });
  }
  return asset;
}

async function readImageAsBase64(uri: string) {
  try {
    const file = new File(uri);
    const base64 = await Promise.resolve(file.base64());
    if (base64) {
      return base64;
    }
  } catch (error) {
    console.warn('camera-capture: falling back to legacy read', error);
  }
  return LegacyFileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

export async function captureListFromCamera(options: { timeoutMs?: number } = {}): Promise<CameraListCaptureResult> {
  const asset = await capturePhoto();
  const base64 = await readImageAsBase64(asset.uri);
  const metadata = asset as { type?: string; width?: number; height?: number };
  const supabase = ensureSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.functions.invoke('list-ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        image: base64,
        encoding: 'base64',
        format: metadata.type ?? Platform.select({ ios: 'jpeg', android: 'jpeg', default: 'jpeg' }),
        width: metadata.width ?? null,
        height: metadata.height ?? null
      }
    }),
    options.timeoutMs ?? 20000,
    'list-ocr'
  );

  if (error) {
    throw new AppError({
      code: 'unknown',
      message: error.message ?? 'list-ocr-failed',
      retryable: true,
      context: { status: error.status }
    });
  }

  const result = (data as Partial<CameraListCaptureResult> | null) ?? null;
  if (!result || !Array.isArray(result.items) || !result.items.length) {
    throw new AppError({
      code: 'unknown',
      message: 'list-ocr-empty',
      safeMessage: 'We could not detect any items in the photo.',
      retryable: true
    });
  }

  return {
    items: result.items.map((item) => ({
      label: item?.label ?? '',
      quantity: Math.max(1, Math.round(item?.quantity ?? 1)),
      unit: item?.unit ?? null,
      category: item?.category ?? null,
      categoryLabel: item?.categoryLabel ?? null,
      confidence: item?.confidence ?? 0.5
    })),
    rawText: result.rawText ?? result.items.map((item) => item?.label ?? '').join('\n'),
    confidence: result.confidence ?? 0.5,
    warnings: result.warnings ?? [],
    imageUri: asset.uri
  };
}

export async function capturePromoFromCamera(options: { timeoutMs?: number } = {}): Promise<PromoCaptureResult> {
  const asset = await capturePhoto();
  const base64 = await readImageAsBase64(asset.uri);
  const metadata = asset as { type?: string; width?: number; height?: number };

  const supabase = ensureSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.functions.invoke('promo-ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        image: base64,
        encoding: 'base64',
        format: metadata.type ?? Platform.select({ ios: 'jpeg', android: 'jpeg', default: 'jpeg' }),
        width: metadata.width ?? null,
        height: metadata.height ?? null
      }
    }),
    options.timeoutMs ?? 20000,
    'promo-ocr'
  );

  if (error) {
    throw new AppError({
      code: 'unknown',
      message: error.message ?? 'promo-ocr-failed',
      retryable: true,
      context: { status: error.status }
    });
  }

  const payload = (data as Partial<PromoCaptureResult> | null) ?? null;
  if (!payload || !payload.title) {
    throw new AppError({
      code: 'unknown',
      message: 'promo-ocr-empty',
      safeMessage: 'We could not understand the flyer. Try another photo.',
      retryable: true
    });
  }

  return {
    title: payload.title,
    description: payload.description ?? undefined,
    price: payload.price ?? undefined,
    store: payload.store ?? null,
    validFrom: payload.validFrom ?? null,
    validTo: payload.validTo ?? null,
    tags: payload.tags ?? [],
    confidence: payload.confidence ?? 0.5,
    rawText: payload.rawText ?? undefined,
    imageUri: asset.uri
  };
}
