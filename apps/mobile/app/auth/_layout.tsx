import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';

export default function AuthLayout() {
  const { initializing, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && session) {
      router.replace('/(app)/home');
    }
  }, [initializing, router, session]);

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
