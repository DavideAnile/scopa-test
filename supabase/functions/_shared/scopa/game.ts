import { type Card, shuffledDeck } from './cards.ts';
import { matchCapture } from './rules.ts';
import { type Pair, type RoundResult, scoreRound } from './scoring.ts';

export type PlayerIndex = 0 | 1;
/** Quante partite (smazzate) compongono una serie. */
export type SeriesLength = 10 | 15;
/** playing: si gioca; roundOver: partita finita, si aspetta "Continua"; finished: serie finita. */
export type GameStatus = 'playing' | 'roundOver' | 'finished';

export interface LastMove {
  player: PlayerIndex;
  card: Card;
  captured: Card[];
  scopa: boolean;
  /** true se con questa mossa si è chiusa la smazzata. */
  roundEnded: boolean;
  /** A fine smazzata: carte rimaste in tavola e chi se le prende. */
  leftover: Card[];
  leftoverTo: PlayerIndex | null;
}

/** Stato completo della partita: lo conosce solo il server (contiene mazzo e mani). */
export interface GameState {
  seed: number;
  series: SeriesLength;
  /** Partite vinte da ciascun giocatore nella serie. */
  wins: Pair<number>;
  roundNo: number;
  /** Mosse giocate dall'inizio della serie. */
  moveNo: number;
  dealer: PlayerIndex;
  turn: PlayerIndex;
  deck: Card[];
  table: Card[];
  hands: Pair<Card[]>;
  captured: Pair<Card[]>;
  scope: Pair<number>;
  /** Le carte con cui si è fatto scopa (nel mazzetto vanno di traverso). */
  scopeCards: Pair<Card[]>;
  lastCapturer: PlayerIndex | null;
  lastMove: LastMove | null;
  rounds: RoundResult[];
  status: GameStatus;
  /** Vincitore della serie (null se pari o non ancora finita). */
  winner: PlayerIndex | null;
}

/** Quello che possono vedere entrambi i giocatori. */
export interface PublicState {
  series: SeriesLength;
  wins: Pair<number>;
  roundNo: number;
  moveNo: number;
  dealer: PlayerIndex;
  turn: PlayerIndex;
  table: Card[];
  deckCount: number;
  handCounts: Pair<number>;
  capturedCounts: Pair<number>;
  scope: Pair<number>;
  scopeCards: Pair<Card[]>;
  lastMove: LastMove | null;
  rounds: RoundResult[];
  status: GameStatus;
  winner: PlayerIndex | null;
}

export interface PlayerView extends PublicState {
  you: PlayerIndex;
  hand: Card[];
}

export type MoveErrorCode = 'game_over' | 'not_your_turn' | 'card_not_in_hand' | 'illegal_capture';

export class MoveError extends Error {
  code: MoveErrorCode;
  constructor(code: MoveErrorCode) {
    super(code);
    this.code = code;
  }
}

export const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

function roundSeed(seed: number, roundNo: number): number {
  return (seed ^ Math.imul(roundNo, 0x9e3779b1)) >>> 0;
}

function dealHands(state: GameState) {
  const first = other(state.dealer);
  state.hands[first] = state.deck.splice(0, 3);
  state.hands[state.dealer] = state.deck.splice(0, 3);
}

function startRound(state: GameState, roundNo: number, dealer: PlayerIndex) {
  state.roundNo = roundNo;
  state.dealer = dealer;
  state.deck = shuffledDeck(roundSeed(state.seed, roundNo));
  state.hands = [[], []];
  dealHands(state);
  state.table = state.deck.splice(0, 4);
  state.captured = [[], []];
  state.scope = [0, 0];
  state.scopeCards = [[], []];
  state.lastCapturer = null;
  state.turn = other(dealer);
}

export function newGame(opts: { seed: number; series: SeriesLength; dealer?: PlayerIndex }): GameState {
  const state: GameState = {
    seed: opts.seed >>> 0,
    series: opts.series,
    wins: [0, 0],
    roundNo: 0,
    moveNo: 0,
    dealer: 0,
    turn: 0,
    deck: [],
    table: [],
    hands: [[], []],
    captured: [[], []],
    scope: [0, 0],
    scopeCards: [[], []],
    lastCapturer: null,
    lastMove: null,
    rounds: [],
    status: 'playing',
    winner: null,
  };
  startRound(state, 1, opts.dealer ?? 0);
  return state;
}

function endRound(state: GameState): Pick<LastMove, 'leftover' | 'leftoverTo'> {
  // Le carte rimaste in tavola vanno all'ultimo che ha preso (non è scopa).
  const leftover = state.table;
  const leftoverTo = leftover.length > 0 ? state.lastCapturer : null;
  if (leftoverTo !== null) state.captured[leftoverTo].push(...leftover);
  state.table = [];

  const result = scoreRound(state.captured, state.scope);
  state.rounds.push(result);
  if (result.winner !== null) state.wins[result.winner]++;

  if (state.rounds.length >= state.series) {
    const [a, b] = state.wins;
    state.status = 'finished';
    state.winner = a === b ? null : a > b ? 0 : 1;
  } else {
    state.status = 'roundOver';
  }
  return { leftover, leftoverTo };
}

/** Dopo il "Continua": distribuisce la partita successiva della serie. */
export function nextRound(prev: GameState): GameState {
  if (prev.status !== 'roundOver') return prev;
  const state: GameState = structuredClone(prev);
  state.status = 'playing';
  startRound(state, state.roundNo + 1, other(state.dealer));
  return state;
}

/**
 * Applica una mossa e restituisce il nuovo stato (quello passato non viene modificato).
 * `capture` sono le carte prese dal tavolo ([] se la carta viene calata).
 */
export function applyMove(prev: GameState, player: PlayerIndex, card: Card, capture: readonly Card[]): GameState {
  if (prev.status !== 'playing') throw new MoveError('game_over');
  if (prev.turn !== player) throw new MoveError('not_your_turn');
  if (!prev.hands[player].includes(card)) throw new MoveError('card_not_in_hand');
  const taken = matchCapture(card, prev.table, capture);
  if (taken === null) throw new MoveError('illegal_capture');

  const state: GameState = structuredClone(prev);
  state.hands[player] = state.hands[player].filter((c) => c !== card);

  let scopa = false;
  if (taken.length > 0) {
    state.table = state.table.filter((c) => !taken.includes(c));
    state.captured[player].push(card, ...taken);
    state.lastCapturer = player;
    const lastPlayOfRound = state.deck.length === 0 && state.hands[0].length === 0 && state.hands[1].length === 0;
    if (state.table.length === 0 && !lastPlayOfRound) {
      scopa = true;
      state.scope[player]++;
      state.scopeCards[player].push(card);
    }
  } else {
    state.table.push(card);
  }

  state.turn = other(player);
  state.moveNo++;
  let end: Pick<LastMove, 'leftover' | 'leftoverTo'> | null = null;
  if (state.hands[0].length === 0 && state.hands[1].length === 0) {
    if (state.deck.length > 0) dealHands(state);
    else end = endRound(state);
  }

  state.lastMove = {
    player,
    card,
    captured: [...taken],
    scopa,
    roundEnded: end !== null,
    leftover: end?.leftover ?? [],
    leftoverTo: end?.leftoverTo ?? null,
  };
  return state;
}

export function publicState(state: GameState): PublicState {
  return {
    series: state.series,
    wins: state.wins,
    roundNo: state.roundNo,
    moveNo: state.moveNo,
    dealer: state.dealer,
    turn: state.turn,
    table: state.table,
    deckCount: state.deck.length,
    handCounts: [state.hands[0].length, state.hands[1].length],
    capturedCounts: [state.captured[0].length, state.captured[1].length],
    scope: state.scope,
    scopeCards: state.scopeCards,
    lastMove: state.lastMove,
    rounds: state.rounds,
    status: state.status,
    winner: state.winner,
  };
}

export function playerView(state: GameState, you: PlayerIndex): PlayerView {
  return { ...publicState(state), you, hand: state.hands[you] };
}
