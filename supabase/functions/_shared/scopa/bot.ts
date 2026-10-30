import { type Card, SETTEBELLO, rankOf, suitOf } from './cards.ts';
import type { PlayerView } from './game.ts';
import { legalCaptures } from './rules.ts';

export interface Move {
  card: Card;
  capture: Card[];
}

/** Quanto "vale" tenersi una carta (per scegliere cosa calare). */
function keepValue(card: Card): number {
  if (card === SETTEBELLO) return 40;
  let v = 0;
  if (suitOf(card) === 'D') v += 3;
  const r = rankOf(card);
  if (r === 7) v += 6;
  else if (r === 6) v += 3;
  else if (r === 1) v += 2;
  return v;
}

function captureValue(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + 1 + keepValue(c), 0);
}

/** Fra più prese possibili, quella che conviene di più (usata anche per il giocatore umano). */
export function bestCapture(card: Card, options: Card[][]): Card[] {
  let best = options[0] ?? [];
  for (const o of options) if (captureValue([card, ...o]) > captureValue([card, ...best])) best = o;
  return best;
}

/** Bot semplice ed euristico: vede solo quello che vedrebbe un giocatore. */
export function chooseBotMove(view: PlayerView): Move {
  const { hand, table } = view;
  const lastPlay = view.deckCount === 0 && view.handCounts[0] + view.handCounts[1] === 1;
  let best: Move | null = null;
  let bestScore = -Infinity;

  for (const card of hand) {
    const options = legalCaptures(card, table);
    if (options.length > 0) {
      for (const capture of options) {
        let score = 20 + captureValue([card, ...capture]);
        if (capture.length === table.length && !lastPlay) score += 60;
        if (score > bestScore) [best, bestScore] = [{ card, capture }, score];
      }
    } else {
      let score = -keepValue(card);
      const tableSum = table.reduce((s, c) => s + rankOf(c), 0) + rankOf(card);
      if (tableSum <= 10) score -= 15; // l'avversario potrebbe fare scopa
      if (rankOf(card) >= 8) score += 1;
      if (score > bestScore) [best, bestScore] = [{ card, capture: [] }, score];
    }
  }

  if (!best) throw new Error('Nessuna carta in mano');
  return best;
}
