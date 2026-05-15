import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LevelEditor, type LevelEditorOptions } from '../LevelEditor.js';

interface MockResp {
  status: number;
  body: unknown;
}

function makeFetch(responses: Record<string, MockResp | MockResp[]>): typeof fetch {
  const calls: Record<string, number> = {};
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${url}`;
    const matched = responses[key];
    if (!matched) {
      throw new Error(`unexpected fetch: ${key}`);
    }
    let resp: MockResp;
    if (Array.isArray(matched)) {
      const idx = calls[key] ?? 0;
      const picked = matched[Math.min(idx, matched.length - 1)];
      if (!picked) throw new Error(`mock array empty for ${key}`);
      resp = picked;
      calls[key] = idx + 1;
    } else {
      resp = matched;
    }
    return new Response(JSON.stringify(resp.body), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

function makeEditor(fetchImpl: typeof fetch, opts: Partial<LevelEditorOptions> = {}): LevelEditor {
  return new LevelEditor({ fetch: fetchImpl, baseUrl: '/__editor', ...opts });
}

describe('LevelEditor: state machine', () => {
  it('starts in idle status with empty list', () => {
    const editor = makeEditor(makeFetch({}));
    expect(editor.status).toBe('idle');
    expect(editor.list).toEqual([]);
    expect(editor.currentId).toBe(null);
    expect(editor.currentContent).toBe(null);
  });

  it('emits change event on status transitions', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels': { status: 200, body: { levels: [] } },
    });
    const editor = makeEditor(fetchImpl);
    const events: string[] = [];
    editor.addEventListener('change', () => events.push(editor.status));
    await editor.refreshList();
    expect(events).toContain('loading');
    expect(events[events.length - 1]).toBe('idle');
  });
});

describe('LevelEditor: refreshList()', () => {
  let fetchImpl: typeof fetch;

  beforeEach(() => {
    fetchImpl = makeFetch({
      'GET /__editor/levels': {
        status: 200,
        body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }, { id: 'level_02', filename: 'level_02.yaml' }] },
      },
    });
  });

  it('populates list on success', async () => {
    const editor = makeEditor(fetchImpl);
    const result = await editor.refreshList();
    expect(result.ok).toBe(true);
    expect(editor.list).toHaveLength(2);
    expect(editor.list[0]?.id).toBe('level_01');
  });

  it('returns error result on server error', async () => {
    const errFetch = makeFetch({
      'GET /__editor/levels': { status: 500, body: { error: 'internal_error' } },
    });
    const editor = makeEditor(errFetch);
    const result = await editor.refreshList();
    expect(result.ok).toBe(false);
    expect(editor.status).toBe('error');
    if (!result.ok) {
      expect(result.error).toMatch(/internal_error|500/);
    }
  });
});

describe('LevelEditor: loadLevel(id)', () => {
  it('fetches content and sets currentId/currentContent', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'id: level_01\nname: Plains\n', mtime: 123 } },
    });
    const editor = makeEditor(fetchImpl);
    const result = await editor.loadLevel('level_01');
    expect(result.ok).toBe(true);
    expect(editor.currentId).toBe('level_01');
    expect(editor.currentContent).toBe('id: level_01\nname: Plains\n');
  });

  it('returns 404 error and does not pollute current state', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/missing': { status: 404, body: { error: 'not_found' } },
    });
    const editor = makeEditor(fetchImpl);
    const result = await editor.loadLevel('missing');
    expect(result.ok).toBe(false);
    expect(editor.currentId).toBe(null);
    expect(editor.currentContent).toBe(null);
  });
});

describe('LevelEditor: saveCurrent()', () => {
  it('PUTs current content and updates mtime', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'old\n', mtime: 100 } },
      'PUT /__editor/levels/level_01': { status: 200, body: { id: 'level_01', mtime: 200 } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('level_01');
    editor.setCurrentContent('new\n');
    const result = await editor.saveCurrent();
    expect(result.ok).toBe(true);
    expect(editor.currentMtime).toBe(200);
    expect(editor.isDirty).toBe(false);
  });

  it('fails when nothing is loaded', async () => {
    const editor = makeEditor(makeFetch({}));
    const result = await editor.saveCurrent();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/no_current/);
    }
  });

  it('marks dirty after setCurrentContent and clears after save', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'old\n', mtime: 100 } },
      'PUT /__editor/levels/level_01': { status: 200, body: { id: 'level_01', mtime: 200 } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('level_01');
    expect(editor.isDirty).toBe(false);
    editor.setCurrentContent('new\n');
    expect(editor.isDirty).toBe(true);
    await editor.saveCurrent();
    expect(editor.isDirty).toBe(false);
  });

  it('setCurrentContent with same content does not mark dirty', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'same\n', mtime: 100 } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('level_01');
    editor.setCurrentContent('same\n');
    expect(editor.isDirty).toBe(false);
  });
});

describe('LevelEditor: duplicate + delete', () => {
  it('duplicate POSTs to /:id/dup', async () => {
    const fetchImpl = makeFetch({
      'POST /__editor/levels/level_01/dup': { status: 200, body: { id: 'level_02', mtime: 300 } },
    });
    const editor = makeEditor(fetchImpl);
    const result = await editor.duplicate('level_01', 'level_02');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('level_02');
    }
  });

  it('delete DELETEs /:id', async () => {
    const fetchImpl = makeFetch({
      'DELETE /__editor/levels/level_01': { status: 200, body: { id: 'level_01', trashed: 'level_01.2026-05-13.yaml' } },
    });
    const editor = makeEditor(fetchImpl);
    const result = await editor.delete('level_01');
    expect(result.ok).toBe(true);
  });

  it('delete clears currentId if deleting the active level', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
      'DELETE /__editor/levels/level_01': { status: 200, body: { id: 'level_01', trashed: 'x' } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('level_01');
    expect(editor.currentId).toBe('level_01');
    await editor.delete('level_01');
    expect(editor.currentId).toBe(null);
    expect(editor.currentContent).toBe(null);
  });
});

describe('LevelEditor: lastError', () => {
  it('starts as null', () => {
    const editor = makeEditor(makeFetch({}));
    expect(editor.lastError).toBe(null);
  });

  it('is populated after refreshList fails', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels': { status: 500, body: { error: 'internal_error' } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.refreshList();
    expect(editor.status).toBe('error');
    expect(editor.lastError).toMatch(/internal_error/);
  });

  it('is populated after loadLevel fails', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/missing': { status: 404, body: { error: 'not_found' } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('missing');
    expect(editor.lastError).toMatch(/not_found/);
  });

  it('is populated after duplicate fails', async () => {
    const fetchImpl = makeFetch({
      'POST /__editor/levels/level_01/dup': { status: 409, body: { error: 'target_exists' } },
    });
    const editor = makeEditor(fetchImpl);
    const result = await editor.duplicate('level_01', 'level_02');
    expect(result.ok).toBe(false);
    expect(editor.lastError).toMatch(/target_exists/);
    expect(editor.status).toBe('error');
  });

  it('is populated after delete fails', async () => {
    const fetchImpl = makeFetch({
      'DELETE /__editor/levels/level_01': { status: 404, body: { error: 'not_found' } },
    });
    const editor = makeEditor(fetchImpl);
    const result = await editor.delete('level_01');
    expect(result.ok).toBe(false);
    expect(editor.lastError).toMatch(/not_found/);
    expect(editor.status).toBe('error');
  });

  it('is populated after saveCurrent fails (and cleared on subsequent success)', async () => {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
      'PUT /__editor/levels/level_01': [
        { status: 409, body: { error: 'mtime_conflict' } },
        { status: 200, body: { id: 'level_01', mtime: 200 } },
      ],
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('level_01');
    editor.setCurrentContent('y\n');
    const failed = await editor.saveCurrent();
    expect(failed.ok).toBe(false);
    expect(editor.lastError).toMatch(/mtime_conflict/);

    const succeeded = await editor.saveCurrent();
    expect(succeeded.ok).toBe(true);
    expect(editor.lastError).toBe(null);
    expect(editor.status).toBe('idle');
  });
});

describe('LevelEditor: undo/redo history (Phase F)', () => {
  async function makeLoadedEditor(): Promise<LevelEditor> {
    const fetchImpl = makeFetch({
      'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'id: level_01\n', mtime: 1 } },
    });
    const editor = makeEditor(fetchImpl);
    await editor.loadLevel('level_01');
    return editor;
  }

  it('canUndo is false before any edit', async () => {
    const editor = await makeLoadedEditor();
    expect(editor.canUndo).toBe(false);
  });

  it('canRedo is false before any undo', async () => {
    const editor = await makeLoadedEditor();
    expect(editor.canRedo).toBe(false);
  });

  it('canUndo becomes true after setCurrentContent', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('id: level_01\nname: A\n');
    expect(editor.canUndo).toBe(true);
  });

  it('undo restores previous content', async () => {
    const editor = await makeLoadedEditor();
    const original = editor.currentContent!;
    editor.setCurrentContent('id: level_01\nname: A\n');
    editor.undo();
    expect(editor.currentContent).toBe(original);
  });

  it('undo fires change event', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('id: level_01\nname: A\n');
    let fired = false;
    editor.addEventListener('change', () => { fired = true; });
    editor.undo();
    expect(fired).toBe(true);
  });

  it('canRedo is true after undo', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('id: level_01\nname: A\n');
    editor.undo();
    expect(editor.canRedo).toBe(true);
  });

  it('redo restores undone content', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('id: level_01\nname: A\n');
    const edited = editor.currentContent!;
    editor.undo();
    editor.redo();
    expect(editor.currentContent).toBe(edited);
  });

  it('new edit clears redo stack', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('id: level_01\nname: A\n');
    editor.undo();
    editor.setCurrentContent('id: level_01\nname: B\n');
    expect(editor.canRedo).toBe(false);
  });

  it('undo after loadLevel is a no-op', async () => {
    const editor = await makeLoadedEditor();
    const content = editor.currentContent!;
    editor.undo();
    expect(editor.currentContent).toBe(content);
    expect(editor.canUndo).toBe(false);
  });

  it('history is capped at 50 entries', async () => {
    const editor = await makeLoadedEditor();
    for (let i = 0; i < 60; i++) {
      editor.setCurrentContent(`id: v${i}\n`);
    }
    let undoCount = 0;
    while (editor.canUndo) {
      editor.undo();
      undoCount++;
    }
    expect(undoCount).toBe(50);
  });

  it('multiple undos traverse full history', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('v1\n');
    editor.setCurrentContent('v2\n');
    editor.setCurrentContent('v3\n');
    editor.undo();
    expect(editor.currentContent).toBe('v2\n');
    editor.undo();
    expect(editor.currentContent).toBe('v1\n');
    editor.undo();
    expect(editor.currentContent).toBe('id: level_01\n');
  });

  it('isDirty reflects correctly after undo back to loaded state', async () => {
    const editor = await makeLoadedEditor();
    editor.setCurrentContent('id: level_01\nname: A\n');
    expect(editor.isDirty).toBe(true);
    editor.undo();
    expect(editor.isDirty).toBe(false);
  });
});
