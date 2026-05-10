import { CType, type EntityId } from '../types/index.js';

export class BatSwarmMember {
  readonly type = CType.BatSwarmMember;

  homeTowerId: EntityId;
  vx: number;
  vy: number;
  cooldown: number;

  constructor(homeTowerId: EntityId) {
    this.homeTowerId = homeTowerId;
    this.vx = 0;
    this.vy = 0;
    this.cooldown = 0;
  }
}
