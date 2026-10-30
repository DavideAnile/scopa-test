import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { preloadCardImages } from '@/constants/card-images';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    preloadCardImages();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game/local" options={{ gestureEnabled: false }} />
        <Stack.Screen name="online/index" />
        <Stack.Screen name="online/room" options={{ gestureEnabled: false }} />
        <Stack.Screen name="online/history" />
      </Stack>
    </ThemeProvider>
  );
}
