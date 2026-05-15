import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import {
  Position,
  Health,
  Faction,
  FactionVal,
  Attack,
  Movement,
  Tower,
  UnitTag,
  Category,
  CategoryVal,
} from '../core/components.js';
import { buildInspectorState } from './InspectorWindow.js';

describe('buildInspectorState', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
  });

  it('returns null when entityId is null', () => {
    expect(buildInspectorState(world, null)).toBeNull();
  });

  it('returns null for an entity without Position', () => {
    const eid = world.createEntity();
    expect(buildInspectorState(world, eid)).toBeNull();
  });

  it('builds a basic info section from Position + Faction + Health', () => {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 100, y: 200 });
    world.addComponent(eid, Faction, { value: FactionVal.Player });
    world.addComponent(eid, Health, { current: 50, max: 100, armor: 5, magicResist: 0 });

    const state = buildInspectorState(world, eid);
    expect(state).not.toBeNull();
    expect(state!.entityId).toBe(eid);
    const titles = state!.sections.map((s) => s.title);
    expect(titles).toContain('基本信息');
    expect(titles).toContain('生命与防御');
    const basic = state!.sections.find((s) => s.title === '基本信息')!;
    expect(basic.rows.some((r) => r.label === '位置' && r.value.includes('100'))).toBe(true);
    expect(basic.rows.some((r) => r.label === '阵营' && r.value.includes('Player'))).toBe(true);
    const hp = state!.sections.find((s) => s.title === '生命与防御')!;
    expect(hp.rows.some((r) => r.label === '当前血量' && r.value.includes('50') && r.value.includes('100'))).toBe(true);
  });

  it('includes Attack section when entity has Attack component', () => {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 0, y: 0 });
    world.addComponent(eid, Attack, {
      damage: 25,
      attackSpeed: 1.5,
      range: 200,
      cooldownTimer: 0.3,
      damageType: 0,
      isRanged: 1,
    });

    const state = buildInspectorState(world, eid);
    const combat = state!.sections.find((s) => s.title === '战斗属性');
    expect(combat).toBeDefined();
    expect(combat!.rows.some((r) => r.label === '攻击力' && r.value === '25')).toBe(true);
    expect(combat!.rows.some((r) => r.label === '远程攻击' && r.value === '是')).toBe(true);
  });

  it('includes Movement section when entity has Movement component', () => {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 0, y: 0 });
    world.addComponent(eid, Movement, { speed: 80, currentSpeed: 80, homeX: 100, homeY: 100 });

    const state = buildInspectorState(world, eid);
    const move = state!.sections.find((s) => s.title === '移动属性');
    expect(move).toBeDefined();
    expect(move!.rows.some((r) => r.label === '基础移速')).toBe(true);
  });

  it('uses tower config name when Tower component is present', () => {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 0, y: 0 });
    world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 100 });
    world.addComponent(eid, Category, { value: CategoryVal.Tower });

    const state = buildInspectorState(world, eid);
    expect(state).not.toBeNull();
    expect(state!.displayName).toBeTruthy();
    const towerSection = state!.sections.find((s) => s.title === '塔属性');
    expect(towerSection).toBeDefined();
    expect(towerSection!.rows.some((r) => r.label === '等级' && r.value === '1')).toBe(true);
  });

  it('includes UnitTag section when entity has UnitTag', () => {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 0, y: 0 });
    world.addComponent(eid, UnitTag, {
      unitTypeNum: 0,
      level: 1,
      maxLevel: 3,
      popCost: 1,
      cost: 50,
      isEnemy: 0,
    });

    const state = buildInspectorState(world, eid);
    const unit = state!.sections.find((s) => s.title === '单位标签');
    expect(unit).toBeDefined();
    expect(unit!.rows.some((r) => r.label === '人口占用' && r.value === '1')).toBe(true);
  });
});
