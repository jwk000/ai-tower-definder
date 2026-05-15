import { describe, expect, it } from 'vitest';

import { EnergySystem } from '../EnergySystem.js';

describe('EnergySystem', () => {
  it('starts at zero with default config', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10 });
    expect(energy.current).toBe(0);
    expect(energy.max).toBe(10);
  });

  it('starts at startWith when configured', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });
    expect(energy.current).toBe(5);
  });

  it('regenerates regenPerSecond per second when ticked', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10 });
    energy.tick(1);
    expect(energy.current).toBeCloseTo(1, 5);
  });

  it('accumulates fractional regen across multiple sub-second ticks', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10 });
    energy.tick(0.5);
    energy.tick(0.25);
    expect(energy.current).toBeCloseTo(0.75, 5);
  });

  it('caps regen at max', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 9 });
    energy.tick(5);
    expect(energy.current).toBe(10);
  });

  it('canAfford true iff current >= cost', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 4 });
    expect(energy.canAfford(4)).toBe(true);
    expect(energy.canAfford(5)).toBe(false);
  });

  it('spend deducts the cost when affordable and returns true', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });
    expect(energy.spend(3)).toBe(true);
    expect(energy.current).toBe(2);
  });

  it('spend returns false and does not deduct when not affordable', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 2 });
    expect(energy.spend(3)).toBe(false);
    expect(energy.current).toBe(2);
  });

  it('rejects negative spend amount', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });
    expect(() => energy.spend(-1)).toThrow(/cost/i);
  });

  it('rejects negative dt', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10 });
    expect(() => energy.tick(-0.1)).toThrow(/dt/i);
  });

  it('rejects non-positive max', () => {
    expect(() => new EnergySystem({ regenPerSecond: 1, max: 0 })).toThrow(/max/i);
  });

  it('rejects negative regen', () => {
    expect(() => new EnergySystem({ regenPerSecond: -1, max: 10 })).toThrow(/regen/i);
  });

  it('reset returns to startWith and clears regen', () => {
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 3 });
    energy.tick(5);
    energy.spend(2);
    energy.reset();
    expect(energy.current).toBe(3);
  });
});
