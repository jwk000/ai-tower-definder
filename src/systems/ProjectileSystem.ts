import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, TowerType, BuffAttribute } from '../types/index.js';
import type { BuffInstance } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Projectile } from '../components/Projectile.js';
import { Health } from '../components/Health.js';
import { Movement } from '../components/Movement.js';
import { Enemy } from '../components/Enemy.js';
import { BuffContainer } from '../components/Buff.js';
import { Render } from '../components/Render.js';

const LIGHTNING_RENDER = { shape: 'triangle' as const, color: '#fff176', size: 10 };

/** Moves projectiles toward their targets, deals damage on impact, applies special effects */
export class ProjectileSystem implements System {
  readonly name = 'ProjectileSystem';
  readonly requiredComponents = [CType.Position, CType.Projectile] as const;

  private originalSpeeds: Map<number, number> = new Map();

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    this.tickBuffDurations(dt);

    for (const id of entities) {
      const pos = this.world.getComponent<Position>(id, CType.Position)!;
      const proj = this.world.getComponent<Projectile>(id, CType.Projectile)!;

      if (!this.world.isAlive(proj.targetId)) {
        this.world.destroyEntity(id);
        continue;
      }

      const targetPos = this.world.getComponent<Position>(proj.targetId, CType.Position);
      if (!targetPos) {
        this.world.destroyEntity(id);
        continue;
      }

      if (!this.world.isAlive(proj.targetId)) {
        this.world.destroyEntity(id);
        continue;
      }

      const dx = targetPos.x - pos.x;
      const dy = targetPos.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = proj.speed * dt;

      if (dist <= moveDist + 2) {
        this.onHit(id, proj, targetPos.x, targetPos.y);
        this.world.destroyEntity(id);
      } else {
        pos.x += (dx / dist) * moveDist;
        pos.y += (dy / dist) * moveDist;
      }
    }
  }

  private tickBuffDurations(dt: number): void {
    const buffEntities = this.world.query(CType.Buff);
    for (const id of buffEntities) {
      const container = this.world.getComponent<BuffContainer>(id, CType.Buff);
      if (!container) continue;

      const toRemove: string[] = [];
      for (const [buffId, b] of container.buffs) {
        if (b.duration > 0) {
          b.duration -= dt;
          if (b.duration <= 0) {
            this.onBuffExpire(id, b);
            toRemove.push(buffId);
          }
        }
      }
      for (const buffId of toRemove) {
        container.removeBuff(buffId);
      }
    }
  }

  private onBuffExpire(entityId: number, buff: BuffInstance): void {
    if (buff.id === 'ice_frozen') {
      const originalSpeed = this.originalSpeeds.get(entityId);
      if (originalSpeed !== undefined) {
        const mov = this.world.getComponent<Movement>(entityId, CType.Movement);
        if (mov) {
          mov.speed = originalSpeed;
        }
        this.originalSpeeds.delete(entityId);
      }
    }
  }

  private onHit(projectileId: number, proj: Projectile, hitX: number, hitY: number): void {
    const health = this.world.getComponent<Health>(proj.targetId, CType.Health);
    if (health && this.world.isAlive(proj.targetId)) {
      health.takeDamage(proj.damage);
    }

    // Hit flash on main target
    const targetRender = this.world.getComponent<Render>(proj.targetId, CType.Render);
    if (targetRender) {
      targetRender.hitFlashTimer = 0.12;
    }

    const towerType = proj.sourceTowerType as TowerType;

    switch (towerType) {
      case TowerType.Cannon:
        this.applyCannonSplash(proj, hitX, hitY);
        break;
      case TowerType.Ice:
        this.applyIceSlow(proj);
        break;
      case TowerType.Lightning:
        if (!proj.isChain) {
          this.applyLightningChain(proj, hitX, hitY);
        }
        break;
    }
  }

  private applyCannonSplash(proj: Projectile, hitX: number, hitY: number): void {
    const splashRadius = proj.splashRadius ?? 80;
    const stunDuration = proj.stunDuration ?? 1.5;
    const splashDamage = proj.damage * 0.6;

    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
    for (const enemyId of enemies) {
      if (!this.world.isAlive(enemyId)) continue;
      const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
      if (!ePos) continue;

      const dx = ePos.x - hitX;
      const dy = ePos.y - hitY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= splashRadius) {
        if (enemyId !== proj.targetId) {
          const eHealth = this.world.getComponent<Health>(enemyId, CType.Health);
          if (eHealth) eHealth.takeDamage(splashDamage);

          const eRender = this.world.getComponent<Render>(enemyId, CType.Render);
          if (eRender) {
            eRender.hitFlashTimer = 0.12;
          }
        }

        // Stun effect: enemies stop moving for stunDuration (skip bosses)
        const isBoss = this.world.hasComponent(enemyId, CType.Boss);
        if (!isBoss) {
          const enemy = this.world.getComponent<Enemy>(enemyId, CType.Enemy);
          if (enemy) {
            enemy.stunTimer = Math.max(enemy.stunTimer, stunDuration);
          }
        }
      }
    }
  }

  private applyIceSlow(proj: Projectile): void {
    const targetId = proj.targetId;
    if (!this.world.isAlive(targetId)) return;

    const slowPercent = proj.slowPercent ?? 20;
    const maxStacks = proj.slowMaxStacks ?? 5;
    const freezeDuration = proj.freezeDuration ?? 1.0;

    let container = this.world.getComponent<BuffContainer>(targetId, CType.Buff);
    if (!container) {
      container = new BuffContainer();
      this.world.addComponent(targetId, container);
    }

    const existingFrozen = container.buffs.get('ice_frozen');
    if (existingFrozen) return;

    const mov = this.world.getComponent<Movement>(targetId, CType.Movement);
    if (!mov) return;

    const existingSlow = container.buffs.get('ice_slow');

    if (!this.originalSpeeds.has(targetId) && !existingSlow) {
      this.originalSpeeds.set(targetId, mov.speed);
    }

    const originalSpeed = this.originalSpeeds.get(targetId) ?? mov.speed;

    if (existingSlow) {
      existingSlow.currentStacks = Math.min(existingSlow.currentStacks + 1, maxStacks);
      existingSlow.duration = 3.0;

      if (existingSlow.currentStacks >= maxStacks) {
        container.removeBuff('ice_slow');

        container.addBuff({
          id: 'ice_frozen',
          name: '冰冻',
          attribute: BuffAttribute.Speed,
          value: 0,
          isPercent: false,
          duration: freezeDuration,
          maxStacks: 1,
          currentStacks: 1,
          sourceEntityId: proj.sourceTowerId,
        });

        mov.speed = 0;
        return;
      }
    } else {
      container.addBuff({
        id: 'ice_slow',
        name: '寒冰',
        attribute: BuffAttribute.Speed,
        value: slowPercent,
        isPercent: true,
        duration: 3.0,
        maxStacks: maxStacks,
        currentStacks: 1,
        sourceEntityId: proj.sourceTowerId,
      });
    }

    const totalSlow = (existingSlow?.currentStacks ?? 1) * (slowPercent / 100);
    mov.speed = originalSpeed * (1 - totalSlow);
  }

  private applyLightningChain(proj: Projectile, hitX: number, hitY: number): void {
    const chainRange = proj.chainRange ?? 120;
    const chainCount = proj.chainCount ?? 3;
    const chainDecay = proj.chainDecay ?? 0.2;

    const hitIds = new Set<number>([proj.targetId]);
    let fromX = hitX;
    let fromY = hitY;

    for (let n = 0; n < chainCount - 1; n++) {
      const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);

      let nearestId: number | null = null;
      let nearestDist = chainRange + 1;

      for (const enemyId of enemies) {
        if (hitIds.has(enemyId) || !this.world.isAlive(enemyId)) continue;
        const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
        if (!ePos) continue;

        const dx = ePos.x - fromX;
        const dy = ePos.y - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= chainRange && dist < nearestDist) {
          nearestDist = dist;
          nearestId = enemyId;
        }
      }

      if (nearestId === null) break;

      hitIds.add(nearestId);
      const ePos = this.world.getComponent<Position>(nearestId, CType.Position)!;
      const chainDamage = proj.damage * Math.pow(0.8, n);

      const pid = this.world.createEntity();
      this.world.addComponent(pid, new Position(fromX, fromY));
      const chainProj = new Projectile(nearestId, 600, chainDamage, fromX, fromY);
      chainProj.sourceTowerId = proj.sourceTowerId;
      chainProj.sourceTowerType = TowerType.Lightning;
      chainProj.isChain = true;
      chainProj.chainIndex = n + 1;
      this.world.addComponent(pid, chainProj);

      const render = new Render(LIGHTNING_RENDER.shape, LIGHTNING_RENDER.color, LIGHTNING_RENDER.size);
      render.targetEntityId = nearestId;
      this.world.addComponent(pid, render);

      fromX = ePos.x;
      fromY = ePos.y;
    }
  }
}
