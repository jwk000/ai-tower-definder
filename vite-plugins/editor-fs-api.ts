import type { Plugin, Connect } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LEVELS_DIR = path.resolve(PLUGIN_DIR, '..', 'src', 'config', 'levels');
const DEFAULT_TRASH_DIR = path.resolve(PLUGIN_DIR, '..', '.editor-trash');

const ROUTE_PREFIX = '/__editor';
const ID_PATTERN = /^[a-z0-9_-]+$/;
const ID_MAX_LENGTH = 64;

export function isValidLevelId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= ID_MAX_LENGTH && ID_PATTERN.test(id);
}

/**
 * Single chokepoint defending against path traversal: returns the absolute
 * YAML path only if the resolved path is a direct child of levelsDir.
 */
export function resolveLevelPath(levelsDir: string, id: string): string | null {
  if (!isValidLevelId(id)) return null;
  const candidate = path.resolve(levelsDir, `${id}.yaml`);
  if (path.dirname(candidate) !== path.resolve(levelsDir)) return null;
  return candidate;
}

export interface EditorFsApiOptions {
  levelsDir?: string;
  trashDir?: string;
}

export type EditorRoute =
  | { kind: 'list' }
  | { kind: 'read'; id: string }
  | { kind: 'write'; id: string }
  | { kind: 'duplicate'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'invalid'; reason: 'method_not_allowed' | 'unknown_route' | 'invalid_id' };

export function parseEditorRoute(method: string, url: string): EditorRoute | null {
  const cleanUrl = (url.split('?')[0] ?? url).replace(/\/+$/, '') || '/';
  if (!cleanUrl.startsWith(ROUTE_PREFIX)) return null;
  const tail = cleanUrl.slice(ROUTE_PREFIX.length);
  if (tail === '/levels') {
    return method === 'GET' ? { kind: 'list' } : { kind: 'invalid', reason: 'method_not_allowed' };
  }
  const match = tail.match(/^\/levels\/([^/]+)(\/dup)?$/);
  if (!match) return { kind: 'invalid', reason: 'unknown_route' };
  const id = match[1] ?? '';
  const isDup = match[2] === '/dup';
  if (!isValidLevelId(id)) return { kind: 'invalid', reason: 'invalid_id' };
  if (isDup) {
    return method === 'POST' ? { kind: 'duplicate', id } : { kind: 'invalid', reason: 'method_not_allowed' };
  }
  switch (method) {
    case 'GET': return { kind: 'read', id };
    case 'PUT': return { kind: 'write', id };
    case 'DELETE': return { kind: 'delete', id };
    default: return { kind: 'invalid', reason: 'method_not_allowed' };
  }
}

interface ServerResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function sendJson(res: ServerResponseLike, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponseLike, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

export interface HandlerContext {
  levelsDir: string;
  trashDir: string;
}

export async function dispatchEditorRequest(
  route: EditorRoute,
  ctx: HandlerContext,
  _req: { body?: unknown },
  res: ServerResponseLike,
): Promise<void> {
  if (route.kind === 'invalid') {
    sendError(res, route.reason === 'method_not_allowed' ? 405 : 400, route.reason);
    return;
  }
  if ('id' in route && resolveLevelPath(ctx.levelsDir, route.id) === null) {
    sendError(res, 400, 'invalid_id');
    return;
  }
  switch (route.kind) {
    case 'list':
      await handleList(ctx, res);
      return;
    default:
      sendError(res, 501, 'not_implemented');
      return;
  }
}

async function handleList(ctx: HandlerContext, res: ServerResponseLike): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(ctx.levelsDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendJson(res, 200, { levels: [] });
      return;
    }
    throw err;
  }
  const levels = entries
    .filter((name) => name.endsWith('.yaml'))
    .map((filename) => ({ id: filename.slice(0, -'.yaml'.length), filename }))
    .filter((entry) => isValidLevelId(entry.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  sendJson(res, 200, { levels });
}

async function readRequestBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export function editorFsApi(options: EditorFsApiOptions = {}): Plugin {
  const ctx: HandlerContext = {
    levelsDir: path.resolve(options.levelsDir ?? DEFAULT_LEVELS_DIR),
    trashDir: path.resolve(options.trashDir ?? DEFAULT_TRASH_DIR),
  };

  return {
    name: 'editor-fs-api',
    apply: 'serve',
    configureServer(server) {
      const middleware: Connect.NextHandleFunction = async (req, res, next) => {
        const url = req.url ?? '';
        const method = (req.method ?? 'GET').toUpperCase();
        const route = parseEditorRoute(method, url);
        if (route === null) {
          next();
          return;
        }
        try {
          const body = method === 'PUT' || method === 'POST' ? await readRequestBody(req) : undefined;
          await dispatchEditorRequest(route, ctx, { body }, res as unknown as ServerResponseLike);
        } catch (err) {
          console.error('[editor-fs-api] handler error', err);
          if (!res.headersSent) {
            sendError(res as unknown as ServerResponseLike, 500, err instanceof Error ? err.message : 'internal_error');
          }
        }
      };
      server.middlewares.use(middleware);
    },
  };
}

export const __internals = { DEFAULT_LEVELS_DIR, DEFAULT_TRASH_DIR, ROUTE_PREFIX };
