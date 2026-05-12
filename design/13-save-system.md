# 13 — 存档系统

> 存档数据结构、版本兼容、损坏恢复、自动存档时机
>
> **依赖**：星级评定规则以 [08-game-modes §1.2](./08-game-modes.md#12-三星评定p2-13-修复-v11) 为准。

---

## 1. 存档数据结构

### 1.1 存档格式（v1.1）

```typescript
interface SaveData {
  // 元数据
  version: string;              // 存档格式版本，如 "1.1.0"
  createdAt: number;            // 首次创建时间（Unix ms）
  updatedAt: number;            // 最后更新时间（Unix ms）
  checksum: string;             // CRC32 校验和（防止存档损坏）
  
  // 关卡进度
  levels: Record<string, LevelProgress>;
  
  // 无尽模式
  endless: EndlessProgress;
  
  // 全局状态
  lastPlayedLevel: string | null;
  totalPlayTimeSeconds: number;
  totalKills: number;
  totalGoldEarned: number;
  
  // 设置
  settings: PlayerSettings;
}

interface LevelProgress {
  unlocked: boolean;
  cleared: boolean;
  starsEarned: {
    clear: boolean;        // ★1 通关
    defense: boolean;      // ★2 基地 HP ≥ 80%
    speed: boolean;        // ★3 通关时间 ≤ targetTime
  };
  bestStarCount: number;        // 历史最佳星数（0-3）
  bestClearTimeSeconds: number; // 最快通关时间（仅成功通关计入）
  bestBaseHpRatio: number;      // 最高基地 HP 比例（0.0-1.0）
  bestWaveReached: number;      // 最佳到达波次（失败时也记录）
  attempts: number;             // 尝试次数
}

interface EndlessProgress {
  highestWaveReached: number;
  highestScore: number;
  lastSeed: number | null;           // 上次无尽模式种子（用于复现）
  bestSeed: number | null;           // 最高分对应的种子
  totalEndlessRuns: number;
}

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
  version: '1.1.0',
  levels: {
    'L1_plain': { unlocked: true,  cleared: false, /* ... */ },
    'L2_desert': { unlocked: false, /* ... */ },
    // L3-L5 同 L2
  },
  endless: { highestWaveReached: 0, highestScore: 0, lastSeed: null, /* ... */ },
  // ...
};
```

---

## 2. 自动存档时机

| 时机 | 操作 |
|------|------|
| **关卡胜利** | 更新 `LevelProgress`：星级、bestStarCount、最佳时间、连锁解锁下一关 |
| **关卡失败** | 仅更新 `bestWaveReached` 与 `attempts`（不降级已有星级） |
| **无尽模式结束** | 更新 `EndlessProgress`：highestWaveReached、highestScore、bestSeed |
| **设置变更** | 立刻保存 `settings` 字段 |
| **每 60 秒** | 保存 `totalPlayTimeSeconds` 增量 |
| **窗口关闭/页面卸载** | `beforeunload` 事件，最后一次保存（best-effort） |

---

## 3. 星级评定规则（详见 08）

每颗星独立评定，三项条件都达成 = ★★★：

| 星 | 条件 |
|----|------|
| ★1 通关星 | `cleared === true` |
| ★2 防守星 | `baseHpRatio ≥ 0.8` |
| ★3 速通星 | `clearTimeSeconds ≤ level.targetTimeSeconds` |

**最佳成绩规则**：
- `bestStarCount = max(历史每次的 sum(starsEarned))`
- `starsEarned` 单项**永不降级**（一旦解锁某项即永久保留）
- `bestClearTimeSeconds = min(所有成功通关的时间)`

---

## 4. 连锁解锁

| 通关 | 解锁 |
|------|------|
| L1 平原 | L2 沙漠 |
| L2 沙漠 | L3 冰原 |
| L3 冰原 | L4 火山 |
| L4 火山 | L5 城堡 |

> 解锁条件为 `cleared === true`，无需 ★★★。星数仅影响个人成就，不影响解锁。

---

## 5. 版本兼容与数据迁移（P2-#17 修复 v1.1）

> **旧版问题**：存档无版本号，未来字段变更将造成无法解析的旧存档。

### 5.1 版本检查流程

```
读取存档 →
  if (data.version === CURRENT_VERSION) → 直接使用
  else if (canMigrate(data.version)) → 调用 migrate() 升级
  else → 警告"存档版本不兼容"，备份原存档 + 创建新存档
```

### 5.2 迁移注册表

```typescript
const MIGRATIONS: Migration[] = [
  {
    from: '1.0.0',
    to: '1.1.0',
    migrate: (data: any): SaveData => {
      // v1.0 存档无 starsEarned 字段，需推断
      for (const lv of Object.values(data.levels)) {
        const stars = lv.stars ?? 0;
        lv.starsEarned = {
          clear: stars >= 1,
          defense: stars >= 3,   // 旧规则中 ★★★=无损
          speed: stars >= 2,     // 旧规则中 ★★=限时
        };
        lv.bestStarCount = stars;
        lv.bestClearTimeSeconds = lv.bestTimeSeconds ?? Infinity;
        lv.bestBaseHpRatio = stars >= 3 ? 1.0 : 0.0;
        lv.attempts = lv.attempts ?? 0;
      }
      data.version = '1.1.0';
      return data as SaveData;
    },
  },
];
```

### 5.3 迁移规则

- 每次升级版本必须保留对前 N-1 个版本的迁移路径
- 迁移过程中保留原始存档备份（key: `save_backup_v{oldVersion}`）
- 迁移失败时，UI 提示用户"存档迁移失败，是否使用备份"

---

## 6. 损坏恢复（P2-#17 v1.1）

### 6.1 损坏检测

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

### 6.2 备份策略

| 备份键 | 触发时机 | 保留时长 |
|--------|----------|----------|
| `save_backup_session` | 每次成功保存前 | 当前会话 |
| `save_backup_daily` | 每天首次保存前 | 7 天 |
| `save_backup_v{version}` | 版本迁移前 | 永久 |

恢复优先级：当前 → session → daily → 版本备份 → 默认值

---

## 7. 重置

- 重置按钮位置：关卡选择界面 → 设置 → "重置全部进度"
- 二次确认对话框（避免误操作）
- 重置前自动备份到 `save_manual_backup_{timestamp}`
- 重置后恢复 `DEFAULT_SAVE`

---

## 8. 隐私与存储

| 项 | 规则 |
|----|------|
| **存储位置** | 浏览器 LocalStorage（key=`save`），同源同浏览器有效 |
| **同步** | 暂不支持云存档（未来可接入 GitHub Gist 或自部署后端） |
| **大小限制** | LocalStorage 一般 5-10MB，单存档 < 100KB，不会触顶 |
| **PII** | 不收集任何个人识别信息 |
