// Logica delle stanze, senza rete né file: riceve messaggi e restituisce cosa inviare a chi.

import {
  type GameState,
  MoveError,
  type Pair,
  type PlayerIndex,
  type SeriesLength,
  applyMove,
  newGame,
  nextRound,
  other,
  playerView,
} from '../supabase/functions/_shared/scopa/index.ts';

import type { ChatMessage, ClientMsg, ErrorCode, HistoryEntry, RoomInfo, ServerMsg } from './protocol.ts';

export interface Outgoing {
  to: string;
  msg: ServerMsg;
}

interface Seat {
  id: string;
  name: string;
}

interface Room {
  code: string;
  series: SeriesLength;
  seats: [Seat, Seat | null];
  game: GameState | null;
  chat: ChatMessage[];
  ready: Pair<boolean>;
  rematch: Pair<boolean>;
  lastActive: number;
}

export interface LobbyDeps {
  random?: () => number;
  now?: () => number;
  /** Chiamata quando una partita finisce (per salvarla nello storico). */
  onGameFinished?: (entry: HistoryEntry) => void;
  history?: (playerId: string) => HistoryEntry[];
}

// Niente lettere che si confondono a voce o a occhio (I/L/O).
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_CHAT = 200;
export const IDLE_ROOM_MS = 30 * 60 * 1000;

export class Lobby {
  private rooms = new Map<string, Room>();
  private roomOf = new Map<string, string>();
  private names = new Map<string, string>();
  private online = new Set<string>();
  private random: () => number;
  private now: () => number;
  private chatId = 0;
  private deps: LobbyDeps;

  // Niente "private deps" nel costruttore: Node esegue il TypeScript senza compilarlo e non lo supporta.
  constructor(deps: LobbyDeps = {}) {
    this.deps = deps;
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? Date.now;
  }

  /** Un giocatore si è (ri)collegato: se era in una stanza gli rimandiamo tutto. */
  connect(playerId: string, name: string): Outgoing[] {
    this.online.add(playerId);
    this.names.set(playerId, name);
    const room = this.roomFor(playerId);
    if (!room) return [];
    const seat = this.seatOf(room, playerId)!;
    room.seats[seat]!.name = name;
    room.lastActive = this.now();
    return [
      ...this.broadcastState(room),
      { to: playerId, msg: { t: 'chatLog', messages: room.chat } },
    ];
  }

  disconnect(playerId: string): Outgoing[] {
    this.online.delete(playerId);
    const room = this.roomFor(playerId);
    if (!room) return [];
    room.lastActive = this.now();
    return this.broadcastRoom(room);
  }

  handle(playerId: string, msg: ClientMsg): Outgoing[] {
    if (msg.t === 'hello') return this.connect(msg.playerId, msg.name);
    if (!this.names.has(playerId)) return this.error(playerId, 'not_ready');

    switch (msg.t) {
      case 'create':
        return this.create(playerId, msg.series);
      case 'join':
        return this.join(playerId, msg.code);
      case 'history':
        return [{ to: playerId, msg: { t: 'history', games: this.deps.history?.(playerId) ?? [] } }];
      case 'leave':
        return this.leave(playerId);
    }

    const room = this.roomFor(playerId);
    if (!room) return this.error(playerId, 'not_in_room');
    const seat = this.seatOf(room, playerId)!;
    room.lastActive = this.now();

    switch (msg.t) {
      case 'chat': {
        const message: ChatMessage = { id: ++this.chatId, from: seat, name: room.seats[seat]!.name, text: msg.text, at: this.now() };
        room.chat.push(message);
        if (room.chat.length > MAX_CHAT) room.chat.shift();
        return this.toSeats(room, { t: 'chat', message });
      }
      case 'play': {
        const game = room.game;
        if (!game) return this.error(playerId, 'no_game');
        if (msg.moveNo !== game.moveNo) return this.error(playerId, 'stale_move');
        try {
          room.game = applyMove(game, seat, msg.card, msg.capture);
        } catch (e) {
          if (e instanceof MoveError) return this.error(playerId, e.code);
          throw e;
        }
        if (room.game.status === 'finished') this.recordFinished(room, room.game);
        return this.broadcastViews(room);
      }
      case 'continue': {
        if (room.game?.status !== 'roundOver') return this.error(playerId, 'no_game');
        room.ready[seat] = true;
        if (room.ready[0] && room.ready[1]) {
          room.game = nextRound(room.game);
          room.ready = [false, false];
          return this.broadcastState(room);
        }
        return this.broadcastRoom(room);
      }
      case 'rematch': {
        if (room.game?.status !== 'finished') return this.error(playerId, 'no_game');
        room.rematch[seat] = true;
        if (room.rematch[0] && room.rematch[1]) {
          room.game = this.freshGame(room.series, other(room.game.dealer));
          room.rematch = [false, false];
          room.ready = [false, false];
          return this.broadcastState(room);
        }
        return this.broadcastRoom(room);
      }
    }
  }

  /** Elimina le stanze ferme da troppo tempo con nessuno collegato. */
  sweep(): void {
    const now = this.now();
    for (const room of this.rooms.values()) {
      const anyoneOnline = room.seats.some((s) => s && this.online.has(s.id));
      if (!anyoneOnline && now - room.lastActive > IDLE_ROOM_MS) this.deleteRoom(room);
    }
  }

  get roomCount() {
    return this.rooms.size;
  }

  private create(playerId: string, series: SeriesLength): Outgoing[] {
    const out = this.leave(playerId, false);
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(this.random() * CODE_LETTERS.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      series,
      seats: [{ id: playerId, name: this.names.get(playerId)! }, null],
      game: null,
      chat: [],
      ready: [false, false],
      rematch: [false, false],
      lastActive: this.now(),
    };
    this.rooms.set(code, room);
    this.roomOf.set(playerId, code);
    return [...out, ...this.broadcastRoom(room), { to: playerId, msg: { t: 'chatLog', messages: [] } }];
  }

  private join(playerId: string, code: string): Outgoing[] {
    const room = this.rooms.get(code);
    if (!room) return this.error(playerId, 'room_not_found');
    if (this.seatOf(room, playerId) !== null) return this.connect(playerId, this.names.get(playerId)!);
    if (room.seats[1]) return this.error(playerId, 'room_full');

    const out = this.leave(playerId, false);
    room.seats[1] = { id: playerId, name: this.names.get(playerId)! };
    this.roomOf.set(playerId, code);
    room.game = this.freshGame(room.series, this.random() < 0.5 ? 0 : 1);
    room.lastActive = this.now();
    return [...out, ...this.broadcastState(room), { to: playerId, msg: { t: 'chatLog', messages: room.chat } }];
  }

  /** Esce dalla stanza attuale: la stanza si chiude e l'avversario viene avvisato. */
  private leave(playerId: string, notifySelf = true): Outgoing[] {
    const room = this.roomFor(playerId);
    if (!room) return [];
    this.deleteRoom(room);
    const out: Outgoing[] = [];
    for (const s of room.seats) {
      if (!s) continue;
      if (s.id !== playerId) out.push({ to: s.id, msg: { t: 'closed', byOpponent: true } });
      else if (notifySelf) out.push({ to: s.id, msg: { t: 'closed', byOpponent: false } });
    }
    return out;
  }

  private deleteRoom(room: Room) {
    this.rooms.delete(room.code);
    for (const s of room.seats) if (s && this.roomOf.get(s.id) === room.code) this.roomOf.delete(s.id);
  }

  private freshGame(series: SeriesLength, dealer: PlayerIndex) {
    return newGame({ seed: Math.floor(this.random() * 2 ** 32), series, dealer });
  }

  private recordFinished(room: Room, game: GameState) {
    const [a, b] = room.seats;
    if (!b) return;
    this.deps.onGameFinished?.({
      id: `${room.code}-${this.now()}`,
      finishedAt: this.now(),
      series: game.series,
      players: [
        { id: a.id, name: a.name },
        { id: b.id, name: b.name },
      ],
      wins: game.wins,
      winner: game.winner,
      rounds: game.rounds.map((r) => r.points),
    });
  }

  private roomFor(playerId: string) {
    const code = this.roomOf.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  private seatOf(room: Room, playerId: string): PlayerIndex | null {
    if (room.seats[0].id === playerId) return 0;
    if (room.seats[1]?.id === playerId) return 1;
    return null;
  }

  private info(room: Room, you: PlayerIndex): RoomInfo {
    return {
      code: room.code,
      series: room.series,
      you,
      names: [room.seats[0].name, room.seats[1]?.name ?? null],
      connected: [this.online.has(room.seats[0].id), !!room.seats[1] && this.online.has(room.seats[1].id)],
      ready: room.ready,
      rematch: room.rematch,
    };
  }

  private toSeats(room: Room, msg: ServerMsg): Outgoing[] {
    return room.seats.filter((s): s is Seat => !!s).map((s) => ({ to: s.id, msg }));
  }

  private broadcastRoom(room: Room): Outgoing[] {
    return room.seats.flatMap((s, i) => (s ? [{ to: s.id, msg: { t: 'room', room: this.info(room, i as PlayerIndex) } as ServerMsg }] : []));
  }

  /** Ognuno riceve solo la propria vista: le carte dell'avversario non escono mai dal server. */
  private broadcastViews(room: Room): Outgoing[] {
    const game = room.game;
    if (!game) return [];
    return room.seats.flatMap((s, i) =>
      s ? [{ to: s.id, msg: { t: 'view', view: playerView(game, i as PlayerIndex) } as ServerMsg }] : [],
    );
  }

  private broadcastState(room: Room): Outgoing[] {
    return [...this.broadcastRoom(room), ...this.broadcastViews(room)];
  }

  private error(to: string, code: ErrorCode): Outgoing[] {
    return [{ to, msg: { t: 'error', code } }];
  }
}
