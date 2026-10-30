// Prova del server vero: due client WebSocket giocano una partita intera col bot.
// Uso: npm run server (in un altro terminale), poi npm run server:smoke [ws://host:porta]

import { WebSocket } from 'ws';

import { type PlayerView, chooseBotMove } from '../supabase/functions/_shared/scopa/index.ts';

import type { ClientMsg, ServerMsg } from './protocol.ts';

const URL = process.argv[2] ?? 'ws://localhost:8787';

function client(name: string) {
  const ws = new WebSocket(URL);
  const inbox: ServerMsg[] = [];
  const waiters: { test: (m: ServerMsg) => boolean; resolve: (m: ServerMsg) => void }[] = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMsg;
    inbox.push(msg);
    const i = waiters.findIndex((w) => w.test(msg));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
  });
  const opened = new Promise((r) => ws.once('open', r));
  return {
    inbox,
    async send(msg: ClientMsg) {
      await opened;
      ws.send(JSON.stringify(msg));
    },
    next<T extends ServerMsg>(test: (m: ServerMsg) => boolean): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name}: timeout`)), 5000);
        waiters.push({ test, resolve: (m) => (clearTimeout(timer), resolve(m as T)) });
      });
    },
    close: () => ws.close(),
  };
}

const stamp = Date.now().toString(36);
const anna = client('anna');
const bruno = client('bruno');
await anna.send({ t: 'hello', playerId: `smoke-anna-${stamp}`, name: 'Anna' });
await bruno.send({ t: 'hello', playerId: `smoke-bruno-${stamp}`, name: 'Bruno' });

const created = anna.next<Extract<ServerMsg, { t: 'room' }>>((m) => m.t === 'room');
await anna.send({ t: 'create', series: 10 });
const { code } = (await created).room;
console.log('stanza', code);

const players = { anna, bruno };
const views: Record<'anna' | 'bruno', PlayerView> = {} as never;
const waitView = (who: 'anna' | 'bruno', moveNo: number) =>
  players[who].next<Extract<ServerMsg, { t: 'view' }>>((m) => m.t === 'view' && m.view.moveNo === moveNo).then((m) => (views[who] = m.view));

let pending = [waitView('anna', 0), waitView('bruno', 0)];
await bruno.send({ t: 'join', code });
await Promise.all(pending);

const chat = anna.next((m) => m.t === 'chat');
await bruno.send({ t: 'chat', text: 'In bocca al lupo!' });
console.log('chat ricevuta:', ((await chat) as Extract<ServerMsg, { t: 'chat' }>).message.text);

while (views.anna.status !== 'finished') {
  if (views.anna.status === 'roundOver') {
    // Entrambi premono "Continua": la vista successiva ha lo stesso moveNo e la partita dopo.
    const round = views.anna.roundNo + 1;
    const next = (who: 'anna' | 'bruno') =>
      players[who].next<Extract<ServerMsg, { t: 'view' }>>((m) => m.t === 'view' && m.view.roundNo === round).then((m) => (views[who] = m.view));
    pending = [next('anna'), next('bruno')];
    await anna.send({ t: 'continue' });
    await bruno.send({ t: 'continue' });
    await Promise.all(pending);
    continue;
  }
  const who = views.anna.turn === 0 ? 'anna' : 'bruno';
  const move = chooseBotMove(views[who]);
  const n = views.anna.moveNo + 1;
  pending = [waitView('anna', n), waitView('bruno', n)];
  await players[who].send({ t: 'play', ...move, moveNo: views[who].moveNo });
  await Promise.all(pending);
}
console.log(`serie finita dopo ${views.anna.rounds.length} partite: ${views.anna.wins.join(' - ')}`);

const hist = anna.next<Extract<ServerMsg, { t: 'history' }>>((m) => m.t === 'history');
await anna.send({ t: 'history' });
const games = (await hist).games;
console.log('nello storico:', games[0]?.players.map((p) => p.name).join(' vs '), games[0]?.wins.join('-'));

pending = [waitView('anna', 0), waitView('bruno', 0)];
await anna.send({ t: 'rematch' });
await bruno.send({ t: 'rematch' });
await Promise.all(pending);
console.log('rivincita partita ✓');

const errors = [...anna.inbox, ...bruno.inbox].filter((m) => m.t === 'error');
anna.close();
bruno.close();
if (errors.length) {
  console.error('errori:', errors);
  process.exit(1);
}
console.log('OK');
