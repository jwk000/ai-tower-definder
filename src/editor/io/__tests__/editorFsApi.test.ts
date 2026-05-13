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

describe('editor-fs-api: PUT /__editor/levels/:id (write endpoint)', () => {
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

  it('creates a new YAML file when level does not exist', async () => {
    const body = JSON.stringify({ content: 'id: level_99\nname: Test\n' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'write', id: 'level_99' }, ctx, { body }, res);
    expect(res.statusCode).toBe(200);
    const written = await fs.readFile(path.join(ctx.levelsDir, 'level_99.yaml'), 'utf-8');
    expect(written).toBe('id: level_99\nname: Test\n');
    const payload = res.json<{ id: string; mtime: number }>();
    expect(payload.id).toBe('level_99');
    expect(typeof payload.mtime).toBe('number');
  });

  it('overwrites existing YAML atomically', async () => {
    await seedLevel(ctx, 'level_01', 'id: level_01\nname: Old\n');
    const body = JSON.stringify({ content: 'id: level_01\nname: New\n' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body }, res);
    expect(res.statusCode).toBe(200);
    const written = await fs.readFile(path.join(ctx.levelsDir, 'level_01.yaml'), 'utf-8');
    expect(written).toBe('id: level_01\nname: New\n');
  });

  it('preserves byte-for-byte content', async () => {
    const yaml = 'id: level_01\n# comment\n\nname: Plains\n\n';
    const body = JSON.stringify({ content: yaml });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body }, res);
    const written = await fs.readFile(path.join(ctx.levelsDir, 'level_01.yaml'), 'utf-8');
    expect(written).toBe(yaml);
  });

  it('rejects 400 when body is missing or malformed', async () => {
    {
      const res = new MockResponse();
      await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body: undefined }, res);
      expect(res.statusCode).toBe(400);
    }
    {
      const res = new MockResponse();
      await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body: 'not json' }, res);
      expect(res.statusCode).toBe(400);
    }
    {
      const res = new MockResponse();
      await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body: '{}' }, res);
      expect(res.statusCode).toBe(400);
    }
    {
      const res = new MockResponse();
      const body = JSON.stringify({ content: 42 });
      await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects content exceeding size limit', async () => {
    const huge = 'x'.repeat(2 * 1024 * 1024 + 1);
    const body = JSON.stringify({ content: huge });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body }, res);
    expect(res.statusCode).toBe(413);
  });

  it('uses tmp + rename (no partial file visible)', async () => {
    await seedLevel(ctx, 'level_01', 'id: level_01\nname: Old\n');
    const body = JSON.stringify({ content: 'id: level_01\nname: New\n' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'write', id: 'level_01' }, ctx, { body }, res);
    expect(res.statusCode).toBe(200);
    const dirEntries = await fs.readdir(ctx.levelsDir);
    const tmpFiles = dirEntries.filter((n) => n.includes('.tmp') || n.endsWith('~'));
    expect(tmpFiles).toEqual([]);
  });
});

describe('editor-fs-api: DELETE /__editor/levels/:id (delete endpoint)', () => {
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

  it('moves deleted file to .editor-trash and removes original', async () => {
    const yaml = 'id: level_01\nname: ToDelete\n';
    await seedLevel(ctx, 'level_01', yaml);
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'delete', id: 'level_01' }, ctx, {}, res);
    expect(res.statusCode).toBe(200);
    await expect(
      fs.access(path.join(ctx.levelsDir, 'level_01.yaml')),
    ).rejects.toThrow();
    const trashEntries = await fs.readdir(ctx.trashDir);
    const backup = trashEntries.find((n) => n.startsWith('level_01.') && n.endsWith('.yaml'));
    expect(backup).toBeDefined();
    const backupContent = await fs.readFile(path.join(ctx.trashDir, backup!), 'utf-8');
    expect(backupContent).toBe(yaml);
  });

  it('returns 404 when level does not exist', async () => {
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'delete', id: 'missing' }, ctx, {}, res);
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toBe('not_found');
  });

  it('creates trash directory on demand', async () => {
    await seedLevel(ctx, 'level_01', 'id: level_01\n');
    await expect(fs.access(ctx.trashDir)).rejects.toThrow();
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'delete', id: 'level_01' }, ctx, {}, res);
    expect(res.statusCode).toBe(200);
    const entries = await fs.readdir(ctx.trashDir);
    expect(entries.length).toBe(1);
  });

  it('handles multiple deletes of same id without collision', async () => {
    await seedLevel(ctx, 'level_01', 'first\n');
    const res1 = new MockResponse();
    await dispatchEditorRequest({ kind: 'delete', id: 'level_01' }, ctx, {}, res1);
    expect(res1.statusCode).toBe(200);
    await seedLevel(ctx, 'level_01', 'second\n');
    await new Promise((r) => setTimeout(r, 5));
    const res2 = new MockResponse();
    await dispatchEditorRequest({ kind: 'delete', id: 'level_01' }, ctx, {}, res2);
    expect(res2.statusCode).toBe(200);
    const trashEntries = await fs.readdir(ctx.trashDir);
    expect(trashEntries.length).toBe(2);
    const contents = await Promise.all(
      trashEntries.map((n) => fs.readFile(path.join(ctx.trashDir, n), 'utf-8')),
    );
    expect(contents.sort()).toEqual(['first\n', 'second\n']);
  });
});

describe('editor-fs-api: POST /__editor/levels/:id/dup (duplicate endpoint)', () => {
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

  it('copies source level to target id', async () => {
    const yaml = 'id: level_01\nname: Source\n';
    await seedLevel(ctx, 'level_01', yaml);
    const body = JSON.stringify({ targetId: 'level_02' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body }, res);
    expect(res.statusCode).toBe(200);
    const written = await fs.readFile(path.join(ctx.levelsDir, 'level_02.yaml'), 'utf-8');
    expect(written).toBe(yaml);
    const payload = res.json<{ id: string; mtime: number }>();
    expect(payload.id).toBe('level_02');
    expect(typeof payload.mtime).toBe('number');
  });

  it('returns 404 when source does not exist', async () => {
    const body = JSON.stringify({ targetId: 'level_02' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'duplicate', id: 'missing' }, ctx, { body }, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when target already exists', async () => {
    await seedLevel(ctx, 'level_01', 'source\n');
    await seedLevel(ctx, 'level_02', 'existing\n');
    const body = JSON.stringify({ targetId: 'level_02' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body }, res);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toBe('target_exists');
    const target = await fs.readFile(path.join(ctx.levelsDir, 'level_02.yaml'), 'utf-8');
    expect(target).toBe('existing\n');
  });

  it('rejects 400 when targetId missing or invalid', async () => {
    await seedLevel(ctx, 'level_01', 'source\n');
    {
      const res = new MockResponse();
      await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body: undefined }, res);
      expect(res.statusCode).toBe(400);
    }
    {
      const res = new MockResponse();
      const body = JSON.stringify({ targetId: 'BadId' });
      await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body }, res);
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toBe('invalid_target_id');
    }
    {
      const res = new MockResponse();
      const body = JSON.stringify({ targetId: '../escape' });
      await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body }, res);
      expect(res.statusCode).toBe(400);
    }
    {
      const res = new MockResponse();
      const body = JSON.stringify({});
      await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects 400 when source and target ids are identical', async () => {
    await seedLevel(ctx, 'level_01', 'source\n');
    const body = JSON.stringify({ targetId: 'level_01' });
    const res = new MockResponse();
    await dispatchEditorRequest({ kind: 'duplicate', id: 'level_01' }, ctx, { body }, res);
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe('same_id');
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
