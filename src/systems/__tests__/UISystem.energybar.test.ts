import { describe, it, expect } from 'vitest';
import { computeEnergyBarRatio } from '../UISystem.js';

describe('UISystem.computeEnergyBarRatio', () => {
  it('returns 0 when max <= 0', () => {
    expect(computeEnergyBarRatio(5, 0)).toBe(0);
    expect(computeEnergyBarRatio(5, -1)).toBe(0);
  });

  it('returns 0 when current <= 0', () => {
    expect(computeEnergyBarRatio(0, 10)).toBe(0);
    expect(computeEnergyBarRatio(-3, 10)).toBe(0);
  });

  it('clamps to 1 when current >= max', () => {
    expect(computeEnergyBarRatio(10, 10)).toBe(1);
    expect(computeEnergyBarRatio(15, 10)).toBe(1);
  });

  it('returns the linear ratio in (0, 1) when current is within range', () => {
    expect(computeEnergyBarRatio(5, 10)).toBe(0.5);
    expect(computeEnergyBarRatio(3, 12)).toBeCloseTo(0.25, 6);
    expect(computeEnergyBarRatio(7, 10)).toBeCloseTo(0.7, 6);
  });
});
