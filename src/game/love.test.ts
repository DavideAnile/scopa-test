import { describe, expect, it } from 'vitest';

import { LOVE_MESSAGES, isLoveName, pickLoveMessage } from './love';

describe('messaggi per Davide', () => {
  it('stessi dati, stesso messaggio (i due giocatori vedono lo stesso)', () => {
    expect(pickLoveMessage(37, 2)).toBe(pickLoveMessage(37, 2));
  });

  it('nel corso delle partite escono tutti e tre, in modo abbastanza vario', () => {
    const counts = new Map<string, number>();
    // Una smazzata dura circa 36 mosse: simuliamo molte fine-partita realistiche.
    for (let round = 1; round <= 300; round++) {
      const msg = pickLoveMessage(round * 36 + (round % 5), round);
      counts.set(msg, (counts.get(msg) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...LOVE_MESSAGES].sort());
    for (const n of counts.values()) expect(n).toBeGreaterThan(60);
  });

  it('riconosce il nome Davide a prescindere da maiuscole e spazi', () => {
    expect(isLoveName(' Davide ')).toBe(true);
    expect(isLoveName('DAVIDE')).toBe(true);
    expect(isLoveName('Giorgia')).toBe(false);
  });
});
