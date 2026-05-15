import { Pipeline } from './pipeline.js';
import type { RuleEngine } from './RuleEngine.js';
import { createTowerWorld, type TowerWorld } from './World.js';

const MAX_DT_SECONDS = 0.25;

export class Game {
  readonly world: TowerWorld;
  readonly pipeline: Pipeline;
  readonly ruleEngine: RuleEngine;

  constructor() {
    this.world = createTowerWorld();
    this.pipeline = new Pipeline();
    this.ruleEngine = this.world.ruleEngine;
  }

  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error(`[Game] tick(dt) requires positive finite dt, got ${dt}`);
    }
    const effective = dt > MAX_DT_SECONDS ? MAX_DT_SECONDS : dt;
    this.world.time.dt = effective;
    this.world.time.elapsed += effective;
    this.pipeline.execute(this.world, effective);
  }
}
