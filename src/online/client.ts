import { useSyncExternalStore } from 'react';

import type { PlayerView } from '@scopa';
import type { ChatMessage, ClientMsg, ErrorCode, HistoryEntry, RoomInfo, ServerMsg } from '@server/protocol';

import { clearPassword } from './auth';
import { GAME_SERVER } from './server-url';

export { GAME_SERVER };

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
  /** Ultimo segnale "sta scrivendo" dell'avversario (null se ha smesso o ha inviato). */
  opponentTypingAt: number | null;
  /** Login con password: 'loading' finché non si è letta quella salvata sul dispositivo. */
  auth: 'loading' | 'in' | 'out';
  /** Lasciapassare per scaricare gli sticker (dal login o dalla stanza con Davide). */
  stickerToken: string | null;
  /** Ultima reazione messa dall'avversario a un mio messaggio (`n` cresce a ogni nuova reazione). */
  opponentReaction: { id: number; emoji: string; n: number } | null;
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
  opponentTypingAt: null,
  auth: 'loading',
  stickerToken: null,
  opponentReaction: null,
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
  private typingOn = false;
  private password: string | null = null;
  private typingSentAt = 0;

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
  /** Imposta lo stato del login (all'avvio con la password salvata, o dopo il login). */
  setPassword(password: string | null) {
    this.password = password;
    this.set({ auth: password ? 'in' : 'out' });
    if (this.hello) this.connect(this.hello.playerId, this.hello.name);
  }

  setStickerToken(token: string) {
    if (token !== this.state.stickerToken) this.set({ stickerToken: token });
  }

  connect(playerId: string, name: string) {
    this.hello = this.password ? { t: 'hello', playerId, name, password: this.password } : { t: 'hello', playerId, name };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(this.hello));
    else if (!this.ws) this.open();
  }

  send(msg: ClientMsg) {
    if (msg.t === 'create' || msg.t === 'join') this.set({ room: null, view: null, chat: [], error: null, closedByOpponent: false });
    if (msg.t === 'leave') this.set({ room: null, view: null, chat: [], closedByOpponent: false });
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  /**
   * Avvisa l'avversario che stai scrivendo: "on" al massimo ogni 2 s mentre scrivi, "off" quando
   * smetti (campo vuoto, messaggio inviato, chat chiusa). Non viene messo in coda se si è offline.
   */
  setTyping(on: boolean) {
    if (!this.state.room || this.ws?.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (on) {
      if (this.typingOn && now - this.typingSentAt < 2000) return;
      this.typingSentAt = now;
    } else if (!this.typingOn) {
      return;
    }
    this.typingOn = on;
    this.ws.send(JSON.stringify({ t: 'typing', on } satisfies ClientMsg));
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
        return this.set({
          room: msg.room,
          closedByOpponent: false,
          ...(msg.room.stickerToken ? { stickerToken: msg.room.stickerToken } : {}),
        });
      case 'view':
        return this.set({ view: msg.view });
      case 'chatLog':
        return this.set({ chat: msg.messages });
      case 'chat': {
        // Un messaggio dell'avversario chiude il suo "sta scrivendo".
        const fromOpponent = this.state.room !== null && msg.message.from !== this.state.room.you;
        return this.set({
          chat: [...this.state.chat, msg.message],
          ...(fromOpponent ? { opponentTypingAt: null } : {}),
        });
      }
      case 'typing':
        return this.set({ opponentTypingAt: msg.on ? Date.now() : null });
      case 'reaction': {
        const you = this.state.room?.you;
        const old = this.state.chat.find((m) => m.id === msg.id);
        const chat = this.state.chat.map((m) => (m.id === msg.id ? { ...m, reactions: msg.reactions } : m));
        // L'avversario ha messo (non tolto) una reazione a un mio messaggio?
        const opp = you === undefined ? null : you === 0 ? 1 : 0;
        const emoji = opp === null ? null : msg.reactions[opp];
        const isNew = old && old.from === you && emoji && emoji !== old.reactions?.[opp!];
        return this.set({
          chat,
          ...(isNew ? { opponentReaction: { id: msg.id, emoji, n: (this.state.opponentReaction?.n ?? 0) + 1 } } : {}),
        });
      }
      case 'history':
        return this.set({ history: msg.games });
      case 'closed':
        return this.set({ room: null, view: null, closedByOpponent: msg.byOpponent, opponentTypingAt: null });
      case 'error':
        // Una mossa doppia (tocco ripetuto) non è un errore da mostrare.
        if (msg.code === 'stale_move' || msg.code === 'not_your_turn') return;
        // Password cambiata o non valida: si torna al login.
        if (msg.code === 'not_authorized') {
          clearPassword();
          this.password = null;
          return this.set({ auth: 'out', room: null, view: null, error: { code: msg.code, at: Date.now() } });
        }
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
