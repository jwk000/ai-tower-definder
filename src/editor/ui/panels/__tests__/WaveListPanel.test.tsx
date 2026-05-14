// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { WaveListPanel } from '../WaveListPanel.js';
import type { LevelFormModel, WaveSpec } from '../../../state/levelModel.js';

function makeModel(waves: WaveSpec[]): LevelFormModel {
  return {
    id: 'L_test',
    name: 'N',
    map: { cols: 10, rows: 8, tileSize: 64, tiles: [] },
    waves,
  };
}

function w(n: number, partial: Partial<WaveSpec> = {}): WaveSpec {
  return {
    waveNumber: n,
    spawnDelay: 2,
    enemies: [{ enemyType: 'grunt', count: 5, spawnInterval: 1 }],
    ...partial,
  };
}

function q<T extends Element = HTMLElement>(host: HTMLElement, id: string): T {
  return host.querySelector(`[data-testid="${id}"]`) as T;
}

function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('WaveListPanel', () => {
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

  it('renders one row per wave with its waveNumber', () => {
    render(<WaveListPanel model={makeModel([w(1), w(2), w(3)])} onChange={onChange} />, host);
    expect(q(host, 'wave-row-0')).toBeTruthy();
    expect(q(host, 'wave-row-1')).toBeTruthy();
    expect(q(host, 'wave-row-2')).toBeTruthy();
    expect(q<HTMLInputElement>(host, 'wave-0-waveNumber').value).toBe('1');
    expect(q<HTMLInputElement>(host, 'wave-1-waveNumber').value).toBe('2');
  });

  it('renders no rows when waves is empty', () => {
    render(<WaveListPanel model={makeModel([])} onChange={onChange} />, host);
    expect(host.querySelector('[data-testid^="wave-row-"]')).toBeNull();
  });

  it('"add wave" button appends a new wave with next waveNumber', async () => {
    render(<WaveListPanel model={makeModel([w(1), w(2)])} onChange={onChange} />, host);
    q<HTMLButtonElement>(host, 'wave-add').click();
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.waves.length).toBe(3);
    expect(next.waves[2]!.waveNumber).toBe(3);
    expect(next.waves[2]!.spawnDelay).toBe(0);
    expect(next.waves[2]!.enemies).toEqual([]);
  });

  it('"add wave" on empty list starts at waveNumber 1', async () => {
    render(<WaveListPanel model={makeModel([])} onChange={onChange} />, host);
    q<HTMLButtonElement>(host, 'wave-add').click();
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.waves.length).toBe(1);
    expect(next.waves[0]!.waveNumber).toBe(1);
  });

  it('"remove wave" deletes the row at given index', async () => {
    render(<WaveListPanel model={makeModel([w(1), w(2), w(3)])} onChange={onChange} />, host);
    q<HTMLButtonElement>(host, 'wave-1-remove').click();
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.waves.length).toBe(2);
    expect(next.waves.map((x) => x.waveNumber)).toEqual([1, 3]);
  });

  it('editing waveNumber updates that wave only', async () => {
    render(<WaveListPanel model={makeModel([w(1), w(2)])} onChange={onChange} />, host);
    setInputValue(q<HTMLInputElement>(host, 'wave-0-waveNumber'), '7');
    await tick();

    const next = onChange.mock.calls.at(-1)![0] as LevelFormModel;
    expect(next.waves[0]!.waveNumber).toBe(7);
    expect(next.waves[1]!.waveNumber).toBe(2);
  });

  it('editing spawnDelay accepts non-negative numbers and rejects negatives', async () => {
    render(<WaveListPanel model={makeModel([w(1)])} onChange={onChange} />, host);
    const delay = q<HTMLInputElement>(host, 'wave-0-spawnDelay');

    setInputValue(delay, '5');
    await tick();
    expect((onChange.mock.calls.at(-1)![0] as LevelFormModel).waves[0]!.spawnDelay).toBe(5);

    onChange.mockClear();
    setInputValue(delay, '-3');
    await tick();
    expect(onChange).not.toHaveBeenCalled();
    expect(delay.getAttribute('aria-invalid')).toBe('true');
  });

  it('toggling isBossWave checkbox sets/unsets boolean (omits when unset)', async () => {
    render(<WaveListPanel model={makeModel([w(1)])} onChange={onChange} />, host);
    const boss = q<HTMLInputElement>(host, 'wave-0-isBossWave');
    expect(boss.checked).toBe(false);

    boss.checked = true;
    boss.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    let next = onChange.mock.calls.at(-1)![0] as LevelFormModel;
    expect(next.waves[0]!.isBossWave).toBe(true);

    render(<WaveListPanel model={next} onChange={onChange} />, host);
    const boss2 = q<HTMLInputElement>(host, 'wave-0-isBossWave');
    boss2.checked = false;
    boss2.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    next = onChange.mock.calls.at(-1)![0] as LevelFormModel;
    expect(next.waves[0]!.isBossWave).toBeUndefined();
  });

  it('renders one enemy group row per group within a wave', () => {
    const wave: WaveSpec = {
      waveNumber: 1,
      spawnDelay: 2,
      enemies: [
        { enemyType: 'grunt', count: 5, spawnInterval: 1 },
        { enemyType: 'runner', count: 3, spawnInterval: 0.5 },
      ],
    };
    render(<WaveListPanel model={makeModel([wave])} onChange={onChange} />, host);
    expect(q(host, 'wave-0-enemy-0')).toBeTruthy();
    expect(q(host, 'wave-0-enemy-1')).toBeTruthy();
    expect(q<HTMLInputElement>(host, 'wave-0-enemy-0-enemyType').value).toBe('grunt');
    expect(q<HTMLInputElement>(host, 'wave-0-enemy-1-count').value).toBe('3');
  });

  it('"add enemy group" within a wave appends an empty group', async () => {
    render(<WaveListPanel model={makeModel([w(1)])} onChange={onChange} />, host);
    q<HTMLButtonElement>(host, 'wave-0-enemy-add').click();
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.waves[0]!.enemies.length).toBe(2);
    expect(next.waves[0]!.enemies[1]).toEqual({ enemyType: '', count: 0, spawnInterval: 0 });
  });

  it('"remove enemy group" deletes the group at index', async () => {
    const wave: WaveSpec = {
      waveNumber: 1,
      spawnDelay: 2,
      enemies: [
        { enemyType: 'grunt', count: 5, spawnInterval: 1 },
        { enemyType: 'runner', count: 3, spawnInterval: 0.5 },
      ],
    };
    render(<WaveListPanel model={makeModel([wave])} onChange={onChange} />, host);
    q<HTMLButtonElement>(host, 'wave-0-enemy-0-remove').click();
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.waves[0]!.enemies.length).toBe(1);
    expect(next.waves[0]!.enemies[0]!.enemyType).toBe('runner');
  });

  it('editing enemyType updates that group only', async () => {
    const wave: WaveSpec = {
      waveNumber: 1,
      spawnDelay: 2,
      enemies: [
        { enemyType: 'grunt', count: 5, spawnInterval: 1 },
        { enemyType: 'runner', count: 3, spawnInterval: 0.5 },
      ],
    };
    render(<WaveListPanel model={makeModel([wave])} onChange={onChange} />, host);
    const input = q<HTMLInputElement>(host, 'wave-0-enemy-0-enemyType');
    input.value = 'tank';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls.at(-1)![0] as LevelFormModel;
    expect(next.waves[0]!.enemies[0]!.enemyType).toBe('tank');
    expect(next.waves[0]!.enemies[1]!.enemyType).toBe('runner');
  });

  it('editing count rejects negative and non-integer', async () => {
    render(<WaveListPanel model={makeModel([w(1)])} onChange={onChange} />, host);
    const count = q<HTMLInputElement>(host, 'wave-0-enemy-0-count');

    setInputValue(count, '10');
    await tick();
    expect((onChange.mock.calls.at(-1)![0] as LevelFormModel).waves[0]!.enemies[0]!.count).toBe(10);

    onChange.mockClear();
    setInputValue(count, '-1');
    await tick();
    expect(onChange).not.toHaveBeenCalled();

    onChange.mockClear();
    setInputValue(count, '1.5');
    await tick();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('editing spawnInterval accepts decimals (0.5)', async () => {
    render(<WaveListPanel model={makeModel([w(1)])} onChange={onChange} />, host);
    const si = q<HTMLInputElement>(host, 'wave-0-enemy-0-spawnInterval');
    setInputValue(si, '0.5');
    await tick();

    const next = onChange.mock.calls.at(-1)![0] as LevelFormModel;
    expect(next.waves[0]!.enemies[0]!.spawnInterval).toBe(0.5);
  });

  it('preserves wave __extras and specialRules through edits', async () => {
    const wave: WaveSpec = {
      waveNumber: 1,
      spawnDelay: 2,
      enemies: [{ enemyType: 'grunt', count: 5, spawnInterval: 1 }],
      specialRules: { fog: true },
      __extras: { custom: 'x' },
    };
    render(<WaveListPanel model={makeModel([wave])} onChange={onChange} />, host);
    setInputValue(q<HTMLInputElement>(host, 'wave-0-spawnDelay'), '4');
    await tick();

    const next = onChange.mock.calls.at(-1)![0] as LevelFormModel;
    expect(next.waves[0]!.spawnDelay).toBe(4);
    expect(next.waves[0]!.specialRules).toEqual({ fog: true });
    expect(next.waves[0]!.__extras).toEqual({ custom: 'x' });
  });
});
