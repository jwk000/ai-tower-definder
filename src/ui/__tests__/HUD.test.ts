import { describe, it, expect } from 'vitest';

import { projectHUD, type RunState } from '../HUD.js';

function state(overrides: Partial<RunState> = {}): RunState {
  return {
    gold: 100,
    crystalHp: 20,
    crystalHpMax: 20,
    waveIndex: 1,
    waveTotal: 5,
    phase: 'deployment',
    ...overrides,
  };
}

describe('projectHUD', () => {
  it('formats gold and wave label from state', () => {
    const p = projectHUD(state({ gold: 250, waveIndex: 3, waveTotal: 10 }));
    expect(p.gold).toBe('Gold: 250');
    expect(p.waveLabel).toBe('Wave 3/10');
  });

  it('formats crystal as current/max', () => {
    const p = projectHUD(state({ crystalHp: 7, crystalHpMax: 20 }));
    expect(p.crystal).toBe('Crystal: 7/20');
  });

  it('flips crystalLowAlarm when ratio drops below 25%', () => {
    expect(projectHUD(state({ crystalHp: 6, crystalHpMax: 20 })).crystalLowAlarm).toBe(false);
    expect(projectHUD(state({ crystalHp: 4, crystalHpMax: 20 })).crystalLowAlarm).toBe(true);
  });

  it('suppresses crystalLowAlarm when crystal is already dead (hp=0)', () => {
    const p = projectHUD(state({ crystalHp: 0, crystalHpMax: 20 }));
    expect(p.crystalLowAlarm).toBe(false);
  });

  it('maps each phase enum to its human label', () => {
    expect(projectHUD(state({ phase: 'deployment' })).phaseLabel).toBe('Deployment');
    expect(projectHUD(state({ phase: 'battle' })).phaseLabel).toBe('Battle');
    expect(projectHUD(state({ phase: 'wave-break' })).phaseLabel).toBe('Wave Break');
    expect(projectHUD(state({ phase: 'victory' })).phaseLabel).toBe('Victory');
    expect(projectHUD(state({ phase: 'defeat' })).phaseLabel).toBe('Defeat');
  });
});
