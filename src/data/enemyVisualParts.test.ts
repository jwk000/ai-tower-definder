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
    const enemies: EnemyType[] = [
      EnemyType.Grunt, EnemyType.Runner, EnemyType.Exploder,
      EnemyType.Heavy, EnemyType.Juggernaut,
      EnemyType.Mage, EnemyType.Shaman, EnemyType.HotAirBalloon,
      EnemyType.BossCommander, EnemyType.BossBeast,
    ];

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

  describe('Heavy 重装兵', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Heavy];

    it('应该配置 visualParts（厚甲 + 大锤 + 黑瞳愤怒眼）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.eyes).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
      expect(cfg.visualParts?.bodyParts?.length).toBeGreaterThanOrEqual(4);
    });

    it('攻击动画偏慢（>0.4 秒，体现笨重感）', () => {
      expect(cfg.attackAnimDuration).toBeGreaterThan(0.4);
    });

    it('武器宽度 >= 5（大锤粗壮）', () => {
      expect(cfg.visualParts?.weapon?.width ?? 0).toBeGreaterThanOrEqual(5);
    });

    it('武器 restAngle > 0（自然下垂指向地面）', () => {
      expect(cfg.visualParts?.weapon?.restAngle ?? -1).toBeGreaterThan(0);
    });
  });

  describe('Juggernaut 铁甲巨兽', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Juggernaut];

    it('应该配置 visualParts（牛角 + 厚甲 + 巨锤 + 红凶眼）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
      expect(cfg.visualParts?.bodyParts?.length).toBeGreaterThanOrEqual(6);
    });

    it('武器长度 > Heavy（巨型更醒目）', () => {
      const jugLen = cfg.visualParts?.weapon?.length ?? 0;
      const heavyLen = ENEMY_CONFIGS[EnemyType.Heavy].visualParts?.weapon?.length ?? 999;
      expect(jugLen).toBeGreaterThan(heavyLen);
    });

    it('包含至少 2 个 triangle（左右对称牛角）', () => {
      const triangles = (cfg.visualParts?.bodyParts ?? []).filter((p) => p.shape === 'triangle');
      expect(triangles.length).toBeGreaterThanOrEqual(2);
    });

    it('瞳孔为红色（凶猛威胁感）', () => {
      const pupilColor = cfg.visualParts?.eyes?.pupilColor ?? '';
      expect(pupilColor.toLowerCase()).toMatch(/^#(d|e|f)/);
    });
  });

  describe('Mage 法师', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Mage];

    it('应该配置 visualParts（法杖发蓝光 + 法师帽斗篷）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
      expect(cfg.visualParts?.bodyParts).toBeDefined();
    });

    it('武器有蓝色光晕（魔法主题）', () => {
      const w = cfg.visualParts?.weapon;
      expect(w?.glowColor?.toLowerCase()).toMatch(/^#(0|1|2|3|4|5|6)/);
      expect(w?.glowRadius ?? 0).toBeGreaterThan(0);
    });

    it('包含 triangle bodyPart（法师帽）', () => {
      const triangles = (cfg.visualParts?.bodyParts ?? []).filter((p) => p.shape === 'triangle');
      expect(triangles.length).toBeGreaterThanOrEqual(1);
    });

    it('eyes scleraRadius === 0（闭眼冥想感）', () => {
      expect(cfg.visualParts?.eyes?.scleraRadius).toBe(0);
    });
  });

  describe('Shaman 萨满', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Shaman];

    it('应该配置 visualParts（法杖绿光 + 头骨 + 黄瞳）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
    });

    it('武器光晕为绿色（治疗主题）', () => {
      const glow = cfg.visualParts?.weapon?.glowColor?.toLowerCase() ?? '';
      expect(glow).toMatch(/^#(4|5|6|7|8)/);
    });

    it('瞳孔为黄色（神秘部族感）', () => {
      const pupilColor = cfg.visualParts?.eyes?.pupilColor?.toLowerCase() ?? '';
      expect(pupilColor).toMatch(/^#(f|e)/);
    });
  });

  describe('HotAirBalloon 热气球', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.HotAirBalloon];

    it('应该配置 visualParts（无眼睛 + 无武器 + 浮空风格）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.eyes).toBeUndefined();
      expect(cfg.visualParts?.weapon).toBeUndefined();
      expect(cfg.visualParts?.bodyParts).toBeDefined();
    });

    it('bobStyle 为 floating（Y 方向飘浮，无 X 摇摆）', () => {
      expect(cfg.visualParts?.bobStyle).toBe('floating');
    });

    it('attackAnimDuration === 0（无近战武器，禁用挥砍）', () => {
      expect(cfg.attackAnimDuration).toBe(0);
    });

    it('bodyParts 至少 4 个（绳索 + 篮子 + 炸弹 + 火焰组合）', () => {
      expect(cfg.visualParts?.bodyParts?.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('BossCommander 指挥官', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.BossCommander];

    it('应该配置 visualParts（金权杖 + 王冠 + 护肩）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.eyes).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
      expect(cfg.visualParts?.bodyParts?.length).toBeGreaterThanOrEqual(5);
    });

    it('武器有金色光晕（统帅气场）', () => {
      const glow = cfg.visualParts?.weapon?.glowColor?.toLowerCase() ?? '';
      expect(glow).toMatch(/^#(f|e)/);
    });

    it('王冠由 triangle 组成（至少 3 个）', () => {
      const triangles = (cfg.visualParts?.bodyParts ?? []).filter((p) => p.shape === 'triangle');
      expect(triangles.length).toBeGreaterThanOrEqual(3);
    });

    it('武器长度 > 任何非 Boss 敌人（统帅级武器）', () => {
      const cmdLen = cfg.visualParts?.weapon?.length ?? 0;
      const heavyLen = ENEMY_CONFIGS[EnemyType.Heavy].visualParts?.weapon?.length ?? 0;
      const jugLen = ENEMY_CONFIGS[EnemyType.Juggernaut].visualParts?.weapon?.length ?? 0;
      expect(cmdLen).toBeGreaterThan(heavyLen);
      expect(cmdLen).toBeGreaterThan(jugLen);
    });
  });

  describe('BossBeast 攻城兽', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.BossBeast];

    it('应该配置 visualParts（獠牙 + 背刺 + 重甲 + 巨锤）', () => {
      expect(cfg.visualParts).toBeDefined();
      expect(cfg.visualParts?.weapon).toBeDefined();
      expect(cfg.visualParts?.bodyParts?.length).toBeGreaterThanOrEqual(8);
    });

    it('包含至少 5 个 triangle（多獠牙 + 多背刺 + 头顶尖刺）', () => {
      const triangles = (cfg.visualParts?.bodyParts ?? []).filter((p) => p.shape === 'triangle');
      expect(triangles.length).toBeGreaterThanOrEqual(5);
    });

    it('攻击动画比任何其他敌人都慢（巨兽笨重）', () => {
      const beastDur = cfg.attackAnimDuration ?? 0;
      const allOthers: EnemyType[] = [
        EnemyType.Grunt, EnemyType.Runner, EnemyType.Exploder,
        EnemyType.Heavy, EnemyType.Juggernaut,
        EnemyType.Mage, EnemyType.Shaman,
        EnemyType.BossCommander,
      ];
      for (const other of allOthers) {
        const otherDur = ENEMY_CONFIGS[other].attackAnimDuration ?? 0;
        expect(beastDur).toBeGreaterThan(otherDur);
      }
    });

    it('武器宽度 >= 8（巨锤粗壮）', () => {
      expect(cfg.visualParts?.weapon?.width ?? 0).toBeGreaterThanOrEqual(8);
    });
  });
});
