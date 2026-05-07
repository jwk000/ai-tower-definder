import { CType } from '../types/index.js';

export class PlayerControllable {
  readonly type = CType.PlayerControllable;
  selected: boolean;
  targetX: number | null;
  targetY: number | null;

  constructor() {
    this.selected = false;
    this.targetX = null;
    this.targetY = null;
  }
}
