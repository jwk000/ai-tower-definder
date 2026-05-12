import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Health, Visual, Bomb, Faction,
  Layer, LayerVal, ShapeVal, DamageTypeVal,
  ExplosionEffect, PlayerOwned,
} from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';

const bombQuery = defineQuery([Position, Bomb]);
const factionHealthQuery = defineQuery([Position, Health, Faction]);
const positionHealthQuery = defineQuery([Position, Health]);

const DEFAULT_FALL_SPEED = 300;
const BOMB_VISUAL_SIZE = 8;
const BOMB_COLOR_R = 0xff;
const BOMB_COLOR_G = 0x33;
const BOMB_COLOR_B = 0x33;
const EXPLOSION_COLOR_R = 0xff;
const EXPLOSION_COLOR_G = 0x6d;
const EXPLOSION_COLOR_B = 0x00;
const HIT_FLASH_DURATION = 0.12;

export interface SpawnBombParams {
  fromX: number;
  fromY: number;
  targetY: number;
  damage: number;
  radius: number;
  ownerFaction: number;
  fallSpeed?: number;
}

export function spawnBomb(world: TowerWorld, params: SpawnBombParams): number {
  const bid = world.createEntity();

  world.addComponent(bid, Position, { x: params.fromX, y: params.fromY });

  world.addComponent(bid, Bomb, {
    targetY: params.targetY,
    fallSpeed: params.fallSpeed ?? DEFAULT_FALL_SPEED,
    damage: params.damage,
    radius: params.radius,
    ownerFaction: params.ownerFaction,
  });

  world.addComponent(bid, Visual, {
    shape: ShapeVal.Circle,
    colorR: BOMB_COLOR_R,
    colorG: BOMB_COLOR_G,
    colorB: BOMB_COLOR_B,
    size: BOMB_VISUAL_SIZE,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
  });

  world.addComponent(bid, Layer, { value: LayerVal.LowAir });

  return bid;
}

export class BombSystem implements System {
  readonly name = 'BombSystem';

  update(world: TowerWorld, dt: number): void {
    const bombs = bombQuery(world.world);
    const detonated: number[] = [];

    for (const bid of bombs) {
      const py = Position.y[bid];
      if (py === undefined) {
        detonated.push(bid);
        continue;
      }

      const fall = Bomb.fallSpeed[bid] ?? DEFAULT_FALL_SPEED;
      const targetY = Bomb.targetY[bid] ?? py;
      Position.y[bid] = py + fall * dt;

      if (Position.y[bid]! >= targetY) {
        this.detonate(world, bid);
        detonated.push(bid);
      }
    }

    for (const bid of detonated) {
      if (hasComponent(world.world, Position, bid)) {
        world.destroyEntity(bid);
      }
    }
  }

  private detonate(world: TowerWorld, bombId: number): void {
    const hitX = Position.x[bombId]!;
    const hitY = Position.y[bombId]!;
    const damage = Bomb.damage[bombId] ?? 0;
    const radius = Bomb.radius[bombId] ?? 0;
    const ownerFaction = Bomb.ownerFaction[bombId] ?? 0;

    const visited = new Set<number>();

    const factionTargets = factionHealthQuery(world.world);
    for (const tid of factionTargets) {
      if (Health.current[tid]! <= 0) continue;
      const targetFaction = Faction.value[tid];
      if (targetFaction === ownerFaction) continue;
      if (this.isWithin(tid, hitX, hitY, radius)) {
        this.applyHit(world, tid, damage);
        visited.add(tid);
      }
    }

    const allLiving = positionHealthQuery(world.world);
    for (const tid of allLiving) {
      if (visited.has(tid)) continue;
      if (Health.current[tid]! <= 0) continue;
      if (Faction.value[tid] !== undefined) continue;
      if (!hasComponent(world.world, PlayerOwned, tid)) continue;
      if (this.isWithin(tid, hitX, hitY, radius)) {
        this.applyHit(world, tid, damage);
      }
    }

    this.spawnExplosionRing(world, hitX, hitY, radius);
  }

  private isWithin(eid: number, cx: number, cy: number, r: number): boolean {
    const tx = Position.x[eid]!;
    const ty = Position.y[eid]!;
    const dx = tx - cx;
    const dy = ty - cy;
    return dx * dx + dy * dy <= r * r;
  }

  private applyHit(world: TowerWorld, eid: number, damage: number): void {
    applyDamageToTarget(world, eid, damage, DamageTypeVal.Physical);
    if (hasComponent(world.world, Visual, eid)) {
      Visual.hitFlashTimer[eid] = HIT_FLASH_DURATION;
    }
  }

  private spawnExplosionRing(world: TowerWorld, x: number, y: number, radius: number): void {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: EXPLOSION_COLOR_R,
      colorG: EXPLOSION_COLOR_G,
      colorB: EXPLOSION_COLOR_B,
      size: 6,
      alpha: 0.8,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
    world.addComponent(eid, ExplosionEffect, {
      duration: 0.4,
      elapsed: 0,
      radius: 6,
      maxRadius: radius,
      colorR: EXPLOSION_COLOR_R,
      colorG: EXPLOSION_COLOR_G,
      colorB: EXPLOSION_COLOR_B,
    });
    world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });
  }
}
