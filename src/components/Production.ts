import { CType, type ProductionType } from '../types/index.js';

export class Production {
  readonly type = CType.Production;
  productionType: ProductionType;
  resourceType: 'gold' | 'energy';
  rate: number;
  level: number;
  maxLevel: number;
  accumulator: number;

  constructor(productionType: ProductionType, resourceType: 'gold' | 'energy', rate: number, maxLevel: number) {
    this.productionType = productionType;
    this.resourceType = resourceType;
    this.rate = rate;
    this.level = 1;
    this.maxLevel = maxLevel;
    this.accumulator = 0;
  }
}
