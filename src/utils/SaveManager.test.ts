/**
 * SaveManager v1.1 测试 — design/13-save-system.md
 * - §1 存档数据结构
 * - §3 星级评定（取历史最佳、不降级）
 * - §4 连锁解锁
 * - §5 版本兼容与数据迁移 (P2-#17)
 * - §6 损坏恢复 (CRC32 + 多层备份)
 * - §7 重置
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager, CURRENT_VERSION, BACKUP_KEYS, type SaveData } from './SaveManager.js';
import { crc32 } from './crc32.js';

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
});

describe('SaveManager v1.1', () => {
  describe('getDefaults', () => {
    it('返回默认初始状态', () => {
      const defaults = SaveManager.getDefaults();
      expect(defaults.version).toBe(CURRENT_VERSION);
      expect(defaults.unlockedLevels).toBe(1);
      expect(defaults.levelStars).toEqual({});
      expect(defaults.highScores).toEqual({});
      expect(defaults.totalGold).toBe(0);
    });
  });

  describe('load', () => {
    it('无存档时返回默认值', () => {
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1);
      expect(data.version).toBe(CURRENT_VERSION);
    });

    it('正确加载已保存数据', () => {
      const original = {
        version: CURRENT_VERSION,
        unlockedLevels: 3,
        levelStars: { 1: 2, 2: 1 },
        highScores: { 1: 5000 },
        totalGold: 999,
      };
      SaveManager.save(original as unknown as SaveData);
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(3);
      expect(data.levelStars[1]).toBe(2);
      expect(data.levelStars[2]).toBe(1);
      expect(data.highScores[1]).toBe(5000);
      expect(data.totalGold).toBe(999);
    });

    it('部分字段缺失时合并默认值', () => {
      const partial = {
        version: CURRENT_VERSION,
        unlockedLevels: 2,
      };
      SaveManager.save(partial as any);
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(2);
      expect(data.levelStars).toEqual({});
      expect(data.totalGold).toBe(0);
    });
  });

  describe('save', () => {
    it('保存数据到 localStorage', () => {
      const data = SaveManager.getDefaults();
      data.unlockedLevels = 2;
      SaveManager.save(data);
      expect(store[SaveManager.KEY]).toBeDefined();
      const loaded = JSON.parse(store[SaveManager.KEY]!);
      expect(loaded.unlockedLevels).toBe(2);
    });

    it('保存时写入 checksum 与 updatedAt', () => {
      SaveManager.save(SaveManager.getDefaults());
      const raw = JSON.parse(store[SaveManager.KEY]!);
      expect(typeof raw.checksum).toBe('string');
      expect(raw.checksum.length).toBeGreaterThan(0);
      expect(typeof raw.updatedAt).toBe('number');
    });
  });

  describe('unlockLevel', () => {
    it('解锁新关卡', () => {
      SaveManager.unlockLevel(2);
      expect(SaveManager.load().unlockedLevels).toBe(2);
    });

    it('不会降级已解锁关卡', () => {
      SaveManager.unlockLevel(3);
      SaveManager.unlockLevel(1);
      expect(SaveManager.load().unlockedLevels).toBe(3);
    });
  });

  describe('setStars', () => {
    it('设置关卡星级', () => {
      SaveManager.setStars(1, 2);
      expect(SaveManager.load().levelStars[1]).toBe(2);
    });

    it('取历史最佳 — 更高星级覆盖', () => {
      SaveManager.setStars(1, 2);
      SaveManager.setStars(1, 3);
      expect(SaveManager.load().levelStars[1]).toBe(3);
    });

    it('取历史最佳 — 低星级不覆盖高星级', () => {
      SaveManager.setStars(1, 3);
      SaveManager.setStars(1, 1);
      expect(SaveManager.load().levelStars[1]).toBe(3);
    });
  });

  describe('resetAll', () => {
    it('重置所有进度到默认', () => {
      SaveManager.unlockLevel(3);
      SaveManager.setStars(1, 3);
      SaveManager.resetAll();
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1);
      expect(data.levelStars).toEqual({});
    });

    it('重置前创建带时间戳的手动备份', () => {
      SaveManager.unlockLevel(3);
      SaveManager.resetAll();
      const keys = SaveManager.listBackupKeys();
      const manualBackups = keys.filter((k) => k.startsWith(BACKUP_KEYS.manualPrefix));
      expect(manualBackups.length).toBe(1);
    });
  });

  // ============================================================
  // P2-#17 v1.1 新增覆盖
  // ============================================================
  describe('CRC32 损坏检测', () => {
    it('checksum 不匹配 → 视为损坏，回退默认值', () => {
      const tampered = {
        version: CURRENT_VERSION,
        unlockedLevels: 99,
        levelStars: {},
        highScores: {},
        totalGold: 0,
        checksum: 'deadbeef',
      };
      store[SaveManager.KEY] = JSON.stringify(tampered);
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1);
    });

    it('JSON 损坏 → 回退默认值', () => {
      store[SaveManager.KEY] = '{ not json at all';
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1);
    });

    it('checksum 正确 → 正常加载', () => {
      const data = SaveManager.getDefaults();
      data.unlockedLevels = 4;
      SaveManager.save(data);
      const loaded = SaveManager.load();
      expect(loaded.unlockedLevels).toBe(4);
    });
  });

  describe('多层备份策略', () => {
    it('每次保存生成 session 备份', () => {
      SaveManager.unlockLevel(2);
      SaveManager.unlockLevel(3);
      const sessionRaw = store[BACKUP_KEYS.session];
      expect(sessionRaw).toBeDefined();
      const parsed = JSON.parse(sessionRaw!);
      expect(parsed.unlockedLevels).toBe(2); // 上一次的快照
    });

    it('首次保存创建 daily 备份并记录时间戳', () => {
      SaveManager.unlockLevel(2);
      SaveManager.unlockLevel(3);
      expect(store[BACKUP_KEYS.dailyTimestamp]).toBeDefined();
    });

    it('当前存档损坏 → 从 session 备份恢复', () => {
      SaveManager.unlockLevel(2);
      SaveManager.unlockLevel(3);
      const goodSessionBackup = store[BACKUP_KEYS.session]!;
      store[SaveManager.KEY] = '{ corrupted }';
      store[BACKUP_KEYS.session] = goodSessionBackup;
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(2);
    });

    it('listBackupKeys 列出所有存档相关键', () => {
      SaveManager.unlockLevel(2);
      SaveManager.unlockLevel(3);
      const keys = SaveManager.listBackupKeys();
      expect(keys).toContain(SaveManager.KEY);
      expect(keys).toContain(BACKUP_KEYS.session);
    });
  });

  describe('版本迁移', () => {
    it('v1 (number version) 存档自动迁移到 v1.1.0', () => {
      const legacyV1 = {
        version: 1,
        unlockedLevels: 4,
        levelStars: { 1: 3, 2: 2 },
        highScores: { 1: 1000 },
        totalGold: 500,
      };
      store[SaveManager.KEY] = JSON.stringify(legacyV1);
      const data = SaveManager.load();
      expect(data.version).toBe(CURRENT_VERSION);
      expect(data.unlockedLevels).toBe(4);
      expect(data.levelStars[1]).toBe(3);
      expect(data.totalGold).toBe(500);
    });

    it('迁移前保存到 version 备份键', () => {
      const legacyV1 = {
        version: 1,
        unlockedLevels: 2,
        levelStars: {},
        highScores: {},
        totalGold: 100,
      };
      store[SaveManager.KEY] = JSON.stringify(legacyV1);
      SaveManager.load();
      expect(store[`${BACKUP_KEYS.versionPrefix}1`]).toBeDefined();
    });

    it('未知 version + 无备份 → 回退默认值', () => {
      store[SaveManager.KEY] = JSON.stringify({
        version: '99.0.0',
        unlockedLevels: 5,
      });
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1);
    });
  });

  describe('checksum 一致性', () => {
    it('相同数据多次保存的 checksum 相同（不含 updatedAt 漂移外）', () => {
      const a = SaveManager.getDefaults();
      const ca = crc32(JSON.stringify({ ...a, checksum: '' })).toString(16);
      const cb = crc32(JSON.stringify({ ...a, checksum: '' })).toString(16);
      expect(ca).toBe(cb);
    });
  });

  // ============================================================
  // P2-#17 v1.1 第 2 轮 — BattleSnapshot 持久化 (design/13 §1)
  // ============================================================
  describe('BattleSnapshot', () => {
    // JSON 不能往返 ±Infinity (序列化为 null)，因此 sample 使用有限数值确保 deep-equal
    const sampleSnapshot = {
      levelId: 2,
      currentWave: 3,
      gameTime: 45.5,
      prngStates: { seed: 12345, map: 1, wave: 2, drop: 3, decor: 4 },
      economy: {
        gold: 500,
        energy: 80,
        population: 4,
        maxPopulation: 6,
        refundMeta: [[10, { buildTime: 0, lastDamageTime: 0, lastAttackTime: 0, everInCombat: false, refundRatio: 0.5, totalCost: 100 }]] as Array<[number, any]>,
      },
    };

    it('无快照时 loadBattleSnapshot → null', () => {
      expect(SaveManager.loadBattleSnapshot()).toBeNull();
    });

    it('saveBattleSnapshot + loadBattleSnapshot 往返一致', () => {
      SaveManager.saveBattleSnapshot(sampleSnapshot);
      const loaded = SaveManager.loadBattleSnapshot();
      expect(loaded).toEqual(sampleSnapshot);
    });

    it('battleSnapshot 参与 checksum，篡改后被检测', () => {
      SaveManager.saveBattleSnapshot(sampleSnapshot);
      const raw = JSON.parse(store[SaveManager.KEY]!);
      raw.battleSnapshot.economy.gold = 999_999;
      store[SaveManager.KEY] = JSON.stringify(raw);
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1); // 损坏 → 默认值
      expect(data.battleSnapshot).toBeUndefined();
    });

    it('clearBattleSnapshot 移除快照但保留其他存档字段', () => {
      SaveManager.unlockLevel(3);
      SaveManager.saveBattleSnapshot(sampleSnapshot);
      SaveManager.clearBattleSnapshot();
      const data = SaveManager.load();
      expect(data.battleSnapshot).toBeUndefined();
      expect(data.unlockedLevels).toBe(3);
    });

    it('clearBattleSnapshot 在无快照时静默忽略', () => {
      expect(() => SaveManager.clearBattleSnapshot()).not.toThrow();
    });

    it('正常存档操作不影响已存在的 battleSnapshot', () => {
      SaveManager.saveBattleSnapshot(sampleSnapshot);
      SaveManager.unlockLevel(4);
      const loaded = SaveManager.loadBattleSnapshot();
      expect(loaded).toEqual(sampleSnapshot);
    });
  });

  describe('abandon 路径契约（验收：进入关卡显示配置金币）', () => {
    const staleSnapshot = {
      levelId: 1,
      currentWave: 2,
      gameTime: 30,
      prngStates: { seed: 1, map: 0, wave: 0, drop: 0, decor: 0 },
      economy: {
        gold: 10,
        energy: 0,
        population: 0,
        maxPopulation: 6,
        refundMeta: [] as Array<[number, any]>,
      },
    };

    it('用户主动 abandon 后再次进入同关卡，loadBattleSnapshot 返回 null（不会用 10G 覆盖配置 220G）', () => {
      SaveManager.saveBattleSnapshot(staleSnapshot);
      expect(SaveManager.loadBattleSnapshot()).not.toBeNull();

      SaveManager.clearBattleSnapshot();

      expect(SaveManager.loadBattleSnapshot()).toBeNull();
    });

    it('beforeunload 后未 abandon 直接重进，仍能恢复 snapshot（保留 design/13 意外恢复能力）', () => {
      SaveManager.saveBattleSnapshot(staleSnapshot);
      const restored = SaveManager.loadBattleSnapshot();
      expect(restored).not.toBeNull();
      expect(restored?.economy.gold).toBe(10);
    });
  });
});
