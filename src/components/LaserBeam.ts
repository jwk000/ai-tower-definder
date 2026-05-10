import { CType, type EntityId } from '../types/index.js';

export class LaserBeam {
  readonly type = CType.LaserBeam;

  towerId: EntityId;
  targetId: EntityId;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  timer: number;
  maxTimer: number;
  damage: number;
  damageInterval: number;
  damageTimer: number;
  affectedEnemies: Set<EntityId>;

  constructor(
    towerId: EntityId,
    targetId: EntityId,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    duration: number,
    damage: number,
    damageInterval: number,
  ) {
    this.towerId = towerId;
    this.targetId = targetId;
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.timer = duration;
    this.maxTimer = duration;
    this.damage = damage;
    this.damageInterval = damageInterval;
    this.damageTimer = 0;
    this.affectedEnemies = new Set();
  }

  get alpha(): number {
    return Math.max(0, this.timer / this.maxTimer);
  }

  get alive(): boolean {
    return this.timer > 0;
  }
}
