// Sticker personali: non fanno parte del sito pubblico. Il server li manda solo a chi ha un
// "lasciapassare" firmato, che ricevono chi fa il login e chi è in una partita con Davide.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STICKERS_DIR = resolve(fileURLToPath(new URL('./stickers/', import.meta.url)));
const STICKER_ID = /^[a-z0-9-]{1,60}$/;

// Segreto nuovo a ogni avvio: dopo un riavvio i lasciapassare vecchi non valgono più.
const SECRET = randomBytes(32);
const PERIOD_MS = 12 * 60 * 60 * 1000;

const sign = (expiry: number) => createHmac('sha256', SECRET).update(`stickers:${expiry}`).digest('base64url');

/**
 * Lasciapassare valido da 12 a 24 ore. Resta uguale per 12 ore, così gli indirizzi degli sticker
 * non cambiano a ogni aggiornamento e il browser li tiene in cache.
 */
export function stickerToken(now = Date.now()): string {
  const expiry = (Math.floor(now / PERIOD_MS) + 2) * PERIOD_MS;
  return `${expiry}.${sign(expiry)}`;
}

export function verifyStickerToken(token: string, now = Date.now()): boolean {
  const [exp, sig] = token.split('.');
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || !sig || expiry < now) return false;
  const expected = Buffer.from(sign(expiry));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Percorso del file dello sticker, o null se l'id non è valido o non esiste. */
export function stickerFile(id: string): string | null {
  if (!STICKER_ID.test(id)) return null;
  for (const ext of ['webp', 'png', 'gif']) {
    const file = join(STICKERS_DIR, `${id}.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}
