// Server di gioco: WebSocket sulla porta PORT (default 8787). Avvio: npm run server
// Sulla stessa porta serve anche la versione web dell'app (dist-web), se è stata generata.
// Le stanze vivono in memoria; lo storico delle partite finisce in server/data/history.json.

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { WebSocket, WebSocketServer } from 'ws';

import { HistoryStore } from './history.ts';
import { type ServerMsg, parseClientMsg } from './protocol.ts';
import { Lobby, type Outgoing } from './rooms.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PING_MS = 15_000;
const SWEEP_MS = 5 * 60_000;

const history = new HistoryStore(fileURLToPath(new URL('./data/history.json', import.meta.url)));
const lobby = new Lobby({
  onGameFinished: (entry) => history.add(entry),
  history: (playerId) => history.forPlayer(playerId),
});

const sockets = new Map<string, WebSocket>();
const alive = new WeakSet<WebSocket>();

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function deliver(out: Outgoing[]) {
  for (const { to, msg } of out) {
    const ws = sockets.get(to);
    if (ws) send(ws, msg);
  }
}

// Versione web dell'app (npx expo export --platform web --output-dir dist-web), per chi gioca da Safari.
const WEB_DIR = resolve(fileURLToPath(new URL('../dist-web', import.meta.url)));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

// Il codice dell'app è ~2 MB: compresso diventa ~0,5 MB (conta molto attraverso il tunnel).
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);
const gzipCache = new Map<string, { mtime: number; body: Buffer }>();

function gzipped(file: string): Buffer {
  const mtime = statSync(file).mtimeMs;
  const cached = gzipCache.get(file);
  if (cached?.mtime === mtime) return cached.body;
  const body = gzipSync(readFileSync(file));
  gzipCache.set(file, { mtime, body });
  return body;
}

const http = createServer((req, res) => {
  // Dietro un proxy https (Render, tunnel Cloudflare) chi apre il link in http viene portato su https
  // (pagina sicura, WebSocket wss). In rete locale (--lan) l'header non c'è e non cambia nulla.
  const host = req.headers.host ?? '';
  if (req.headers['x-forwarded-proto'] === 'http' && host) {
    res.writeHead(301, { location: `https://${host}${req.url ?? '/'}` });
    res.end();
    return;
  }

  // Controllo leggero per Render e per il ping che tiene sveglio il server (UptimeRobot).
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('ok');
    return;
  }

  let path = '/';
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    // URL malformato: si serve la pagina principale.
  }
  const index = join(WEB_DIR, 'index.html');
  if (!existsSync(index)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Server di scopa attivo. Stanze aperte: ${lobby.roomCount}\n`);
    return;
  }
  // I file esistenti si servono così come sono; tutto il resto è una pagina dell'app (index.html).
  const file = resolve(join(WEB_DIR, path));
  const inside = file.startsWith(WEB_DIR + sep);
  const target = inside && existsSync(file) && statSync(file).isFile() ? file : index;
  // I file con l'hash nel nome non cambiano mai: il browser può tenerli per sempre.
  const hashed = /[.-][0-9a-f]{32}\.\w+$/.test(target);
  const headers: Record<string, string | number> = {
    'content-type': TYPES[extname(target)] ?? 'application/octet-stream',
    'cache-control': target === index ? 'no-cache' : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    vary: 'accept-encoding',
  };
  if (COMPRESSIBLE.has(extname(target)) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
    const body = gzipped(target);
    res.writeHead(200, { ...headers, 'content-encoding': 'gzip', 'content-length': body.length });
    res.end(body);
    return;
  }
  res.writeHead(200, headers);
  createReadStream(target).pipe(res);
});

const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  let playerId: string | null = null;
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));

  ws.on('message', (data) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      raw = null;
    }
    const msg = parseClientMsg(raw);
    if (!msg) return send(ws, { t: 'error', code: 'bad_message' });

    if (msg.t === 'hello') {
      // Lo stesso giocatore da un'altra connessione (es. app riaperta): vince l'ultima.
      const previous = sockets.get(msg.playerId);
      if (previous && previous !== ws) previous.close(4000, 'replaced');
      playerId = msg.playerId;
      sockets.set(playerId, ws);
    }
    if (!playerId) return send(ws, { t: 'error', code: 'not_ready' });
    deliver(lobby.handle(playerId, msg));
  });

  ws.on('close', () => {
    if (playerId && sockets.get(playerId) === ws) {
      sockets.delete(playerId);
      deliver(lobby.disconnect(playerId));
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, PING_MS);

setInterval(() => lobby.sweep(), SWEEP_MS);

http.listen(PORT, () => console.log(`🃏 Server di scopa in ascolto sulla porta ${PORT}`));
