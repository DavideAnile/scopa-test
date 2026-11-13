import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Controlla che src/constants/stickers.ts (generato da `npm run stickers`) sia allineato alla cartella.
describe('pacchetto sticker', () => {
  it('ogni file in assets/stickers ha la sua voce, con un id valido', () => {
    const files = readdirSync(new URL('../../assets/stickers/', import.meta.url)).filter((f) => /\.(webp|png|gif)$/i.test(f));
    const map = readFileSync(new URL('../constants/stickers.ts', import.meta.url), 'utf8');
    const ids = [...map.matchAll(/^ {2}'([^']+)': require\('@\/assets\/stickers\/([^']+)'\),$/gm)];
    expect(ids.map((m) => m[2]).sort()).toEqual(files.sort());
    for (const [, id] of ids) expect(id).toMatch(/^[a-z0-9-]{1,60}$/);
    expect(ids).toHaveLength(19);
  });
});
