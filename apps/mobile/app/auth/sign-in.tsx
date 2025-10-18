import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';
import { clearRememberedEmail, getRememberedEmail, setRememberedEmail } from '@/src/lib/preferences';

export default function SignInScreen() {
  const router = useRouter();
  const {
    signInWithPassword,
    requestPasswordReset,
    isAuthenticating,
    lastError,
    session,
    initializing
  } = useAuth();
  const passwordInputRef = useRef<TextInput | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const isSubmitDisabled = useMemo(
    () => !email || !password || isAuthenticating || initializing,
    [email, password, isAuthenticating, initializing]
  );

  useEffect(() => {
    let isMounted = true;
    getRememberedEmail().then((remembered) => {
      if (isMounted && remembered) {
        setEmail(remembered);
        setRememberMe(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (session && !initializing) {
      router.replace('/(app)/home');
    }
  }, [initializing, router, session]);

  const handleRememberMeToggle = useCallback(
    async (value: boolean, currentEmail: string) => {
      setRememberMe(value);
      if (value) {
        await setRememberedEmail(currentEmail);
      } else {
        await clearRememberedEmail();
      }
    },
    []
  );

  const handleSignIn = useCallback(async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password to continue.');
      return;
    }
    const result = await signInWithPassword({ email, password });
    if (!result.success) {
      Alert.alert('Sign-in failed', result.errorMessage ?? 'Check your credentials and try again.');
      return;
    }
    if (rememberMe) {
      await setRememberedEmail(email);
    } else {
      await clearRememberedEmail();
    }
    router.replace('/(app)/home');
  }, [email, password, rememberMe, router, signInWithPassword]);

  const handleForgotPassword = useCallback(async () => {
    if (!email) {
      Alert.alert('Enter your email', 'Provide the email used for your account and try again.');
      return;
    }
    const result = await requestPasswordReset(email);
    if (!result.success) {
      Alert.alert('Reset failed', result.errorMessage ?? 'Unable to send reset email right now.');
      return;
    }
    Alert.alert('Check your inbox', 'We sent password reset instructions to your email.');
  }, [email, requestPasswordReset]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.form}>
        <Text style={styles.heading}>Welcome back</Text>
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
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordInputRef}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9CA8BC"
            style={[styles.input, styles.passwordInput]}
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
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
        <View style={styles.rememberRow}>
          <View style={styles.rememberCopy}>
            <Text style={styles.rememberLabel}>Remember me</Text>
            <Text style={styles.rememberHint}>Skip typing your email next time.</Text>
          </View>
          <Switch
            value={rememberMe}
            onValueChange={(value) => {
            handleRememberMeToggle(value, email).catch((error) => {
              console.warn('Failed to update remember preference', error);
            });
            }}
            trackColor={{ false: '#4A576D', true: '#4FD1C5' }}
            thumbColor="#0C1D37"
          />
        </View>
        <Pressable onPress={handleForgotPassword} accessibilityRole="button">
          <Text style={styles.forgotPassword}>Forgot password?</Text>
        </Pressable>
        <Pressable
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isSubmitDisabled ? styles.primaryButtonPressed : undefined,
            isSubmitDisabled ? styles.disabledButton : undefined
          ]}
          accessibilityRole="button"
          disabled={isSubmitDisabled}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#0C1D37" />
          ) : (
            <Text style={styles.primaryButtonLabel}>Sign in</Text>
          )}
        </Pressable>
        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Need an account?</Text>
          <Link href="/auth/sign-up" style={styles.link}>
            Sign up
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
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121F3B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12
  },
  rememberCopy: {
    flex: 1,
    marginRight: 12
  },
  rememberLabel: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  rememberHint: {
    color: '#9CA8BC',
    fontSize: 12,
    marginTop: 4
  },
  forgotPassword: {
    color: '#4FD1C5',
    fontWeight: '600',
    alignSelf: 'flex-end'
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
