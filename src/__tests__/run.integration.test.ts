import { describe, expect, it, vi } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../core/Game.js';
import {
  Crystal,
  Faction,
  FactionTeam,
  Health,
  Position,
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
import { createCrystalSystem } from '../systems/CrystalSystem.js';
import { createHealthSystem } from '../systems/HealthSystem.js';
import { createLifecycleSystem } from '../systems/LifecycleSystem.js';
import { createMovementSystem } from '../systems/MovementSystem.js';
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
