import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { PlayerView } from '@scopa';
import type { ChatMessage, ClientMsg, ErrorCode, HistoryEntry, RoomInfo, ServerMsg } from '@server/protocol';

/**
 * Indirizzo del server di gioco. Su Expo Go lo imposta `npm run party`. Sul web la pagina viene
 * servita dal server di gioco stesso, quindi l'indirizzo è quello della pagina.
 */
function resolveGameServer(): string | null {
  const fromConfig = Constants.expoConfig?.extra?.gameServer as string | null | undefined;
  if (fromConfig) return fromConfig;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, host } = window.location;
    return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;
  }
  return null;
}

export const GAME_SERVER = resolveGameServer();

/** Link web da mandare all'amico (si gioca da Safari, senza installare niente). */
export function inviteLink(code: string): string | null {
  if (!GAME_SERVER) return null;
  return `${GAME_SERVER.replace(/^ws/, 'http')}/online?code=${code}`;
}

export interface OnlineState {
  status: 'idle' | 'connecting' | 'online' | 'offline';
  room: RoomInfo | null;
  view: PlayerView | null;
  chat: ChatMessage[];
  history: HistoryEntry[] | null;
  error: { code: ErrorCode; at: number } | null;
  /** La stanza è stata chiusa dall'avversario. */
  closedByOpponent: boolean;
  /** Da quando si sta aspettando il server (null se collegati). Su Render può dormire ~1 minuto. */
  waitingSince: number | null;
}

const INITIAL: OnlineState = {
  status: 'idle',
  room: null,
  view: null,
  chat: [],
  history: null,
  error: null,
  closedByOpponent: false,
  waitingSince: null,
};

/** Connessione al server con riconnessione automatica. Store esterno per useSyncExternalStore. */
class OnlineClient {
  private state: OnlineState = INITIAL;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private hello: Extract<ClientMsg, { t: 'hello' }> | null = null;
  private queue: ClientMsg[] = [];
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  get playerId() {
    return this.hello?.playerId ?? null;
  }

  private set(patch: Partial<OnlineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Si collega (o aggiorna il nome se già collegato). */
  connect(playerId: string, name: string) {
    this.hello = { t: 'hello', playerId, name };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(this.hello));
    else if (!this.ws) this.open();
  }

  send(msg: ClientMsg) {
    if (msg.t === 'create' || msg.t === 'join') this.set({ room: null, view: null, chat: [], error: null, closedByOpponent: false });
    if (msg.t === 'leave') this.set({ room: null, view: null, chat: [], closedByOpponent: false });
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  clearError() {
    this.set({ error: null });
  }

  private open() {
    if (!GAME_SERVER || !this.hello) return;
    this.set({ status: 'connecting', waitingSince: this.state.waitingSince ?? Date.now() });
    const ws = new WebSocket(GAME_SERVER);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.set({ status: 'online', waitingSince: null });
      ws.send(JSON.stringify(this.hello));
      for (const msg of this.queue.splice(0)) ws.send(JSON.stringify(msg));
    };
    ws.onmessage = (e) => {
      try {
        this.receive(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        // Messaggio non valido: lo ignoriamo.
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.set({ status: 'offline', waitingSince: this.state.waitingSince ?? Date.now() });
      // Riprova con attesa crescente (max 5 s): il server può impiegare un po' a svegliarsi.
      const delay = Math.min(5000, 500 * 2 ** this.retry++);
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private receive(msg: ServerMsg) {
    switch (msg.t) {
      case 'room':
        return this.set({ room: msg.room, closedByOpponent: false });
      case 'view':
        return this.set({ view: msg.view });
      case 'chatLog':
        return this.set({ chat: msg.messages });
      case 'chat':
        return this.set({ chat: [...this.state.chat, msg.message] });
      case 'history':
        return this.set({ history: msg.games });
      case 'closed':
        return this.set({ room: null, view: null, closedByOpponent: msg.byOpponent });
      case 'error':
        // Una mossa doppia (tocco ripetuto) non è un errore da mostrare.
        if (msg.code === 'stale_move' || msg.code === 'not_your_turn') return;
        return this.set({ error: { code: msg.code, at: Date.now() } });
    }
  }
}

export const online = new OnlineClient();

export function useOnline() {
  return useSyncExternalStore(online.subscribe, online.getSnapshot, online.getSnapshot);
}

export const ERROR_TEXT: Partial<Record<ErrorCode, string>> = {
  room_not_found: 'Nessuna partita con questo codice.',
  room_full: 'Questa partita ha già due giocatori.',
  illegal_capture: 'Presa non valida.',
  card_not_in_hand: 'Carta non valida.',
  not_ready: 'Connessione in corso, riprova.',
};
