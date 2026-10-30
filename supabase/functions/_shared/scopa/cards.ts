// Mazzo napoletano da 40 carte. Ogni carta è una stringa "<valore><seme>",
// es. "7D" = settebello, "10B" = re di bastoni. Facile da salvare in JSON.

export const SUITS = ['D', 'C', 'S', 'B'] as const; // Denari, Coppe, Spade, Bastoni
export type Suit = (typeof SUITS)[number];

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const; // 8 Fante, 9 Cavallo, 10 Re
export type Rank = (typeof RANKS)[number];

export type Card = `${Rank}${Suit}`;

export const SETTEBELLO: Card = '7D';

export const SUIT_NAMES: Record<Suit, string> = {
  D: 'Denari',
  C: 'Coppe',
  S: 'Spade',
  B: 'Bastoni',
};

export const RANK_NAMES: Record<Rank, string> = {
  1: 'Asso',
  2: 'Due',
  3: 'Tre',
  4: 'Quattro',
  5: 'Cinque',
  6: 'Sei',
  7: 'Sette',
  8: 'Fante',
  9: 'Cavallo',
  10: 'Re',
};

export function rankOf(card: Card): Rank {
  return Number(card.slice(0, -1)) as Rank;
}

export function suitOf(card: Card): Suit {
  return card.slice(-1) as Suit;
}

export function cardName(card: Card): string {
  return `${RANK_NAMES[rankOf(card)]} di ${SUIT_NAMES[suitOf(card)]}`;
}

export function isCard(value: unknown): value is Card {
  return typeof value === 'string' && FULL_DECK.includes(value as Card);
}

export const FULL_DECK: readonly Card[] = SUITS.flatMap((s) => RANKS.map((r) => `${r}${s}` as Card));

/** PRNG deterministico (mulberry32): stesso seed, stesso mazzo. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledDeck(seed: number): Card[] {
  const random = rng(seed);
  const deck = [...FULL_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
