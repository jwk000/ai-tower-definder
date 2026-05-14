---
title: 存档系统
status: stable
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - save-format
  - persistence-spec
supersedes: []
cross-refs:
  - 60-tech/60-architecture.md
  - 10-gameplay/10-roguelike-loop.md
---

# 存档系统

> 存档数据结构、版本兼容、损坏恢复、自动存档时机、永久卡池与火花碎片
>
> **v3.0 重写**：根据 [25-card-roguelike-refactor](../10-gameplay/10-roguelike-loop.md) 方案，删除 `LevelProgress` 三星与 `EndlessProgress`，新增 `CardCollection`（永久卡池）、`SparkShards`（meta 货币）、`OngoingRun`（关间存档点）、`PermanentUpgrades`（永久升级项）。
>
> **v3.1（2026-05-14）变更**：根据 [30-tower-tech-tree](../20-units/22-tower-tech-tree.md)，塔升级从"L1–L5 线性"改为"科技树路径互斥 + 节点线性解锁"。
> - `CardEntry` 新增 `techTree?: TechTreeProgress` 字段，塔卡持有；非塔卡不持有。
> - `CardInDeck.instanceLevel` 语义收窄：**仅本局有效，仅可由法术卡提升，塔死亡/关结束清零，不写回 `CardCollection`、不切换形态**（详见 [04 §7](../20-units/23-skill-buff.md) 和 [30 §2.3](../20-units/22-tower-tech-tree.md#23-关内临时升级instancelevel保留)）。
> - 关间节点（商店/秘境）不再提供"塔升级"，不会写 `CardCollection.techTree`。
> - 存档版本保持 `v2.0.0`（游戏未上线，无迁移需求；详见 §6）。

---

## 1. 存档数据结构

### 1.1 存档格式（v2.0.0）

```typescript
interface SaveData {
  // 元数据
  version: string;              // 存档格式版本，如 "2.0.0"
  createdAt: number;            // 首次创建时间（Unix ms）
  updatedAt: number;            // 最后更新时间（Unix ms）
  checksum: string;             // CRC32 校验和（防止存档损坏）

  // 玩家 meta 进度
  sparkShards: number;          // 当前火花碎片余额
  cardCollection: CardCollection;
  permanentUpgrades: PermanentUpgrades;

  // Run 历史统计
  runHistory: RunHistory;

  // 未完成的 Run（关间存档点）
  ongoingRun: OngoingRun | null;

  // 全局状态
  totalPlayTimeSeconds: number;
  totalKills: number;
  totalGoldEarned: number;
  achievements: AchievementProgress;

  // 设置
  settings: PlayerSettings;
}

// ============================================================
// 永久卡池（meta 解锁状态）
// ============================================================
interface CardCollection {
  unlocked: Record<string, CardEntry>;  // cardId → 解锁信息
}

interface CardEntry {
  unlockedAt: number;          // 解锁时间（Unix ms）
  techTree?: TechTreeProgress; // 仅塔卡持有，存科技树解锁进度与装备路径
  totalUsesInRuns: number;     // 该卡历史出现在 Run 中的次数
  totalDeploys: number;        // 该卡历史部署次数
}

// v3.1 新增：塔卡科技树持久化进度
// 完整路径/节点定义见 30-tower-tech-tree §4
interface TechTreeProgress {
  // 每条路径已解锁到第几个节点
  //   1 = 仅基础节点（默认拥有，免费）
  //   2 = 解锁了第 2 个节点
  //   3 = 解锁了第 3 个节点
  //   ...
  pathDepth: Record<string, number>;  // pathId → 已解锁深度
  // 当前装备的路径（影响关内出塔形态）；null = 使用塔的默认路径（通常 paths[0]）
  equippedPath: string | null;
}

// ============================================================
// 永久升级项
// ============================================================
interface PermanentUpgrades {
  baseHpMax: number;           // 水晶最大 HP 当前等级（影响 Run 起始 HP）。字段名 baseHp* 保留以兼容存档（前称"大本营"，v3.0 更名"水晶"）
  energyMax: number;           // 能量上限当前等级（默认 10，可升至 12）
  handSizeMax: number;         // 手牌上限当前等级（默认 4，可升至 8）
  unitCapOnField: number;      // 场上单位上限（默认 8）
  startingGold: number;        // Run 起始金币（默认 0，可解锁起始 50/100/150）
  // 未来扩展：抽卡概率优化等
}

// ============================================================
// Run 历史统计
// ============================================================
interface RunHistory {
  totalRuns: number;           // 总 Run 次数
  totalVictories: number;      // 终战通关次数
  highestLevelReached: number; // 最远到达关卡（1-9）
  fastestVictoryTimeSeconds: number;  // 最快通关时长
  currentStreak: number;       // 当前连胜（正）或连败（负）
  longestWinStreak: number;
  totalSparkShardsEarned: number;     // 累计获取的碎片
  archetypeWins: Record<string, number>;  // 各流派通关次数（如 "spell_burst": 5）
}

// ============================================================
// 关间存档点（未完成 Run 的快照）
// ============================================================
interface OngoingRun {
  runSeed: number;             // PRNG 种子（用于复现）
  currentLevel: number;        // 当前关卡（1-9）
  baseHp: number;              // 当前水晶 HP（字段名 baseHp 保留以兼容存档）
  gold: number;                // 当前金币
  deck: CardInDeck[];          // 当前卡组（含临时升级状态）
  startedAt: number;           // Run 开始时间
  elapsedSeconds: number;      // 已用时长
  prngStateMap: number;        // 多流 PRNG 当前状态（地图/敌人/掉落等）
  prngStateWave: number;
  prngStateShop: number;
  prngStateMystic: number;
}

interface CardInDeck {
  cardId: string;              // 卡 ID
  // v3.1: 实例当前临时升级层级（仅本局有效）。
  // 写入：关内特定卡牌效果/商店 buff/秘境奖励等。
  // 清零：塔死亡 / 关卡结束 / 退卡。
  // 不持久化：不写回 CardCollection；不切换形态（仅调数值，形态切换走科技树 equippedPath）。
  instanceLevel: number;
  isPersistentInHand?: boolean;// 是否跨波保留
  metaState?: Record<string, unknown>; // 卡片自定义状态（如冷却进度）
}

// ============================================================
// 成就
// ============================================================
interface AchievementProgress {
  unlocked: Record<string, number>;  // achievementId → 解锁时间
  progress: Record<string, number>;  // 进度类成就的当前值（如击杀 1000 敌人）
}

// ============================================================
// 玩家设置
// ============================================================
interface PlayerSettings {
  sfxVolume: number;            // 0.0-1.0
  musicVolume: number;          // 0.0-1.0
  showFPS: boolean;
  preferredLanguage: string;    // 'zh-CN' / 'en-US'
}
```

### 1.2 默认初始状态

```typescript
const DEFAULT_SAVE: SaveData = {
  version: '2.0.0',
  createdAt: now(),
  updatedAt: now(),
  checksum: '',

  sparkShards: 0,
  cardCollection: {
    unlocked: {
      // v3.1 默认状态：
      //   - 塔卡（tower_*）含 techTree，默认仅基础节点解锁（pathDepth: { [paths[0].id]: 1 }），未装备路径
      //   - 非塔卡无 techTree 字段
      'arrow_tower_basic':   { unlockedAt: now(), techTree: { pathDepth: { 'multi_shot': 1 }, equippedPath: null }, totalUsesInRuns: 0, totalDeploys: 0 },
      'cannon_tower_basic':  { unlockedAt: now(), techTree: { pathDepth: { 'control_aoe': 1 }, equippedPath: null }, totalUsesInRuns: 0, totalDeploys: 0 },
      'swordsman_basic':     { unlockedAt: now(), totalUsesInRuns: 0, totalDeploys: 0 },
      'archer_basic':        { unlockedAt: now(), totalUsesInRuns: 0, totalDeploys: 0 },
      'shield_guard_basic':  { unlockedAt: now(), totalUsesInRuns: 0, totalDeploys: 0 },
      'fireball_spell':      { unlockedAt: now(), totalUsesInRuns: 0, totalDeploys: 0 },
      'gold_mine':           { unlockedAt: now(), totalUsesInRuns: 0, totalDeploys: 0 },
      'energy_crystal':      { unlockedAt: now(), totalUsesInRuns: 0, totalDeploys: 0 },
    },
  },
  permanentUpgrades: {
    baseHpMax: 1000,
    energyMax: 10,
    handSizeMax: 4,
    unitCapOnField: 8,
    startingGold: 0,
  },
  runHistory: {
    totalRuns: 0, totalVictories: 0, highestLevelReached: 0,
    fastestVictoryTimeSeconds: 0, currentStreak: 0, longestWinStreak: 0,
    totalSparkShardsEarned: 0, archetypeWins: {},
  },
  ongoingRun: null,
  totalPlayTimeSeconds: 0,
  totalKills: 0,
  totalGoldEarned: 0,
  achievements: { unlocked: {}, progress: {} },
  settings: {
    sfxVolume: 0.8, musicVolume: 0.6, showFPS: false, preferredLanguage: 'zh-CN',
  },
};
```

---

## 2. 自动存档时机

| 时机 | 操作 |
|------|------|
| **Run 开始** | 写入 `ongoingRun`，包含初始种子 / 卡组 / 水晶 HP（字段 `baseHp`） |
| **关卡通过（进入关间节点前）** | 更新 `ongoingRun`：currentLevel + 1（指向下一关），baseHp，gold，deck，prngState |
| **关间节点决策完成** | 更新 `ongoingRun`：deck（关间商店买的卡/秘境效果），gold |
| **Run 失败** | 清空 `ongoingRun`，按到达关卡发放火花碎片，更新 `runHistory` |
| **Run 胜利** | 清空 `ongoingRun`，发放胜利碎片，更新 `runHistory`（含通关时长、流派） |
| **碎片消耗（解锁卡 / 永久升级）** | 立即保存 `cardCollection` / `permanentUpgrades` 与 `sparkShards` |
| **设置变更** | 立刻保存 `settings` |
| **每 60 秒** | 保存 `totalPlayTimeSeconds` 增量（仅 Run 中） |
| **窗口关闭/页面卸载** | `beforeunload` 事件，best-effort 保存 |

### 2.1 关内不持久化战斗状态

> **v3.0 设计取舍**：关内战斗中**不保存战场实体**（部署的塔、敌人位置等）。如果玩家在关卡中途关闭浏览器，再次打开时 `ongoingRun.currentLevel` 指向**上一关结束时的状态**，玩家需要重打当前关。
>
> 原因：关内战斗状态序列化复杂（实体、行为树、AI 状态），收益小于成本。关间存档点已足够支撑"长 Run 跨多次游戏会话"的需求。

---

## 3. 永久解锁与火花碎片

### 3.1 火花碎片获取规则

详见 [06-economy-system §4.1](../10-gameplay/11-economy.md#4-火花碎片跨局-meta-资源)。

| 触发条件 | 碎片发放 |
|---------|---------|
| Run 失败：关 1-2 | 10 |
| Run 失败：关 3-5 | 25 |
| Run 失败：关 6-8 | 60 |
| Run 失败：终战失败 | 100 |
| Run 胜利：终战通关 | 200 |
| Run 末金币结余 | 1:1 转碎片 |
| 成就解锁 | 视成就 50-500 |

### 3.2 碎片消耗规则

| 用途 | 触发位置 | 价格范围（21-MDA） |
|------|---------|------------------|
| **永久解锁新卡（Common）** | 卡池界面 | 50 / 张 |
| **永久解锁新卡（Rare）** | 卡池界面 | 150 / 张 |
| **永久解锁新卡（Epic）** | 卡池界面 | 350 / 张 |
| **永久解锁新卡（Legendary）** | 卡池界面 | 800 / 张 |
| **永久升级卡基础等级（L1→L2）** | 卡池界面 | 300 / 张 |
| **永久升级卡基础等级（L2→L3）** | 卡池界面 | 600 / 张 |
| **永久升级卡基础等级（L3→L4）** | 卡池界面 | 1200 / 张 |
| **永久升级卡基础等级（L4→L5）** | 卡池界面 | 2400 / 张 |
| **永久升级：水晶 HP +100 / 级** | 永久升级面板 | 100 → 200 → 400 → 800 / 级 |
| **永久升级：能量上限 +1 / 级** | 永久升级面板 | 500 → 1000（最多 +2，至 12 上限） |
| **永久升级：手牌上限 +1 / 级** | 永久升级面板 | 300 → 600 → 900 → 1200 / 级（默认 4，可达 8） |
| **永久升级：场上单位上限 +1 / 级** | 永久升级面板 | 200 → 400 → 600 → 800 / 级（默认 8，可达 12） |
| **永久升级：Run 起始金币 +50 / 级** | 永久升级面板 | 800 → 1600 → 3200 / 级（最多 +150） |

### 3.3 永久解锁的 5 个稀有度等级

| 稀有度 | 抽卡概率 | 解锁价格 | 升级 L2 价格 |
|--------|---------|---------|------------|
| Common | 60% | 50 | 300 |
| Rare | 25% | 150 | 600 |
| Epic | 12% | 350 | 1200 |
| Legendary | 3% | 800 | 2400 |

详见 [21-MDA §8 卡牌价格表](../50-data-numerical/50-mda.md)。

---

## 4. 关间存档点（OngoingRun）

### 4.1 设计意图

让玩家可以**中断游戏后继续**，避免"一定要打完整 30-45 分钟"的压力。

### 4.2 保存粒度

| 时机 | 是否保存到 ongoingRun |
|------|---------------------|
| 关卡通过 | ✅ 保存（关间节点决策前） |
| 关间节点决策完成 | ✅ 保存（带商店买卡/秘境效果） |
| 关内战斗中 | ❌ 不保存（关闭浏览器要重打当前关） |
| 关卡失败 | ❌ 不保存，清空 ongoingRun |

### 4.3 继续 Run 的恢复流程

```
玩家点击"继续 Run"
   │
   ▼
从 ongoingRun 加载：
   - 设置当前关卡为 ongoingRun.currentLevel
   - 设置水晶 HP / 金币
   - 设置 PRNG 状态（多流）
   - 重建卡组（按 deck 配置，含实例等级）
   │
   ▼
进入当前关卡战斗（或关间节点，取决于保存时机）
```

> **PRNG 状态保存**：必须保存所有 PRNG 流的当前状态（mulberry32 的 state 整数），保证恢复后的随机性与中断前一致。

---

## 5. 流派识别（自动 tag）

Run 结束时自动识别玩家流派，写入 `runHistory.archetypeWins`：

| 流派 | 识别规则 |
|------|---------|
| **近战墙流** | 近战单位卡（剑士/盾卫等）数量 > 卡组 50% |
| **法术爆发流** | 法术卡数量 > 卡组 40% |
| **生产抗压流** | 生产建筑（金矿/能量水晶）数量 ≥ 3 张 |
| **远程压制流** | 远程塔（箭塔/激光塔等）数量 > 卡组 40% |
| **混合均衡流** | 不满足以上任一规则时的兜底标签 |

具体规则可在配置中调整。

---

## 6. 版本兼容

### 6.1 当前版本与策略

- **当前存档版本**：`v2.0.0`（自 v3.0 起设定，v3.1 不升版）。
- **游戏未上线，没有历史版本的玩家数据**。本节不再维护任何 v1.x → v2.0 或 v2.0 → v2.1 的迁移路径。
- 开发阶段如需调整存档结构：
  1. 直接修改 `SaveData` 类型 + 默认值；
  2. 提升 `CURRENT_VERSION` 常量；
  3. 加载存档时若 `data.version !== CURRENT_VERSION` → 警告并备份原存档（key: `save_backup_v{oldVersion}`），然后创建新存档。
- 上线后若需要数据迁移，将在专门的「迁移设计文档」中重新定义；本文件不预留迁移注册表。

### 6.2 版本检查流程

```
读取存档 →
  if (data.version === CURRENT_VERSION) → 校验 checksum → 直接使用
  else → 备份原存档到 save_backup_v{oldVersion} → 创建全新存档（DEFAULT_SAVE）
```

### 6.3 命名兼容说明

- `baseHp` / `baseHpMax` / `baseHpBonus` 字段名保留（前缀 `base` 在 v3.0 后重读为"基础值"，仍表达水晶 HP）。
- `OngoingRun.baseHp` = 当前水晶 HP（0 ~ baseHpMax）。
- 不引入与之对应的 `crystalHp` 别名，避免双字段并存。

---

## 7. 损坏恢复（保留 v1.1 设计）

### 7.1 损坏检测

存档保存时计算 CRC32 校验和：

```typescript
function save(data: SaveData) {
  data.checksum = '';
  const json = JSON.stringify(data);
  data.checksum = crc32(json);
  localStorage.setItem('save', JSON.stringify(data));
}
```

读取时验证：

```typescript
function load(): SaveData | null {
  const raw = localStorage.getItem('save');
  if (!raw) return null;
  const data = JSON.parse(raw);
  const expectedChecksum = data.checksum;
  data.checksum = '';
  const actualChecksum = crc32(JSON.stringify(data));
  if (actualChecksum !== expectedChecksum) {
    return recoverFromBackup();
  }
  data.checksum = expectedChecksum;
  return data;
}
```

### 7.2 备份策略

| 备份键 | 触发时机 | 保留时长 |
|--------|---------|---------|
| `save_backup_session` | 每次成功保存前 | 当前会话 |
| `save_backup_daily` | 每天首次保存前 | 7 天 |
| `save_backup_v{version}` | 版本迁移前 | 永久 |

恢复优先级：当前 → session → daily → 版本备份 → 默认值

---

## 8. 重置

- 重置按钮位置：主菜单 → 设置 → "重置全部进度"
- 二次确认对话框（避免误操作）
- 重置前自动备份到 `save_manual_backup_{timestamp}`
- 重置后恢复 `DEFAULT_SAVE`

> 重置选项可以分级：「仅重置 ongoingRun」/「重置 Run 历史」/「重置全部含卡池」

---

## 9. 隐私与存储

| 项 | 规则 |
|----|------|
| **存储位置** | 浏览器 LocalStorage（key=`save`），同源同浏览器有效 |
| **同步** | 暂不支持云存档（未来可接入 GitHub Gist 或自部署后端） |
| **大小限制** | LocalStorage 一般 5-10MB，单存档 < 100KB，不会触顶 |
| **PII** | 不收集任何个人识别信息 |

---

## 10. 已删除字段

> 以下字段在 v2.0 中**完全删除**：

- `levels: Record<string, LevelProgress>` → 删除（独立关卡概念取消）
- `endless: EndlessProgress` → 删除（无尽模式取消）
- `lastPlayedLevel` → 删除（改用 `ongoingRun.currentLevel`）
- `LevelProgress.starsEarned` → 删除（三星评定取消）
- `LevelProgress.bestStarCount` / `bestClearTimeSeconds` → 删除

---

## 11. 参考章节

- 火花碎片来源与去向：[06-economy-system §4](../10-gameplay/11-economy.md#4-火花碎片跨局-meta-资源)
- 卡牌系统机制：[25-card-roguelike-refactor §2](../10-gameplay/10-roguelike-loop.md#2-卡牌系统)
- 永久升级 UI：[09-ui-ux §9 卡池界面](../40-presentation/40-ui-ux.md#9-卡池界面主菜单子页面)
- Run 模式规则：[08-game-modes §1](../10-gameplay/12-game-modes.md#1-run-模式唯一模式)
- 数值表：[21-MDA §8-§11](../50-data-numerical/50-mda.md)
