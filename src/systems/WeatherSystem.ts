import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Attack,
  Movement,
  Tower,
  UnitTag,
  BatSwarmMember,
} from '../core/components.js';
import type { World as BitecsWorld } from 'bitecs';
import {
  TowerType,
  WeatherType,
  BuffAttribute,
  type WeatherModifier,
} from '../types/index.js';
import { WEATHER_CONFIGS } from '../data/weatherConfigs.js';

// ============================================================
// Tower type numeric mapping — Tower.towerType is Types.ui8
// ============================================================

const TOWER_TYPE_NUM: Record<TowerType, number> = {
  [TowerType.Arrow]: 0,
  [TowerType.Cannon]: 1,
  [TowerType.Ice]: 2,
  [TowerType.Lightning]: 3,
  [TowerType.Laser]: 4,
  [TowerType.Bat]: 5,
};

/** Reverse lookup: numeric tower type → TowerType string */
function towerTypeToString(num: number): TowerType | null {
  for (const [key, val] of Object.entries(TOWER_TYPE_NUM)) {
    if (val === num) return key as TowerType;
  }
  return null;
}

/** Map targetType strings (from weather configs) to numeric tower types */
const TARGET_TO_TOWER_NUM: Record<string, number> = {
  arrow_tower: TOWER_TYPE_NUM[TowerType.Arrow],
  cannon_tower: TOWER_TYPE_NUM[TowerType.Cannon],
  ice_tower: TOWER_TYPE_NUM[TowerType.Ice],
  lightning_tower: TOWER_TYPE_NUM[TowerType.Lightning],
  laser_tower: TOWER_TYPE_NUM[TowerType.Laser],
};

// ============================================================
// Bitecs queries — pre-built for frame reuse
// ============================================================

const towerAttackQuery = defineQuery([Tower, Attack]);
const enemyMovementQuery = defineQuery([UnitTag, Movement]);
const batAttackQuery = defineQuery([BatSwarmMember, Attack]);

// ============================================================
// WeatherSystem
// ============================================================

export class WeatherSystem implements System {
  readonly name = 'WeatherSystem';

  currentWeather: WeatherType = WeatherType.Sunny;
  private weatherPool: WeatherType[] = [WeatherType.Sunny];
  private weatherFixed: WeatherType | null = null;
  private changeInterval: number = 3;
  private wavesElapsed: number = 0;
  transitionTimer: number = 0;
  previousWeather: WeatherType = WeatherType.Sunny;

  get weatherName(): string {
    return WEATHER_CONFIGS[this.currentWeather]?.name ?? '晴天';
  }

  get screenTint(): string {
    return WEATHER_CONFIGS[this.currentWeather]?.screenTint ?? 'rgba(0,0,0,0)';
  }

  get screenAlpha(): number {
    return WEATHER_CONFIGS[this.currentWeather]?.screenAlpha ?? 0;
  }

  private baseValues: Map<number, Record<string, number>> = new Map();

  /** Current TowerWorld reference — set each frame in update() */
  private towerWorld: TowerWorld | null = null;

  // ---- Public API ----

  init(pool: WeatherType[], fixed?: WeatherType, interval?: number): void {
    this.weatherPool = pool.length > 0 ? pool : [WeatherType.Sunny];
    this.weatherFixed = fixed ?? null;
    this.changeInterval = interval ?? 3;
    if (fixed) {
      this.setWeather(fixed);
    } else {
      this.setWeather(this.weatherPool[0]!);
    }
  }

  onWaveEnd(): void {
    if (this.weatherFixed) return;
    this.wavesElapsed++;
    if (this.wavesElapsed >= this.changeInterval) {
      this.wavesElapsed = 0;
      this.switchWeather();
    }
  }

  switchWeather(): void {
    const idx = Math.floor(Math.random() * this.weatherPool.length);
    const next = this.weatherPool[idx];
    if (next) this.setWeather(next);
  }

  setWeather(type: WeatherType): void {
    if (type === this.currentWeather) return;
    this.previousWeather = this.currentWeather;
    this.currentWeather = type;
    this.transitionTimer = 1.5;
    this.clearWeatherModifiers();
    this.applyWeatherModifiers();
  }

  canAttackBat(): boolean {
    return (
      this.currentWeather === WeatherType.Night ||
      this.currentWeather === WeatherType.Fog
    );
  }

  /** Called after a tower is upgraded — updates the stored base attack value */
  onTowerUpgraded(entityId: number): void {
    const baseMap = this.baseValues.get(entityId);
    if (!baseMap) return;

    const w = this.towerWorld;
    if (!w) return;
    if (!hasComponent(w.world, entityId, Attack)) return;
    if (!hasComponent(w.world, entityId, Tower)) return;

    // Recalculate base: current = base * (1 + mod/100), so base = current / (1 + mod/100)
    const config = WEATHER_CONFIGS[this.currentWeather];
    if (!config) return;

    const towerTypeNum = Tower.towerType[entityId]!;
    const towerTypeStr = towerTypeToString(towerTypeNum);
    if (!towerTypeStr) return;

    const towerTypeId = `${towerTypeStr}_tower`;
    const atkModifier = config.modifiers.find(
      (m) => m.targetType === towerTypeId && m.attribute === BuffAttribute.ATK,
    );

    const currentDmg = Attack.damage[entityId]!;

    if (atkModifier && baseMap['atk'] !== undefined) {
      baseMap['atk'] = currentDmg / (1 + atkModifier.value / 100);
    } else {
      baseMap['atk'] = currentDmg;
    }
  }

  // ---- System.update ----

  update(world: TowerWorld, dt: number): void {
    this.towerWorld = world;
    if (this.transitionTimer > 0) {
      this.transitionTimer -= dt;
    }
    this.applyWeatherToNewEntities(world.world);
  }

  // ---- Private: modifier application ----

  private applyWeatherToNewEntities(rawWorld: BitecsWorld): void {
    const config = WEATHER_CONFIGS[this.currentWeather];
    if (!config) return;

    for (const modifier of config.modifiers) {
      const entities = this.getMatchingEntities(modifier.targetType, rawWorld);
      for (const id of entities) {
        if (!this.baseValues.has(id)) {
          this.applyModifier(id, modifier, rawWorld);
        }
      }
    }
  }

  private clearWeatherModifiers(): void {
    const w = this.towerWorld;
    for (const [entityId, baseMap] of this.baseValues) {
      const hasAtk = w ? hasComponent(w.world, entityId, Attack) : false;
      const hasMov = w ? hasComponent(w.world, entityId, Movement) : false;

      if (baseMap['atk'] !== undefined && hasAtk) {
        Attack.damage[entityId] = baseMap['atk']!;
      }
      if (baseMap['range'] !== undefined && hasAtk) {
        Attack.range[entityId] = baseMap['range']!;
      }
      if (baseMap['attackSpeed'] !== undefined && hasAtk) {
        Attack.attackSpeed[entityId] = baseMap['attackSpeed']!;
      }
      if (baseMap['speed'] !== undefined && hasMov) {
        Movement.speed[entityId] = baseMap['speed']!;
      }
      if (baseMap['currentSpeed'] !== undefined && hasMov) {
        Movement.currentSpeed[entityId] = baseMap['currentSpeed']!;
      }
    }
    this.baseValues.clear();
  }

  private applyWeatherModifiers(): void {
    const w = this.towerWorld;
    if (!w) return;

    const config = WEATHER_CONFIGS[this.currentWeather];
    if (!config) return;

    for (const modifier of config.modifiers) {
      const entities = this.getMatchingEntities(modifier.targetType, w.world);
      for (const id of entities) {
        this.applyModifier(id, modifier, w.world);
      }
    }
  }

  private getMatchingEntities(targetType: string, rawWorld: BitecsWorld): number[] {
    // Individual tower types
    const towerNum = TARGET_TO_TOWER_NUM[targetType];
    if (towerNum !== undefined) {
      const entities = towerAttackQuery(rawWorld);
      const result: number[] = [];
      for (let i = 0; i < entities.length; i++) {
        const eid = entities[i]!;
        if (Tower.towerType[eid] === towerNum) {
          result.push(eid);
        }
      }
      return result;
    }

    switch (targetType) {
      case 'bat_tower':
        return batAttackQuery(rawWorld) as number[];
      case 'tower':
        return towerAttackQuery(rawWorld) as number[];
      case 'enemy': {
        const entities = enemyMovementQuery(rawWorld);
        const result: number[] = [];
        for (let i = 0; i < entities.length; i++) {
          const eid = entities[i]!;
          if (UnitTag.isEnemy[eid] === 1) {
            result.push(eid);
          }
        }
        return result;
      }
      default:
        return [];
    }
  }

  private applyModifier(entityId: number, modifier: WeatherModifier, rawWorld: BitecsWorld): void {
    let baseMap = this.baseValues.get(entityId);
    if (!baseMap) {
      baseMap = {};
      this.baseValues.set(entityId, baseMap);
    }

    const value = modifier.value;
    const hasAtk = hasComponent(rawWorld, entityId, Attack);
    const hasMov = hasComponent(rawWorld, entityId, Movement);

    switch (modifier.attribute) {
      case BuffAttribute.ATK: {
        if (!hasAtk) return;
        if (baseMap['atk'] === undefined) baseMap['atk'] = Attack.damage[entityId]!;
        if (modifier.isPercent) {
          Attack.damage[entityId] = baseMap['atk']! * (1 + value / 100);
        }
        break;
      }
      case BuffAttribute.Range: {
        if (!hasAtk) return;
        if (baseMap['range'] === undefined) baseMap['range'] = Attack.range[entityId]!;
        if (modifier.isPercent) {
          Attack.range[entityId] = baseMap['range']! * (1 + value / 100);
        }
        break;
      }
      case BuffAttribute.Speed: {
        if (!hasMov) return;
        if (baseMap['speed'] === undefined) baseMap['speed'] = Movement.speed[entityId]!;
        if (baseMap['currentSpeed'] === undefined) baseMap['currentSpeed'] = Movement.currentSpeed[entityId]!;
        if (modifier.isPercent) {
          Movement.speed[entityId] = baseMap['speed']! * (1 + value / 100);
          Movement.currentSpeed[entityId] = baseMap['currentSpeed']! * (1 + value / 100);
        }
        break;
      }
      case BuffAttribute.AttackSpeed: {
        if (!hasAtk) return;
        if (baseMap['attackSpeed'] === undefined) baseMap['attackSpeed'] = Attack.attackSpeed[entityId]!;
        if (modifier.isPercent) {
          Attack.attackSpeed[entityId] = baseMap['attackSpeed']! * (1 + value / 100);
        }
        break;
      }
    }
  }
}
