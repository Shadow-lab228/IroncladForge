import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';

console.log("FORGE_LIVE_OK");

mkdirSync('dist', { recursive: true });
writeFileSync('dist/output.txt', 'FORGE_LIVE_OK');