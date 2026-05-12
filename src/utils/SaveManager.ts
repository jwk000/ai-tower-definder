/**
 * SaveManager v1.1 — design/13-save-system.md
 *
 * 改动 (P2-#17):
 * - version: number → string (semver-like, e.g. "1.1.0")
 * - 写入前 CRC32 校验和
 * - 多层备份: session / daily / version-migration / manual
 * - 版本迁移注册表
 * - 损坏检测 + 备份链恢复
 *
 * 向后兼容: load/save/unlockLevel/setStars/resetAll/getDefaults 公共 API 不变；
 * 旧 number-version 存档自动迁移到 v1.1.0。
 */

import { crc32 } from './crc32.js';

export interface SaveData {
  version: string;
  unlockedLevels: number;
  levelStars: Record<number, number>;
  highScores: Record<number, number>;
  totalGold: number;
  checksum?: string;
  updatedAt?: number;
}

export const CURRENT_VERSION = '1.1.0';

export const BACKUP_KEYS = {
  session: 'tower-defender-save-backup-session',
  daily: 'tower-defender-save-backup-daily',
  dailyTimestamp: 'tower-defender-save-backup-daily-ts',
  versionPrefix: 'tower-defender-save-backup-v',
  manualPrefix: 'tower-defender-save-backup-manual-',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Migration {
  from: string | number;
  to: string;
  migrate: (data: any) => SaveData;
}

const MIGRATIONS: Migration[] = [
  {
    from: 1,
    to: CURRENT_VERSION,
    migrate: (data: any): SaveData => ({
      version: CURRENT_VERSION,
      unlockedLevels: data.unlockedLevels ?? 1,
      levelStars: data.levelStars ?? {},
      highScores: data.highScores ?? {},
      totalGold: data.totalGold ?? 0,
    }),
  },
];

function canMigrate(fromVersion: string | number): boolean {
  return MIGRATIONS.some((m) => m.from === fromVersion);
}

function runMigration(data: any): SaveData | null {
  const m = MIGRATIONS.find((mig) => mig.from === data.version);
  if (!m) return null;
  try {
    return m.migrate(data);
  } catch {
    return null;
  }
}

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
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
    return {
      version: CURRENT_VERSION,
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

  /** Attempt to load a specific key; migrate if old version; null on parse/checksum failure. */
  private static tryLoadKey(key: string): SaveData | null {
    const raw = safeGetItem(key);
    if (!raw) return null;
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.version === CURRENT_VERSION) {
      if (!verifyChecksum(parsed)) return null;
      return SaveManager.normalize(parsed);
    }

    if (canMigrate(parsed.version)) {
      SaveManager.backupBeforeMigration(parsed.version, raw);
      const migrated = runMigration(parsed);
      if (migrated) {
        SaveManager.save(migrated);
        return migrated;
      }
    }

    return null;
  }

  /** Persist with checksum + cascading backups (session every save, daily once/24h). */
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
  private static normalize(data: any): SaveData {
    const defaults = SaveManager.getDefaults();
    return {
      version: data.version ?? defaults.version,
      unlockedLevels: typeof data.unlockedLevels === 'number' ? data.unlockedLevels : defaults.unlockedLevels,
      levelStars: { ...defaults.levelStars, ...(data.levelStars ?? {}) },
      highScores: { ...defaults.highScores, ...(data.highScores ?? {}) },
      totalGold: typeof data.totalGold === 'number' ? data.totalGold : defaults.totalGold,
      checksum: data.checksum,
      updatedAt: data.updatedAt,
    };
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

  /** Reset with manual backup snapshot (timestamped). */
  static resetAll(): void {
    const current = safeGetItem(SaveManager.KEY);
    if (current) {
      safeSetItem(`${BACKUP_KEYS.manualPrefix}${Date.now()}`, current);
    }
    SaveManager.save(SaveManager.getDefaults());
  }

  /** Test/diagnostic helper — list all save-related keys present in storage. */
  static listBackupKeys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k === SaveManager.KEY || k.startsWith('tower-defender-save-backup'))) {
          keys.push(k);
        }
      }
    } catch { /* ignore */ }
    return keys;
  }
}
