// Storico delle partite finite, salvato in un file JSON sul Mac.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { HistoryEntry } from './protocol.ts';

const MAX_PER_PLAYER = 100;

export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private file: string;

  constructor(file: string) {
    this.file = file;
    try {
      // Le partite salvate col vecchio formato a punti (senza `wins`) si ignorano.
      const saved: HistoryEntry[] = JSON.parse(readFileSync(file, 'utf8'));
      this.entries = saved.filter((e) => Array.isArray(e.wins));
    } catch {
      this.entries = [];
    }
  }

  add(entry: HistoryEntry) {
    this.entries.push(entry);
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.entries, null, 1));
    renameSync(tmp, this.file);
  }

  /** Le partite di un giocatore, dalla più recente. */
  forPlayer(playerId: string): HistoryEntry[] {
    return this.entries
      .filter((e) => e.players.some((p) => p.id === playerId))
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, MAX_PER_PLAYER);
  }
}
