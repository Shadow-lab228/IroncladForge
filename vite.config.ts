import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { handleForgeApiRequest } from './src/server/forgeApi';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveWorkspaceFile(reqUrl: string, res: any): boolean {
  if (!reqUrl.startsWith('/workspaces/')) return false;

  const cleanUrl = reqUrl.split('?')[0];
  const parts = cleanUrl.replace(/^\/workspaces\//, '');
  const baseRoot = process.cwd();

  const candidates = [
    resolve(baseRoot, 'public', 'workspaces', parts),
    resolve(baseRoot, 'forge-workspaces', parts),
  ];

  for (let filePath of candidates) {
    if (existsSync(filePath)) {
      if (statSync(filePath).isDirectory()) {
        const indexCandidate = join(filePath, 'index.html');
        if (existsSync(indexCandidate)) {
          filePath = indexCandidate;
        } else {
          continue;
        }
      }

      try {
        const ext = extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        const content = readFileSync(filePath);

        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(content);
        return true;
      } catch {}
    }
  }

  return false;
}

function forgeApiPlugin(): Plugin {
  return {
    name: 'forge-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const handled = handleForgeApiRequest(req, res);
          if (handled) return;
        }
        if (req.url && req.url.startsWith('/workspaces/')) {
          const handled = serveWorkspaceFile(req.url, res);
          if (handled) return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const handled = handleForgeApiRequest(req, res);
          if (handled) return;
        }
        if (req.url && req.url.startsWith('/workspaces/')) {
          const handled = serveWorkspaceFile(req.url, res);
          if (handled) return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [forgeApiPlugin(), react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
