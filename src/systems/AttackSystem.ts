import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, TowerType, type ShapeType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Projectile } from '../components/Projectile.js';
import { Render } from '../components/Render.js';
import { TOWER_CONFIGS } from '../data/gameData.js';

const PROJECTILE_CFG: Record<TowerType, { speed: number; shape: ShapeType; color: string; size: number }> = {
  [TowerType.Arrow]:     { speed: 420, shape: 'arrow',    color: '#81d4fa', size: 24 },
  [TowerType.Cannon]:    { speed: 300, shape: 'circle',   color: '#ff8a65', size: 14 },
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
        this.spawnProjectile(tower.towerType, towerId, nearestId, pos.x, pos.y);
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
      proj.knockback = towerCfg.knockback;
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
}
