# 13 — Phase 3 Design: Content & Balance

> 版本: v0.1 | 日期: 2026-05-07 | 基于 Phase 2 代码基线

---

## 目录

1. [架构变更](#1-架构变更)
2. [Level 系统 (5 关)](#2-level-系统-5-关)
3. [关卡选择 UI](#3-关卡选择-ui)
4. [无尽模式](#4-无尽模式)
5. [存档系统](#5-存档系统)
6. [数值平衡](#6-数值平衡)
7. [中立单位](#7-中立单位)
8. [实现计划](#8-实现计划)
9. [附录: 文件清单](#9-附录-文件清单)

---

## 1. 架构变更

### 1.1 新增 GameScreen 枚举

当前 `GamePhase` 仅管理局内流程。Phase 3 需要上级屏幕状态来切换主菜单 / 选关 / 游戏内。

```ts
// src/types/index.ts — 追加

export enum GameScreen {
  MainMenu = 'main_menu',        // 标题画面
  LevelSelect = 'level_select',   // 关卡选择网格
  Playing = 'playing',           // 局内 (沿用 GamePhase)
  EndlessPlaying = 'endless_playing', // 无尽模式局内
}
```

### 1.2 新增 CType 常量

```ts
// src/types/index.ts — 追加到 CType

Neutral: 'Neutral',       // 中立实体标记
Trap: 'Trap',             // 陷阱 (尖刺)
HealingSpring: 'HealingSpring', // 治疗泉水
GoldChest: 'GoldChest',   // 金币宝箱
```

### 1.3 新增枚举

```ts
export enum NeutralType {
  SpikeTrap = 'spike_trap',
  HealingSpring = 'healing_spring',
  GoldChest = 'gold_chest',
}

export enum LevelTheme {
  Plains = 'plains',
  Desert = 'desert',
  Tundra = 'tundra',
  Volcano = 'volcano',
  Castle = 'castle',
}
```

### 1.4 MapConfig 扩展 (主题颜色)

```ts
// src/types/index.ts — MapConfig 追加字段

export interface MapConfig {
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileType[][];
  enemyPath: GridPos[];
  /** Phase 3: additional spawn points (Level 3 Tundra) */
  altSpawnPoints?: GridPos[];
  /** Phase 3: theme-specific tile colors. If undefined, fallback to defaults */
  tileColors?: Partial<Record<TileType, string>>;
}
```

### 1.5 WaveConfig 扩展

```ts
export interface WaveConfig {
  waveNumber: number;
  enemies: WaveEnemyGroup[];
  spawnDelay: number;
  isBossWave?: boolean;
  /** Phase 3: special wave rules */
  specialRules?: WaveSpecialRule[];
  /** Phase 3: which spawn point to use (index into map.altSpawnPoints). Default: 0 (primary) */
  spawnPointIndex?: number;
}

export enum WaveSpecialRule {
  DoubleSpeed = 'double_speed',       // all enemies +100% speed this wave
  Fortified = 'fortified',            // all enemies +50% HP
  Rush = 'rush',                      // spawnInterval halved
  NoBuild = 'no_build',               // cannot build towers during this wave
}
```

### 1.6 LevelConfig (关卡配置)

```ts
export interface LevelConfig {
  id: string;
  name: string;
  theme: LevelTheme;
  description: string;
  map: MapConfig;
  waves: WaveConfig[];
  startingGold: number;
  /** Available towers for this level. Empty = all unlocked. */
  availableTowers: TowerType[];
  /** Available unit types. Empty = all unlocked. */
  availableUnits: UnitType[];
  /** Stars required from previous levels to unlock. 0 = always unlocked. */
  unlockStarsRequired: number;
  /** Level id that must be completed to unlock this one */
  unlockPrevLevelId: string | null;
}
```

### 1.7 GameScreen 数据流

```
  [启动] → MainMenu → LevelSelect → Playing (局内: Deployment→Battle→...)
                                      ↓
                              Victory/Defeat → LevelSelect (更新进度)
                              
  LevelSelect → EndlessPlaying (无尽模式局内)
```

---

## 2. Level 系统 (5 关)

### 2.1 主题配色表

```ts
// src/data/levelThemes.ts (新建)

import { TileType, LevelTheme } from '../types/index.js';

export const THEME_COLORS: Record<LevelTheme, Record<TileType, string>> = {
  [LevelTheme.Plains]: {
    [TileType.Empty]: '#7cb342',
    [TileType.Path]: '#8d6e63',
    [TileType.Blocked]: '#546e7a',
    [TileType.Spawn]: '#ff8f00',
    [TileType.Base]: '#1e88e5',
  },
  [LevelTheme.Desert]: {
    [TileType.Empty]: '#e6c44d',
    [TileType.Path]: '#bfa045',
    [TileType.Blocked]: '#795548',
    [TileType.Spawn]: '#ef6c00',
    [TileType.Base]: '#5c6bc0',
  },
  [LevelTheme.Tundra]: {
    [TileType.Empty]: '#cfd8dc',
    [TileType.Path]: '#90a4ae',
    [TileType.Blocked]: '#607d8b',
    [TileType.Spawn]: '#4dd0e1',
    [TileType.Base]: '#42a5f5',
  },
  [LevelTheme.Volcano]: {
    [TileType.Empty]: '#4e342e',
    [TileType.Path]: '#5d4037',
    [TileType.Blocked]: '#1a0000',   // lava — very dark
    [TileType.Spawn]: '#ff5722',
    [TileType.Base]: '#546e7a',
  },
  [LevelTheme.Castle]: {
    [TileType.Empty]: '#37474f',
    [TileType.Path]: '#546e7a',
    [TileType.Blocked]: '#263238',
    [TileType.Spawn]: '#fff176',
    [TileType.Base]: '#42a5f5',
  },
};
```

### 2.2 关卡总览表

| # | ID | 名称 | 主题 | 波数 | 起始金币 | 解锁条件 | 限制塔 | 地图特征 |
|---|-----|------|------|------|----------|----------|--------|----------|
| 1 | `L1_plains` | 平原 | Plains | 10 | 200 | 无 (默认) | 箭塔, 炮塔 | 简单 Z-path, 教程友好 |
| 2 | `L2_desert` | 沙漠 | Desert | 12 | 250 | 通 L1 | 箭, 炮, 冰 | 长路径 + 分支路口 |
| 3 | `L3_tundra` | 冰原 | Tundra | 15 | 300 | 通 L2 | 箭, 冰, 电 | 双 spawn, 路径含减速 |
| 4 | `L4_volcano` | 火山 | Volcano | 15 | 350 | 通 L3 | 炮, 电, 冰 | 岩浆阻挡, 窄走廊, 火抗敌人 |
| 5 | `L5_castle` | 城堡 | Castle | 15 | 400 | 通 L4 | 全部 | 迷宫路径, Boss 终关 |

### 2.3 Level 1 — 平原 (Plains)

**路径拓扑** (waypoints → 转换到 TileType[][] 在数据文件中):

```
Spawn(3,0) ───→ (3,8) ───→ (10,8) ───→ (10,18) ───→ (8,18) ───→ Base(8,29)

     0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29
  0  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  1  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  2  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  3 [S] ─── ─── ─── ─── ─── ─── ─── ─  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  4  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  5  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  6  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  7  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
  8  .  .  .  .  .  .  .  .  ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── [B]
  9  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
 10  .  .  .  .  .  .  .  . [P] ─── ─── ─── ─── ─── ─── ─── ─  .  .  .  .  .  .  .  .  .  .
 11  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .
 12  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .
 13  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  .  .  .  .  .  .  .  .  .  .  .
 14  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
 15  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
 16  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
```

- 路径全长 ~38 格
- 弯拐处 (3,8) (10,8) (10,18) 是理想建塔点
- 无特殊规则

**Level 1 波次配置示例** (10 波):

```ts
// src/data/levels/l1_plains.ts (新建)

export const L1_WAVES: WaveConfig[] = [
  { waveNumber: 1,  enemies: [{ enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.5 }], spawnDelay: 2 },
  { waveNumber: 2,  enemies: [{ enemyType: EnemyType.Grunt, count: 8, spawnInterval: 1.2 }], spawnDelay: 2 },
  { waveNumber: 3,  enemies: [
    { enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 },
    { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.6 },
  ], spawnDelay: 2 },
  { waveNumber: 4,  enemies: [{ enemyType: EnemyType.Grunt, count: 10, spawnInterval: 1.0 }], spawnDelay: 2 },
  { waveNumber: 5,  enemies: [
    { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.2 },
    { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
  ], spawnDelay: 3, isBossWave: true },
  { waveNumber: 6,  enemies: [
    { enemyType: EnemyType.Runner, count: 6, spawnInterval: 0.6 },
    { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
  ], spawnDelay: 2 },
  { waveNumber: 7,  enemies: [{ enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 }], spawnDelay: 2 },
  { waveNumber: 8,  enemies: [
    { enemyType: EnemyType.Heavy, count: 2, spawnInterval: 2.0 },
    { enemyType: EnemyType.Runner, count: 5, spawnInterval: 0.5 },
    { enemyType: EnemyType.Exploder, count: 2, spawnInterval: 1.5 },
  ], spawnDelay: 3 },
  { waveNumber: 9,  enemies: [
    { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
    { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
  ], spawnDelay: 2 },
  { waveNumber: 10, enemies: [
    { enemyType: EnemyType.BossBeast, count: 1, spawnInterval: 0 },
    { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 0.8 },
    { enemyType: EnemyType.Exploder, count: 2, spawnInterval: 1.2 },
  ], spawnDelay: 4, isBossWave: true },
];
```

### 2.4 Level 2 — 沙漠 (Desert)

**路径拓扑** — 带分叉 (fork):

```
Spawn(3,0) ─→ (3,6) ─→ (8,6) ─→ (8,14) ─→ (14,14) ─→ (14,22) ─→ (9,22) ─→ Base(9,29)
                          ↓ fork to:
                    (8,10) ─→ (6,10) ─→ (6,14) ─→ (8,14)  [shorter bypass]
```

- 主路径 ~48 格，分叉捷径 ~18 格更短但更窄 (仅1格 path 宽)
- 捷径路径: 部分 fast enemies 随机走捷径 (WaveSpecialRule)
- 黄色沙地，窄走廊 (分叉附近 path 只 1 格宽)

**Level 2 波次配置要点**：
- 12 波，第 6 波和第 12 波为 Boss 波
- 第 4 波引入 `WaveSpecialRule.Rush` (快兵 rush 波)
- 第 8 波混合编组含走捷径的 Runner
- 第 10 波重兵 + 法师混编

### 2.5 Level 3 — 冰原 (Tundra)

**路径拓扑** — 双 spawn 点:

```
Primary spawn:   SpawnA(3,0) ──→ (3,9) ──→ (8,9) ──→ (8,19) ──→ (12,19) ──→ (12,24) ──→ Base(8,29)
Secondary spawn: SpawnB(3,29) ──→ (3,19) ─→ (8,19) ──→ ... (merge into main path at (8,19))
```

- 白/蓝冰雪色调
- 路径上的敌人减速 15% (由冰原 buff 实现)
- AltSpawnPoints: `[{ row: 3, col: 29 }]`

**冰原减速实现**：WaveSystem spawn 敌人时，额外添加一个永久冰原 buff:

```ts
// WaveSystem.spawnEnemy() 中 (冰原检测)
if (this.map.name.includes('冰原')) {
  const bc = new BuffContainer();
  bc.apply({
    id: 'tundra_slow', name: '冻土',
    attribute: BuffAttribute.Speed,
    value: -15, isPercent: true,
    duration: -1,           // 永久
    maxStacks: 1,
    sourceEntityId: -1,     // 地图来源
  });
  this.world.addComponent(id, bc);
}
```

**Level 3 波次配置要点**：
- 15 波，双 spawn 轮换使用 (`spawnPointIndex` 字段)
- 大量冰塔可用的关卡 (Ice tower 优势明显)
- 第 7, 11 波为 `DoubleSpeed` 抵消减速
- 第 15 波双 Boss (BossCommander + BossBeast 各一)

### 2.6 Level 4 — 火山 (Volcano)

**路径拓扑** — 带岩浆阻挡:

```
Spawn(3,0) ─→ (3,5) ─→ (8,5) ─→ (8,10) ─→ (5,10) ─→ (5,16) ─→ (12,16) ─→ (12,22) ─→ (8,22) ─→ Base(8,29)

Lava (Blocked tiles) at: (7-9, 3-4), (4-6, 12-14), (10-13, 8-10), (10-12, 20-21)
```

- 红/黑岩浆色调
- 大量 `TileType.Blocked` (岩浆)，不可通行，不可建造
- 窄走廊迫使塔位紧张
- 所有敌人自带 30% 火抗 (armor +15)

**火山 buff 实现**：

```ts
// WaveSystem 中
if (this.map.name.includes('火山')) {
  // 给敌人加 armor bonus
  enemy.armor = (enemy.armor ?? 0) + 15;
}
```

**Level 4 波次配置要点**：
- 15 波，大量 Heavy (火抗护甲高)
- 避免大量 Exploder (会炸毁玩家本就紧张的塔位)
- 第 10, 15 波 Boss 波
- 第 5, 12 波 `Fortified` 规则

### 2.7 Level 5 — 城堡 (Castle)

**路径拓扑** — 迷宫式:

```
Spawn(3,0) ─→ (3,3) ─→ (8,3) ─→ (8,8) ─→ (3,8) ─→ (3,13) ─→ (8,13) ─→ (8,18)
             ─→ (13,18) ─→ (13,13) ─→ (11,13) ─→ (11,8) ─→ (14,8) ─→ (14,3) ─→ (8,3)
             ─→ (8,24) ─→ Base(8,29)
```

Wait — the castle path is overly complex. Let me simplify:

```
Spawn(3,0) ─→ (3,4) ─→ (8,4) ─→ (8,10) ─→ (3,10) ─→ (3,16) ─→ (8,16) ─→ (8,22) ─→ Base(8,29)
                          [Blocked walls along the vertical segments]
```

- 石/蓝色调
- 路径在狭窄走廊中来回折叠
- 最长的路径长度 (~55 格)
- 全部塔和单位可用

**Level 5 波次配置要点**：
- 15 波，终局难度
- 第 15 波为终极 Boss (**新**: `BossKing`), HP 2000+
- 波次含全敌人类型混编
- 第 10 波 `NoBuild` — 考验已有防御

### 2.8 Level Config Registry

```ts
// src/data/levels/index.ts (新建)

import { L1 } from './l1_plains.js';
import { L2 } from './l2_desert.js';
import { L3 } from './l3_tundra.js';
import { L4 } from './l4_volcano.js';
import { L5 } from './l5_castle.js';
import type { LevelConfig } from '../../types/index.js';

export const LEVEL_CONFIGS: Record<string, LevelConfig> = {
  [L1.id]: L1,
  [L2.id]: L2,
  [L3.id]: L3,
  [L4.id]: L4,
  [L5.id]: L5,
};

export const LEVEL_ORDER = ['L1_plains', 'L2_desert', 'L3_tundra', 'L4_volcano', 'L5_castle'] as const;
```

---

## 3. 关卡选择 UI

### 3.1 LevelSelectUI 布局 (ASCII 设计稿)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          TOWER DEFENDER                              │
│                                                                      │
│   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│   │                  │ │                  │ │                  │    │
│   │   ★ ★ ★         │ │   ★ ☆ ☆         │ │                  │    │
│   │   平 原          │ │   沙 漠          │ │   冰 原          │    │
│   │   ░░░░░░░░░░░░   │ │   ░░░░░░░░░░░░   │ │   🔒 未解锁      │    │
│   │   波数: 10       │ │   波数: 12       │ │                  │    │
│   │   最佳: 10/10    │ │   最佳: 7/12     │ │   需要 3 星平原  │    │
│   │                  │ │                  │ │                  │    │
│   │ [ 开始游戏 ]     │ │ [ 开始游戏 ]     │ │ [ 开始游戏 ]     │    │
│   │                  │ │                  │ │                  │    │
│   └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│                                                                      │
│   ┌──────────────────┐ ┌──────────────────┐                          │
│   │                  │ │                  │                          │
│   │                  │ │                  │        ┌──────────────┐ │
│   │   火 山          │ │   城 堡          │        │              │ │
│   │   🔒 未解锁      │ │   🔒 未解锁      │        │  ♾ 无尽模式  │ │
│   │                  │ │                  │        │              │ │
│   │   需要 3 星冰原  │ │   需要 3 星火山  │        │  最高分: 42  │ │
│   │                  │ │                  │        │  [ 开始 ]    │ │
│   └──────────────────┘ └──────────────────┘        └──────────────┘ │
│                                                                      │
│                                          [ ← 返回 ]  [ 重置进度 ]   │
└──────────────────────────────────────────────────────────────────────┘
```

分辨率: 1920×1080。卡片矩阵: 3×2 排列，每个卡片 320×260 px。

### 3.2 LevelCard 数据结构

```ts
// src/types/index.ts — 追加

export interface LevelProgress {
  unlocked: boolean;
  completed: boolean;
  stars: number;         // 0-3
  bestWave: number;      // best wave reached
  bestScore: number;
}

export interface GameSaveData {
  version: number;
  levelProgress: Record<string, LevelProgress>;
  endlessHighScore: number;
  lastPlayedLevel: string | null;
  totalPlayTime: number;  // seconds
}
```

### 3.3 LevelSelectUI 实现

```ts
// src/ui/LevelSelectUI.ts (新建)

import { Renderer } from '../render/Renderer.js';
import { LEVEL_CONFIGS, LEVEL_ORDER } from '../data/levels/index.js';
import type { LevelConfig, GameSaveData, LevelProgress } from '../types/index.js';
import { LevelTheme } from '../types/index.js';
import { THEME_COLORS } from '../data/levelThemes.js';
import { SaveManager } from '../systems/SaveManager.js';

interface CardRect {
  x: number; y: number; w: number; h: number;
  levelId: string;
}

export class LevelSelectUI {
  private cards: CardRect[] = [];
  private endlessCard: CardRect;
  private saveData: GameSaveData;

  // Layout constants (1920×1080 design resolution)
  private readonly CARD_W = 320;
  private readonly CARD_H = 260;
  private readonly CARD_GAP = 40;
  private readonly GRID_COLS = 3;
  private readonly START_X = 220;
  private readonly START_Y = 260;

  constructor(private renderer: Renderer, private onStartLevel: (levelId: string) => void, private onStartEndless: () => void) {
    this.saveData = SaveManager.load();
    this.layoutCards();
  }

  private layoutCards(): void {
    this.cards = [];
    for (let i = 0; i < LEVEL_ORDER.length; i++) {
      const col = i % this.GRID_COLS;
      const row = Math.floor(i / this.GRID_COLS);
      this.cards.push({
        x: this.START_X + col * (this.CARD_W + this.CARD_GAP),
        y: this.START_Y + row * (this.CARD_H + this.CARD_GAP),
        w: this.CARD_W,
        h: this.CARD_H,
        levelId: LEVEL_ORDER[i]!,
      });
    }
    // Endless mode card — bottom-right of grid
    this.endlessCard = {
      x: this.START_X + 2 * (this.CARD_W + this.CARD_GAP),
      y: this.START_Y + 1 * (this.CARD_H + this.CARD_GAP),
      w: this.CARD_W,
      h: this.CARD_H,
      levelId: '__endless__',
    };
  }

  draw(): void {
    this.drawBackground();
    this.drawTitle();
    for (const card of this.cards) {
      this.drawLevelCard(card);
    }
    this.drawEndlessCard();
    this.drawFooter();
  }

  private drawLevelCard(card: CardRect): void {
    const cfg = LEVEL_CONFIGS[card.levelId];
    const progress = this.saveData.levelProgress[card.levelId];
    const unlocked = progress?.unlocked ?? (card.levelId === 'L1_plains');
    const stars = progress?.stars ?? 0;

    // Card background
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + card.h / 2,
      size: Math.max(card.w, card.h), color: unlocked ? '#263238' : '#141a1e',
      alpha: 0.85, h: card.h,
    });

    if (!unlocked) {
      // Locked state
      this.renderer.push({
        shape: 'rect', x: card.x + card.w / 2, y: card.y + 60,
        size: 48, color: '#757575', label: '🔒', labelSize: 28, labelColor: '#fff',
      });
      this.renderer.push({
        shape: 'rect', x: card.x + card.w / 2, y: card.y + 140,
        size: card.w - 40, color: '#9e9e9e', label: cfg.name, labelSize: 16, labelColor: '#ccc', h: 30,
      });
      this.renderer.push({
        shape: 'rect', x: card.x + card.w / 2, y: card.y + 200,
        size: card.w - 40, color: '#616161', label: `需通过前置关卡`, labelSize: 11, labelColor: '#999', h: 24,
      });
      return;
    }

    // Theme preview — colored bar at top
    const themeColors = THEME_COLORS[cfg.theme];
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + 10,
      size: card.w - 4, color: themeColors[TileType.Empty], h: 16, alpha: 1,
    });

    // Level name
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + 52,
      size: card.w - 40, color: 'transparent', label: cfg.name, labelSize: 22, labelColor: '#fff', h: 30,
    });

    // Theme name
    const themeNames: Record<LevelTheme, string> = {
      [LevelTheme.Plains]: '草原', [LevelTheme.Desert]: '沙漠',
      [LevelTheme.Tundra]: '冰原', [LevelTheme.Volcano]: '火山',
      [LevelTheme.Castle]: '城堡',
    };
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + 80,
      size: card.w - 40, color: 'transparent', label: `主题: ${themeNames[cfg.theme]}`, labelSize: 11, labelColor: '#8899aa', h: 20,
    });

    // Stars
    this.drawStars(card.x + card.w / 2 - 48, card.y + 110, stars);

    // Stats
    const wavesText = progress?.completed
      ? `完成! 波数: ${cfg.waves.length}`
      : `最佳: ${progress?.bestWave ?? 0}/${cfg.waves.length}`;
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + 145,
      size: card.w - 40, color: 'transparent', label: wavesText, labelSize: 11, labelColor: '#aab', h: 20,
    });

    // Available towers
    const towerNames = cfg.availableTowers
      .map(t => TOWER_CONFIGS[t].name)
      .join(' ');
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + 170,
      size: card.w - 40, color: 'transparent', label: `塔: ${towerNames}`, labelSize: 9, labelColor: '#778', h: 18,
    });

    // Play button
    this.renderer.push({
      shape: 'rect', x: card.x + card.w / 2, y: card.y + 215,
      size: 140, color: '#2e7d32', label: '开始游戏', labelSize: 14, labelColor: '#fff', h: 36,
    });
  }

  private drawStars(cx: number, y: number, stars: number): void {
    for (let i = 0; i < 3; i++) {
      const color = i < stars ? '#ffd54f' : '#424242';
      this.renderer.push({
        shape: 'diamond', x: cx + i * 40, y,
        size: 24, color, alpha: 1,
      });
    }
  }

  private drawEndlessCard(): void {
    const c = this.endlessCard;
    this.renderer.push({
      shape: 'rect', x: c.x + c.w / 2, y: c.y + c.h / 2,
      size: Math.max(c.w, c.h), color: '#1a1030', alpha: 0.9, h: c.h,
    });
    this.renderer.push({
      shape: 'rect', x: c.x + c.w / 2, y: c.y + 50,
      size: 48, color: '#7e57c2', label: '♾', labelSize: 30, labelColor: '#fff',
    });
    this.renderer.push({
      shape: 'rect', x: c.x + c.w / 2, y: c.y + 100,
      size: c.w - 40, color: 'transparent', label: '无尽模式', labelSize: 20, labelColor: '#fff', h: 28,
    });
    this.renderer.push({
      shape: 'rect', x: c.x + c.w / 2, y: c.y + 140,
      size: c.w - 40, color: 'transparent', label: `最高分: ${this.saveData.endlessHighScore}`, labelSize: 12, labelColor: '#aab', h: 20,
    });
    // Play button
    this.renderer.push({
      shape: 'rect', x: c.x + c.w / 2, y: c.y + 210,
      size: 140, color: '#7e57c2', label: '开始', labelSize: 14, labelColor: '#fff', h: 36,
    });
  }

  private drawTitle(): void {
    this.renderer.push({
      shape: 'rect', x: 960, y: 80,
      size: 400, color: 'transparent', label: 'TOWER DEFENDER', labelSize: 36, labelColor: '#ffd54f', h: 50,
    });
    this.renderer.push({
      shape: 'rect', x: 960, y: 120,
      size: 280, color: 'transparent', label: '选择关卡', labelSize: 18, labelColor: '#aaa', h: 30,
    });
  }

  private drawBackground(): void {
    // Dark background
    this.renderer.push({
      shape: 'rect', x: 960, y: 540,
      size: 1920, color: '#0d1317', h: 1080, alpha: 1,
    });
  }

  private drawFooter(): void {
    this.renderer.push({
      shape: 'rect', x: 150, y: 1020,
      size: 120, color: '#37474f', label: '← 返回', labelSize: 12, labelColor: '#aaa', h: 30,
    });
    this.renderer.push({
      shape: 'rect', x: 1770, y: 1020,
      size: 140, color: '#b71c1c', label: '重置进度', labelSize: 12, labelColor: '#e0e0e0', h: 30,
    });
  }

  /** Check which card was clicked. Returns level id or null. */
  hitTest(x: number, y: number): string | null {
    for (const card of this.cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        const progress = this.saveData.levelProgress[card.levelId];
        const unlocked = progress?.unlocked ?? (card.levelId === 'L1_plains');
        return unlocked ? card.levelId : null;
      }
    }
    // Endless card
    const ec = this.endlessCard;
    if (x >= ec.x && x <= ec.x + ec.w && y >= ec.y && y <= ec.y + ec.h) {
      return '__endless__';
    }
    return null;
  }

  hitTestReset(x: number, y: number): boolean {
    return x >= 1770 && x <= 1910 && y >= 1010 && y <= 1040;
  }

  hitTestBack(x: number, y: number): boolean {
    return x >= 100 && x <= 270 && y >= 1010 && y <= 1040;
  }
}
```

### 3.4 Canvas 按钮 hit-test 模式

由于当前 UI 全部走 Canvas（无 DOM），关卡选择按钮通过 `LevelSelectUI.hitTest(x, y)` 判断点击落点。模式与现有 `UISystem` / `BuildSystem` 一致。

---

## 4. 无尽模式

### 4.1 概览

- 从已解锁的 5 张地图中随机选一张作为无尽模式地图
- 无限波次递增，无波次上限
- 每 5 波出现 Boss (BossCommander / BossBeast 随机)
- 超过 20 波后，每波都是 Boss 波 + 大量敌人
- 得分 = 波次 × 100 + 击杀数 × 10
- 最高分存入存档

### 4.2 EndlessWaveGenerator

```ts
// src/systems/EndlessWaveGenerator.ts (新建)

import { EnemyType, type WaveConfig, type WaveEnemyGroup } from '../types/index.js';

export class EndlessWaveGenerator {
  private rng: () => number; // seedable RNG

  constructor(seed?: number) {
    // Simple LCG for deterministic/reproducible waves if seeded
    let s = seed ?? Date.now();
    this.rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  generateWave(waveNumber: number): WaveConfig {
    const enemies: WaveEnemyGroup[] = [];
    const isBossWave = waveNumber % 5 === 0;
    const enemyBudget = waveNumber * 100; // abstract difficulty budget
    const hpScale = 1 + (waveNumber - 1) * 0.15;      // +15% HP per wave
    const speedScale = Math.min(1 + (waveNumber - 1) * 0.03, 2.0); // +3% speed, cap 200%
    const goldRewardScale = 1 + (waveNumber - 1) * 0.05; // +5% gold per wave

    // Available enemy types unlock progressively
    const availableTypes = this.getAvailableTypes(waveNumber);

    // Boss wave
    if (isBossWave) {
      const bossType = this.rng() < 0.5 ? EnemyType.BossCommander : EnemyType.BossBeast;
      enemies.push({ enemyType: bossType, count: 1, spawnInterval: 0 });
    }

    // Distribute remaining budget among enemy types
    let remainingBudget = enemyBudget;
    const groups: { type: EnemyType; weight: number }[] = [];

    // Weight distribution changes with wave number
    if (waveNumber <= 5) {
      groups.push(
        { type: EnemyType.Grunt, weight: 60 },
        { type: EnemyType.Runner, weight: 30 },
        { type: EnemyType.Exploder, weight: 10 },
      );
    } else if (waveNumber <= 10) {
      groups.push(
        { type: EnemyType.Grunt, weight: 30 },
        { type: EnemyType.Runner, weight: 25 },
        { type: EnemyType.Heavy, weight: 15 },
        { type: EnemyType.Mage, weight: 15 },
        { type: EnemyType.Exploder, weight: 15 },
      );
    } else if (waveNumber <= 20) {
      groups.push(
        { type: EnemyType.Grunt, weight: 15 },
        { type: EnemyType.Runner, weight: 20 },
        { type: EnemyType.Heavy, weight: 25 },
        { type: EnemyType.Mage, weight: 25 },
        { type: EnemyType.Exploder, weight: 15 },
      );
    } else {
      // Post-wave-20: heavy enemy bias
      groups.push(
        { type: EnemyType.Grunt, weight: 5 },
        { type: EnemyType.Runner, weight: 10 },
        { type: EnemyType.Heavy, weight: 35 },
        { type: EnemyType.Mage, weight: 35 },
        { type: EnemyType.Exploder, weight: 15 },
      );
    }

    // Total weight
    const totalWeight = groups.reduce((s, g) => s + g.weight, 0);

    for (const g of groups) {
      if (remainingBudget <= 0) break;
      const count = Math.max(1, Math.floor((g.weight / totalWeight) * remainingBudget / this.getCost(g.type)));
      enemies.push({
        enemyType: g.type,
        count: Math.min(count, 40), // cap per group
        spawnInterval: Math.max(0.3, 2.0 - waveNumber * 0.02), // faster spawns over time
      });
      remainingBudget -= count * this.getCost(g.type);
    }

    // Spawn delay shortens with wave number
    const spawnDelay = Math.max(0.5, 3.0 - waveNumber * 0.1);

    return {
      waveNumber,
      enemies,
      spawnDelay,
      isBossWave,
      specialRules: this.getSpecialRules(waveNumber),
    };
  }

  private getCost(type: EnemyType): number {
    const costs: Record<EnemyType, number> = {
      [EnemyType.Grunt]: 10,
      [EnemyType.Runner]: 12,
      [EnemyType.Heavy]: 25,
      [EnemyType.Mage]: 22,
      [EnemyType.Exploder]: 18,
      [EnemyType.BossCommander]: 80,
      [EnemyType.BossBeast]: 100,
    };
    return costs[type] ?? 10;
  }

  private getAvailableTypes(waveNumber: number): EnemyType[] {
    const types: EnemyType[] = [EnemyType.Grunt];
    if (waveNumber >= 2) types.push(EnemyType.Runner);
    if (waveNumber >= 4) types.push(EnemyType.Exploder);
    if (waveNumber >= 6) types.push(EnemyType.Heavy);
    if (waveNumber >= 8) types.push(EnemyType.Mage);
    return types;
  }

  private getSpecialRules(waveNumber: number): WaveSpecialRule[] | undefined {
    if (waveNumber === 10) return [WaveSpecialRule.Rush];
    if (waveNumber === 15) return [WaveSpecialRule.Fortified, WaveSpecialRule.NoBuild];
    if (waveNumber === 20) return [WaveSpecialRule.DoubleSpeed, WaveSpecialRule.Fortified];
    if (waveNumber > 20 && waveNumber % 3 === 0) {
      // Every 3 waves post-20: random special rule
      const rules = [WaveSpecialRule.Rush, WaveSpecialRule.Fortified, WaveSpecialRule.DoubleSpeed];
      return [rules[Math.floor(this.rng() * rules.length)]!];
    }
    return undefined;
  }
}
```

### 4.3 无尽模式 WaveSystem 适配

WaveSystem 当前接收静态 `WaveConfig[]`。无尽模式需动态扩展:

```ts
// WaveSystem 新增方法
export class WaveSystem {
  // ...existing...

  /** Enable endless mode — waves generated procedurally */
  setEndlessMode(generator: EndlessWaveGenerator): void {
    this.endlessGenerator = generator;
    this.isEndless = true;
    this.waves = []; // clear static waves
  }

  startWave(): void {
    if (this.isEndless && this.endlessGenerator) {
      // Generate next wave on-the-fly
      const wave = this.endlessGenerator.generateWave(this.currentWaveIndex + 1);
      this.spawnQueue = wave.enemies.map(g => ({...g}));
      this.spawnTimer = wave.spawnDelay;
      // ...
    } else {
      // Original static wave logic
      // ...
    }
  }
}
```

### 4.4 无尽模式评分

```ts
// EconomySystem / Score tracking

private endlessScore: number = 0;
private endlessKills: number = 0;

addKill(): void {
  // ...existing kill count...
  if (this.isEndless) {
    this.endlessKills++;
    this.endlessScore = this.currentWave * 100 + this.endlessKills * 10;
  }
}

getEndlessScore(): number {
  return this.endlessScore;
}
```

---

## 5. 存档系统

### 5.1 SaveManager

```ts
// src/systems/SaveManager.ts (新建)

import type { GameSaveData, LevelProgress } from '../types/index.js';

const STORAGE_KEY = 'tower_defender_save_v1';

export class SaveManager {
  static getDefaultSave(): GameSaveData {
    return {
      version: 1,
      levelProgress: {
        L1_plains: { unlocked: true, completed: false, stars: 0, bestWave: 0, bestScore: 0 },
        L2_desert: { unlocked: false, completed: false, stars: 0, bestWave: 0, bestScore: 0 },
        L3_tundra: { unlocked: false, completed: false, stars: 0, bestWave: 0, bestScore: 0 },
        L4_volcano: { unlocked: false, completed: false, stars: 0, bestWave: 0, bestScore: 0 },
        L5_castle: { unlocked: false, completed: false, stars: 0, bestWave: 0, bestScore: 0 },
      },
      endlessHighScore: 0,
      lastPlayedLevel: null,
      totalPlayTime: 0,
    };
  }

  static load(): GameSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return SaveManager.getDefaultSave();
      const data = JSON.parse(raw) as GameSaveData;

      // Version migration
      if (data.version !== 1) {
        return SaveManager.getDefaultSave();
      }

      // Merge with defaults (handles missing keys from older saves)
      const defaults = SaveManager.getDefaultSave();
      for (const key of Object.keys(defaults.levelProgress)) {
        if (!data.levelProgress[key]) {
          data.levelProgress[key] = defaults.levelProgress[key]!;
        }
      }

      return data;
    } catch {
      return SaveManager.getDefaultSave();
    }
  }

  static save(data: GameSaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — silently fail
      console.warn('[SaveManager] Failed to write save data');
    }
  }

  /** Update level completion and cascade unlock next level */
  static completeLevel(levelId: string, stars: number, wave: number, score: number): GameSaveData {
    const data = SaveManager.load();

    const prog = data.levelProgress[levelId];
    if (prog) {
      prog.completed = true;
      prog.stars = Math.max(prog.stars, stars);
      prog.bestWave = Math.max(prog.bestWave, wave);
      prog.bestScore = Math.max(prog.bestScore, score);
    }

    // Cascade unlock
    const order = ['L1_plains', 'L2_desert', 'L3_tundra', 'L4_volcano', 'L5_castle'];
    const currentIndex = order.indexOf(levelId);
    const nextId = order[currentIndex + 1];
    if (nextId && data.levelProgress[nextId]) {
      data.levelProgress[nextId]!.unlocked = true;
    }

    data.lastPlayedLevel = levelId;
    SaveManager.save(data);
    return data;
  }

  static updateEndlessHighScore(score: number): GameSaveData {
    const data = SaveManager.load();
    if (score > data.endlessHighScore) {
      data.endlessHighScore = score;
    }
    SaveManager.save(data);
    return data;
  }

  static resetAll(): void {
    const data = SaveManager.getDefaultSave();
    SaveManager.save(data);
  }
}
```

### 5.2 星级评定逻辑

```ts
// 每关结算时计算星级
function calculateStars(levelId: string, livesRemaining: number, timeSpent: number, timeLimit: number): number {
  let stars = 1; // base — survived
  if (timeSpent <= timeLimit) stars++;  // ★★ — 限时
  if (livesRemaining >= 100) stars++;   // ★★★ — 无损伤 (base HP=100)
  return stars;
}
```

### 5.3 自动存档时机

| 时机 | 操作 |
|------|------|
| 关卡胜利 | `SaveManager.completeLevel(...)` |
| 关卡失败 | 更新 bestWave (不全覆盖已有 stars) |
| 无尽模式结束 | `SaveManager.updateEndlessHighScore(...)` |
| 每 60 秒 | 保存 playTime 增量 |

---

## 6. 数值平衡

### 6.1 敌人波次缩放公式

```ts
// src/data/balance.ts (新建)

/** Per-wave enemy scaling multipliers */
export function getWaveScaling(waveNumber: number) {
  const hpScale = 1 + (waveNumber - 1) * 0.15;            // +15%/wave
  const speedScale = Math.min(1 + (waveNumber - 1) * 0.03, 2.0); // +3%/wave, capped
  const goldScale = 1 + (waveNumber - 1) * 0.05;           // +5%/wave
  const armorBonus = Math.floor((waveNumber - 1) * 1.5);   // +1.5 armor/wave
  const mresBonus = Math.floor((waveNumber - 1) * 1.0);    // +1.0 mres/wave
  const spawnInterval = Math.max(0.25, 1.2 - waveNumber * 0.03); // min 0.25s

  return { hpScale, speedScale, goldScale, armorBonus, mresBonus, spawnInterval };
}
```

### 6.2 EnemyConfig 缩放应用

```ts
// WaveSystem.spawnEnemy() 中应用缩放

private applyWaveScaling(cfg: EnemyConfig, waveNumber: number): EnemyConfig {
  const s = getWaveScaling(waveNumber);
  return {
    ...cfg,
    hp: Math.round(cfg.hp * s.hpScale),
    speed: Math.round(cfg.speed * s.speedScale),
    rewardGold: Math.round(cfg.rewardGold * s.goldScale),
    magicResist: (cfg.magicResist ?? 0) + s.mresBonus,
    // armor not scaled via cfg — use defense field proxied through armor
  };
}
```

### 6.3 缩放乘数速查表

| 波次 | HP 倍率 | 速度倍率 | 金币倍率 | 护甲加值 | 魔抗加值 |
|------|---------|---------|---------|---------|---------|
| 1 | 1.00x | 1.00x | 1.00x | +0 | +0 |
| 5 | 1.60x | 1.12x | 1.20x | +6 | +4 |
| 10 | 2.35x | 1.27x | 1.45x | +13 | +9 |
| 15 | 3.10x | 1.42x | 1.70x | +21 | +14 |
| 20 | 3.85x | 1.57x | 1.95x | +28 | +19 |
| 25 | 4.60x | 1.72x | 2.20x | +36 | +24 |
| 30 | 5.35x | 1.87x | 2.45x | +43 | +29 |
| 50 | 8.35x | 2.00x | 3.45x | +73 | +49 |

### 6.4 起始资源

| 关卡 | 金币 | 能量 | 生命 | 人口上限 |
|------|------|------|------|----------|
| Level 1 | 200 | 50 | 100 | 6 |
| Level 2 | 250 | 60 | 100 | 6 |
| Level 3 | 300 | 70 | 100 | 6 |
| Level 4 | 350 | 80 | 100 | 8 |
| Level 5 | 400 | 100 | 150 | 8 |
| 无尽 | 300 | 100 | 100 | 8 |

### 6.5 塔造价 (固定)

- Arrow: 50 G
- Cannon: 80 G
- Ice: 65 G
- Lightning: 70 G
- 金矿: 100 G
- 能量塔: 75 G
- 单位: 50-60 G
- 塔修复: 原价 50%

### 6.6 平衡校验规则

1. **前期可过**: 任意关卡前 3 波只用 Grunt + 默认金币可过 (测试基准)
2. **Boss 压力**: Boss 波必须有前两波的经济积累才能通过
3. **塔多样性**: 每个关卡同种塔建造 ≥ 4 时，应有对应克制敌人 (如 Heavy 克制物理塔)
4. **通货平衡**: 过关后的剩余金币应当能支撑下一关早期建造 (约等于起始金币的 30-50%)

---

## 7. 中立单位

### 7.1 组件定义

```ts
// src/components/Neutral.ts (新建)

import { CType, NeutralType } from '../types/index.js';

export class Neutral {
  readonly type = CType.Neutral;
  neutralType: NeutralType;

  constructor(neutralType: NeutralType) {
    this.neutralType = neutralType;
  }
}

// src/components/Trap.ts (新建)

export class Trap {
  readonly type = CType.Trap;
  damage: number;
  radius: number;        // trigger radius (px)
  triggerCooldown: number; // seconds between activations
  private cooldownRemaining: number;

  constructor(damage: number, radius: number, cooldown: number) {
    this.damage = damage;
    this.radius = radius;
    this.triggerCooldown = cooldown;
    this.cooldownRemaining = 0;
  }

  get ready(): boolean { return this.cooldownRemaining <= 0; }
  resetCooldown(): void { this.cooldownRemaining = this.triggerCooldown; }
  tick(dt: number): void { if (this.cooldownRemaining > 0) this.cooldownRemaining -= dt; }
}

// src/components/HealingSpring.ts (新建)

export class HealingSpring {
  readonly type = CType.HealingSpring;
  healPerSec: number;    // HP healed per second
  radius: number;        // effect radius (px)

  constructor(healPerSec: number, radius: number) {
    this.healPerSec = healPerSec;
    this.radius = radius;
  }
}

// src/components/GoldChest.ts (新建)

export class GoldChest {
  readonly type = CType.GoldChest;
  goldAmount: number;
  hp: number;

  constructor(goldAmount: number, hp: number) {
    this.goldAmount = goldAmount;
    this.hp = hp;
  }
}
```

### 7.2 类型详细设计

#### 7.2.1 Spike Trap (尖刺陷阱)

| 属性 | 值 |
|------|-----|
| 类型枚举 | `NeutralType.SpikeTrap` |
| 名称 | 尖刺陷阱 |
| 造价 | 40 G (玩家可购买放置) |
| 伤害 | 30 (物理) |
| 触发半径 | 32 px |
| CD | 2.0 秒 |
| 渲染 | 红色菱形, label "陷阱" |
| 行为 | 敌人踏入触发半径 → 受到 30 伤害 → 进入 2s CD |
| 限制 | 仅限空 tile，每关最多 5 个 |

**TrapSystem** (新系统):

```
名称:       TrapSystem
依赖组件:   [Trap, Position]
查询目标:   [Enemy, Position, Health]

更新逻辑:
  for each trap:
    1. tick cooldown
    2. if cooldownReady:
       find enemies within radius
       if any:
         deal damage to first enemy
         reset cooldown
```

```ts
// src/systems/TrapSystem.ts (新建)

export class TrapSystem implements System {
  readonly name = 'TrapSystem';
  readonly requiredComponents = [CType.Trap, CType.Position] as const;

  constructor(private world: World) {}

  update(trapEntities: number[], dt: number): void {
    const enemies = this.world.query(CType.Enemy, CType.Position, CType.Health);

    for (const trapId of trapEntities) {
      const trap = this.world.getComponent<Trap>(trapId, CType.Trap)!;
      const trapPos = this.world.getComponent<Position>(trapId, CType.Position)!;

      trap.tick(dt);
      if (!trap.ready) continue;

      for (const enemyId of enemies) {
        const enemyPos = this.world.getComponent<Position>(enemyId, CType.Position)!;
        const dx = enemyPos.x - trapPos.x;
        const dy = enemyPos.y - trapPos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= trap.radius) {
          const health = this.world.getComponent<Health>(enemyId, CType.Health)!;
          health.current -= trap.damage;
          trap.resetCooldown();
          // Visual: brief red flash on trap
          break;
        }
      }
    }
  }
}
```

#### 7.2.2 Healing Spring (治疗泉水)

| 属性 | 值 |
|------|-----|
| 类型枚举 | `NeutralType.HealingSpring` |
| 名称 | 治疗泉水 |
| 造价 | 不可购买，仅地图预放置 |
| 治疗量 | 5 HP/sec |
| 影响半径 | 120 px |
| 渲染 | 青色六边形, label "泉水" |
| 行为 | 范围内所有玩家建筑/单位每秒恢复 5 HP |

**HealingSpringSystem** (新系统):

```
名称:       HealingSpringSystem
依赖组件:   [HealingSpring, Position]
查询目标:   [PlayerOwned, Health, Position]

更新逻辑:
  for each spring:
    find PlayerOwned entities within radius
    heal each by healPerSec * dt
```

#### 7.2.3 Gold Chest (金币宝箱)

| 属性 | 值 |
|------|-----|
| 类型枚举 | `NeutralType.GoldChest` |
| 名称 | 金币宝箱 |
| 造价 | 不可购买，地图预放置或随机刷新 |
| 金币 | 50-100 G (随机) |
| HP | 30 |
| 渲染 | 金色矩形, label "宝箱" |
| 行为 | 可被玩家单位/塔攻击，破坏后奖励金币 |

**GoldChest 破坏逻辑** — 在 `HealthSystem` 中扩展:

```ts
// HealthSystem.onDeathCheck 中
const goldChest = this.world.getComponent<GoldChest>(entityId, CType.GoldChest);
if (goldChest) {
  // Chest destroyed — grant gold
  this.economy.gold += goldChest.goldAmount;
  // Visual: gold particles (Phase 4)
}
```

### 7.3 Level Config 中的中立单位放置

```ts
// LevelConfig / MapConfig 扩展

export interface NeutralPlacement {
  type: NeutralType;
  row: number;
  col: number;
}

export interface MapConfig {
  // ... existing ...
  /** Neutral units pre-placed on the map */
  neutralUnits?: NeutralPlacement[];
}
```

示例 — Level 3 冰原放置 2 个治疗泉水:

```ts
// src/data/levels/l3_tundra.ts

neutralUnits: [
  { type: NeutralType.HealingSpring, row: 3, col: 12 },
  { type: NeutralType.HealingSpring, row: 12, col: 6 },
],
```

### 7.4 中立单位渲染

`RenderSystem.drawEntities()` 中检测 `Neutral` 组件:

```ts
// RenderSystem — 追加
const neutral = this.world.getComponent<Neutral>(id, CType.Neutral);
if (neutral) {
  switch (neutral.neutralType) {
    case NeutralType.SpikeTrap:
      render.shape = 'diamond';
      render.color = '#e53935';
      render.label = '陷阱';
      break;
    case NeutralType.HealingSpring:
      render.shape = 'hexagon';
      render.color = '#4dd0e1';
      render.label = '泉水';
      break;
    case NeutralType.GoldChest:
      render.shape = 'rect';
      render.color = '#ffd54f';
      render.label = '宝箱';
      break;
  }
}
```

---

## 8. 实现计划

### 执行顺序

| 步骤 | 内容 | 产物 | 依赖 |
|------|------|------|------|
| **3.1** | Level Config 数据 (5 关) | 5 个 level 数据文件 + 主题色表 | 无 |
| **3.2** | 关卡选择 UI | `LevelSelectUI.ts` + `GameScreen` 枚举 + `main.ts` 改造 | 3.1 |
| **3.3** | 存档系统 | `SaveManager.ts` + `GameSaveData` 类型 | 3.1 |
| **3.4** | 无尽模式 | `EndlessWaveGenerator.ts` + WaveSystem 扩展 | 3.1 |
| **3.5** | 数值平衡 | `balance.ts` 缩放公式 + WaveSystem 中应用 | 3.4 |
| **3.6** | 中立单位 | 3 个组件 + 2 个系统 + HealthSystem 扩展 | 3.1 |

### 3.1 — Level Config 数据 (Day 1-2)

**文件创建**:
```
src/data/levels/
  l1_plains.ts       MapConfig (30×17 tiles) + 10 波 WaveConfig[]
  l2_desert.ts       MapConfig + 12 波
  l3_tundra.ts       MapConfig (双 spawn) + 15 波
  l4_volcano.ts      MapConfig (岩浆 Blocked) + 15 波
  l5_castle.ts       MapConfig (迷宫) + 15 波
  index.ts           LEVEL_CONFIGS registry
src/data/levelThemes.ts   THEME_COLORS
```

**每关文件结构示例**:

```ts
// src/data/levels/l1_plains.ts
import { LevelTheme, TowerType, UnitType, TileType, type LevelConfig } from '../../types/index.js';

const map = {
  name: '平原',
  cols: 30, rows: 17, tileSize: 64,
  tiles: buildTiles(),       // → TileType[][]
  enemyPath: buildPath(),    // → GridPos[]
};

export const L1: LevelConfig = {
  id: 'L1_plains',
  name: '平原',
  theme: LevelTheme.Plains,
  description: '简单的草原地形，适合熟悉基础操作',
  map,
  waves: L1_WAVES,           // 同文件内定义
  startingGold: 200,
  availableTowers: [TowerType.Arrow, TowerType.Cannon],
  availableUnits: [UnitType.ShieldGuard],
  unlockStarsRequired: 0,
  unlockPrevLevelId: null,
};
```

### 3.2 — 关卡选择 UI (Day 2-3)

1. `src/types/index.ts`: 追加 `GameScreen`, `LevelProgress`, `GameSaveData`
2. `src/ui/LevelSelectUI.ts`: 新建 — 渲染卡片网格 + hit-test
3. `src/main.ts` 改造:
   - 新增 `currentScreen: GameScreen` 字段
   - `init()` 拆分为 `startLevel(levelId)` 和 `startEndless()`
   - `onPointerDown` 根据 screen 路由

```ts
// main.ts 路由逻辑骨架

private onPointerDown(e: InputEvent): void {
  switch (this.currentScreen) {
    case GameScreen.LevelSelect:
      this.handleLevelSelectClick(e.x, e.y);
      break;
    case GameScreen.Playing:
    case GameScreen.EndlessPlaying:
      // existing build/unit/tower logic
      break;
  }
}

private handleLevelSelectClick(x: number, y: number): void {
  const levelId = this.levelSelectUI.hitTest(x, y);
  if (levelId === '__endless__') {
    this.startEndless();
  } else if (levelId) {
    this.startLevel(levelId);
  }
  if (this.levelSelectUI.hitTestReset(x, y)) {
    SaveManager.resetAll();
    this.levelSelectUI.refresh();
  }
}
```

**Canvas 渲染角色**:
- `LevelSelectUI.draw()` 直接调用 `this.renderer.push(...)` (不占用实体/系统)
- 在 `main.ts` 的 render 循环中: `if (screen === LevelSelect) levelSelectUI.draw()` → `renderer.endFrame()`

### 3.3 — 存档系统 (Day 2)

1. `src/systems/SaveManager.ts`: 实现 `load()/save()/completeLevel()/resetAll()`
2. `main.ts` 中: 胜利/失败回调调用 `SaveManager`
3. 星级计算在 `HealthSystem` 或独立的结算逻辑中

### 3.4 — 无尽模式 (Day 3-4)

1. `src/systems/EndlessWaveGenerator.ts`: 实现波次生成
2. `WaveSystem` 扩展: `setEndlessMode()` + `startWave()` 中的动态生成分支
3. `main.ts`: `startEndless()` 随机选地图 → 创建 `EndlessWaveGenerator` → 注入 WaveSystem
4. 得分追踪: `EconomySystem` (或独立的 `ScoreTracker`)

### 3.5 — 数值平衡 (Day 3-4)

1. `src/data/balance.ts`: 实现 `getWaveScaling()` 公式
2. `WaveSystem.applyWaveScaling()`: spawnEnemy 中应用缩放
3. 测试: 验证前 3 波可过 + Boss 波有挑战

### 3.6 — 中立单位 (Day 4-5)

1. 新建组件:
   - `src/components/Neutral.ts`
   - `src/components/Trap.ts`
   - `src/components/HealingSpring.ts`
   - `src/components/GoldChest.ts`
2. 新建系统:
   - `src/systems/TrapSystem.ts`
   - `src/systems/HealingSpringSystem.ts`
3. 修改现有系统:
   - `RenderSystem`: 中立单位渲染
   - `HealthSystem`: GoldChest 死亡金币
   - `BuildSystem`: 支持购买陷阱 (新增按钮)
4. 地图配置: 在 Level 数据文件中预放置中立单位

---

## 9. 附录: 文件清单

### 新建文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/data/levels/l1_plains.ts` | 数据 | Level 1 平原配置 |
| `src/data/levels/l2_desert.ts` | 数据 | Level 2 沙漠配置 |
| `src/data/levels/l3_tundra.ts` | 数据 | Level 3 冰原配置 |
| `src/data/levels/l4_volcano.ts` | 数据 | Level 4 火山配置 |
| `src/data/levels/l5_castle.ts` | 数据 | Level 5 城堡配置 |
| `src/data/levels/index.ts` | 数据 | 关卡注册表 |
| `src/data/levelThemes.ts` | 数据 | 主题配色 |
| `src/data/balance.ts` | 数据 | 数值缩放公式 |
| `src/systems/SaveManager.ts` | 工具 | 存档管理 |
| `src/systems/EndlessWaveGenerator.ts` | 工具 | 无尽模式波次生成 |
| `src/systems/TrapSystem.ts` | 系统 | 陷阱触发逻辑 |
| `src/systems/HealingSpringSystem.ts` | 系统 | 泉水治疗逻辑 |
| `src/components/Neutral.ts` | 组件 | 中立实体标记 |
| `src/components/Trap.ts` | 组件 | 陷阱数据 |
| `src/components/HealingSpring.ts` | 组件 | 泉水数据 |
| `src/components/GoldChest.ts` | 组件 | 宝箱数据 |
| `src/ui/LevelSelectUI.ts` | UI | 关卡选择界面 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/types/index.ts` | 追加 `GameScreen`, `LevelTheme`, `NeutralType`, `WaveSpecialRule` 枚举; 追加 `LevelConfig`, `LevelProgress`, `GameSaveData`, `NeutralPlacement` 接口; 追加 `Neutral`, `Trap`, `HealingSpring`, `GoldChest` 到 CType; `MapConfig` 扩展 `tileColors`/`altSpawnPoints`/`neutralUnits`; `WaveConfig` 扩展 `specialRules`/`spawnPointIndex` |
| `src/main.ts` | 新增 `GameScreen` 状态机; 拆分 `init()` → `startLevel()` / `startEndless()`; 改造 `onPointerDown` 路由; 集成 SaveManager / LevelSelectUI |
| `src/systems/RenderSystem.ts` | `drawMap()` 读取 `map.tileColors` 覆盖默认颜色; `drawEntities()` 检测并渲染 Neutral / GoldChest / HealingSpring / Trap |
| `src/systems/WaveSystem.ts` | 新增 `setEndlessMode()`; `spawnEnemy()` 调用 `applyWaveScaling()`; `startWave()` 支持动态生成分支; 支持 `spawnPointIndex` 多出生点 |
| `src/systems/HealthSystem.ts` | GoldChest 破坏时奖励金币; 无尽模式得分追踪 |
| `src/systems/EconomySystem.ts` | 无尽模式 score 追踪字段; 起始资源按关卡配置动态设定 |
| `src/systems/BuildSystem.ts` | 新增陷阱购买按钮; 中立单位建造逻辑 (SpikeTrap) |

---

## 相关文档

- [01-overview.md](./01-overview.md) — 游戏模式总览
- [05-maps-levels.md](./05-maps-levels.md) — 地图与关卡系统
- [09-dev-plan.md](./09-dev-plan.md) — 开发计划总表
- [11-phase2-design.md](./11-phase2-design.md) — Phase 2 设计 (当前基线)
