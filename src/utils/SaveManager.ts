/**
 * SaveManager v2.0.0 — design/13-save-system.md (v3.0 重写)
 *
 * v2.0 主要改动:
 * - 新增 v3.0 卡牌 Roguelike 永久数据: CardCollection / PermanentUpgrades / RunHistory / OngoingRun / Achievements / Settings / sparkShards
 * - 新增 v1.1 → v2.0 迁移: 旧通关数关卡 × 100 转换为 sparkShards, 标记 migrated_from_v1_1 成就 (13 §6.2)
 * - 保留 v1.1 兼容字段 (unlockedLevels / levelStars / highScores / totalGold) 与公共 API (setStars / unlockLevel) 以不破坏调用方
 * - 保留 v1.1 → v1.1 (number → string) 迁移路径 (1 → 1.1.0)
 *
 * 沿用 v1.1 设计:
 * - CRC32 校验和 + 多层备份 + 损坏恢复 (P2-#17)
 * - BattleSnapshot 中途存档
 */

import { crc32 } from './crc32.js';

export interface SaveData {
  version: string;
  createdAt: number;
  updatedAt?: number;
  checksum?: string;

  sparkShards: number;
  cardCollection: CardCollection;
  permanentUpgrades: PermanentUpgrades;

  runHistory: RunHistory;
  ongoingRun: OngoingRun | null;

  totalPlayTimeSeconds: number;
  totalKills: number;
  totalGoldEarned: number;
  achievements: AchievementProgress;

  settings: PlayerSettings;

  battleSnapshot?: BattleSnapshot;

  /** @deprecated v1.1 兼容字段，Phase A 后续任务移除（替代为 ongoingRun.currentLevel） */
  unlockedLevels: number;
  /** @deprecated v1.1 兼容字段，Phase A 后续任务移除（三星已取消） */
  levelStars: Record<number, number>;
  /** @deprecated v1.1 兼容字段，Phase A 后续任务移除（评分体系改为 heroScore） */
  highScores: Record<number, number>;
  /** @deprecated v1.1 兼容字段，Phase A 后续任务移除（金币改为 Run 内 + sparkShards） */
  totalGold: number;
}

export interface CardCollection {
  unlocked: Record<string, CardEntry>;
}

export interface CardEntry {
  unlockedAt: number;
  baseLevel: number;
  totalUsesInRuns: number;
  totalDeploys: number;
}

export interface PermanentUpgrades {
  baseHpMax: number;
  energyMax: number;
  handSizeMax: number;
  unitCapOnField: number;
  startingGold: number;
}

export interface RunHistory {
  totalRuns: number;
  totalVictories: number;
  highestLevelReached: number;
  fastestVictoryTimeSeconds: number;
  currentStreak: number;
  longestWinStreak: number;
  totalSparkShardsEarned: number;
  archetypeWins: Record<string, number>;
}

export interface OngoingRun {
  runSeed: number;
  currentLevel: number;
  /** 当前水晶 HP（字段名 baseHp 保留以兼容存档，见 design/13 §6.1.1） */
  baseHp: number;
  gold: number;
  deck: CardInDeck[];
  startedAt: number;
  elapsedSeconds: number;
  prngStateMap: number;
  prngStateWave: number;
  prngStateShop: number;
  prngStateMystic: number;
}

export interface CardInDeck {
  cardId: string;
  instanceLevel: number;
  isPersistentInHand?: boolean;
  metaState?: Record<string, unknown>;
}

export interface AchievementProgress {
  unlocked: Record<string, number>;
  progress: Record<string, number>;
}

export interface PlayerSettings {
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  preferredLanguage: string;
}

export interface BattleSnapshot {
  levelId: number;
  currentWave: number;
  gameTime: number;
  prngStates: {
    seed: number;
    map: number;
    wave: number;
    drop: number;
    decor: number;
  };
  economy: {
    gold: number;
    energy: number;
    population: number;
    maxPopulation: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refundMeta: Array<[number, any]>;
  };
}

export const CURRENT_VERSION = '2.0.0';

export const BACKUP_KEYS = {
  session: 'tower-defender-save-backup-session',
  daily: 'tower-defender-save-backup-daily',
  dailyTimestamp: 'tower-defender-save-backup-daily-ts',
  versionPrefix: 'tower-defender-save-backup-v',
  manualPrefix: 'tower-defender-save-backup-manual-',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const INITIAL_UNLOCKED_CARD_IDS = [
  'arrow_tower_card',
  'cannon_tower_card',
  'swordsman_card',
  'archer_card',
  'shield_guard_card',
  'gold_mine_card',
  'fireball_spell',
  'energy_crystal_card',
] as const;

interface Migration {
  from: string | number;
  to: string;
  migrate: (data: Record<string, unknown>) => SaveData;
}

function buildInitialCardCollection(): CardCollection {
  const now = Date.now();
  const unlocked: Record<string, CardEntry> = {};
  for (const id of INITIAL_UNLOCKED_CARD_IDS) {
    unlocked[id] = {
      unlockedAt: now,
      baseLevel: 1,
      totalUsesInRuns: 0,
      totalDeploys: 0,
    };
  }
  return { unlocked };
}

const MIGRATIONS: Migration[] = [
  {
    from: '1.1.0',
    to: CURRENT_VERSION,
    migrate: (data: Record<string, unknown>): SaveData => {
      const result = SaveManager.getDefaults();

      const levelStars = (data['levelStars'] as Record<number, number> | undefined) ?? {};
      let bonusShards = 0;
      for (const stars of Object.values(levelStars)) {
        if (stars > 0) bonusShards += 100;
      }
      result.sparkShards = bonusShards;
      result.runHistory.totalSparkShardsEarned = bonusShards;
      result.achievements.unlocked['migrated_from_v1_1'] = Date.now();

      const unlockedLevels = data['unlockedLevels'];
      if (typeof unlockedLevels === 'number') {
        result.unlockedLevels = unlockedLevels;
      }
      if (typeof data['levelStars'] === 'object' && data['levelStars'] !== null) {
        result.levelStars = { ...(data['levelStars'] as Record<number, number>) };
      }
      if (typeof data['highScores'] === 'object' && data['highScores'] !== null) {
        result.highScores = { ...(data['highScores'] as Record<number, number>) };
      }
      const totalGold = data['totalGold'];
      if (typeof totalGold === 'number') {
        result.totalGoldEarned = totalGold;
        result.totalGold = totalGold;
      }

      result.version = CURRENT_VERSION;
      return result;
    },
  },
  {
    from: 1,
    to: '1.1.0',
    migrate: (data: Record<string, unknown>): SaveData => {
      const intermediate: Record<string, unknown> = {
        ...data,
        version: '1.1.0',
      };
      const next = MIGRATIONS.find((m) => m.from === '1.1.0');
      if (next) return next.migrate(intermediate);
      return SaveManager.getDefaults();
    },
  },
];

function canMigrate(fromVersion: string | number): boolean {
  return MIGRATIONS.some((m) => m.from === fromVersion);
}

function runMigration(data: Record<string, unknown>): SaveData | null {
  const m = MIGRATIONS.find((mig) => mig.from === data['version']);
  if (!m) return null;
  try {
    return m.migrate(data);
  } catch {
    return null;
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function computeChecksum(data: SaveData): string {
  const copy = { ...data, checksum: '' };
  return crc32(JSON.stringify(copy)).toString(16);
}

function verifyChecksum(data: SaveData): boolean {
  if (!data.checksum) return true;
  const expected = data.checksum;
  return computeChecksum(data) === expected;
}

export class SaveManager {
  static readonly KEY = 'tower-defender-save';

  static getDefaults(): SaveData {
    const now = Date.now();
    return {
      version: CURRENT_VERSION,
      createdAt: now,
      sparkShards: 0,
      cardCollection: buildInitialCardCollection(),
      permanentUpgrades: {
        baseHpMax: 1000,
        energyMax: 10,
        handSizeMax: 4,
        unitCapOnField: 8,
        startingGold: 0,
      },
      runHistory: {
        totalRuns: 0,
        totalVictories: 0,
        highestLevelReached: 0,
        fastestVictoryTimeSeconds: 0,
        currentStreak: 0,
        longestWinStreak: 0,
        totalSparkShardsEarned: 0,
        archetypeWins: {},
      },
      ongoingRun: null,
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
      unlockedLevels: 1,
      levelStars: {},
      highScores: {},
      totalGold: 0,
    };
  }

  /**
   * Load with corruption detection + automatic migration + backup-chain recovery.
   * Recovery priority: current → session backup → daily backup → version backup → defaults.
   */
  static load(): SaveData {
    const result = SaveManager.tryLoadKey(SaveManager.KEY);
    if (result) return result;

    const sessionBackup = SaveManager.tryLoadKey(BACKUP_KEYS.session);
    if (sessionBackup) return sessionBackup;

    const dailyBackup = SaveManager.tryLoadKey(BACKUP_KEYS.daily);
    if (dailyBackup) return dailyBackup;

    for (const m of MIGRATIONS) {
      const vBackup = SaveManager.tryLoadKey(`${BACKUP_KEYS.versionPrefix}${m.from}`);
      if (vBackup) return vBackup;
    }

    return SaveManager.getDefaults();
  }

  private static tryLoadKey(key: string): SaveData | null {
    const raw = safeGetItem(key);
    if (!raw) return null;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed['version'] === CURRENT_VERSION) {
      const normalized = SaveManager.normalize(parsed);
      if (!verifyChecksum(normalized)) return null;
      return normalized;
    }

    const fromVersion = parsed['version'];
    if (typeof fromVersion === 'string' || typeof fromVersion === 'number') {
      if (canMigrate(fromVersion)) {
        SaveManager.backupBeforeMigration(fromVersion, raw);
        const migrated = runMigration(parsed);
        if (migrated) {
          SaveManager.save(migrated);
          return migrated;
        }
      }
    }

    return null;
  }

  static save(data: SaveData): void {
    const previous = safeGetItem(SaveManager.KEY);
    if (previous) {
      safeSetItem(BACKUP_KEYS.session, previous);
      SaveManager.maybeRotateDaily(previous);
    }

    const toWrite: SaveData = {
      ...SaveManager.normalize(data),
      version: CURRENT_VERSION,
      updatedAt: Date.now(),
    };
    toWrite.checksum = computeChecksum(toWrite);
    if (!safeSetItem(SaveManager.KEY, JSON.stringify(toWrite))) {
      console.warn('[SaveManager] Failed to write save data');
    }
  }

  private static maybeRotateDaily(previousJson: string): void {
    const tsRaw = safeGetItem(BACKUP_KEYS.dailyTimestamp);
    const lastTs = tsRaw ? parseInt(tsRaw, 10) : 0;
    const now = Date.now();
    if (!lastTs || now - lastTs >= DAY_MS) {
      safeSetItem(BACKUP_KEYS.daily, previousJson);
      safeSetItem(BACKUP_KEYS.dailyTimestamp, now.toString());
    }
  }

  private static backupBeforeMigration(fromVersion: string | number, rawJson: string): void {
    safeSetItem(`${BACKUP_KEYS.versionPrefix}${fromVersion}`, rawJson);
  }

  /** Ensure all required fields are present with sane defaults (defensive load). */
  private static normalize(input: SaveData | Record<string, unknown>): SaveData {
    const data = input as Record<string, unknown>;
    const defaults = SaveManager.getDefaults();
    const numberOr = (v: unknown, fallback: number): number =>
      typeof v === 'number' ? v : fallback;
    const recordOr = <T,>(v: unknown, fallback: Record<string, T>): Record<string, T> =>
      v && typeof v === 'object' ? ({ ...fallback, ...(v as Record<string, T>) }) : fallback;

    const cardCollection = data['cardCollection'] as CardCollection | undefined;
    const permanentUpgrades = data['permanentUpgrades'] as PermanentUpgrades | undefined;
    const runHistory = data['runHistory'] as RunHistory | undefined;
    const achievements = data['achievements'] as AchievementProgress | undefined;
    const settings = data['settings'] as PlayerSettings | undefined;
    const ongoingRun = data['ongoingRun'] as OngoingRun | null | undefined;
    const battleSnapshot = data['battleSnapshot'] as BattleSnapshot | undefined;

    const out: SaveData = {
      version: (data['version'] as string | undefined) ?? defaults.version,
      createdAt: numberOr(data['createdAt'], defaults.createdAt),
      updatedAt: typeof data['updatedAt'] === 'number' ? (data['updatedAt'] as number) : undefined,
      checksum: typeof data['checksum'] === 'string' ? (data['checksum'] as string) : undefined,

      sparkShards: numberOr(data['sparkShards'], defaults.sparkShards),
      cardCollection: cardCollection?.unlocked
        ? { unlocked: { ...cardCollection.unlocked } }
        : defaults.cardCollection,
      permanentUpgrades: permanentUpgrades
        ? { ...defaults.permanentUpgrades, ...permanentUpgrades }
        : defaults.permanentUpgrades,
      runHistory: runHistory
        ? { ...defaults.runHistory, ...runHistory }
        : defaults.runHistory,
      ongoingRun: ongoingRun ?? null,
      totalPlayTimeSeconds: numberOr(data['totalPlayTimeSeconds'], 0),
      totalKills: numberOr(data['totalKills'], 0),
      totalGoldEarned: numberOr(data['totalGoldEarned'], 0),
      achievements: achievements
        ? {
            unlocked: { ...defaults.achievements.unlocked, ...achievements.unlocked },
            progress: { ...defaults.achievements.progress, ...achievements.progress },
          }
        : defaults.achievements,
      settings: settings ? { ...defaults.settings, ...settings } : defaults.settings,

      unlockedLevels: numberOr(data['unlockedLevels'], defaults.unlockedLevels),
      levelStars: recordOr<number>(data['levelStars'], defaults.levelStars),
      highScores: recordOr<number>(data['highScores'], defaults.highScores),
      totalGold: numberOr(data['totalGold'], defaults.totalGold),
    };
    if (battleSnapshot) out.battleSnapshot = battleSnapshot;
    return out;
  }

  static unlockLevel(levelId: number): void {
    const data = SaveManager.load();
    if (levelId > data.unlockedLevels) {
      data.unlockedLevels = levelId;
    }
    SaveManager.save(data);
  }

  static setStars(levelId: number, stars: number): void {
    const data = SaveManager.load();
    const prev = data.levelStars[levelId] ?? 0;
    if (stars > prev) {
      data.levelStars[levelId] = stars;
    }
    SaveManager.save(data);
  }

  static saveBattleSnapshot(snapshot: BattleSnapshot): void {
    const data = SaveManager.load();
    data.battleSnapshot = snapshot;
    SaveManager.save(data);
  }

  static loadBattleSnapshot(): BattleSnapshot | null {
    const data = SaveManager.load();
    return data.battleSnapshot ?? null;
  }

  static clearBattleSnapshot(): void {
    const data = SaveManager.load();
    if (data.battleSnapshot) {
      delete data.battleSnapshot;
      SaveManager.save(data);
    }
  }

  static resetAll(): void {
    const current = safeGetItem(SaveManager.KEY);
    if (current) {
      safeSetItem(`${BACKUP_KEYS.manualPrefix}${Date.now()}`, current);
    }
    SaveManager.save(SaveManager.getDefaults());
  }

  static listBackupKeys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k === SaveManager.KEY || k.startsWith('tower-defender-save-backup'))) {
          keys.push(k);
        }
      }
    } catch {
      /* ignore */
    }
    return keys;
  }
}
