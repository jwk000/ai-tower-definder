import { CType } from '../types/index.js';

export class GoldChest {
  readonly type = CType.GoldChest;
  goldAmount: number;

  constructor(goldAmount: number) {
    this.goldAmount = goldAmount;
  }
}
