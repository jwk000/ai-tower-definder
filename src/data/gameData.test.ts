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
      expect(cfg.attackSpeed, `${type}: attackSpeed`).toBeGreaterThanOrEqual(0);
      expect(cfg.range, `${type}: range`).toBeGreaterThanOrEqual(0);
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
    expect(cfg.atk).toBe(11);
    expect(cfg.attackSpeed).toBe(1.0);
    expect(cfg.range).toBeGreaterThanOrEqual(170);
    expect(cfg.damageType).toBe('physical');
  });

  it('炮塔 — AOE+眩晕', () => {
    const cfg = TOWER_CONFIGS[TowerType.Cannon];
    expect(cfg.splashRadius).toBe(80);
    expect(cfg.stunDuration).toBe(0.8);
  });

  it('冰塔 — 减速+冰冻', () => {
    const cfg = TOWER_CONFIGS[TowerType.Ice];
    expect(cfg.slowPercent).toBe(25);
    expect(cfg.slowMaxStacks).toBe(4);
    expect(cfg.freezeDuration).toBe(1.0);
    expect(cfg.damageType).toBe('magic');
  });

  it('电塔 — 链击', () => {
    const cfg = TOWER_CONFIGS[TowerType.Lightning];
    expect(cfg.chainCount).toBe(3);
    expect(cfg.chainDecay).toBe(0.22);
    expect(cfg.damageType).toBe('magic');
  });

  it('激光塔 — 贯穿', () => {
    const cfg = TOWER_CONFIGS[TowerType.Laser];
    expect(cfg.damageType).toBe('magic');
    expect(cfg.range).toBe(260); // 最远射程
  });

  it('毒藤塔 — DOT持续伤害', () => {
    const cfg = TOWER_CONFIGS[TowerType.Vine];
    expect(cfg.damageType).toBe('magic');
    expect(cfg.dotDamage).toBe(6);
    expect(cfg.dotDuration).toBe(4);
    expect(cfg.dotMaxStacks).toBe(5);
    expect(cfg.cost).toBe(70);
    expect(cfg.atk).toBe(6);
    expect(cfg.attackSpeed).toBe(0.8);
  });

  it('号令塔 — 光环增益', () => {
    const cfg = TOWER_CONFIGS[TowerType.Command];
    expect(cfg.atk).toBe(0);
    expect(cfg.attackSpeed).toBe(0);
    expect(cfg.auraRadius).toBe(120);
    expect(cfg.auraAtkSpeedBonus).toBe(10);
    expect(cfg.auraAtkBonus).toBe(0);
    expect(cfg.cost).toBe(100);
    expect(cfg.hp).toBe(80);
  });

  it('弩炮塔 — 远程贯穿狙击', () => {
    const cfg = TOWER_CONFIGS[TowerType.Ballista];
    expect(cfg.damageType).toBe('physical');
    expect(cfg.atk).toBe(45);
    expect(cfg.attackSpeed).toBe(0.25);
    expect(cfg.range).toBe(320);
    expect(cfg.pierceCount).toBe(2);
    expect(cfg.cost).toBe(100);
  });

  it('导弹塔 v1.1 — 战略武器（600px 大射程，非全图）', () => {
    const cfg = TOWER_CONFIGS[TowerType.Missile];
    expect(cfg.cost).toBe(220);
    expect(cfg.atk).toBe(90);
    expect(cfg.attackSpeed).toBe(0.14);
    expect(cfg.range, 'P0-#4: 射程必须为 600px，不再是 9999 全图').toBe(600);
    expect(cfg.range, 'P0-#4: 射程不得 ≥ 9999').toBeLessThan(9999);
    expect(cfg.damageType).toBe('physical');
    expect(cfg.splashRadius).toBe(130);
  });

  it('导弹塔 v1.1 — 不能命中飞行敌', () => {
    const cfg = TOWER_CONFIGS[TowerType.Missile];
    expect(cfg.cantTargetFlying, 'P0-#4: 导弹塔不能命中飞行敌').toBe(true);
  });

  it('导弹塔 v1.1 — L5 热压中心加成参数', () => {
    const cfg = TOWER_CONFIGS[TowerType.Missile];
    expect(cfg.centerBonusRadiusRatio, 'P0-#4: L5 热压中心半径占比 10%').toBe(0.1);
    expect(cfg.centerBonusMultiplier, 'P0-#4: L5 热压中心伤害 ×1.2').toBe(1.2);
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
    expect(beast.hp).toBe(1100);
    expect(beast.defense).toBe(75);
  });

  it('自爆虫有死亡效果', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Exploder];
    expect(cfg.specialOnDeath).toBe('explode');
    expect(cfg.deathDamage).toBe(55);
    expect(cfg.deathRadius).toBe(100);
  });

  it('重型/法师可攻击建筑', () => {
    const heavy = ENEMY_CONFIGS[EnemyType.Heavy];
    expect(heavy.canAttackBuildings).toBe(true);

    const mage = ENEMY_CONFIGS[EnemyType.Mage];
    expect(mage.canAttackBuildings).toBe(true);
  });

  it('小兵/快兵不可攻击建筑', () => {
    expect(ENEMY_CONFIGS[EnemyType.Grunt].canAttackBuildings).toBe(false);
    expect(ENEMY_CONFIGS[EnemyType.Runner].canAttackBuildings).toBe(false);
  });

  it('热气球 — 飞行轰炸属性', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.HotAirBalloon];
    expect(cfg.canAttackBuildings).toBe(true);
    expect(cfg.bombDamage).toBe(30);
    expect(cfg.bombInterval).toBe(3.5);
    expect(cfg.bombRadius).toBe(60);
    expect(cfg.hp).toBe(100);
    expect(cfg.speed).toBe(45);
    expect(cfg.rewardGold).toBe(30);
  });

  it('萨满 — 治疗光环属性', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Shaman];
    expect(cfg.healAmount).toBe(25);
    expect(cfg.healInterval).toBe(4);
    expect(cfg.healRadius).toBe(150);
    expect(cfg.auraSpeedBonus).toBe(15);
    expect(cfg.auraAttackBonus).toBe(10);
    expect(cfg.auraRadius).toBe(120);
    expect(cfg.canAttackBuildings).toBe(false);
    expect(cfg.rewardGold).toBe(30);
  });

  it('铁甲巨兽 — 建筑破坏+冲锋', () => {
    const cfg = ENEMY_CONFIGS[EnemyType.Juggernaut];
    expect(cfg.canAttackBuildings).toBe(true);
    expect(cfg.hp).toBe(350);
    expect(cfg.atk).toBe(30);
    expect(cfg.defense).toBe(90);
    expect(cfg.speed).toBe(22);
    expect(cfg.radius).toBe(28);
    expect(cfg.chargeSpeedBonus).toBe(50);
    expect(cfg.chargeCooldown).toBe(8);
    expect(cfg.stunResist).toBe(0.5);
    expect(cfg.freezeResist).toBe(0.5);
    expect(cfg.rewardGold).toBe(45);
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
    expect(cfg.hp).toBe(350);
    expect(cfg.defense).toBe(50);
    expect(cfg.skillId).toBe('taunt');
  });

  it('剑士 — 高ATK + 旋风斩', () => {
    const cfg = UNIT_CONFIGS[UnitType.Swordsman];
    expect(cfg.atk).toBe(18);
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
    expect(cfg.baseRate).toBe(2.5);
    expect(cfg.maxLevel).toBe(3);
  });

  it('能量塔产出能量', () => {
    const cfg = PRODUCTION_CONFIGS[ProductionType.EnergyTower];
    expect(cfg.resourceType).toBe('energy');
    expect(cfg.baseRate).toBe(1.5);
    expect(cfg.maxLevel).toBe(3);
  });
});
