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
  Text,
  TextInput,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth-context';
import { useTopBar } from '@/src/providers/TopBarProvider';
import { formatDobInput, parseDob } from '@/src/lib/dob';

const COUNTRIES = [
  { code: 'US', dialCode: '+1', label: 'United States' },
  { code: 'CA', dialCode: '+1', label: 'Canada' },
  { code: 'JM', dialCode: '+1-876', label: 'Jamaica' },
  { code: 'GB', dialCode: '+44', label: 'United Kingdom' },
  { code: 'TT', dialCode: '+1-868', label: 'Trinidad & Tobago' }
] as const;

type CountryOption = (typeof COUNTRIES)[number];
type GenderOption = 'male' | 'female' | 'prefer_not_to_say';

type ProfileRow = {
  email?: string | null;
  display_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  location_city?: string | null;
  location_county?: string | null;
  location_region?: string | null;
  location_postal_code?: string | null;
  location_country?: string | null;
};

function isProfileComplete(profile: ProfileRow | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.display_name?.trim() &&
      profile.date_of_birth &&
      profile.location_city?.trim() &&
      profile.location_county?.trim() &&
      profile.location_country?.trim()
  );
}

export default function CompleteProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ country?: string; force?: string }>();
  const force = params.force === '1';
  const defaultCountry = useMemo(() => {
    const raw = params.country?.toUpperCase();
    const match = COUNTRIES.find((candidate) => candidate.code === raw);
    return match ?? COUNTRIES[2];
  }, [params.country]);

  const { clearSignupProfileSetup, client, user, isAuthenticating, updateProfile, updateAccountEmail } = useAuth();

  useTopBar(
    useMemo(
      () => ({
        title: 'Smart Shopper',
        logoGlyph: 'SS',
        showSearch: false,
        onMenuPress: null,
        leftAction: null
      }),
      []
    )
  );

  const [loading, setLoading] = useState(true);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<GenderOption>('prefer_not_to_say');
  const [email, setEmail] = useState('');

  const [locationCountry, setLocationCountry] = useState<CountryOption>(defaultCountry);
  const [locationCity, setLocationCity] = useState('');
  const [locationCounty, setLocationCounty] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [locationPostalCode, setLocationPostalCode] = useState('');

  const dobMeta = useMemo(() => (dob ? parseDob(dob) : null), [dob]);

  const loadProfile = useCallback(async () => {
    if (!client || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) {
      setLoading(false);
      Alert.alert('Unable to load profile', error.message);
      return;
    }

    if (!data) {
      setLoading(false);
      return;
    }

    const profile = data as ProfileRow;
    setDisplayName(profile.display_name ?? '');
    setDob(profile.date_of_birth ?? '');

    const genderValue = profile.gender as GenderOption | null | undefined;
    if (genderValue && ['male', 'female', 'prefer_not_to_say'].includes(genderValue)) {
      setGender(genderValue);
    }

    setEmail(profile.email ?? user.email ?? '');

    const countryCode = profile.location_country?.toUpperCase() ?? defaultCountry.code;
    const foundCountry = COUNTRIES.find((candidate) => candidate.code === countryCode);
    setLocationCountry(foundCountry ?? defaultCountry);

    setLocationCity(profile.location_city ?? '');
    setLocationCounty(profile.location_county ?? '');
    setLocationRegion(profile.location_region ?? '');
    setLocationPostalCode(profile.location_postal_code ?? '');
    setLoading(false);

    if (!force && isProfileComplete(profile)) {
      router.replace('/(app)/home');
    }
  }, [client, defaultCountry, force, router, user?.email, user?.id]);

  useEffect(() => {
    clearSignupProfileSetup();
  }, [clearSignupProfileSetup]);

  useEffect(() => {
    loadProfile().catch((error) => {
      setLoading(false);
      Alert.alert('Profile setup failed', (error as Error).message);
    });
  }, [loadProfile]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Sign in first', 'Your session is not ready yet.');
      return;
    }

    const name = displayName.trim();
    if (!name) {
      Alert.alert('Add your name', 'Enter your name to continue.');
      return;
    }

    const dobParsed = parseDob(dob);
    if (!dobParsed) {
      Alert.alert('Check your date of birth', 'Use the format YYYY-MM-DD.');
      return;
    }

    const city = locationCity.trim();
    if (!city) {
      Alert.alert('Add your town/city', 'Enter your city/town (e.g., Ocho Rios).');
      return;
    }

    const county = locationCounty.trim();
    if (!county) {
      Alert.alert('Add your parish/county', 'Enter your parish/county (e.g., St. Ann).');
      return;
    }

    const contactEmail = email.trim().toLowerCase();
    if (contactEmail) {
      const emailResult = await updateAccountEmail(contactEmail);
      if (!emailResult.success) {
        Alert.alert(
          'Email update failed',
          emailResult.errorMessage ?? 'Try a different email or leave it blank to continue.'
        );
        return;
      }
    }

    const result = await updateProfile({
      displayName: name,
      contactEmail: contactEmail || null,
      dateOfBirth: dobParsed.normalized,
      gender,
      locationCountry: locationCountry.code,
      locationCity: city,
      locationCounty: county,
      locationRegion: locationRegion.trim() || null,
      locationPostalCode: locationPostalCode.trim() || null
    });

    if (!result.success) {
      Alert.alert('Unable to save profile', result.errorMessage ?? 'Try again in a moment.');
      return;
    }

    router.replace('/(app)/home');
  }, [
    displayName,
    dob,
    email,
    gender,
    locationCity,
    locationCountry.code,
    locationCounty,
    locationPostalCode,
    locationRegion,
    router,
    updateAccountEmail,
    updateProfile,
    user?.id
  ]);

  const isBusy = loading || isAuthenticating;

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Finish setup</Text>
          <Text style={styles.headerSubtitle}>Tell us a bit about you so Smart Shopper can personalize your experience.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basics</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="First and last name"
            placeholderTextColor="#9CA8BC"
            style={styles.input}
            editable={!isBusy}
          />

          <Text style={styles.label}>Date of birth</Text>
          <TextInput
            value={dob}
            onChangeText={(next) => setDob(formatDobInput(next))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9CA8BC"
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            textContentType="birthdate"
            autoCorrect={false}
            maxLength={10}
            style={styles.input}
            editable={!isBusy}
          />
          {dobMeta ? <Text style={styles.helper}>Age: {dobMeta.age}</Text> : <Text style={styles.helper}>Example: 1998-04-12</Text>}

          <Text style={styles.label}>Gender (optional)</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setGenderPickerVisible(true)}
            disabled={isBusy}
            style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerButtonPressed]}
          >
            <Text style={styles.pickerButtonLabel}>
              {gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Prefer not to say'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#0C1D37" />
          </Pressable>

          <Text style={styles.label}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com (optional)"
            placeholderTextColor="#9CA8BC"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            editable={!isBusy}
          />
          <Text style={styles.helper}>If you add an email, we will send a confirmation link.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location</Text>

          <Text style={styles.label}>Country</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCountryPickerVisible(true)}
            disabled={isBusy}
            style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerButtonPressed]}
          >
            <Text style={styles.pickerButtonLabel}>{locationCountry.label}</Text>
            <Ionicons name="chevron-down" size={18} color="#0C1D37" />
          </Pressable>

          <Text style={styles.label}>City / town</Text>
          <TextInput
            value={locationCity}
            onChangeText={setLocationCity}
            placeholder="Ocho Rios"
            placeholderTextColor="#9CA8BC"
            style={styles.input}
            editable={!isBusy}
          />

          <Text style={styles.label}>County / parish</Text>
          <TextInput
            value={locationCounty}
            onChangeText={setLocationCounty}
            placeholder="St. Ann"
            placeholderTextColor="#9CA8BC"
            style={styles.input}
            editable={!isBusy}
          />

          <Text style={styles.label}>Province / state (optional)</Text>
          <TextInput
            value={locationRegion}
            onChangeText={setLocationRegion}
            placeholder="Province / State"
            placeholderTextColor="#9CA8BC"
            style={styles.input}
            editable={!isBusy}
          />

          <Text style={styles.label}>Postal / ZIP code (optional)</Text>
          <TextInput
            value={locationPostalCode}
            onChangeText={setLocationPostalCode}
            placeholder="Relative zip code"
            placeholderTextColor="#9CA8BC"
            style={styles.input}
            editable={!isBusy}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          disabled={isBusy}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          {isBusy ? <ActivityIndicator color="#0C1D37" /> : <Text style={styles.primaryButtonLabel}>Continue</Text>}
        </Pressable>
      </ScrollView>

      <Modal transparent animationType="fade" visible={countryPickerVisible} onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select country</Text>
            <ScrollView>
              {COUNTRIES.map((candidate) => (
                <Pressable
                  key={candidate.code}
                  accessibilityRole="button"
                  onPress={() => {
                    setLocationCountry(candidate);
                    setCountryPickerVisible(false);
                  }}
                  style={({ pressed }) => [styles.modalOption, pressed && styles.modalOptionPressed]}
                >
                  <Text style={styles.modalOptionLabel}>{candidate.label}</Text>
                  <Text style={styles.modalOptionMeta}>{candidate.dialCode}</Text>
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
                {gender === option.value ? <Ionicons name="checkmark" size={18} color="#0C1D37" /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40
  },
  headerRow: {
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0C1D37'
  },
  headerSubtitle: {
    marginTop: 6,
    color: '#4A576D',
    fontSize: 13,
    lineHeight: 18
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1D37',
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A576D',
    marginBottom: 6
  },
  helper: {
    fontSize: 12,
    color: '#6C7A91',
    marginTop: -6,
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0C1D37',
    marginBottom: 12
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#0C1D37',
    fontWeight: '600'
  },
  primaryButton: {
    backgroundColor: '#4FD1C5',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14
  },
  primaryButtonPressed: {
    opacity: 0.9
  },
  primaryButtonLabel: {
    color: '#0C1D37',
    fontSize: 15,
    fontWeight: '800'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C1D37',
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
    color: '#0C1D37',
    fontWeight: '600'
  },
  modalOptionMeta: {
    fontSize: 12,
    color: '#6C7A91',
    fontWeight: '600'
  }
});
