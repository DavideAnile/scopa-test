import { type Card, type Rank, SETTEBELLO, SUITS, rankOf, suitOf } from './cards.ts';

export const PRIMIERA_VALUES: Record<Rank, number> = {
  7: 21,
  6: 18,
  1: 16,
  5: 15,
  4: 14,
  3: 13,
  2: 12,
  8: 10,
  9: 10,
  10: 10,
};

/** Primiera: la carta migliore per ogni seme. null se manca un seme. */
export function primiera(captured: readonly Card[]): number | null {
  let total = 0;
  for (const suit of SUITS) {
    const values = captured.filter((c) => suitOf(c) === suit).map((c) => PRIMIERA_VALUES[rankOf(c)]);
    if (values.length === 0) return null;
    total += Math.max(...values);
  }
  return total;
}

export type Pair<T> = [T, T];

export interface PlayerRoundStats {
  cards: number;
  denari: number;
  settebello: boolean;
  primiera: number | null;
  scope: number;
}

export interface RoundResult {
  stats: Pair<PlayerRoundStats>;
  /** Chi ha vinto ciascun punto: indice del giocatore o null se pari. */
  winners: {
    cards: 0 | 1 | null;
    denari: 0 | 1 | null;
    settebello: 0 | 1 | null;
    primiera: 0 | 1 | null;
  };
  points: Pair<number>;
  /** Chi ha vinto la partita (smazzata): più punti; null se pari. */
  winner: 0 | 1 | null;
}

function higher(a: number, b: number): 0 | 1 | null {
  if (a === b) return null;
  return a > b ? 0 : 1;
}

export function scoreRound(captured: Pair<readonly Card[]>, scope: Pair<number>): RoundResult {
  const stats = captured.map((cards, i) => ({
    cards: cards.length,
    denari: cards.filter((c) => suitOf(c) === 'D').length,
    settebello: cards.includes(SETTEBELLO),
    primiera: primiera(cards),
    scope: scope[i],
  })) as Pair<PlayerRoundStats>;

  const [p0, p1] = stats;
  let primieraWinner: 0 | 1 | null;
  if (p0.primiera !== null && p1.primiera !== null) primieraWinner = higher(p0.primiera, p1.primiera);
  else if (p0.primiera !== null) primieraWinner = 0;
  else if (p1.primiera !== null) primieraWinner = 1;
  else primieraWinner = null;

  const winners: RoundResult['winners'] = {
    cards: higher(p0.cards, p1.cards),
    denari: higher(p0.denari, p1.denari),
    settebello: p0.settebello ? 0 : p1.settebello ? 1 : null,
    primiera: primieraWinner,
  };

  const points: Pair<number> = [p0.scope, p1.scope];
  for (const w of Object.values(winners)) if (w !== null) points[w]++;

  return { stats, winners, points, winner: higher(points[0], points[1]) };
}
