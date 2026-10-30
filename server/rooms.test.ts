import { describe, expect, it } from 'vitest';

import { type PlayerView, chooseBotMove, rng } from '../supabase/functions/_shared/scopa/index.ts';

import type { HistoryEntry, RoomInfo, ServerMsg } from './protocol.ts';
import { parseClientMsg } from './protocol.ts';
import { IDLE_ROOM_MS, Lobby, type Outgoing } from './rooms.ts';

function setup() {
  let now = 1_000;
  const finished: HistoryEntry[] = [];
  const lobby = new Lobby({
    random: rng(42),
    now: () => now,
    onGameFinished: (e) => finished.push(e),
    history: (id) => finished.filter((e) => e.players.some((p) => p.id === id)),
  });
  lobby.connect('anna', 'Anna');
  lobby.connect('bruno', 'Bruno');
  return { lobby, finished, tick: (ms: number) => (now += ms) };
}

const pick = <T extends ServerMsg['t']>(out: Outgoing[], to: string, t: T) =>
  out.filter((o) => o.to === to && o.msg.t === t).map((o) => o.msg as Extract<ServerMsg, { t: T }>);
const roomOf = (out: Outgoing[], to: string): RoomInfo => pick(out, to, 'room').at(-1)!.room;
const viewOf = (out: Outgoing[], to: string): PlayerView => pick(out, to, 'view').at(-1)!.view;

function startGame(lobby: Lobby) {
  const code = roomOf(lobby.handle('anna', { t: 'create', series: 10 }), 'anna').code;
  const out = lobby.handle('bruno', { t: 'join', code });
  return { code, out };
}

describe('stanze', () => {
  it('crea, entra e ognuno vede solo le proprie carte', () => {
    const { lobby } = setup();
    const created = lobby.handle('anna', { t: 'create', series: 15 });
    const room = roomOf(created, 'anna');
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(room.names).toEqual(['Anna', null]);
    expect(pick(created, 'anna', 'view')).toHaveLength(0);

    const joined = lobby.handle('bruno', { t: 'join', code: room.code });
    const va = viewOf(joined, 'anna');
    const vb = viewOf(joined, 'bruno');
    expect(va.you).toBe(0);
    expect(vb.you).toBe(1);
    expect(va.series).toBe(15);
    expect(va.hand.some((c) => vb.hand.includes(c))).toBe(false);
    expect(JSON.stringify(va)).not.toContain('"deck"');
    expect(roomOf(joined, 'bruno').names).toEqual(['Anna', 'Bruno']);
  });

  it('rifiuta il terzo giocatore e i codici sbagliati', () => {
    const { lobby } = setup();
    const { code } = startGame(lobby);
    lobby.connect('carlo', 'Carlo');
    expect(pick(lobby.handle('carlo', { t: 'join', code }), 'carlo', 'error')[0].code).toBe('room_full');
    expect(pick(lobby.handle('carlo', { t: 'join', code: 'ZZZZ' }), 'carlo', 'error')[0].code).toBe('room_not_found');
  });

  it('rifiuta mosse fuori turno o con moveNo vecchio', () => {
    const { lobby } = setup();
    const { out } = startGame(lobby);
    const va = viewOf(out, 'anna');
    const turnId = va.turn === 0 ? 'anna' : 'bruno';
    const waitId = turnId === 'anna' ? 'bruno' : 'anna';
    const waitView = viewOf(out, waitId);

    const wrong = lobby.handle(waitId, { t: 'play', card: waitView.hand[0], capture: [], moveNo: 0 });
    expect(pick(wrong, waitId, 'error')[0].code).toBe('not_your_turn');

    const view = viewOf(out, turnId);
    const move = chooseBotMove(view);
    const ok = lobby.handle(turnId, { t: 'play', ...move, moveNo: 0 });
    expect(viewOf(ok, waitId).moveNo).toBe(1);

    const again = lobby.handle(turnId, { t: 'play', ...move, moveNo: 0 });
    expect(pick(again, turnId, 'error')[0].code).toBe('stale_move');
  });

  it('chat: arriva a entrambi', () => {
    const { lobby } = setup();
    startGame(lobby);
    const out = lobby.handle('bruno', { t: 'chat', text: 'Ciao!' });
    expect(pick(out, 'anna', 'chat')[0].message).toMatchObject({ from: 1, name: 'Bruno', text: 'Ciao!' });
    expect(pick(out, 'bruno', 'chat')).toHaveLength(1);
  });

  it('"Continua": la partita successiva parte solo quando lo premono entrambi', () => {
    const { lobby } = setup();
    let { out } = startGame(lobby);
    const views: Record<string, PlayerView> = { anna: viewOf(out, 'anna'), bruno: viewOf(out, 'bruno') };
    while (views.anna.status === 'playing') {
      const id = views.anna.turn === 0 ? 'anna' : 'bruno';
      out = lobby.handle(id, { t: 'play', ...chooseBotMove(views[id]), moveNo: views[id].moveNo });
      views.anna = viewOf(out, 'anna');
      views.bruno = viewOf(out, 'bruno');
    }
    expect(views.anna).toMatchObject({ status: 'roundOver', roundNo: 1 });

    const first = lobby.handle('bruno', { t: 'continue' });
    expect(roomOf(first, 'anna').ready).toEqual([false, true]);
    expect(pick(first, 'anna', 'view')).toHaveLength(0);

    const both = lobby.handle('anna', { t: 'continue' });
    expect(viewOf(both, 'bruno')).toMatchObject({ status: 'playing', roundNo: 2 });
    expect(roomOf(both, 'bruno').ready).toEqual([false, false]);
    expect(pick(lobby.handle('anna', { t: 'continue' }), 'anna', 'error')[0].code).toBe('no_game');
  });

  it('serie intera, storico e rivincita con due voti', () => {
    const { lobby, finished } = setup();
    let { out } = startGame(lobby);
    const views: Record<string, PlayerView> = { anna: viewOf(out, 'anna'), bruno: viewOf(out, 'bruno') };

    while (views.anna.status !== 'finished') {
      if (views.anna.status === 'roundOver') {
        lobby.handle('anna', { t: 'continue' });
        out = lobby.handle('bruno', { t: 'continue' });
      } else {
        const id = views.anna.turn === 0 ? 'anna' : 'bruno';
        out = lobby.handle(id, { t: 'play', ...chooseBotMove(views[id]), moveNo: views[id].moveNo });
      }
      views.anna = viewOf(out, 'anna');
      views.bruno = viewOf(out, 'bruno');
    }
    expect(views.anna.rounds).toHaveLength(10);
    expect(finished).toHaveLength(1);
    expect(finished[0].players.map((p) => p.name)).toEqual(['Anna', 'Bruno']);
    expect(finished[0].series).toBe(10);
    expect(finished[0].rounds).toHaveLength(10);
    expect(finished[0].wins).toEqual(views.anna.wins);
    expect(pick(lobby.handle('anna', { t: 'history' }), 'anna', 'history')[0].games).toHaveLength(1);

    const vote = lobby.handle('anna', { t: 'rematch' });
    expect(roomOf(vote, 'bruno').rematch).toEqual([true, false]);
    expect(pick(vote, 'bruno', 'view')).toHaveLength(0);

    const both = lobby.handle('bruno', { t: 'rematch' });
    expect(viewOf(both, 'anna')).toMatchObject({ moveNo: 0, status: 'playing', wins: [0, 0], roundNo: 1 });
    expect(roomOf(both, 'anna').rematch).toEqual([false, false]);
  });

  it('riconnessione: rimanda stanza, vista e chat', () => {
    const { lobby } = setup();
    startGame(lobby);
    lobby.handle('anna', { t: 'chat', text: 'torno subito' });
    const gone = lobby.disconnect('bruno');
    expect(roomOf(gone, 'anna').connected).toEqual([true, false]);

    const back = lobby.connect('bruno', 'Bruno');
    expect(viewOf(back, 'bruno').you).toBe(1);
    expect(pick(back, 'bruno', 'chatLog')[0].messages[0].text).toBe('torno subito');
    expect(roomOf(back, 'anna').connected).toEqual([true, true]);
  });

  it("uscire chiude la stanza e avvisa l'avversario", () => {
    const { lobby } = setup();
    startGame(lobby);
    const out = lobby.handle('anna', { t: 'leave' });
    expect(pick(out, 'bruno', 'closed')[0].byOpponent).toBe(true);
    expect(pick(out, 'anna', 'closed')[0].byOpponent).toBe(false);
    expect(lobby.roomCount).toBe(0);
  });

  it('elimina le stanze abbandonate', () => {
    const { lobby, tick } = setup();
    startGame(lobby);
    lobby.disconnect('anna');
    lobby.disconnect('bruno');
    tick(IDLE_ROOM_MS - 1);
    lobby.sweep();
    expect(lobby.roomCount).toBe(1);
    tick(2);
    lobby.sweep();
    expect(lobby.roomCount).toBe(0);
  });
});

describe('protocollo', () => {
  it('scarta messaggi non validi', () => {
    expect(parseClientMsg(null)).toBeNull();
    expect(parseClientMsg({ t: 'create', series: 11 })).toBeNull();
    expect(parseClientMsg({ t: 'continue' })).toEqual({ t: 'continue' });
    expect(parseClientMsg({ t: 'play', card: '11D', capture: [], moveNo: 0 })).toBeNull();
    expect(parseClientMsg({ t: 'chat', text: '   ' })).toBeNull();
    expect(parseClientMsg({ t: 'chat', text: 'x'.repeat(501) })).toBeNull();
    expect(parseClientMsg({ t: 'join', code: ' abcd ' })).toEqual({ t: 'join', code: 'ABCD' });
    expect(parseClientMsg({ t: 'play', card: '7D', capture: ['3B', '4B'], moveNo: 3 })).toEqual({
      t: 'play',
      card: '7D',
      capture: ['3B', '4B'],
      moveNo: 3,
    });
  });
});
