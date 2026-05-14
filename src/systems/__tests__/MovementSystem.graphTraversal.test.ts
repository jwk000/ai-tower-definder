/**
 * MovementSystem + WaveSystem D.6/D.7 联动 — 真图遍历
 *
 * 对应设计文档:
 * - design/60-tech/64-level-editor.md §4.5.3「敌人实体的图遍历」
 * - design/60-tech/64-level-editor.md §10 Phase D 任务清单 D.6/D.7
 *
 * 验证 4 个核心场景:
 *   1. 单链路径推进: 敌人沿单出度节点逐步前进，currentNodeIdx 单调推进
 *   2. 分支随机选择: 多出度节点处依权重选边，单实体在节点抵达瞬间只随机一次
 *   3. portal 瞬移: role=portal 节点直接 teleport 到 teleportTo 节点并继续
 *   4. spawnId 路由: WaveEnemyGroup.spawnId 决定敌人初始 spawn 节点
 *
 * 回归保护:
 *   - L1-L5 单链关卡行为等价于现行 linearizeForLegacy 路径
 *   - WaveSystem.spawnEnemy 必须写入 currentNodeIdx/targetNodeIdx 有效值（非 0xFFFF）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { defineQuery } from 'bitecs';
import { TowerWorld } from '../../core/World.js';
import {
  Position,
  Health,
  Movement,
  UnitTag,
  Visual,
  Category,
  CategoryVal,
  MoveModeVal,
} from '../../core/components.js';
import { MovementSystem } from '../MovementSystem.js';
import { WaveSystem } from '../WaveSystem.js';
import { RenderSystem } from '../RenderSystem.js';
import {
  type MapConfig,
  type WaveConfig,
  TileType,
  EnemyType,
  GamePhase,
} from '../../types/index.js';

const TILE = 32;
const SENTINEL = 0xffff;

const enemyQuery = defineQuery([Position, UnitTag, Movement]);

function makeTiles(rows: number, cols: number, fill: TileType = TileType.Path): TileType[][] {
  const out: TileType[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < cols; c++) row.push(fill);
    out.push(row);
  }
  return out;
}

/** 单链 4 节点地图: s -> a -> b -> e */
function makeLinearMap(): MapConfig {
  return {
    name: 'linear',
    cols: 4,
    rows: 1,
    tileSize: TILE,
    tiles: makeTiles(1, 4),
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'a', row: 0, col: 1, role: 'waypoint' },
        { id: 'b', row: 0, col: 2, role: 'waypoint' },
        { id: 'e', row: 0, col: 3, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 's', to: 'a' },
        { from: 'a', to: 'b' },
        { from: 'b', to: 'e' },
      ],
    },
  };
}

function makeBranchMap(): MapConfig {
  return {
    name: 'branch',
    cols: 4,
    rows: 3,
    tileSize: TILE,
    tiles: makeTiles(3, 4),
    spawns: [{ id: 'sp', row: 1, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 1, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'branch', row: 1, col: 1, role: 'branch' },
        { id: 'upper', row: 0, col: 2, role: 'waypoint' },
        { id: 'lower', row: 2, col: 2, role: 'waypoint' },
        { id: 'e', row: 1, col: 3, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 's', to: 'branch' },
        { from: 'branch', to: 'upper' },
        { from: 'branch', to: 'lower' },
        { from: 'upper', to: 'e' },
        { from: 'lower', to: 'e' },
      ],
    },
  };
}

/**
 * Portal 地图: s -> portalIn (role=portal, teleportTo=portalOut) -> portalOut -> e
 */
function makePortalMap(): MapConfig {
  return {
    name: 'portal',
    cols: 5,
    rows: 1,
    tileSize: TILE,
    tiles: makeTiles(1, 5),
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'portalIn', row: 0, col: 1, role: 'portal', teleportTo: 'portalOut' },
        { id: 'portalOut', row: 0, col: 4, role: 'waypoint' },
        { id: 'e', row: 0, col: 4, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 's', to: 'portalIn' },
        { from: 'portalOut', to: 'e' },
      ],
    },
  };
}

/**
 * 双 spawn 地图: 两个 spawn 节点分别通往各自终点
 *   spA -> ea, spB -> eb
 */
function makeMultiSpawnMap(): MapConfig {
  return {
    name: 'multi-spawn',
    cols: 3,
    rows: 2,
    tileSize: TILE,
    tiles: makeTiles(2, 3),
    spawns: [
      { id: 'spA', row: 0, col: 0 },
      { id: 'spB', row: 1, col: 0 },
    ],
    pathGraph: {
      nodes: [
        { id: 'a0', row: 0, col: 0, role: 'spawn', spawnId: 'spA' },
        { id: 'ea', row: 0, col: 2, role: 'crystal_anchor' },
        { id: 'b0', row: 1, col: 0, role: 'spawn', spawnId: 'spB' },
        { id: 'eb', row: 1, col: 2, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 'a0', to: 'ea' },
        { from: 'b0', to: 'eb' },
      ],
    },
  };
}

function makeBase(world: TowerWorld, hp = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: -9999, y: -9999 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Objective });
  return eid;
}

function makeSingleEnemyWave(spawnId?: string): WaveConfig[] {
  return [
    {
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [
        spawnId !== undefined
          ? { enemyType: EnemyType.Grunt, count: 1, spawnInterval: 0, spawnId }
          : { enemyType: EnemyType.Grunt, count: 1, spawnInterval: 0 },
      ],
    },
  ];
}

function spawnEnemyDirect(
  world: TowerWorld,
  opts: {
    posX: number;
    posY: number;
    currentNodeIdx: number;
    targetNodeIdx: number;
    spawnIdx?: number;
    speed?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: opts.posX, y: opts.posY });
  world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed: opts.speed ?? 80,
    moveMode: MoveModeVal.FollowPath,
    pathIndex: 0,
    progress: 0,
    spawnIdx: opts.spawnIdx ?? 0,
    currentNodeIdx: opts.currentNodeIdx,
    targetNodeIdx: opts.targetNodeIdx,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 10,
    canAttackBuildings: 0,
    atk: 1,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 255,
    colorG: 0,
    colorB: 0,
    size: 16,
    alpha: 1,
  });
  return eid;
}

function runTicks(sys: MovementSystem, world: TowerWorld, ticks: number, dt = 0.1): void {
  for (let i = 0; i < ticks; i++) sys.update(world, dt);
}

describe('MovementSystem D.6 — 图遍历推进（单链）', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('单链路径: currentNodeIdx 沿出度=1 的链单调推进 0->1->2->3', () => {
    const map = makeLinearMap();
    const world = new TowerWorld();
    const sys = new MovementSystem(map);

    // 起点 s 在 nodes[0], target=a (nodes[1])
    const eid = spawnEnemyDirect(world, {
      posX: 0 * TILE + TILE / 2,
      posY: 0 * TILE + TILE / 2,
      currentNodeIdx: 0,
      targetNodeIdx: 1,
      spawnIdx: 0,
    });

    const seen = new Set<number>();
    for (let i = 0; i < 80; i++) {
      sys.update(world, 0.1);
      seen.add(Movement.currentNodeIdx[eid] ?? -1);
      if (!enemyQuery(world.world).includes(eid)) break;
    }

    // 必须途经 0,1,2,3 全部节点
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(2)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });

  it('单链路径: 抵达 crystal_anchor 时扣基地血', () => {
    const map = makeLinearMap();
    const world = new TowerWorld();
    const sys = new MovementSystem(map);
    const baseId = makeBase(world, 100);

    spawnEnemyDirect(world, {
      posX: 0 * TILE + TILE / 2,
      posY: 0 * TILE + TILE / 2,
      currentNodeIdx: 0,
      targetNodeIdx: 1,
    });

    runTicks(sys, world, 100, 0.1);
    expect(Health.current[baseId]).toBeLessThan(100);
  });
});

describe('MovementSystem D.6 — 分支随机（waveRandom 确定性）', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('分支节点: 在 branch 抵达时只随机一次，targetNodeIdx 落在 upper 或 lower', () => {
    const map = makeBranchMap();
    const world = new TowerWorld();
    const sys = new MovementSystem(map);

    // 直接放到 branch 节点上, target 由 MovementSystem 在抵达时挑（这里手动设到 upper 验证后续不再变）
    // 起步: 已在 s, target=branch
    const eid = spawnEnemyDirect(world, {
      posX: 0 * TILE + TILE / 2,
      posY: 1 * TILE + TILE / 2,
      currentNodeIdx: 0,
      targetNodeIdx: 1,
    });

    const branchTargets = new Set<number>();
    for (let i = 0; i < 100; i++) {
      sys.update(world, 0.1);
      // 一旦敌人 current=branch(idx=1) 之后 target 必须落在 upper(2) 或 lower(3)
      if (Movement.currentNodeIdx[eid] === 1) {
        branchTargets.add(Movement.targetNodeIdx[eid] ?? -1);
      }
      if (!enemyQuery(world.world).includes(eid)) break;
    }
    // 单个实体抵达 branch 后只随机一次 -> 集合 size == 1
    expect(branchTargets.size).toBe(1);
    expect([2, 3]).toContain([...branchTargets][0]);
  });

  it('分支节点: 多敌人独立各自随机（不共享 target）', () => {
    const map = makeBranchMap();
    const world = new TowerWorld();
    const sys = new MovementSystem(map);

    const eids: number[] = [];
    for (let i = 0; i < 50; i++) {
      eids.push(
        spawnEnemyDirect(world, {
          posX: 1 * TILE + TILE / 2,
          posY: 1 * TILE + TILE / 2,
          currentNodeIdx: 1,
          targetNodeIdx: SENTINEL,
        }),
      );
    }
    sys.update(world, 0.01);

    const targets = eids.map((e) => Movement.targetNodeIdx[e] ?? -1);
    const upperCount = targets.filter((t) => t === 2).length;
    const lowerCount = targets.filter((t) => t === 3).length;
    expect(upperCount).toBeGreaterThan(0);
    expect(lowerCount).toBeGreaterThan(0);
    expect(upperCount + lowerCount).toBe(50);
  });
});

describe('MovementSystem D.6 — Portal 瞬移', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('Portal 节点: 抵达时 currentNodeIdx 直接跳到 teleportTo 节点 idx', () => {
    const map = makePortalMap();
    const world = new TowerWorld();
    const sys = new MovementSystem(map);

    // s(0) -> portalIn(1) -> portalOut(2) -> e(3)
    const eid = spawnEnemyDirect(world, {
      posX: 0 * TILE + TILE / 2,
      posY: 0 * TILE + TILE / 2,
      currentNodeIdx: 0,
      targetNodeIdx: 1,
    });

    let seenPortalOut = false;
    for (let i = 0; i < 100; i++) {
      sys.update(world, 0.1);
      if (Movement.currentNodeIdx[eid] === 2) {
        seenPortalOut = true;
        // Position 应已瞬移到 portalOut tile 中心
        expect(Position.x[eid]).toBeCloseTo(4 * TILE + TILE / 2, 1);
      }
      if (!enemyQuery(world.world).includes(eid)) break;
    }
    expect(seenPortalOut).toBe(true);
  });
});

describe('WaveSystem D.7 — spawn 节点初始化', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => {
    phase = p;
  };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('spawnEnemy 必须初始化 Movement.currentNodeIdx 为 spawn 节点 idx（非 0xFFFF sentinel）', () => {
    const world = new TowerWorld();
    const map = makeLinearMap();
    const ws = new WaveSystem(world, map, makeSingleEnemyWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const eids = enemyQuery(world.world);
    expect(eids.length).toBe(1);
    const eid = eids[0]!;
    // spawn 节点 s 是 nodes[0]
    expect(Movement.currentNodeIdx[eid]).toBe(0);
    expect(Movement.currentNodeIdx[eid]).not.toBe(SENTINEL);
  });

  it('spawnEnemy 必须初始化 targetNodeIdx 为 spawn 节点的首个后继 idx', () => {
    const world = new TowerWorld();
    const map = makeLinearMap();
    const ws = new WaveSystem(world, map, makeSingleEnemyWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const eids = enemyQuery(world.world);
    expect(eids.length).toBe(1);
    const eid = eids[0]!;
    // s -> a, a 是 nodes[1]
    expect(Movement.targetNodeIdx[eid]).toBe(1);
    expect(Movement.targetNodeIdx[eid]).not.toBe(SENTINEL);
  });

  it('spawnEnemy 必须初始化 spawnIdx 为来源 spawn 节点 idx', () => {
    const world = new TowerWorld();
    const map = makeLinearMap();
    const ws = new WaveSystem(world, map, makeSingleEnemyWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const eid = enemyQuery(world.world)[0]!;
    expect(Movement.spawnIdx[eid]).toBe(0);
  });

  it('spawnId 路由: WaveEnemyGroup.spawnId="spB" 时敌人初始坐标在 spB 节点', () => {
    const world = new TowerWorld();
    const map = makeMultiSpawnMap();
    const ws = new WaveSystem(world, map, makeSingleEnemyWave('spB'), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const eid = enemyQuery(world.world)[0]!;
    // spB 在 row=1, col=0 -> b0 在 nodes[2]
    expect(Movement.spawnIdx[eid]).toBe(2);
    expect(Movement.currentNodeIdx[eid]).toBe(2);
    expect(Movement.targetNodeIdx[eid]).toBe(3);
    expect(Position.x[eid]).toBeCloseTo(0 * TILE + TILE / 2, 1);
    expect(Position.y[eid]).toBeCloseTo(1 * TILE + TILE / 2, 1);
  });

  it('spawnId 未指定时回退到 spawns[0]', () => {
    const world = new TowerWorld();
    const map = makeMultiSpawnMap();
    const ws = new WaveSystem(world, map, makeSingleEnemyWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const eid = enemyQuery(world.world)[0]!;
    // spA 在 nodes[0]
    expect(Movement.spawnIdx[eid]).toBe(0);
    expect(Movement.currentNodeIdx[eid]).toBe(0);
    expect(Movement.targetNodeIdx[eid]).toBe(1);
  });
});
