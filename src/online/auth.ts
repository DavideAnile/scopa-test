import AsyncStorage from '@react-native-async-storage/async-storage';

import { GAME_SERVER } from './server-url';

const KEY = 'scopa.password';

/** La password salvata sul dispositivo dopo il login (si inserisce una volta sola). */
export async function loadPassword(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function savePassword(password: string) {
  try {
    await AsyncStorage.setItem(KEY, password);
  } catch {
    // Non è grave: al prossimo avvio si chiederà di nuovo.
  }
}

export async function clearPassword() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Niente da fare.
  }
}

export type LoginResult = 'ok' | 'wrong' | 'locked' | 'offline';

/** Chiede al server se la password è giusta (la password vera esiste solo sul server). */
export async function verifyPassword(password: string): Promise<LoginResult> {
  if (!GAME_SERVER) return 'offline';
  try {
    const res = await fetch(`${GAME_SERVER.replace(/^ws/, 'http')}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 429) return 'locked';
    return res.ok ? 'ok' : 'wrong';
  } catch {
    return 'offline';
  }
}
