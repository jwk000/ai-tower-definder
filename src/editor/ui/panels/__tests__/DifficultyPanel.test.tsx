// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { DifficultyPanel } from '../DifficultyPanel.js';
import type { LevelFormModel, DifficultyMultipliers } from '../../../state/levelModel.js';

function makeModel(difficulty?: DifficultyMultipliers): LevelFormModel {
  const m: LevelFormModel = { id: 'L', name: 'N', map: { cols: 5, rows: 3, tileSize: 64, tiles: [] }, waves: [] };
  if (difficulty !== undefined) m.difficulty = difficulty;
  return m;
}

function q<T extends Element = HTMLElement>(host: HTMLElement, id: string): T {
  return host.querySelector(`[data-testid="${id}"]`) as T;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

const FIELDS = ['enemyHpMult', 'enemyDmgMult', 'enemySpeedMult', 'goldRewardMult'] as const;

describe('DifficultyPanel', () => {
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

  it('renders a number input and range slider for each of the 4 multiplier fields', () => {
    render(<DifficultyPanel model={makeModel()} onChange={onChange} />, host);
    for (const field of FIELDS) {
      expect(q(host, `difficulty-${field}-input`), `missing input for ${field}`).toBeTruthy();
      expect(q(host, `difficulty-${field}-slider`), `missing slider for ${field}`).toBeTruthy();
    }
  });

  it('shows default value 1.0 when difficulty is undefined', () => {
    render(<DifficultyPanel model={makeModel()} onChange={onChange} />, host);
    for (const field of FIELDS) {
      const input = q<HTMLInputElement>(host, `difficulty-${field}-input`);
      expect(Number(input.value)).toBeCloseTo(1.0);
    }
  });

  it('reflects existing multiplier values', () => {
    render(
      <DifficultyPanel
        model={makeModel({ enemyHpMult: 1.5, enemyDmgMult: 0.8, enemySpeedMult: 2.0, goldRewardMult: 0.5 })}
        onChange={onChange}
      />,
      host,
    );
    expect(Number(q<HTMLInputElement>(host, 'difficulty-enemyHpMult-input').value)).toBeCloseTo(1.5);
    expect(Number(q<HTMLInputElement>(host, 'difficulty-enemyDmgMult-input').value)).toBeCloseTo(0.8);
    expect(Number(q<HTMLInputElement>(host, 'difficulty-enemySpeedMult-input').value)).toBeCloseTo(2.0);
    expect(Number(q<HTMLInputElement>(host, 'difficulty-goldRewardMult-input').value)).toBeCloseTo(0.5);
  });

  it('editing a number input updates only that field', async () => {
    render(<DifficultyPanel model={makeModel()} onChange={onChange} />, host);
    const input = q<HTMLInputElement>(host, 'difficulty-enemyHpMult-input');
    input.value = '1.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.difficulty?.enemyHpMult).toBeCloseTo(1.5);
    expect(next.difficulty?.enemyDmgMult).toBeUndefined();
  });

  it('rejects values outside [0.1, 5.0]', async () => {
    render(<DifficultyPanel model={makeModel()} onChange={onChange} />, host);
    const input = q<HTMLInputElement>(host, 'difficulty-enemyHpMult-input');

    input.value = '0.0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    onChange.mockClear();
    input.value = '6.0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('slider value change also calls onChange', async () => {
    render(<DifficultyPanel model={makeModel({ enemyHpMult: 1.0 })} onChange={onChange} />, host);
    const slider = q<HTMLInputElement>(host, 'difficulty-enemyHpMult-slider');
    slider.value = '2.0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.difficulty?.enemyHpMult).toBeCloseTo(2.0);
  });

  it('preserves other model fields when difficulty changes', async () => {
    const model = makeModel({ enemyHpMult: 1.0 });
    model.waves = [{ waveNumber: 1, spawnDelay: 0, enemies: [] }];
    render(<DifficultyPanel model={model} onChange={onChange} />, host);

    const input = q<HTMLInputElement>(host, 'difficulty-goldRewardMult-input');
    input.value = '0.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.waves.length).toBe(1);
    expect(next.difficulty?.enemyHpMult).toBeCloseTo(1.0);
    expect(next.difficulty?.goldRewardMult).toBeCloseTo(0.5);
  });
});
