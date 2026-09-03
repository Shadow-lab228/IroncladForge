import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';

console.log('FORGE_LIVE_OK');

await mkdir('dist', { recursive: true });
await writeFile('dist/output.txt', 'FORGE_LIVE_OK');