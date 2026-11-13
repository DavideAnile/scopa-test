// Messaggi scambiati fra app e server di gioco (JSON su WebSocket).
// Solo tipi e validazione: lo importano sia il server sia l'app.

import { type Card, type Pair, type PlayerIndex, type PlayerView, type SeriesLength, isCard } from '../supabase/functions/_shared/scopa/index.ts';

export const MAX_CHAT_LENGTH = 500;
/** Reazioni possibili ai messaggi della chat (una per giocatore e per messaggio). */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const;
const STICKER_ID = /^[a-z0-9-]{1,60}$/;

/** Foto profilo (uno sticker) per nome, confrontato senza maiuscole né spazi. */
const AVATARS: Record<string, string> = { davide: 'sticker-15', giorgia: 'sticker-12' };
const isDavide = (name: string | null | undefined) => name?.trim().toLowerCase() === 'davide';

/** Nome dell'avversario nelle partite contro il computer (lui non prende avatar). */
export const COMPUTER_NAME = 'Computer';

/** Chi gioca contro Davide è Giorgia, qualunque nome usi ("Gio", "gio"…): prende il suo avatar. */
export function avatarFor(name: string | null | undefined, opponent?: string | null): string | null {
  const own = AVATARS[name?.trim().toLowerCase() ?? ''];
  if (own) return own;
  return name && name !== COMPUTER_NAME && isDavide(opponent) ? AVATARS.giorgia : null;
}

/** Gli sticker (foto personali) sono disponibili solo nelle partite in cui uno dei due si chiama Davide. */
export function stickersAllowed(names: readonly (string | null | undefined)[]): boolean {
  return names.some(isDavide);
}

export type ClientMsg =
  /** `password` (se l'utente ha fatto il login) serve per creare partite; il nome può essere ancora vuoto. */
  | { t: 'hello'; playerId: string; name: string; password?: string }
  | { t: 'create'; series: SeriesLength }
  | { t: 'join'; code: string }
  | { t: 'play'; card: Card; capture: Card[]; moveNo: number }
  /** Un messaggio di testo oppure uno sticker (id del pacchetto incluso nell'app). */
  | { t: 'chat'; text: string; sticker?: undefined }
  | { t: 'chat'; sticker: string; text?: undefined }
  /** Reazione a un messaggio della chat; null la toglie. */
  | { t: 'react'; id: number; emoji: string | null }
  /** Sto scrivendo in chat (on) / ho smesso (off). Non viene salvato. */
  | { t: 'typing'; on: boolean }
  | { t: 'continue' }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'history' };

export interface ChatMessage {
  id: number;
  from: PlayerIndex;
  name: string;
  /** Vuoto per gli sticker. */
  text: string;
  sticker?: string;
  /** Reazione di ciascun giocatore (indicizzata per giocatore). */
  reactions?: Pair<string | null>;
  at: number;
}

export interface RoomInfo {
  code: string;
  series: SeriesLength;
  you: PlayerIndex;
  names: Pair<string | null>;
  connected: Pair<boolean>;
  /** Chi ha premuto "Continua" a fine partita (si riparte quando sono tutti e due). */
  ready: Pair<boolean>;
  /** Chi ha chiesto la rivincita a serie finita. */
  rematch: Pair<boolean>;
  /** Lasciapassare per scaricare gli sticker: solo nelle partite con Davide. */
  stickerToken?: string;
}

export interface HistoryEntry {
  id: string;
  finishedAt: number;
  series: SeriesLength;
  players: Pair<{ id: string; name: string }>;
  /** Partite vinte nella serie. */
  wins: Pair<number>;
  /** null = serie finita in pareggio. */
  winner: PlayerIndex | null;
  /** Punti fatti in ogni smazzata. */
  rounds: Pair<number>[];
}

export type ErrorCode =
  | 'bad_message'
  | 'not_ready'
  | 'room_not_found'
  | 'room_full'
  | 'not_in_room'
  | 'no_game'
  | 'stale_move'
  | 'game_over'
  | 'not_your_turn'
  | 'card_not_in_hand'
  | 'illegal_capture'
  | 'not_authorized';

export type ServerMsg =
  | { t: 'room'; room: RoomInfo }
  | { t: 'view'; view: PlayerView }
  | { t: 'chatLog'; messages: ChatMessage[] }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'typing'; from: PlayerIndex; on: boolean }
  | { t: 'reaction'; id: number; reactions: Pair<string | null> }
  | { t: 'history'; games: HistoryEntry[] }
  /** La stanza non esiste più (sei uscito tu o è uscito l'avversario). */
  | { t: 'closed'; byOpponent: boolean }
  | { t: 'error'; code: ErrorCode };

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Valida un messaggio arrivato dalla rete; null se non è valido. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'hello': {
      const name = typeof m.name === 'string' && m.name.length <= 40 ? m.name.trim() : null;
      if (!isString(m.playerId, 64) || name === null) return null;
      return isString(m.password, 200) ? { t: 'hello', playerId: m.playerId, name, password: m.password } : { t: 'hello', playerId: m.playerId, name };
    }
    case 'create':
      return m.series === 10 ? { t: 'create', series: m.series } : null;
    case 'join':
      return isString(m.code, 8) ? { t: 'join', code: m.code.trim().toUpperCase() } : null;
    case 'play':
      return isCard(m.card) && Array.isArray(m.capture) && m.capture.every(isCard) && Number.isInteger(m.moveNo)
        ? { t: 'play', card: m.card, capture: m.capture, moveNo: m.moveNo as number }
        : null;
    case 'chat': {
      // Esattamente uno tra testo e sticker.
      if (m.sticker !== undefined) {
        return m.text === undefined && typeof m.sticker === 'string' && STICKER_ID.test(m.sticker)
          ? { t: 'chat', sticker: m.sticker }
          : null;
      }
      const text = typeof m.text === 'string' ? m.text.trim() : '';
      return text.length > 0 && text.length <= MAX_CHAT_LENGTH ? { t: 'chat', text } : null;
    }
    case 'typing':
      return typeof m.on === 'boolean' ? { t: 'typing', on: m.on } : null;
    case 'react':
      return Number.isInteger(m.id) && (m.emoji === null || (REACTIONS as readonly unknown[]).includes(m.emoji))
        ? { t: 'react', id: m.id as number, emoji: m.emoji as string | null }
        : null;
    case 'continue':
    case 'rematch':
    case 'leave':
    case 'history':
      return { t: m.t };
    default:
      return null;
  }
}
