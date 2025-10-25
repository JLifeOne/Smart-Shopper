import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/context/auth-context';
import { ThemeProvider } from '@/src/context/theme-context';
import { HEADER_HEIGHT } from '@/src/constants/layout';
import { TopBar } from '@/src/components/TopBar';
import { SearchOverlayProvider } from '@/src/providers/SearchOverlayProvider';
import { TopBarProvider } from '@/src/providers/TopBarProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <TopBarProvider>
            <AppFrame />
          </TopBarProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppFrame() {
  const insets = useSafeAreaInsets();
  const topOffset = HEADER_HEIGHT + insets.top;

  return (
    <SearchOverlayProvider topOffset={topOffset}>
      <TopBar />
      <View style={{ flex: 1, paddingTop: topOffset }}>
        <Stack
          screenOptions={{
            headerShown: false
          }}
        />
      </View>
    </SearchOverlayProvider>
  );
}
