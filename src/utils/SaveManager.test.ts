/**
 * 存档系统测试 — SaveManager
 * 
 * 对应设计文档: design/13-save-system.md
 * - §1 存档数据结构（版本号、关卡解锁、星级、高分）
 * - §3 星级评定（取历史最佳、不降级）
 * - §4 连锁解锁
 * - §5 重置
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager.js';

// Mock localStorage
const store: Record<string, string> = {};

beforeEach(() => {
  // 清空 mock store
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  // Mock localStorage
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    length: 0,
    key: () => null,
  } as Storage;
});

describe('SaveManager', () => {
  describe('getDefaults', () => {
    it('返回默认初始状态', () => {
      const defaults = SaveManager.getDefaults();
      expect(defaults.version).toBe(1);
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
      expect(data.version).toBe(1);
    });

    it('版本不匹配时返回默认值', () => {
      store[SaveManager.KEY] = JSON.stringify({
        version: 999,
        unlockedLevels: 5,
        levelStars: {},
      });
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(1); // 回退到默认
    });

    it('正确加载已保存数据', () => {
      store[SaveManager.KEY] = JSON.stringify({
        version: 1,
        unlockedLevels: 3,
        levelStars: { 1: 2, 2: 1 },
        highScores: { 1: 5000 },
        totalGold: 999,
      });
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(3);
      expect(data.levelStars[1]).toBe(2);
      expect(data.levelStars[2]).toBe(1);
      expect(data.highScores[1]).toBe(5000);
      expect(data.totalGold).toBe(999);
    });

    it('部分字段缺失时合并默认值', () => {
      store[SaveManager.KEY] = JSON.stringify({
        version: 1,
        unlockedLevels: 2,
        // levelStars 缺失
        // totalGold 缺失
      });
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
  });

  describe('unlockLevel', () => {
    it('解锁新关卡', () => {
      SaveManager.unlockLevel(2);
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(2);
    });

    it('不会降级已解锁关卡', () => {
      SaveManager.unlockLevel(3);
      SaveManager.unlockLevel(1); // 尝试"解锁"更低的
      const data = SaveManager.load();
      expect(data.unlockedLevels).toBe(3);
    });
  });

  describe('setStars', () => {
    it('设置关卡星级', () => {
      SaveManager.setStars(1, 2);
      const data = SaveManager.load();
      expect(data.levelStars[1]).toBe(2);
    });

    it('取历史最佳 — 更高星级覆盖', () => {
      SaveManager.setStars(1, 2);
      SaveManager.setStars(1, 3);
      const data = SaveManager.load();
      expect(data.levelStars[1]).toBe(3);
    });

    it('取历史最佳 — 低星级不覆盖高星级', () => {
      SaveManager.setStars(1, 3);
      SaveManager.setStars(1, 1);
      const data = SaveManager.load();
      expect(data.levelStars[1]).toBe(3);
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
  });
});
