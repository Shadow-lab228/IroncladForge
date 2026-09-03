import { mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await mkdir('dist', { recursive: true });
console.log('FORGE_LIVE_OK');
await writeFile(join(__dirname, 'dist', 'output.txt'), 'FORGE_LIVE_OK');