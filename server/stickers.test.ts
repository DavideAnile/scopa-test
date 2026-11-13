import { describe, expect, it } from 'vitest';

import { avatarFor } from './protocol.ts';
import { stickerFile, stickerToken, verifyStickerToken } from './stickers.ts';

describe('lasciapassare degli sticker', () => {
  it('valido, scaduto, falsificato', () => {
    const now = Date.UTC(2026, 10, 13, 10);
    const token = stickerToken(now);
    expect(verifyStickerToken(token, now)).toBe(true);
    expect(verifyStickerToken(token, now + 11 * 3600_000)).toBe(true);
    expect(verifyStickerToken(token, now + 25 * 3600_000)).toBe(false);
    const [exp, sig] = token.split('.');
    expect(verifyStickerToken(`${Number(exp) + 3600_000}.${sig}`, now)).toBe(false);
    expect(verifyStickerToken(`${exp}.${sig.slice(0, -2)}xx`, now)).toBe(false);
    expect(verifyStickerToken('', now)).toBe(false);
  });

  it('resta uguale per qualche ora (gli indirizzi restano in cache)', () => {
    const now = Date.UTC(2026, 10, 13, 13);
    expect(stickerToken(now)).toBe(stickerToken(now + 3600_000));
  });

  it('file: solo id validi e solo dentro la cartella', () => {
    expect(stickerFile('sticker-01')).toMatch(/server\/stickers\/sticker-01\.webp$/);
    expect(stickerFile('sticker-99')).toBeNull();
    expect(stickerFile('../password')).toBeNull();
    expect(stickerFile('Sticker-01')).toBeNull();
  });

  it('avatar per nome', () => {
    expect(avatarFor(' Davide ')).toBe('sticker-15');
    expect(avatarFor('GIORGIA')).toBe('sticker-12');
    expect(avatarFor('Danilo')).toBeNull();
    expect(avatarFor(null)).toBeNull();
  });
});
