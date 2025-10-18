import { useCallback, useState } from 'react';
import {
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

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSignIn = useCallback(() => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password to continue.');
      return;
    }
    setSubmitting(true);
    // TODO: Wire up Supabase auth. Placeholder ensures UI feedback.
    setTimeout(() => {
      setSubmitting(false);
      router.replace('/(app)/home');
    }, 500);
  }, [email, password, router]);

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
        />
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#9CA8BC"
          style={styles.input}
          textContentType="password"
        />
        <Pressable
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isSubmitting ? styles.primaryButtonPressed : undefined,
            isSubmitting ? styles.disabledButton : undefined
          ]}
          accessibilityRole="button"
          disabled={isSubmitting}
        >
          <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
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
    opacity: 0.65
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
  link: {
    color: '#4FD1C5',
    fontSize: 14,
    fontWeight: '600'
  }
});
