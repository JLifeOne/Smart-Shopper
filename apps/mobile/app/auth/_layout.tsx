import { Stack } from 'expo-router';

export default function AuthLayout() {
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
