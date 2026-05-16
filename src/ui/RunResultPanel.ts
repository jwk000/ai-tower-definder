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

export interface RunResultFooterRect {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RunResultLayout {
  readonly headerLabel: string;
  readonly headerColor: number;
  readonly lines: readonly RunResultLine[];
  readonly footerLabel: string;
  readonly footer: RunResultFooterRect;
}

const VICTORY_COLOR = 0x4ec59a;
const DEFEAT_COLOR = 0xe06868;
const RESULT_FOOTER_WIDTH = 280;
const RESULT_FOOTER_HEIGHT = 56;
const RESULT_FOOTER_MARGIN_BOTTOM = 120;

export function projectRunResult(state: RunResultState, viewportWidth = 1920, viewportHeight = 1080): RunResultLayout {
  const s = state.stats;
  const footer: RunResultFooterRect = {
    label: 'Return to Menu',
    x: (viewportWidth - RESULT_FOOTER_WIDTH) / 2,
    y: viewportHeight - RESULT_FOOTER_MARGIN_BOTTOM,
    width: RESULT_FOOTER_WIDTH,
    height: RESULT_FOOTER_HEIGHT,
  };
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
    footerLabel: footer.label,
    footer,
  };
}

export function hitTestRunResultFooter(layout: RunResultLayout, px: number, py: number): boolean {
  const f = layout.footer;
  return px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height;
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
  private viewportWidth = 1920;
  private viewportHeight = 1080;

  constructor(opts: { viewportWidth?: number; viewportHeight?: number } = {}) {
    if (opts.viewportWidth) this.viewportWidth = opts.viewportWidth;
    if (opts.viewportHeight) this.viewportHeight = opts.viewportHeight;
  }

  setHandler(handler: RunResultHandler): void {
    this.handler = handler;
  }

  refresh(state: RunResultState): void {
    this.state = state;
  }

  getLayout(): RunResultLayout | null {
    return this.state ? projectRunResult(this.state, this.viewportWidth, this.viewportHeight) : null;
  }

  trigger(): void {
    if (!this.state) return;
    this.handler?.();
  }
}
