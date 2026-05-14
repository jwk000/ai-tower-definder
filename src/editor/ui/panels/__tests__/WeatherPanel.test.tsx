// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { WeatherPanel } from '../WeatherPanel.js';
import type { LevelFormModel, WeatherSection } from '../../../state/levelModel.js';
import { WeatherType } from '../../../../types/index.js';

function makeModel(weather?: WeatherSection): LevelFormModel {
  const model: LevelFormModel = {
    id: 'L_test',
    name: 'N',
    map: { cols: 10, rows: 8, tileSize: 64, tiles: [] },
    waves: [],
  };
  if (weather !== undefined) model.weather = weather;
  return model;
}

function q<T extends Element = HTMLElement>(host: HTMLElement, id: string): T {
  return host.querySelector(`[data-testid="${id}"]`) as T;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('WeatherPanel', () => {
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

  it('renders one pool checkbox per WeatherType enum value', () => {
    render(<WeatherPanel model={makeModel()} onChange={onChange} />, host);
    for (const t of Object.values(WeatherType)) {
      const cb = q<HTMLInputElement>(host, `weather-pool-${t}`);
      expect(cb, `missing pool checkbox for ${t}`).toBeTruthy();
      expect(cb.type).toBe('checkbox');
    }
  });

  it('renders an "initial" radio for each WeatherType + one for random_from_pool', () => {
    render(<WeatherPanel model={makeModel()} onChange={onChange} />, host);
    expect(q<HTMLInputElement>(host, 'weather-initial-random_from_pool')).toBeTruthy();
    for (const t of Object.values(WeatherType)) {
      const radio = q<HTMLInputElement>(host, `weather-initial-${t}`);
      expect(radio, `missing initial radio for ${t}`).toBeTruthy();
      expect(radio.type).toBe('radio');
    }
  });

  it('reflects existing pool as checked', () => {
    const model = makeModel({ pool: [WeatherType.Rain, WeatherType.Fog], initial: 'random_from_pool' });
    render(<WeatherPanel model={model} onChange={onChange} />, host);
    expect(q<HTMLInputElement>(host, `weather-pool-${WeatherType.Rain}`).checked).toBe(true);
    expect(q<HTMLInputElement>(host, `weather-pool-${WeatherType.Fog}`).checked).toBe(true);
    expect(q<HTMLInputElement>(host, `weather-pool-${WeatherType.Sunny}`).checked).toBe(false);
  });

  it('reflects existing initial as the selected radio (random_from_pool by default)', () => {
    const model = makeModel({ pool: [WeatherType.Rain], initial: 'random_from_pool' });
    render(<WeatherPanel model={model} onChange={onChange} />, host);
    expect(q<HTMLInputElement>(host, 'weather-initial-random_from_pool').checked).toBe(true);
    expect(q<HTMLInputElement>(host, `weather-initial-${WeatherType.Rain}`).checked).toBe(false);
  });

  it('reflects specific initial weather type', () => {
    const model = makeModel({ pool: [WeatherType.Rain, WeatherType.Sunny], initial: WeatherType.Sunny });
    render(<WeatherPanel model={model} onChange={onChange} />, host);
    expect(q<HTMLInputElement>(host, `weather-initial-${WeatherType.Sunny}`).checked).toBe(true);
    expect(q<HTMLInputElement>(host, 'weather-initial-random_from_pool').checked).toBe(false);
  });

  it('checking a pool option adds it to weather.pool', async () => {
    const model = makeModel({ pool: [WeatherType.Rain], initial: 'random_from_pool' });
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const cb = q<HTMLInputElement>(host, `weather-pool-${WeatherType.Snow}`);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.weather?.pool).toContain(WeatherType.Snow);
    expect(next.weather?.pool).toContain(WeatherType.Rain);
  });

  it('unchecking a pool option removes it', async () => {
    const model = makeModel({ pool: [WeatherType.Rain, WeatherType.Fog], initial: 'random_from_pool' });
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const cb = q<HTMLInputElement>(host, `weather-pool-${WeatherType.Rain}`);
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.weather?.pool).not.toContain(WeatherType.Rain);
    expect(next.weather?.pool).toContain(WeatherType.Fog);
  });

  it('creates weather section when previously undefined and a pool option is checked', async () => {
    const model = makeModel(undefined);
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const cb = q<HTMLInputElement>(host, `weather-pool-${WeatherType.Rain}`);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.weather).toBeDefined();
    expect(next.weather?.pool).toEqual([WeatherType.Rain]);
    expect(next.weather?.initial).toBe('random_from_pool');
  });

  it('selecting a specific initial radio sets weather.initial', async () => {
    const model = makeModel({ pool: [WeatherType.Rain, WeatherType.Sunny], initial: 'random_from_pool' });
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const radio = q<HTMLInputElement>(host, `weather-initial-${WeatherType.Sunny}`);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.weather?.initial).toBe(WeatherType.Sunny);
    expect(next.weather?.pool).toEqual([WeatherType.Rain, WeatherType.Sunny]);
  });

  it('selecting random_from_pool initial sets it explicitly', async () => {
    const model = makeModel({ pool: [WeatherType.Rain], initial: WeatherType.Rain });
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const radio = q<HTMLInputElement>(host, 'weather-initial-random_from_pool');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.weather?.initial).toBe('random_from_pool');
  });

  it('preserves changeInterval through pool edits', async () => {
    const model = makeModel({
      pool: [WeatherType.Rain],
      initial: 'random_from_pool',
      changeInterval: 30,
    });
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const cb = q<HTMLInputElement>(host, `weather-pool-${WeatherType.Snow}`);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.weather?.changeInterval).toBe(30);
  });

  it('preserves unrelated top-level fields through onChange', async () => {
    const model: LevelFormModel = {
      id: 'L_test',
      name: 'N',
      map: { cols: 21, rows: 9, tileSize: 64, tiles: [['x']] },
      waves: [{ waveNumber: 1, spawnDelay: 0, enemies: [] }],
      weather: { pool: [], initial: 'random_from_pool' },
      __extras: { k: 'v' },
    };
    render(<WeatherPanel model={model} onChange={onChange} />, host);

    const cb = q<HTMLInputElement>(host, `weather-pool-${WeatherType.Rain}`);
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const next = onChange.mock.calls[0]![0] as LevelFormModel;
    expect(next.map.cols).toBe(21);
    expect(next.waves.length).toBe(1);
    expect(next.__extras).toEqual({ k: 'v' });
  });
});
