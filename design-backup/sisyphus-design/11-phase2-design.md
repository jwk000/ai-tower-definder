# Tower Defender — Phase 2 Design Document

> 制作人：Sisyphus | 版本：v0.2 | 日期：2026-05-07 | 基于 MVP Phase 1 代码基线

---

## 目录

1. [总览与架构变更](#1-总览与架构变更)
2. [新塔类型 (3种)](#2-新塔类型-3种)
3. [新敌人类型 (4种)](#3-新敌人类型-4种)
4. [敌人反制 AI](#4-敌人反制-ai)
5. [可移动单位系统 (2种)](#5-可移动单位系统-2种)
6. [Buff 系统](#6-buff-系统)
7. [技能系统](#7-技能系统)
8. [Boss 系统](#8-boss-系统)
9. [生产建筑 (2种)](#9-生产建筑-2种)
10. [Energy 资源系统](#10-energy-资源系统)
11. [Population 人口系统](#11-population-人口系统)
12. [系统注册顺序](#12-系统注册顺序)
13. [Phase 2 波次配置示例](#13-phase-2-波次配置示例)

---

## 1. 总览与架构变更

### 1.1 新增 CType 常量

```ts
// src/types/index.ts — 追加到 CType 对象

export const CType = {
  // === Phase 1 (existing) ===
  Position: 'Position',
  Render: 'Render',
  Health: 'Health',
  Attack: 'Attack',
  Movement: 'Movement',
  Tower: 'Tower',
  Enemy: 'Enemy',
  PlayerOwned: 'PlayerOwned',
  GridOccupant: 'GridOccupant',
  Projectile: 'Projectile',

  // === Phase 2 (new) ===
  Unit: 'Unit',               // 可移动玩家单位
  PlayerControllable: 'PlayerControllable', // 可拖拽移动
  Buff: 'Buff',               // 增益/减益效果
  Skill: 'Skill',             // 主动/被动技能
  Production: 'Production',   // 生产建筑 (金矿/能量塔)
  Boss: 'Boss',               // Boss 标记
} as const;
```

### 1.2 新增枚举

```ts
// src/types/index.ts — 新增

export enum TowerType {
  Arrow = 'arrow',
  Cannon = 'cannon',       // Phase 2
  Ice = 'ice',             // Phase 2
  Lightning = 'lightning', // Phase 2
}

export enum EnemyType {
  Grunt = 'grunt',
  Runner = 'runner',       // Phase 2
  Heavy = 'heavy',         // Phase 2
  Mage = 'mage',           // Phase 2
  Exploder = 'exploder',   // Phase 2
  // Boss variants (prefixed for clarity)
  BossCommander = 'boss_commander',
  BossBeast = 'boss_beast',
}

// 单位类型
export enum UnitType {
  ShieldGuard = 'shield_guard',
  Swordsman = 'swordsman',
}

// 生产建筑类型
export enum ProductionType {
  GoldMine = 'gold_mine',
  EnergyTower = 'energy_tower',
}

// Buff 类型
export enum BuffType {
  Buff = 'buff',     // 增益
  Debuff = 'debuff', // 减益
}

export enum BuffAttribute {
  HP = 'hp',
  ATK = 'atk',
  Speed = 'speed',
  Defense = 'defense',
  Range = 'range',
  AttackSpeed = 'attack_speed',
}

// 技能类型
export enum SkillTrigger {
  Active = 'active',     // 玩家点击释放
  Passive = 'passive',   // 始终生效
  Aura = 'aura',         // 半径光环
  Conditional = 'conditional', // 满足条件触发 (Boss 阶段转换)
}
```

### 1.3 新增公共接口

```ts
// src/types/index.ts — 新增

// ---- Buff ----
export interface BuffInstance {
  id: string;               // buff 唯一标识
  name: string;
  type: BuffType;
  attribute: BuffAttribute;
  value: number;            // 正数=buff, 负数=debuff
  isPercent: boolean;       // true=百分比, false=绝对值
  duration: number;          // 剩余时间(秒), -1=永久
  maxStacks: number;
  currentStacks: number;
  sourceEntityId: EntityId; // 来源实体
}

// ---- Skill ----
export interface SkillConfig {
  id: string;
  name: string;
  trigger: SkillTrigger;
  cooldown: number;          // 冷却(秒), 被动/光环=0
  manaCost: number;          // 能量消耗
  range: number;             // 影响范围(px), 被动=0
  description: string;
}

// ---- Unit ----
export interface UnitConfig {
  type: UnitType;
  name: string;
  hp: number;
  speed: number;            // 移动速度 px/s
  atk: number;
  attackSpeed: number;      // 次/秒
  range: number;            // 攻击范围 px
  defense: number;
  popCost: number;          // 人口占用
  color: string;
  size: number;
  skillId: string;          // 关联的技能 ID
}

// ---- Production Building ----
export interface ProductionConfig {
  type: ProductionType;
  name: string;
  cost: number;             // 建造金币成本
  hp: number;
  resourceType: 'gold' | 'energy';
  baseRate: number;         // 基础产出/秒
  upgradeRateBonus: number; // 每级额外产出/秒
  upgradeCosts: number[];   // [L2, L3]
  maxLevel: number;
  color: string;
}

// ---- Tower config 扩展 ----
export interface TowerConfig {
  // ...existing fields...
  damageType: 'physical' | 'magic'; // Phase 2 新增 — 用于护甲/魔抗计算
  splashRadius?: number;            // Cannon 的 AOE 半径
  chainCount?: number;              // Lightning 链击次数
  chainDecay?: number;              // Lightning 每次弹跳伤害衰减 (0-1)
  knockback?: number;               // Cannon 击退距离 px
  slowPercent?: number;             // Ice 每次减速百分比
  slowMaxStacks?: number;           // Ice 最大减速层数
  freezeDuration?: number;          // Ice 冰冻时长(满层触发)
}

// ---- Enemy config 扩展 ----
export interface EnemyConfig {
  // ...existing fields...
  armor: number;               // 物理护甲值 (减伤公式)
  magicResist: number;         // 魔抗值
  attackRange: number;         // 攻击范围 (0=近战)
  attackSpeed: number;         // 次/秒
  canAttackBuildings: boolean; // 是否会攻击建筑/单位
  specialOnDeath?: string;     // 'explode' | 无
  deathDamage?: number;        // 死亡时造成伤害
  deathRadius?: number;        // 死亡效果半径
  isBoss?: boolean;
  bossSkills?: string[];       // Boss 技能 ID 列表
}

// ---- Player resources 扩展 ----
export interface PlayerResources {
  gold: number;
  energy: number;      // Phase 2 新增
  lives: number;
  population: number;   // Phase 2 新增 — 当前已用人口
  maxPopulation: number; // Phase 2 新增 — 人口上限
}
```

### 1.4 新增 ShapeType

```ts
// RenderCommand supports these shapes already. Phase 2 uses:
// Cannon projectile: 'circle' (cannonball)
// Ice projectile:    'diamond' (ice shard)
// Lightning:         'triangle' (bolt)
// All exist in ShapeType union already.
```

---

## 2. 新塔类型 (3种)

### 2.1 Cannon (炮塔) — 物理 AOE

| 属性 | 值 |
|------|-----|
| 类型枚举 | `TowerType.Cannon` |
| 名称 | 炮塔 |
| 伤害类型 | `physical` |
| 攻击力 | 25 |
| 攻速 | 0.4 次/秒 |
| 射程 | 180 px |
| 血量 | 120 |
| 造价 | 80 G |
| AOE 半径 | 80 px (splash) |
| 击退距离 | 60 px |
| 颜色 | `#ff8a65` (orange) |
| 升级花费 | `[50, 90, 140, 200]` |
| 攻击力成长 | `[8, 12, 16, 22]` per level |
| 射程成长 | `[20, 20, 30, 30]` per level |

**机制说明**:
- 炮弹命中目标时，在命中点产生 80px 半径的 AOE 伤害
- AOE 伤害 = 攻击力的 100%（主目标）+ 60%（溅射目标）
- 击退：将范围内的敌人沿远离爆炸中心的方向推 60px
- 击退仅影响非 Boss 敌人
- 弹道形状：`circle`（橙色炮弹，size=14）

### 2.2 Ice (冰塔) — 魔法减速 + 冰冻

| 属性 | 值 |
|------|-----|
| 类型枚举 | `TowerType.Ice` |
| 名称 | 冰塔 |
| 伤害类型 | `magic` |
| 攻击力 | 5 |
| 攻速 | 1.2 次/秒 |
| 射程 | 200 px |
| 血量 | 100 |
| 造价 | 65 G |
| 单次减速 | 20% |
| 最大减速层数 | 5 |
| 满层效果 | 冰冻 1.0 秒 (无法行动) |
| 减速持续时间 | 3 秒 (每层独立计时，叠加刷新) |
| 颜色 | `#81d4fa` (light blue) |
| 升级花费 | `[40, 70, 110, 160]` |
| 攻击力成长 | `[3, 5, 7, 10]` |
| 射程成长 | `[20, 20, 30, 30]` |

**机制说明**:
- 每次攻击给目标添加 1 层 "寒冰" 减速 buff（同名 buff，maxStacks=5）
- 每层减速值 = config.slowPercent (20%)
- 叠满 5 层后，清除所有减速层并施加 "冰冻" buff（持续 1s，敌人无法移动和攻击）
- 冰冻结束后，减速层数重置为 0，需要重新叠加
- 弹道形状：`diamond`（冰晶，light blue，size=12）

### 2.3 Lightning (电塔) — 魔法链式闪电

| 属性 | 值 |
|------|-----|
| 类型枚举 | `TowerType.Lightning` |
| 名称 | 电塔 |
| 伤害类型 | `magic` |
| 攻击力 | 15 |
| 攻速 | 0.9 次/秒 |
| 射程 | 170 px |
| 血量 | 100 |
| 造价 | 70 G |
| 链击次数 | 3 (初始弹跳) |
| 衰减率 | 20% (每次弹跳伤害×0.8) |
| 弹跳范围 | 120 px (搜索下一目标的半径) |
| 颜色 | `#fff176` (yellow) |
| 升级花费 | `[45, 75, 120, 170]` |
| 攻击力成长 | `[6, 9, 13, 18]` |
| 链击次数成长 | `[1, 1, 1, 1]` (每级 +1 弹跳) |
| 射程成长 | `[15, 15, 20, 20]` |

**机制说明**:
- 选中射程内最近敌人作为主目标，造成 100% 伤害
- 以主目标为圆心，搜索 120px 内未受本次链击的敌人作为下一跳
- 第 N 跳伤害 = 基础伤害 × 0.8^(N-1)
- 同一敌人不会被同一次链击命中两次
- 弹道形状：`triangle`（闪电，yellow，size=10）

### 2.4 PROJECTILE_CFG 扩展

```ts
// src/systems/AttackSystem.ts — PROJECTILE_CFG 扩展

const PROJECTILE_CFG: Record<TowerType, { speed: number; shape: ShapeType; color: string; size: number }> = {
  [TowerType.Arrow]:     { speed: 420, shape: 'arrow',    color: '#81d4fa', size: 24 },
  [TowerType.Cannon]:    { speed: 300, shape: 'circle',   color: '#ff8a65', size: 14 },
  [TowerType.Ice]:       { speed: 350, shape: 'diamond',  color: '#81d4fa', size: 12 },
  [TowerType.Lightning]: { speed: 600, shape: 'triangle', color: '#fff176', size: 10 },
};
```

### 2.5 AttackSystem 修改点

- **Cannon**：弹道命中时，`ProjectileSystem` 需检测 splash 半径，对范围内所有敌人调用 `takeSplashDamage(sourceDamage, splashRadius)`。
  在 Tower 组件上新增 `splashRadius` 字段，AttackSystem 在 spawnProjectile 时传入。

- **Ice**：弹道命中时，`ProjectileSystem` 调用 `BuffSystem.applySlow(enemyId, slowPercent, maxStacks, freezeDuration)`。

- **Lightning**：弹道命中时，`ProjectileSystem` 调用链式搜索逻辑，对后续目标自动生成额外 Projectile 实体（标记 `isChain: true`，伤害已衰减）。

### 2.6 TOWER_CONFIGS 新条目

```ts
// src/data/gameData.ts — 追加

[ TowerType.Cannon ]: {
  type: TowerType.Cannon,
  name: '炮塔',
  cost: 80, hp: 120,
  atk: 25, attackSpeed: 0.4, range: 180,
  damageType: 'physical',
  splashRadius: 80,
  knockback: 60,
  upgradeCosts: [50, 90, 140, 200],
  upgradeAtkBonus: [8, 12, 16, 22],
  upgradeRangeBonus: [20, 20, 30, 30],
  color: '#ff8a65',
},

[ TowerType.Ice ]: {
  type: TowerType.Ice,
  name: '冰塔',
  cost: 65, hp: 100,
  atk: 5, attackSpeed: 1.2, range: 200,
  damageType: 'magic',
  slowPercent: 20,
  slowMaxStacks: 5,
  freezeDuration: 1.0,
  upgradeCosts: [40, 70, 110, 160],
  upgradeAtkBonus: [3, 5, 7, 10],
  upgradeRangeBonus: [20, 20, 30, 30],
  color: '#81d4fa',
},

[ TowerType.Lightning ]: {
  type: TowerType.Lightning,
  name: '电塔',
  cost: 70, hp: 100,
  atk: 15, attackSpeed: 0.9, range: 170,
  damageType: 'magic',
  chainCount: 3,
  chainDecay: 0.2,
  upgradeCosts: [45, 75, 120, 170],
  upgradeAtkBonus: [6, 9, 13, 18],
  upgradeRangeBonus: [15, 15, 20, 20],
  color: '#fff176',
},
```

---

## 3. 新敌人类型 (4种)

### 3.1 Runner (快兵) — 高速低血量

| 属性 | 值 |
|------|-----|
| 类型枚举 | `EnemyType.Runner` |
| 名称 | 快兵 |
| HP | 30 |
| 速度 | 150 px/s |
| 攻击 | 5 (对基地) |
| 护甲 | 0 |
| 魔抗 | 0 |
| 攻击范围 | 0 (不攻击建筑，只冲基地) |
| 击杀金币 | 8 G |
| 颜色 | `#ffab91` |
| 半径 | 10 px (小圆) |
| 形状 | `circle` |
| 特殊 | 无 |

**行为**：不攻击建筑，沿路径全速冲向基地。用移速弥补血量。

### 3.2 Heavy (重装兵) — 高护甲慢速

| 属性 | 值 |
|------|-----|
| 类型枚举 | `EnemyType.Heavy` |
| 名称 | 重装兵 |
| HP | 200 |
| 速度 | 35 px/s |
| 攻击 | 15 (对建筑/塔) |
| 护甲 | 80 (50% 物理减伤 ≈ 80/(80+100)=44.4%) |
| 魔抗 | 15 |
| 攻击范围 | 32 px (近战，经过塔旁可攻击) |
| 攻速 | 0.8 次/秒 |
| canAttackBuildings | `true` |
| 击杀金币 | 20 G |
| 颜色 | `#8d6e63` |
| 半径 | 22 px (大圆) |
| 形状 | `circle` |

**行为**：沿路径移动。若路径两侧 64px 内有塔/建筑，则停下攻击（优先级：塔 > 生产建筑）。塔死亡后继续前进。

### 3.3 Mage (法师) — 远程攻击建筑

| 属性 | 值 |
|------|-----|
| 类型枚举 | `EnemyType.Mage` |
| 名称 | 法师 |
| HP | 80 |
| 速度 | 55 px/s |
| 攻击 | 25 (远程) |
| 护甲 | 10 |
| 魔抗 | 60 |
| 攻击范围 | 250 px |
| 攻速 | 0.6 次/秒 |
| canAttackBuildings | `true` |
| 击杀金币 | 15 G |
| 颜色 | `#ce93d8` |
| 半径 | 14 px |
| 形状 | `hexagon` |

**行为**：沿路径移动。在 250px 范围内有塔/建筑 → 停下，远程射击。优先攻击最近目标。塔死亡后继续沿路径前进。

### 3.4 Exploder (自爆虫) — 死亡爆炸

| 属性 | 值 |
|------|-----|
| 类型枚举 | `EnemyType.Exploder` |
| 名称 | 自爆虫 |
| HP | 40 |
| 速度 | 90 px/s |
| 攻击 | 10 (对基地) |
| 护甲 | 0 |
| 魔抗 | 0 |
| 攻击范围 | 0 |
| canAttackBuildings | `false` |
| 击杀金币 | 12 G |
| 颜色 | `#ff8a65` (flashing) |
| 半径 | 12 px |
| 形状 | `circle` |
| specialOnDeath | `'explode'` |
| deathDamage | 50 |
| deathRadius | 100 px |

**行为**：沿路径冲基地。**死亡时**（无论被击杀还是到达基地自杀），在死亡点产生 100px 半径爆炸：
- 伤害所有范围内的**玩家塔和其他玩家建筑**（不伤害敌人）
- 伤害值 = `deathDamage`
- 视觉效果：瞬间红色圆形 + 消散粒子（Phase 4 打磨阶段实现粒子，Phase 2 用红色圆圈闪烁即可）

**Flashing 实现**：RenderSystem 在绘制 Exploder 时，利用 `Math.sin(time * 8)` 交替 alpha 值（0.5 ↔ 1.0），产生闪烁效果。需在 Render 组件新增 `flash?: boolean` 字段。

### 3.5 ENEMY_CONFIGS 新条目

```ts
// src/data/gameData.ts — 追加

[ EnemyType.Runner ]: {
  type: EnemyType.Runner, name: '快兵',
  hp: 30, speed: 150, atk: 5,
  defense: 0, armor: 0, magicResist: 0,
  attackRange: 0, attackSpeed: 0,
  canAttackBuildings: false,
  rewardGold: 8,
  color: '#ffab91', radius: 10,
},

[ EnemyType.Heavy ]: {
  type: EnemyType.Heavy, name: '重装兵',
  hp: 200, speed: 35, atk: 15,
  defense: 0, armor: 80, magicResist: 15,
  attackRange: 32, attackSpeed: 0.8,
  canAttackBuildings: true,
  rewardGold: 20,
  color: '#8d6e63', radius: 22,
},

[ EnemyType.Mage ]: {
  type: EnemyType.Mage, name: '法师',
  hp: 80, speed: 55, atk: 25,
  defense: 0, armor: 10, magicResist: 60,
  attackRange: 250, attackSpeed: 0.6,
  canAttackBuildings: true,
  rewardGold: 15,
  color: '#ce93d8', radius: 14,
},

[ EnemyType.Exploder ]: {
  type: EnemyType.Exploder, name: '自爆虫',
  hp: 40, speed: 90, atk: 10,
  defense: 0, armor: 0, magicResist: 0,
  attackRange: 0, attackSpeed: 0,
  canAttackBuildings: false,
  specialOnDeath: 'explode',
  deathDamage: 50, deathRadius: 100,
  rewardGold: 12,
  color: '#ff8a65', radius: 12,
},
```

---

## 4. 敌人反制 AI

### 4.1 EnemyAttackSystem (新系统)

```
名称:       EnemyAttackSystem
依赖组件:   [Position, Enemy, Attack]   (敌人身上的 Attack 组件)
查询目标:   [Position, Health, PlayerOwned] (塔/建筑/单位)

更新逻辑:
  对每个有攻击能力的敌人:
    1. 若已锁定目标 → 检查目标是否存活且在范围内
    2. 若未锁定 → 搜索范围内最近的玩家建筑/单位
    3. 在攻击范围外 → 取消锁定，继续沿路径移动
    4. 在攻击范围内 → 停止移动，攻击冷却归零后造成伤害
    5. 远程敌人(Mage)：保持距离攻击
    6. 近战敌人(Heavy)：贴脸攻击
```

**停止移动的实现**：给 Enemy 组件增加 `movementPaused: boolean` 字段。MovementSystem 检查此字段，若为 `true` 则跳过移动。

### 4.2 EnemyAIAdaptation (WaveSystem 扩展)

WaveSystem 在生成每波前（`startWave()` 调用时）检测玩家当前阵容，动态调整波次配置：

```ts
// 反制规则表
interface CounterRule {
  condition: (world: World) => boolean;   // 检测玩家阵容
  response: WaveEnemyGroup[];             // 替换/追加敌人编组
}
```

| 检测条件 | 反制措施 |
|----------|----------|
| 物理塔(Arrow+Cannon) ≥ 3 | 本波追加 2-3 个 Heavy (高护甲) |
| 魔法塔(Ice+Lightning) ≥ 3 | 本波追加 2-3 个 Mage (高魔抗) |
| 生产建筑 ≥ 2 | 本波追加 2-3 个 Runner (快速偷建筑) |
| 玩家单位 ≥ 2 | 本波追加 1-2 个 Exploder (炸单位) |
| 无塔在路径前半段 | 首波多出 3 个 Runner |

**实现方式**：在 `WaveSystem` 构造函数中接收一个 `counterRules: CounterRule[]`。`startWave()` 时对原波次配置做浅拷贝，检测条件后追加 counter 编组。

### 4.3 Tower Repair (BuildSystem 扩展)

```
- 被摧毁的塔：实体标记 dead，但 GridOccupant 保留一个 "ruins" 实体
  → ruins 实体有 GridOccupant + Render(灰色, alpha=0.3) 但无 Health/Attack
- 点击废墟 → 显示 "修复 25G" (原价 50%)
- 修复：移除 ruins 实体，重新按原 towerType 建造一个 L1 塔
```

BuildSystem 新增方法：

```ts
tryRepair(px: number, py: number): boolean
```

### 4.4 伤害公式更新

```ts
// src/utils/math.ts

const ARMOR_CONSTANT = 100;
const MRESIST_CONSTANT = 100;

export function calcPhysicalDamage(rawDamage: number, armor: number): number {
  return rawDamage * (1 - armor / (armor + ARMOR_CONSTANT));
}

export function calcMagicDamage(rawDamage: number, magicResist: number): number {
  return rawDamage * (1 - magicResist / (magicResist + MRESIST_CONSTANT));
}

export function calcFinalDamage(
  rawDamage: number,
  damageType: 'physical' | 'magic',
  armor: number,
  magicResist: number,
): number {
  if (damageType === 'physical') {
    return calcPhysicalDamage(rawDamage, armor);
  }
  return calcMagicDamage(rawDamage, magicResist);
}
```

---

## 5. 可移动单位系统 (2种)

### 5.1 Unit 组件

```ts
// src/components/Unit.ts (新建)
import { CType, type UnitType } from '../types/index.js';

export class Unit {
  readonly type = CType.Unit;
  unitType: UnitType;
  atk: number;
  range: number;
  attackSpeed: number;
  popCost: number;
  private cooldown: number;
  targetId: number | null;
  /** Current assigned position (drag target) */
  targetX: number | null;
  targetY: number | null;

  constructor(unitType: UnitType, atk: number, range: number, attackSpeed: number, popCost: number) {
    this.unitType = unitType;
    this.atk = atk;
    this.range = range;
    this.attackSpeed = attackSpeed;
    this.popCost = popCost;
    this.cooldown = 0;
    this.targetId = null;
    this.targetX = null;
    this.targetY = null;
  }

  get canAttack(): boolean { return this.cooldown <= 0; }
  resetCooldown(): void { this.cooldown = 1 / this.attackSpeed; }
  tickCooldown(dt: number): void { if (this.cooldown > 0) this.cooldown -= dt; }
}
```

### 5.2 PlayerControllable 组件

```ts
// src/components/PlayerControllable.ts (新建)
import { CType } from '../types/index.js';

/** Tag — marks an entity as player-draggable */
export class PlayerControllable {
  readonly type = CType.PlayerControllable;
  isDragging: boolean;

  constructor() {
    this.isDragging = false;
  }
}
```

### 5.3 单位配置

```ts
// src/data/units.ts (新建)

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  [UnitType.ShieldGuard]: {
    type: UnitType.ShieldGuard,
    name: '盾卫',
    hp: 300, speed: 60, atk: 8,
    attackSpeed: 0.8, range: 50, defense: 40,
    popCost: 2,
    color: '#4dd0e1',  // cyan
    size: 30,
    skillId: 'skill_taunt',
  },
  [UnitType.Swordsman]: {
    type: UnitType.Swordsman,
    name: '剑士',
    hp: 150, speed: 80, atk: 15,
    attackSpeed: 1.0, range: 55, defense: 10,
    popCost: 2,
    color: '#e57373',  // red
    size: 26,
    skillId: 'skill_whirlwind',
  },
};
```

### 5.4 UnitSystem (新系统)

```
名称:       UnitSystem
依赖组件:   [Position, Unit, Health]  (单位本身)
查询目标:   [Position, Health, Enemy]  (攻击目标)

更新逻辑:
  1. 移动:
     - 若 unit.targetX/Y 不为 null，向目标点移动 (speed px/s)
     - 到达目标点 (距离 < 5px) → 清除 targetX/Y
     - 若正在攻击敌人 → 移动到攻击范围内就停止
  
  2. 攻击:
     - 搜索范围内最近的 Enemy 实体
     - 在攻击范围内且冷却完毕 → 造成伤害 (calcFinalDamage 物理伤害)
     - 重置冷却
  
  3. 碰撞:
     - 单位有碰撞体积 (半径 = size/2)
     - 与路径上的敌人碰撞 → 敌人被阻挡 (enemy.movementPaused = true)
     - 同时只能阻挡 2 个敌人 (避免堵路)
```

**单位渲染**：正方形 + 内嵌十字（区别于敌方圆形）。Render 创建时 shape='rect'，利用 label 绘制十字符号。

### 5.5 DragHandler (输入扩展)

```ts
// src/input/DragHandler.ts (新建)

export class DragHandler {
  private draggingEntityId: number | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  onPointerDown(x: number, y: number, world: World): boolean {
    // 检查点击位置是否命中 PlayerControllable 实体
    const units = world.query(CType.Position, CType.Unit, CType.PlayerControllable);
    for (const id of units) {
      const pos = world.getComponent<Position>(id, CType.Position)!;
      const render = world.getComponent<Render>(id, CType.Render);
      const r = render?.size ?? 20;
      if (Math.abs(x - pos.x) < r && Math.abs(y - pos.y) < r) {
        this.draggingEntityId = id;
        this.dragOffsetX = pos.x - x;
        this.dragOffsetY = pos.y - y;
        const ctrl = world.getComponent<PlayerControllable>(id, CType.PlayerControllable);
        if (ctrl) ctrl.isDragging = true;
        return true; // consumed
      }
    }
    return false;
  }

  onPointerMove(x: number, y: number, world: World): void {
    if (this.draggingEntityId === null) return;
    const pos = world.getComponent<Position>(this.draggingEntityId, CType.Position);
    if (pos) {
      pos.x = x + this.dragOffsetX;
      pos.y = y + this.dragOffsetY;
    }
  }

  onPointerUp(world: World): void {
    if (this.draggingEntityId === null) return;
    const ctrl = world.getComponent<PlayerControllable>(this.draggingEntityId, CType.PlayerControllable);
    if (ctrl) ctrl.isDragging = false;
    this.draggingEntityId = null;
  }

  isDragging(): boolean {
    return this.draggingEntityId !== null;
  }
}
```

**集成**：在 `main.ts` 的 `onPointerDown` 中，DragHandler 检查优先于 BuildSystem（单位拖拽优先级高于建造）。

### 5.6 单位死亡处理

- Unit 的 Health.current ≤ 0 → HealthSystem 检测到死亡
- 死亡处理：
  1. 移除 entity（包括 GridOccupant）
  2. 释放占用的 population
  3. 单位永久消失（该局不可重新部署）

---

## 6. Buff 系统

### 6.1 Buff 组件

```ts
// src/components/Buff.ts (新建)
import { CType, type BuffInstance } from '../types/index.js';

export class BuffContainer {
  readonly type = CType.Buff;
  buffs: BuffInstance[];

  constructor() {
    this.buffs = [];
  }

  /** Apply or refresh a buff. Returns true if added. */
  apply(buff: Omit<BuffInstance, 'currentStacks'>): boolean {
    const existing = this.buffs.find((b) => b.id === buff.id);
    if (existing) {
      // Refresh duration
      existing.duration = buff.duration;
      // Stack up to max
      if (existing.currentStacks < existing.maxStacks) {
        existing.currentStacks++;
        return true;
      }
      return false;
    }
    this.buffs.push({ ...buff, currentStacks: 1 });
    return true;
  }

  /** Remove a buff by ID */
  remove(buffId: string): void {
    this.buffs = this.buffs.filter((b) => b.id !== buffId);
  }

  /** Get total modifier for a given attribute (sum of all buffs) */
  getModifier(attribute: string): { absolute: number; percent: number } {
    let absolute = 0;
    let percent = 0;
    for (const b of this.buffs) {
      if (b.attribute === attribute) {
        if (b.isPercent) {
          percent += b.value * b.currentStacks;
        } else {
          absolute += b.value * b.currentStacks;
        }
      }
    }
    return { absolute, percent };
  }

  /** Get all active buff IDs */
  getActiveIds(): string[] {
    return this.buffs.filter((b) => b.duration > 0 || b.duration === -1).map((b) => b.id);
  }
}
```

### 6.2 BuffSystem (新系统)

```
名称:       BuffSystem
依赖组件:   [Buff]

更新逻辑:
  1. 遍历所有拥有 BuffContainer 的实体
  2. 减计时: duration > 0 → duration -= dt
  3. 移除过期 buff: duration === 0 (排除 -1 永久)
  4. 应用属性修改: 将 buffs 的效果合入对应组件
     - ATK/Speed/Range → Attack 组件
     - HP → Health 组件 (只影响 maxHP? 还是 currentHP? 先只影响 current)
     - Defense → 影响伤害计算时的护甲值
```

**关键设计决策**：Buff 修改不是直接改组件数值，而是通过 BuffSystem 在计算前提供修正值：

```ts
// BuffSystem 暴露查询方法
getEffectiveAtk(entityId: number, baseAtk: number): number {
  const buffs = this.world.getComponent<BuffContainer>(entityId, CType.Buff);
  if (!buffs) return baseAtk;
  const mod = buffs.getModifier('atk');
  return baseAtk * (1 + mod.percent / 100) + mod.absolute;
}
```

各系统在计算伤害/速度等时，调用 `BuffSystem.getEffectiveXxx()` 获取修正后的值。

### 6.3 Buff 渲染

- 每个实体的 BuffContainer 如果非空 → RenderSystem 在实体上方绘制小图标（16×16 方块，颜色=类型色）
- 最多显示 3 个 buff 图标，水平排列
- 血条颜色受 buff 影响：增益 → 额外金色描边；减益 → 额外紫色描边

### 6.4 预定义 Buff 列表

```ts
// src/data/buffs.ts (新建)

export const BUFF_DEFS = {
  // ---- 减速 (Ice Tower) ----
  chill: {
    id: 'chill', name: '寒冰',
    type: BuffType.Debuff,
    attribute: BuffAttribute.Speed,
    value: -20, isPercent: true,
    duration: 3.0, maxStacks: 5,
    sourceEntityId: 0, // set at runtime
  },
  // ---- 冰冻 (满层触发) ----
  freeze: {
    id: 'freeze', name: '冰冻',
    type: BuffType.Debuff,
    attribute: BuffAttribute.Speed,
    value: -100, isPercent: true,
    duration: 1.0, maxStacks: 1,
    sourceEntityId: 0,
  },
  // ---- 嘲讽 (Shield Guard) ----
  taunt: {
    id: 'taunt', name: '嘲讽',
    type: BuffType.Debuff,
    attribute: BuffAttribute.ATK, // 其实不是改ATK，只是改目标选择
    value: 0, isPercent: false,
    duration: 3.0, maxStacks: 1,
    sourceEntityId: 0,
  },
} as const;
```

---

## 7. 技能系统

### 7.1 Skill 组件

```ts
// src/components/Skill.ts (新建)
import { CType, type SkillConfig, type SkillTrigger } from '../types/index.js';

export class Skill {
  readonly type = CType.Skill;
  skillId: string;
  trigger: SkillTrigger;
  cooldownRemaining: number;
  cooldownTotal: number;
  energyCost: number;
  range: number;
  level: number;       // tower level or unit level
  name: string;

  constructor(cfg: SkillConfig) {
    this.skillId = cfg.id;
    this.trigger = cfg.trigger;
    this.cooldownTotal = cfg.cooldown;
    this.cooldownRemaining = 0;
    this.energyCost = cfg.manaCost;
    this.range = cfg.range;
    this.level = 1;
    this.name = cfg.name;
  }

  get isReady(): boolean {
    return this.cooldownRemaining <= 0;
  }

  startCooldown(): void {
    this.cooldownRemaining = this.cooldownTotal;
  }

  tick(dt: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= dt;
    }
  }
}
```

### 7.2 技能配置

```ts
// src/data/skills.ts (新建)

export const SKILL_CONFIGS: Record<string, SkillConfig> = {
  // ---- 单位主动技能 ----
  skill_taunt: {
    id: 'skill_taunt',
    name: '嘲讽',
    trigger: SkillTrigger.Active,
    cooldown: 8,
    manaCost: 20,
    range: 120,
    description: '强制周围敌人攻击自己，持续3秒',
  },
  skill_whirlwind: {
    id: 'skill_whirlwind',
    name: '旋风斩',
    trigger: SkillTrigger.Active,
    cooldown: 6,
    manaCost: 15,
    range: 80,
    description: '对周围敌人造成30点AOE伤害',
  },

  // ---- 塔被动技能（塔升到L3解锁） ----
  skill_arrow_crit: {
    id: 'skill_arrow_crit',
    name: '精准射击',
    trigger: SkillTrigger.Passive,
    cooldown: 0,
    manaCost: 0,
    range: 0,
    description: '15%概率造成2倍暴击',
  },
  skill_cannon_concentrated: {
    id: 'skill_cannon_concentrated',
    name: '集束弹药',
    trigger: SkillTrigger.Passive,
    cooldown: 0,
    manaCost: 0,
    range: 0,
    description: 'AOE半径+30%，溅射伤害提升至80%',
  },
  skill_ice_shatter: {
    id: 'skill_ice_shatter',
    name: '碎裂',
    trigger: SkillTrigger.Passive,
    cooldown: 0,
    manaCost: 0,
    range: 0,
    description: '冰冻结束时触发一次小范围AOE (30 dmg)',
  },
  skill_lightning_overload: {
    id: 'skill_lightning_overload',
    name: '过载',
    trigger: SkillTrigger.Passive,
    cooldown: 0,
    manaCost: 0,
    range: 0,
    description: '弹跳次数+2，衰减降低至15%',
  },

  // ---- Boss 技能 ----
  skill_boss_summon: {
    id: 'skill_boss_summon',
    name: '召唤小兵',
    trigger: SkillTrigger.Active,
    cooldown: 12,
    manaCost: 0,
    range: 0,
    description: '在自身周围召唤3个小兵',
  },
  skill_boss_war_cry: {
    id: 'skill_boss_war_cry',
    name: '战吼',
    trigger: SkillTrigger.Active,
    cooldown: 15,
    manaCost: 0,
    range: 300,
    description: '给周围所有敌人+30%速度和+20%攻击力，持续5秒',
  },
  skill_boss_ground_slam: {
    id: 'skill_boss_ground_slam',
    name: '砸地',
    trigger: SkillTrigger.Active,
    cooldown: 10,
    manaCost: 0,
    range: 150,
    description: 'AOE伤害 50 + 减速50%持续2秒',
  },
};
```

### 7.3 SkillSystem (新系统)

```
名称:       SkillSystem
依赖组件:   [Skill] (+ Position 用于光环范围检测)

更新逻辑:
  1. 减冷却: 所有 Skill 组件 tick(dt)
  2. 被动技能 (Passive):
     - 检测所属实体的条件（如：箭塔L3 → 给 Attack 加 critChance 字段）
     - Passive 技能通过 Buff 系统实现（给实体自身加永久 buff）
  3. 光环技能 (Aura):
     - 每帧搜索范围内符合条件的实体
     - 给范围内的实体施加/刷新对应的 buff
     - 实体离开范围 → buff 过期自然移除
  4. 条件技能 (Conditional):
     - Boss 血量 < 50% → 触发狂暴 buff
     - 检测在 HealthSystem 中完成，触发通过 SkillSystem

外部触发 (Active):
  玩家点击技能按钮 → main.ts 调用:
    skillSystem.activateSkill(unitId, 'skill_taunt')

  activateSkill(skillId):
    1. 检查技能冷却和能量
    2. 执行技能效果 (Taunt → 给周围敌人加 taunt buff)
    3. 扣除能量 → startCooldown()
```

### 7.4 Aura 实现细节

Aura 技能不通过 BuffSystem 的 apply/remove 管理，而是每帧动态检测：

```ts
// SkillSystem 中的光环处理（每帧）
for (const entityId of entitiesWithAuraSkill) {
  const skill = getSkill(entityId);
  const pos = getPosition(entityId);

  const targets = world.query(CType.Position, ...skill.targetTypes);
  for (const targetId of targets) {
    const tPos = getPosition(targetId);
    if (distance(pos, tPos) <= skill.range) {
      // 施加 buff（持续时间 0.1s 短周期，每帧刷新保证不会过期）
      buffSystem.applyBuff(targetId, skill.auraBuffDef, entityId);
    }
  }
}
```

---

## 8. Boss 系统

### 8.1 Boss 组件

```ts
// src/components/Boss.ts (新建)
import { CType } from '../types/index.js';

export class Boss {
  readonly type = CType.Boss;
  phase: 1 | 2;              // 阶段
  skills: string[];           // 技能ID列表
  skillTimers: Map<string, number>; // 每个技能独立的冷却计时

  constructor(skills: string[]) {
    this.phase = 1;
    this.skills = skills;
    this.skillTimers = new Map();
  }
}
```

### 8.2 Boss 配置

```ts
// src/data/bosses.ts (新建)

export const BOSS_CONFIGS: Record<string, EnemyConfig> = {
  [EnemyType.BossCommander]: {
    type: EnemyType.BossCommander,
    name: '指挥官',
    hp: 800,          // ~3x normal elite
    speed: 40,
    atk: 30,
    defense: 0,
    armor: 60,
    magicResist: 40,
    attackRange: 100,
    attackSpeed: 0.7,
    canAttackBuildings: true,
    isBoss: true,
    bossSkills: ['skill_boss_summon', 'skill_boss_war_cry'],
    rewardGold: 100,
    color: '#ffd54f',  // gold
    radius: 36,
  },
  [EnemyType.BossBeast]: {
    type: EnemyType.BossBeast,
    name: '攻城兽',
    hp: 1000,
    speed: 35,
    atk: 40,
    defense: 0,
    armor: 80,
    magicResist: 20,
    attackRange: 80,
    attackSpeed: 0.5,
    canAttackBuildings: true,
    isBoss: true,
    bossSkills: ['skill_boss_ground_slam'],
    rewardGold: 120,
    color: '#ff7043',  // deep orange
    radius: 40,
  },
};
```

### 8.3 Boss 波次标识

```ts
// WaveConfig 扩展
export interface WaveConfig {
  // ...existing...
  isBossWave?: boolean;
  bossType?: EnemyType; // 如 EnemyType.BossCommander
}
```

### 8.4 Boss 行为逻辑 (BossSystem, 新系统)

```
名称:       BossSystem
依赖组件:   [Boss, Health, Position]

更新逻辑:
  1. 阶段转换检测:
     - Boss 实体 HP < 50% 且 phase === 1 → 进入 Phase 2
     - Phase 2 效果:
       · 移速 +30%
       · 攻速 +50%
       · 解锁额外技能（如 BossCommander P2 获得 ground_slam）
       · 视觉变化：Render.color 变亮/变红
       · 生成一个 particle burst 视觉（Phase 4 打磨）

  2. 技能释放:
     - 每 0.5s 随机检查是否释放技能 (概率 30%)
     - 选择一个冷却完毕的技能释放
     - 技能冷却独立管理

  3. 视觉:
     - Boss 渲染为大圆形
     - 上方额外绘制一个三角形（皇冠效果）—— 通过第二个 Render 实体实现
     - 或者：直接在 RenderSystem 中检测 Boss 组件，自动绘制 crown
```

### 8.5 Boss 生成

WaveSystem.spawnEnemy() 检测 `config.isBoss` → 额外添加 Boss 组件：

```ts
if (config.isBoss) {
  this.world.addComponent(id, new Boss(config.bossSkills ?? []));
}
```

### 8.6 波次节奏

每 5 波出现 Boss（无尽模式）。关卡模式下，Boss 波次由关卡配置静态指定。

---

## 9. 生产建筑 (2种)

### 9.1 配置表

```ts
// src/data/production.ts (新建)

export const PRODUCTION_CONFIGS: Record<ProductionType, ProductionConfig> = {
  [ProductionType.GoldMine]: {
    type: ProductionType.GoldMine,
    name: '金矿',
    cost: 100, hp: 80,
    resourceType: 'gold',
    baseRate: 2,          // +2 gold/sec
    upgradeRateBonus: 2,  // +2/sec per level
    upgradeCosts: [60, 120],
    maxLevel: 3,
    color: '#ffd54f',
  },
  [ProductionType.EnergyTower]: {
    type: ProductionType.EnergyTower,
    name: '能量塔',
    cost: 75, hp: 60,
    resourceType: 'energy',
    baseRate: 1,          // +1 energy/sec
    upgradeRateBonus: 1,  // +1/sec per level
    upgradeCosts: [50, 100],
    maxLevel: 3,
    color: '#7e57c2',
  },
};
```

### 9.2 Production 组件

```ts
// src/components/Production.ts (新建)
import { CType, type ProductionType } from '../types/index.js';

export class Production {
  readonly type = CType.Production;
  productionType: ProductionType;
  level: number;
  resourceType: 'gold' | 'energy';
  rate: number; // current output per second

  constructor(prodType: ProductionType, resourceType: 'gold' | 'energy', rate: number) {
    this.productionType = prodType;
    this.level = 1;
    this.resourceType = resourceType;
    this.rate = rate;
  }
}
```

### 9.3 BuildSystem 扩展

```ts
// BuildSystem 新增字段
selectedProductionType: ProductionType | null = null;

// 新增方法
selectProduction(type: ProductionType): void
tryBuildProduction(px: number, py: number): boolean
```

建造逻辑与 `tryBuild` 相同（检查空地、花费金币、创建实体）。生产建筑也占用 grid cell。

### 9.4 EconomySystem 扩展 (生产计时)

```ts
// EconomySystem.update() 中追加
private productionAccumulator: number = 0;

update(_entities: number[], dt: number): void {
  // ...existing gold settlement...

  // Production buildings generate resources
  const producers = this.world.query(CType.Production);
  for (const id of producers) {
    const prod = this.world.getComponent<Production>(id, CType.Production);
    if (!prod) continue;
    const amount = prod.rate * dt;
    if (prod.resourceType === 'gold') {
      this.pendingGold += amount;
    } else if (prod.resourceType === 'energy') {
      this.pendingEnergy += amount;
    }
  }

  // Settlement at end of frame → to merchant gold/energy
}
```

EconomySystem 新增 `energy` 和 `pendingEnergy` 字段（结构与 gold 一致）。

### 9.5 升级

升级逻辑复刻 Tower 升级（BuildSystem 已预留框架）。点击生产建筑 → 底部面板显示升级按钮 → 花费 upgradeCosts[level-1] → level++ → rate 增加。

---

## 10. Energy 资源系统

### 10.1 新增 EconomySystem 字段

```ts
energy: number = 50;
private pendingEnergy: number = 0;

spendEnergy(amount: number): boolean  // 同 spendGold 逻辑
```

### 10.2 获取方式

| 来源 | 数值 |
|------|------|
| 初始 | 50 |
| 能量塔 L1 | 1/sec |
| 能量塔 L2 | 2/sec |
| 能量塔 L3 | 3/sec |
| 击杀 Boss | +30 |
| 击杀精英 | +5 |
| 波次奖励 | +10 (每 5 波) |

### 10.3 用途

- 释放单位主动技能（消耗 15-20）
- Boss 技能触发时机成本（仅敌方，不需要玩家付能量）
- 未来：激活机关、召唤精英单位

---

## 11. Population 人口系统

### 11.1 规则

- 默认人口上限：6
- 每个单位占用 2 人口
- 人口满后无法部署新单位
- 可在部署阶段花费 100 G 升级人口上限 (+2 per upgrade, max 12)

### 11.2 实现

```ts
// EconomySystem 或新的 ResourceSystem
populationUsed: number = 0;
populationMax: number = 6;

canDeployUnit(popCost: number): boolean {
  return this.populationUsed + popCost <= this.populationMax;
}

deployUnit(popCost: number): void {
  this.populationUsed += popCost;
}

releaseUnit(popCost: number): void {
  this.populationUsed = Math.max(0, this.populationUsed - popCost);
}

upgradePopulation(): boolean {
  if (this.populationMax >= 12) return false;
  if (!this.spendGold(100)) return false;
  this.populationMax += 2;
  return true;
}
```

---

## 12. 系统注册顺序

```
Phase 2 系统注册顺序 (src/main.ts):

1.  MovementSystem        — 敌人沿路径移动 + 单位移动
2.  EnemyAttackSystem     — 敌人反制 AI: 攻击建筑/单位
3.  AttackSystem          — 塔自动攻击，发射 Projectile
4.  UnitSystem            — 单位自动攻击
5.  ProjectileSystem      — 弹道飞行 + 命中结算 (伤害/减速/链击/AOE)
6.  SkillSystem           — 技能冷却 + 光环 + 被动
7.  BuffSystem            — Buff 计数 + 属性修正
8.  BossSystem            — Boss 阶段转换 + 技能 AI
9.  WaveSystem            — 波次管理 + 敌人生成
10. EconomySystem         — 金币/能量结算 + 生产建筑产出
11. HealthSystem          — 死亡检测 + 胜负判定 + Exploder 爆炸
12. BuildSystem           — 建造/修复/升级 (输入驱动)
13. RenderSystem          — 地图 + 实体渲染
14. UISystem              — HUD + 面板 (顶层)
```

**渲染之前**必先完成所有逻辑更新，确保每帧渲染的数据是最新的。

**HealthSystem 在 EconomySystem 之后**：因为 Exploder 死亡爆炸会在 HealthSystem 中检测，需确保 EconomySystem 先结算能量（若死亡触发能量奖励）。

---

## 13. Phase 2 波次配置示例

```ts
// src/data/waves_phase2.ts (新建)

export const PHASE2_WAVES: WaveConfig[] = [
  // Wave 1 — 教学
  { waveNumber: 1, enemies: [
    { enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 },
  ], spawnDelay: 2 },

  // Wave 2 — 引入 Runner
  { waveNumber: 2, enemies: [
    { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
    { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.6 },
  ], spawnDelay: 2 },

  // Wave 3 — 引入 Exploder
  { waveNumber: 3, enemies: [
    { enemyType: EnemyType.Grunt, count: 5, spawnInterval: 0.9 },
    { enemyType: EnemyType.Exploder, count: 2, spawnInterval: 1.5 },
  ], spawnDelay: 3 },

  // Wave 4 — 混合编组
  { waveNumber: 4, enemies: [
    { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 0.8 },
    { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.5 },
    { enemyType: EnemyType.Exploder, count: 2, spawnInterval: 1.2 },
  ], spawnDelay: 2 },

  // Wave 5 — Boss 波次!
  { waveNumber: 5, enemies: [
    { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
    { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
  ], spawnDelay: 4, isBossWave: true, bossType: EnemyType.BossCommander },

  // Wave 6 — 引入 Heavy
  { waveNumber: 6, enemies: [
    { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
    { enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.0 },
  ], spawnDelay: 3 },

  // Wave 7 — 引入 Mage
  { waveNumber: 7, enemies: [
    { enemyType: EnemyType.Mage, count: 3, spawnInterval: 2.0 },
    { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.6 },
  ], spawnDelay: 3 },

  // Wave 8 — 全面混合
  { waveNumber: 8, enemies: [
    { enemyType: EnemyType.Heavy, count: 2, spawnInterval: 1.8 },
    { enemyType: EnemyType.Mage, count: 2, spawnInterval: 2.0 },
    { enemyType: EnemyType.Exploder, count: 3, spawnInterval: 1.0 },
    { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.5 },
  ], spawnDelay: 3 },

  // Wave 9 — 压力波次
  { waveNumber: 9, enemies: [
    { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 1.5 },
    { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
    { enemyType: EnemyType.Runner, count: 5, spawnInterval: 0.4 },
  ], spawnDelay: 2 },

  // Wave 10 — Boss 波次
  { waveNumber: 10, enemies: [
    { enemyType: EnemyType.BossBeast, count: 1, spawnInterval: 0 },
    { enemyType: EnemyType.Heavy, count: 2, spawnInterval: 1.5 },
    { enemyType: EnemyType.Exploder, count: 3, spawnInterval: 0.8 },
  ], spawnDelay: 5, isBossWave: true, bossType: EnemyType.BossBeast },
];
```

---

## 附录 A：文件新增清单

| 文件 | 类型 |
|------|------|
| `src/components/Unit.ts` | 新组件 |
| `src/components/PlayerControllable.ts` | 新组件 |
| `src/components/Buff.ts` | 新组件 |
| `src/components/Skill.ts` | 新组件 |
| `src/components/Boss.ts` | 新组件 |
| `src/components/Production.ts` | 新组件 |
| `src/systems/UnitSystem.ts` | 新系统 |
| `src/systems/EnemyAttackSystem.ts` | 新系统 |
| `src/systems/BuffSystem.ts` | 新系统 |
| `src/systems/SkillSystem.ts` | 新系统 |
| `src/systems/BossSystem.ts` | 新系统 |
| `src/data/units.ts` | 新配置 |
| `src/data/skills.ts` | 新配置 |
| `src/data/buffs.ts` | 新配置 |
| `src/data/bosses.ts` | 新配置 |
| `src/data/production.ts` | 新配置 |
| `src/data/waves_phase2.ts` | 新配置 |
| `src/input/DragHandler.ts` | 新工具 |
| `src/utils/math.ts` | 新工具 (伤害公式) |

## 附录 B：文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/types/index.ts` | 新增 CType、枚举、接口 |
| `src/data/gameData.ts` | 追加 TOWER_CONFIGS 3条 + ENEMY_CONFIGS 4条 |
| `src/systems/AttackSystem.ts` | PROJECTILE_CFG 扩展；注入 TowerConfig 以获取 splash/chain 参数 |
| `src/systems/ProjectileSystem.ts` | AOE 溅射伤害逻辑；链击弹跳逻辑；减速施加逻辑 |
| `src/systems/HealthSystem.ts` | Exploder 死亡爆炸；Tower 废墟生成；Boss 阶段检测回调 |
| `src/systems/BuildSystem.ts` | 生产建筑建造/升级；塔修复(tryRepair)；新 towerType 支持 |
| `src/systems/EconomySystem.ts` | energy 系统；生产建筑结算；人口管理 |
| `src/systems/MovementSystem.ts` | 检查 Enemy.movementPaused 跳过移动 |
| `src/systems/RenderSystem.ts` | Boss crown 绘制；Exploder flashing；Buff 图标；单位十字形 |
| `src/systems/WaveSystem.ts` | Boss 波次处理；Counter AI 规则注入；Enemy 组件新增字段 |
| `src/systems/UISystem.ts` | 新增塔按钮(3个)；单位面板；技能按钮；能量/人口显示 |
| `src/components/Enemy.ts` | 新增 movementPaused 字段 |
| `src/components/Render.ts` | 新增 flash 字段 |
| `src/components/Tower.ts` | 新增 splashRadius 等字段（或从 config 读取） |
| `src/components/Health.ts` | 无修改（现有接口足够） |
| `src/main.ts` | 注册新系统；DragHandler；技能按钮回调；新增 UI 面板 |

## 附录 C：类型兼容性注意事项

1. `EnemyConfig.defense` 保留用于向后兼容，实际使用 `armor` 和 `magicResist` 分别计算。
2. `TowerConfig` 新增字段均为可选（`?`），不影响现有 Arrow 配置。
3. `WaveConfig.isBossWave` 可选，MVP 波次不填即为 false。
4. Buff 的 `sourceEntityId` 在 apply 时设为 0 表示"系统来源"（冰塔减速），之后由 BuffSystem 覆写为实际来源实体 ID。
5. 所有新组件遵循 `readonly type = CType.Xxx` 模式。
