/** Quando una partita la vince Davide, compare uno di questi messaggi a entrambi i giocatori. */
export const LOVE_NAME = 'davide';

export const LOVE_MESSAGES = [
  '💕 Amore sei scarsa ma ti amo lo stesso 💕',
  'Scarsona, ma quanto ti amo? 😂❤️',
  'Sono bravo sia a scopa che a scopone amore 😂❤️',
] as const;

export const isLoveName = (name: string) => name.trim().toLowerCase() === LOVE_NAME;

/**
 * Sceglie "a caso" il messaggio della partita. Non usa Math.random: deriva la scelta da dati che
 * entrambi i giocatori hanno (mosse giocate e numero di smazzata), così vedono lo stesso messaggio.
 */
export function pickLoveMessage(moveNo: number, roundNo: number): string {
  let h = Math.imul(moveNo ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(roundNo + 1, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return LOVE_MESSAGES[(h >>> 0) % LOVE_MESSAGES.length];
}
