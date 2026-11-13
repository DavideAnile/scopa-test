import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { RequireAuth } from '@/components/require-auth';
import { GameTable } from '@/components/game-table';
import { RoundSummary } from '@/components/round-summary';
import { useTableScene } from '@/game/use-table-scene';
import { loadIdentity } from '@/online/identity';
import {
  type Card,
  type Pair,
  type PlayerIndex,
  SERIES_LENGTH,
  applyMove,
  chooseBotMove,
  newGame,
  nextRound,
  playerView,
} from '@scopa';

const HUMAN: PlayerIndex = 0;
const BOT: PlayerIndex = 1;
const BOT_DELAY_MS = 600;

/** `seed` e `dealer` fissi (dall'indirizzo, es. ?seed=42&dealer=1) servono solo per provare casi precisi. */
function freshGame(fixed?: { seed?: number; dealer?: PlayerIndex }) {
  return newGame({
    seed: fixed?.seed ?? Math.floor(Math.random() * 2 ** 32),
    series: SERIES_LENGTH,
    dealer: fixed?.dealer ?? (Math.random() < 0.5 ? 0 : 1),
  });
}

export default function LocalGameScreen() {
  return (
    <RequireAuth>
      <LocalGame />
    </RequireAuth>
  );
}

function LocalGame() {
  const params = useLocalSearchParams<{ seed?: string; dealer?: string }>();
  const [state, setState] = useState(() =>
    freshGame({
      seed: params.seed ? Number(params.seed) : undefined,
      dealer: params.dealer === '0' || params.dealer === '1' ? (Number(params.dealer) as PlayerIndex) : undefined,
    }),
  );
  const view = playerView(state, HUMAN);
  const { scene, shown, busy } = useTableScene(view);

  // Il nome scelto per il gioco online (se c'è), così anche qui compare "Davide".
  const [myName, setMyName] = useState('Tu');
  useEffect(() => {
    loadIdentity().then((id) => id.name && setMyName(id.name));
  }, []);
  const names: Pair<string> = [myName, 'Computer'];

  useEffect(() => {
    if (state.status !== 'playing' || state.turn !== BOT || busy) return;
    const timer = setTimeout(() => {
      setState((s) => {
        if (s.turn !== BOT || s.status !== 'playing') return s;
        const move = chooseBotMove(playerView(s, BOT));
        return applyMove(s, BOT, move.card, move.capture);
      });
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, busy]);

  // Il tavolo blocca già i tocchi durante le animazioni; il controllo sul turno evita doppi invii.
  const play = (card: Card, capture: Card[]) =>
    setState((s) => (s.turn === HUMAN && s.hands[HUMAN].includes(card) ? applyMove(s, HUMAN, card, capture) : s));

  return (
    <>
      <GameTable
        view={view}
        scene={scene}
        shown={shown}
        busy={busy}
        names={names}
        onPlay={play}
        onExit={() => router.back()}
      />
      <RoundSummary
        visible={!busy && shown.status !== 'playing'}
        view={shown}
        names={names}
        onContinue={() => setState(nextRound)}
        onRematch={() => setState(freshGame())}
        onExit={() => router.back()}
      />
    </>
  );
}
