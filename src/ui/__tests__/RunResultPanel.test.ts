import { describe, it, expect } from 'vitest';

import { projectRunResult, type RunResultState } from '../RunResultPanel.js';

function state(overrides: Partial<RunResultState> = {}): RunResultState {
  return {
    outcome: 'victory',
    sparkAwarded: 10,
    stats: {
      levelsCleared: 8,
      totalLevels: 8,
      enemiesKilled: 142,
      goldEarned: 530,
      crystalHpRemaining: 12,
      elapsedSeconds: 750,
    },
    ...overrides,
  };
}

describe('projectRunResult', () => {
  it('uses victory header + color when outcome is victory', () => {
    const layout = projectRunResult(state());
    expect(layout.headerLabel).toBe('Victory!');
    expect(layout.headerColor).toBe(0x4ec59a);
  });

  it('uses defeat header + color when outcome is defeat', () => {
    const layout = projectRunResult(state({ outcome: 'defeat' }));
    expect(layout.headerLabel).toBe('Defeat');
    expect(layout.headerColor).toBe(0xe06868);
  });

  it('formats elapsed seconds as M:SS', () => {
    const layout = projectRunResult(state({
      stats: { levelsCleared: 1, totalLevels: 8, enemiesKilled: 0, goldEarned: 0, crystalHpRemaining: 0, elapsedSeconds: 65 },
    }));
    const timeLine = layout.lines.find((l) => l.label === 'Time')!;
    expect(timeLine.value).toBe('1:05');
  });

  it('renders all 6 stat lines in fixed order', () => {
    const layout = projectRunResult(state());
    expect(layout.lines.map((l) => l.label)).toEqual([
      'Levels Cleared',
      'Enemies Killed',
      'Gold Earned',
      'Crystal HP',
      'Time',
      'Spark Awarded',
    ]);
  });

  it('prefixes sparkAwarded value with + sign', () => {
    const layout = projectRunResult(state({ sparkAwarded: 3 }));
    expect(layout.lines.find((l) => l.label === 'Spark Awarded')!.value).toBe('+3');
  });
});
