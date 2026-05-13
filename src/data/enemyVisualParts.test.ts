import { describe, it, expect } from 'vitest';
import { ENEMY_CONFIGS } from './gameData.js';
import { EnemyType } from '../types/index.js';

describe('ENEMY_CONFIGS — 阶段2A 杂兵 visualParts 合约', () => {
  describe('Grunt 小兵', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Grunt];

    it('应该配置 visualParts（眼睛 + 武器 + 头巾）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.eyes).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
      expect(cfg.visualParts?.bodyParts).toBeDefined();
    });

    it('身体形状为 circle（敌人圆形基调）', () => {
      expect(cfg.shape).toBe('circle');
    });

    it('攻击动画时长合理（0.2 - 0.8 秒，符合杂兵节奏）', () => {
      expect(cfg.attackAnimDuration).toBeGreaterThan(0.2);
      expect(cfg.attackAnimDuration).toBeLessThan(0.8);
    });

    it('武器挥砍幅度（swingAngle）大于 0.5 弧度（明显可见）', () => {
      expect(cfg.visualParts?.weapon?.swingAngle).toBeGreaterThan(0.5);
    });
  });

  describe('Runner 快兵', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Runner];

    it('应该配置 visualParts', () => {
      expect(cfg.visualParts).toBeDefined();
    });

    it('攻击动画比 Grunt 短（更敏捷）', () => {
      const runnerDur = cfg.attackAnimDuration ?? 999;
      const gruntDur = ENEMY_CONFIGS[EnemyType.Grunt].attackAnimDuration ?? 0;
      expect(runnerDur).toBeLessThan(gruntDur);
    });

    it('挥砍幅度大于 Grunt（细身快速挥砍）', () => {
      const runnerSwing = cfg.visualParts?.weapon?.swingAngle ?? 0;
      const gruntSwing = ENEMY_CONFIGS[EnemyType.Grunt].visualParts?.weapon?.swingAngle ?? 999;
      expect(runnerSwing).toBeGreaterThan(gruntSwing);
    });
  });

  describe('Exploder 自爆虫', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Exploder];

    it('应该配置 visualParts（眼睛 + bodyParts，但没有武器）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.eyes).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeUndefined();
      expect(cfg.visualParts?.bodyParts).toBeDefined();
    });

    it('attackAnimDuration === 0（自爆无近战武器，禁用挥砍动画）', () => {
      expect(cfg.attackAnimDuration).toBe(0);
    });

    it('bodyParts 至少 6 个尖刺（视觉上的"危险"暗示）', () => {
      const parts = cfg.visualParts?.bodyParts ?? [];
      const triangles = parts.filter((p) => p.shape === 'triangle');
      expect(triangles.length).toBeGreaterThanOrEqual(6);
    });

    it('瞳孔为红色（暗示燃烧引信 / 死亡威胁）', () => {
      const pupilColor = cfg.visualParts?.eyes?.pupilColor ?? '';
      expect(pupilColor.toLowerCase()).toMatch(/^#(ff|f)/);
    });
  });

  describe('Visual 部件偏移合法性（避免越界绘制）', () => {
    const enemies: EnemyType[] = [EnemyType.Grunt, EnemyType.Runner, EnemyType.Exploder];

    enemies.forEach((type) => {
      it(`${type}: bodyParts 所有 offset 在 ±radius*2 范围内（合理装饰位置）`, () => {
        const cfg = ENEMY_CONFIGS[type];
        const r = cfg.radius;
        const parts = cfg.visualParts?.bodyParts ?? [];
        for (const part of parts) {
          expect(Math.abs(part.offsetX)).toBeLessThanOrEqual(r * 2);
          expect(Math.abs(part.offsetY)).toBeLessThanOrEqual(r * 2);
        }
      });
    });
  });
});
