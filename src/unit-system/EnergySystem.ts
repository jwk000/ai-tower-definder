export interface EnergySystemConfig {
  readonly regenPerSecond: number;
  readonly max: number;
  readonly startWith?: number;
}

export class EnergySystem {
  private readonly regenPerSecond: number;
  private readonly _max: number;
  private readonly startWith: number;
  private _current: number;

  constructor(config: EnergySystemConfig) {
    if (!Number.isFinite(config.max) || config.max <= 0) {
      throw new Error(`[EnergySystem] max must be a positive finite number, got ${config.max}`);
    }
    if (!Number.isFinite(config.regenPerSecond) || config.regenPerSecond < 0) {
      throw new Error(`[EnergySystem] regenPerSecond must be a non-negative finite number, got ${config.regenPerSecond}`);
    }
    this._max = config.max;
    this.regenPerSecond = config.regenPerSecond;
    this.startWith = config.startWith ?? 0;
    this._current = this.startWith;
  }

  get current(): number {
    return this._current;
  }

  get max(): number {
    return this._max;
  }

  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) {
      throw new Error(`[EnergySystem] dt must be non-negative finite, got ${dt}`);
    }
    const next = this._current + this.regenPerSecond * dt;
    this._current = next > this._max ? this._max : next;
  }

  canAfford(cost: number): boolean {
    return this._current >= cost;
  }

  spend(cost: number): boolean {
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error(`[EnergySystem] cost must be a non-negative finite number, got ${cost}`);
    }
    if (this._current < cost) return false;
    this._current -= cost;
    return true;
  }

  reset(): void {
    this._current = this.startWith;
  }
}
