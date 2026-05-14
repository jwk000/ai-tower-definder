import { describe, it, expect, vi } from 'vitest';
import { LevelEditor } from '../LevelEditor.js';

function silentFetch(): typeof fetch {
  return vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
}

function makeEditor(): LevelEditor {
  return new LevelEditor({ fetch: silentFetch(), baseUrl: '/__editor' });
}

const SAMPLE_OLD_YAML = `id: sample_lvl
name: 平原
map:
  cols: 21
  rows: 9
  tileSize: 64
  tiles:
    - [spawn, path, path]
  enemyPath:
    - {row: 0, col: 0}
    - {row: 0, col: 10}
    - {row: 5, col: 10}
    - {row: 5, col: 20}
waves:
  - waveNumber: 1
    spawnDelay: 2
    enemies:
      - {enemyType: grunt, count: 5, spawnInterval: 1.5}
`;

const ALREADY_MIGRATED_YAML = `id: migrated_lvl
map:
  cols: 21
  rows: 9
  tileSize: 64
  tiles:
    - [spawn, path]
  spawns:
    - {id: spawn_0, row: 0, col: 0}
  pathGraph:
    nodes:
      - {id: n0, row: 0, col: 0, role: spawn, spawnId: spawn_0}
      - {id: n1, row: 0, col: 10, role: crystal_anchor}
    edges:
      - {from: n0, to: n1}
waves: []
`;

describe('LevelEditor.canMigrate', () => {
  it('未加载内容时 false', () => {
    const ed = makeEditor();
    expect(ed.canMigrate()).toBe(false);
  });

  it('已加载且含 enemyPath 时 true', () => {
    const ed = makeEditor();
    ed.setCurrentContent(SAMPLE_OLD_YAML);
    expect(ed.canMigrate()).toBe(true);
  });

  it('已加载但已含 pathGraph 时 false', () => {
    const ed = makeEditor();
    ed.setCurrentContent(ALREADY_MIGRATED_YAML);
    expect(ed.canMigrate()).toBe(false);
  });

  it('无 enemyPath 也无 pathGraph 时 false', () => {
    const ed = makeEditor();
    ed.setCurrentContent('id: empty\nmap:\n  cols: 1\n  rows: 1\n  tileSize: 64\n  tiles: []\nwaves: []\n');
    expect(ed.canMigrate()).toBe(false);
  });
});

describe('LevelEditor.migrateCurrent', () => {
  it('未加载内容时返回错误', () => {
    const ed = makeEditor();
    const r = ed.migrateCurrent();
    expect(r.ok).toBe(false);
  });

  it('已迁移内容时返回错误', () => {
    const ed = makeEditor();
    ed.setCurrentContent(ALREADY_MIGRATED_YAML);
    const r = ed.migrateCurrent();
    expect(r.ok).toBe(false);
  });

  it('YAML 解析失败时返回错误', () => {
    const ed = makeEditor();
    ed.setCurrentContent('::: not valid yaml :::\n  - [\n');
    const r = ed.migrateCurrent();
    expect(r.ok).toBe(false);
  });

  it('合法 enemyPath 迁移成功 + currentContent 改写', () => {
    const ed = makeEditor();
    ed.setCurrentContent(SAMPLE_OLD_YAML);
    const r = ed.migrateCurrent();
    expect(r.ok).toBe(true);
    const next = ed.currentContent;
    expect(next).not.toBeNull();
    expect(next!).not.toContain('enemyPath');
    expect(next!).toContain('spawns');
    expect(next!).toContain('pathGraph');
    expect(next!).toContain('spawn_0');
    expect(next!).toMatch(/role:\s*spawn/);
    expect(next!).toMatch(/role:\s*crystal_anchor/);
  });

  it('迁移后调用 canMigrate 返回 false', () => {
    const ed = makeEditor();
    ed.setCurrentContent(SAMPLE_OLD_YAML);
    ed.migrateCurrent();
    expect(ed.canMigrate()).toBe(false);
  });

  it('迁移后 isDirty 为 true（与 loaded snapshot 不同）', async () => {
    const ed = makeEditor();
    ed.setCurrentContent(SAMPLE_OLD_YAML);
    ed.migrateCurrent();
    expect(ed.isDirty).toBe(true);
  });

  it('迁移触发 change 事件', () => {
    const ed = makeEditor();
    ed.setCurrentContent(SAMPLE_OLD_YAML);
    const listener = vi.fn();
    ed.addEventListener('change', listener);
    ed.migrateCurrent();
    expect(listener).toHaveBeenCalled();
  });

  it('迁移后的 YAML 再次解析为合法图配置（含 spawns/pathGraph 结构）', async () => {
    const { load } = await import('js-yaml');
    const ed = makeEditor();
    ed.setCurrentContent(SAMPLE_OLD_YAML);
    ed.migrateCurrent();
    const parsed = load(ed.currentContent!) as Record<string, unknown>;
    const map = parsed.map as Record<string, unknown>;
    expect(map.spawns).toBeDefined();
    expect(map.pathGraph).toBeDefined();
    expect(map.enemyPath).toBeUndefined();
  });
});
