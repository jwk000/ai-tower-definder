import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Health,
  UnitTag,
  Attack,
  DeathEffect,
  ExplosionEffect,
  Position,
  Visual,
  Category,
  ShapeVal,
  enemyQuery,
} from '../core/components.js';
import { ruleEngine } from '../core/RuleEngine.js';

const healthUnitQuery = defineQuery([Health, UnitTag]);

/**
 * 生命周期系统 — 检测单位死亡/创建事件，分发给 RuleEngine
 *
 * onDeath: 派发事件 → 创建死亡特效 → 销毁实体
 * onCreate: 追踪首次出现的实体，派发一次性事件
 */
export class LifecycleSystem implements System {
  readonly name = 'LifecycleSystem';

  /** 实体创建时间追踪（entityId → 创建时刻秒） */
  private creationTimes = new Map<number, number>();

  update(world: TowerWorld, _dt: number): void {
    const entities = healthUnitQuery(world.world);
    const now = performance.now() / 1000;

    for (const eid of entities) {
      const currentHp = Health.current[eid];

      if (currentHp !== undefined && currentHp <= 0) {
        ruleEngine.dispatch(world.world, eid, 'onDeath', { time: now });

        // 清除指向该实体的所有 enemy Attack.targetId 引用，避免实体回收后下一帧
        // 错误地对新占用该 entity slot 的实体执行 releaseTaunt（attackerCount-- 错乱）
        const enemies = enemyQuery(world.world);
        for (const enemyId of enemies) {
          if (Attack.targetId[enemyId] === eid) {
            Attack.targetId[enemyId] = 0;
          }
        }

        const posX = Position.x[eid] ?? 0;
        const posY = Position.y[eid] ?? 0;
        const colorR = Visual.colorR[eid] ?? 255;
        const colorG = Visual.colorG[eid] ?? 0;
        const colorB = Visual.colorB[eid] ?? 0;
        const size = Visual.size[eid] ?? 24;

        const effectEid = world.createEntity();
        world.addComponent(effectEid, Position, { x: posX, y: posY });
        world.addComponent(effectEid, Visual, {
          shape: ShapeVal.Circle,
          colorR,
          colorG,
          colorB,
          size,
        });
        world.addComponent(effectEid, DeathEffect, { duration: 0.3 });

        world.destroyEntity(eid);
      } else if (currentHp !== undefined && currentHp > 0) {
        // 首次见到该实体 → 派发 onCreate 事件（仅一次）
        if (!this.creationTimes.has(eid)) {
          this.creationTimes.set(eid, now);
          ruleEngine.dispatch(world.world, eid, 'onCreate', { time: now });
        }
      }
    }

    // 清理已被销毁实体的追踪记录
    const currentEids = new Set(entities);
    for (const eid of this.creationTimes.keys()) {
      if (!currentEids.has(eid)) {
        this.creationTimes.delete(eid);
      }
    }
  }
}
