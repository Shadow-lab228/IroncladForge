import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';

await mkdir('dist', { recursive: true });
console.log('FORGE_LIVE_OK');
await writeFile('dist/output.txt', 'FORGE_LIVE_OK');