import { describe, expect, it } from 'vitest';

import { LOSE_MESSAGES, WIN_MESSAGES, isLoveName, loveMessageFor, pickLoveMessage } from './love';

describe('messaggi per Davide', () => {
  it('stessi dati, stesso messaggio (i due giocatori vedono lo stesso)', () => {
    expect(pickLoveMessage(37, 2, WIN_MESSAGES)).toBe(pickLoveMessage(37, 2, WIN_MESSAGES));
    expect(loveMessageFor(['Davide', 'Giorgia'], 1, 40, 3)).toBe(loveMessageFor(['Davide', 'Giorgia'], 1, 40, 3));
  });

  it('vince Davide → messaggio di vittoria; perde Davide → messaggio di sconfitta', () => {
    expect(WIN_MESSAGES).toContain(loveMessageFor(['Davide', 'Giorgia'], 0, 36, 1));
    expect(WIN_MESSAGES).toContain(loveMessageFor(['Giorgia', 'Davide'], 1, 36, 1));
    expect(LOSE_MESSAGES).toContain(loveMessageFor(['Davide', 'Giorgia'], 1, 36, 1));
    expect(LOSE_MESSAGES).toContain(loveMessageFor(['Giorgia', 'Davide'], 0, 36, 1));
  });

  it('pareggio o nessun Davide → nessun messaggio', () => {
    expect(loveMessageFor(['Davide', 'Giorgia'], null, 36, 1)).toBeNull();
    expect(loveMessageFor(['Danilo', 'Claudia'], 0, 36, 1)).toBeNull();
    expect(loveMessageFor(['Danilo', 'Claudia'], 1, 36, 1)).toBeNull();
  });

  it('nel corso delle partite escono tutti i messaggi, in modo abbastanza vario', () => {
    for (const messages of [WIN_MESSAGES, LOSE_MESSAGES]) {
      const counts = new Map<string, number>();
      // Una smazzata dura circa 36 mosse: simuliamo molte fine-partita realistiche.
      for (let round = 1; round <= 300; round++) {
        const msg = pickLoveMessage(round * 36 + (round % 5), round, messages);
        counts.set(msg, (counts.get(msg) ?? 0) + 1);
      }
      expect([...counts.keys()].sort()).toEqual([...messages].sort());
      for (const n of counts.values()) expect(n).toBeGreaterThan(300 / messages.length / 2);
    }
  });

  it('riconosce il nome Davide a prescindere da maiuscole e spazi', () => {
    expect(isLoveName(' Davide ')).toBe(true);
    expect(isLoveName('DAVIDE')).toBe(true);
    expect(isLoveName('Giorgia')).toBe(false);
  });
});
