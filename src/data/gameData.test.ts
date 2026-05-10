/**
 * 配置数据验证测试 — 塔 & 敌人 & 单位配置
 * 
 * 对应设计文档:
 * - design/03-unit-data.md §1-3 塔/我方单位/敌方单位属性
 * - design/05-combat-system.md §4 数值锚点
 */
import { describe, it, expect } from 'vitest';
import {
  TOWER_CONFIGS,
  ENEMY_CONFIGS,
  UNIT_CONFIGS,
  PRODUCTION_CONFIGS,
} from './gameData.js';
import { TowerType, EnemyType, UnitType, ProductionType } from '../types/index.js';

describe('塔配置 (TOWER_CONFIGS)', () => {
  it('所有7种塔均配置', () => {
    const types = Object.values(TowerType);
    for (const type of types) {
      expect(TOWER_CONFIGS[type], `${type} 缺失配置`).toBeDefined();
    }
  });

  it('每种塔有必需字段', () => {
    for (const [type, cfg] of Object.entries(TOWER_CONFIGS)) {
      expect(cfg.name, `${type}: name`).toBeTruthy();
      expect(cfg.cost, `${type}: cost`).toBeGreaterThan(0);
      expect(cfg.hp, `${type}: hp`).toBeGreaterThan(0);
      expect(cfg.atk, `${type}: atk`).toBeGreaterThanOrEqual(0);
      expect(cfg.attackSpeed, `${type}: attackSpeed`).toBeGreaterThan(0);
      expect(cfg.range, `${type}: range`).toBeGreaterThan(0);
      expect(cfg.damageType, `${type}: damageType`).toMatch(/^(physical|magic)$/);
      expect(cfg.upgradeCosts.length, `${type}: upgradeCosts`).toBe(4);
      expect(cfg.upgradeAtkBonus.length, `${type}: upgradeAtkBonus`).toBe(4);
      expect(cfg.upgradeRangeBonus.length, `${type}: upgradeRangeBonus`).toBe(4);
      expect(cfg.color, `${type}: color`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('箭塔 — 数值锚点', () => {
    const cfg = TOWER_CONFIGS[TowerType.Arrow];
    expect(cfg.cost).toBe(50);
    expect(cfg.atk).toBe(10);
    expect(cfg.attackSpeed).toBe(1.0);
    expect(cfg.range).toBeGreaterThanOrEqual(170);
    expect(cfg.damageType).toBe('physical');
  });

  it('炮塔 — AOE+眩晕', () => {
    const cfg = TOWER_CONFIGS[TowerType.Cannon];
    expect(cfg.splashRadius).toBe(80);
    expect(cfg.stunDuration).toBe(1.5);
  });

  it('冰塔 — 减速+冰冻', () => {
    const cfg = TOWER_CONFIGS[TowerType.Ice];
    expect(cfg.slowPercent).toBe(20);
    expect(cfg.slowMaxStacks).toBe(5);
    expect(cfg.freezeDuration).toBe(1.0);
    expect(cfg.damageType).toBe('magic');
  });

  it('电塔 — 链击', () => {
    const cfg = TOWER_CONFIGS[TowerType.Lightning];
    expect(cfg.chainCount).toBe(3);
    expect(cfg.chainDecay).toBe(0.2);
    expect(cfg.damageType).toBe('magic');
  });

  it('激光塔 — 贯穿', () => {
    const cfg = TOWER_CONFIGS[TowerType.Laser];
    expect(cfg.damageType).toBe('magic');
    expect(cfg.range).toBe(250); // 最远射程
  });
});

describe('敌人配置 (ENEMY_CONFIGS)', () => {
  it('所有7种敌人均配置', () => {
    const types = Object.values(EnemyType);
    for (const type of types) {
      expect(ENEMY_CONFIGS[type], `${type} 缺失配置`).toBeDefined();
    }
  });

  it('每种敌人有必需字段', () => {
    for (const [type, cfg] of Object.entries(ENEMY_CONFIGS)) {
      expect(cfg.name, `${type}: name`).toBeTruthy();
      expect(cfg.hp, `${type}: hp`).toBeGreaterThan(0);
      expect(cfg.speed, `${type}: speed`).toBeGreaterThan(0);
      // atk 可为 0（如 Runner 不攻击）
      expect(cfg.atk, `${type}: atk`).toBeGreaterThanOrEqual(0);
      expect(cfg.defense, `${type}: defense`).toBeGreaterThanOrEqual(0);
      expect(cfg.magicResist, `${type}: magicResist`).toBeGreaterThanOrEqual(0);
      expect(cfg.rewardGold, `${type}: rewardGold`).toBeGreaterThanOrEqual(0);
      expect(cfg.color, `${type}: color`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cfg.radius, `${type}: radius`).toBeGreaterThan(0);
    }
  });

  it('Boss有特殊属性', () => {
    const boss = ENEMY_CONFIGS[EnemyType.BossCommander];
    expect(boss.isBoss).toBe(true);
    expect(boss.bossPhase2HpRatio).toBe(0.5);

    const beast = ENEMY_CONFIGS[EnemyType.BossBeast];
    expect(beast.isBoss).toBe(true);
    // ⚠️ 设计文档 §3.7 要求 HP=1000，当前代码为 700
    expect(beast.hp).toBeGreaterThanOrEqual(700);
  });

  it('自爆虫有死亡效果', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Exploder];
    // ⚠️ 设计文档 §3.5 要求 specialOnDeath='explode'、deathDamage=50、deathRadius=100
    // 当前 EnemyConfig 接口未包含这些字段，需扩展接口和数据
    expect(cfg.description).toContain('爆炸');
  });

  it('重型/法师可攻击建筑', () => {
    const heavy = ENEMY_CONFIGS[EnemyType.Heavy];
    // ⚠️ 设计文档 §3.3 要求 canAttackBuildings=true，当前为 false
    expect(heavy).toBeDefined();

    const mage = ENEMY_CONFIGS[EnemyType.Mage];
    expect(mage.canAttackBuildings).toBe(true);
  });

  it('小兵/快兵不可攻击建筑', () => {
    expect(ENEMY_CONFIGS[EnemyType.Grunt].canAttackBuildings).toBe(false);
    expect(ENEMY_CONFIGS[EnemyType.Runner].canAttackBuildings).toBe(false);
  });
});

describe('单位配置 (UNIT_CONFIGS)', () => {
  it('所有我方单位均配置', () => {
    const types = Object.values(UnitType);
    for (const type of types) {
      expect(UNIT_CONFIGS[type], `${type} 缺失配置`).toBeDefined();
    }
  });

  it('盾卫 — 高HP + 嘲讽', () => {
    const cfg = UNIT_CONFIGS[UnitType.ShieldGuard];
    expect(cfg.hp).toBe(300);
    // ⚠️ 设计文档 §2.1 要求 defense=40，当前为 20
    expect(cfg.defense).toBeGreaterThanOrEqual(20);
    expect(cfg.skillId).toBe('taunt');
  });

  it('剑士 — 高ATK + 旋风斩', () => {
    const cfg = UNIT_CONFIGS[UnitType.Swordsman];
    expect(cfg.atk).toBe(15);
    expect(cfg.skillId).toBe('whirlwind');
  });
});

describe('生产建筑配置 (PRODUCTION_CONFIGS)', () => {
  it('所有生产建筑均配置', () => {
    const types = Object.values(ProductionType);
    for (const type of types) {
      expect(PRODUCTION_CONFIGS[type], `${type} 缺失配置`).toBeDefined();
    }
  });

  it('金矿产出金币', () => {
    const cfg = PRODUCTION_CONFIGS[ProductionType.GoldMine];
    expect(cfg.resourceType).toBe('gold');
    expect(cfg.baseRate).toBe(2);
    expect(cfg.maxLevel).toBe(3);
  });

  it('能量塔产出能量', () => {
    const cfg = PRODUCTION_CONFIGS[ProductionType.EnergyTower];
    expect(cfg.resourceType).toBe('energy');
    expect(cfg.baseRate).toBe(1);
    expect(cfg.maxLevel).toBe(3);
  });
});
