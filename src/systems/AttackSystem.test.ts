/**
 * AttackSystem 测试 — P1-#12 弹道层级穿透规则
 *
 * 对应设计文档:
 * - design/18-layer-system.md §5.2 攻击目标可达性矩阵
 * - design/18-layer-system.md §5.3 实现方式 (isRanged 字段)
 */
import { describe, it, expect } from 'vitest';
import { AttackSystem } from './AttackSystem.js';
import { LayerVal } from '../core/components.js';

describe('AttackSystem.canAttackLayer (P1-#12)', () => {
  describe('Ground attacker', () => {
    it('近战地面单位可以攻击 Ground 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.Ground, false)).toBe(true);
    });

    it('近战地面单位可以攻击 AboveGrid 目标 (地刺)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.AboveGrid, false)).toBe(true);
    });

    it('近战地面单位无法攻击 LowAir 目标 (飞行敌)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.LowAir, false)).toBe(false);
    });

    it('远程地面塔可以攻击 LowAir 目标 (飞行敌)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.LowAir, true)).toBe(true);
    });

    it('远程地面塔可以攻击 Ground 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.Ground, true)).toBe(true);
    });

    it('远程地面塔无法攻击 Space 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.Space, true)).toBe(false);
    });

    it('远程地面塔无法攻击 BelowGrid 目标 (地下层)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.BelowGrid, true)).toBe(false);
    });

    it('近战地面单位无法攻击 BelowGrid 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.BelowGrid, false)).toBe(false);
    });
  });

  describe('AboveGrid attacker (陷阱)', () => {
    it('近战 AboveGrid 单位可攻击同层目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.AboveGrid, LayerVal.AboveGrid, false)).toBe(true);
    });

    it('近战 AboveGrid 单位无法攻击 LowAir 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.AboveGrid, LayerVal.LowAir, false)).toBe(false);
    });

    it('远程 AboveGrid 单位可攻击 LowAir 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.AboveGrid, LayerVal.LowAir, true)).toBe(true);
    });
  });

  describe('LowAir attacker (蝙蝠、飞行敌)', () => {
    it('LowAir 单位可攻击 LowAir 同层目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.LowAir, false)).toBe(true);
    });

    it('LowAir 单位可攻击 Ground 目标 (俯冲)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Ground, false)).toBe(true);
    });

    it('LowAir 单位可攻击 AboveGrid 目标 (俯冲)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.AboveGrid, false)).toBe(true);
    });

    it('LowAir 单位无法攻击 Space 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Space, true)).toBe(false);
    });

    it('LowAir 单位的 isRanged 不改变可达性 (LowAir 平台优势)', () => {
      const meleeReach = AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Ground, false);
      const rangedReach = AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Ground, true);
      expect(meleeReach).toBe(rangedReach);
    });
  });

  describe('未知层级 (Abyss/Space)', () => {
    it('Abyss 攻击者默认放行 (未来扩展点)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Abyss, LayerVal.Ground, true)).toBe(true);
    });

    it('Space 攻击者默认放行 (未来扩展点)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Space, LayerVal.Ground, true)).toBe(true);
    });
  });

  describe('回归保护 — design/18 §5.2 矩阵全表', () => {
    const cases: Array<[number, number, boolean, boolean, string]> = [
      [LayerVal.Ground, LayerVal.Ground, false, true, 'Ground 近战 → Ground'],
      [LayerVal.Ground, LayerVal.AboveGrid, false, true, 'Ground 近战 → AboveGrid'],
      [LayerVal.Ground, LayerVal.LowAir, false, false, 'Ground 近战 → LowAir (禁)'],
      [LayerVal.Ground, LayerVal.LowAir, true, true, 'Ground 远程 → LowAir'],
      [LayerVal.Ground, LayerVal.Space, true, false, 'Ground 远程 → Space (禁)'],
      [LayerVal.LowAir, LayerVal.Ground, false, true, 'LowAir → Ground'],
      [LayerVal.LowAir, LayerVal.LowAir, false, true, 'LowAir → LowAir'],
      [LayerVal.LowAir, LayerVal.Space, true, false, 'LowAir → Space (禁)'],
    ];

    for (const [attacker, target, ranged, expected, name] of cases) {
      it(name, () => {
        expect(AttackSystem.canAttackLayer(attacker, target, ranged)).toBe(expected);
      });
    }
  });
});
