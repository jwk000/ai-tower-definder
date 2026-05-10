// ============================================================
// Tower Defender — bitecs Component Definitions
//
// 数据导向ECS (Structure of Arrays)
// 所有组件都是纯数据，方法逻辑移入系统纯函数
// 枚举值用ui8数值存储，颜色用RGB分量，配置引用用数值ID
// ============================================================
import { defineComponent, Types, defineQuery } from 'bitecs';
import type { World } from 'bitecs';

export { Types, defineQuery };
export type { World };

// ============================================================
// 枚举常量（bitecs友好数值形式）
// ============================================================

export const FactionVal = {
  Player: 0,
  Enemy: 1,
  Neutral: 2,
} as const;
export type FactionVal = (typeof FactionVal)[keyof typeof FactionVal];

export const LayerVal = {
  Abyss: 0,
  BelowGrid: 1,
  AboveGrid: 2,
  Ground: 3,
  LowAir: 4,
  Space: 5,
} as const;
export type LayerVal = (typeof LayerVal)[keyof typeof LayerVal];

export const CategoryVal = {
  Tower: 0,
  Soldier: 1,
  Enemy: 2,
  Building: 3,
  Trap: 4,
  Neutral: 5,
  Objective: 6,
  Effect: 7,
} as const;
export type CategoryVal = (typeof CategoryVal)[keyof typeof CategoryVal];

/** Shape types for Visual component */
export const ShapeVal = {
  Rect: 0,
  Circle: 1,
  Triangle: 2,
  Diamond: 3,
  Hexagon: 4,
  Arrow: 5,
  Cross: 6,
  TriangleCluster: 7,
} as const;
export type ShapeVal = (typeof ShapeVal)[keyof typeof ShapeVal];

export const DamageTypeVal = {
  Physical: 0,
  Magic: 1,
} as const;

export const MoveModeVal = {
  FollowPath: 0,
  ChaseTarget: 1,
  HoldPosition: 2,
  Patrol: 3,
  Flee: 4,
  PlayerDirected: 5,
} as const;

export const ResourceTypeVal = {
  Gold: 0,
  Energy: 1,
} as const;

export const TargetSelectionVal = {
  Nearest: 0,
  Farthest: 1,
  Weakest: 2,
  Strongest: 3,
  Random: 4,
  TypePriority: 5,
  TargetMarker: 6,
} as const;

export const AttackModeVal = {
  SingleTarget: 0,
  AoeSplash: 1,
  Chain: 2,
  Piercing: 3,
  DotAoe: 4,
  Heal: 5,
} as const;

// ============================================================
// 核心组件 — 所有单位共享
// ============================================================

/** 世界坐标位置（像素） */
export const Position = defineComponent({
  x: Types.f32,  // 像素中心X
  y: Types.f32,  // 像素中心Y
});

/** 生命值 */
export const Health = defineComponent({
  current: Types.f32,
  max: Types.f32,
  armor: Types.f32,      // 护甲（默认0）
  magicResist: Types.f32, // 魔抗（默认0）
});

/** 阵营归属 */
export const Faction = defineComponent({
  value: Types.ui8, // FactionVal
});

/** 空间层级（垂直位置） */
export const Layer = defineComponent({
  value: Types.ui8, // LayerVal
});

/** 单位分类 */
export const Category = defineComponent({
  value: Types.ui8, // CategoryVal
});

/** 单位配置引用 — 通过ID关联到UnitConfigRegistry */
export const UnitRef = defineComponent({
  configId: Types.ui16,
});

// ============================================================
// 视觉组件
// ============================================================

/** 视觉外观（在PixiJS渲染层使用） */
export const Visual = defineComponent({
  shape: Types.ui8,      // ShapeVal
  colorR: Types.ui8,     // RGB分量
  colorG: Types.ui8,
  colorB: Types.ui8,
  size: Types.f32,       // 尺寸（px）
  alpha: Types.f32,      // 透明度 (0-1)
  outline: Types.ui8,    // 是否有描边 (0/1)
  hitFlashTimer: Types.f32, // 受击闪白计时器
  idlePhase: Types.f32,     // 待机动画相位
});

// ============================================================
// 战斗组件
// ============================================================

/** 攻击能力 */
export const Attack = defineComponent({
  damage: Types.f32,
  attackSpeed: Types.f32,   // 每秒攻击次数
  range: Types.f32,         // 攻击范围（像素）
  damageType: Types.ui8,    // DamageTypeVal
  cooldownTimer: Types.f32, // 冷却剩余（秒）
  targetId: Types.eid,      // 当前目标实体ID
  targetSelection: Types.ui8,  // TargetSelectionVal
  attackMode: Types.ui8,       // AttackModeVal
  splashRadius: Types.f32,     // AOE溅射半径
  chainCount: Types.ui8,       // 弹跳次数
  chainRange: Types.f32,       // 弹跳搜索半径
  chainDecay: Types.f32,       // 弹跳衰减比例
  drainPercent: Types.f32,     // 吸血比例（蝙蝠塔）
});

/** 弹道 */
export const Projectile = defineComponent({
  speed: Types.f32,
  damage: Types.f32,
  damageType: Types.ui8,
  targetId: Types.eid,
  sourceId: Types.eid,
  fromX: Types.f32,
  fromY: Types.f32,
  shape: Types.ui8,
  colorR: Types.ui8,
  colorG: Types.ui8,
  colorB: Types.ui8,
  size: Types.f32,
  splashRadius: Types.f32,
  stunDuration: Types.f32,
  slowPercent: Types.f32,
  slowMaxStacks: Types.ui8,
  freezeDuration: Types.f32,
  chainCount: Types.ui8,
  chainRange: Types.f32,
  chainDecay: Types.f32,
  isChain: Types.ui8,
  chainIndex: Types.ui8,
  drainAmount: Types.f32,
});

// ============================================================
// 移动组件
// ============================================================

/** 移动能力 */
export const Movement = defineComponent({
  speed: Types.f32,        // 基准速度（px/s）
  currentSpeed: Types.f32, // 当前实际速度（受Buff影响）
  targetX: Types.f32,
  targetY: Types.f32,
  pathIndex: Types.ui16,   // 当前路径索引
  progress: Types.f32,     // 路段进度(0-1)
  moveMode: Types.ui8,     // MoveModeVal
  homeX: Types.f32,        // 出生/部署位置
  homeY: Types.f32,
  moveRange: Types.f32,    // 移动范围限制
});

// ============================================================
// 特色化组件
// ============================================================

/** 防御塔属性 */
export const Tower = defineComponent({
  towerType: Types.ui8,    // 塔类型ID（关联TowerConfig）
  level: Types.ui8,        // 等级 1-5
  totalInvested: Types.f32,// 总投资（用于回收计算）
});

/** 生产建筑属性 */
export const Production = defineComponent({
  resourceType: Types.ui8, // ResourceTypeVal
  rate: Types.f32,         // 基础产出速率/秒
  level: Types.ui8,        // 等级 1-3
  maxLevel: Types.ui8,
  accumulator: Types.f32,  // 累计值（攒满1个单位后产出）
});

/** 玩家可操控属性 */
export const PlayerControllable = defineComponent({
  targetX: Types.f32,
  targetY: Types.f32,
  selected: Types.ui8,     // 是否被选中 (0/1)
});

/** 技能 */
export const Skill = defineComponent({
  skillId: Types.ui8,       // 技能ID（关联SkillConfig）
  cooldown: Types.f32,      // 冷却时间（秒）
  currentCooldown: Types.f32, // 当前冷却剩余
  energyCost: Types.f32,
});

/** Buff容器 */
export const BuffContainer = defineComponent({
  buffCount: Types.ui8,    // 当前buff数量
});

/** 陷阱属性 */
export const Trap = defineComponent({
  damagePerSecond: Types.f32,
  radius: Types.f32,
  cooldown: Types.f32,
  cooldownTimer: Types.f32,
  animTimer: Types.f32,
  animDuration: Types.f32,
  triggerCount: Types.ui8, // 触发次数限制
  maxTriggers: Types.ui8,
});

/** Boss属性 */
export const Boss = defineComponent({
  phase: Types.ui8,        // 当前阶段 1/2
  phase2HpRatio: Types.f32,// 进入二阶段的血量比例
  transitionTimer: Types.f32,
});

/** 死亡特效 */
export const DeathEffect = defineComponent({
  duration: Types.f32,
  elapsed: Types.f32,
});

/** 爆炸特效 */
export const ExplosionEffect = defineComponent({
  duration: Types.f32,
  elapsed: Types.f32,
  radius: Types.f32,
  maxRadius: Types.f32,
  colorR: Types.ui8,
  colorG: Types.ui8,
  colorB: Types.ui8,
});

/** 血液溅射粒子 */
export const BloodParticle = defineComponent({
  velocityX: Types.f32,
  velocityY: Types.f32,
  elapsed: Types.f32,
  lifetime: Types.f32,
});

/** 渐消地面标记（用于弹坑、焦痕等持久效果） */
export const FadingMark = defineComponent({
  duration: Types.f32,
  elapsed: Types.f32,
  maxAlpha: Types.f32,
});

// ============================================================
// AI组件
// ============================================================

/** AI行为树引用 */
export const AI = defineComponent({
  configId: Types.ui16,    // AI配置ID
  targetId: Types.eid,
  lastUpdateTime: Types.f32,
  updateInterval: Types.f32,
  active: Types.ui8,       // 是否激活 (0/1)
});

// ============================================================
// 状态标记组件 (tag components — 仅存在即有意义)
// ============================================================

/** 眩晕状态 */
export const Stunned = defineComponent({
  timer: Types.f32,
});

/** 冰冻状态 */
export const Frozen = defineComponent({
  timer: Types.f32,
});

/** 减速状态 */
export const Slowed = defineComponent({
  percent: Types.f32,  // 减速百分比
  timer: Types.f32,
  stacks: Types.ui8,
  maxStacks: Types.ui8,
});

/** 嘲讽状态 — 指向施法者 */
export const Taunted = defineComponent({
  sourceId: Types.eid,
  timer: Types.f32,
});

// ============================================================
// 蝙蝠塔专属（特殊机制）
// ============================================================

/** 蝙蝠塔母体 */
export const BatTower = defineComponent({
  maxBats: Types.ui8,
  replenishCooldown: Types.f32,
  replenishTimer: Types.f32,
  batDamage: Types.f32,
  batAttackRange: Types.f32,
  batAttackSpeed: Types.f32,
  batHp: Types.f32,
  batSpeed: Types.f32,
  batSize: Types.f32,
});

/** 蝙蝠子体（关联母体） */
export const BatSwarmMember = defineComponent({
  parentId: Types.eid,
});

// ============================================================
// 激光束组件
// ============================================================

export const LaserBeam = defineComponent({
  sourceId: Types.eid,
  targetId: Types.eid,
  damage: Types.f32,
  duration: Types.f32,
  elapsed: Types.f32,
});

// ============================================================
// 闪电特效组件
// ============================================================

export const LightningBolt = defineComponent({
  sourceId: Types.eid,
  targetId: Types.eid,
  damage: Types.f32,
  duration: Types.f32,
  elapsed: Types.f32,
  chainIndex: Types.ui8,
});

// ============================================================
// 治疗组件
// ============================================================

export const Healer = defineComponent({
  healAmount: Types.f32,     // 每Tick治疗量
  healInterval: Types.f32,   // 治疗间隔
  healTimer: Types.f32,      // 治疗计时器
  healRange: Types.f32,      // 治疗范围
});

/** 治疗泉水（中立单位） */
export const HealingSpring = defineComponent({
  healAmount: Types.f32,
  healRange: Types.f32,
});

/** 金币宝箱（中立单位） */
export const GoldChest = defineComponent({
  goldMin: Types.f32,
  goldMax: Types.f32,
});

// ============================================================
// 网格占用（建造系统）
// ============================================================

/** 网格占用 — 标记实体占据了哪个格子 */
export const GridOccupant = defineComponent({
  row: Types.ui8,
  col: Types.ui8,
});

// ============================================================
// 玩家拥有标记
// ============================================================

/** 标记为玩家拥有的实体 */
export const PlayerOwned = defineComponent({});

// ============================================================
// 单位标签（组合多个标记组件的辅助）
// ============================================================

/** 统一单位标签 — 存储附加类型标记 */
export const UnitTag = defineComponent({
  isEnemy: Types.ui8,         // 0/1
  isBoss: Types.ui8,          // 0/1
  isRanged: Types.ui8,        // 0/1 远程攻击
  canAttackBuildings: Types.ui8, // 0/1
  rewardGold: Types.f32,      // 击杀奖励金币
  rewardEnergy: Types.f32,    // 击杀奖励能量
  popCost: Types.ui8,         // 人口占用
  cost: Types.f32,            // 造价
});

// ============================================================
// 场景装饰 — 动态环境生物 + 微动动画
// ============================================================

/** 环境生物类型（bitecs 数值形式） */
export const AmbientCreatureVal = {
  Bird: 0,
  Butterfly: 1,
  Squirrel: 2,
  Lizard: 3,
  Penguin: 4,
  Firefly: 5,
  Rat: 6,
  GrassBlade: 10,
  FloatingDust: 11,
} as const;
export type AmbientCreatureVal = (typeof AmbientCreatureVal)[keyof typeof AmbientCreatureVal];

/** 动态环境生物（飞鸟/地面动物/草丛 — 纯视觉，不参与游戏逻辑） */
export const AmbientCreature = defineComponent({
  creatureType: Types.ui8,      // AmbientCreatureVal
  animPhase: Types.f32,         // 动画相位 0-1
  animSpeed: Types.f32,         // 动画速度倍率
  pathIndex: Types.ui8,         // 当前路径点索引
  pathProgress: Types.f32,      // 路径进度 0-1
  state: Types.ui8,             // 状态: 0=idle, 1=walking, 2=flying
  nextWaypointX: Types.f32,     // 下一个目标路径点 X
  nextWaypointY: Types.f32,     // 下一个目标路径点 Y
});

/** 微动动画参数（植物摇摆等） */
export const SwayAnimation = defineComponent({
  amplitudeX: Types.f32,        // 水平摆动幅度 (px)
  amplitudeY: Types.f32,        // 垂直摆动幅度 (px)
  frequency: Types.f32,         // 摆动频率 (Hz)
  phaseOffset: Types.f32,       // 相位偏移（随机避免整齐划一）
  windMultiplier: Types.f32,    // 风天振幅倍率
  lastTime: Types.f32,          // 上次更新时间
  offsetX: Types.f32,           // 当前 X 偏移
  offsetY: Types.f32,           // 当前 Y 偏移
});

// ============================================================
// 常用查询组合
// ============================================================

/** 需要渲染的实体 */
export const renderableQuery = defineQuery([Position, Visual]);

/** 有生命的实体 */
export const aliveQuery = defineQuery([Position, Health]);

/** 敌人实体 */
export const enemyQuery = defineQuery([Position, Health, UnitTag]);

/** 塔实体 */
export const towerQuery = defineQuery([Position, Tower, Attack]);

/** 友方战斗单位 */
export const friendlyFighterQuery = defineQuery([Position, Health, Attack, PlayerOwned]);

/** 弹道实体 */
export const projectileQuery = defineQuery([Position, Projectile]);

/** Boss实体 */
export const bossQuery = defineQuery([Position, Health, Boss]);
