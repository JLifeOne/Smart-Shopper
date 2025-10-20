import { Stack } from 'expo-router';
import { AuthProvider } from '@/src/context/auth-context';
import { ThemeProvider } from '@/src/context/theme-context';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
