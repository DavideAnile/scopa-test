import { useEffect, useState, useSyncExternalStore } from 'react';

import type { PlayerView } from '@scopa';

import { type Scene, type Step, dealRoundSteps, moveSteps, restScene } from './scene';

export interface SceneSnapshot {
  scene: Scene;
  /** La vista "mostrata" (punteggi ecc.): resta indietro finché l'animazione non è finita. */
  shown: PlayerView;
  /** true mentre ci sono animazioni in corso: niente input, il bot aspetta. */
  busy: boolean;
}

/** Esegue in sequenza le scene generate dalle mosse. Store esterno per useSyncExternalStore. */
class ScenePlayer {
  private listeners = new Set<() => void>();
  private queue: Step[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private last: PlayerView;
  private snapshot: SceneSnapshot;

  constructor(view: PlayerView) {
    this.last = view;
    const empty: Scene = { ...restScene(view), sprites: [], deckCount: 40 };
    this.snapshot = { scene: empty, shown: view, busy: true };
    this.queue = view.status === 'playing' ? dealRoundSteps(view) : [{ scene: restScene(view), hold: 0, view }];
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<SceneSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  update(view: PlayerView) {
    const prev = this.last;
    if (view === prev || (view.moveNo === prev.moveNo && view.status === prev.status && view.roundNo === prev.roundNo)) {
      this.last = view;
      return;
    }
    this.last = view;
    if (view.moveNo === prev.moveNo + 1) {
      this.queue.push(...moveSteps(prev, view));
    } else if (view.moveNo > 0 && view.moveNo === prev.moveNo && view.roundNo === prev.roundNo + 1) {
      // "Continua": partita successiva della serie, si distribuisce dal mazzo.
      this.queue.push(...dealRoundSteps(view));
    } else {
      // Serie nuova (rivincita) o salto di più mosse (es. app riaperta): si riparte da capo.
      const fresh = view.moveNo === 0 && view.status === 'playing';
      this.queue = fresh ? dealRoundSteps(view) : [{ scene: restScene(view), hold: 0, view }];
      this.clearTimer();
    }
    this.pump();
  }

  start() {
    this.running = true;
    this.pump();
  }

  stop() {
    this.running = false;
    this.clearTimer();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private pump() {
    if (!this.running || this.timer) return;
    const step = this.queue.shift();
    if (!step) {
      if (this.snapshot.busy) this.set({ busy: false });
      return;
    }
    this.set({ scene: step.scene, busy: true, ...(step.view ? { shown: step.view } : {}) });
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, step.hold);
  }
}

export function useTableScene(view: PlayerView) {
  const [player] = useState(() => new ScenePlayer(view));

  useEffect(() => {
    player.start();
    return () => player.stop();
  }, [player]);

  useEffect(() => {
    player.update(view);
  }, [player, view]);

  return useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
}
