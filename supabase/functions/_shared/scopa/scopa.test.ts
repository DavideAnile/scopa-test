import { describe, expect, it } from 'vitest';

import {
  type Card,
  FULL_DECK,
  type GameState,
  MoveError,
  applyMove,
  bestCapture,
  chooseBotMove,
  nextRound,
  legalCaptures,
  newGame,
  playerView,
  primiera,
  scoreRound,
  shuffledDeck,
} from './index.ts';

describe('mazzo', () => {
  it('ha 40 carte diverse', () => {
    expect(new Set(FULL_DECK).size).toBe(40);
  });

  it('mescola in modo deterministico', () => {
    expect(shuffledDeck(42)).toEqual(shuffledDeck(42));
    expect(shuffledDeck(42)).not.toEqual(shuffledDeck(43));
    expect(new Set(shuffledDeck(7)).size).toBe(40);
  });
});

describe('prese', () => {
  it('obbliga a prendere la carta uguale invece della somma', () => {
    expect(legalCaptures('7D', ['7C', '3S', '4B'])).toEqual([['7C']]);
  });

  it('con più carte uguali si sceglie quale prendere', () => {
    expect(legalCaptures('5D', ['5C', '5S', '2B'])).toEqual([['5C'], ['5S']]);
  });

  it('trova tutte le combinazioni per somma', () => {
    const opts = legalCaptures('10D', ['1C', '2S', '3B', '4D', '6C', '7S']);
    const sorted = opts.map((o) => [...o].sort().join(',')).sort();
    expect(sorted).toEqual(['1C,2S,3B,4D', '1C,2S,7S', '1C,3B,6C', '3B,7S', '4D,6C'].sort());
  });

  it('nessuna presa = si cala', () => {
    expect(legalCaptures('2D', ['5C', '9S'])).toEqual([]);
  });
});

describe('punteggio', () => {
  it('primiera: miglior carta per seme', () => {
    expect(primiera(['7D', '7C', '7S', '7B'])).toBe(84);
    expect(primiera(['1D', '6C', '10S', '5B', '2B'])).toBe(16 + 18 + 10 + 15);
    expect(primiera(['7D', '7C', '7S'])).toBeNull();
  });

  it('assegna carte, denari, settebello, primiera e scope', () => {
    const p0: Card[] = FULL_DECK.filter((c) => c.endsWith('D') || c === '7C' || c === '7S' || c === '7B');
    const p1: Card[] = FULL_DECK.filter((c) => !p0.includes(c));
    const r = scoreRound([p0, p1], [2, 1]);
    expect(r.winners).toEqual({ cards: 1, denari: 0, settebello: 0, primiera: 0 });
    expect(r.points).toEqual([2 + 3, 1 + 1]);
  });

  it('in caso di parità il punto non va a nessuno', () => {
    // 20 carte a testa; a p0 mancano spade e bastoni, a p1 denari e coppe.
    const p0: Card[] = FULL_DECK.filter((c) => c.endsWith('D') || c.endsWith('C'));
    const p1: Card[] = FULL_DECK.filter((c) => !p0.includes(c));
    const r = scoreRound([p0, p1], [0, 0]);
    expect(r.winners.cards).toBeNull();
    expect(r.winners.primiera).toBeNull();

    const even: Card[] = ['7D', '7C', '7S', '7B'];
    const r2 = scoreRound([even, ['6D', '6C', '6S', '6B']], [0, 0]);
    expect(r2.winners.primiera).toBe(0);
    expect(scoreRound([['7D', '7C', '6S', '6B'], ['6D', '6C', '7S', '7B']], [0, 0]).winners.primiera).toBeNull();
  });
});

function baseState(over: Partial<GameState>): GameState {
  return { ...newGame({ seed: 1, series: 10 }), ...over };
}

describe('mosse', () => {
  it('rifiuta mosse fuori turno, carte non in mano, prese illegali', () => {
    const s = baseState({ turn: 0, hands: [['7D', '2C', '3C'], ['1S', '2S', '3S']], table: ['7C', '3B', '4B'] });
    expect(() => applyMove(s, 1, '1S', [])).toThrow(MoveError);
    expect(() => applyMove(s, 0, '1S', [])).toThrow('card_not_in_hand');
    expect(() => applyMove(s, 0, '7D', ['3B', '4B'])).toThrow('illegal_capture');
    expect(() => applyMove(s, 0, '7D', [])).toThrow('illegal_capture');
  });

  it('non modifica lo stato precedente', () => {
    const s = baseState({ turn: 0, hands: [['7D', '2C', '3C'], ['1S', '2S', '3S']], table: ['7C', '1B'] });
    const copy = structuredClone(s);
    applyMove(s, 0, '7D', ['7C']);
    expect(s).toEqual(copy);
  });

  it('conta la scopa quando si svuota il tavolo', () => {
    const s = baseState({ turn: 0, hands: [['7D', '2C', '3C'], ['1S', '2S', '3S']], table: ['3B', '4B'] });
    const n = applyMove(s, 0, '7D', ['3B', '4B']);
    expect(n.scope[0]).toBe(1);
    expect(n.table).toEqual([]);
    expect(n.lastMove).toMatchObject({ scopa: true, captured: ['3B', '4B'], roundEnded: false, leftover: [] });
    expect(n.scopeCards[0]).toEqual(['7D']);
    expect(n.moveNo).toBe(s.moveNo + 1);
    expect(n.turn).toBe(1);
  });

  it('bestCapture preferisce la presa col settebello', () => {
    expect(bestCapture('7C', [['3B', '4B'], ['7D']])).toEqual(['7D']);
    expect(bestCapture('5C', [])).toEqual([]);
  });

  it("l'ultima presa della smazzata non è scopa e le carte restanti vanno all'ultimo che ha preso", () => {
    const s = baseState({
      turn: 1,
      deck: [],
      hands: [[], ['5S']],
      table: ['5B'],
      captured: [['1D', '7D'], []],
      scope: [0, 0],
      lastCapturer: 0,
    });
    const n = applyMove(s, 1, '5S', ['5B']);
    expect(n.rounds).toHaveLength(1);
    expect(n.rounds[0].stats[1].scope).toBe(0);
    expect(n.lastMove?.roundEnded).toBe(true);

    const s2 = baseState({
      turn: 1,
      deck: [],
      hands: [[], ['9S']],
      table: ['5B'],
      captured: [['1D'], []],
      lastCapturer: 0,
    });
    const n2 = applyMove(s2, 1, '9S', []);
    expect(n2.rounds[0].stats[0].cards).toBe(3); // 1D + 5B + 9S
    expect(n2.lastMove).toMatchObject({ roundEnded: true, leftover: ['5B', '9S'], leftoverTo: 0 });
    // La partita è finita: si aspetta il "Continua" prima di distribuire la successiva.
    expect(n2.status).toBe('roundOver');
    expect(n2.roundNo).toBe(s2.roundNo);
    expect(() => applyMove(n2, 0, '1C', [])).toThrow('game_over');
    const w = n2.rounds[0].winner;
    expect(n2.wins).toEqual(w === null ? [0, 0] : w === 0 ? [1, 0] : [0, 1]);

    const n3 = nextRound(n2);
    expect(n3).toMatchObject({ status: 'playing', roundNo: s2.roundNo + 1, dealer: 1, turn: 0 });
    expect(n3.table).toHaveLength(4);
    expect(n3.captured).toEqual([[], []]);
    expect(n2.status).toBe('roundOver'); // lo stato precedente non cambia
    expect(nextRound(n3)).toBe(n3); // a partita in corso non fa nulla
  });

  it('ridistribuisce quando le mani finiscono', () => {
    const s = baseState({ turn: 1, deck: FULL_DECK.slice(0, 10) as Card[], hands: [[], ['9S']], table: ['5B'] });
    const n = applyMove(s, 1, '9S', []);
    expect(n.hands[0]).toHaveLength(3);
    expect(n.hands[1]).toHaveLength(3);
    expect(n.deck).toHaveLength(4);
  });
});

describe('partita completa', () => {
  function playOut(seed: number, series: 10 | 15) {
    let s = newGame({ seed, series });
    let moves = 0;
    while (s.status !== 'finished') {
      if (s.status === 'roundOver') s = nextRound(s);
      const move = chooseBotMove(playerView(s, s.turn));
      s = applyMove(s, s.turn, move.card, move.capture);
      if (++moves > 20000) throw new Error('loop');
    }
    return s;
  }

  it('bot contro bot: la serie dura esattamente 10 o 15 partite', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const series of [10, 15] as const) {
        const s = playOut(seed, series);
        expect(s.rounds).toHaveLength(series);
        expect(s.roundNo).toBe(series);
        const wins: [number, number] = [0, 0];
        for (const r of s.rounds) {
          // ogni smazzata usa tutte le 40 carte
          expect(r.stats[0].cards + r.stats[1].cards).toBe(40);
          if (r.winner !== null) wins[r.winner]++;
          expect(r.winner).toBe(r.points[0] === r.points[1] ? null : r.points[0] > r.points[1] ? 0 : 1);
        }
        expect(s.wins).toEqual(wins);
        expect(s.winner).toBe(wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1);
      }
    }
  });

  it('il mazziere si alterna e inizia il non-mazziere', () => {
    const s = newGame({ seed: 5, series: 10, dealer: 0 });
    expect(s.turn).toBe(1);
    expect(s.hands[0]).toHaveLength(3);
    expect(s.hands[1]).toHaveLength(3);
    expect(s.table).toHaveLength(4);
    expect(s.deck).toHaveLength(30);
  });
});
