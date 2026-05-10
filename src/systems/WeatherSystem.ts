import { System } from '../types/index.js';
import { World } from '../core/World.js';
import {
  CType,
  TowerType,
  WeatherType,
  BuffAttribute,
  type WeatherModifier,
} from '../types/index.js';
import { WEATHER_CONFIGS } from '../data/weatherConfigs.js';
import { Attack } from '../components/Attack.js';
import { Movement } from '../components/Movement.js';
import { Tower } from '../components/Tower.js';
import { Enemy } from '../components/Enemy.js';

export class WeatherSystem implements System {
  readonly name = 'WeatherSystem';
  readonly requiredComponents = [] as const;

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

  constructor(private world: World) {}

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
    const atk = this.world.getComponent<Attack>(entityId, CType.Attack);
    if (!atk) return;

    // Recalculate base: current = base * (1 + mod/100), so base = current / (1 + mod/100)
    const config = WEATHER_CONFIGS[this.currentWeather];
    if (!config) return;

    // Find the ATK modifier for the entity's tower type
    const tower = this.world.getComponent<Tower>(entityId, CType.Tower);
    if (!tower) return;

    const towerTypeId = `${tower.towerType}_tower`;
    const atkModifier = config.modifiers.find(
      (m) => m.targetType === towerTypeId && m.attribute === BuffAttribute.ATK,
    );

    if (atkModifier && baseMap['atk'] !== undefined) {
      baseMap['atk'] = atk.atk / (1 + atkModifier.value / 100);
    } else {
      baseMap['atk'] = atk.atk;
    }
  }

  update(_entities: number[], dt: number): void {
    if (this.transitionTimer > 0) {
      this.transitionTimer -= dt;
    }
    this.applyWeatherToNewEntities();
  }

  private applyWeatherToNewEntities(): void {
    const config = WEATHER_CONFIGS[this.currentWeather];
    if (!config) return;

    for (const modifier of config.modifiers) {
      const entities = this.getMatchingEntities(modifier.targetType);
      for (const id of entities) {
        if (!this.baseValues.has(id)) {
          this.applyModifier(id, modifier);
        }
      }
    }
  }

  private clearWeatherModifiers(): void {
    for (const [entityId, baseMap] of this.baseValues) {
      const atk = this.world.getComponent<Attack>(entityId, CType.Attack);
      if (baseMap['atk'] !== undefined && atk) {
        atk.atk = baseMap['atk'];
      }
      if (baseMap['range'] !== undefined && atk) {
        atk.range = baseMap['range'];
      }
      if (baseMap['attackSpeed'] !== undefined && atk) {
        atk.attackSpeed = baseMap['attackSpeed'];
      }
      const mov = this.world.getComponent<Movement>(entityId, CType.Movement);
      if (baseMap['speed'] !== undefined && mov) {
        mov.speed = baseMap['speed'];
      }
      const enemy = this.world.getComponent<Enemy>(entityId, CType.Enemy);
      if (baseMap['originalSpeed'] !== undefined && enemy) {
        enemy.originalSpeed = baseMap['originalSpeed'];
      }
    }
    this.baseValues.clear();
  }

  private applyWeatherModifiers(): void {
    const config = WEATHER_CONFIGS[this.currentWeather];
    if (!config) return;

    for (const modifier of config.modifiers) {
      const entities = this.getMatchingEntities(modifier.targetType);
      for (const id of entities) {
        this.applyModifier(id, modifier);
      }
    }
  }

  private getMatchingEntities(targetType: string): number[] {
    switch (targetType) {
      case 'arrow_tower':
        return this.world.query(CType.Tower, CType.Attack).filter((id) => {
          const t = this.world.getComponent<Tower>(id, CType.Tower);
          return t?.towerType === TowerType.Arrow;
        });
      case 'cannon_tower':
        return this.world.query(CType.Tower, CType.Attack).filter((id) => {
          const t = this.world.getComponent<Tower>(id, CType.Tower);
          return t?.towerType === TowerType.Cannon;
        });
      case 'ice_tower':
        return this.world.query(CType.Tower, CType.Attack).filter((id) => {
          const t = this.world.getComponent<Tower>(id, CType.Tower);
          return t?.towerType === TowerType.Ice;
        });
      case 'lightning_tower':
        return this.world.query(CType.Tower, CType.Attack).filter((id) => {
          const t = this.world.getComponent<Tower>(id, CType.Tower);
          return t?.towerType === TowerType.Lightning;
        });
      case 'laser_tower':
        return this.world.query(CType.Tower, CType.Attack).filter((id) => {
          const t = this.world.getComponent<Tower>(id, CType.Tower);
          return t?.towerType === TowerType.Laser;
        });
      case 'bat_tower':
        return this.world.query(CType.BatSwarmMember, CType.Attack);
      case 'tower':
        return this.world.query(CType.Tower, CType.Attack);
      case 'enemy':
        return this.world.query(CType.Enemy, CType.Movement);
      default:
        return [];
    }
  }

  private applyModifier(entityId: number, modifier: WeatherModifier): void {
    let baseMap = this.baseValues.get(entityId);
    if (!baseMap) {
      baseMap = {};
      this.baseValues.set(entityId, baseMap);
    }

    const value = modifier.value;

    switch (modifier.attribute) {
      case BuffAttribute.ATK: {
        const atk = this.world.getComponent<Attack>(entityId, CType.Attack);
        if (!atk) return;
        if (baseMap['atk'] === undefined) baseMap['atk'] = atk.atk;
        if (modifier.isPercent) {
          atk.atk = baseMap['atk']! * (1 + value / 100);
        }
        break;
      }
      case BuffAttribute.Range: {
        const atk = this.world.getComponent<Attack>(entityId, CType.Attack);
        if (!atk) return;
        if (baseMap['range'] === undefined) baseMap['range'] = atk.range;
        if (modifier.isPercent) {
          atk.range = baseMap['range']! * (1 + value / 100);
        }
        break;
      }
      case BuffAttribute.Speed: {
        const mov = this.world.getComponent<Movement>(entityId, CType.Movement);
        if (!mov) return;
        if (baseMap['speed'] === undefined) baseMap['speed'] = mov.speed;
        if (modifier.isPercent) {
          mov.speed = baseMap['speed']! * (1 + value / 100);
        }
        const enemy = this.world.getComponent<Enemy>(entityId, CType.Enemy);
        if (enemy) {
          if (baseMap['originalSpeed'] === undefined) baseMap['originalSpeed'] = enemy.originalSpeed;
          if (modifier.isPercent) {
            enemy.originalSpeed = baseMap['originalSpeed']! * (1 + value / 100);
          }
        }
        break;
      }
      case BuffAttribute.AttackSpeed: {
        const atk = this.world.getComponent<Attack>(entityId, CType.Attack);
        if (!atk) return;
        if (baseMap['attackSpeed'] === undefined) baseMap['attackSpeed'] = atk.attackSpeed;
        if (modifier.isPercent) {
          atk.attackSpeed = baseMap['attackSpeed']! * (1 + value / 100);
        }
        break;
      }
    }
  }
}
