import { describe, expect, it } from 'vitest';

import { type GameState, applyMove, chooseBotMove, newGame, nextRound, playerView } from '@scopa';

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
