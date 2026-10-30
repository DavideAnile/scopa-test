import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Identity {
  playerId: string;
  name: string;
}

const KEY = 'scopa.identity';

function randomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** L'id resta fisso sul telefono: è quello che permette di riprendere la partita e ritrovare lo storico. */
export async function loadIdentity(): Promise<Identity> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as Identity;
  } catch {
    // Storage non disponibile o dati rovinati: si riparte con un'identità nuova.
  }
  const fresh = { playerId: randomId(), name: '' };
  await saveIdentity(fresh);
  return fresh;
}

export async function saveIdentity(identity: Identity) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Non è grave: al prossimo avvio si chiederà di nuovo il nome.
  }
}
