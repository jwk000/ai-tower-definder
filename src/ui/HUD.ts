export interface RunState {
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly waveIndex: number;
  readonly waveTotal: number;
  readonly phase: 'deployment' | 'battle' | 'wave-break' | 'victory' | 'defeat';
}

export interface HUDProjection {
  readonly gold: string;
  readonly crystal: string;
  readonly waveLabel: string;
  readonly phaseLabel: string;
  readonly crystalLowAlarm: boolean;
}

export function projectHUD(state: RunState): HUDProjection {
  const crystalRatio = state.crystalHpMax > 0 ? state.crystalHp / state.crystalHpMax : 0;
  return {
    gold: `Gold: ${state.gold}`,
    crystal: `Crystal: ${state.crystalHp}/${state.crystalHpMax}`,
    waveLabel: `Wave ${state.waveIndex}/${state.waveTotal}`,
    phaseLabel: phaseLabel(state.phase),
    crystalLowAlarm: state.crystalHp > 0 && crystalRatio < 0.25,
  };
}

function phaseLabel(phase: RunState['phase']): string {
  switch (phase) {
    case 'deployment': return 'Deployment';
    case 'battle': return 'Battle';
    case 'wave-break': return 'Wave Break';
    case 'victory': return 'Victory';
    case 'defeat': return 'Defeat';
  }
}
