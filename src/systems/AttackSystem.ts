import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, TowerType, type ShapeType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Projectile } from '../components/Projectile.js';
import { Render } from '../components/Render.js';
import { Health } from '../components/Health.js';
import { LightningBolt } from '../components/LightningBolt.js';
import { LightningAura } from '../components/LightningAura.js';
import { Renderer } from '../render/Renderer.js';
import { TOWER_CONFIGS } from '../data/gameData.js';

const PROJECTILE_CFG: Record<TowerType, { speed: number; shape: ShapeType; color: string; size: number }> = {
  [TowerType.Arrow]:     { speed: 420, shape: 'arrow',    color: '#81d4fa', size: 24 },
  [TowerType.Cannon]:    { speed: 280, shape: 'circle',   color: '#222222', size: 16 },
  [TowerType.Ice]:       { speed: 350, shape: 'diamond',  color: '#81d4fa', size: 12 },
  [TowerType.Lightning]: { speed: 600, shape: 'triangle', color: '#fff176', size: 10 },
};

/** Towers attack nearest enemy in range by spawning projectiles */
export class AttackSystem implements System {
  readonly name = 'AttackSystem';
  readonly requiredComponents = [CType.Position, CType.Attack, CType.Tower] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);

    for (const towerId of entities) {
      const pos = this.world.getComponent<Position>(towerId, CType.Position)!;
      const atk = this.world.getComponent<Attack>(towerId, CType.Attack)!;
      const tower = this.world.getComponent<Tower>(towerId, CType.Tower)!;

      atk.tickCooldown(dt);
      if (!atk.canAttack) continue;

      let nearestId: number | null = null;
      let nearestDist = Infinity;

      for (const enemyId of enemies) {
        const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
        if (!ePos) continue;
        const dx = ePos.x - pos.x;
        const dy = ePos.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= atk.range && dist < nearestDist) {
          nearestDist = dist;
          nearestId = enemyId;
        }
      }

      if (nearestId !== null) {
        atk.resetCooldown();
        if (tower.towerType === TowerType.Lightning) {
          this.doLightningAttack(towerId, nearestId, pos.x, pos.y, tower.level);
        } else {
          this.spawnProjectile(tower.towerType, towerId, nearestId, pos.x, pos.y);
        }
      }
    }
  }

  private spawnProjectile(
    type: TowerType, towerId: number, targetId: number,
    fromX: number, fromY: number,
  ): void {
    const cfg = PROJECTILE_CFG[type];
    if (!cfg) return;

    const towerCfg = TOWER_CONFIGS[type];
    const damage = this.getDamage(towerId);

    const pid = this.world.createEntity();
    this.world.addComponent(pid, new Position(fromX, fromY));
    const proj = new Projectile(targetId, cfg.speed, damage, fromX, fromY);
    proj.sourceTowerId = towerId;
    proj.sourceTowerType = type;
    if (towerCfg) {
      proj.splashRadius = towerCfg.splashRadius;
      proj.stunDuration = towerCfg.stunDuration;
      proj.slowPercent = towerCfg.slowPercent;
      proj.slowMaxStacks = towerCfg.slowMaxStacks;
      proj.freezeDuration = towerCfg.freezeDuration;
      proj.chainCount = towerCfg.chainCount;
      proj.chainRange = towerCfg.chainRange;
      proj.chainDecay = towerCfg.chainDecay;
    }
    this.world.addComponent(pid, proj);

    const render = new Render(cfg.shape, cfg.color, cfg.size);
    render.targetEntityId = targetId;
    this.world.addComponent(pid, render);
  }

  private getDamage(towerId: number): number {
    const atk = this.world.getComponent<Attack>(towerId, CType.Attack);
    return atk?.atk ?? 10;
  }

  /** Instant chain lightning — no projectile travel */
  private doLightningAttack(towerId: number, primaryId: number, fromX: number, fromY: number, level: number): void {
    const config = TOWER_CONFIGS[TowerType.Lightning];
    if (!config) return;

    const baseDamage = this.getDamage(towerId);
    const chainCount = (config.chainCount ?? 3) + (level - 1);
    const chainDecay = config.chainDecay ?? 0.2;
    const chainRange = config.chainRange ?? 120;

    const hit = new Set<number>();
    let dmg = baseDamage;
    let fromX2 = fromX;
    let fromY2 = fromY;
    let targetId = primaryId;

    for (let hop = 0; hop < chainCount; hop++) {
      if (hit.has(targetId)) break;
      hit.add(targetId);

      // Deal damage
      const health = this.world.getComponent<Health>(targetId, CType.Health);
      if (health && this.world.isAlive(targetId)) {
        health.takeDamage(dmg);
      }

      // Hit flash
      const render = this.world.getComponent<Render>(targetId, CType.Render);
      if (render) render.hitFlashTimer = 0.12;

      // Lightning bolt visual
      const toPos = this.world.getComponent<Position>(targetId, CType.Position);
      if (toPos) {
        this.spawnLightningBolt(fromX2, fromY2, toPos.x, toPos.y);
        fromX2 = toPos.x;
        fromY2 = toPos.y;
      }

      // White ring aura on hit enemy
      this.spawnLightningAura(targetId);

      // Find next chain target
      if (hop < chainCount - 1) {
        dmg *= (1 - chainDecay);
        let nearestId: number | null = null;
        let nearestDist = chainRange;

        const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
        const origin = this.world.getComponent<Position>(targetId, CType.Position);
        for (const eid of enemies) {
          if (hit.has(eid)) continue;
          const ep = this.world.getComponent<Position>(eid, CType.Position);
          if (!ep || !origin) continue;
          const dx = ep.x - origin.x;
          const dy = ep.y - origin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestId = eid;
          }
        }
        targetId = nearestId ?? targetId; // if no target found, break on next iteration
      }
    }
  }

  private spawnLightningBolt(fromX: number, fromY: number, toX: number, toY: number): void {
    const id = this.world.createEntity();
    this.world.addComponent(id, new LightningBolt(fromX, fromY, toX, toY, 0.5));
  }

  private spawnLightningAura(enemyId: number): void {
    const pos = this.world.getComponent<Position>(enemyId, CType.Position);
    if (!pos) return;
    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(pos.x, pos.y));
    this.world.addComponent(id, new Render('circle', '#ffffff', 30));
    this.world.addComponent(id, new LightningAura(0.5));
  }
}
