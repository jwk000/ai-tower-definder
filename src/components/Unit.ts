import { CType, type UnitType } from '../types/index.js';

export class Unit {
  readonly type = CType.Unit;
  unitType: UnitType;
  popCost: number;
  skillId: string;
  baseSpeed: number;

  constructor(unitType: UnitType, popCost: number, skillId: string, baseSpeed: number) {
    this.unitType = unitType;
    this.popCost = popCost;
    this.skillId = skillId;
    this.baseSpeed = baseSpeed;
  }
}
