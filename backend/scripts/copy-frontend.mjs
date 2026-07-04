import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', '..', 'frontend', 'dist');
const dest = join(__dirname, '..', 'dist', 'public');

if (!existsSync(src)) {
  console.error(`Frontend dist not found at ${src}. Run build:frontend first.`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied frontend dist → ${dest}`);
