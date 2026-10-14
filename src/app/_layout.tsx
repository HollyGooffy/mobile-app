import '../../global.css';

import { Stack } from 'expo-router';

import { AppProviders } from '../application/providers/AppProviders';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="marker/[id]" />
      </Stack>
    </AppProviders>
  );
}
