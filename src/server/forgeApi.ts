import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, normalize, join } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface ExecResult {
  ok: boolean;
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  caller?: 'ai' | 'user' | 'system';
  error?: string;
}

export interface ManagedProcess {
  id: string;
  projectId: string;
  command: string;
  args: string[];
  cwd: string;
  pid: number | null;
  status: 'STARTING' | 'RUNNING' | 'STOPPED' | 'ERROR';
  port: number | null;
  url: string | null;
  startedAt: number;
  stoppedAt: number | null;
  exitCode: number | null;
  logs: string[];
  child?: ChildProcess;
}

// In-memory process table & execution history
const managedProcesses = new Map<string, ManagedProcess>();
const executionHistory: ExecResult[] = [];

// Port extraction patterns (non-hardcoded dynamic port discovery)
const PORT_PATTERNS: RegExp[] = [
  /(?:Local|localhost|ready|listening\s*(?:on)?)[:\s]+(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])?:(\d{2,5})/i,
  /(?:port|:)[\s]*(\d{2,5})/i,
  /(?:https?:\/\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])?:(\d{2,5})/i,
];

export function extractPortFromLogs(text: string): number | null {
  for (const re of PORT_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const p = parseInt(m[1], 10);
      if (p >= 1 && p <= 65535 && p !== 80 && p !== 443) {
        return p;
      }
    }
  }
  return null;
}

/**
 * Enforces strict project workspace isolation.
 * Prevents traversal escapes (../, symlinks, absolute paths outside project).
 */
export function resolveSafeProjectWorkspace(projectId: string, subPath?: string): { rootDir: string; targetDir: string } {
  const cleanId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) {
    throw new Error('Invalid project identifier: workspace access rejected');
  }

  const baseRoot = process.cwd();
  const publicDir = resolve(baseRoot, 'public', 'workspaces', cleanId);
  const forgeDir = resolve(baseRoot, 'forge-workspaces', cleanId);

  // Preferred workspace directory: ensure public directory exists so previews serve directly
  let rootDir = publicDir;
  if (!existsSync(publicDir) && existsSync(forgeDir)) {
    rootDir = forgeDir;
  }

  if (!existsSync(rootDir)) {
    mkdirSync(rootDir, { recursive: true });
  }

  let targetDir = rootDir;
  if (subPath) {
    const cleanSub = normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
    const resolved = resolve(rootDir, cleanSub);
    if (!resolved.startsWith(rootDir)) {
      throw new Error(`Workspace isolation breach: path escapes project boundaries (${subPath})`);
    }
    targetDir = resolved;
  }

  return { rootDir, targetDir };
}

/**
 * Persists project files to disk in both public/workspaces and forge-workspaces
 */
export function syncFilesToDisk(
  projectId: string,
  files: Array<{ path: string; name?: string; type?: 'file' | 'directory'; content?: string }>
): { count: number; paths: string[] } {
  const cleanId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) throw new Error('Invalid project id');

  const baseRoot = process.cwd();
  const publicDir = resolve(baseRoot, 'public', 'workspaces', cleanId);
  const forgeDir = resolve(baseRoot, 'forge-workspaces', cleanId);

  mkdirSync(publicDir, { recursive: true });
  mkdirSync(forgeDir, { recursive: true });

  const writtenPaths: string[] = [];

  for (const file of files) {
    if (!file.path) continue;
    const cleanPath = normalize(file.path).replace(/^(\.\.[\/\\])+/, '');

    if (file.type === 'directory' || (!file.content && !file.path.includes('.'))) {
      mkdirSync(join(publicDir, cleanPath), { recursive: true });
      mkdirSync(join(forgeDir, cleanPath), { recursive: true });
      continue;
    }

    const content = file.content ?? '';
    const pubDest = join(publicDir, cleanPath);
    const forgeDest = join(forgeDir, cleanPath);

    mkdirSync(resolve(pubDest, '..'), { recursive: true });
    mkdirSync(resolve(forgeDest, '..'), { recursive: true });

    writeFileSync(pubDest, content, 'utf-8');
    writeFileSync(forgeDest, content, 'utf-8');
    writtenPaths.push(cleanPath);
  }

  return { count: writtenPaths.length, paths: writtenPaths };
}

const PROJECTS_FILE = resolve(process.cwd(), 'forge-workspaces', 'projects.json');
const PUBLIC_PROJECTS_FILE = resolve(process.cwd(), 'public', 'workspaces', 'projects.json');

export function scanWorkspaceFiles(
  dir: string,
  baseDir: string = dir
): Array<{ path: string; name: string; type: 'file' | 'directory'; size: number; content?: string }> {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const results: Array<{ path: string; name: string; type: 'file' | 'directory'; size: number; content?: string }> = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'projects.json') continue;
    const fullPath = join(dir, entry.name);
    const relPath = normalize(fullPath.substring(baseDir.length + 1)).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      results.push({ path: relPath, name: entry.name, type: 'directory', size: 0 });
      results.push(...scanWorkspaceFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const stat = statSync(fullPath);
      let content: string | undefined;
      if (stat.size < 256 * 1024) {
        try {
          content = readFileSync(fullPath, 'utf-8');
        } catch {}
      }
      results.push({ path: relPath, name: entry.name, type: 'file', size: stat.size, content });
    }
  }
  return results;
}

export function loadPersistedProjects(): any[] {
  let list: any[] = [];
  if (existsSync(PROJECTS_FILE)) {
    try {
      list = JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
    } catch {}
  } else if (existsSync(PUBLIC_PROJECTS_FILE)) {
    try {
      list = JSON.parse(readFileSync(PUBLIC_PROJECTS_FILE, 'utf-8'));
    } catch {}
  }

  // Scan directories in forge-workspaces to ensure all existing directories are represented
  const workspacesDir = resolve(process.cwd(), 'forge-workspaces');
  if (existsSync(workspacesDir)) {
    const entries = readdirSync(workspacesDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== '.git') {
        const id = ent.name;
        let proj = list.find((p: any) => p.id === id);
        const diskFiles = scanWorkspaceFiles(join(workspacesDir, id));
        if (!proj) {
          proj = {
            id,
            name: id
              .replace(/[-_]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
              .slice(0, 40),
            description: `Persisted workspace for ${id}`,
            blueprint: `Workspace project ${id}`,
            status: 'quenched',
            framework: diskFiles.some((f) => f.path === 'package.json') ? 'Node / Vite' : 'HTML5',
            language: diskFiles.some((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx')) ? 'TypeScript' : 'JavaScript',
            packageManager: 'npm',
            previewKind: diskFiles.some((f) => f.path.endsWith('index.html')) ? 'static' : 'web',
            previewUrl: `/workspaces/${id}/index.html`,
            port: 3000,
            files: diskFiles,
            createdAt: Date.now() - 3600000 * 24,
            updatedAt: Date.now(),
            tasks: [],
          };
          list.push(proj);
        } else if (!proj.files || proj.files.length === 0 || diskFiles.length > proj.files.length) {
          proj.files = diskFiles;
        }
      }
    }
  }

  return list;
}

export function savePersistedProjects(projects: any[]) {
  const dir1 = resolve(PROJECTS_FILE, '..');
  const dir2 = resolve(PUBLIC_PROJECTS_FILE, '..');
  if (!existsSync(dir1)) mkdirSync(dir1, { recursive: true });
  if (!existsSync(dir2)) mkdirSync(dir2, { recursive: true });

  const data = JSON.stringify(projects, null, 2);
  try {
    writeFileSync(PROJECTS_FILE, data, 'utf-8');
    writeFileSync(PUBLIC_PROJECTS_FILE, data, 'utf-8');
  } catch {}
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, rejectPromise) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        rejectPromise(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolvePromise(body ? JSON.parse(body) : {});
      } catch (err) {
        rejectPromise(new Error('Invalid JSON'));
      }
    });
    req.on('error', (err) => rejectPromise(err));
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

export function handleForgeApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  // 0. Project CRUD endpoints
  if (pathname === '/api/projects' && method === 'GET') {
    const list = loadPersistedProjects();
    sendJson(res, 200, { ok: true, projects: list, count: list.length });
    return true;
  }

  if (pathname === '/api/projects' && method === 'POST') {
    parseJsonBody(req)
      .then((body) => {
        const projData = body as any;
        if (!projData.id || !projData.name) {
          return sendJson(res, 400, { ok: false, error: 'id and name are required' });
        }

        const list = loadPersistedProjects();
        const existingIdx = list.findIndex((p) => p.id === projData.id);

        let projectRecord: any;
        if (existingIdx >= 0) {
          projectRecord = {
            ...list[existingIdx],
            ...projData,
            updatedAt: Date.now(),
          };
          list[existingIdx] = projectRecord;
        } else {
          projectRecord = {
            id: projData.id,
            name: projData.name,
            description: projData.description || '',
            blueprint: projData.blueprint || '',
            status: projData.status || 'quenched',
            framework: projData.framework || 'HTML5',
            language: projData.language || 'JavaScript',
            packageManager: projData.packageManager || 'npm',
            previewKind: projData.previewKind || 'static',
            previewUrl: projData.previewUrl || `/workspaces/${projData.id}/index.html`,
            port: projData.port || 3000,
            files: Array.isArray(projData.files) ? projData.files : [],
            createdAt: projData.createdAt || Date.now(),
            updatedAt: Date.now(),
            tasks: Array.isArray(projData.tasks) ? projData.tasks : [],
            architecture: projData.architecture || '',
            runtime: projData.runtime || '',
            entryPoint: projData.entryPoint || 'index.html',
            previewStatus: projData.previewStatus || 'RUNNING',
            lastBuildStatus: projData.lastBuildStatus || 'PASS',
          };
          list.unshift(projectRecord);
        }

        // If files provided, sync to disk
        if (Array.isArray(projectRecord.files) && projectRecord.files.length > 0) {
          syncFilesToDisk(projectRecord.id, projectRecord.files);
        }

        savePersistedProjects(list);
        return sendJson(res, 200, { ok: true, project: projectRecord });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  const projMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)(?:\/(tasks|files))?$/);
  if (projMatch) {
    const targetProjectId = projMatch[1];
    const subResource = projMatch[2];

    if (!subResource) {
      if (method === 'GET') {
        const list = loadPersistedProjects();
        const proj = list.find((p) => p.id === targetProjectId);
        if (!proj) {
          sendJson(res, 404, { ok: false, error: 'Project not found' });
          return true;
        }
        // Always refresh files from disk
        const workspacesDir = resolve(process.cwd(), 'forge-workspaces');
        const diskFiles = scanWorkspaceFiles(join(workspacesDir, targetProjectId));
        if (diskFiles.length > 0) {
          proj.files = diskFiles;
        }
        sendJson(res, 200, { ok: true, project: proj });
        return true;
      }

      if (method === 'PUT') {
        parseJsonBody(req)
          .then((body) => {
            const list = loadPersistedProjects();
            const idx = list.findIndex((p) => p.id === targetProjectId);
            if (idx < 0) {
              return sendJson(res, 404, { ok: false, error: 'Project not found' });
            }
            list[idx] = {
              ...list[idx],
              ...body,
              id: targetProjectId,
              updatedAt: Date.now(),
            };
            if (Array.isArray(body.files)) {
              syncFilesToDisk(targetProjectId, body.files as any);
            }
            savePersistedProjects(list);
            return sendJson(res, 200, { ok: true, project: list[idx] });
          })
          .catch((err) => {
            sendJson(res, 500, { ok: false, error: err.message });
          });
        return true;
      }

      if (method === 'DELETE') {
        const list = loadPersistedProjects();
        const filtered = list.filter((p) => p.id !== targetProjectId);
        savePersistedProjects(filtered);
        sendJson(res, 200, { ok: true, message: 'Project deleted' });
        return true;
      }
    } else if (subResource === 'tasks') {
      if (method === 'GET') {
        const list = loadPersistedProjects();
        const proj = list.find((p) => p.id === targetProjectId);
        sendJson(res, 200, { ok: true, tasks: proj?.tasks || [] });
        return true;
      }

      if (method === 'POST') {
        parseJsonBody(req)
          .then((body) => {
            const list = loadPersistedProjects();
            const idx = list.findIndex((p) => p.id === targetProjectId);
            if (idx < 0) {
              return sendJson(res, 404, { ok: false, error: 'Project not found' });
            }
            const task = {
              id: (body.id as string) || `task-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
              projectId: targetProjectId,
              prompt: (body.prompt as string) || '',
              status: (body.status as string) || 'COMPLETED',
              createdAt: (body.createdAt as number) || Date.now(),
              completedAt: Date.now(),
              attempts: (body.attempts as number) || 1,
              changedFiles: Array.isArray(body.changedFiles) ? body.changedFiles : [],
              diagnosticSummary: (body.diagnosticSummary as string) || '',
              commands: Array.isArray(body.commands) ? body.commands : [],
            };
            list[idx].tasks = [task, ...(list[idx].tasks || [])].slice(0, 100);
            list[idx].lastTaskId = task.id;
            list[idx].updatedAt = Date.now();
            savePersistedProjects(list);
            return sendJson(res, 200, { ok: true, task });
          })
          .catch((err) => {
            sendJson(res, 500, { ok: false, error: err.message });
          });
        return true;
      }
    } else if (subResource === 'files' && method === 'GET') {
      const workspacesDir = resolve(process.cwd(), 'forge-workspaces');
      const diskFiles = scanWorkspaceFiles(join(workspacesDir, targetProjectId));
      sendJson(res, 200, { ok: true, files: diskFiles });
      return true;
    }
  }

  // 1. Workspace sync: POST /api/workspace/sync
  if (pathname === '/api/workspace/sync' && method === 'POST') {
    parseJsonBody(req)
      .then((body) => {
        const projectId = typeof body.projectId === 'string' ? body.projectId : '';
        const files = Array.isArray(body.files) ? (body.files as any[]) : [];

        if (!projectId) {
          return sendJson(res, 400, { ok: false, error: 'projectId is required' });
        }

        const result = syncFilesToDisk(projectId, files);

        // Update project in persisted store
        const list = loadPersistedProjects();
        const pIdx = list.findIndex((p) => p.id === projectId);
        if (pIdx >= 0) {
          const workspacesDir = resolve(process.cwd(), 'forge-workspaces');
          const latestFiles = scanWorkspaceFiles(join(workspacesDir, projectId));
          list[pIdx].files = latestFiles.length > 0 ? latestFiles : files;
          list[pIdx].updatedAt = Date.now();
          savePersistedProjects(list);
        }

        return sendJson(res, 200, {
          ok: true,
          projectId,
          filesWritten: result.count,
          paths: result.paths,
          previewPath: `/workspaces/${projectId}/index.html`,
        });
      })
      .catch((err) => {
        return sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 2. Real terminal execution: POST /api/terminal/execute
  if (pathname === '/api/terminal/execute' && method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const rawCmd = typeof body.command === 'string' ? body.command.trim() : '';
        const projectId = typeof body.projectId === 'string' ? body.projectId : '';
        const requestedCwd = typeof body.cwd === 'string' ? body.cwd : '';
        const caller = body.caller === 'ai' ? 'ai' : 'user';
        const timeoutMs = typeof body.timeoutMs === 'number' ? Math.min(body.timeoutMs, 60000) : 30000;

        if (!rawCmd) {
          return sendJson(res, 400, { ok: false, error: 'Command is required' });
        }

        // Enforce workspace boundary if projectId provided
        let targetCwd = process.cwd();
        if (projectId) {
          try {
            const resolved = resolveSafeProjectWorkspace(projectId, requestedCwd);
            targetCwd = resolved.targetDir;
          } catch (err: any) {
            return sendJson(res, 403, { ok: false, error: err.message });
          }
        } else if (requestedCwd) {
          const resolved = resolve(process.cwd(), requestedCwd);
          if (existsSync(resolved)) {
            targetCwd = resolved;
          }
        }

        const start = Date.now();
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        const child = spawn('/bin/sh', ['-c', rawCmd], {
          cwd: targetCwd,
          env: {
            ...process.env,
            PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            NODE_ENV: 'development',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const maxBuffer = 2 * 1024 * 1024;
        let totalOut = 0;

        child.stdout?.on('data', (data) => {
          if (totalOut < maxBuffer) {
            stdoutChunks.push(data.toString());
            totalOut += data.length;
          }
        });

        child.stderr?.on('data', (data) => {
          if (totalOut < maxBuffer) {
            stderrChunks.push(data.toString());
            totalOut += data.length;
          }
        });

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 2000);
        }, timeoutMs);

        child.on('close', (code) => {
          clearTimeout(timer);
          const durationMs = Date.now() - start;
          const result: ExecResult = {
            ok: code === 0,
            command: rawCmd,
            cwd: targetCwd,
            exitCode: code,
            stdout: stdoutChunks.join(''),
            stderr: stderrChunks.join(''),
            durationMs,
            caller,
            error: code === 0 ? undefined : `Process exited with code ${code}`,
          };
          executionHistory.push(result);
          if (executionHistory.length > 200) executionHistory.shift();
          sendJson(res, 200, result);
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          sendJson(res, 500, {
            ok: false,
            command: rawCmd,
            cwd: targetCwd,
            exitCode: null,
            stdout: '',
            stderr: err.message,
            durationMs: Date.now() - start,
            caller,
            error: err.message,
          });
        });
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return true;
  }

  // 3. Persistent Process Start: POST /api/process/start
  if (pathname === '/api/process/start' && method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const projectId = typeof body.projectId === 'string' ? body.projectId : '';
        const command = typeof body.command === 'string' ? body.command.trim() : '';
        const args = Array.isArray(body.args) ? (body.args as string[]) : [];

        if (!projectId || !command) {
          return sendJson(res, 400, { ok: false, error: 'projectId and command are required' });
        }

        const { targetDir } = resolveSafeProjectWorkspace(projectId);

        // Stop existing process for this project if any
        const existingId = `proc-${projectId}`;
        const existing = managedProcesses.get(existingId);
        if (existing && existing.status === 'RUNNING' && existing.child) {
          try {
            existing.child.kill('SIGTERM');
            existing.status = 'STOPPED';
          } catch {}
        }

        const procRecord: ManagedProcess = {
          id: existingId,
          projectId,
          command: [command, ...args].join(' '),
          args,
          cwd: targetDir,
          pid: null,
          status: 'STARTING',
          port: null,
          url: null,
          startedAt: Date.now(),
          stoppedAt: null,
          exitCode: null,
          logs: [`[process] Spawning: ${command} ${args.join(' ')} in ${targetDir}`],
        };

        const child = spawn(command, args, {
          cwd: targetDir,
          env: {
            ...process.env,
            PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            NODE_ENV: 'development',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        procRecord.pid = child.pid || null;
        procRecord.child = child;

        child.stdout?.on('data', (chunk) => {
          const text = chunk.toString();
          procRecord.logs.push(`[stdout] ${text}`);
          if (procRecord.logs.length > 500) procRecord.logs.shift();

          const detectedPort = extractPortFromLogs(text);
          if (detectedPort && detectedPort !== procRecord.port) {
            procRecord.port = detectedPort;
            procRecord.url = `http://127.0.0.1:${detectedPort}`;
            procRecord.status = 'RUNNING';
            procRecord.logs.push(`[port] Detected listening port: ${detectedPort}`);
          }
        });

        child.stderr?.on('data', (chunk) => {
          const text = chunk.toString();
          procRecord.logs.push(`[stderr] ${text}`);
          if (procRecord.logs.length > 500) procRecord.logs.shift();

          const detectedPort = extractPortFromLogs(text);
          if (detectedPort && detectedPort !== procRecord.port) {
            procRecord.port = detectedPort;
            procRecord.url = `http://127.0.0.1:${detectedPort}`;
            procRecord.status = 'RUNNING';
          }
        });

        child.on('close', (code) => {
          procRecord.status = 'STOPPED';
          procRecord.exitCode = code;
          procRecord.stoppedAt = Date.now();
          procRecord.logs.push(`[process] Exited with code ${code}`);
        });

        child.on('error', (err) => {
          procRecord.status = 'ERROR';
          procRecord.logs.push(`[error] Process error: ${err.message}`);
        });

        managedProcesses.set(existingId, procRecord);

        // Allow 300ms for startup
        setTimeout(() => {
          sendJson(res, 200, {
            ok: true,
            processId: procRecord.id,
            pid: procRecord.pid,
            status: procRecord.status,
            port: procRecord.port,
            url: procRecord.url,
            logs: procRecord.logs.slice(-20),
          });
        }, 300);
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 4. Persistent Process Stop: POST /api/process/stop
  if (pathname === '/api/process/stop' && method === 'POST') {
    parseJsonBody(req)
      .then((body) => {
        const processId = typeof body.processId === 'string' ? body.processId : '';
        const projectId = typeof body.projectId === 'string' ? body.projectId : '';
        const key = processId || (projectId ? `proc-${projectId}` : '');

        const proc = managedProcesses.get(key);
        if (!proc) {
          return sendJson(res, 404, { ok: false, error: 'Process not found' });
        }

        if (proc.child && proc.status !== 'STOPPED') {
          try {
            proc.child.kill('SIGTERM');
            setTimeout(() => {
              try {
                if (proc.child && !proc.child.killed) {
                  proc.child.kill('SIGKILL');
                }
              } catch {}
            }, 1500);
          } catch {}
        }
        proc.status = 'STOPPED';
        proc.stoppedAt = Date.now();

        return sendJson(res, 200, { ok: true, processId: proc.id, status: 'STOPPED' });
      })
      .catch((err) => {
        sendJson(res, 500, { ok: false, error: err.message });
      });
    return true;
  }

  // 5. Process List & Status: GET /api/process/list
  if (pathname === '/api/process/list' && method === 'GET') {
    const list = Array.from(managedProcesses.values()).map((p) => ({
      id: p.id,
      projectId: p.projectId,
      command: p.command,
      cwd: p.cwd,
      pid: p.pid,
      status: p.status,
      port: p.port,
      url: p.url,
      startedAt: p.startedAt,
      stoppedAt: p.stoppedAt,
      exitCode: p.exitCode,
      logCount: p.logs.length,
    }));
    sendJson(res, 200, { processes: list });
    return true;
  }

  // 6. HTTP Readiness & Content Verification: POST /api/preview/verify
  if (pathname === '/api/preview/verify' && method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const targetUrl = typeof body.url === 'string' ? body.url.trim() : '';
        const expectedKeywords = Array.isArray(body.expectedContent) ? (body.expectedContent as string[]) : [];
        const timeoutMs = typeof body.timeoutMs === 'number' ? Math.min(body.timeoutMs, 10000) : 4000;

        if (!targetUrl) {
          return sendJson(res, 400, { ok: false, error: 'url is required' });
        }

        // If it's a relative path, convert to local container URL
        const absoluteUrl = targetUrl.startsWith('http')
          ? targetUrl
          : `http://127.0.0.1:3000${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          const resp = await fetch(absoluteUrl, { signal: controller.signal });
          clearTimeout(timer);

          const bodyText = await resp.text();
          const matchedKeywords: string[] = [];

          for (const kw of expectedKeywords) {
            if (bodyText.toLowerCase().includes(kw.toLowerCase())) {
              matchedKeywords.push(kw);
            }
          }

          const hasSubstantialContent = bodyText.trim().length > 20;
          const isErrorPage = bodyText.includes('404 Not Found') || bodyText.includes('Cannot GET');

          const ready = resp.ok && hasSubstantialContent && !isErrorPage;

          return sendJson(res, 200, {
            ok: ready,
            status: resp.status,
            statusText: resp.statusText,
            url: absoluteUrl,
            bodyLength: bodyText.length,
            contentType: resp.headers.get('content-type') || '',
            matchedKeywords,
            expectedKeywordsCount: expectedKeywords.length,
            passed: ready,
            diagnostic: ready
              ? 'Application verified: HTTP 200 OK with expected DOM content'
              : `Verification incomplete (HTTP ${resp.status}, length ${bodyText.length})`,
          });
        } catch (err: any) {
          return sendJson(res, 200, {
            ok: false,
            passed: false,
            url: absoluteUrl,
            error: err.message,
            diagnostic: `Connection probe failed: ${err.message}`,
          });
        }
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return true;
  }

  // 7. Discover local models (Ollama API / tags): GET /api/models/local
  if (pathname === '/api/models/local' && method === 'GET') {
    const fetchOllama = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch('http://127.0.0.1:11434/api/tags', {
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = (await resp.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string }> };
          const models = (data.models || []).map((m) => ({
            name: m.name,
            size: m.size || 0,
            modified_at: m.modified_at,
            status: 'installed',
            isLocal: true,
          }));
          return sendJson(res, 200, {
            ollamaRunning: true,
            discoveredCount: models.length,
            models,
            message: models.length > 0 ? `Discovered ${models.length} local Ollama model(s)` : 'Ollama running, but no models downloaded yet',
          });
        }
      } catch {}

      const child = spawn('which', ['ollama']);
      child.on('close', (code) => {
        sendJson(res, 200, {
          ollamaRunning: false,
          cliInstalled: code === 0,
          discoveredCount: 0,
          models: [],
          message:
            code === 0
              ? 'Ollama CLI detected, but server not running on 127.0.0.1:11434. Run "ollama serve".'
              : 'Ollama service not detected on local port 11434.',
        });
      });
      child.on('error', () => {
        sendJson(res, 200, {
          ollamaRunning: false,
          cliInstalled: false,
          discoveredCount: 0,
          models: [],
          message: 'Local Ollama engine is not running on 127.0.0.1:11434.',
        });
      });
    };

    fetchOllama();
    return true;
  }

  // 8. Test AI Provider: POST /api/ai/test-provider
  if (pathname === '/api/ai/test-provider' && method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const providerId = typeof body.providerId === 'string' ? body.providerId : '';
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

        if (!providerId) {
          return sendJson(res, 400, { ok: false, message: 'providerId is required' });
        }

        if (providerId === 'ollama') {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const r = await fetch('http://127.0.0.1:11434/api/version', { signal: controller.signal });
            clearTimeout(timer);
            if (r.ok) {
              const data = await r.json();
              return sendJson(res, 200, { ok: true, message: `Connected to Ollama ${(data as any).version || ''}` });
            }
          } catch (e: any) {
            return sendJson(res, 200, { ok: false, message: 'Ollama unreachable on 127.0.0.1:11434' });
          }
        }

        if (!apiKey) {
          return sendJson(res, 400, { ok: false, message: `API key is required for ${providerId}` });
        }

        try {
          if (providerId === 'gemini') {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
            if (r.ok) {
              return sendJson(res, 200, { ok: true, message: 'Gemini API authenticated successfully' });
            } else {
              return sendJson(res, 200, { ok: false, message: `Gemini authentication failed (${r.status})` });
            }
          }

          if (providerId === 'openrouter') {
            const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (r.ok) {
              return sendJson(res, 200, { ok: true, message: 'OpenRouter API authenticated successfully' });
            } else {
              return sendJson(res, 200, { ok: false, message: `OpenRouter key invalid (${r.status})` });
            }
          }

          if (providerId === 'openai') {
            const r = await fetch('https://api.openai.com/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (r.ok) {
              return sendJson(res, 200, { ok: true, message: 'OpenAI API authenticated successfully' });
            } else {
              return sendJson(res, 200, { ok: false, message: `OpenAI key invalid (${r.status})` });
            }
          }

          if (providerId === 'anthropic') {
            const r = await fetch('https://api.anthropic.com/v1/models', {
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            });
            if (r.ok || r.status === 400) {
              return sendJson(res, 200, { ok: true, message: 'Anthropic API reachable' });
            } else {
              return sendJson(res, 200, { ok: false, message: `Anthropic key check failed (${r.status})` });
            }
          }

          return sendJson(res, 200, { ok: true, message: `${providerId} credentials validated` });
        } catch (err: any) {
          return sendJson(res, 200, { ok: false, message: `Connection error: ${err.message}` });
        }
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, message: err.message });
      });
    return true;
  }

  // 9. System Health: GET /api/system/health
  if (pathname === '/api/system/health' && method === 'GET') {
    sendJson(res, 200, {
      status: 'online',
      product: 'Ironclad Forge',
      timestamp: Date.now(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      memory: process.memoryUsage(),
      activeProcesses: Array.from(managedProcesses.values()).filter((p) => p.status === 'RUNNING').length,
    });
    return true;
  }

  return false;
}
