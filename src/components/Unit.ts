import { CType, type UnitType } from '../types/index.js';

export class Unit {
  readonly type = CType.Unit;
  unitType: UnitType;
  popCost: number;
  skillId: string;
  baseSpeed: number;
  cost: number;

  constructor(unitType: UnitType, popCost: number, skillId: string, baseSpeed: number, cost: number) {
    this.unitType = unitType;
    this.popCost = popCost;
    this.skillId = skillId;
    this.baseSpeed = baseSpeed;
    this.cost = cost;
  }
}
