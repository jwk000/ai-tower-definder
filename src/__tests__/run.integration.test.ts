import { describe, expect, it, vi } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../core/Game.js';
import { LevelState } from '../core/LevelState.js';
import { RunController } from '../core/RunController.js';
import {
  Attack,
  Crystal,
  Faction,
  FactionTeam,
  Health,
  Position,
  Projectile,
  UnitCategory,
  UnitTag,
} from '../core/components.js';
import type { UnitConfig } from '../factories/UnitFactory.js';
import { spawnUnit } from '../factories/UnitFactory.js';
import { CardRegistry, type CardConfig } from '../unit-system/CardRegistry.js';
import { CardSpawnSystem } from '../unit-system/CardSpawnSystem.js';
import { DeckSystem } from '../unit-system/DeckSystem.js';
import { EnergySystem } from '../unit-system/EnergySystem.js';
import { HandSystem } from '../unit-system/HandSystem.js';
import { RunManager, RunPhase } from '../unit-system/RunManager.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { createAttackSystem } from '../systems/AttackSystem.js';
import { createCrystalSystem } from '../systems/CrystalSystem.js';
import { createHealthSystem } from '../systems/HealthSystem.js';
import { createLifecycleSystem } from '../systems/LifecycleSystem.js';
import { createMovementSystem } from '../systems/MovementSystem.js';
import { createProjectileSystem } from '../systems/ProjectileSystem.js';
import {
  createWaveSystem,
  type WaveConfig,
  type SpawnConfig,
} from '../systems/WaveSystem.js';
import { defineQuery } from 'bitecs';
import type { TowerWorld } from '../core/World.js';

const GRUNT: UnitConfig = {
  id: 'grunt',
  category: 'Enemy',
  faction: 'Enemy',
  stats: { hp: 30, atk: 0, attackSpeed: 0, range: 0, speed: 100 },
  visual: { shape: 'circle', color: 0xef5350, size: 24 },
  lifecycle: {
    onDeath: [{ handler: 'drop_gold', params: { amount: 5 } }],
  },
};

const SPIKE_TRAP: UnitConfig = {
  id: 'spike_trap',
  category: 'Trap',
  faction: 'Player',
  stats: { hp: 1, atk: 0, attackSpeed: 0, range: 0, speed: 0 },
  visual: { shape: 'rect', color: 0x9e9e9e, size: 16 },
};

const SPIKE_CARD: CardConfig = {
  id: 'card_spike',
  type: 'trap',
  energyCost: 2,
  unitConfigId: 'spike_trap',
};

function spawnCrystalAt(world: TowerWorld, x: number, y: number, hp: number, radius: number): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  addComponent(world, Health, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  addComponent(world, Faction, eid);
  Faction.team[eid] = FactionTeam.Player;
  addComponent(world, UnitTag, eid);
  UnitTag.category[eid] = UnitCategory.Objective;
  addComponent(world, Crystal, eid);
  Crystal.radius[eid] = radius;
  return eid;
}

function makeRng(seed = 0): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('Run integration: RunManager + Deck/Hand/Energy + CardSpawn + Economy + W2 systems', () => {
  it('runs the L1 MVP loop end to end: start Run -> spawn enemies -> crystal kills -> level clear -> Result', () => {
    const game = new Game();
    const econ = new EconomySystem();
    game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
      const amount = typeof params['amount'] === 'number' ? params['amount'] : 0;
      econ.addGold(amount);
    });

    const path = [
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    game.pipeline.register(createCrystalSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const run = new RunManager({ totalLevels: 1 });
    const deck = new DeckSystem({ pool: ['card_spike'], deckSize: 4, rng: makeRng(42) });
    const hand = new HandSystem({ maxSize: 4 });
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 0 });

    run.startRun();
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
    expect(run.phase).toBe(RunPhase.Battle);

    spawnCrystalAt(game.world, 400, 100, 5, 50);
    spawnUnit(game.world, GRUNT, { x: 0, y: 100 });
    spawnUnit(game.world, GRUNT, { x: -50, y: 100 });
    spawnUnit(game.world, GRUNT, { x: -100, y: 100 });

    const totalEnemies = 3;
    let killsSeen = 0;
    for (let i = 0; i < 600 && econ.gold < totalEnemies * 5; i += 1) {
      game.tick(0.1);
      energy.tick(0.1);
      killsSeen = econ.gold / 5;
    }

    expect(killsSeen).toBe(totalEnemies);
    expect(econ.gold).toBe(15);

    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('victory');

    econ.grantLevelClearReward(run.currentLevel);
    expect(econ.sp).toBe(2);
  });

  it('hand.playCard -> CardSpawnSystem.play places a trap on the map and consumes energy', () => {
    const game = new Game();
    const registry = new CardRegistry();
    registry.registerCard(SPIKE_CARD);
    registry.registerUnit(SPIKE_TRAP);
    const cardSpawn = new CardSpawnSystem(registry);
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });
    const hand = new HandSystem({ maxSize: 4 });

    const deck = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(7) });
    hand.drawTo(deck);
    expect(hand.size).toBe(2);

    const playedCard = hand.playCard(0)!;
    expect(playedCard).toBe('card_spike');

    const card = registry.getCard(playedCard)!;
    expect(energy.canAfford(card.energyCost)).toBe(true);
    expect(energy.spend(card.energyCost)).toBe(true);
    expect(energy.current).toBe(3);

    const eid = cardSpawn.play(game.world, playedCard, { x: 200, y: 150 });
    expect(eid).not.toBeNull();
    expect(Position.x[eid!]).toBe(200);
    expect(Position.y[eid!]).toBe(150);
    expect(UnitTag.category[eid!]).toBe(UnitCategory.Trap);
  });

  it('Run can be replayed by resetting RunManager, deck, hand, energy, and economy', () => {
    const econ = new EconomySystem();
    const run = new RunManager({ totalLevels: 1 });
    const deck = new DeckSystem({ pool: ['card_spike'], deckSize: 4, rng: makeRng(99) });
    const hand = new HandSystem({ maxSize: 4 });
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });

    run.startRun();
    hand.drawTo(deck);
    energy.spend(3);
    econ.addGold(50);
    econ.addSp(4);
    run.failRun();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('defeat');

    run.resetToIdle();
    deck.reset();
    hand.clear();
    energy.reset();
    econ.reset();

    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
    expect(deck.drawPileSize).toBe(4);
    expect(deck.discardPileSize).toBe(0);
    expect(hand.size).toBe(0);
    expect(energy.current).toBe(5);
    expect(econ.gold).toBe(0);
    expect(econ.sp).toBe(0);

    run.startRun();
    expect(run.phase).toBe(RunPhase.Battle);
    expect(run.currentLevel).toBe(1);
  });
});

describe('MVP run flow smoke: RunController orchestrates phase + scene + tick', () => {
  function makeScenes() {
    return {
      mainMenu: { visible: false },
      battle: { visible: false },
      interLevel: { visible: false },
      runResult: { visible: false },
    };
  }

  it('completes a full Idle -> Battle -> Result cycle and resets to Idle', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const runManager = new RunManager({ totalLevels: 1 });
    const scenes = makeScenes();

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 100,
        groups: [{ enemyId: 'grunt', count: 1, intervalMs: 0 }],
      },
    ];
    const spawns: SpawnConfig[] = [{ id: 's1', x: 0, y: 100 }];
    const unitConfigs = new Map([['grunt', GRUNT]]);
    const waveSystem = createWaveSystem({ waves, spawns, unitConfigs });
    game.pipeline.register(waveSystem);

    const levelState = new LevelState();
    levelState.reset(waves.length);
    expect(levelState.waveTotal).toBe(1);
    expect(levelState.phase).toBe('deployment');

    const controller = new RunController({ game, runManager, scenes, waveSystem, levelState });

    expect(controller.phase).toBe(RunPhase.Idle);
    expect(scenes.mainMenu.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);
    expect(scenes.interLevel.visible).toBe(false);
    expect(scenes.runResult.visible).toBe(false);

    controller.startRun();
    expect(controller.phase).toBe(RunPhase.Battle);
    expect(scenes.mainMenu.visible).toBe(false);
    expect(scenes.battle.visible).toBe(true);

    waveSystem.start();

    const tickSpy = vi.spyOn(game, 'tick');
    controller.tick(0.016);
    controller.tick(0.016);
    expect(tickSpy).toHaveBeenCalledTimes(2);
    expect(tickSpy).toHaveBeenLastCalledWith(0.016);
    expect(levelState.waveIndex).toBe(0);
    expect(levelState.phase).toBe('deployment');

    controller.tick(0.1);
    expect(levelState.phase).toBe('battle');

    controller.completeCurrentLevel();
    expect(controller.phase).toBe(RunPhase.Result);
    expect(runManager.outcome).toBe('victory');
    expect(scenes.battle.visible).toBe(false);
    expect(scenes.runResult.visible).toBe(true);
    expect(levelState.phase).toBe('victory');

    tickSpy.mockClear();
    controller.tick(0.016);
    expect(tickSpy).not.toHaveBeenCalled();

    controller.returnToMainMenu();
    expect(controller.phase).toBe(RunPhase.Idle);
    expect(scenes.mainMenu.visible).toBe(true);
    expect(scenes.runResult.visible).toBe(false);
    expect(runManager.gold).toBe(0);
    expect(runManager.crystalHp).toBe(0);
  });

  it('handles defeat path and clears Run-level resources on reset', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 1, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const levelState = new LevelState();
    levelState.reset(1);
    const controller = new RunController({ game, runManager, scenes, levelState });

    controller.startRun();
    expect(runManager.gold).toBe(200);
    expect(runManager.crystalHp).toBe(20);

    controller.failCurrentRun();
    expect(controller.phase).toBe(RunPhase.Result);
    expect(runManager.outcome).toBe('defeat');
    expect(scenes.runResult.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);
    expect(levelState.phase).toBe('defeat');

    controller.returnToMainMenu();
    expect(controller.phase).toBe(RunPhase.Idle);
    expect(runManager.gold).toBe(0);
    expect(runManager.sp).toBe(0);
    expect(runManager.crystalHp).toBe(0);
    expect(runManager.crystalHpMax).toBe(0);
    expect(scenes.mainMenu.visible).toBe(true);
  });
});

describe('WaveSystem integration: schedule, spawn cadence, phase transitions', () => {
  it('Wave 7.A: schedules count=3 grunts at intervalMs cadence and transitions deployment -> battle -> wave-break', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const spawn = vi.fn(spawnUnit);

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 200,
        groups: [{ enemyId: 'grunt', count: 3, intervalMs: 100 }],
      },
    ];
    const spawns: SpawnConfig[] = [{ id: 's1', x: 0, y: 100 }];
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const onWaveComplete = vi.fn();
    const onAllWavesComplete = vi.fn();

    const waveSystem = createWaveSystem({
      waves,
      spawns,
      unitConfigs,
      waveBreakMs: 500,
      onWaveComplete,
      onAllWavesComplete,
      spawn,
    });

    game.pipeline.register(waveSystem);
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    waveSystem.start();
    expect(waveSystem.currentPhase).toBe('deployment');
    expect(spawn).toHaveBeenCalledTimes(0);

    game.tick(0.1);
    expect(waveSystem.currentPhase).toBe('deployment');
    expect(spawn).toHaveBeenCalledTimes(0);

    game.tick(0.15);
    expect(waveSystem.currentPhase).toBe('battle');
    expect(spawn).toHaveBeenCalledTimes(1);

    game.tick(0.1);
    expect(spawn).toHaveBeenCalledTimes(2);

    game.tick(0.1);
    expect(spawn).toHaveBeenCalledTimes(3);

    game.tick(0.05);
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(waveSystem.aliveEnemyCount(game.world)).toBe(3);
    expect(waveSystem.currentPhase).toBe('battle');

    const enemies = spawn.mock.results.map((r) => r.value as number);
    for (const eid of enemies) {
      Health.current[eid] = 0;
    }

    game.tick(0.016);
    expect(waveSystem.aliveEnemyCount(game.world)).toBe(0);
    expect(waveSystem.currentPhase).toBe('wave-break');
    expect(onWaveComplete).toHaveBeenCalledTimes(1);
    expect(onWaveComplete).toHaveBeenCalledWith(0);

    // Game.tick clamps dt to MAX_DT_SECONDS (0.25s), so a single tick(0.6)
    // only advances 250ms — not enough to cross waveBreakMs=500. Split the
    // wait across two ticks to accumulate >=500ms in wave-break phase.
    game.tick(0.25);
    game.tick(0.3);
    expect(waveSystem.currentPhase).toBe('completed');
    expect(onAllWavesComplete).toHaveBeenCalledTimes(1);
  });

  it('Wave 7.A.2: spawns at the spawnId coordinate and uses the configured UnitConfig', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const spawn = vi.fn(spawnUnit);

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 0,
        groups: [{ enemyId: 'grunt', count: 1, spawnId: 's2', intervalMs: 0 }],
      },
    ];
    const spawns: SpawnConfig[] = [
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 320, y: 288 },
    ];
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const waveSystem = createWaveSystem({ waves, spawns, unitConfigs, spawn });
    game.pipeline.register(waveSystem);

    waveSystem.start();
    game.tick(0.016);

    expect(spawn).toHaveBeenCalledTimes(1);
    const lastCall = spawn.mock.calls[0]!;
    expect(lastCall[1]).toBe(GRUNT);
    expect(lastCall[2]).toEqual({ x: 320, y: 288 });
  });

  it('Wave 7.A.3: rejects unknown enemyId and unknown spawnId loudly', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const bad = createWaveSystem({
      waves: [
        {
          waveNumber: 1,
          spawnDelayMs: 0,
          groups: [{ enemyId: 'phantom', count: 1, intervalMs: 0 }],
        },
      ],
      spawns: [{ id: 's1', x: 0, y: 0 }],
      unitConfigs,
    });
    game.pipeline.register(bad);
    bad.start();
    expect(() => game.tick(0.016)).toThrow(/unknown enemyId/);

    const game2 = new Game();
    game2.world.ruleEngine.registerHandler('drop_gold', () => {});
    const badSpawn = createWaveSystem({
      waves: [
        {
          waveNumber: 1,
          spawnDelayMs: 0,
          groups: [{ enemyId: 'grunt', count: 1, spawnId: 'ghost', intervalMs: 0 }],
        },
      ],
      spawns: [{ id: 's1', x: 0, y: 0 }],
      unitConfigs,
    });
    game2.pipeline.register(badSpawn);
    badSpawn.start();
    expect(() => game2.tick(0.016)).toThrow(/unknown spawnId/);
  });
});

describe('Projectile integration: AttackSystem fires, ProjectileSystem travels and hits', () => {
  it('Wave 7.B: AttackSystem spawns a Projectile, ProjectileSystem flies it to the target and applies damage', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    game.pipeline.register(createProjectileSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const tower = game.world.addEntity();
    addComponent(game.world, Position, tower);
    addComponent(game.world, Faction, tower);
    addComponent(game.world, Attack, tower);
    Position.x[tower] = 0;
    Position.y[tower] = 0;
    Faction.team[tower] = FactionTeam.Player;
    Attack.damage[tower] = 10;
    Attack.range[tower] = 100;
    Attack.cooldown[tower] = 1;
    Attack.cooldownLeft[tower] = 0;
    Attack.projectileSpeed[tower] = 480;

    const enemy = game.world.addEntity();
    addComponent(game.world, Position, enemy);
    addComponent(game.world, Faction, enemy);
    addComponent(game.world, Health, enemy);
    Position.x[enemy] = 50;
    Position.y[enemy] = 0;
    Faction.team[enemy] = FactionTeam.Enemy;
    Health.current[enemy] = 100;
    Health.max[enemy] = 100;

    const projectileQuery = defineQuery([Projectile]);

    game.tick(0.05);
    expect(projectileQuery(game.world).length).toBe(1);
    expect(Health.current[enemy]).toBe(100);

    for (let i = 0; i < 12; i += 1) game.tick(0.02);

    expect(Health.current[enemy]).toBe(90);
    expect(projectileQuery(game.world).length).toBe(0);
  });

  it('Wave 7.B.2: projectile keeps flying in its last direction when the target dies mid-flight', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    game.pipeline.register(createProjectileSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const tower = game.world.addEntity();
    addComponent(game.world, Position, tower);
    addComponent(game.world, Faction, tower);
    addComponent(game.world, Attack, tower);
    Position.x[tower] = 0;
    Position.y[tower] = 0;
    Faction.team[tower] = FactionTeam.Player;
    Attack.damage[tower] = 5;
    Attack.range[tower] = 500;
    Attack.cooldown[tower] = 10;
    Attack.cooldownLeft[tower] = 0;
    Attack.projectileSpeed[tower] = 200;

    const target = game.world.addEntity();
    addComponent(game.world, Position, target);
    addComponent(game.world, Faction, target);
    addComponent(game.world, Health, target);
    Position.x[target] = 300;
    Position.y[target] = 0;
    Faction.team[target] = FactionTeam.Enemy;
    Health.current[target] = 100;
    Health.max[target] = 100;

    game.tick(0.05);
    const projectileQuery = defineQuery([Projectile]);
    const inflight = projectileQuery(game.world)[0]!;
    expect(Projectile.vx[inflight]).toBeCloseTo(200, 1);

    Health.current[target] = 0;

    for (let i = 0; i < 5; i += 1) game.tick(0.05);
    expect(Projectile.vx[inflight]).toBeCloseTo(200, 1);
    expect(Position.x[inflight]).toBeGreaterThan(40);
  });
});

