// Avvia tutto per giocare con un amico: versione web, server di gioco, tunnel internet ed Expo.
//   npm run party              amico ovunque (tunnel cloudflared)
//   npm run party -- --lan     amico sulla stessa rete Wi-Fi (niente tunnel)
//   --skip-web                 riusa la versione web già generata (parte prima)
//   --dev                      Expo con ricaricamento automatico mentre modifichi il codice
//
// L'amico gioca da Safari con un link https://…: niente da installare, nessun account.
// Tu puoi usare Expo Go (con il tuo account Expo, lo stesso del Mac) oppure lo stesso link.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';

const PORT = 8787;
const lan = process.argv.includes('--lan');
const dev = process.argv.includes('--dev');
const skipWeb = process.argv.includes('--skip-web');
const children = [];

function run(cmd, args, { env = {}, pipe = false } = {}) {
  const child = spawn(cmd, args, {
    stdio: pipe ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) c.kill('SIGTERM');
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  throw new Error('Nessuna rete trovata: sei collegato al Wi-Fi?');
}

function startTunnel() {
  if (spawnSync('which', ['cloudflared']).status !== 0) {
    console.error('\n❌ Manca cloudflared. Installalo una volta con:  brew install cloudflared\n');
    shutdown(1);
  }
  // http2 invece di QUIC (UDP): su molte reti di casa QUIC è lento o viene bloccato a metà.
  const cf = run('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], {
    pipe: true,
    env: { TUNNEL_TRANSPORT_PROTOCOL: 'http2' },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Il tunnel non è partito entro 40 secondi.')), 40_000);
    const scan = (chunk) => {
      const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    cf.stdout.on('data', scan);
    cf.stderr.on('data', scan);
    cf.on('exit', (code) => reject(new Error(`cloudflared si è chiuso (codice ${code}).`)));
  });
}

// 1. Versione web dell'app, servita dal server di gioco.
if (!skipWeb || !existsSync('dist-web/index.html')) {
  console.log('🛠   Preparo la versione web dell\'app (circa 30 secondi)…');
  const build = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-web'], {
    encoding: 'utf8',
    env: { ...process.env, SCOPA_SERVER: '' },
  });
  if (build.status !== 0) {
    console.error(build.stdout, build.stderr, '\n❌ Non sono riuscito a generare la versione web.');
    process.exit(1);
  }
}

// 2. Il Mac non va in stop finché questo script è attivo.
run('caffeinate', ['-i', '-w', String(process.pid)]);

// 3. Server di gioco (WebSocket + pagine web) e tunnel.
const server = run(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'server/index.ts'], {
  env: { PORT: String(PORT) },
});
server.on('exit', (code) => {
  console.error(`\n❌ Il server di gioco si è fermato (codice ${code}).`);
  shutdown(1);
});

let webUrl;
try {
  webUrl = lan ? `http://${lanAddress()}:${PORT}` : await startTunnel();
} catch (e) {
  console.error(`\n❌ ${e.message}`);
  shutdown(1);
}
const wsUrl = webUrl.replace(/^http/, 'ws');

console.log(`
──────────────────────────────────────────────────────────────
 🃏  LINK PER L'AMICO (da aprire con Safari, niente da installare):

     ${webUrl}

     Oppure dall'app: crea la partita e tocca "Invita un amico".
     ${lan ? '📶 Modalità Wi-Fi: dovete essere sulla stessa rete.' : '🌍 Modalità internet: il tuo amico può essere ovunque.'}

 📱  PER TE: inquadra il QR qui sotto con la Fotocamera (Expo Go,
     con lo stesso account Expo del Mac), oppure apri anche tu il link.
 ⏹   Ctrl+C per chiudere tutto.
──────────────────────────────────────────────────────────────
`);

// 4. Expo per chi usa Expo Go (il tunnel di Expo richiede l'account Expo, già collegato sul Mac).
const expoArgs = ['expo', 'start', lan ? '--lan' : '--tunnel'];
if (!dev) expoArgs.push('--no-dev', '--minify');
const expo = run('npx', expoArgs, { env: { SCOPA_SERVER: wsUrl } });
expo.on('exit', (code) => shutdown(code ?? 0));
