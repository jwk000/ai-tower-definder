export const RunPhase = {
  Idle: 'Idle',
  Battle: 'Battle',
  InterLevel: 'InterLevel',
  Result: 'Result',
} as const;
export type RunPhase = (typeof RunPhase)[keyof typeof RunPhase];

export type InterLevelChoice = 'shop' | 'mystic' | 'skip';
export type RunOutcome = 'victory' | 'defeat';

const VALID_INTER_LEVEL_CHOICES: ReadonlySet<string> = new Set(['shop', 'mystic', 'skip']);

export interface RunManagerConfig {
  readonly totalLevels: number;
}

export class RunManager {
  private _phase: RunPhase = RunPhase.Idle;
  private _currentLevel = 0;
  private _outcome: RunOutcome | null = null;
  private readonly totalLevels: number;

  constructor(config: RunManagerConfig) {
    if (!Number.isInteger(config.totalLevels) || config.totalLevels < 1) {
      throw new Error(`[RunManager] totalLevels must be a positive integer, got ${config.totalLevels}`);
    }
    this.totalLevels = config.totalLevels;
  }

  get phase(): RunPhase {
    return this._phase;
  }

  get currentLevel(): number {
    return this._currentLevel;
  }

  get outcome(): RunOutcome | null {
    return this._outcome;
  }

  startRun(): void {
    if (this._phase !== RunPhase.Idle) {
      throw new Error(`[RunManager] illegal transition: startRun from ${this._phase}`);
    }
    this._phase = RunPhase.Battle;
    this._currentLevel = 1;
    this._outcome = null;
  }

  completeLevel(): void {
    if (this._phase !== RunPhase.Battle) {
      throw new Error(`[RunManager] illegal transition: completeLevel from ${this._phase}`);
    }
    if (this._currentLevel >= this.totalLevels) {
      this._phase = RunPhase.Result;
      this._outcome = 'victory';
      return;
    }
    this._phase = RunPhase.InterLevel;
  }

  pickInterLevelChoice(choice: InterLevelChoice): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: pickInterLevelChoice from ${this._phase}`);
    }
    if (!VALID_INTER_LEVEL_CHOICES.has(choice)) {
      throw new Error(`[RunManager] unknown choice: ${choice}`);
    }
    this._phase = RunPhase.Battle;
    this._currentLevel += 1;
  }

  failRun(): void {
    if (this._phase !== RunPhase.Battle) {
      throw new Error(`[RunManager] illegal transition: failRun from ${this._phase}`);
    }
    this._phase = RunPhase.Result;
    this._outcome = 'defeat';
  }

  resetToIdle(): void {
    if (this._phase !== RunPhase.Result) {
      throw new Error(`[RunManager] illegal transition: resetToIdle from ${this._phase}`);
    }
    this._phase = RunPhase.Idle;
    this._currentLevel = 0;
    this._outcome = null;
  }
}
