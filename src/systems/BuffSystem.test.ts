/**
 * BuffSystem v1.1 测试 — P1-#10
 *
 * 对应设计文档:
 * - design/04-skill-buff-system.md §3.2.1 (全局上限 + LRU)
 * - design/04-skill-buff-system.md §3.2.2 (优先级)
 * - design/04-skill-buff-system.md §3.2.3 (来源死亡清除)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { Faction, FactionVal } from '../core/components.js';
import {
  BuffSystem,
  addBuff,
  removeBuff,
  getBuffs,
  clearAllBuffs,
  BuffPriority,
  MAX_BUFFS_PER_ENTITY,
  type BuffData,
} from './BuffSystem.js';

function makeBuff(overrides: Partial<BuffData>): BuffData {
  return {
    id: 'test',
    attribute: 'atk',
    value: 10,
    isPercent: false,
    duration: 5,
    stacks: 1,
    maxStacks: 3,
    sourceId: 1,
    priority: BuffPriority.Buff,
    removeOnSourceDeath: false,
    ...overrides,
  };
}

function makeEntity(world: TowerWorld, faction: number = FactionVal.Enemy): number {
  const eid = world.createEntity();
  world.addComponent(eid, Faction, { value: faction });
  return eid;
}

describe('BuffSystem v1.1 — capacity & LRU (§3.2.1)', () => {
  let world: TowerWorld;

  beforeEach(() => {
    clearAllBuffs();
    world = new TowerWorld();
  });

  it('单实体最多容纳 MAX_BUFFS_PER_ENTITY (8) 个不同 buff', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    for (let i = 0; i < MAX_BUFFS_PER_ENTITY; i++) {
      addBuff(world, target, makeBuff({ id: `b${i}`, sourceId: source }));
    }
    expect(getBuffs(target)).toHaveLength(MAX_BUFFS_PER_ENTITY);
  });

  it('达到上限后，低优先级 buff 被新的高优先级 buff 淘汰', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    // 填满 8 个 Mark (priority 6, 最低)
    for (let i = 0; i < MAX_BUFFS_PER_ENTITY; i++) {
      addBuff(world, target, makeBuff({ id: `mark${i}`, priority: BuffPriority.Mark, sourceId: source }));
    }
    // 新增 stun (priority 1) 应淘汰一个 mark
    addBuff(world, target, makeBuff({ id: 'stun_new', priority: BuffPriority.Stun, sourceId: source }));
    const ids = getBuffs(target).map((b) => b.id);
    expect(ids).toHaveLength(MAX_BUFFS_PER_ENTITY);
    expect(ids).toContain('stun_new');
    expect(ids.filter((id) => id.startsWith('mark'))).toHaveLength(MAX_BUFFS_PER_ENTITY - 1);
  });

  it('同优先级时淘汰最早 appliedAt 的 buff (LRU tie-break)', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    for (let i = 0; i < MAX_BUFFS_PER_ENTITY; i++) {
      addBuff(world, target, makeBuff({ id: `b${i}`, priority: BuffPriority.Buff, sourceId: source }));
    }
    // 加一个更高优先级的（Slow=3 < Buff=5），应淘汰 b0（最早）
    addBuff(world, target, makeBuff({ id: 'slow_new', priority: BuffPriority.Slow, sourceId: source }));
    const ids = getBuffs(target).map((b) => b.id);
    expect(ids).not.toContain('b0');
    expect(ids).toContain('slow_new');
  });

  it('当新 buff 不如所有现有 buff 重要时，新 buff 被静默拒绝', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    // 填满 8 个 Stun (priority 1, 最高)
    for (let i = 0; i < MAX_BUFFS_PER_ENTITY; i++) {
      addBuff(world, target, makeBuff({ id: `stun${i}`, priority: BuffPriority.Stun, sourceId: source }));
    }
    // 试图加 Mark (priority 6) 应被拒绝
    addBuff(world, target, makeBuff({ id: 'mark_rejected', priority: BuffPriority.Mark, sourceId: source }));
    const ids = getBuffs(target).map((b) => b.id);
    expect(ids).not.toContain('mark_rejected');
    expect(ids).toHaveLength(MAX_BUFFS_PER_ENTITY);
  });

  it('同名 buff 刷新而非新增，不触发 LRU', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    for (let i = 0; i < MAX_BUFFS_PER_ENTITY; i++) {
      addBuff(world, target, makeBuff({ id: `b${i}`, sourceId: source }));
    }
    // 重复 b0 — 应只刷新，不新增
    addBuff(world, target, makeBuff({ id: 'b0', duration: 99, sourceId: source }));
    const buffs = getBuffs(target);
    expect(buffs).toHaveLength(MAX_BUFFS_PER_ENTITY);
    expect(buffs.find((b) => b.id === 'b0')?.duration).toBe(99);
  });
});

describe('BuffSystem v1.1 — player-faction protection (§3.2.1)', () => {
  let world: TowerWorld;

  beforeEach(() => {
    clearAllBuffs();
    world = new TowerWorld();
  });

  it('玩家阵营施加的 buff 不会被敌方 buff 淘汰', () => {
    const target = makeEntity(world);
    const playerSource = makeEntity(world, FactionVal.Player);
    const enemySource = makeEntity(world, FactionVal.Enemy);

    // 玩家加 1 个低优先级 buff (Mark)
    addBuff(world, target, makeBuff({ id: 'player_mark', priority: BuffPriority.Mark, sourceId: playerSource }));
    // 敌方填满剩余 7 个高优先级 buff (Stun)
    for (let i = 0; i < MAX_BUFFS_PER_ENTITY - 1; i++) {
      addBuff(world, target, makeBuff({ id: `enemy_stun${i}`, priority: BuffPriority.Stun, sourceId: enemySource }));
    }
    // 敌方再加一个 — 应淘汰另一个敌方 Stun，而不是 player_mark
    addBuff(world, target, makeBuff({ id: 'enemy_stun_new', priority: BuffPriority.Stun, sourceId: enemySource }));
    const ids = getBuffs(target).map((b) => b.id);
    expect(ids).toContain('player_mark');
  });
});

describe('BuffSystem v1.1 — source-death cleanup (§3.2.3)', () => {
  let world: TowerWorld;
  let system: BuffSystem;

  beforeEach(() => {
    clearAllBuffs();
    world = new TowerWorld();
    system = new BuffSystem();
  });

  it('removeOnSourceDeath=true 的 buff 在来源死亡后被立即移除', () => {
    world.registerSystem(system);
    const target = makeEntity(world);
    const source = makeEntity(world);
    addBuff(world, target, makeBuff({ id: 'aura', removeOnSourceDeath: true, sourceId: source, duration: 999 }));
    expect(getBuffs(target).map((b) => b.id)).toContain('aura');

    world.destroyEntity(source);
    // First update: cleanupDeadEntities removes source AFTER systems run, so BuffSystem still sees source alive.
    world.update(0.016);
    // Second update: source is now gone, removeOnSourceDeath should trigger.
    world.update(0.016);

    expect(getBuffs(target).map((b) => b.id)).not.toContain('aura');
  });

  it('removeOnSourceDeath=false 的 buff 来源死亡后仍然保留 (已投出)', () => {
    world.registerSystem(system);
    const target = makeEntity(world);
    const source = makeEntity(world);
    addBuff(world, target, makeBuff({ id: 'burn', removeOnSourceDeath: false, sourceId: source, duration: 999 }));

    world.destroyEntity(source);
    world.update(0.016);
    world.update(0.016);

    expect(getBuffs(target).map((b) => b.id)).toContain('burn');
  });

  it('duration=-1 的永久 buff 不会被 tick 减少', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    addBuff(world, target, makeBuff({ id: 'permanent', duration: -1, sourceId: source }));
    world.registerSystem(system);

    for (let i = 0; i < 100; i++) world.update(0.1);

    expect(getBuffs(target).map((b) => b.id)).toContain('permanent');
  });
});

describe('BuffSystem v1.1 — removeBuff helper', () => {
  let world: TowerWorld;

  beforeEach(() => {
    clearAllBuffs();
    world = new TowerWorld();
  });

  it('removeBuff 返回 true 并移除指定 buff', () => {
    const target = makeEntity(world);
    const source = makeEntity(world);
    addBuff(world, target, makeBuff({ id: 'temp', sourceId: source }));
    expect(removeBuff(target, 'temp')).toBe(true);
    expect(getBuffs(target)).toHaveLength(0);
  });

  it('removeBuff 对不存在的 buff 返回 false', () => {
    const target = makeEntity(world);
    expect(removeBuff(target, 'ghost')).toBe(false);
  });
});
