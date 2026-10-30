// Trasforma lo stato di gioco in "scene" da animare: per ogni carta visibile dice dove deve stare.
// Una mossa diventa una sequenza di scene (carta che vola sul tavolo, presa che si riunisce,
// presa che va nel mazzetto, nuova distribuzione); il tavolo anima il passaggio fra una scena e l'altra.

import { type Card, type Pair, type PlayerIndex, type PlayerView, other } from '@scopa';

export type Spot =
  | { kind: 'hand'; index: number; count: number }
  | { kind: 'opp'; index: number; count: number }
  | { kind: 'table'; index: number; count: number }
  /** Impilata sulla carta in posizione `index` del tavolo (per riunire la presa). */
  | { kind: 'stack'; index: number; count: number; offset: number }
  /** Nel mazzetto di `owner`; con `scopa` la carta va di traverso, scoperta. */
  | { kind: 'pile'; owner: PlayerIndex; scopa?: number }
  | { kind: 'deck' };

export interface Sprite {
  id: string;
  /** null = carta coperta dell'avversario, di cui non conosciamo il valore. */
  card: Card | null;
  spot: Spot;
  faceUp: boolean;
  z: number;
  /** Da dove parte quando compare per la prima volta. */
  from?: Spot;
  fromFaceUp?: boolean;
  delay?: number;
  duration?: number;
}

export interface PileInfo {
  count: number;
  scope: Card[];
}

export interface Scene {
  you: PlayerIndex;
  sprites: Sprite[];
  piles: Pair<PileInfo>;
  deckCount: number;
  banner: { key: string; text: string } | null;
}

export interface Step {
  scene: Scene;
  hold: number;
  /** Da questo passo in poi la vista "mostrata" (punteggi, riepilogo) è questa. */
  view?: PlayerView;
}

export const TIMING = {
  fly: 380,
  gather: 260,
  toPile: 420,
  deal: 300,
  dealStagger: 110,
  pause: 160,
  scopaPause: 650,
} as const;

const handSprites = (hand: readonly Card[]): Sprite[] =>
  hand.map((card, index) => ({
    id: card,
    card,
    spot: { kind: 'hand', index, count: hand.length },
    faceUp: true,
    z: 300 + index,
  }));

const oppSprites = (count: number): Sprite[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `opp-${index}`,
    card: null,
    spot: { kind: 'opp', index, count },
    faceUp: false,
    z: 300 + index,
  }));

const tableSprites = (table: readonly Card[], count = table.length): Sprite[] =>
  table.map((card, index) => ({
    id: card,
    card,
    spot: { kind: 'table', index, count },
    faceUp: true,
    z: 100 + index,
  }));

const pilesOf = (view: PlayerView): Pair<PileInfo> => [
  { count: view.capturedCounts[0], scope: view.scopeCards[0] },
  { count: view.capturedCounts[1], scope: view.scopeCards[1] },
];

/** Scena "ferma": tutto al suo posto. */
export function restScene(view: PlayerView): Scene {
  return {
    you: view.you,
    sprites: [...tableSprites(view.table), ...oppSprites(view.handCounts[other(view.you)]), ...handSprites(view.hand)],
    piles: pilesOf(view),
    deckCount: view.deckCount,
    banner: null,
  };
}

/** Distribuzione a inizio smazzata: tavolo e mani escono dal mazzo una carta alla volta. */
export function dealRoundSteps(view: PlayerView): Step[] {
  const opp = other(view.you);
  const fromDeck = (s: Sprite, i: number): Sprite => ({
    ...s,
    from: { kind: 'deck' },
    fromFaceUp: false,
    delay: i * TIMING.dealStagger,
    duration: TIMING.deal,
  });
  // Ordine reale: prima le mani (alternate, parte il non-mazziere), poi il tavolo.
  const mine = handSprites(view.hand);
  const theirs = oppSprites(view.handCounts[opp]);
  const firstMine = view.dealer !== view.you;
  const hands: Sprite[] = [];
  for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
    const pair = firstMine ? [mine[i], theirs[i]] : [theirs[i], mine[i]];
    hands.push(...pair.filter(Boolean));
  }
  const ordered = [...hands, ...tableSprites(view.table)].map(fromDeck);
  const scene: Scene = { ...restScene(view), sprites: ordered, deckCount: view.deckCount };
  return [
    { scene, hold: ordered.length * TIMING.dealStagger + TIMING.deal },
    { scene: restScene(view), hold: 0, view },
  ];
}

/** Nuove 3 carte a testa a metà smazzata. */
function dealHandsStep(base: Scene, view: PlayerView): Step {
  const opp = other(view.you);
  const mine = handSprites(view.hand);
  const theirs = oppSprites(view.handCounts[opp]);
  const firstMine = view.dealer !== view.you;
  const dealt: Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const pair = firstMine ? [mine[i], theirs[i]] : [theirs[i], mine[i]];
    dealt.push(...pair.filter(Boolean));
  }
  const sprites = dealt.map((s, i) => ({
    ...s,
    from: { kind: 'deck' } as Spot,
    fromFaceUp: false,
    delay: i * TIMING.dealStagger,
    duration: TIMING.deal,
  }));
  return {
    scene: { ...base, sprites: [...base.sprites.filter((s) => s.spot.kind === 'table'), ...sprites], deckCount: view.deckCount },
    hold: sprites.length * TIMING.dealStagger + TIMING.deal,
  };
}

/** I passi per animare la mossa che porta da `prev` a `next` (next.moveNo === prev.moveNo + 1). */
export function moveSteps(prev: PlayerView, next: PlayerView): Step[] {
  const move = next.lastMove;
  if (!move) return [{ scene: restScene(next), hold: 0, view: next }];

  const me = prev.you;
  const opp = other(me);
  const player = move.player;
  const { card, captured } = move;
  const steps: Step[] = [];
  const piles: Pair<PileInfo> = [
    { count: prev.capturedCounts[0], scope: [...prev.scopeCards[0]] },
    { count: prev.capturedCounts[1], scope: [...prev.scopeCards[1]] },
  ];

  // Mano e carte coperte dopo aver giocato.
  const handAfter = player === me ? prev.hand.filter((c) => c !== card) : prev.hand;
  const oppCountAfter = prev.handCounts[opp] - (player === opp ? 1 : 0);
  const from: Spot =
    player === me
      ? { kind: 'hand', index: prev.hand.indexOf(card), count: prev.hand.length }
      : { kind: 'opp', index: prev.handCounts[opp] - 1, count: prev.handCounts[opp] };
  const hands = [...oppSprites(oppCountAfter), ...handSprites(handAfter)];
  const scene = (sprites: Sprite[], banner: Scene['banner'] = null): Scene => ({
    you: me,
    sprites,
    piles: [{ ...piles[0], scope: [...piles[0].scope] }, { ...piles[1], scope: [...piles[1].scope] }],
    deckCount: prev.deckCount,
    banner,
  });
  const played = (spot: Spot, faceUp = true, extra: Partial<Sprite> = {}): Sprite => ({
    id: card,
    card,
    spot,
    faceUp,
    z: 600,
    from,
    fromFaceUp: player === me,
    duration: TIMING.fly,
    ...extra,
  });

  let tableAfter: Card[];
  if (captured.length === 0) {
    // 1. La carta vola sul tavolo e resta lì.
    tableAfter = [...prev.table, card];
    steps.push({
      scene: scene([
        ...tableSprites(prev.table, tableAfter.length),
        played({ kind: 'table', index: prev.table.length, count: tableAfter.length }),
        ...hands,
      ]),
      hold: TIMING.fly + TIMING.pause,
    });
  } else {
    const anchor = prev.table.indexOf(captured[0]);
    const n = prev.table.length;
    const others = tableSprites(prev.table).filter((s) => !captured.includes(s.card!));
    const takenSprites = (stacked: boolean) =>
      captured.map((c, k) => ({
        id: c,
        card: c,
        spot: stacked
          ? ({ kind: 'stack', index: anchor, count: n, offset: k } as Spot)
          : ({ kind: 'table', index: prev.table.indexOf(c), count: n } as Spot),
        faceUp: true,
        z: 400 + k,
        duration: TIMING.gather,
      }));
    const onTop: Spot = { kind: 'stack', index: anchor, count: n, offset: captured.length };

    // 1. La carta giocata vola sopra la prima carta presa.
    steps.push({ scene: scene([...others, ...takenSprites(false), played(onTop), ...hands]), hold: TIMING.fly + TIMING.pause });

    // 2. Le carte prese si riuniscono sotto la carta giocata.
    const banner = move.scopa ? { key: `scopa-${next.moveNo}`, text: 'SCOPA!' } : null;
    steps.push({
      scene: scene([...others, ...takenSprites(true), played(onTop), ...hands], banner),
      hold: TIMING.gather + (move.scopa ? TIMING.scopaPause : TIMING.pause),
    });

    // 3. La presa va nel mazzetto (coperta; con la scopa la carta giocata resta scoperta, di traverso).
    tableAfter = prev.table.filter((c) => !captured.includes(c));
    const toPile = captured.map((c, k) => ({
      id: c,
      card: c,
      spot: { kind: 'pile', owner: player } as Spot,
      faceUp: false,
      z: 500 + k,
      delay: k * 40,
      duration: TIMING.toPile,
    }));
    const playedSpot: Spot = move.scopa ? { kind: 'pile', owner: player, scopa: piles[player].scope.length } : { kind: 'pile', owner: player };
    steps.push({
      scene: scene([...tableSprites(tableAfter), ...toPile, played(playedSpot, move.scopa, { duration: TIMING.toPile }), ...hands], banner),
      hold: TIMING.toPile + captured.length * 40 + TIMING.pause,
    });
    piles[player].count += captured.length + 1;
    if (move.scopa) piles[player].scope.push(card);
  }

  let current = scene([...tableSprites(tableAfter), ...hands]);

  if (move.roundEnded) {
    // Le carte rimaste vanno all'ultimo che ha preso.
    const to = move.leftoverTo;
    if (to !== null && move.leftover.length > 0) {
      steps.push({ scene: current, hold: TIMING.pause * 2 });
      steps.push({
        scene: scene([
          ...move.leftover.map((c, k) => ({
            id: c,
            card: c,
            spot: { kind: 'pile', owner: to } as Spot,
            faceUp: false,
            z: 500 + k,
            delay: k * 50,
            duration: TIMING.toPile,
          })),
        ]),
        hold: TIMING.toPile + move.leftover.length * 50 + TIMING.pause,
      });
      piles[to].count += move.leftover.length;
    }
    // Tavolo vuoto e mazzetti pieni: il riepilogo compare quando la vista mostrata diventa `next`.
    current = scene([]);
    current.deckCount = 0;
    steps.push({ scene: current, hold: TIMING.pause * 3, view: next });
    return steps;
  }

  if (handAfter.length === 0 && oppCountAfter === 0 && next.hand.length > 0) {
    steps.push({ scene: current, hold: TIMING.pause });
    steps.push(dealHandsStep(current, next));
  }

  steps.push({ scene: restScene(next), hold: 0, view: next });
  return steps;
}
