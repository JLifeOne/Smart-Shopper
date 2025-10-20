import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useAuth } from '@/src/context/auth-context';

const COUNTRIES = [
  { code: 'US', dialCode: '+1', label: 'United States' },
  { code: 'CA', dialCode: '+1', label: 'Canada' },
  { code: 'JM', dialCode: '+1-876', label: 'Jamaica' },
  { code: 'GB', dialCode: '+44', label: 'United Kingdom' },
  { code: 'TT', dialCode: '+1-868', label: 'Trinidad & Tobago' }
] as const;

type CountryOption = (typeof COUNTRIES)[number];

type StepKey = 1 | 2 | 3 | 4;

export default function SignUpScreen() {
  const router = useRouter();
  const {
    requestPhoneOtp,
    verifyPhoneOtp,
    updateProfile,
    isAuthenticating,
    lastError
  } = useAuth();

  const [step, setStep] = useState<StepKey>(1);
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const progress = useMemo(() => step / 4, [step]);

  const handleFormatPhone = useCallback((value: string) => {
    const sanitized = value.replace(/[^\d+()\-\s]/g, '');
    setPhoneInput(sanitized);
  }, []);

  const handleSendCode = useCallback(async () => {
    try {
      const parsed = parsePhoneNumberFromString(phoneInput, country.code);
      if (!parsed || !parsed.isValid()) {
        Alert.alert('Check phone number', 'Enter a valid phone number for your selected country.');
        return;
      }
      const e164 = parsed.number;
      const result = await requestPhoneOtp({ phone: e164 });
      if (!result.success) {
        Alert.alert('Unable to send code', result.errorMessage ?? 'Try again in a moment.');
        return;
      }
      setNormalizedPhone(e164);
      setStatusMessage('Code sent! It may take a few seconds to arrive.');
      setStep(2);
    } catch (error) {
      Alert.alert('Phone number error', (error as Error).message);
    }
  }, [country.code, phoneInput, requestPhoneOtp]);

  const handleContinueRegion = useCallback(() => {
    if (!region.trim()) {
      Alert.alert('Add your location', 'We use your region to tailor store suggestions.');
      return;
    }
    setStep(3);
  }, [region]);

  const handlePickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1]
    });
    if (!result.canceled && result.assets?.length) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  const handleContinueProfile = useCallback(() => {
    if (!displayName.trim()) {
      Alert.alert('Add your name', 'Let friends recognise you when you share lists.');
      return;
    }
    setStep(4);
  }, [displayName]);

  const handleVerifyOtp = useCallback(async () => {
    if (!normalizedPhone) {
      Alert.alert('Start from the beginning', 'Enter your phone number to receive a code.');
      setStep(1);
      return;
    }
    if (otp.length < 4) {
      Alert.alert('Enter code', 'Type the verification code sent to your phone.');
      return;
    }
    const result = await verifyPhoneOtp({ phone: normalizedPhone, token: otp });
    if (!result.success) {
      Alert.alert('Verification failed', result.errorMessage ?? 'Check the code and try again.');
      return;
    }
    const profileResult = await updateProfile({ displayName: displayName.trim(), locale: region.trim() });
    if (!profileResult.success) {
      Alert.alert('Profile update warning', profileResult.errorMessage ?? 'Profile details were not saved.');
    }
    Alert.alert('Welcome to Smart Shopper!', 'You are all set to build smarter lists.', [
      {
        text: 'Continue',
        onPress: () => router.replace('/(app)/home')
      }
    ]);
  }, [displayName, normalizedPhone, otp, region, router, updateProfile, verifyPhoneOtp]);

  const handleResend = useCallback(async () => {
    if (!normalizedPhone) {
      return;
    }
    const result = await requestPhoneOtp({ phone: normalizedPhone });
    if (!result.success) {
      Alert.alert('Unable to resend', result.errorMessage ?? 'Try again later.');
      return;
    }
    setStatusMessage('Code resent. Watch for a new SMS shortly.');
  }, [normalizedPhone, requestPhoneOtp]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Text style={styles.progressLabel}>Step {step} of 4</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(5, progress * 100)}%` }]} />
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Enter your phone number</Text>
            <Text style={styles.subheading}>We will text a confirmation code to this number.</Text>
            <Pressable
              style={({ pressed }) => [styles.countryPickerTrigger, pressed && styles.countryPickerTriggerPressed]}
              onPress={() => setCountryPickerVisible(true)}
            >
              <Text style={styles.countryPickerLabel}>{country.label} ({country.dialCode})</Text>
            </Pressable>
            <TextInput
              value={phoneInput}
              onChangeText={handleFormatPhone}
              keyboardType="phone-pad"
              placeholder="(555) 123-4567"
              placeholderTextColor="#9CA8BC"
              style={styles.input}
              textContentType="telephoneNumber"
            />
            <Pressable
              onPress={handleSendCode}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? <ActivityIndicator color="#0C1D37" /> : <Text style={styles.primaryButtonLabel}>Send code</Text>}
            </Pressable>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Where do you shop?</Text>
            <Text style={styles.subheading}>Add your city or parish to get relevant stores and flyers.</Text>
            <TextInput
              value={region}
              onChangeText={setRegion}
              placeholder="e.g. Kingston, Jamaica"
              placeholderTextColor="#9CA8BC"
              style={styles.input}
            />
            <Pressable
              onPress={handleContinueRegion}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.primaryButtonLabel}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Set up your profile</Text>
            <Text style={styles.subheading}>Friends will see this when you share lists.</Text>
            <Pressable style={styles.avatarPicker} onPress={handlePickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholder}>Add photo</Text>
              )}
            </Pressable>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor="#9CA8BC"
              style={styles.input}
            />
            <Pressable
              onPress={handleContinueProfile}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.primaryButtonLabel}>Review code</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Enter your verification code</Text>
            <Text style={styles.subheading}>The SMS code is usually 4–6 digits.</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor="#9CA8BC"
              style={styles.input}
              maxLength={6}
            />
            <Pressable
              onPress={handleVerifyOtp}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? <ActivityIndicator color="#0C1D37" /> : <Text style={styles.primaryButtonLabel}>Confirm</Text>}
            </Pressable>
            <Pressable onPress={handleResend} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
              <Text style={styles.secondaryButtonLabel}>Resend code</Text>
            </Pressable>
          </View>
        ) : null}

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        {lastError ? <Text style={styles.statusMessageError}>{lastError}</Text> : null}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Prefer email?</Text>
          <Link href="/auth/sign-in" style={styles.link}>
            Sign in instead
          </Link>
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={countryPickerVisible} onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={styles.countryModalOverlay}>
          <View style={styles.countryModal}>
            <Text style={styles.countryModalHeading}>Select country</Text>
            <ScrollView>
              {COUNTRIES.map((option) => (
                <Pressable
                  key={option.code}
                  style={({ pressed }) => [styles.countryOption, pressed && styles.countryOptionPressed]}
                  onPress={() => {
                    setCountry(option);
                    setCountryPickerVisible(false);
                  }}
                >
                  <Text style={styles.countryOptionLabel}>{option.label}</Text>
                  <Text style={styles.countryOptionDial}>{option.dialCode}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1D37'
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
    gap: 24
  },
  topBar: {
    gap: 12
  },
  progressLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600'
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4FD1C5'
  },
  section: {
    backgroundColor: '#152544',
    borderRadius: 24,
    padding: 24,
    gap: 16
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  subheading: {
    color: '#A3B5D3',
    fontSize: 14,
    lineHeight: 20
  },
  input: {
    backgroundColor: '#0F1B36',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFFFFF',
    fontSize: 16
  },
  countryPickerTrigger: {
    backgroundColor: '#0F1B36',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  countryPickerTriggerPressed: {
    opacity: 0.8
  },
  countryPickerLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16
  },
  primaryButton: {
    backgroundColor: '#4FD1C5',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center'
  },
  primaryButtonPressed: {
    opacity: 0.85
  },
  primaryButtonLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10
  },
  secondaryButtonPressed: {
    opacity: 0.8
  },
  secondaryButtonLabel: {
    color: '#4FD1C5',
    fontWeight: '600'
  },
  avatarPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0F1B36',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  avatarPlaceholder: {
    color: '#4FD1C5',
    fontWeight: '600'
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60
  },
  statusMessage: {
    textAlign: 'center',
    color: '#4FD1C5'
  },
  statusMessageError: {
    textAlign: 'center',
    color: '#F56565'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24
  },
  footerText: {
    color: '#9CA8BC'
  },
  link: {
    color: '#4FD1C5',
    fontWeight: '600'
  },
  countryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,29,55,0.6)',
    justifyContent: 'center',
    padding: 24
  },
  countryModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    maxHeight: 420
  },
  countryModalHeading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#0C1D37'
  },
  countryOption: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0'
  },
  countryOptionPressed: {
    backgroundColor: '#F1F5F9'
  },
  countryOptionLabel: {
    fontSize: 16,
    color: '#0C1D37'
  },
  countryOptionDial: {
    fontSize: 13,
    color: '#4A576D'
  }
});
