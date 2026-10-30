import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { GameTable } from '@/components/game-table';
import { RoundSummary } from '@/components/round-summary';
import { useTableScene } from '@/game/use-table-scene';
import { loadIdentity } from '@/online/identity';
import {
  type Card,
  type Pair,
  type PlayerIndex,
  type SeriesLength,
  applyMove,
  chooseBotMove,
  newGame,
  nextRound,
  playerView,
} from '@scopa';

const HUMAN: PlayerIndex = 0;
const BOT: PlayerIndex = 1;
const BOT_DELAY_MS = 600;

function freshGame(series: SeriesLength) {
  return newGame({
    seed: Math.floor(Math.random() * 2 ** 32),
    series,
    dealer: Math.random() < 0.5 ? 0 : 1,
  });
}

export default function LocalGameScreen() {
  const params = useLocalSearchParams<{ series?: string }>();
  const series: SeriesLength = params.series === '15' ? 15 : 10;

  const [state, setState] = useState(() => freshGame(series));
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
        onRematch={() => setState(freshGame(series))}
        onExit={() => router.back()}
      />
    </>
  );
}
