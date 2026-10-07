import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Registers the background location task; must load before any screen renders.
import { stopStaleBackgroundLocation } from '../navigation/backgroundLocation';
import { SettingsProvider } from '../state/settings';

export default function RootLayout() {
  useEffect(stopStaleBackgroundLocation, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
