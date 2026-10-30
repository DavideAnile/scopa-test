import { type Card, rankOf } from './cards.ts';

/**
 * Tutte le prese possibili giocando `card` sul tavolo.
 * - Se in tavola c'è una carta dello stesso valore, si può prendere solo quella
 *   (una alla volta: se ce ne sono più di una, il giocatore sceglie quale).
 * - Altrimenti, ogni combinazione di carte la cui somma è uguale al valore.
 * Lista vuota = la carta viene calata in tavola.
 */
export function legalCaptures(card: Card, table: readonly Card[]): Card[][] {
  const value = rankOf(card);

  const sameRank = table.filter((c) => rankOf(c) === value);
  if (sameRank.length > 0) return sameRank.map((c) => [c]);

  const result: Card[][] = [];
  const pick = (start: number, remaining: number, chosen: Card[]) => {
    if (remaining === 0) {
      if (chosen.length >= 2) result.push([...chosen]);
      return;
    }
    for (let i = start; i < table.length; i++) {
      const r = rankOf(table[i]);
      if (r <= remaining) {
        chosen.push(table[i]);
        pick(i + 1, remaining - r, chosen);
        chosen.pop();
      }
    }
  };
  pick(0, value, []);
  return result;
}

export function sameCards(a: readonly Card[], b: readonly Card[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((c, i) => c === sb[i]);
}

/** Restituisce la presa legale corrispondente a `capture`, o null se non è valida. */
export function matchCapture(card: Card, table: readonly Card[], capture: readonly Card[]): Card[] | null {
  const options = legalCaptures(card, table);
  if (options.length === 0) return capture.length === 0 ? [] : null;
  // Se si può prendere, si è obbligati a prendere.
  return options.find((o) => sameCards(o, capture)) ?? null;
}
