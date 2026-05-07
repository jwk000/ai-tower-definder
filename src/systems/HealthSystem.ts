import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, GamePhase } from '../types/index.js';
import { Health } from '../components/Health.js';
import { Boss } from '../components/Boss.js';
import { Enemy } from '../components/Enemy.js';
import { GoldChest } from '../components/GoldChest.js';

/** Destroys dead entities and checks win/lose conditions */
export class HealthSystem implements System {
  readonly name = 'HealthSystem';
  readonly requiredComponents = [CType.Health] as const;

  private enemyPauseTimer: number = 0;
  private pausedThisTransition: boolean = false;

  constructor(
    private world: World,
    private getPhase: () => GamePhase,
    private setPhase: (phase: GamePhase) => void,
    private onEnemyKilled: (enemyId: number) => void,
    private onUnitDied?: (unitId: number) => void,
    private onChestDestroyed?: (chestId: number) => void,
  ) {}

  update(entities: number[], dt: number): void {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return;

    this.updateBossPhaseTransitions();
    this.updateEnemyPause(dt);

    let baseAlive = true;

    for (const id of entities) {
      const health = this.world.getComponent<Health>(id, CType.Health)!;

      if (!health.alive) {
        const isEnemy = this.world.hasComponent(id, CType.Enemy);
        const isTower = this.world.hasComponent(id, CType.Tower);
        const isProduction = this.world.hasComponent(id, CType.Production);
        const isUnit = this.world.hasComponent(id, CType.Unit);
        const isChest = this.world.hasComponent(id, CType.GoldChest);

        if (isEnemy) {
          this.onEnemyKilled(id);
          this.world.destroyEntity(id);
        } else if (isUnit) {
          this.onUnitDied?.(id);
          this.world.destroyEntity(id);
        } else if (isChest) {
          this.onChestDestroyed?.(id);
          this.world.destroyEntity(id);
        } else if (isTower || isProduction) {
          this.world.destroyEntity(id);
        } else {
          baseAlive = false;
        }
      }
    }

    if (!baseAlive) {
      this.setPhase(GamePhase.Defeat);
    }
  }

  private updateBossPhaseTransitions(): void {
    const bosses = this.world.query(CType.Boss, CType.Health);
    for (const bossId of bosses) {
      const boss = this.world.getComponent<Boss>(bossId, CType.Boss);
      const health = this.world.getComponent<Health>(bossId, CType.Health);
      if (!boss || !health) continue;

      if (boss.phaseTransitionTimer > 0) {
        boss.phaseTransitionTimer = Math.max(0, boss.phaseTransitionTimer - 1 / 60);
      }

      if (boss.phase === 1 && health.ratio <= boss.phase2HpRatio) {
        boss.phase = 2;
        boss.phaseTransitionTimer = 0.5;
        this.enemyPauseTimer = 0.3;
        this.pausedThisTransition = false;
      }
    }
  }

  private updateEnemyPause(dt: number): void {
    if (this.enemyPauseTimer > 0) {
      this.enemyPauseTimer -= dt;

      if (!this.pausedThisTransition) {
        this.pausedThisTransition = true;
        const enemies = this.world.query(CType.Enemy);
        for (const id of enemies) {
          const enemy = this.world.getComponent<Enemy>(id, CType.Enemy);
          if (enemy) enemy.movementPaused = true;
        }
      }

      if (this.enemyPauseTimer <= 0) {
        const enemies = this.world.query(CType.Enemy);
        for (const id of enemies) {
          const enemy = this.world.getComponent<Enemy>(id, CType.Enemy);
          if (enemy) enemy.movementPaused = false;
        }
      }
    }
  }
}
