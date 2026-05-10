/**
 * EconomySystem 集成测试 — 金币/能量/人口经济逻辑（纯逻辑，无实体依赖）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../src/core/World.js';
import { EconomySystem } from '../src/systems/EconomySystem.js';

describe('EconomySystem — 资源管理', () => {
  let world: TowerWorld;
  let economy: EconomySystem;

  beforeEach(() => {
    world = new TowerWorld();
    economy = new EconomySystem();
    world.registerSystem(economy);
  });

  it('初始状态: gold=200, energy=50, population=0', () => {
    expect(economy.gold).toBe(200);
    expect(economy.energy).toBe(50);
    expect(economy.population).toBe(0);
  });

  it('addGold 累积到 pendingGold，update 后结算', () => {
    economy.addGold(50);
    expect(economy.gold).toBe(200);
    world.update(0.016);
    expect(economy.gold).toBe(250);
  });

  it('spendGold 充足时立即结算，返回 true', () => {
    const result = economy.spendGold(150);
    expect(result).toBe(true);
    expect(economy.gold).toBe(50);
  });

  it('spendGold 优先消耗 pendingGold', () => {
    economy.addGold(100);
    const result = economy.spendGold(80);
    expect(result).toBe(true);
    expect(economy.gold).toBe(200);
    world.update(0.016);
    expect(economy.gold).toBe(220);
  });

  it('spendGold 不足时返回 false，余额不变', () => {
    const result = economy.spendGold(250);
    expect(result).toBe(false);
    expect(economy.gold).toBe(200);
  });

  it('spendEnergy 充足时立即结算，返回 true', () => {
    const result = economy.spendEnergy(30);
    expect(result).toBe(true);
    expect(economy.energy).toBe(20);
  });

  it('spendEnergy 不足时返回 false', () => {
    const result = economy.spendEnergy(60);
    expect(result).toBe(false);
    expect(economy.energy).toBe(50);
  });

  it('addEnergy 累积到 pendingEnergy，update 后结算', () => {
    economy.addEnergy(30);
    expect(economy.energy).toBe(50);
    world.update(0.016);
    expect(economy.energy).toBe(80);
  });

  it('canDeployUnit 检查人口空间', () => {
    expect(economy.canDeployUnit(3)).toBe(true);
    expect(economy.canDeployUnit(10)).toBe(false);
  });

  it('deployUnit 增加人口', () => {
    economy.deployUnit(3);
    expect(economy.population).toBe(3);
    expect(economy.canDeployUnit(3)).toBe(true);
    expect(economy.canDeployUnit(4)).toBe(false);
  });

  it('releaseUnit 减少人口，不低于 0', () => {
    economy.deployUnit(3);
    economy.releaseUnit(1);
    expect(economy.population).toBe(2);
    economy.releaseUnit(5);
    expect(economy.population).toBe(0);
  });

  it('maxPopulation 可动态调整', () => {
    economy.maxPopulation = 10;
    economy.deployUnit(8);
    expect(economy.population).toBe(8);
  });

  it('无尽模式 addEndlessKillScore 累加分数', () => {
    economy.isEndless = true;
    economy.addEndlessKillScore(10, 3);
    expect(economy.endlessScore).toBe(30);
    economy.addEndlessKillScore(5, 2);
    expect(economy.endlessScore).toBe(40);
  });

  it('非无尽模式不累加分数', () => {
    economy.isEndless = false;
    economy.addEndlessKillScore(10, 3);
    expect(economy.endlessScore).toBe(0);
  });

  it('update 结算 pendingGold 和 pendingEnergy', () => {
    economy.addGold(100);
    economy.addEnergy(50);
    world.update(0.016);
    expect(economy.gold).toBe(300);
    expect(economy.energy).toBe(100);
  });
});
