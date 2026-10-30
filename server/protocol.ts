// Messaggi scambiati fra app e server di gioco (JSON su WebSocket).
// Solo tipi e validazione: lo importano sia il server sia l'app.

import { type Card, type Pair, type PlayerIndex, type PlayerView, type SeriesLength, isCard } from '../supabase/functions/_shared/scopa/index.ts';

export const MAX_CHAT_LENGTH = 500;

export type ClientMsg =
  | { t: 'hello'; playerId: string; name: string }
  | { t: 'create'; series: SeriesLength }
  | { t: 'join'; code: string }
  | { t: 'play'; card: Card; capture: Card[]; moveNo: number }
  | { t: 'chat'; text: string }
  | { t: 'continue' }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'history' };

export interface ChatMessage {
  id: number;
  from: PlayerIndex;
  name: string;
  text: string;
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
  | 'illegal_capture';

export type ServerMsg =
  | { t: 'room'; room: RoomInfo }
  | { t: 'view'; view: PlayerView }
  | { t: 'chatLog'; messages: ChatMessage[] }
  | { t: 'chat'; message: ChatMessage }
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
    case 'hello':
      return isString(m.playerId, 64) && isString(m.name, 40) ? { t: 'hello', playerId: m.playerId, name: m.name.trim() } : null;
    case 'create':
      return m.series === 10 || m.series === 15 ? { t: 'create', series: m.series } : null;
    case 'join':
      return isString(m.code, 8) ? { t: 'join', code: m.code.trim().toUpperCase() } : null;
    case 'play':
      return isCard(m.card) && Array.isArray(m.capture) && m.capture.every(isCard) && Number.isInteger(m.moveNo)
        ? { t: 'play', card: m.card, capture: m.capture, moveNo: m.moveNo as number }
        : null;
    case 'chat': {
      const text = typeof m.text === 'string' ? m.text.trim() : '';
      return text.length > 0 && text.length <= MAX_CHAT_LENGTH ? { t: 'chat', text } : null;
    }
    case 'continue':
    case 'rematch':
    case 'leave':
    case 'history':
      return { t: m.t };
    default:
      return null;
  }
}
