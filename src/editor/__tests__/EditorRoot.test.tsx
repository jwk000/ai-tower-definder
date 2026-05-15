// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { EditorRoot } from '../ui/EditorRoot.js';
import { LevelEditor } from '../LevelEditor.js';
import { parseYamlToModel } from '../state/levelModel.js';

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
    if (!matched) throw new Error(`unexpected fetch: ${key}`);
    let resp: MockResp;
    if (Array.isArray(matched)) {
      const idx = calls[key] ?? 0;
      resp = matched[Math.min(idx, matched.length - 1)]!;
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

function findByTestId<T extends HTMLElement = HTMLElement>(root: HTMLElement, id: string): T | null {
  return root.querySelector(`[data-testid="${id}"]`) as T | null;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('EditorRoot integration (happy-dom)', () => {
  let host: HTMLDivElement;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onClose = vi.fn();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders level list after refreshList resolves', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': {
          status: 200,
          body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }, { id: 'level_02', filename: 'level_02.yaml' }] },
        },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick();
    await tick();

    expect(findByTestId(host, 'editor-level-item-level_01')).not.toBeNull();
    expect(findByTestId(host, 'editor-level-item-level_02')).not.toBeNull();
  });

  it('clicking a list item triggers loadLevel and shows textarea', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': {
          status: 200,
          body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] },
        },
        'GET /__editor/levels/level_01': {
          status: 200,
          body: { id: 'level_01', content: 'id: level_01\nname: Plains\n', mtime: 100 },
        },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick();
    await tick();

    const button = findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01');
    expect(button).not.toBeNull();
    button!.click();
    await tick();
    await tick();

    const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea');
    expect(ta).not.toBeNull();
    expect(ta!.value).toBe('id: level_01\nname: Plains\n');
  });

  it('editing textarea marks dirty and enables save button', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'old\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick();
    await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick();
    await tick();

    expect(findByTestId(host, 'editor-dirty')).toBeNull();

    const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea')!;
    ta.value = 'new content\n';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    expect(findByTestId(host, 'editor-dirty')).not.toBeNull();
    const save = findByTestId<HTMLButtonElement>(host, 'editor-save')!;
    expect(save.disabled).toBe(false);
    expect(editor.isDirty).toBe(true);
  });

  it('clicking save triggers PUT and clears dirty', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'old\n', mtime: 100 } },
        'PUT /__editor/levels/level_01': { status: 200, body: { id: 'level_01', mtime: 200 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea')!;
    ta.value = 'new\n';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-save')!.click();
    await tick(); await tick();

    expect(editor.isDirty).toBe(false);
    expect(editor.currentMtime).toBe(200);
    expect(findByTestId(host, 'editor-dirty')).toBeNull();
  });

  it('shows error banner when lastError is set', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 500, body: { error: 'internal_error' } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick();
    await tick();

    const banner = findByTestId(host, 'editor-error');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toMatch(/internal_error/);
  });

  it('save button is disabled when not dirty', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    const save = findByTestId<HTMLButtonElement>(host, 'editor-save')!;
    expect(save.disabled).toBe(true);
  });

  it('close button calls onClose handler', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({ 'GET /__editor/levels': { status: 200, body: { levels: [] } } }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-close')!.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('duplicate button: prompts for new id, calls editor.duplicate, refreshes list', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('level_03');
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': [
          { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
          { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }, { id: 'level_03', filename: 'level_03.yaml' }] } },
        ],
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
        'POST /__editor/levels/level_01/dup': { status: 200, body: { id: 'level_03', mtime: 200 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    const dupBtn = findByTestId<HTMLButtonElement>(host, 'editor-duplicate');
    expect(dupBtn).not.toBeNull();
    expect(dupBtn!.disabled).toBe(false);
    dupBtn!.click();
    await tick(); await tick();

    expect(promptSpy).toHaveBeenCalledOnce();
    expect(findByTestId(host, 'editor-level-item-level_03')).not.toBeNull();
    promptSpy.mockRestore();
  });

  it('duplicate button is disabled when no level is selected', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({ 'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } } }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    const dupBtn = findByTestId<HTMLButtonElement>(host, 'editor-duplicate');
    expect(dupBtn!.disabled).toBe(true);
  });

  it('duplicate: cancelling prompt does not call editor.duplicate', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const dupSpy = vi.fn();
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    (editor as unknown as { duplicate: typeof editor.duplicate }).duplicate = dupSpy as never;
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-duplicate')!.click();
    await tick();
    expect(dupSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('delete button: confirm then DELETE, refresh list, clear current', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': [
          { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }, { id: 'level_02', filename: 'level_02.yaml' }] } },
          { status: 200, body: { levels: [{ id: 'level_02', filename: 'level_02.yaml' }] } },
        ],
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
        'DELETE /__editor/levels/level_01': { status: 200, body: { id: 'level_01', trashed: 'level_01.iso.yaml' } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    const delBtn = findByTestId<HTMLButtonElement>(host, 'editor-delete-level_01');
    expect(delBtn).not.toBeNull();
    delBtn!.click();
    await tick(); await tick();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(editor.currentId).toBe(null);
    expect(findByTestId(host, 'editor-level-item-level_01')).toBeNull();
    expect(findByTestId(host, 'editor-level-item-level_02')).not.toBeNull();
    confirmSpy.mockRestore();
  });

  it('delete: cancelling confirm does not call editor.delete', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const delSpy = vi.fn();
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
      }),
      baseUrl: '/__editor',
    });
    (editor as unknown as { delete: typeof editor.delete }).delete = delSpy as never;
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-delete-level_01')!.click();
    await tick();
    expect(delSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('migrate button: visible & enabled when current level has enemyPath', async () => {
    const oldYaml = 'id: level_01\nname: Plains\nmap:\n  cols: 5\n  rows: 5\n  tileSize: 64\n  tiles: []\n  enemyPath:\n    - {row: 0, col: 0}\n    - {row: 0, col: 4}\n    - {row: 4, col: 4}\nwaves: []\n';
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: oldYaml, mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    const btn = findByTestId<HTMLButtonElement>(host, 'editor-migrate');
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(false);
  });

  it('migrate button: disabled when current level already has pathGraph', async () => {
    const newYaml = 'id: level_01\nmap:\n  cols: 5\n  rows: 5\n  tileSize: 64\n  tiles: []\n  spawns:\n    - {id: spawn_0, row: 0, col: 0}\n  pathGraph:\n    nodes:\n      - {id: n0, row: 0, col: 0, role: spawn, spawnId: spawn_0}\n      - {id: n1, row: 0, col: 4, role: crystal_anchor}\n    edges:\n      - {from: n0, to: n1}\nwaves: []\n';
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: newYaml, mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    const btn = findByTestId<HTMLButtonElement>(host, 'editor-migrate');
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true);
  });

  it('migrate button: clicking rewrites textarea, marks dirty, does not auto-save', async () => {
    const oldYaml = 'id: level_01\nmap:\n  cols: 5\n  rows: 5\n  tileSize: 64\n  tiles: []\n  enemyPath:\n    - {row: 0, col: 0}\n    - {row: 0, col: 4}\n    - {row: 4, col: 4}\nwaves: []\n';
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const putSpy = vi.fn();
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: oldYaml, mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    (editor as unknown as { saveCurrent: typeof editor.saveCurrent }).saveCurrent = putSpy as never;
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    findByTestId<HTMLButtonElement>(host, 'editor-migrate')!.click();
    await tick(); await tick();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(putSpy).not.toHaveBeenCalled();
    expect(editor.isDirty).toBe(true);
    const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea')!;
    expect(ta.value).toContain('spawns');
    expect(ta.value).toContain('pathGraph');
    expect(ta.value).not.toContain('enemyPath');
    confirmSpy.mockRestore();
  });

  it('migrate: cancelling confirm leaves content unchanged', async () => {
    const oldYaml = 'id: level_01\nmap:\n  cols: 5\n  rows: 5\n  tileSize: 64\n  tiles: []\n  enemyPath:\n    - {row: 0, col: 0}\n    - {row: 0, col: 4}\nwaves: []\n';
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: oldYaml, mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    findByTestId<HTMLButtonElement>(host, 'editor-migrate')!.click();
    await tick();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(editor.isDirty).toBe(false);
    expect(editor.currentContent).toBe(oldYaml);
    confirmSpy.mockRestore();
  });

  it('duplicate failure surfaces in error banner', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('level_existing');
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'x\n', mtime: 100 } },
        'POST /__editor/levels/level_01/dup': { status: 409, body: { error: 'target_exists' } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-duplicate')!.click();
    await tick(); await tick();

    const banner = findByTestId(host, 'editor-error');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toMatch(/target_exists/);
    promptSpy.mockRestore();
  });

  it('shows Form/RAW tab switcher when a level is loaded', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'id: level_01\nname: Plains\nmap:\n  cols: 10\n  rows: 8\n  tileSize: 64\n  tiles: []\nwaves: []\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    expect(findByTestId(host, 'editor-tab-form')).not.toBeNull();
    expect(findByTestId(host, 'editor-tab-raw')).not.toBeNull();
  });

  it('RAW tab is active by default; textarea is visible', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'id: level_01\nname: Plains\nmap:\n  cols: 10\n  rows: 8\n  tileSize: 64\n  tiles: []\nwaves: []\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    expect(findByTestId(host, 'editor-textarea')).not.toBeNull();
    expect(findByTestId(host, 'panel-metadata')).toBeNull();
  });

  it('switching to Form tab shows the 5 panels', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'id: level_01\nname: Plains\nmap:\n  cols: 10\n  rows: 8\n  tileSize: 64\n  tiles: []\nwaves: []\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();

    findByTestId<HTMLButtonElement>(host, 'editor-tab-form')!.click();
    await tick();

    expect(findByTestId(host, 'panel-metadata')).not.toBeNull();
    expect(findByTestId(host, 'panel-starting')).not.toBeNull();
    expect(findByTestId(host, 'panel-available')).not.toBeNull();
    expect(findByTestId(host, 'panel-waves')).not.toBeNull();
    expect(findByTestId(host, 'panel-weather')).not.toBeNull();
    expect(findByTestId(host, 'editor-textarea')).toBeNull();
  });

  it('editing a form panel updates YAML content and marks dirty', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'id: level_01\nname: Plains\nmap:\n  cols: 10\n  rows: 8\n  tileSize: 64\n  tiles: []\nwaves: []\n', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-tab-form')!.click();
    await tick();

    expect(findByTestId(host, 'editor-dirty')).toBeNull();

    const nameInput = findByTestId<HTMLInputElement>(host, 'metadata-name')!;
    nameInput.value = 'Renamed';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(); await tick();

    expect(findByTestId(host, 'editor-dirty')).not.toBeNull();
    expect(editor.currentContent).toContain('name: Renamed');
  });

  it('Form tab shows fallback when YAML is unparseable', async () => {
    const editor = new LevelEditor({
      fetch: makeFetch({
        'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
        'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: 'this is: : not valid yaml: [', mtime: 100 } },
      }),
      baseUrl: '/__editor',
    });
    render(<EditorRoot editor={editor} onClose={onClose} />, host);
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
    await tick(); await tick();
    findByTestId<HTMLButtonElement>(host, 'editor-tab-form')!.click();
    await tick();

    expect(findByTestId(host, 'editor-form-parse-error')).not.toBeNull();
    expect(findByTestId(host, 'panel-metadata')).toBeNull();
  });

  describe('save-time validation (validateLevel integration)', () => {
    const validL1Yaml =
      'id: level_test\n' +
      'name: Test\n' +
      'map:\n' +
      '  cols: 5\n' +
      '  rows: 3\n' +
      '  tileSize: 64\n' +
      '  tiles:\n' +
      '    - [spawn, path, path, path, base]\n' +
      '    - [empty, empty, empty, empty, empty]\n' +
      '    - [empty, empty, empty, empty, empty]\n' +
      '  spawns:\n' +
      '    - {id: spawn_0, row: 0, col: 0}\n' +
      '  pathGraph:\n' +
      '    nodes:\n' +
      '      - {id: n0, row: 0, col: 0, role: spawn, spawnId: spawn_0}\n' +
      '      - {id: n1, row: 0, col: 4, role: crystal_anchor}\n' +
      '    edges:\n' +
      '      - {from: n0, to: n1}\n' +
      'waves:\n' +
      '  - waveNumber: 1\n' +
      '    spawnDelay: 0\n' +
      '    enemies:\n' +
      '      - {enemyType: goblin, count: 5, spawnInterval: 1}\n';

    const invalidYamlNoEdgesSpawnUnreachable =
      'id: level_bad\n' +
      'name: Bad\n' +
      'map:\n' +
      '  cols: 5\n' +
      '  rows: 3\n' +
      '  tileSize: 64\n' +
      '  tiles:\n' +
      '    - [spawn, path, path, path, base]\n' +
      '    - [empty, empty, empty, empty, empty]\n' +
      '    - [empty, empty, empty, empty, empty]\n' +
      '  spawns:\n' +
      '    - {id: spawn_0, row: 0, col: 0}\n' +
      '  pathGraph:\n' +
      '    nodes:\n' +
      '      - {id: n0, row: 0, col: 0, role: spawn, spawnId: spawn_0}\n' +
      '      - {id: n1, row: 0, col: 4, role: crystal_anchor}\n' +
      '    edges: []\n' +
      'waves: []\n';

    it('valid level: save proceeds and validation panel is not shown', async () => {
      const editor = new LevelEditor({
        fetch: makeFetch({
          'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_test', filename: 'level_test.yaml' }] } },
          'GET /__editor/levels/level_test': { status: 200, body: { id: 'level_test', content: validL1Yaml, mtime: 100 } },
          'PUT /__editor/levels/level_test': { status: 200, body: { id: 'level_test', mtime: 200 } },
        }),
        baseUrl: '/__editor',
      });
      render(<EditorRoot editor={editor} onClose={onClose} />, host);
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_test')!.click();
      await tick(); await tick();

      const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea')!;
      ta.value = `${validL1Yaml}# touched\n`;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await tick();

      expect(findByTestId(host, 'editor-validation-errors')).toBeNull();

      findByTestId<HTMLButtonElement>(host, 'editor-save')!.click();
      await tick(); await tick();

      expect(editor.isDirty).toBe(false);
      expect(editor.currentMtime).toBe(200);
    });

    it('invalid level: save is blocked, validation panel lists errors', async () => {
      const putSpy = vi.fn();
      const editor = new LevelEditor({
        fetch: makeFetch({
          'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_bad', filename: 'level_bad.yaml' }] } },
          'GET /__editor/levels/level_bad': { status: 200, body: { id: 'level_bad', content: invalidYamlNoEdgesSpawnUnreachable, mtime: 100 } },
        }),
        baseUrl: '/__editor',
      });
      (editor as unknown as { saveCurrent: typeof editor.saveCurrent }).saveCurrent = putSpy as never;

      render(<EditorRoot editor={editor} onClose={onClose} />, host);
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_bad')!.click();
      await tick(); await tick();

      const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea')!;
      ta.value = `${invalidYamlNoEdgesSpawnUnreachable}# touched\n`;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await tick();

      findByTestId<HTMLButtonElement>(host, 'editor-save')!.click();
      await tick();

      expect(putSpy).not.toHaveBeenCalled();

      const panel = findByTestId(host, 'editor-validation-errors');
      expect(panel).not.toBeNull();

      expect(findByTestId(host, 'editor-validation-error-I12_NO_EDGE')).not.toBeNull();
      expect(findByTestId(host, 'editor-validation-error-I6_SPAWN_UNREACHABLE')).not.toBeNull();
    });

    it('YAML parse error: validation panel is NOT shown (parse error takes precedence)', async () => {
      const editor = new LevelEditor({
        fetch: makeFetch({
          'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_x', filename: 'level_x.yaml' }] } },
          'GET /__editor/levels/level_x': { status: 200, body: { id: 'level_x', content: 'not: : valid: [', mtime: 100 } },
        }),
        baseUrl: '/__editor',
      });
      render(<EditorRoot editor={editor} onClose={onClose} />, host);
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_x')!.click();
      await tick(); await tick();

      expect(findByTestId(host, 'editor-validation-errors')).toBeNull();
    });

    it('fixing invalid level clears the validation panel after re-edit', async () => {
      const editor = new LevelEditor({
        fetch: makeFetch({
          'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_bad', filename: 'level_bad.yaml' }] } },
          'GET /__editor/levels/level_bad': { status: 200, body: { id: 'level_bad', content: invalidYamlNoEdgesSpawnUnreachable, mtime: 100 } },
        }),
        baseUrl: '/__editor',
      });
      render(<EditorRoot editor={editor} onClose={onClose} />, host);
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_bad')!.click();
      await tick(); await tick();

      const ta = findByTestId<HTMLTextAreaElement>(host, 'editor-textarea')!;
      ta.value = `${invalidYamlNoEdgesSpawnUnreachable}# touch\n`;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-save')!.click();
      await tick();
      expect(findByTestId(host, 'editor-validation-errors')).not.toBeNull();

      ta.value = validL1Yaml;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await tick();

      expect(findByTestId(host, 'editor-validation-errors')).toBeNull();
    });
  });

  describe('map canvas + tile brush integration', () => {
    const yamlWithMap =
      'id: level_01\n' +
      'name: Plains\n' +
      'map:\n' +
      '  cols: 3\n' +
      '  rows: 2\n' +
      '  tileSize: 32\n' +
      '  tiles:\n' +
      '    - [empty, empty, empty]\n' +
      '    - [empty, empty, empty]\n' +
      'waves: []\n';

    async function openFormTabWithMap(): Promise<LevelEditor> {
      const editor = new LevelEditor({
        fetch: makeFetch({
          'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
          'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: yamlWithMap, mtime: 100 } },
        }),
        baseUrl: '/__editor',
      });
      render(<EditorRoot editor={editor} onClose={onClose} />, host);
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-tab-form')!.click();
      await tick(); await tick();
      return editor;
    }

    it('Form tab renders the map toolbar and canvas', async () => {
      await openFormTabWithMap();
      expect(findByTestId(host, 'panel-map')).not.toBeNull();
      expect(findByTestId(host, 'map-toolbar')).not.toBeNull();
      expect(findByTestId(host, 'map-toolbar-tile-path')).not.toBeNull();
      expect(findByTestId(host, 'editor-map-canvas')).not.toBeNull();
    });

    it('left-click paints the selected brush into the YAML and marks dirty', async () => {
      const editor = await openFormTabWithMap();
      expect(findByTestId(host, 'editor-dirty')).toBeNull();

      const canvas = findByTestId<HTMLCanvasElement>(host, 'editor-map-canvas')!;
      const ev = new MouseEvent('mousedown', { button: 0, bubbles: true });
      Object.defineProperty(ev, 'offsetX', { value: 35 });
      Object.defineProperty(ev, 'offsetY', { value: 5 });
      canvas.dispatchEvent(ev);
      await tick(); await tick();

      expect(findByTestId(host, 'editor-dirty')).not.toBeNull();
      const model = parseYamlToModel(editor.currentContent ?? '');
      expect(model.map.tiles[0]?.[1]).toBe('path');
      expect(model.map.tiles[0]?.[0]).toBe('empty');
    });

    it('right-click paints empty regardless of the active brush', async () => {
      const yamlPath =
        'id: level_01\n' +
        'name: Plains\n' +
        'map:\n' +
        '  cols: 2\n' +
        '  rows: 1\n' +
        '  tileSize: 32\n' +
        '  tiles:\n' +
        '    - [path, path]\n' +
        'waves: []\n';
      const editor = new LevelEditor({
        fetch: makeFetch({
          'GET /__editor/levels': { status: 200, body: { levels: [{ id: 'level_01', filename: 'level_01.yaml' }] } },
          'GET /__editor/levels/level_01': { status: 200, body: { id: 'level_01', content: yamlPath, mtime: 100 } },
        }),
        baseUrl: '/__editor',
      });
      render(<EditorRoot editor={editor} onClose={onClose} />, host);
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-level-item-level_01')!.click();
      await tick(); await tick();
      findByTestId<HTMLButtonElement>(host, 'editor-tab-form')!.click();
      await tick(); await tick();

      const canvas = findByTestId<HTMLCanvasElement>(host, 'editor-map-canvas')!;
      const ev = new MouseEvent('mousedown', { button: 2, bubbles: true });
      Object.defineProperty(ev, 'offsetX', { value: 5 });
      Object.defineProperty(ev, 'offsetY', { value: 5 });
      canvas.dispatchEvent(ev);
      await tick(); await tick();

      const model = parseYamlToModel(editor.currentContent ?? '');
      expect(model.map.tiles[0]?.[0]).toBe('empty');
      expect(model.map.tiles[0]?.[1]).toBe('path');
    });

    it('clicking a brush button switches the active brush', async () => {
      const editor = await openFormTabWithMap();
      findByTestId<HTMLButtonElement>(host, 'map-toolbar-tile-blocked')!.click();
      await tick();

      const canvas = findByTestId<HTMLCanvasElement>(host, 'editor-map-canvas')!;
      const ev = new MouseEvent('mousedown', { button: 0, bubbles: true });
      Object.defineProperty(ev, 'offsetX', { value: 5 });
      Object.defineProperty(ev, 'offsetY', { value: 5 });
      canvas.dispatchEvent(ev);
      await tick(); await tick();

      const model = parseYamlToModel(editor.currentContent ?? '');
      expect(model.map.tiles[0]?.[0]).toBe('blocked');
    });
  });
});
