import { GAME_SERVER } from './server-url';

/** Indirizzo di uno sticker sul server; serve il lasciapassare (senza, il server risponde 403). */
export function stickerUri(id: string, token: string): string | null {
  if (!GAME_SERVER) return null;
  return `${GAME_SERVER.replace(/^ws/, 'http')}/api/sticker/${id}?t=${encodeURIComponent(token)}`;
}
