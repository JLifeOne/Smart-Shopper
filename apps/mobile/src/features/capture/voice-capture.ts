import { Platform } from 'react-native';
import * as Audio from 'expo-audio';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { withTimeout } from '@/src/lib/retry';
import { ensureSupabaseClient } from '@/src/lib/supabase';
import { AppError } from '@/src/lib/errors';

export type VoiceCaptureResult = {
  transcript: string;
  confidence: number;
  locale?: string | null;
};

export type VoiceCaptureOptions = {
  locale?: string;
  timeoutMs?: number;
};

async function ensurePermissions() {
  const audio: any = Audio;
  const permission = (audio.requestPermissionsAsync
    ? await audio.requestPermissionsAsync()
    : { granted: true }) as { granted: boolean };
  if (!permission?.granted) {
    throw new AppError({
      code: 'input/validation',
      message: 'microphone-permission-denied',
      safeMessage: 'Microphone access is required to capture voice.',
      retryable: false
    });
  }
}

async function configureAudioMode() {
  const audio: any = Audio;
  if (audio.setAudioModeAsync) {
    await audio.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    } as any);
  }
}

type Recording = any;

export async function startVoiceCapture(): Promise<Recording> {
  await ensurePermissions();
  await configureAudioMode();
  const audio: any = Audio;
  const recording = new (audio.Recording ?? (audio.createRecording ?? Function))();
  const presets = (audio.RecordingOptionsPresets ?? audio.RecordingPresets ?? {}).HIGH_QUALITY;
  const fallbackOptions = {
    android: {
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000
    },
    ios: {
      extension: '.m4a',
      outputFormat: (audio.IOSOutputFormat ?? audio.OutputFormat)?.MPEG4AAC ?? undefined,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      audioQuality: (audio.IOSAudioQuality ?? audio.AudioQuality)?.HIGH ?? undefined
    },
    web: undefined
  };
  if (recording.prepareToRecordAsync) {
    await recording.prepareToRecordAsync(presets ?? fallbackOptions);
    await recording.startAsync();
  }
  return recording;
}

export async function cancelVoiceCapture(recording: Recording | null) {
  if (!recording) {
    return;
  }
  try {
    if (recording.getStatusAsync) {
      const status = await recording.getStatusAsync();
      if (status?.isRecording) {
        await recording.stopAndUnloadAsync();
      }
    }
  } catch (err) {
    console.warn('voice-capture: failed to stop recording', err);
  }
}

export async function finalizeVoiceCapture(
  recording: Recording,
  options: VoiceCaptureOptions = {}
): Promise<VoiceCaptureResult> {
  try {
    const status = await recording.getStatusAsync();
    if (status?.isRecording) {
      await recording.stopAndUnloadAsync();
    }
  } catch (err) {
    console.warn('voice-capture: stop failed', err);
  }
  const uri = recording.getURI();
  if (!uri) {
    throw new AppError({
      code: 'unknown',
      message: 'voice-recording-missing-uri',
      safeMessage: 'Could not access the recorded audio.',
      retryable: false
    });
  }

  try {
    let base64: string | null = null;
    try {
      const file = new File(uri);
      base64 = await Promise.resolve(file.base64());
    } catch (error) {
      console.warn('voice-capture: falling back to legacy read', error);
      base64 = await LegacyFileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    }
    if (!base64) {
      throw new AppError({
        code: 'unknown',
        message: 'voice-recording-empty',
        safeMessage: 'Could not access the recorded audio.',
        retryable: false
      });
    }
    const supabase = ensureSupabaseClient();
    const payload = {
      audio: base64,
      encoding: 'base64',
      format: Platform.select({ ios: 'm4a', android: 'm4a', default: 'm4a' }),
      locale: options.locale ?? null
    };
    const { data, error } = await withTimeout(
      supabase.functions.invoke('voice-transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      }),
      options.timeoutMs ?? 20000,
      'voice-transcribe'
    );
    if (error) {
      throw new AppError({
        code: 'unknown',
        message: error.message ?? 'voice-transcribe-failed',
        retryable: true,
        context: { status: error.status }
      });
    }
    const result = (data as VoiceCaptureResult | null) ?? null;
    if (!result || !result.transcript?.trim()) {
      throw new AppError({
        code: 'unknown',
        message: 'voice-transcribe-empty',
        safeMessage: 'We could not understand the audio. Try again.',
        retryable: true
      });
    }
    return {
      transcript: result.transcript.trim(),
      confidence: result.confidence ?? 0.5,
      locale: result.locale ?? options.locale ?? null
    };
  } finally {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      LegacyFileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }
}
