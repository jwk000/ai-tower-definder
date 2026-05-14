// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { AvailablePanel } from '../AvailablePanel.js';
import type { LevelFormModel } from '../../../state/levelModel.js';
import { TowerType, UnitType } from '../../../../types/index.js';

function makeModel(available?: LevelFormModel['available']): LevelFormModel {
  const model: LevelFormModel = {
    id: 'L_test',
    name: 'N',
    map: { cols: 10, rows: 8, tileSize: 64, tiles: [] },
    waves: [],
  };
  if (available !== undefined) model.available = available;
  return model;
}

function checkbox(host: HTMLElement, id: string): HTMLInputElement {
  return host.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('AvailablePanel', () => {
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

  it('renders one checkbox per TowerType enum value', () => {
    render(<AvailablePanel model={makeModel()} onChange={onChange} />, host);

    for (const tower of Object.values(TowerType)) {
      const cb = checkbox(host, `available-tower-${tower}`);
      expect(cb, `missing checkbox for tower ${tower}`).toBeTruthy();
      expect(cb.type).toBe('checkbox');
    }
  });

  it('renders one checkbox per UnitType enum value', () => {
    render(<AvailablePanel model={makeModel()} onChange={onChange} />, host);

    for (const unit of Object.values(UnitType)) {
      const cb = checkbox(host, `available-unit-${unit}`);
      expect(cb, `missing checkbox for unit ${unit}`).toBeTruthy();
      expect(cb.type).toBe('checkbox');
    }
  });

  it('reflects existing available.towers as checked checkboxes', () => {
    const model = makeModel({ towers: [TowerType.Arrow, TowerType.Cannon], units: [] });
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    expect(checkbox(host, `available-tower-${TowerType.Arrow}`).checked).toBe(true);
    expect(checkbox(host, `available-tower-${TowerType.Cannon}`).checked).toBe(true);
    expect(checkbox(host, `available-tower-${TowerType.Ice}`).checked).toBe(false);
  });

  it('reflects existing available.units as checked checkboxes', () => {
    const model = makeModel({ towers: [], units: [UnitType.Swordsman] });
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    expect(checkbox(host, `available-unit-${UnitType.Swordsman}`).checked).toBe(true);
    expect(checkbox(host, `available-unit-${UnitType.ShieldGuard}`).checked).toBe(false);
  });

  it('checking a tower adds it to available.towers', async () => {
    const model = makeModel({ towers: [TowerType.Arrow], units: [] });
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    const iceBox = checkbox(host, `available-tower-${TowerType.Ice}`);
    iceBox.checked = true;
    iceBox.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.available?.towers).toContain(TowerType.Ice);
    expect(next.available?.towers).toContain(TowerType.Arrow);
  });

  it('unchecking a tower removes it from available.towers', async () => {
    const model = makeModel({ towers: [TowerType.Arrow, TowerType.Cannon], units: [] });
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    const arrowBox = checkbox(host, `available-tower-${TowerType.Arrow}`);
    arrowBox.checked = false;
    arrowBox.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.available?.towers).not.toContain(TowerType.Arrow);
    expect(next.available?.towers).toContain(TowerType.Cannon);
  });

  it('creates available object when previously undefined and a checkbox is toggled', async () => {
    const model = makeModel(undefined);
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    const arrowBox = checkbox(host, `available-tower-${TowerType.Arrow}`);
    arrowBox.checked = true;
    arrowBox.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.available).toBeDefined();
    expect(next.available?.towers).toEqual([TowerType.Arrow]);
    expect(next.available?.units).toEqual([]);
  });

  it('checking a unit adds it to available.units (towers untouched)', async () => {
    const model = makeModel({ towers: [TowerType.Arrow], units: [] });
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    const cb = checkbox(host, `available-unit-${UnitType.ShieldGuard}`);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.available?.units).toContain(UnitType.ShieldGuard);
    expect(next.available?.towers).toEqual([TowerType.Arrow]);
  });

  it('preserves unrelated top-level fields through onChange', async () => {
    const model: LevelFormModel = {
      id: 'L_test',
      name: 'N',
      map: { cols: 21, rows: 9, tileSize: 64, tiles: [['x']] },
      waves: [{ waveNumber: 1, spawnDelay: 0, enemies: [] }],
      available: { towers: [], units: [] },
      __extras: { k: 'v' },
    };
    render(<AvailablePanel model={model} onChange={onChange} />, host);

    const cb = checkbox(host, `available-tower-${TowerType.Arrow}`);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.map.cols).toBe(21);
    expect(next.waves.length).toBe(1);
    expect(next.__extras).toEqual({ k: 'v' });
  });
});
