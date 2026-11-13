import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Indirizzo del server di gioco. Su Expo Go lo imposta `npm run party`. Sul web la pagina viene
 * servita dal server di gioco stesso, quindi l'indirizzo è quello della pagina.
 */
function resolveGameServer(): string | null {
  const fromConfig: unknown = Constants.expoConfig?.extra?.gameServer;
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, host } = window.location;
    return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;
  }
  return null;
}

export const GAME_SERVER = resolveGameServer();
