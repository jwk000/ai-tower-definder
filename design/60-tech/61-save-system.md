---
title: 存档系统
status: stable
version: 3.0.0
last-modified: 2026-05-15
authority-for:
  - save-format-v3
  - persistence-spec-v3
  - single-run-closure-contract
supersedes:
  - save-format-v1  # v1.0.0 含 meta 永久积累存档结构；v3.4 第 2 轮整文重写
cross-refs:
  - 60-tech/60-architecture.md
  - 10-gameplay/10-roguelike-loop.md      # v2.0.0 单 Run 闭环
  - 10-gameplay/11-economy.md             # v3.0.0 三资源轴 + §8 已删除机制
  - 50-data-numerical/50-mda.md           # 数值真理源
  - 40-presentation/40-ui-ux.md           # v3.0.0 主菜单删「继续 Run」/「卡池」/「永久升级」
  - 40-presentation/48-shop-redesign-v34.md
  - v3.4-MAJOR-MIGRATION.md
---

# 存档系统（v3.4 单 Run 闭环契约）

> ✅ **v3.4 形态级第 2 轮已完成（2026-05-15）**：本文档已从 v1.0.0 **整文重写**为 v3.0.0「v3.4 单 Run 闭环存档契约」。
>
> **核心变更**：
> - **存档格式版本**：v2.0.0 → **v3.0.0**（不向后兼容，游戏未上线无玩家数据迁移）
> - **§1 SaveData 结构**：删除 5 个 meta 字段（`sparkShards` / `cardCollection` / `permanentUpgrades` / `ongoingRun` / `RunHistory.totalSparkShardsEarned`）
> - **§3 永久解锁与火花碎片**：整节删除 → 短废弃声明 + cross-ref
> - **§4 关间存档点（OngoingRun）**：整节删除 → 短废弃声明 + 不可中断保存说明
> - **§5 流派识别**：保留（archetypeWins 作"本会话荣誉"统计依据）
> - **§7 损坏恢复**：保留（CRC32 + 备份策略，与 meta 无关）
> - **§10 已删除字段**：v3.4 累计扩充（v2.0 删除 5 项 + v3.0 删除 5 项）
> - 旧 v1.0 已归档至 [archive/61-save-system_v1.0_2026.05.15.md](../archive/61-save-system_v1.0_2026.05.15.md)

> 存档数据结构、版本兼容、损坏恢复、自动存档时机
>
> **v3.4 设计哲学**：存档仅持久化"主菜单设置 + 战绩统计 + 设置项"等**与 Run 进度无关**的数据。所有 Run 资源（金币 / SP / 水晶 HP / 卡组 / 技能树）随 Run 结束清零，**永不进入存档**。

---

## 1. 存档数据结构

### 1.1 存档格式（v3.0.0）

```typescript
interface SaveData {
  // ========== 元数据 ==========
  version: string;              // 存档格式版本，固定为 "3.0.0"
  createdAt: number;            // 首次创建时间（Unix ms）
  updatedAt: number;            // 最后更新时间（Unix ms）
  checksum: string;             // CRC32 校验和（防止存档损坏）

  // ========== Run 历史统计（v3.4 audit）==========
  runHistory: RunHistory;

  // ========== 全局玩家行为累计（与 meta 资源无关）==========
  totalPlayTimeSeconds: number; // 累计游戏时长（仅展示用）
  totalKills: number;            // 累计击杀敌人数（成就基础）
  totalGoldEarned: number;       // 累计赚取金币（成就基础，本数据 ≠ meta 货币）

  // ========== 成就 ==========
  achievements: AchievementProgress;

  // ========== 设置 ==========
  settings: PlayerSettings;

  // ========== v3.0 已删除字段（不再出现于 SaveData）==========
  // ❌ sparkShards           — v3.4 火花碎片彻底废弃
  // ❌ cardCollection         — v3.4 所有卡开局即解锁（卡池从配置层 src/config/cards/*.yaml 读取）
  // ❌ permanentUpgrades      — v3.4 无关外永久升级（升级转本 Run 技能树）
  // ❌ ongoingRun             — v3.4 Run 不可中断保存（v3.4-INV-04）
  // ❌ RunHistory.totalSparkShardsEarned — v3.4 无碎片资源
}

// ============================================================
// Run 历史统计（v3.4 audit）
// ============================================================
interface RunHistory {
  totalRuns: number;                      // 总 Run 次数
  totalVictories: number;                  // 终战通关次数
  highestLevelReached: number;             // 最远到达关卡（1-9）
  fastestVictoryTimeSeconds: number;       // 最快通关时长
  currentStreak: number;                   // 当前连胜（正）或连败（负）
  longestWinStreak: number;
  archetypeWins: Record<string, number>;   // 各流派通关次数（"本会话荣誉"，详见 §5）

  // ❌ totalSparkShardsEarned — v3.0 删除（v3.4 无碎片资源）
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
  version: '3.0.0',
  createdAt: now(),
  updatedAt: now(),
  checksum: '',

  runHistory: {
    totalRuns: 0,
    totalVictories: 0,
    highestLevelReached: 0,
    fastestVictoryTimeSeconds: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    archetypeWins: {},
  },

  totalPlayTimeSeconds: 0,
  totalKills: 0,
  totalGoldEarned: 0,

  achievements: { unlocked: {}, progress: {} },

  settings: {
    sfxVolume: 0.8,
    musicVolume: 0.6,
    showFPS: false,
    preferredLanguage: 'zh-CN',
  },
};
```

**v3.4 关键不变式**：
- ✅ DEFAULT_SAVE 中**不含任何 Run 资源字段**（无 sparkShards / 无 cardCollection / 无 permanentUpgrades / 无 ongoingRun）
- ✅ 卡牌池完全由配置层 `src/config/cards/*.yaml` 决定，**存档不参与卡牌解锁判定**
- ✅ Run 起始水晶 HP / 起始金币 / 起始 SP 全部固定值，来自 `src/data/balance.ts`（[50-mda §17.6](../50-data-numerical/50-mda.md)），**存档不参与 Run 初始化参数**

详见 [10-roguelike-loop §11 不变式 v3.4-INV-01](../10-gameplay/10-roguelike-loop.md)。

---

## 2. 自动存档时机

| 时机 | 操作 |
|------|------|
| **Run 开始** | ~~写入 ongoingRun~~ — **v3.4 不存档 Run 过程数据**，仅 `runHistory.totalRuns += 1` |
| **关卡通过（进入关间节点前）** | ~~更新 ongoingRun~~ — **v3.4 不存档**，关后 3 选 1 决策完全是内存态 |
| **关间节点决策完成** | ~~更新 ongoingRun~~ — **v3.4 不存档** |
| **Run 失败** | 更新 `runHistory.highestLevelReached / currentStreak / archetypeWins` + 累计统计；**无 meta 资源发放** |
| **Run 胜利** | 更新 `runHistory.totalVictories / fastestVictoryTimeSeconds / archetypeWins / longestWinStreak` + 累计统计；**无 meta 资源发放** |
| **成就解锁** | 立即保存 `achievements`（无碎片入账，仅记录解锁时间） |
| **设置变更** | 立即保存 `settings` |
| **每 60 秒** | 保存 `totalPlayTimeSeconds` 增量（仅 Run 中累加） |
| **窗口关闭/页面卸载** | `beforeunload` 事件，best-effort 保存 |

### 2.1 v3.4 关内 + 关间均不持久化战斗状态

> **v3.4 设计取舍（v3.0 进一步收紧）**：
> - v1.0 时期支持「关间存档点」（OngoingRun），允许玩家中断 Run 后继续 → v3.4 **整字段删除**
> - v3.4 Run 一旦开始，必须**单次会话内完成**；中途关闭浏览器 / 刷新页面 = Run 强制结束（视为放弃，回到主菜单初始状态）
>
> **原因**：
> 1. Roguelike 本质 —— "Run 闭环不可中断"是设计核心理念，与"随时存档继续"互斥
> 2. UI 已删除「继续 Run」按钮（[40-ui-ux v3.0.0 §11](../40-presentation/40-ui-ux.md)），保留 OngoingRun 字段无意义
> 3. 简化代码层 —— 删除 OngoingRun 相关序列化 / 反序列化 / PRNG 状态恢复逻辑，预计减少 src/save/ ~300 行代码（第 4 轮代码迁移确认）

详见 [10-roguelike-loop §5.4](../10-gameplay/10-roguelike-loop.md) + [§11 不变式 v3.4-INV-04](../10-gameplay/10-roguelike-loop.md)。

---

## 3. ~~永久解锁与火花碎片~~（v3.0 整节删除）

> 🛑 **v3.0 整节删除**：v1.0 §3「永久解锁与火花碎片」机制**彻底废弃**：
>
> - ~~Run 末金币 1:1 转碎片~~ → v3.4 Run 结束所有资源清零（11-economy §3.6）
> - ~~Run 失败按到达关卡发碎片 10-100~~ → v3.4 失败 Run 仅更新 RunHistory，无资源发放
> - ~~碎片解锁新卡（50-800/张）+ 5 稀有度阶梯~~ → v3.4 所有卡开局即解锁
> - ~~碎片永久升级（HP / 能量 / 手牌 / 单位上限 / 起始金币 5 项）~~ → v3.4 升级转本 Run 技能树（11-economy §4 SP 系统）
>
> **替代机制**：
> - 升级路径 → 本 Run 技能树节点投入（[11-economy §4](../10-gameplay/11-economy.md)）
> - 卡组扩展 → 商店购卡（本 Run 临时，Run 结束清零；[48-shop-redesign-v34](../40-presentation/48-shop-redesign-v34.md)）
> - 玩家成长感 → 战绩统计 + archetypeWins 流派荣誉（§5）+ 成就解锁
>
> **跨章节关联**：
> - 11-economy [§8 已删除机制](../10-gameplay/11-economy.md) — 经济层 meta 废弃总声明
> - MIGRATION [§4.2 代码层不变式](../v3.4-MAJOR-MIGRATION.md) — 第 4 轮代码迁移路径
> - 40-ui-ux [§9 卡池界面整节删除](../40-presentation/40-ui-ux.md) — UI 层同步删除

---

## 4. ~~关间存档点（OngoingRun）~~（v3.0 整节删除）

> 🛑 **v3.0 整节删除**：v1.0 §4「关间存档点」机制**彻底废弃**：
>
> - ~~Run 开始 / 关卡通过 / 关间决策完成时写入 OngoingRun~~ → v3.4 不存档 Run 过程数据
> - ~~主菜单「继续 Run」按钮恢复未完成 Run~~ → v3.4 主菜单删除该按钮（40-ui-ux §11）
> - ~~PRNG 状态保存（mulberry32 多流）~~ → v3.4 Run 内存中处理，关闭即丢失
>
> **替代机制**：
> - Run 必须**单次会话内完成**（v3.4-INV-04）
> - 玩家中断 Run = 放弃，回到主菜单初始状态
> - 战绩统计仍保留（`runHistory.totalRuns` 会 +1，但不会进入"未完成 Run"列表）
>
> **设计代价与收益**：
>
> | 代价 | 收益 |
> |---|---|
> | 玩家无法分多次游戏会话完成 Run（30-45 分钟必须连续游玩） | Roguelike 闭环理念强化（与 Slay the Spire / Hades 等 SOTA 一致） |
> | OngoingRun 序列化代码废弃 | src/save/ 减少 ~300 行复杂逻辑 |
> | PRNG 多流状态保存 / 恢复废弃 | 多流 PRNG 仅在 Run 启动时种子化，简化 src/utils/runRandom.ts |
>
> **跨章节关联**：
> - 10-roguelike-loop [§5.4 单 Run 闭环不可中断](../10-gameplay/10-roguelike-loop.md) + [§11 v3.4-INV-04](../10-gameplay/10-roguelike-loop.md)
> - 40-ui-ux [§11 主菜单删「继续 Run」](../40-presentation/40-ui-ux.md)

---

## 5. 流派识别（v3.4 audit：本会话荣誉）

Run 结束时自动识别玩家流派，写入 `runHistory.archetypeWins`。**v3.4 重定位**：流派识别从"meta 进度统计"改为**"本会话荣誉"**，与 meta 资源发放完全解耦。

| 流派 | 识别规则 |
|------|---------|
| **近战墙流** | 近战单位卡（剑士/盾卫等）数量 > 卡组 50% |
| **法术爆发流** | 法术卡数量 > 卡组 40% |
| **生产抗压流** | 生产建筑（金矿/能量水晶）数量 ≥ 3 张 |
| **远程压制流** | 远程塔（箭塔/激光塔等）数量 > 卡组 40% |
| **混合均衡流** | 不满足以上任一规则时的兜底标签 |

具体规则可在配置中调整。

**v3.4 应用场景**：
- ✅ Run 结算页"流派标签"展示（[40-ui-ux §10](../40-presentation/40-ui-ux.md)）
- ✅ 主菜单成就页"各流派通关次数"展示
- ✅ 关键节点统计行的数据基础（如"满级电塔 + 半级冰塔" → 远程压制流）
- ❌ ~~不再发放任何资源~~（v1.0 时期"流派通关 +50 碎片"等机制彻底废弃）

---

## 6. 版本兼容

### 6.1 当前版本与策略

- **当前存档版本**：`v3.0.0`（v3.4 形态级第 2 轮于 2026-05-15 升至）
- **游戏未上线，没有历史版本的玩家数据**。本节不维护任何 v1.x → v2.0 → v3.0 的迁移路径
- 开发阶段如需调整存档结构：
  1. 直接修改 `SaveData` 类型 + 默认值
  2. 提升 `CURRENT_VERSION` 常量
  3. 加载存档时若 `data.version !== CURRENT_VERSION` → 警告并备份原存档（key: `save_backup_v{oldVersion}`），然后创建新存档
- 上线后若需要数据迁移，将在专门的「迁移设计文档」中重新定义；本文件不预留迁移注册表

### 6.2 版本检查流程

```
读取存档 →
  if (data.version === CURRENT_VERSION) → 校验 checksum → 直接使用
  else → 备份原存档到 save_backup_v{oldVersion} → 创建全新存档（DEFAULT_SAVE）
```

### 6.3 v3.0 命名清理

- ~~`baseHp` / `baseHpMax` / `baseHpBonus` 字段名保留~~ → v3.0 整字段删除（`baseHpMax` 在 PermanentUpgrades 中，PermanentUpgrades 字段已删除；`baseHp` 在 OngoingRun 中，OngoingRun 字段已删除）
- v3.0 后**存档中不再有任何水晶 HP 相关字段**（水晶 HP 仅活在 Run 内存态，Run 结束清零）

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

> **v3.4 影响**：损坏恢复机制与 meta 资源完全无关，本节 v3.0 不变。

---

## 8. 重置（v3.4 简化）

- 重置按钮位置：主菜单 → 设置 → "重置全部进度"
- 二次确认对话框（避免误操作）
- 重置前自动备份到 `save_manual_backup_{timestamp}`
- 重置后恢复 `DEFAULT_SAVE`

> **v3.4 重置选项简化**：
> - ~~分级「仅重置 ongoingRun」/「重置 Run 历史」/「重置全部含卡池」~~ → v3.4 删除（无 ongoingRun / 无 cardCollection）
> - v3.4 仅 1 个选项 —— **重置 Run 历史 + 成就 + 累计统计**（设置项保留）

---

## 9. 隐私与存储

| 项 | 规则 |
|----|------|
| **存储位置** | 浏览器 LocalStorage（key=`save`），同源同浏览器有效 |
| **同步** | 暂不支持云存档（未来可接入 GitHub Gist 或自部署后端） |
| **大小限制** | LocalStorage 一般 5-10MB；**v3.4 单存档预估 < 10KB**（v1.0 时期 < 100KB，v3.4 删除 OngoingRun/cardCollection/permanentUpgrades 后大幅瘦身） |
| **PII** | 不收集任何个人识别信息 |

---

## 10. 已删除字段（v3.4 累计）

### 10.1 v2.0 删除（v1.x → v2.0 转型）

| 字段 | v2.0 删除原因 |
|---|---|
| `levels: Record<string, LevelProgress>` | 独立关卡概念取消（改为 Run 长征） |
| `endless: EndlessProgress` | 无尽模式取消 |
| `lastPlayedLevel` | 改用 `ongoingRun.currentLevel`（注：ongoingRun 在 v3.0 也被删除） |
| `LevelProgress.starsEarned` | 三星评定取消 |
| `LevelProgress.bestStarCount` / `bestClearTimeSeconds` | 三星 / 分关计时取消 |

### 10.2 v3.0 删除（v3.0/v3.1/v3.3 → v3.4 转型）

| 字段 | v3.0 删除原因 |
|---|---|
| `sparkShards: number` | v3.4 火花碎片彻底废弃 |
| `cardCollection: CardCollection` | v3.4 所有卡开局即解锁（卡池从 src/config/cards/*.yaml 配置层读取） |
| `CardEntry.techTree: TechTreeProgress` | v3.4 塔升级转本 Run 技能树（本 Run 内存态，不持久化） |
| `permanentUpgrades: PermanentUpgrades` | v3.4 无关外永久升级（5 项升级路径全部废弃） |
| `ongoingRun: OngoingRun \| null` | v3.4 Run 不可中断保存（v3.4-INV-04） |
| `RunHistory.totalSparkShardsEarned` | v3.4 无碎片资源 |

### 10.3 v3.0 保留字段（与 v2.0 一致）

- `RunHistory.totalRuns / totalVictories / highestLevelReached / fastestVictoryTimeSeconds / currentStreak / longestWinStreak / archetypeWins`
- `totalPlayTimeSeconds / totalKills / totalGoldEarned`（玩家行为累计，非 meta 资源）
- `AchievementProgress / PlayerSettings`

---

## 11. 参考章节

### 系统设计
- **Run 长征循环**：[10-roguelike-loop v2.0.0](../10-gameplay/10-roguelike-loop.md)（§5.4 单 Run 不可中断 + §6 Run 结束清零 + §11 v3.4-INV-04）
- **经济系统**：[11-economy v3.0.0](../10-gameplay/11-economy.md)（§3.6 关后清零 + §4 SP 系统不持久化 + §8 已删除机制）
- **UI 主菜单**：[40-ui-ux v3.0.0 §11](../40-presentation/40-ui-ux.md)（删「继续 Run」/「卡池」/「永久升级」按钮）
- **商店契约**：[48-shop-redesign-v34](../40-presentation/48-shop-redesign-v34.md)（shop_item 卡 / RunManager 状态机）

### 数值依赖
- **数值真理源**：[50-mda v1.3.0](../50-data-numerical/50-mda.md)（§13.3 SP 兑换 / §17 SP 系统）

### v3.4 形态主声明
- **v3.4 变更总览**：[v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md)（§3.2 第 5 项 61-save-system v3.0.0 迁移）

### v1.0 历史归档
- **v1.0 完整快照**：[archive/61-save-system_v1.0_2026.05.15.md](../archive/61-save-system_v1.0_2026.05.15.md)（455 行 / 11 节，含 SparkShards / CardCollection / PermanentUpgrades / OngoingRun / CardEntry.techTree 等已废弃字段定义）

---

## 12. 修订历史

| 日期 | 版本 | 作者 | 说明 |
|------|------|------|------|
| 2026-05-14 | 1.0.0 | — | v3.0 初版存档系统：SparkShards / CardCollection / PermanentUpgrades / OngoingRun / RunHistory / Achievements / PlayerSettings；存档版本 v2.0.0 |
| 2026-05-15 | 3.0.0 | v3.4 第 2 轮重构 | **整文重写**（455→~450 行）：存档版本 v2.0.0 → v3.0.0；§1 SaveData 删除 5 个 meta 字段（sparkShards / cardCollection / permanentUpgrades / ongoingRun / totalSparkShardsEarned）；§1.2 DEFAULT_SAVE 重构（卡池从配置层读取，不再持久化）；§2 自动存档时机改写（Run 过程不存档 + 无 meta 资源发放）；§3 永久解锁与火花碎片整节删除（短废弃声明 + cross-ref MIGRATION）；§4 关间存档点整节删除（短废弃声明 + 代价收益对照）；§5 流派识别 v3.4 重定位（本会话荣誉，与 meta 解耦）；§6.3 命名清理（baseHp 字段族全部删除）；§7 损坏恢复保留不变；§8 重置简化（删分级选项）；§9 存储瓶颈预估改写（< 10KB）；§10 已删除字段累计扩充（v2.0 5 项 + v3.0 6 项）；§11 cross-ref 全刷新（10-roguelike-loop §5.4/§11、11-economy §3.6/§4/§8、40-ui-ux §11、48、50-mda §17、MIGRATION §3.2、archive v1.0 快照）；frontmatter version 1.0.0→3.0.0 + supersedes 增 save-format-v1 + authority-for 增 single-run-closure-contract + cross-refs 增 11-economy/40-ui-ux/48/MIGRATION；旧版归档 [archive/61-save-system_v1.0_2026.05.15.md](../archive/61-save-system_v1.0_2026.05.15.md) |
