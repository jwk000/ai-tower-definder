import { TowerWorld, defineQuery, hasComponent } from '../core/World.js';
import { Position, Health, Faction, PlayerOwned } from '../core/components.js';
import type { RunContext } from './RunContext.js';
import type { CardConfig } from '../config/cardRegistry.js';

// v3.0 roguelike — B3 SpellCastSystem 法术卡释放
// 设计文档锚点：
//   - design/25-card-roguelike-refactor.md §2 卡牌系统（spell 类即用即弃）
//   - design/14-acceptance-criteria.md §3.3 法术卡释放契约
//   - design/02-unit-system.md §8 规则引擎调度
//
// 设计边界：
//   - SpellSystem 不接 ECS pipeline；由 main.ts 在玩家点击地图时主动调用 executeSpell。
//   - playCard 已扣能量 + 入弃牌堆（RunContext line 137）；本系统仅做 ECS 副作用。
//   - 调用契约：先 playCard 成功返回 {instance, config} → 玩家选目标 → executeSpell。

export interface SpellTarget {
  x: number;
  y: number;
}

export interface SpellHitResult {
  hits: number;
  totalDamage: number;
  targetIds: readonly number[];
}

const enemyTargetsQuery = defineQuery([Position, Health, Faction]);
const allLivingQuery = defineQuery([Position, Health]);

export class SpellSystem {
  constructor(private world: TowerWorld) {}

  executeSpell(config: CardConfig, target: SpellTarget): SpellHitResult {
    const effect = (config as Record<string, unknown>)['spellEffect'];
    if (typeof effect !== 'object' || effect === null) {
      return { hits: 0, totalDamage: 0, targetIds: [] };
    }
    const spec = effect as Record<string, unknown>;
    const handler = String(spec['handler'] ?? '');
    if (handler === 'aoe_damage') {
      return this.dispatchAoeDamage(spec, target);
    }
    return { hits: 0, totalDamage: 0, targetIds: [] };
  }

  private dispatchAoeDamage(
    spec: Record<string, unknown>,
    target: SpellTarget,
  ): SpellHitResult {
    const damage = Number(spec['damage'] ?? 0);
    const radius = Number(spec['radius'] ?? 0);
    const affectAlly = spec['affectAlly'] === true;

    const r2 = radius * radius;
    const w = this.world.world;
    const hitIds: number[] = [];
    let totalDamage = 0;

    const factioned = enemyTargetsQuery(w);
    for (const eid of factioned) {
      const hp = Health.current[eid];
      if (hp === undefined || hp <= 0) continue;
      const faction = Faction.value[eid];
      if (!affectAlly && faction === 0) continue;
      if (!this.isWithinR2(eid, target, r2)) continue;
      this.applyDamage(eid, damage);
      hitIds.push(eid);
      totalDamage += damage;
    }

    if (affectAlly) {
      const allLiving = allLivingQuery(w);
      for (const eid of allLiving) {
        if (hitIds.includes(eid)) continue;
        const hp = Health.current[eid];
        if (hp === undefined || hp <= 0) continue;
        if (Faction.value[eid] !== undefined) continue;
        if (!hasComponent(w, PlayerOwned, eid)) continue;
        if (!this.isWithinR2(eid, target, r2)) continue;
        this.applyDamage(eid, damage);
        hitIds.push(eid);
        totalDamage += damage;
      }
    }

    return { hits: hitIds.length, totalDamage, targetIds: hitIds };
  }

  private isWithinR2(eid: number, target: SpellTarget, r2: number): boolean {
    const px = Position.x[eid];
    const py = Position.y[eid];
    if (px === undefined || py === undefined) return false;
    const dx = px - target.x;
    const dy = py - target.y;
    return dx * dx + dy * dy <= r2;
  }

  private applyDamage(eid: number, dmg: number): void {
    const cur = Health.current[eid] ?? 0;
    Health.current[eid] = Math.max(0, cur - dmg);
  }
}
