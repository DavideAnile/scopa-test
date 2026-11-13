import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { preloadCardImages } from '@/constants/card-images';
import { loadPassword } from '@/online/auth';
import { online } from '@/online/client';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    preloadCardImages();
    // Login: se la password è già salvata sul dispositivo si entra direttamente.
    loadPassword().then((pw) => online.setPassword(pw));
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="game/local" options={{ gestureEnabled: false }} />
        <Stack.Screen name="online/index" />
        <Stack.Screen name="online/room" options={{ gestureEnabled: false }} />
        <Stack.Screen name="online/history" />
      </Stack>
    </ThemeProvider>
  );
}
