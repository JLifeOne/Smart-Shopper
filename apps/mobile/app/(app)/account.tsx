import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';
import { featureFlags } from '@/src/lib/env';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences
} from '@/src/features/notifications/api';
import { registerForPromoNotifications } from '@/src/features/notifications/push';
import { useTopBar } from '@/src/providers/TopBarProvider';
import { formatDobInput, parseDob } from '@/src/lib/dob';

type ProfileRow = {
  email: string | null;
  display_name: string | null;
  locale: string | null;
  currency: string | null;
  include_tax: boolean | null;
  date_of_birth: string | null;
  gender: string | null;
  location_city: string | null;
  location_county: string | null;
  location_region: string | null;
  location_postal_code: string | null;
  location_country: string | null;
};

const palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0C1D37',
  subtext: '#4A576D',
  muted: '#6C7A91',
  primary: '#4FD1C5',
  danger: '#DC2626'
};

const SUPPORTED_CURRENCIES = ['JMD', 'USD', 'CAD', 'GBP'] as const;
const COUNTRIES = [
  { code: 'US', dialCode: '+1', label: 'United States' },
  { code: 'CA', dialCode: '+1', label: 'Canada' },
  { code: 'JM', dialCode: '+1-876', label: 'Jamaica' },
  { code: 'GB', dialCode: '+44', label: 'United Kingdom' },
  { code: 'TT', dialCode: '+1-868', label: 'Trinidad & Tobago' }
] as const;

type CountryOption = (typeof COUNTRIES)[number];
type GenderOption = 'male' | 'female' | 'prefer_not_to_say';

export default function AccountScreen() {
  const router = useRouter();
  const { client, user, isAuthenticating, updateProfile, updateAccountEmail, updateAccountPassword, signOut } =
    useAuth();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [locale, setLocale] = useState('en-JM');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<GenderOption>('prefer_not_to_say');
  const [locationCountry, setLocationCountry] = useState<CountryOption>(COUNTRIES[2]);
  const [locationCity, setLocationCity] = useState('');
  const [locationCounty, setLocationCounty] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [locationPostalCode, setLocationPostalCode] = useState('');
  const [currency, setCurrency] = useState<(typeof SUPPORTED_CURRENCIES)[number]>('JMD');
  const [includeTax, setIncludeTax] = useState(true);

  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [promosEnabled, setPromosEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  const primaryEmail = useMemo(() => {
    const nextEmail = (user as unknown as { new_email?: string | null })?.new_email;
    return nextEmail ?? user?.email ?? null;
  }, [user]);

  const phoneLabel = useMemo(() => user?.phone ?? 'Not available', [user?.phone]);
  const dobMeta = useMemo(() => parseDob(dob), [dob]);

  const topBarGlyph = useMemo(() => {
    const nameBasis = displayName.trim();
    if (nameBasis) {
      const initials = nameBasis
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);
      if (initials) {
        return initials;
      }
    }

    const emailBasis = (primaryEmail ?? '').trim();
    if (emailBasis) {
      return (
        emailBasis
          .split('@')[0]
          .split('.')
          .map((part) => part.charAt(0).toUpperCase())
          .join('')
          .slice(0, 2) || 'SS'
      );
    }

    const phoneBasis = (user?.phone ?? '').replace(/[^\d]/g, '');
    if (phoneBasis) {
      return phoneBasis.slice(-2);
    }
    return 'SS';
  }, [displayName, primaryEmail, user?.phone]);

  useTopBar(
    useMemo(
      () => ({
        title: 'Account',
        logoGlyph: topBarGlyph,
        showSearch: false,
        leftAction: {
          icon: 'chevron-back',
          onPress: () => router.back(),
          accessibilityLabel: 'Go back'
        }
      }),
      [router, topBarGlyph]
    )
  );

  const loadProfile = useCallback(async () => {
    if (!client || !user?.id) {
      setProfileError('Supabase session not ready.');
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setProfileError(error.message);
      setLoadingProfile(false);
      return;
    }

    if (!data) {
      const createResult = await updateProfile({});
      if (!createResult.success) {
        setProfileError(createResult.errorMessage ?? 'Unable to create profile.');
        setLoadingProfile(false);
        return;
      }
      const retry = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (retry.error) {
        setProfileError(retry.error.message);
        setLoadingProfile(false);
        return;
      }
      setProfile((retry.data as ProfileRow | null) ?? null);
      setLoadingProfile(false);
      return;
    }

    setProfile(data as ProfileRow);
    setLoadingProfile(false);
  }, [client, updateProfile, user?.id]);

  useEffect(() => {
    loadProfile().catch((error) => {
      setProfileError((error as Error).message);
      setLoadingProfile(false);
    });
  }, [loadProfile]);

  useEffect(() => {
    if (!featureFlags.promoNotifications || !user?.id) {
      return;
    }
    setNotificationsLoading(true);
    fetchNotificationPreferences()
      .then((prefs) => {
        setPromosEnabled(Boolean(prefs.promos_enabled));
        setPushEnabled(Boolean(prefs.push_enabled));
        setNotificationsError(null);
      })
      .catch((error) => {
        console.warn('Failed to load notification preferences', error);
        setNotificationsError('Unable to load promo alerts settings.');
      })
      .finally(() => {
        setNotificationsLoading(false);
      });
  }, [featureFlags.promoNotifications, user?.id]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setDisplayName(profile.display_name ?? '');
    setLocale(profile.locale ?? 'en-JM');
    const nextCurrency = profile.currency?.toUpperCase();
    if (nextCurrency && (SUPPORTED_CURRENCIES as readonly string[]).includes(nextCurrency)) {
      setCurrency(nextCurrency as (typeof SUPPORTED_CURRENCIES)[number]);
    }
    setIncludeTax(profile.include_tax ?? true);

    setDob(profile.date_of_birth ?? '');
    const nextGender = profile.gender as GenderOption | null;
    if (nextGender && ['male', 'female', 'prefer_not_to_say'].includes(nextGender)) {
      setGender(nextGender);
    }

    const nextCountryCode = profile.location_country?.toUpperCase();
    const resolvedCountry = COUNTRIES.find((candidate) => candidate.code === nextCountryCode) ?? COUNTRIES[2];
    setLocationCountry(resolvedCountry);
    setLocationCity(profile.location_city ?? '');
    setLocationCounty(profile.location_county ?? '');
    setLocationRegion(profile.location_region ?? '');
    setLocationPostalCode(profile.location_postal_code ?? '');
  }, [profile]);

  useEffect(() => {
    setEmailDraft(primaryEmail ?? profile?.email ?? '');
  }, [primaryEmail, profile?.email]);

  const handleSaveProfile = useCallback(async () => {
    const dobParsed = dob ? parseDob(dob) : null;
    if (dob && !dobParsed) {
      Alert.alert('Check your date of birth', 'Use the format YYYY-MM-DD.');
      return;
    }

    const result = await updateProfile({
      displayName: displayName.trim() || undefined,
      locale: locale.trim() || undefined,
      currency,
      includeTax,
      dateOfBirth: dobParsed ? dobParsed.normalized : null,
      gender,
      locationCountry: locationCountry.code,
      locationCity: locationCity.trim() || null,
      locationCounty: locationCounty.trim() || null,
      locationRegion: locationRegion.trim() || null,
      locationPostalCode: locationPostalCode.trim() || null
    });

    if (!result.success) {
      Alert.alert('Unable to save', result.errorMessage ?? 'Try again in a moment.');
      return;
    }

    await loadProfile();
    Alert.alert('Saved', 'Your profile has been updated.');
  }, [
    currency,
    displayName,
    dob,
    gender,
    includeTax,
    loadProfile,
    locale,
    locationCity,
    locationCountry.code,
    locationCounty,
    locationPostalCode,
    locationRegion,
    updateProfile
  ]);

  const handleTogglePromos = useCallback(async (next: boolean) => {
    setPromosEnabled(next);
    try {
      await updateNotificationPreferences({ promos_enabled: next });
    } catch (error) {
      setPromosEnabled(!next);
      Alert.alert('Update failed', 'Unable to update promo alerts right now.');
    }
  }, []);

  const handleTogglePush = useCallback(async (next: boolean) => {
    setPushEnabled(next);
    try {
      await updateNotificationPreferences({ push_enabled: next });
      if (next) {
        await registerForPromoNotifications(user?.id);
      }
    } catch (error) {
      setPushEnabled(!next);
      Alert.alert('Update failed', 'Unable to update push alerts right now.');
    }
  }, []);

  const handleUpdateEmail = useCallback(async () => {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!nextEmail) {
      Alert.alert('Add an email', 'Enter an email address to continue.');
      return;
    }
    const result = await updateAccountEmail(nextEmail);
    if (!result.success) {
      Alert.alert('Email update failed', result.errorMessage ?? 'Try again in a moment.');
      return;
    }
    await loadProfile();
    Alert.alert(
      'Email update requested',
      'Check your inbox to confirm this email. You can keep using your phone number while it verifies.'
    );
  }, [emailDraft, loadProfile, updateAccountEmail]);

  const handleUpdatePassword = useCallback(async () => {
    if (passwordDraft.length < 8) {
      Alert.alert('Choose a stronger password', 'Use at least 8 characters.');
      return;
    }
    if (passwordDraft !== passwordConfirm) {
      Alert.alert('Passwords do not match', 'Re-enter the same password in both fields.');
      return;
    }

    const result = await updateAccountPassword(passwordDraft);
    if (!result.success) {
      Alert.alert('Password update failed', result.errorMessage ?? 'Try again in a moment.');
      return;
    }

    setPasswordDraft('');
    setPasswordConfirm('');
    Alert.alert('Password updated', 'You can now sign in with this password on devices that support it.');
  }, [passwordConfirm, passwordDraft, updateAccountPassword]);

  const handleSignOut = useCallback(async () => {
    const errorMessage = await signOut();
    if (errorMessage) {
      Alert.alert('Sign out failed', errorMessage);
      return;
    }
    router.replace('/auth/sign-in');
  }, [router, signOut]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identity</Text>
            <Text style={styles.fieldLabel}>Phone number</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValue}>{phoneLabel}</Text>
            </View>

            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="name@example.com"
              placeholderTextColor={palette.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              editable={!isAuthenticating}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleUpdateEmail}
              disabled={isAuthenticating}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              {isAuthenticating ? <ActivityIndicator color={palette.text} /> : <Text style={styles.secondaryButtonLabel}>Update email</Text>}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile</Text>
            {loadingProfile ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color={palette.primary} />
                <Text style={styles.inlineLoadingLabel}>Loading profile…</Text>
              </View>
            ) : null}
            {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Date of birth</Text>
            <TextInput
              value={dob}
              onChangeText={(next) => setDob(formatDobInput(next))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              textContentType="birthdate"
              autoCorrect={false}
              maxLength={10}
              style={styles.input}
            />
            <Text style={styles.helperText}>
              {dobMeta ? `Age: ${dobMeta.age}` : 'Example: 1998-04-12'}
            </Text>

            <Text style={styles.fieldLabel}>Gender (optional)</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setGenderPickerVisible(true)}
              disabled={isAuthenticating}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerButtonPressed]}
            >
              <Text style={styles.pickerButtonLabel}>
                {gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Prefer not to say'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={palette.text} />
            </Pressable>

            <Text style={styles.fieldLabel}>Country</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCountryPickerVisible(true)}
              disabled={isAuthenticating}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerButtonPressed]}
            >
              <Text style={styles.pickerButtonLabel}>{locationCountry.label}</Text>
              <Ionicons name="chevron-down" size={18} color={palette.text} />
            </Pressable>

            <Text style={styles.fieldLabel}>City / town</Text>
            <TextInput
              value={locationCity}
              onChangeText={setLocationCity}
              placeholder="Ocho Rios"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>County / parish</Text>
            <TextInput
              value={locationCounty}
              onChangeText={setLocationCounty}
              placeholder="St. Ann"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Province / state (optional)</Text>
            <TextInput
              value={locationRegion}
              onChangeText={setLocationRegion}
              placeholder="Province / State"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Postal / ZIP code (optional)</Text>
            <TextInput
              value={locationPostalCode}
              onChangeText={setLocationPostalCode}
              placeholder="Relative zip code"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Locale (optional)</Text>
            <TextInput
              value={locale}
              onChangeText={setLocale}
              placeholder="en-JM"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.currencyRow}>
              {SUPPORTED_CURRENCIES.map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  onPress={() => setCurrency(code)}
                  style={({ pressed }) => [
                    styles.currencyChip,
                    currency === code && styles.currencyChipSelected,
                    pressed && styles.currencyChipPressed
                  ]}
                >
                  <Text style={[styles.currencyChipLabel, currency === code && styles.currencyChipLabelSelected]}>
                    {code}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleMeta}>
                <Text style={styles.toggleTitle}>Include tax</Text>
                <Text style={styles.toggleSubtitle}>Use tax-inclusive totals when estimating spend.</Text>
              </View>
              <Switch value={includeTax} onValueChange={setIncludeTax} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={handleSaveProfile}
              disabled={loadingProfile || isAuthenticating}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              {loadingProfile || isAuthenticating ? (
                <ActivityIndicator color={palette.text} />
              ) : (
                <Text style={styles.primaryButtonLabel}>Save profile</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Security</Text>
            <Text style={styles.cardHint}>
              Optional: set a password so you can also sign in with email + password during development.
            </Text>
            <Text style={styles.fieldLabel}>New password</Text>
            <TextInput
              value={passwordDraft}
              onChangeText={setPasswordDraft}
              placeholder="At least 8 characters"
              placeholderTextColor={palette.muted}
              secureTextEntry
              style={styles.input}
              editable={!isAuthenticating}
            />
            <Text style={styles.fieldLabel}>Confirm password</Text>
            <TextInput
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder="Repeat password"
              placeholderTextColor={palette.muted}
              secureTextEntry
              style={styles.input}
              editable={!isAuthenticating}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleUpdatePassword}
              disabled={isAuthenticating}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              {isAuthenticating ? <ActivityIndicator color={palette.text} /> : <Text style={styles.secondaryButtonLabel}>Update password</Text>}
            </Pressable>
          </View>

          {featureFlags.promoNotifications ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Promo alerts</Text>
              <Text style={styles.cardHint}>
                Manage in-app promos and push alerts. You can keep the inbox on while muting push at any time.
              </Text>
              {notificationsError ? <Text style={styles.errorText}>{notificationsError}</Text> : null}
              <View style={styles.toggleRow}>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>In-app promos</Text>
                  <Text style={styles.toggleSubtitle}>Show promo alerts inside your Smart Shopper inbox.</Text>
                </View>
                <Switch
                  value={promosEnabled}
                  onValueChange={handleTogglePromos}
                  disabled={notificationsLoading}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>Push alerts</Text>
                  <Text style={styles.toggleSubtitle}>Send real-time promo alerts to this device.</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={handleTogglePush}
                  disabled={notificationsLoading}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(app)/notifications')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
              >
                <Text style={styles.secondaryButtonLabel}>View promo inbox</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            disabled={isAuthenticating}
            style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
          >
            <Text style={styles.dangerButtonLabel}>Switch phone number</Text>
          </Pressable>
      </ScrollView>

      <Modal transparent animationType="fade" visible={countryPickerVisible} onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select country</Text>
            <ScrollView>
              {COUNTRIES.map((option) => (
                <Pressable
                  key={option.code}
                  accessibilityRole="button"
                  onPress={() => {
                    setLocationCountry(option);
                    setCountryPickerVisible(false);
                  }}
                  style={({ pressed }) => [styles.modalOption, pressed && styles.modalOptionPressed]}
                >
                  <Text style={styles.modalOptionLabel}>{option.label}</Text>
                  <Text style={styles.modalOptionMeta}>{option.dialCode}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={genderPickerVisible} onRequestClose={() => setGenderPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gender</Text>
            {([
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' }
            ] as const).map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => {
                  setGender(option.value);
                  setGenderPickerVisible(false);
                }}
                style={({ pressed }) => [styles.modalOption, pressed && styles.modalOptionPressed]}
              >
                <Text style={styles.modalOptionLabel}>{option.label}</Text>
                {gender === option.value ? <Ionicons name="checkmark" size={18} color={palette.text} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 12
  },
  cardHint: {
    color: palette.subtext,
    fontSize: 13,
    marginBottom: 12
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    marginBottom: 12
  },
  fieldLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.text,
    marginBottom: 12
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pickerButtonPressed: {
    opacity: 0.9
  },
  pickerButtonLabel: {
    fontSize: 14,
    color: palette.text,
    fontWeight: '600'
  },
  readonlyField: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#F8FAFC'
  },
  readonlyValue: {
    fontSize: 14,
    color: palette.text
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  currencyChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC'
  },
  currencyChipSelected: {
    borderColor: palette.primary,
    backgroundColor: '#E6FFFA'
  },
  currencyChipPressed: {
    opacity: 0.85
  },
  currencyChipLabel: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 13
  },
  currencyChipLabelSelected: {
    color: palette.text
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16
  },
  toggleMeta: {
    flex: 1,
    paddingRight: 12
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text
  },
  toggleSubtitle: {
    fontSize: 12,
    color: palette.subtext,
    marginTop: 2
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12
  },
  primaryButtonPressed: {
    opacity: 0.9
  },
  primaryButtonLabel: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.border
  },
  secondaryButtonPressed: {
    opacity: 0.9
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 13
  },
  dangerButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2'
  },
  dangerButtonPressed: {
    opacity: 0.9
  },
  dangerButtonLabel: {
    color: palette.danger,
    fontWeight: '700',
    fontSize: 14
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  inlineLoadingLabel: {
    color: palette.subtext,
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  modalCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 10
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalOptionPressed: {
    backgroundColor: '#F1F5F9'
  },
  modalOptionLabel: {
    fontSize: 14,
    color: palette.text,
    fontWeight: '600'
  },
  modalOptionMeta: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600'
  }
});
