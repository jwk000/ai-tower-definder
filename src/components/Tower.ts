import { CType, type TowerType } from '../types/index.js';

export class Tower {
  readonly type = CType.Tower;
  towerType: TowerType;
  level: number; // 1-5
  targetId: number | null;

  constructor(towerType: TowerType) {
    this.towerType = towerType;
    this.level = 1;
    this.targetId = null;
  }
}
