import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';

export default function AuthLayout() {
  const { initializing, session, signupProfileSetupCountryCode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && session) {
      if (signupProfileSetupCountryCode) {
        const countryCode = signupProfileSetupCountryCode;
        router.replace(`/(app)/profile-setup?country=${encodeURIComponent(countryCode)}&force=1`);
        return;
      }
      router.replace('/(app)/home');
    }
  }, [initializing, router, session, signupProfileSetupCountryCode]);

  if (session) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0C1D37'
        },
        headerTintColor: '#FFFFFF',
        contentStyle: { backgroundColor: '#0C1D37' }
      }}
    />
  );
}
