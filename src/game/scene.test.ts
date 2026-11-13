import { describe, expect, it } from 'vitest';

import { type Card, type GameState, applyMove, chooseBotMove, newGame, nextRound, playerView } from '@scopa';

import { type Scene, dealRoundSteps, moveSteps, restScene } from './scene';

function checkScene(scene: Scene) {
  const ids = scene.sprites.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe('scene', () => {
  it('ogni mossa produce scene coerenti, dal punto di vista di entrambi i giocatori', () => {
    for (let seed = 1; seed <= 6; seed++) {
      let s: GameState = newGame({ seed, series: 10 });
      while (s.status !== 'finished') {
        if (s.status === 'roundOver') {
          s = nextRound(s);
          for (const you of [0, 1] as const) dealRoundSteps(playerView(s, you)).forEach((st) => checkScene(st.scene));
        }
        const m = chooseBotMove(playerView(s, s.turn));
        const next = applyMove(s, s.turn, m.card, m.capture);
        for (const you of [0, 1] as const) {
          const steps = moveSteps(playerView(s, you), playerView(next, you));
          for (const st of steps) checkScene(st.scene);

          const last = steps.at(-1)!;
          expect(last.view?.moveNo).toBe(next.moveNo);
          if (next.lastMove!.roundEnded) {
            // A fine partita: tavolo vuoto e i due mazzetti contengono tutte le 40 carte.
            expect(last.scene.sprites).toHaveLength(0);
            expect(last.scene.piles[0].count + last.scene.piles[1].count).toBe(40);
            expect(next.status).not.toBe('playing');
          } else {
            expect(last.scene).toEqual(restScene(playerView(next, you)));
          }
        }
        s = next;
      }
    }
  });

  it("la carta dell'avversario parte coperta dalla sua mano", () => {
    const s = newGame({ seed: 3, series: 10, dealer: 0 }); // inizia il giocatore 1
    const m = chooseBotMove(playerView(s, 1));
    const next = applyMove(s, 1, m.card, m.capture);
    const [first] = moveSteps(playerView(s, 0), playerView(next, 0));
    const played = first.scene.sprites.find((sp) => sp.id === m.card);
    expect(played).toMatchObject({ from: { kind: 'opp' }, fromFaceUp: false, faceUp: true });
  });
});

describe('banner di scopa e settebello', () => {
  const base = (over: Partial<GameState>): GameState => ({ ...newGame({ seed: 1, series: 10, dealer: 1 }), turn: 0, ...over });
  const bannerOf = (s: GameState, card: Card, capture: Card[]) => {
    const next = applyMove(s, 0, card, capture);
    return moveSteps(playerView(s, 0), playerView(next, 0)).find((st) => st.scene.banner)?.scene.banner?.kind ?? null;
  };

  it('settebello preso dal tavolo o giocato', () => {
    expect(bannerOf(base({ hands: [['7C', '2C', '3C'], ['1S', '2S', '3S']], table: ['7D', '1B'] }), '7C', ['7D'])).toBe('settebello');
    expect(bannerOf(base({ hands: [['7D', '2C', '3C'], ['1S', '2S', '3S']], table: ['3B', '4B', '1B'] }), '7D', ['3B', '4B'])).toBe('settebello');
  });

  it('settebello e scopa insieme; solo scopa; presa normale senza banner', () => {
    expect(bannerOf(base({ hands: [['7D', '2C', '3C'], ['1S', '2S', '3S']], table: ['3B', '4B'] }), '7D', ['3B', '4B'])).toBe('both');
    expect(bannerOf(base({ hands: [['7C', '2C', '3C'], ['1S', '2S', '3S']], table: ['3B', '4B'] }), '7C', ['3B', '4B'])).toBe('scopa');
    expect(bannerOf(base({ hands: [['7C', '2C', '3C'], ['1S', '2S', '3S']], table: ['3B', '4B', '1B'] }), '7C', ['3B', '4B'])).toBeNull();
  });

  it('il settebello rimasto in tavola a fine smazzata non fa banner', () => {
    const s = base({ turn: 1, deck: [], hands: [[], ['9S']], table: ['7D'], captured: [['1D'], []], lastCapturer: 0 });
    const next = applyMove(s, 1, '9S', []);
    expect(next.lastMove?.leftover).toContain('7D');
    expect(moveSteps(playerView(s, 0), playerView(next, 0)).some((st) => st.scene.banner)).toBe(false);
  });
});

describe('mescolata e distribuzione da mazziere', () => {
  it('a inizio smazzata: mescolata al centro, poi distribuzione dal mazzo del mazziere', () => {
    for (const dealer of [0, 1] as const) {
      const s = newGame({ seed: 4, series: 10, dealer });
      const steps = dealRoundSteps(playerView(s, 0));
      const shuffle = steps.filter((st) => st.scene.sprites.some((sp) => sp.id.startsWith('shuffle-')));
      expect(shuffle.length).toBeGreaterThanOrEqual(5);
      // durante la mescolata solo carte coperte "di scena", niente carte vere
      for (const st of shuffle) expect(st.scene.sprites.every((sp) => sp.card === null && !sp.faceUp)).toBe(true);
      expect(shuffle.some((st) => st.scene.sprites.some((sp) => sp.spot.kind === 'center'))).toBe(true);
      // poi le carte vere partono una alla volta dal mazzo, prima il non-mazziere
      const deal = steps[shuffle.length];
      expect(deal.scene.sprites.every((sp) => sp.from?.kind === 'deck')).toBe(true);
      const firstSpot = deal.scene.sprites[0].spot.kind;
      expect(firstSpot).toBe(dealer === 0 ? 'opp' : 'hand');
      expect(steps.at(-1)!.scene.dealer).toBe(dealer);
    }
  });
});
