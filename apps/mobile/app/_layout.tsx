import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/context/auth-context';
import { ThemeProvider } from '@/src/context/theme-context';
import { HEADER_HEIGHT } from '@/src/constants/layout';
import { TopBar } from '@/src/components/TopBar';
import { SearchOverlayProvider } from '@/src/providers/SearchOverlayProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SearchOverlayProvider topOffset={HEADER_HEIGHT}>
            <TopBar />
            <View style={{ flex: 1, paddingTop: HEADER_HEIGHT }}>
              <Stack
                screenOptions={{
                  headerShown: false
                }}
              />
            </View>
          </SearchOverlayProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
