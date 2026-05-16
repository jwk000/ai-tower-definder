export const RunPhase = {
  Idle: 'Idle',
  Battle: 'Battle',
  InterLevel: 'InterLevel',
  Shop: 'Shop',
  Mystic: 'Mystic',
  SkillTree: 'SkillTree',
  Result: 'Result',
} as const;
export type RunPhase = (typeof RunPhase)[keyof typeof RunPhase];

export type InterLevelChoice = 'shop' | 'mystic' | 'skilltree';
export type RunOutcome = 'victory' | 'defeat';

const VALID_INTER_LEVEL_CHOICES: ReadonlySet<string> = new Set(['shop', 'mystic', 'skilltree']);

const CHOICE_TO_PHASE: Readonly<Record<InterLevelChoice, RunPhase>> = {
  shop: RunPhase.Shop,
  mystic: RunPhase.Mystic,
  skilltree: RunPhase.SkillTree,
};

export interface RunManagerConfig {
  readonly totalLevels: number;
  readonly initialGold?: number;
  readonly initialCrystalHp?: number;
}

/**
 * RunManager — Run 长征跨关状态机 + Run 级持久资源（v3.4 单 Run 闭环）。
 *
 * 状态机（7 相位）：
 *   Idle → startRun() → Battle (level=1)
 *   Battle → completeLevel() → InterLevel (非终局) 或 Result+victory (终局)
 *   Battle → failRun() → Result+defeat
 *   InterLevel → pickInterLevelChoice('shop')      → Shop      (level 不动)
 *   InterLevel → pickInterLevelChoice('mystic')    → Mystic    (level 不动)
 *   InterLevel → pickInterLevelChoice('skilltree') → SkillTree (level 不动)
 *   Shop      → closeShop()      → Battle (level++)
 *   Mystic    → closeMystic()    → Battle (level++)
 *   SkillTree → closeSkillTree() → Battle (level++)
 *   Result → resetToIdle() → Idle (清零 level/outcome，但保留累计统计)
 *
 * Run 级持久资源（v3.4 三资源轴中的金币 + SP；能量是单关瞬时，归 Game/LevelState）：
 *   gold / sp / crystalHp / crystalHpMax —— 跨关延续，Run 结束清零
 *
 * 与 RunController 的边界：
 *   - RunManager = 纯状态机 + Run 级数据持有者，不知道 Pixi/UI/ECS
 *   - RunController = 协调器，看 RunManager.phase 决定显隐哪个 UI 容器、是否 tick game
 *
 * v3.4 简化：MVP 阶段 totalLevels=1，Run 长征 8 关推迟到 Wave 7+。
 */
export class RunManager {
  private _phase: RunPhase = RunPhase.Idle;
  private _currentLevel = 0;
  private _outcome: RunOutcome | null = null;
  private readonly totalLevels: number;

  // Run 级持久资源（v3.4 §0 初始值由 50-mda 决定；MVP 用配置注入）
  private readonly initialGold: number;
  private readonly initialCrystalHp: number;
  private _gold = 0;
  private _sp = 0;
  private _crystalHp = 0;
  private _crystalHpMax = 0;

  constructor(config: RunManagerConfig) {
    if (!Number.isInteger(config.totalLevels) || config.totalLevels < 1) {
      throw new Error(`[RunManager] totalLevels must be a positive integer, got ${config.totalLevels}`);
    }
    this.totalLevels = config.totalLevels;
    this.initialGold = config.initialGold ?? 200;
    this.initialCrystalHp = config.initialCrystalHp ?? 20;
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

  get gold(): number {
    return this._gold;
  }

  get sp(): number {
    return this._sp;
  }

  get crystalHp(): number {
    return this._crystalHp;
  }

  get crystalHpMax(): number {
    return this._crystalHpMax;
  }

  get progress(): number {
    if (this._phase === RunPhase.Idle) return 0;
    return Math.min(1, this._currentLevel / this.totalLevels);
  }

  addGold(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] addGold requires non-negative amount, got ${amount}`);
    this._gold += amount;
  }

  spendGold(amount: number): boolean {
    if (amount < 0) throw new Error(`[RunManager] spendGold requires non-negative amount, got ${amount}`);
    if (this._gold < amount) return false;
    this._gold -= amount;
    return true;
  }

  grantSp(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] grantSp requires non-negative amount, got ${amount}`);
    this._sp += amount;
  }

  spendSp(amount: number): boolean {
    if (amount < 0) throw new Error(`[RunManager] spendSp requires non-negative amount, got ${amount}`);
    if (this._sp < amount) return false;
    this._sp -= amount;
    return true;
  }

  damageCrystal(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] damageCrystal requires non-negative amount, got ${amount}`);
    this._crystalHp = Math.max(0, this._crystalHp - amount);
  }

  startRun(): void {
    if (this._phase !== RunPhase.Idle) {
      throw new Error(`[RunManager] illegal transition: startRun from ${this._phase}`);
    }
    this._phase = RunPhase.Battle;
    this._currentLevel = 1;
    this._outcome = null;
    this._gold = this.initialGold;
    this._sp = 0;
    this._crystalHp = this.initialCrystalHp;
    this._crystalHpMax = this.initialCrystalHp;
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
    // v3.4: 三选一不直接进入战斗，先进对应子相位（Shop/Mystic/SkillTree）；
    // 子相位通过 closeShop/closeMystic/closeSkillTree 才回到 Battle 并 level++
    this._phase = CHOICE_TO_PHASE[choice];
  }

  closeShop(): void {
    if (this._phase !== RunPhase.Shop) {
      throw new Error(`[RunManager] illegal transition: closeShop from ${this._phase}`);
    }
    this._phase = RunPhase.Battle;
    this._currentLevel += 1;
  }

  closeMystic(): void {
    if (this._phase !== RunPhase.Mystic) {
      throw new Error(`[RunManager] illegal transition: closeMystic from ${this._phase}`);
    }
    this._phase = RunPhase.Battle;
    this._currentLevel += 1;
  }

  closeSkillTree(): void {
    if (this._phase !== RunPhase.SkillTree) {
      throw new Error(`[RunManager] illegal transition: closeSkillTree from ${this._phase}`);
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
    // Run 级资源清零（v3.4 单 Run 闭环：死亡无回报）
    this._gold = 0;
    this._sp = 0;
    this._crystalHp = 0;
    this._crystalHpMax = 0;
  }
}
