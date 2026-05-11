// ============================================================
// Tower Defender — BuildSystem (bitecs migration)
//
// 处理玩家建造交互：拖拽放置塔/陷阱/生产建筑/单位。
// 使用 bitecs 组件存储 + defineQuery 查询网格占用。
// ============================================================

import { TowerWorld, System, defineQuery } from '../core/World.js';
import {
  Position,
  Tower,
  Attack,
  Health,
  Visual,
  GridOccupant,
  PlayerOwned,
  UnitTag,
  Production,
  Trap,
  Category,
  CategoryVal,
  Layer,
  LayerVal,
  BatTower,
  AI,
  Movement,
  PlayerControllable,
  Skill,
  ShapeVal,
  DamageTypeVal,
  ResourceTypeVal,
  TargetSelectionVal,
  AttackModeVal,
  MoveModeVal,
} from '../core/components.js';
import {
  TowerType,
  UnitType,
  ProductionType,
  type MapConfig,
  TileType,
  GamePhase,
} from '../types/index.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS } from '../data/gameData.js';
import { RenderSystem } from './RenderSystem.js';
import { isAdjacentToPath } from '../utils/grid.js';

// ============================================================
// 类型 → 数值 ID 映射
// ============================================================

/** TowerType 枚举 → bitecs Tower.towerType (ui8) */
const TOWER_TYPE_ID: Record<TowerType, number> = {
  [TowerType.Arrow]: 0,
  [TowerType.Cannon]: 1,
  [TowerType.Ice]: 2,
  [TowerType.Lightning]: 3,
  [TowerType.Laser]: 4,
  [TowerType.Bat]: 5,
  [TowerType.Missile]: 6,
  [TowerType.Vine]: 7,
  [TowerType.Command]: 8,
  [TowerType.Ballista]: 9,
};

/** AI config 字符串 → bitecs AI.configId (ui16)
 *  索引必须与 ALL_AI_CONFIGS 注册顺序一致 */
const AI_CONFIG_ID: Record<string, number> = {
  // Towers (0-5, 15-16)
  tower_basic: 0,
  tower_cannon: 1,
  tower_ice: 2,
  tower_lightning: 3,
  tower_laser: 4,
  tower_bat: 5,
  tower_missile: 15,
  tower_vine: 16,
  tower_ballista: 19,
  // Soldiers (9-11)
  soldier_tank: 10,
  soldier_dps: 11,
  soldier_basic: 9,
  // Buildings (12)
  building_production: 12,
  // Traps (13-14)
  trap_damage: 13,
  trap_healing: 14,
};

/** ProductionType 枚举 → 索引 (用于内部标识) */
const PRODUCTION_TYPE_ID: Record<ProductionType, number> = {
  [ProductionType.GoldMine]: 0,
  [ProductionType.EnergyTower]: 1,
};

// ============================================================
// Helper: hex 颜色 → RGB 分量
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// ============================================================
// Helper: 形状名 → ShapeVal
// ============================================================

function shapeNameToVal(shape: string): number {
  switch (shape) {
    case 'rect': return ShapeVal.Rect;
    case 'circle': return ShapeVal.Circle;
    case 'triangle': return ShapeVal.Triangle;
    case 'diamond': return ShapeVal.Diamond;
    case 'hexagon': return ShapeVal.Hexagon;
    case 'arrow': return ShapeVal.Arrow;
    default: return ShapeVal.Circle;
  }
}

// ============================================================
// DragState
// ============================================================

export interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'production' | 'trap';
  towerType?: TowerType;
  unitType?: UnitType;
  productionType?: ProductionType;
  trap?: boolean;
}

// ============================================================
// BuildSystem
// ============================================================

export class BuildSystem implements System {
  readonly name = 'BuildSystem';

  // —— 公开状态（main.ts / UISystem 读取） ——
  selectedTowerType: TowerType | null = TowerType.Arrow;
  dragState: DragState | null = null;

  // —— 构造参数 ——
  private map: MapConfig;
  private getPhase: () => GamePhase;
  private spendGold: (amount: number) => boolean;

  // —— 每帧由 update() 注入 ——
  private _world: TowerWorld | null = null;

  // —— bitecs 查询（只定义一次） ——
  private gridQuery = defineQuery([GridOccupant]);

  constructor(
    map: MapConfig,
    getPhase: () => GamePhase,
    spendGold: (amount: number) => boolean,
  ) {
    this.map = map;
    this.getPhase = getPhase;
    this.spendGold = spendGold;
  }

  // ==========================================================
  // System 接口
  // ==========================================================

  /** 每帧缓存 world 引用，供建造方法使用 */
  update(world: TowerWorld, _dt: number): void {
    this._world = world;
  }

  // ==========================================================
  // 塔选择
  // ==========================================================

  get selectedTower(): TowerType | null {
    return this.selectedTowerType;
  }

  selectTower(type: TowerType): void {
    this.selectedTowerType = type;
  }

  // ==========================================================
  // 拖拽状态管理
  // ==========================================================

  startDrag(
    entityType: 'tower' | 'unit' | 'production' | 'trap',
    opts?: {
      towerType?: TowerType;
      unitType?: UnitType;
      productionType?: ProductionType;
    },
  ): void {
    this.dragState = {
      active: true,
      entityType,
      towerType: opts?.towerType,
      unitType: opts?.unitType,
      productionType: opts?.productionType,
      trap: entityType === 'trap',
    };
  }

  cancelDrag(): void {
    this.dragState = null;
  }

  // ==========================================================
  // 放置建造（由 main.ts onPointerUp 调用）
  // ==========================================================

  /**
   * 在画布像素坐标处尝试放置。
   * @returns 实体 ID（成功）| false（失败）
   */
  tryDrop(px: number, py: number): number | false {
    const world = this._world;
    const ds = this.dragState;
    if (!world || !ds) return false;

    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) {
      this.cancelDrag();
      return false;
    }

    const ts = this.map.tileSize;
    const col = Math.floor((px - RenderSystem.sceneOffsetX) / ts);
    const row = Math.floor((py - RenderSystem.sceneOffsetY) / ts);

    // 边界检查
    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) {
      this.cancelDrag();
      return false;
    }

    const tile = this.map.tiles[row]![col]!;

    // 地形校验
    if (ds.entityType === 'trap') {
      // 陷阱只能放在路径上
      if (tile !== TileType.Path) {
        this.cancelDrag();
        return false;
      }
    } else {
      // 塔/建筑/单位必须放在空地 + 毗邻路径
      if (tile !== TileType.Empty) {
        this.cancelDrag();
        return false;
      }
      if (!isAdjacentToPath(row, col, this.map)) {
        this.cancelDrag();
        return false;
      }
    }

    // 网格占用检查 (bitecs query)
    const occupantEntities = this.gridQuery(world.world);
    for (let i = 0; i < occupantEntities.length; i++) {
      const eid = occupantEntities[i]!;
      if (GridOccupant.row[eid] === row && GridOccupant.col[eid] === col) {
        this.cancelDrag();
        return false;
      }
    }

    // 像素坐标 → 网格中心
    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    // 按实体类型分发
    switch (ds.entityType) {
      case 'tower':     return this.placeTower(world, x, y, row, col);
      case 'trap':      return this.placeTrap(world, x, y, row, col);
      case 'production': return this.placeProduction(world, x, y, row, col);
      case 'unit':      return this.placeUnit();
      default: { this.cancelDrag(); return false; }
    }
  }

  // ==========================================================
  // 放置实现
  // ==========================================================

  private placeTower(world: TowerWorld, x: number, y: number, row: number, col: number): number | false {
    const tt = this.dragState?.towerType ?? this.selectedTowerType;
    if (!tt) { this.cancelDrag(); return false; }

    const config = TOWER_CONFIGS[tt];
    if (!config) { this.cancelDrag(); return false; }

    if (!this.spendGold(config.cost)) { this.cancelDrag(); return false; }

    const eid = this.createTowerEntity(world, x, y, row, col, tt);
    this.cancelDrag();
    return eid;
  }

  private placeTrap(world: TowerWorld, x: number, y: number, row: number, col: number): number | false {
    const TRAP_COST = 40;
    if (!this.spendGold(TRAP_COST)) { this.cancelDrag(); return false; }

    const eid = this.createTrapEntity(world, x, y, row, col);
    this.cancelDrag();
    return eid;
  }

  private placeProduction(world: TowerWorld, x: number, y: number, row: number, col: number): number | false {
    const pt = this.dragState?.productionType;
    if (!pt) { this.cancelDrag(); return false; }

    const config = PRODUCTION_CONFIGS[pt];
    if (!config) { this.cancelDrag(); return false; }

    if (!this.spendGold(config.cost)) { this.cancelDrag(); return false; }

    const eid = this.createProductionEntity(world, x, y, row, col, pt);
    this.cancelDrag();
    return eid;
  }

  /** 单位放置由 main.ts spawnUnitAt 处理，此处仅取消拖拽 */
  private placeUnit(): number | false {
    this.cancelDrag();
    return false;
  }

  // ==========================================================
  // bitecs 实体创建
  // ==========================================================

  private createTowerEntity(
    world: TowerWorld,
    x: number, y: number,
    row: number, col: number,
    tt: TowerType,
  ): number {
    const config = TOWER_CONFIGS[tt]!;
    const ts = this.map.tileSize;
    const eid = world.createEntity();

    // Position
    world.addComponent(eid, Position, { x, y });
    // GridOccupant
    world.addComponent(eid, GridOccupant, { row, col });
    // Health
    world.addComponent(eid, Health, {
      current: config.hp,
      max: config.hp,
      armor: 0,
      magicResist: 0,
    });
    // Tower
    world.addComponent(eid, Tower, {
      towerType: TOWER_TYPE_ID[tt],
      level: 1,
      totalInvested: config.cost,
    });
    // PlayerOwned (tag)
    world.addComponent(eid, PlayerOwned);

    // Attack / BatTower
    if (tt === TowerType.Bat) {
      const batCount = config.batCount ?? 4;
      const replenishCD = config.batReplenishCD ?? 12;
      const batDmg = config.batDamage ?? config.atk;
      const batRange = config.batAttackRange ?? config.range;
      const batAS = config.batAttackSpeed ?? config.attackSpeed;
      const batHP = config.batHP ?? 30;
      const batSpeed = config.batSpeed ?? 120;
      const batSize = 10;

      world.addComponent(eid, BatTower, {
        maxBats: batCount,
        replenishCooldown: replenishCD,
        replenishTimer: 0,
        batDamage: batDmg,
        batAttackRange: batRange,
        batAttackSpeed: batAS,
        batHp: batHP,
        batSpeed,
        batSize,
      });
    } else {
      const dmgType = config.damageType === 'magic'
        ? DamageTypeVal.Magic
        : DamageTypeVal.Physical;

      const isMissile = tt === TowerType.Missile;

      world.addComponent(eid, Attack, {
        damage: config.atk,
        attackSpeed: config.attackSpeed,
        range: config.range,
        damageType: dmgType,
        cooldownTimer: 0,
        targetId: 0,
        targetSelection: TargetSelectionVal.Nearest,
        attackMode: isMissile ? AttackModeVal.AoeSplash : AttackModeVal.SingleTarget,
        isRanged: 1,  // all towers are ranged
        splashRadius: config.splashRadius ?? 0,
        chainCount: 0,
        chainRange: 0,
        chainDecay: 0,
        drainPercent: 0,
      });
    }

    // Visual
    const rgb = hexToRgb(config.color);
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: ts * 0.65,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    // AI
    const aiId = AI_CONFIG_ID[this.getTowerAIConfigId(tt)] ?? 0;
    world.addComponent(eid, AI, {
      configId: aiId,
      targetId: 0,
      lastUpdateTime: 0,
      updateInterval: 0.1,
      active: 1,
    });

    // Category
    world.addComponent(eid, Category, { value: CategoryVal.Tower });
    world.addComponent(eid, Layer, { value: LayerVal.Ground });

    // Display name for overhead HUD
    world.setDisplayName(eid, config.name);

    return eid;
  }

  private createTrapEntity(
    world: TowerWorld,
    x: number, y: number,
    row: number, col: number,
  ): number {
    const ts = this.map.tileSize;
    const eid = world.createEntity();

    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, GridOccupant, { row, col });
    world.addComponent(eid, Trap, {
      damagePerSecond: 20,
      radius: 32,
      cooldown: 0,
      cooldownTimer: 0,
      animTimer: 0,
      animDuration: 0.4,
      triggerCount: 0,
      maxTriggers: 0,
    });

    const rgb = hexToRgb('#e53935');
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Triangle,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: ts * 0.5,
      alpha: 1,
      outline: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    world.addComponent(eid, PlayerOwned);
    world.addComponent(eid, Category, { value: CategoryVal.Trap });
    world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });

    // AI — 行为树控制陷阱检测与伤害
    world.addComponent(eid, AI, {
      configId: AI_CONFIG_ID['trap_damage'] ?? 13,
      targetId: 0,
      lastUpdateTime: 0,
      updateInterval: 0.1,
      active: 1,
    });

    // Display name for overhead HUD
    world.setDisplayName(eid, '地刺');

    return eid;
  }

  private createProductionEntity(
    world: TowerWorld,
    x: number, y: number,
    row: number, col: number,
    pt: ProductionType,
  ): number {
    const config = PRODUCTION_CONFIGS[pt]!;
    const ts = this.map.tileSize;
    const eid = world.createEntity();

    const resourceType = config.resourceType === 'gold'
      ? ResourceTypeVal.Gold
      : ResourceTypeVal.Energy;

    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, GridOccupant, { row, col });
    world.addComponent(eid, Health, {
      current: config.hp,
      max: config.hp,
      armor: 0,
      magicResist: 0,
    });
    world.addComponent(eid, Production, {
      resourceType,
      rate: config.baseRate,
      level: 1,
      maxLevel: config.maxLevel,
      accumulator: 0,
    });

    const rgb = hexToRgb(config.color);
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: ts * 0.6,
      alpha: 1,
      outline: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    world.addComponent(eid, PlayerOwned);
    world.addComponent(eid, Category, { value: CategoryVal.Building });
    world.addComponent(eid, Layer, { value: LayerVal.Ground });

    // AI — 行为树控制资源生产
    world.addComponent(eid, AI, {
      configId: AI_CONFIG_ID['building_production'] ?? 12,
      targetId: 0,
      lastUpdateTime: 0,
      updateInterval: 1.0,
      active: 1,
    });

    // Display name for overhead HUD
    world.setDisplayName(eid, config.name);

    return eid;
  }

  // ==========================================================
  // AI 配置映射
  // ==========================================================

  private getTowerAIConfigId(towerType: TowerType): string {
    switch (towerType) {
      case TowerType.Arrow:     return 'tower_basic';
      case TowerType.Cannon:    return 'tower_cannon';
      case TowerType.Ice:       return 'tower_ice';
      case TowerType.Lightning: return 'tower_lightning';
      case TowerType.Laser:     return 'tower_laser';
      case TowerType.Bat:       return 'tower_bat';
      case TowerType.Missile:   return 'tower_missile';
      case TowerType.Vine:      return 'tower_vine';
      case TowerType.Ballista:  return 'tower_ballista';
      default:                  return 'tower_basic';
    }
  }
}
