// Rigenera src/constants/stickers.ts dagli sticker in server/stickers (.webp, .png, .gif).
//   npm run stickers
// Per aggiungerne: copia i file in server/stickers, lancia il comando e fai il push.
// L'id di ogni sticker è il nome del file senza estensione (minuscole, cifre e trattini).
// Le immagini restano sul server (le manda solo con un lasciapassare): nell'app finiscono solo gli id.

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../server/stickers/', import.meta.url));
const OUT = fileURLToPath(new URL('../src/constants/stickers.ts', import.meta.url));
const MAX_KB = 500;

const files = readdirSync(DIR)
  .filter((f) => /\.(webp|png|gif)$/i.test(f))
  .sort();

const ids = [];
for (const file of files) {
  const id = file.replace(/\.[^.]+$/, '');
  if (!/^[a-z0-9-]{1,60}$/.test(id)) {
    console.error(`❌ Nome non valido: ${file} (usa solo minuscole, cifre e trattini)`);
    process.exit(1);
  }
  const kb = Math.round(statSync(DIR + file).size / 1024);
  if (kb > MAX_KB) console.warn(`⚠️  ${file} pesa ${kb} KB: si caricherà più lentamente.`);
  ids.push(id);
}

writeFileSync(
  OUT,
  `// Generato da scripts/stickers.mjs (npm run stickers): non modificare a mano.
// Solo gli id: le immagini le manda il server (/api/sticker/<id>) a chi ha un lasciapassare.

/** Gli id nell'ordine in cui compaiono nella griglia. */
export const STICKER_IDS: readonly string[] = [
${ids.map((id) => `  '${id}',`).join('\n')}
];
`,
);
console.log(`✓ ${ids.length} sticker in src/constants/stickers.ts`);
