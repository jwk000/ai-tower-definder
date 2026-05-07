import { CType } from '../types/index.js';

export class Projectile {
  readonly type = CType.Projectile;
  targetId: number;
  speed: number;
  damage: number;
  fromX: number;
  fromY: number;
  sourceTowerId: number;
  sourceTowerType: string;
  isChain: boolean;
  chainIndex: number;
  splashRadius?: number;
  knockback?: number;
  slowPercent?: number;
  slowMaxStacks?: number;
  freezeDuration?: number;
  chainCount?: number;
  chainRange?: number;
  chainDecay?: number;

  constructor(targetId: number, speed: number, damage: number, fromX: number, fromY: number) {
    this.targetId = targetId;
    this.speed = speed;
    this.damage = damage;
    this.fromX = fromX;
    this.fromY = fromY;
    this.sourceTowerId = 0;
    this.sourceTowerType = '';
    this.isChain = false;
    this.chainIndex = 0;
  }
}
