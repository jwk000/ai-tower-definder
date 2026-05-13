import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  dispatchEditorRequest,
  parseEditorRoute,
  resolveLevelPath,
  isValidLevelId,
  type HandlerContext,
} from '../../../../vite-plugins/editor-fs-api.js';

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  end(body?: string): void {
    this.body = body ?? '';
  }
  json<T = unknown>(): T {
    return JSON.parse(this.body) as T;
  }
}

async function makeSandbox(): Promise<{ ctx: HandlerContext; cleanup: () => Promise<void> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'editor-fs-api-'));
  const levelsDir = path.join(root, 'levels');
  const trashDir = path.join(root, 'trash');
  await fs.mkdir(levelsDir, { recursive: true });
  return {
    ctx: { levelsDir, trashDir },
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

async function seedLevel(ctx: HandlerContext, id: string, content: string): Promise<void> {
  await fs.writeFile(path.join(ctx.levelsDir, `${id}.yaml`), content, 'utf-8');
}

describe('editor-fs-api: pure helpers', () => {
  describe('isValidLevelId', () => {
    it('accepts lowercase alnum + dash + underscore', () => {
      expect(isValidLevelId('level_01')).toBe(true);
      expect(isValidLevelId('level-01')).toBe(true);
      expect(isValidLevelId('abc123')).toBe(true);
    });
    it('rejects uppercase, dots, slashes, traversal', () => {
      expect(isValidLevelId('Level01')).toBe(false);
      expect(isValidLevelId('level.01')).toBe(false);
      expect(isValidLevelId('level/01')).toBe(false);
      expect(isValidLevelId('../level')).toBe(false);
      expect(isValidLevelId('level..')).toBe(false);
    });
    it('rejects empty and overlong', () => {
      expect(isValidLevelId('')).toBe(false);
      expect(isValidLevelId('a'.repeat(65))).toBe(false);
      expect(isValidLevelId('a'.repeat(64))).toBe(true);
    });
    it('rejects non-string', () => {
      expect(isValidLevelId(null)).toBe(false);
      expect(isValidLevelId(undefined)).toBe(false);
      expect(isValidLevelId(123)).toBe(false);
    });
  });

  describe('resolveLevelPath — path traversal defense', () => {
    const levelsDir = '/tmp/fake-levels';
    it('resolves valid id to direct child path', () => {
      const p = resolveLevelPath(levelsDir, 'level_01');
      expect(p).toBe(path.resolve(levelsDir, 'level_01.yaml'));
    });
    it('rejects ids that would escape via traversal', () => {
      expect(resolveLevelPath(levelsDir, '../etc')).toBeNull();
      expect(resolveLevelPath(levelsDir, '..')).toBeNull();
    });
    it('rejects invalid ids', () => {
      expect(resolveLevelPath(levelsDir, 'BAD')).toBeNull();
      expect(resolveLevelPath(levelsDir, '')).toBeNull();
    });
  });
});

describe('editor-fs-api: parseEditorRoute', () => {
  it('returns null for non-editor URLs', () => {
    expect(parseEditorRoute('GET', '/api/foo')).toBeNull();
    expect(parseEditorRoute('GET', '/')).toBeNull();
  });
  it('parses GET /__editor/levels as list', () => {
    expect(parseEditorRoute('GET', '/__editor/levels')).toEqual({ kind: 'list' });
    expect(parseEditorRoute('GET', '/__editor/levels/')).toEqual({ kind: 'list' });
    expect(parseEditorRoute('GET', '/__editor/levels?foo=bar')).toEqual({ kind: 'list' });
  });
  it('rejects POST /__editor/levels with 405', () => {
    expect(parseEditorRoute('POST', '/__editor/levels')).toEqual({
      kind: 'invalid',
      reason: 'method_not_allowed',
    });
  });
  it('parses GET/PUT/DELETE /__editor/levels/:id', () => {
    expect(parseEditorRoute('GET', '/__editor/levels/level_01')).toEqual({
      kind: 'read', id: 'level_01',
    });
    expect(parseEditorRoute('PUT', '/__editor/levels/level_01')).toEqual({
      kind: 'write', id: 'level_01',
    });
    expect(parseEditorRoute('DELETE', '/__editor/levels/level_01')).toEqual({
      kind: 'delete', id: 'level_01',
    });
  });
  it('parses POST /__editor/levels/:id/dup', () => {
    expect(parseEditorRoute('POST', '/__editor/levels/level_01/dup')).toEqual({
      kind: 'duplicate', id: 'level_01',
    });
  });
  it('rejects invalid level id in path', () => {
    expect(parseEditorRoute('GET', '/__editor/levels/BadId')).toEqual({
      kind: 'invalid', reason: 'invalid_id',
    });
    expect(parseEditorRoute('GET', '/__editor/levels/level..')).toEqual({
      kind: 'invalid', reason: 'invalid_id',
    });
  });
  it('rejects unknown nested routes', () => {
    expect(parseEditorRoute('GET', '/__editor/levels/level_01/foo')).toEqual({
      kind: 'invalid', reason: 'unknown_route',
    });
    expect(parseEditorRoute('GET', '/__editor/unknown')).toEqual({
      kind: 'invalid', reason: 'unknown_route',
    });
  });
});

describe('editor-fs-api: GET /__editor/levels (list endpoint)', () => {
  let ctx: HandlerContext;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const sandbox = await makeSandbox();
    ctx = sandbox.ctx;
    cleanup = sandbox.cleanup;
  });
  afterEach(async () => {
    await cleanup();
  });

  it('returns empty array when no levels exist', async () => {
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'list' }, ctx, {}, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('application/json');
    expect(res.json<{ levels: unknown[] }>().levels).toEqual([]);
  });

  it('lists all yaml files with id+filename', async () => {
    await seedLevel(ctx, 'level_01', 'id: level_01\nname: Plains\n');
    await seedLevel(ctx, 'level_02', 'id: level_02\nname: Forest\n');
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'list' }, ctx, {}, res);
    expect(res.statusCode).toBe(200);
    const { levels } = res.json<{ levels: Array<{ id: string; filename: string }> }>();
    expect(levels).toHaveLength(2);
    expect(levels.map((l) => l.id).sort()).toEqual(['level_01', 'level_02']);
    expect(levels[0]!.filename).toMatch(/\.yaml$/);
  });

  it('ignores non-yaml files and invalid ids in the directory', async () => {
    await seedLevel(ctx, 'level_01', 'id: level_01\n');
    await fs.writeFile(path.join(ctx.levelsDir, 'README.md'), 'docs', 'utf-8');
    await fs.writeFile(path.join(ctx.levelsDir, 'BAD.yaml'), 'invalid', 'utf-8');
    await fs.writeFile(path.join(ctx.levelsDir, 'foo.txt'), 'no', 'utf-8');
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'list' }, ctx, {}, res);
    const { levels } = res.json<{ levels: Array<{ id: string }> }>();
    expect(levels.map((l) => l.id)).toEqual(['level_01']);
  });

  it('returns 200 with empty array when levelsDir does not exist', async () => {
    const missingCtx: HandlerContext = {
      levelsDir: path.join(ctx.levelsDir, 'does-not-exist'),
      trashDir: ctx.trashDir,
    };
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'list' }, missingCtx, {}, res);
    expect(res.statusCode).toBe(200);
    expect(res.json<{ levels: unknown[] }>().levels).toEqual([]);
  });

  it('returns sorted list', async () => {
    await seedLevel(ctx, 'level_03', '');
    await seedLevel(ctx, 'level_01', '');
    await seedLevel(ctx, 'level_02', '');
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'list' }, ctx, {}, res);
    const { levels } = res.json<{ levels: Array<{ id: string }> }>();
    expect(levels.map((l) => l.id)).toEqual(['level_01', 'level_02', 'level_03']);
  });
});

describe('editor-fs-api: GET /__editor/levels/:id (read endpoint)', () => {
  let ctx: HandlerContext;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const sandbox = await makeSandbox();
    ctx = sandbox.ctx;
    cleanup = sandbox.cleanup;
  });
  afterEach(async () => {
    await cleanup();
  });

  it('returns 200 + raw YAML content for existing level', async () => {
    const yaml = 'id: level_01\nname: Plains\n';
    await seedLevel(ctx, 'level_01', yaml);
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'read', id: 'level_01' }, ctx, {}, res);
    expect(res.statusCode).toBe(200);
    const payload = res.json<{ id: string; content: string; mtime: number }>();
    expect(payload.id).toBe('level_01');
    expect(payload.content).toBe(yaml);
    expect(typeof payload.mtime).toBe('number');
    expect(payload.mtime).toBeGreaterThan(0);
  });

  it('returns 404 when level does not exist', async () => {
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'read', id: 'missing' }, ctx, {}, res);
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toBe('not_found');
  });

  it('preserves byte-for-byte content (no trim)', async () => {
    const yaml = 'id: level_01\n\n# trailing comment\nname: Plains\n\n\n';
    await seedLevel(ctx, 'level_01', yaml);
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'read', id: 'level_01' }, ctx, {}, res);
    expect(res.json<{ content: string }>().content).toBe(yaml);
  });
});

describe('editor-fs-api: dispatch error handling', () => {
  it('returns 405 for invalid method', async () => {
    const sandbox = await makeSandbox();
    const res = new MockResponse();
    await dispatchEditorRequest(
      { kind: 'invalid', reason: 'method_not_allowed' },
      sandbox.ctx,
      {},
      res,
    );
    expect(res.statusCode).toBe(405);
    expect(res.json<{ error: string }>().error).toBe('method_not_allowed');
    await sandbox.cleanup();
  });

  it('returns 400 for invalid id', async () => {
    const sandbox = await makeSandbox();
    const res = new MockResponse();
    await dispatchEditorRequest(
      { kind: 'invalid', reason: 'invalid_id' },
      sandbox.ctx,
      {},
      res,
    );
    expect(res.statusCode).toBe(400);
    await sandbox.cleanup();
  });
});
