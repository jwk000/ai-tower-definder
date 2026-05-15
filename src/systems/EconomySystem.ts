export interface EconomySystemConfig {
  readonly waveCompleteGold?: number;
  readonly goldPerSp?: number;
}

const DEFAULT_WAVE_GOLD = 20;
const DEFAULT_GOLD_PER_SP = 50;

export class EconomySystem {
  private _gold = 0;
  private _sp = 0;
  private readonly waveCompleteGold: number;
  private readonly goldPerSp: number;

  constructor(config: EconomySystemConfig = {}) {
    this.waveCompleteGold = config.waveCompleteGold ?? DEFAULT_WAVE_GOLD;
    this.goldPerSp = config.goldPerSp ?? DEFAULT_GOLD_PER_SP;
  }

  get gold(): number {
    return this._gold;
  }

  get sp(): number {
    return this._sp;
  }

  addGold(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`[EconomySystem] gold amount must be non-negative finite, got ${amount}`);
    }
    this._gold += amount;
  }

  addSp(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`[EconomySystem] sp amount must be non-negative finite, got ${amount}`);
    }
    this._sp += amount;
  }

  grantLevelClearReward(level: number): void {
    if (!Number.isInteger(level) || level <= 0) {
      throw new Error(`[EconomySystem] level must be a positive integer, got ${level}`);
    }
    this._sp += level * 2;
  }

  grantWaveCompleteBonus(): void {
    this._gold += this.waveCompleteGold;
  }

  exchangeGoldForSp(spAmount: number): boolean {
    if (!Number.isInteger(spAmount) || spAmount <= 0) {
      throw new Error(`[EconomySystem] sp amount must be a positive integer, got ${spAmount}`);
    }
    const goldCost = spAmount * this.goldPerSp;
    if (this._gold < goldCost) return false;
    this._gold -= goldCost;
    this._sp += spAmount;
    return true;
  }

  reset(): void {
    this._gold = 0;
    this._sp = 0;
  }
}
