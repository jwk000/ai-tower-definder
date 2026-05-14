// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { StartingPanel } from '../StartingPanel.js';
import type { LevelFormModel } from '../../../state/levelModel.js';

function makeModel(starting?: LevelFormModel['starting']): LevelFormModel {
  const model: LevelFormModel = {
    id: 'level_test',
    name: '测试',
    map: { cols: 10, rows: 8, tileSize: 64, tiles: [] },
    waves: [],
  };
  if (starting !== undefined) model.starting = starting;
  return model;
}

function input(host: HTMLElement, id: string): HTMLInputElement {
  return host.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
}

function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('StartingPanel', () => {
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

  it('renders 3 fields with current values', () => {
    const model = makeModel({ gold: 250, energy: 10, maxPopulation: 20 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    expect(input(host, 'starting-gold').value).toBe('250');
    expect(input(host, 'starting-energy').value).toBe('10');
    expect(input(host, 'starting-maxPopulation').value).toBe('20');
  });

  it('renders empty string for missing optional sub-fields', () => {
    const model = makeModel({ gold: 250 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    expect(input(host, 'starting-gold').value).toBe('250');
    expect(input(host, 'starting-energy').value).toBe('');
    expect(input(host, 'starting-maxPopulation').value).toBe('');
  });

  it('renders all empty when starting is undefined', () => {
    const model = makeModel(undefined);
    render(<StartingPanel model={model} onChange={onChange} />, host);

    expect(input(host, 'starting-gold').value).toBe('');
    expect(input(host, 'starting-energy').value).toBe('');
    expect(input(host, 'starting-maxPopulation').value).toBe('');
  });

  it('emits onChange with patched starting.gold on valid input', () => {
    const model = makeModel({ gold: 100 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    setInputValue(input(host, 'starting-gold'), '300');

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.starting?.gold).toBe(300);
  });

  it('creates starting object when previously undefined and a field is filled', () => {
    const model = makeModel(undefined);
    render(<StartingPanel model={model} onChange={onChange} />, host);

    setInputValue(input(host, 'starting-gold'), '500');

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.starting).toBeDefined();
    expect(next.starting?.gold).toBe(500);
  });

  it('clearing a field removes that sub-field (preserves others)', () => {
    const model = makeModel({ gold: 250, energy: 10 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    setInputValue(input(host, 'starting-energy'), '');

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.starting?.gold).toBe(250);
    expect(next.starting?.energy).toBeUndefined();
  });

  it('rejects negative input — does not emit onChange and marks field invalid', async () => {
    const model = makeModel({ gold: 100 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    const goldInput = input(host, 'starting-gold');
    setInputValue(goldInput, '-50');
    await tick();

    expect(onChange).not.toHaveBeenCalled();
    expect(goldInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects non-integer input — does not emit onChange and marks field invalid', async () => {
    const model = makeModel({ gold: 100 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    const goldInput = input(host, 'starting-gold');
    setInputValue(goldInput, '12.5');
    await tick();

    expect(onChange).not.toHaveBeenCalled();
    expect(goldInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('accepts zero as valid', () => {
    const model = makeModel({ gold: 100 });
    render(<StartingPanel model={model} onChange={onChange} />, host);

    setInputValue(input(host, 'starting-gold'), '0');

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.starting?.gold).toBe(0);
  });

  it('preserves unrelated top-level fields through onChange', () => {
    const model: LevelFormModel = {
      id: 'L_test',
      name: 'N',
      map: { cols: 1, rows: 1, tileSize: 64, tiles: [['a']] },
      waves: [{ waveNumber: 1, spawnDelay: 0, enemies: [] }],
      starting: { gold: 100 },
      __extras: { x: 1 },
      __wrapped: true,
    };
    render(<StartingPanel model={model} onChange={onChange} />, host);

    setInputValue(input(host, 'starting-gold'), '999');

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.map.cols).toBe(1);
    expect(next.waves.length).toBe(1);
    expect(next.__extras).toEqual({ x: 1 });
    expect(next.__wrapped).toBe(true);
  });
});
