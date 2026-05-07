import { CType, type TowerType } from '../types/index.js';

export class Tower {
  readonly type = CType.Tower;
  towerType: TowerType;
  level: number; // 1-5
  targetId: number | null;
  totalInvested: number;

  constructor(towerType: TowerType, buildCost: number) {
    this.towerType = towerType;
    this.level = 1;
    this.targetId = null;
    this.totalInvested = buildCost;
  }
}
