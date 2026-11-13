import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Controlla che src/constants/stickers.ts (generato da `npm run stickers`) sia allineato a server/stickers.
describe('pacchetto sticker', () => {
  it('ogni file in server/stickers ha il suo id, e nella cartella del sito non ce ne sono', () => {
    const files = readdirSync(new URL('../../server/stickers/', import.meta.url)).filter((f) => /\.(webp|png|gif)$/i.test(f));
    const map = readFileSync(new URL('../constants/stickers.ts', import.meta.url), 'utf8');
    const ids = [...map.matchAll(/^ {2}'([a-z0-9-]+)',$/gm)].map((m) => m[1]);
    expect(ids.sort()).toEqual(files.map((f) => f.replace(/\.[^.]+$/, '')).sort());
    expect(ids).toHaveLength(19);
    expect(map).not.toContain('require(');
  });
});
