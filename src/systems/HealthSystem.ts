import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Health,
  Boss,
  UnitTag,
  Category,
  CategoryVal,
  Movement,
  BatSwarmMember,
  PlayerOwned,
  GoldChest,
} from '../core/components.js';
import { GamePhase } from '../types/index.js';

const healthQuery = defineQuery([Health]);
const bossQuery = defineQuery([Health, Boss]);
const enemyMovementQuery = defineQuery([Movement, UnitTag]);

/** Destroys dead entities and checks win/lose conditions */
export class HealthSystem implements System {
  readonly name = 'HealthSystem';

  private enemyPauseTimer: number = 0;
  private pausedThisTransition: boolean = false;

  constructor(
    private getPhase: () => GamePhase,
    private setPhase: (p: GamePhase) => void,
    private onEnemyKilled: (id: number) => void,
    private onUnitDied?: (id: number) => void,
    private onBatDied?: (id: number) => void,
  ) {}

  update(world: TowerWorld, dt: number): void {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return;

    this.updateBossPhaseTransitions(world);
    this.updateEnemyPause(world, dt);

    let baseAlive = true;
    const entities = healthQuery(world.world);

    for (const eid of entities) {
      if (Health.current[eid]! > 0) continue;

      // Enemy (includes bosses — they also have UnitTag.isEnemy === 1)
      if (UnitTag.isEnemy[eid] === 1) {
        this.onEnemyKilled(eid);
        world.destroyEntity(eid);
      }
      // Bat swarm member
      else if (BatSwarmMember.parentId[eid] !== undefined) {
        this.onBatDied?.(eid);
        world.destroyEntity(eid);
      }
      // Player unit (soldier)
      else if (
        Category.value[eid] === CategoryVal.Soldier &&
        hasComponent(world.world, eid, PlayerOwned)
      ) {
        this.onUnitDied?.(eid);
        world.destroyEntity(eid);
      }
      // Gold chest — just destroy (callback removed in bitecs migration)
      else if (GoldChest.goldMin[eid] !== undefined) {
        world.destroyEntity(eid);
      }
      // Tower or building / production
      else if (
        Category.value[eid] === CategoryVal.Tower ||
        Category.value[eid] === CategoryVal.Building
      ) {
        world.destroyEntity(eid);
      }
      // Base entity — has Health but none of the above component types
      else {
        baseAlive = false;
      }
    }

    if (!baseAlive) {
      this.setPhase(GamePhase.Defeat);
    }
  }

  private updateBossPhaseTransitions(world: TowerWorld): void {
    const bosses = bossQuery(world.world);
    for (const bossId of bosses) {
      if (Boss.transitionTimer[bossId]! > 0) {
        Boss.transitionTimer[bossId] = Math.max(0, Boss.transitionTimer[bossId]! - 1 / 60);
      }

      if (
        Boss.phase[bossId] === 1 &&
        Health.current[bossId]! / Health.max[bossId]! < Boss.phase2HpRatio[bossId]!
      ) {
        Boss.phase[bossId] = 2;
        Boss.transitionTimer[bossId] = 0.5;
        this.enemyPauseTimer = 0.3;
        this.pausedThisTransition = false;
      }
    }
  }

  private updateEnemyPause(world: TowerWorld, dt: number): void {
    if (this.enemyPauseTimer > 0) {
      this.enemyPauseTimer -= dt;

      if (!this.pausedThisTransition) {
        this.pausedThisTransition = true;
        const enemies = enemyMovementQuery(world.world);
        for (const eid of enemies) {
          if (UnitTag.isEnemy[eid] === 1) {
            Movement.currentSpeed[eid] = 0;
          }
        }
      }

      if (this.enemyPauseTimer <= 0) {
        const enemies = enemyMovementQuery(world.world);
        for (const eid of enemies) {
          if (UnitTag.isEnemy[eid] === 1) {
            Movement.currentSpeed[eid] = Movement.speed[eid]!;
          }
        }
      }
    }
  }
}
