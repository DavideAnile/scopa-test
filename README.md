# Scopa

App iPhone (Expo / React Native) per giocare a scopa 1v1: contro il computer oppure con un amico, con chat, rivincite e storico. Senza pubblicità.

## Avvio

Serve Node 22 o superiore (`.node-version`; con fnm: `fnm use`).

```bash
npm install
npx expo start      # poi inquadra il QR con la fotocamera dell'iPhone (serve l'app Expo Go)
npm test            # test del motore, delle animazioni e del server
npm run typecheck
npx expo lint
```

## Server online su Render (link fisso, Mac spento)

Il file [render.yaml](render.yaml) descrive il servizio: un unico server gratuito che fa da arbitro delle partite e serve la versione web dell'app.

Prima volta:
1. Su [render.com](https://render.com) crea un account (puoi entrare con GitHub).
2. **New → Blueprint**, scegli il repository `scopa-test` e conferma. Render installa, costruisce e avvia in qualche minuto.
3. Il link sarà tipo `https://scopa-xxxx.onrender.com`. Aprilo con Safari e fai **Condividi → Aggiungi a schermata Home**: si apre a schermo intero come un'app.

Aggiornare: ogni `git push` su `main` ripubblica il sito da solo.

Limiti del piano gratuito:
- dopo 15 minuti senza giocatori il server si addormenta, e la prima apertura richiede circa 1 minuto (compare "Caricamento…");
- lo storico si azzera quando il server si riavvia o si addormenta;
- se Render riavvia il server durante una partita (capita di rado), quella partita si perde.

## Giocare con un amico (server sul Mac)

Non serve l'App Store: il Mac fa da server. **L'amico gioca da Safari**, senza installare niente e senza account. Tu puoi usare Expo Go oppure lo stesso link.

Da fare una volta sola sul Mac: `brew install cloudflared`

Ogni volta che volete giocare:

```bash
fnm use
npm run party            # l'amico può essere ovunque (tunnel internet)
npm run party -- --lan   # oppure: siete sulla stessa rete Wi-Fi
```

1. Lo script prepara la versione web (circa 30 secondi) e stampa il **link per l'amico** (`https://….trycloudflare.com`).
2. Tu apri l'app: inquadra il QR con la Fotocamera (Expo Go, con lo stesso account Expo del Mac: `npx expo whoami`) oppure apri anche tu il link in Safari.
3. **Gioca online**: scegli il nome, poi **Serie da 10** o **Serie da 15**, poi **Invita un amico**. Gli arriva un link che apre la partita con il codice già inserito: scrive il nome e tocca **Entra**.
4. Il Mac deve restare acceso finché giocate (lo script lo tiene sveglio). **Ctrl+C** chiude tutto.

Perché l'amico non usa Expo Go: quando apre un progetto da un tunnel internet, Expo Go vuole che il telefono abbia lo stesso account Expo del Mac. La versione web non ha questo vincolo.

Il link cambia a ogni avvio. Lo storico delle partite resta salvato sul Mac in `server/data/history.json`.
Opzioni: `--skip-web` riusa la versione web già generata (parte prima), `--dev` ricarica Expo mentre modifichi il codice.

Altri comandi:
- `npm run server`: solo il server di gioco (porta 8787; serve anche `dist-web` se esiste)
- `npm run server:smoke`: con il server avviato, due client finti giocano una partita intera

## Struttura

- `src/app/`: schermate (Expo Router). `game/local` è la partita contro il computer, `online/*` quella con un amico.
- `src/components/`: tavolo animato (`board.tsx`), carte, riepilogo della smazzata, chat
- `src/game/`: le "scene" che trasformano le mosse in animazioni
- `src/online/`: client WebSocket e identità del giocatore
- `server/`: server di gioco (WebSocket). Stanze, chat, rivincite e storico. Le mosse le valida il server.
- `supabase/functions/_shared/scopa/`: **motore di gioco** in TypeScript puro (regole, punteggio, bot). Lo usano l'app (import `@scopa`), il server locale e, in futuro, un backend Supabase.
- `assets/cards/`: carte napoletane, di pubblico dominio (vedi `CREDITS.txt`)

## Regole implementate

- Mazzo napoletano da 40 carte. Si danno 3 carte a testa e 4 in tavola; inizia chi non ha distribuito.
- Se in tavola c'è una carta dello stesso valore, si è obbligati a prendere quella. Altrimenti si prende per somma. Se ci sono più prese possibili, l'app sceglie la migliore; per scegliere tu, tocca prima le carte del tavolo da prendere.
- Scopa quando si svuota il tavolo, tranne con l'ultima giocata della smazzata.
- A fine smazzata le carte rimaste in tavola vanno all'ultimo che ha preso.
- Punti: carte, denari, settebello, primiera (7=21, 6=18, A=16, 5=15, 4=14, 3=13, 2=12, figure=10) e scope. In caso di parità il punto non va a nessuno.
- Si gioca una **serie di 10 o 15 partite**. Una partita è una smazzata: si giocano tutte le 40 carte e la vince chi fa più punti (a punti pari è pareggio).
- A fine partita c'è il riepilogo: la successiva parte quando **entrambi** premono **Continua**. Vince la serie chi ha vinto più partite.
- Se una partita la vince il giocatore "Davide", sugli schermi di tutti e due compare "Amore sei scarsa ma ti amo lo stesso" 💕.
