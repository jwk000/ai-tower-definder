import { CType, type UnitType } from '../types/index.js';

export class Unit {
  readonly type = CType.Unit;
  unitType: UnitType;
  popCost: number;
  skillId: string;
  baseSpeed: number;
  cost: number;
  homeX: number;
  homeY: number;
  moveRange: number;

  constructor(unitType: UnitType, popCost: number, skillId: string, baseSpeed: number, cost: number, homeX: number = 0, homeY: number = 0, moveRange: number = 200) {
    this.unitType = unitType;
    this.popCost = popCost;
    this.skillId = skillId;
    this.baseSpeed = baseSpeed;
    this.cost = cost;
    this.homeX = homeX;
    this.homeY = homeY;
    this.moveRange = moveRange;
  }
}
