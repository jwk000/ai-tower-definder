import type { World } from '../core/World.js';
import type { EntityId, UnitTypeConfig, UnitCategory } from '../types/index.js';
import { CType } from '../types/index.js';
import { Position, GridOccupant } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Attack } from '../components/Attack.js';
import { Render } from '../components/Render.js';
import { UnitTag } from '../components/UnitTag.js';
import { AI } from '../components/AI.js';
import { Lifecycle } from '../components/Lifecycle.js';
import { Movement } from '../components/Movement.js';
import { Production } from '../components/Production.js';
import { Trap } from '../components/Trap.js';
import { HealingSpring } from '../components/HealingSpring.js';
import { getUnitConfig } from '../data/units/unitConfigs.js';

/**
 * 单位工厂 - 根据配置创建单位实体
 */
export class UnitFactory {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * 创建单位实体
   * @param configId 单位配置ID
   * @param x X坐标
   * @param y Y坐标
   * @param gridPos 网格位置（可选）
   * @returns 实体ID，失败返回null
   */
  createUnit(configId: string, x: number, y: number, gridPos?: { row: number; col: number }): EntityId | null {
    const config = getUnitConfig(configId);
    if (!config) {
      console.error(`Unit config not found: ${configId}`);
      return null;
    }

    const entityId = this.world.createEntity();

    // Add Position component
    this.world.addComponent(entityId, new Position(x, y));

    // Add GridOccupant component if grid position provided
    if (gridPos) {
      this.world.addComponent(entityId, new GridOccupant(gridPos.row, gridPos.col));
    }

    // Add Health component (if unit has HP)
    if (config.hp > 0) {
      this.world.addComponent(entityId, new Health(config.hp));
    }

    // Add Attack component (if unit has attack)
    if (config.atk > 0 && config.attackRange > 0) {
      this.world.addComponent(entityId, new Attack(config.atk, config.attackRange, config.attackSpeed));
    }

    // Add Render component
    const render = new Render(config.shape, config.color, config.size);
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 16;
    this.world.addComponent(entityId, render);

    // Add UnitTag component
    this.world.addComponent(entityId, new UnitTag(
      configId,
      config.category as UnitCategory,
      1, // initial level
      config.special?.maxLevel as number ?? 5
    ));

    // Add AI component (if unit has AI config)
    if (config.aiConfig) {
      const ai = new AI(config.aiConfig);
      
      // Set home position for soldiers
      if (config.category === 'soldier') {
        ai.setBlackboard('home_x', x);
        ai.setBlackboard('home_y', y);
      }
      
      this.world.addComponent(entityId, ai);
    }

    // Add Lifecycle component
    this.world.addComponent(entityId, new Lifecycle(config.lifecycle));

    return entityId;
  }

  /**
   * 创建塔单位
   */
  createTower(configId: string, x: number, y: number, gridPos: { row: number; col: number }): EntityId | null {
    const entityId = this.createUnit(configId, x, y, gridPos);
    if (!entityId) return null;

    // Add tower-specific components
    const config = getUnitConfig(configId);
    if (config) {
      // Add PlayerOwned tag
      this.world.addComponent(entityId, { type: CType.PlayerOwned });
    }

    return entityId;
  }

  /**
   * 创建敌人单位
   */
  createEnemy(configId: string, x: number, y: number): EntityId | null {
    const entityId = this.createUnit(configId, x, y);
    if (!entityId) return null;

    const config = getUnitConfig(configId);
    if (config) {
      // Add Enemy tag
      this.world.addComponent(entityId, { type: CType.Enemy });

      // Add Movement component for path-following enemies
      if (config.moveSpeed > 0) {
        this.world.addComponent(entityId, new Movement(config.moveSpeed));
      }
    }

    return entityId;
  }

  /**
   * 创建士兵单位
   */
  createSoldier(configId: string, x: number, y: number, gridPos?: { row: number; col: number }): EntityId | null {
    const entityId = this.createUnit(configId, x, y, gridPos);
    if (!entityId) return null;

    const config = getUnitConfig(configId);
    if (config) {
      // Add PlayerOwned tag
      this.world.addComponent(entityId, { type: CType.PlayerOwned });

      // Add PlayerControllable component
      this.world.addComponent(entityId, { type: CType.PlayerControllable });
    }

    return entityId;
  }

  /**
   * 创建建筑单位
   */
  createBuilding(configId: string, x: number, y: number, gridPos: { row: number; col: number }): EntityId | null {
    const entityId = this.createUnit(configId, x, y, gridPos);
    if (!entityId) return null;

    const config = getUnitConfig(configId);
    if (config) {
      // Add PlayerOwned tag
      this.world.addComponent(entityId, { type: CType.PlayerOwned });

      // Add Production component for production buildings
      if (config.special?.resourceType) {
        this.world.addComponent(entityId, new Production(
          configId as any,
          config.special.resourceType as 'gold' | 'energy',
          config.special.baseRate as number,
          config.special.maxLevel as number
        ));
      }
    }

    return entityId;
  }

  /**
   * 创建陷阱单位
   */
  createTrap(configId: string, x: number, y: number, gridPos: { row: number; col: number }): EntityId | null {
    const entityId = this.createUnit(configId, x, y, gridPos);
    if (!entityId) return null;

    const config = getUnitConfig(configId);
    if (config) {
      // Add Trap component for damage traps
      if (config.special?.damagePerSecond) {
        this.world.addComponent(entityId, new Trap(
          config.special.damagePerSecond as number,
          0 // radius handled by AI
        ));
      }

      // Add HealingSpring component for healing traps
      if (config.special?.healAmount) {
        this.world.addComponent(entityId, new HealingSpring(
          config.special.healAmount as number,
          config.attackRange
        ));
      }
    }

    return entityId;
  }

  /**
   * 创建基地单位
   */
  createBase(x: number, y: number): EntityId | null {
    return this.createUnit('base', x, y);
  }

  /**
   * 创建出生点标记
   */
  createSpawnPoint(x: number, y: number): EntityId | null {
    return this.createUnit('spawn_point', x, y);
  }

  /**
   * 升级单位
   */
  upgradeUnit(entityId: EntityId): boolean {
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    if (!unitTag) return false;

    const config = getUnitConfig(unitTag.unitConfigId);
    if (!config) return false;

    if (!unitTag.upgrade()) return false;

    // Apply upgrade bonuses
    const health = this.world.getComponent<Health>(entityId, CType.Health);
    const attack = this.world.getComponent<Attack>(entityId, CType.Attack);

    if (health && config.special?.upgradeHpBonus) {
      const bonus = (config.special.upgradeHpBonus as number[])[unitTag.level - 2];
      if (bonus) health.max += bonus;
    }

    if (attack && config.special?.upgradeAtkBonus) {
      const bonus = (config.special.upgradeAtkBonus as number[])[unitTag.level - 2];
      if (bonus) attack.atk += bonus;
    }

    return true;
  }

  /**
   * 销毁单位（不触发死亡效果）
   */
  destroyUnit(entityId: EntityId): void {
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    if (unitTag) {
      unitTag.markDestroyed();
    }
    this.world.destroyEntity(entityId);
  }

  /**
   * 杀死单位（触发死亡效果）
   */
  killUnit(entityId: EntityId): void {
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    if (unitTag) {
      unitTag.markDead();
    }

    // Trigger death effects through LifecycleSystem
    const health = this.world.getComponent<Health>(entityId, CType.Health);
    if (health) {
      health.current = 0;
    }
  }
}
