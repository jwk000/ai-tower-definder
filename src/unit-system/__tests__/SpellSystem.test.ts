import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../../core/World.js';
import { Position, Health, Faction, FactionVal } from '../../core/components.js';
import { SpellSystem } from '../SpellSystem.js';
import { createRunContext, playCard } from '../RunContext.js';
import { CardConfigRegistry, type CardConfig } from '../../config/cardRegistry.js';
import { loadAllCardConfigsSync } from '../../config/loader.js';
import { cardConfigRegistry } from '../../config/cardRegistry.js';

// v3.0 roguelike — B3-MVP-4 SpellSystem 集成测试
// 设计文档锚点：
//   - design/25-card-roguelike-refactor.md §2 卡牌系统
//   - design/14-acceptance-criteria.md §3.3 法术卡释放契约
//
// 测试范围：
//   - SpellSystem.executeSpell 的 AOE 命中语义 + 阵营过滤 + Health 扣减
//   - 与 RunContext.playCard 协作：spell 出卡后能量扣除 + 入弃牌堆
//   - fireball_card YAML 集成验证：spellEffect 字段被正确解析

function makeEnemy(world: TowerWorld, x: number, y: number, hp = 200): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Enemy });
  return eid;
}

function makeAlly(world: TowerWorld, x: number, y: number, hp = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Player });
  return eid;
}

function fireballCfg(extra: Partial<CardConfig> = {}): CardConfig {
  return {
    id: 'test_fireball', name: 'test_fireball', type: 'spell',
    energyCost: 3, rarity: 'common',
    placement: { targetType: 'area', range: 'cursor' },
    spellEffect: { handler: 'aoe_damage', damage: 80, radius: 80, affectAlly: false },
    ...extra,
  } as CardConfig;
}

describe('SpellSystem B3-MVP — executeSpell AOE 命中语义', () => {
  let world: TowerWorld;
  let spell: SpellSystem;

  beforeEach(() => {
    world = new TowerWorld();
    spell = new SpellSystem(world);
  });

  it('范围内多敌全部受击，受击数 = totalDamage / damage', () => {
    makeEnemy(world, 100, 100);
    makeEnemy(world, 110, 110);
    makeEnemy(world, 120, 120);
    makeEnemy(world, 9999, 9999);

    const result = spell.executeSpell(fireballCfg(), { x: 100, y: 100 });

    expect(result.hits).toBe(3);
    expect(result.totalDamage).toBe(240);
    expect(result.targetIds.length).toBe(3);
  });

  it('阵营过滤：玩家阵营单位默认不被命中', () => {
    const enemy = makeEnemy(world, 100, 100);
    const ally = makeAlly(world, 105, 105);

    spell.executeSpell(fireballCfg(), { x: 100, y: 100 });

    expect(Health.current[enemy]).toBe(120);
    expect(Health.current[ally]).toBe(100);
  });

  it('affectAlly: true 时玩家阵营也被命中', () => {
    const enemy = makeEnemy(world, 100, 100);
    const ally = makeAlly(world, 105, 105);
    const cfg = fireballCfg({
      spellEffect: { handler: 'aoe_damage', damage: 80, radius: 80, affectAlly: true },
    });

    spell.executeSpell(cfg, { x: 100, y: 100 });

    expect(Health.current[enemy]).toBe(120);
    expect(Health.current[ally]).toBe(20);
  });

  it('Health 扣减不会扣到负数', () => {
    const weak = makeEnemy(world, 100, 100, 30);
    spell.executeSpell(fireballCfg(), { x: 100, y: 100 });
    expect(Health.current[weak]).toBe(0);
  });

  it('范围外敌人不受影响（圆形 hitbox）', () => {
    const inside = makeEnemy(world, 100, 100);
    const outside = makeEnemy(world, 200, 200);
    spell.executeSpell(fireballCfg(), { x: 100, y: 100 });
    expect(Health.current[inside]).toBe(120);
    expect(Health.current[outside]).toBe(200);
  });

  it('未知 handler 不抛错且不命中任何目标', () => {
    makeEnemy(world, 100, 100);
    const cfg = fireballCfg({
      spellEffect: { handler: 'unknown_handler', damage: 80, radius: 80 },
    });
    const result = spell.executeSpell(cfg, { x: 100, y: 100 });
    expect(result.hits).toBe(0);
  });

  it('缺失 spellEffect 字段不抛错', () => {
    const cfg: CardConfig = {
      id: 'broken', name: 'broken', type: 'spell',
      energyCost: 1, rarity: 'common',
      placement: { targetType: 'area' },
    } as CardConfig;
    const result = spell.executeSpell(cfg, { x: 100, y: 100 });
    expect(result.hits).toBe(0);
  });
});

describe('SpellSystem ↔ RunContext.playCard 集成', () => {
  it('spell 出卡 → 能量扣除 + 入弃牌堆', () => {
    const registry = new CardConfigRegistry();
    registry.register(fireballCfg());
    const ctx = createRunContext({ seed: 1, registry, energyMax: 10 });

    ctx.hand.refillHand(ctx.deck);
    const card = ctx.hand.state.hand[0];
    expect(card).toBeDefined();
    const energyBefore = ctx.energy.current;
    const discardBefore = ctx.deck.state.discardPile.length;

    const played = playCard(ctx, card!.instanceId);

    expect(played).not.toBeNull();
    expect(ctx.energy.current).toBe(energyBefore - 3);
    expect(ctx.deck.state.discardPile.length).toBe(discardBefore + 1);
    expect(ctx.hand.state.hand.find((c) => c.instanceId === card!.instanceId)).toBeUndefined();
  });

  it('能量不足时 playCard 返回 null，不进弃牌堆', () => {
    const registry = new CardConfigRegistry();
    registry.register(fireballCfg({ energyCost: 99 }));
    const ctx = createRunContext({ seed: 1, registry, energyMax: 10 });

    ctx.hand.refillHand(ctx.deck);
    const card = ctx.hand.state.hand[0];
    const handBefore = ctx.hand.state.hand.length;
    const discardBefore = ctx.deck.state.discardPile.length;

    const played = playCard(ctx, card!.instanceId);

    expect(played).toBeNull();
    expect(ctx.hand.state.hand.length).toBe(handBefore);
    expect(ctx.deck.state.discardPile.length).toBe(discardBefore);
  });
});

describe('fireball_card YAML 资产集成', () => {
  beforeEach(() => {
    cardConfigRegistry.clear();
    loadAllCardConfigsSync();
  });

  it('fireball_card 已注册且 spellEffect 字段被正确解析', () => {
    const cfg = cardConfigRegistry.get('fireball_card');
    expect(cfg).toBeDefined();
    expect(cfg!.type).toBe('spell');
    expect(cfg!.energyCost).toBe(3);
    const effect = (cfg as Record<string, unknown>)['spellEffect'] as Record<string, unknown>;
    expect(effect).toBeDefined();
    expect(effect['handler']).toBe('aoe_damage');
    expect(effect['damage']).toBe(80);
    expect(effect['radius']).toBe(80);
  });

  it('fireball_card 集成 SpellSystem：80 dmg 命中范围内敌人', () => {
    const cfg = cardConfigRegistry.get('fireball_card');
    expect(cfg).toBeDefined();

    const world = new TowerWorld();
    const spell = new SpellSystem(world);
    const enemy = makeEnemy(world, 100, 100, 200);

    const result = spell.executeSpell(cfg!, { x: 100, y: 100 });
    expect(result.hits).toBe(1);
    expect(Health.current[enemy]).toBe(120);
  });
});
