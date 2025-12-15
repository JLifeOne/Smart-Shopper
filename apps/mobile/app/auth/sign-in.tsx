import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Link, useNavigation } from 'expo-router';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useAuth } from '@/src/context/auth-context';
import { useTopBar } from '@/src/providers/TopBarProvider';

const COUNTRIES = [
  { code: 'US', dialCode: '+1', label: 'United States' },
  { code: 'CA', dialCode: '+1', label: 'Canada' },
  { code: 'JM', dialCode: '+1-876', label: 'Jamaica' },
  { code: 'GB', dialCode: '+44', label: 'United Kingdom' },
  { code: 'TT', dialCode: '+1-868', label: 'Trinidad & Tobago' }
] as const;

type CountryOption = (typeof COUNTRIES)[number];
type StepKey = 'phone' | 'otp';

export default function SignInScreen() {
  const navigation = useNavigation();
  const { requestPhoneOtp, verifyPhoneOtp, isAuthenticating, lastError } = useAuth();

  useTopBar(
    useMemo(
      () => ({
        title: 'Sign in',
        logoGlyph: 'SS',
        showSearch: false,
        onMenuPress: null,
        leftAction: null
      }),
      []
    )
  );

  const [step, setStep] = useState<StepKey>('phone');
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const stepIndex = useMemo(() => (step === 'phone' ? 0 : 1), [step]);
  const progress = useMemo(() => (stepIndex + 1) / 2, [stepIndex]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Verify phone' });
  }, [navigation]);

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
      setOtp('');
      setStatusMessage('Code sent! It may take a few seconds to arrive.');
      setStep('otp');
    } catch (error) {
      Alert.alert('Phone number error', (error as Error).message);
    }
  }, [country.code, phoneInput, requestPhoneOtp]);

  const handleVerifyOtp = useCallback(async () => {
    if (!normalizedPhone) {
      Alert.alert('Enter your phone number', 'Start again so we can send a code.');
      setStep('phone');
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
    setStatusMessage('Signed in! Finishing setup…');
  }, [normalizedPhone, otp, verifyPhoneOtp]);

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

  const handleEditNumber = useCallback(() => {
    setStep('phone');
    setStatusMessage(null);
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Text style={styles.progressLabel}>
            Step {stepIndex + 1} of 2
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(5, progress * 100)}%` }]} />
          </View>
        </View>

        {step === 'phone' ? (
          <View style={styles.section}>
          <Text style={styles.heading}>Verify your phone number</Text>
            <Text style={styles.subheading}>Enter your mobile number to receive a verification code.</Text>
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

        {step === 'otp' ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Enter your verification code</Text>
            <Text style={styles.subheading}>The SMS code is usually 4-6 digits.</Text>
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
              {isAuthenticating ? (
                <ActivityIndicator color="#0C1D37" />
              ) : (
                <Text style={styles.primaryButtonLabel}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleResend}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              <Text style={styles.secondaryButtonLabel}>Resend code</Text>
            </Pressable>
            <Pressable
              onPress={handleEditNumber}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              <Text style={styles.secondaryButtonLabel}>Edit phone number</Text>
            </Pressable>
          </View>
        ) : null}

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        {lastError ? <Text style={styles.statusMessageError}>{lastError}</Text> : null}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Need to register a different number?</Text>
          <Link href="/auth/sign-up" style={styles.link}>
            Create a new account
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
    paddingTop: 48,
    paddingBottom: 32
  },
  topBar: {
    marginBottom: 32,
    gap: 12
  },
  progressLabel: {
    color: '#4FD1C5',
    fontWeight: '600',
    letterSpacing: 0.5
  },
  progressTrack: {
    backgroundColor: 'rgba(79,209,197,0.2)',
    height: 6,
    borderRadius: 4
  },
  progressFill: {
    backgroundColor: '#4FD1C5',
    height: '100%',
    borderRadius: 4
  },
  section: {
    gap: 16,
    marginBottom: 32
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  subheading: {
    color: '#9CA8BC',
    fontSize: 15,
    lineHeight: 22
  },
  input: {
    backgroundColor: '#152544',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFFFFF',
    fontSize: 16
  },
  countryPickerTrigger: {
    backgroundColor: '#152544',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  countryPickerTriggerPressed: {
    opacity: 0.85
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
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10
  },
  secondaryButtonPressed: {
    opacity: 0.8
  },
  primaryButtonLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  secondaryButtonLabel: {
    color: '#4FD1C5',
    fontWeight: '600'
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
