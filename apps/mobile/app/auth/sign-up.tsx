import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUpWithPassword, isAuthenticating, lastError } = useAuth();
  const passwordRef = useRef<TextInput | null>(null);
  const confirmRef = useRef<TextInput | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = useCallback(async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Missing info', 'Fill in all fields to continue.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Make sure both passwords match.');
      return;
    }
    const result = await signUpWithPassword({ email, password });
    if (!result.success) {
      Alert.alert('Sign-up failed', result.errorMessage ?? 'Please try again.');
      return;
    }
    Alert.alert(
      'Check your email',
      'Confirm your email address to finish creating your Smart Shopper account.',
      [
        {
          text: 'Done',
          onPress: () => router.replace('/auth/sign-in')
        }
      ]
    );
  }, [confirmPassword, email, password, router, signUpWithPassword]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.form}>
        <Text style={styles.heading}>Create your account</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#9CA8BC"
          style={styles.input}
          textContentType="emailAddress"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9CA8BC"
            style={[styles.input, styles.passwordInput]}
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <Pressable
            onPress={() => setShowPassword((current) => !current)}
            style={({ pressed }) => [styles.togglePasswordButton, pressed && styles.togglePasswordButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'View password'}
          >
            <Text style={styles.togglePasswordLabel}>{showPassword ? 'Hide' : 'View'}</Text>
          </Pressable>
        </View>
        <View style={styles.passwordRow}>
          <TextInput
            ref={confirmRef}
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor="#9CA8BC"
            style={[styles.input, styles.passwordInput]}
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />
          <Pressable
            onPress={() => setShowConfirmPassword((current) => !current)}
            style={({ pressed }) => [styles.togglePasswordButton, pressed && styles.togglePasswordButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={showConfirmPassword ? 'Hide password' : 'View password'}
          >
            <Text style={styles.togglePasswordLabel}>{showConfirmPassword ? 'Hide' : 'View'}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={handleSignUp}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isAuthenticating ? styles.primaryButtonPressed : undefined,
            isAuthenticating ? styles.disabledButton : undefined
          ]}
          accessibilityRole="button"
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#0C1D37" />
          ) : (
            <Text style={styles.primaryButtonLabel}>Sign up</Text>
          )}
        </Pressable>
        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/auth/sign-in" style={styles.link}>
            Sign in
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1D37',
    justifyContent: 'center'
  },
  form: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12
  },
  input: {
    backgroundColor: '#152544',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16
  },
  passwordRow: {
    position: 'relative'
  },
  passwordInput: {
    paddingRight: 72
  },
  togglePasswordButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -18,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(79, 209, 197, 0.15)'
  },
  togglePasswordButtonPressed: {
    opacity: 0.8
  },
  togglePasswordLabel: {
    color: '#4FD1C5',
    fontWeight: '600'
  },
  primaryButton: {
    backgroundColor: '#4FD1C5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  },
  primaryButtonPressed: {
    opacity: 0.85
  },
  disabledButton: {
    opacity: 0.5
  },
  primaryButtonLabel: {
    color: '#0C1D37',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16
  },
  footerText: {
    color: '#9CA8BC',
    fontSize: 14
  },
  errorText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#F56565',
    fontSize: 14
  },
  link: {
    color: '#4FD1C5',
    fontSize: 14,
    fontWeight: '600'
  }
});
