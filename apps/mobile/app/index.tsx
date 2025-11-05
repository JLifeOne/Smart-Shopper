import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/src/context/auth-context';

export default function HomeScreen() {
  const router = useRouter();
  const { session, initializing } = useAuth();
  const heroText = useMemo(
    () => 'Track prices, build smarter lists, and know the cheapest store before you shop.',
    []
  );

  useEffect(() => {
    if (!initializing && session) {
      router.replace('/(app)/home');
    }
  }, [initializing, router, session]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Smart Shopper</Text>
        <Text style={styles.subtitle}>{heroText}</Text>
        <Link href="/onboarding" style={styles.cta}>
          Get Started
        </Link>
        <Link href="/auth/sign-in" style={styles.secondaryCta}>
          Already have an account?
        </Link>
      </ScrollView>
    </View>
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
    paddingTop: 120,
    paddingBottom: 48
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E0E6F1',
    marginBottom: 32
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: '#4FD1C5',
    color: '#0C1D37',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  secondaryCta: {
    marginTop: 16,
    color: '#4FD1C5',
    fontWeight: '600'
  }
});
