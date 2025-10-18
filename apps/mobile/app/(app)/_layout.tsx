import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: '#0C1D37',
        headerStyle: { backgroundColor: '#FFFFFF' },
        contentStyle: { backgroundColor: '#F5F7FA' }
      }}
    />
  );
}
