import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, GamePhase } from '../types/index.js';
import { Health } from '../components/Health.js';

/** Destroys dead entities and checks win/lose conditions */
export class HealthSystem implements System {
  readonly name = 'HealthSystem';
  readonly requiredComponents = [CType.Health] as const;

  constructor(
    private world: World,
    private getPhase: () => GamePhase,
    private setPhase: (phase: GamePhase) => void,
    private onEnemyKilled: (enemyId: number) => void,
  ) {}

  update(entities: number[], _dt: number): void {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return;

    let baseAlive = true;

    for (const id of entities) {
      const health = this.world.getComponent<Health>(id, CType.Health)!;

      if (!health.alive) {
        const isEnemy = this.world.hasComponent(id, CType.Enemy);

        if (isEnemy) {
          this.onEnemyKilled(id);
          this.world.destroyEntity(id);
        } else if (!this.world.hasComponent(id, CType.Tower)) {
          // This is the base entity
          baseAlive = false;
        } else {
          // Tower destroyed — remove it
          this.world.destroyEntity(id);
        }
      }
    }

    if (!baseAlive) {
      this.setPhase(GamePhase.Defeat);
    }
  }
}
