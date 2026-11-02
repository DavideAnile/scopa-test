import type { Pair } from '@scopa';

/** Se una partita la vince (o la perde) Davide, compare uno di questi messaggi a entrambi i giocatori. */
export const LOVE_NAME = 'davide';

export const WIN_MESSAGES = [
  '💕 Amore sei scarsa ma ti amo lo stesso 💕',
  'Scarsona, ma quanto ti amo? 😂❤️',
  'Sono bravo sia a scopa che a scopone amore 😂❤️',
] as const;

export const LOSE_MESSAGES = [
  'Ritenta amore, sarai più fortunato 😂❤️',
  'A carte perdi, ma a letto vinci sempre 😏❤️',
  'Complimenti amore, hai perso di nuovo 😂❤️',
  'Ti manca la fortuna, ma hai me, per sempre eeeeee❤️❤️❤️',
  'Ma quanto ti amo ioooooooooo?  Così\n<|> 😂❤️',
] as const;

export const isLoveName = (name: string) => name.trim().toLowerCase() === LOVE_NAME;

/**
 * Sceglie "a caso" un messaggio dell'elenco. Non usa Math.random: deriva la scelta da dati che
 * entrambi i giocatori hanno (mosse giocate e numero di smazzata), così vedono lo stesso messaggio.
 */
export function pickLoveMessage(moveNo: number, roundNo: number, messages: readonly string[]): string {
  let h = Math.imul(moveNo ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(roundNo + 1, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return messages[(h >>> 0) % messages.length];
}

/** Il messaggio di fine partita: se vince Davide, se perde Davide, altrimenti (pareggio, altri nomi) nessuno. */
export function loveMessageFor(names: Pair<string>, winner: 0 | 1 | null, moveNo: number, roundNo: number): string | null {
  if (winner === null) return null;
  if (isLoveName(names[winner])) return pickLoveMessage(moveNo, roundNo, WIN_MESSAGES);
  if (isLoveName(names[winner === 0 ? 1 : 0])) return pickLoveMessage(moveNo, roundNo, LOSE_MESSAGES);
  return null;
}
