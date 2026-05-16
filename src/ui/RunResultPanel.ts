export type RunResultOutcome = 'victory' | 'defeat';

export interface RunResultStats {
  readonly levelsCleared: number;
  readonly totalLevels: number;
  readonly enemiesKilled: number;
  readonly goldEarned: number;
  readonly crystalHpRemaining: number;
  readonly elapsedSeconds: number;
}

export interface RunResultState {
  readonly outcome: RunResultOutcome;
  readonly stats: RunResultStats;
  readonly sparkAwarded: number;
}

export interface RunResultLine {
  readonly label: string;
  readonly value: string;
}

export interface RunResultLayout {
  readonly headerLabel: string;
  readonly headerColor: number;
  readonly lines: readonly RunResultLine[];
  readonly footerLabel: string;
}

const VICTORY_COLOR = 0x4ec59a;
const DEFEAT_COLOR = 0xe06868;

export function projectRunResult(state: RunResultState): RunResultLayout {
  const s = state.stats;
  return {
    headerLabel: state.outcome === 'victory' ? 'Victory!' : 'Defeat',
    headerColor: state.outcome === 'victory' ? VICTORY_COLOR : DEFEAT_COLOR,
    lines: [
      { label: 'Levels Cleared', value: `${s.levelsCleared}/${s.totalLevels}` },
      { label: 'Enemies Killed', value: String(s.enemiesKilled) },
      { label: 'Gold Earned', value: String(s.goldEarned) },
      { label: 'Crystal HP', value: String(s.crystalHpRemaining) },
      { label: 'Time', value: formatTime(s.elapsedSeconds) },
      { label: 'Spark Awarded', value: `+${state.sparkAwarded}` },
    ],
    footerLabel: 'Return to Menu',
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type RunResultHandler = () => void;

export class RunResultPanel {
  private state: RunResultState | null = null;
  private handler: RunResultHandler | null = null;

  setHandler(handler: RunResultHandler): void {
    this.handler = handler;
  }

  refresh(state: RunResultState): void {
    this.state = state;
  }

  getLayout(): RunResultLayout | null {
    return this.state ? projectRunResult(this.state) : null;
  }

  __triggerForTest(): void {
    if (!this.state) return;
    this.handler?.();
  }
}
