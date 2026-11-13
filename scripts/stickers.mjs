// Rigenera src/constants/stickers.ts dagli sticker in assets/stickers (.webp, .png, .gif).
//   npm run stickers
// Per aggiungerne: copia i file in assets/stickers, lancia il comando e fai il push.
// L'id di ogni sticker è il nome del file senza estensione (minuscole, cifre e trattini).

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../assets/stickers/', import.meta.url));
const OUT = fileURLToPath(new URL('../src/constants/stickers.ts', import.meta.url));
const MAX_KB = 500;

const files = readdirSync(DIR)
  .filter((f) => /\.(webp|png|gif)$/i.test(f))
  .sort();

const lines = [];
for (const file of files) {
  const id = file.replace(/\.[^.]+$/, '');
  if (!/^[a-z0-9-]{1,60}$/.test(id)) {
    console.error(`❌ Nome non valido: ${file} (usa solo minuscole, cifre e trattini)`);
    process.exit(1);
  }
  const kb = Math.round(statSync(DIR + file).size / 1024);
  if (kb > MAX_KB) console.warn(`⚠️  ${file} pesa ${kb} KB: si caricherà più lentamente.`);
  lines.push(`  '${id}': require('@/assets/stickers/${file}'),`);
}

writeFileSync(
  OUT,
  `// Generato da scripts/stickers.mjs (npm run stickers): non modificare a mano.
// require() di un'immagine restituisce un id numerico dell'asset.
type ImageAsset = number;

export const STICKERS: Record<string, ImageAsset> = {
${lines.join('\n')}
};

/** Gli id nell'ordine in cui compaiono nella griglia. */
export const STICKER_IDS = Object.keys(STICKERS);
`,
);
console.log(`✓ ${files.length} sticker in src/constants/stickers.ts`);
