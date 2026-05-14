// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { MetadataPanel } from '../MetadataPanel.js';
import type { LevelFormModel } from '../../../state/levelModel.js';

function makeModel(overrides: Partial<LevelFormModel> = {}): LevelFormModel {
  return {
    id: 'level_test',
    name: '测试关卡',
    description: '这是一段描述',
    sceneDescription: '场景说明',
    map: { cols: 10, rows: 8, tileSize: 64, tiles: [] },
    waves: [],
    ...overrides,
  };
}

function getInputByLabel(root: HTMLElement, testId: string): HTMLInputElement | HTMLTextAreaElement | null {
  return root.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
}

describe('MetadataPanel', () => {
  let host: HTMLDivElement;
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onChange = vi.fn();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders all 4 fields with current model values', () => {
    const model = makeModel();
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    expect(getInputByLabel(host, 'metadata-id')?.value).toBe('level_test');
    expect(getInputByLabel(host, 'metadata-name')?.value).toBe('测试关卡');
    expect(getInputByLabel(host, 'metadata-description')?.value).toBe('这是一段描述');
    expect(getInputByLabel(host, 'metadata-sceneDescription')?.value).toBe('场景说明');
  });

  it('uses empty string for missing optional fields', () => {
    const model = makeModel({ description: undefined, sceneDescription: undefined });
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    expect(getInputByLabel(host, 'metadata-description')?.value).toBe('');
    expect(getInputByLabel(host, 'metadata-sceneDescription')?.value).toBe('');
  });

  it('emits onChange with patched model when name input changes', () => {
    const model = makeModel();
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    const nameInput = getInputByLabel(host, 'metadata-name')!;
    nameInput.value = '新名字';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.name).toBe('新名字');
    expect(next.id).toBe('level_test');
    expect(next.description).toBe('这是一段描述');
  });

  it('emits onChange with patched id when id input changes', () => {
    const model = makeModel();
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    const idInput = getInputByLabel(host, 'metadata-id')!;
    idInput.value = 'level_renamed';
    idInput.dispatchEvent(new Event('input', { bubbles: true }));

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.id).toBe('level_renamed');
  });

  it('emits onChange with description set to empty string when cleared', () => {
    const model = makeModel();
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    const descInput = getInputByLabel(host, 'metadata-description')!;
    descInput.value = '';
    descInput.dispatchEvent(new Event('input', { bubbles: true }));

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.description).toBe('');
  });

  it('preserves __wrapped flag through onChange', () => {
    const model = makeModel({ __wrapped: true });
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    const nameInput = getInputByLabel(host, 'metadata-name')!;
    nameInput.value = 'X';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.__wrapped).toBe(true);
  });

  it('preserves unknown fields (map/waves/__extras) through onChange', () => {
    const model = makeModel({
      map: { cols: 21, rows: 9, tileSize: 64, tiles: [['spawn']] },
      waves: [{ waveNumber: 1, spawnDelay: 0, enemies: [] }],
      __extras: { someUnknownField: 42 },
    });
    render(<MetadataPanel model={model} onChange={onChange} />, host);

    const nameInput = getInputByLabel(host, 'metadata-name')!;
    nameInput.value = 'Y';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.map.cols).toBe(21);
    expect(next.waves.length).toBe(1);
    expect(next.__extras).toEqual({ someUnknownField: 42 });
  });
});
