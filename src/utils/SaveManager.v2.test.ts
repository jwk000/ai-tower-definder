/**
 * SaveManager v2.0 存档结构测试 (A1.3)
 *
 * 对应设计文档:
 * - design/13-save-system.md §1 存档格式 v2.0.0
 * - design/13-save-system.md §6.2 v1.1 → v2.0 迁移注册表
 * - design/25-card-roguelike-refactor.md §8.1 永久数据
 *
 * 验证 A1.3 范围:
 * - SaveData v2.0 新字段 (CardCollection / OngoingRun / PermanentUpgrades / RunHistory / sparkShards / Achievements / Settings) 存在且默认值正确
 * - getDefaults() 返回完整 v2.0 结构
 * - 保留 v1.1 兼容字段以不破坏既有调用方 (LevelSelectUI / DebugManager / main.ts)
 *
 * A1.4 将补充更详尽的 v1.1 → v2.0 迁移测试场景。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager, CURRENT_VERSION } from './SaveManager.js';

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
});

describe('SaveManager v2.0 — A1.3 结构扩展', () => {
  describe('版本号', () => {
    it('CURRENT_VERSION = "2.0.0"', () => {
      expect(CURRENT_VERSION).toBe('2.0.0');
    });
  });

  describe('getDefaults — v2.0 新字段', () => {
    it('sparkShards 默认 = 0', () => {
      expect(SaveManager.getDefaults().sparkShards).toBe(0);
    });

    it('cardCollection.unlocked 是一个 Record (默认含起步卡池)', () => {
      const defaults = SaveManager.getDefaults();
      expect(defaults.cardCollection).toBeDefined();
      expect(defaults.cardCollection.unlocked).toBeDefined();
      expect(typeof defaults.cardCollection.unlocked).toBe('object');
    });

    it('cardCollection.unlocked 起步含 6-8 张卡 (13 §1.2)', () => {
      const unlocked = SaveManager.getDefaults().cardCollection.unlocked;
      const count = Object.keys(unlocked).length;
      expect(count).toBeGreaterThanOrEqual(6);
      expect(count).toBeLessThanOrEqual(8);
    });

    it('cardCollection 中每张卡都有 CardEntry 完整字段', () => {
      const unlocked = SaveManager.getDefaults().cardCollection.unlocked;
      for (const [cardId, entry] of Object.entries(unlocked)) {
        expect(entry.unlockedAt, `${cardId} unlockedAt`).toBeTypeOf('number');
        expect(entry.baseLevel, `${cardId} baseLevel`).toBe(1);
        expect(entry.totalUsesInRuns, `${cardId} totalUsesInRuns`).toBe(0);
        expect(entry.totalDeploys, `${cardId} totalDeploys`).toBe(0);
      }
    });

    it('permanentUpgrades 含 5 个升级项默认值 (21-MDA §19 + 13 §1.2)', () => {
      const u = SaveManager.getDefaults().permanentUpgrades;
      expect(u.baseHpMax).toBe(1000);
      expect(u.energyMax).toBe(10);
      expect(u.handSizeMax).toBe(4);
      expect(u.unitCapOnField).toBe(8);
      expect(u.startingGold).toBe(0);
    });

    it('runHistory 含 8 个统计字段默认值', () => {
      const h = SaveManager.getDefaults().runHistory;
      expect(h.totalRuns).toBe(0);
      expect(h.totalVictories).toBe(0);
      expect(h.highestLevelReached).toBe(0);
      expect(h.fastestVictoryTimeSeconds).toBe(0);
      expect(h.currentStreak).toBe(0);
      expect(h.longestWinStreak).toBe(0);
      expect(h.totalSparkShardsEarned).toBe(0);
      expect(h.archetypeWins).toEqual({});
    });

    it('ongoingRun 默认 = null', () => {
      expect(SaveManager.getDefaults().ongoingRun).toBeNull();
    });

    it('achievements 含 unlocked + progress 两个空 Record', () => {
      const a = SaveManager.getDefaults().achievements;
      expect(a.unlocked).toEqual({});
      expect(a.progress).toEqual({});
    });

    it('settings 含 sfxVolume / musicVolume / showFPS / preferredLanguage', () => {
      const s = SaveManager.getDefaults().settings;
      expect(s.sfxVolume).toBeGreaterThanOrEqual(0);
      expect(s.sfxVolume).toBeLessThanOrEqual(1);
      expect(s.musicVolume).toBeGreaterThanOrEqual(0);
      expect(s.musicVolume).toBeLessThanOrEqual(1);
      expect(typeof s.showFPS).toBe('boolean');
      expect(s.preferredLanguage).toBe('zh-CN');
    });

    it('totalPlayTimeSeconds / totalKills / totalGoldEarned 默认 = 0', () => {
      const d = SaveManager.getDefaults();
      expect(d.totalPlayTimeSeconds).toBe(0);
      expect(d.totalKills).toBe(0);
      expect(d.totalGoldEarned).toBe(0);
    });

    it('createdAt / updatedAt 为有效时间戳', () => {
      const d = SaveManager.getDefaults();
      expect(d.createdAt).toBeTypeOf('number');
      expect(d.createdAt).toBeGreaterThan(0);
    });
  });

  describe('v1.1 兼容字段保留（不破坏既有调用方）', () => {
    it('unlockedLevels 字段仍存在 (LevelSelectUI/DebugManager 兼容)', () => {
      expect(SaveManager.getDefaults().unlockedLevels).toBe(1);
    });

    it('levelStars 字段仍存在', () => {
      expect(SaveManager.getDefaults().levelStars).toEqual({});
    });

    it('highScores 字段仍存在', () => {
      expect(SaveManager.getDefaults().highScores).toEqual({});
    });

    it('totalGold 字段仍存在', () => {
      expect(SaveManager.getDefaults().totalGold).toBe(0);
    });

    it('v1.1 公共 API setStars 仍工作', () => {
      SaveManager.setStars(1, 3);
      expect(SaveManager.load().levelStars[1]).toBe(3);
    });

    it('v1.1 公共 API unlockLevel 仍工作', () => {
      SaveManager.unlockLevel(5);
      expect(SaveManager.load().unlockedLevels).toBe(5);
    });
  });

  describe('save + load 往返 — v2.0 字段完整保留', () => {
    it('save 写入 v2.0 字段后 load 恢复一致', () => {
      const data = SaveManager.getDefaults();
      data.sparkShards = 500;
      data.runHistory.totalRuns = 3;
      data.runHistory.totalVictories = 1;
      data.permanentUpgrades.energyMax = 11;
      data.cardCollection.unlocked['test_card'] = {
        unlockedAt: 12345,
        baseLevel: 2,
        totalUsesInRuns: 5,
        totalDeploys: 12,
      };
      SaveManager.save(data);

      const reloaded = SaveManager.load();
      expect(reloaded.sparkShards).toBe(500);
      expect(reloaded.runHistory.totalRuns).toBe(3);
      expect(reloaded.runHistory.totalVictories).toBe(1);
      expect(reloaded.permanentUpgrades.energyMax).toBe(11);
      expect(reloaded.cardCollection.unlocked['test_card']).toEqual({
        unlockedAt: 12345,
        baseLevel: 2,
        totalUsesInRuns: 5,
        totalDeploys: 12,
      });
    });

    it('ongoingRun 可保存与恢复 (关间存档点)', () => {
      const data = SaveManager.getDefaults();
      data.ongoingRun = {
        runSeed: 42,
        currentLevel: 3,
        baseHp: 800,
        gold: 250,
        deck: [
          { cardId: 'arrow_tower_card', instanceLevel: 1 },
          { cardId: 'cannon_tower_card', instanceLevel: 2 },
        ],
        startedAt: 1000000,
        elapsedSeconds: 600,
        prngStateMap: 111,
        prngStateWave: 222,
        prngStateShop: 333,
        prngStateMystic: 444,
      };
      SaveManager.save(data);

      const reloaded = SaveManager.load();
      expect(reloaded.ongoingRun).not.toBeNull();
      expect(reloaded.ongoingRun!.runSeed).toBe(42);
      expect(reloaded.ongoingRun!.currentLevel).toBe(3);
      expect(reloaded.ongoingRun!.baseHp).toBe(800);
      expect(reloaded.ongoingRun!.deck).toHaveLength(2);
      expect(reloaded.ongoingRun!.deck[0]!.cardId).toBe('arrow_tower_card');
    });
  });

  describe('v1.1 → v2.0 自动迁移 (13 §6.2)', () => {
    it('v1.1.0 存档加载时自动升级到 v2.0.0', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 5,
        levelStars: { 1: 3, 2: 3, 3: 2 },
        highScores: { 1: 500 },
        totalGold: 1234,
      };
      store['tower-defender-save'] = JSON.stringify(v11Save);

      const migrated = SaveManager.load();
      expect(migrated.version).toBe('2.0.0');
    });

    it('迁移后包含 v2.0 完整新结构 (cardCollection / sparkShards / runHistory 等)', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 1,
        levelStars: {},
        highScores: {},
        totalGold: 0,
      };
      store['tower-defender-save'] = JSON.stringify(v11Save);

      const migrated = SaveManager.load();
      expect(migrated.cardCollection).toBeDefined();
      expect(migrated.cardCollection.unlocked).toBeDefined();
      expect(migrated.permanentUpgrades).toBeDefined();
      expect(migrated.runHistory).toBeDefined();
      expect(migrated.achievements).toBeDefined();
      expect(migrated.settings).toBeDefined();
      expect(migrated.ongoingRun).toBeNull();
    });

    it('迁移补偿: 通关 3 关 → +300 火花碎片 (13 §6.2: 每通关关卡 +100)', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 4,
        levelStars: { 1: 3, 2: 2, 3: 1 },
        highScores: {},
        totalGold: 0,
      };
      store['tower-defender-save'] = JSON.stringify(v11Save);

      const migrated = SaveManager.load();
      expect(migrated.sparkShards).toBe(300);
    });

    it('迁移补偿: 未通关任何关卡 → 0 火花碎片', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 1,
        levelStars: {},
        highScores: {},
        totalGold: 0,
      };
      store['tower-defender-save'] = JSON.stringify(v11Save);

      const migrated = SaveManager.load();
      expect(migrated.sparkShards).toBe(0);
    });

    it('迁移后标记成就 migrated_from_v1_1 (13 §6.2)', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 1,
        levelStars: {},
        highScores: {},
        totalGold: 0,
      };
      store['tower-defender-save'] = JSON.stringify(v11Save);

      const migrated = SaveManager.load();
      expect(migrated.achievements.unlocked['migrated_from_v1_1']).toBeTypeOf('number');
    });

    it('迁移前在 version 备份键保留原存档 (回滚保险)', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 3,
        levelStars: { 1: 3 },
        highScores: {},
        totalGold: 100,
      };
      const rawV11 = JSON.stringify(v11Save);
      store['tower-defender-save'] = rawV11;

      SaveManager.load();
      expect(store['tower-defender-save-backup-v1.1.0']).toBe(rawV11);
    });

    it('迁移后再次 load 不重复迁移 (幂等)', () => {
      const v11Save = {
        version: '1.1.0',
        unlockedLevels: 3,
        levelStars: { 1: 3, 2: 2 },
        highScores: {},
        totalGold: 0,
      };
      store['tower-defender-save'] = JSON.stringify(v11Save);

      const first = SaveManager.load();
      const second = SaveManager.load();
      expect(first.sparkShards).toBe(second.sparkShards);
      expect(first.version).toBe('2.0.0');
      expect(second.version).toBe('2.0.0');
    });
  });
});
