import { addComponent } from 'bitecs';

import { Game } from '../src/core/Game.js';
import {
  Attack,
  Faction,
  FactionTeam,
  Health,
  Position,
  UnitCategory,
  UnitTag,
} from '../src/core/components.js';
import type { UnitConfig } from '../src/factories/UnitFactory.js';
import { spawnUnit } from '../src/factories/UnitFactory.js';
import { EconomySystem } from '../src/systems/EconomySystem.js';
import { createAttackSystem } from '../src/systems/AttackSystem.js';
import { createCrystalSystem } from '../src/systems/CrystalSystem.js';
import { createHealthSystem } from '../src/systems/HealthSystem.js';
import { createLifecycleSystem } from '../src/systems/LifecycleSystem.js';
import { createMovementSystem } from '../src/systems/MovementSystem.js';
import { createProjectileSystem } from '../src/systems/ProjectileSystem.js';
import { createWaveSystem, type WaveConfig, type SpawnConfig } from '../src/systems/WaveSystem.js';

const GRUNT: UnitConfig = {
  id: 'grunt',
  category: 'Enemy',
  faction: 'Enemy',
  stats: { hp: 30, atk: 0, attackSpeed: 0, range: 0, speed: 80 },
  visual: { shape: 'circle', color: 0xef5350, size: 24 },
  lifecycle: { onDeath: [{ handler: 'drop_gold', params: { amount: 5 } }] },
};

const TOWER_UNIT: UnitConfig = {
  id: 'arrow_tower',
  category: 'Tower',
  faction: 'Player',
  stats: { hp: 100, atk: 10, attackSpeed: 1, range: 150, speed: 0 },
  visual: { shape: 'rect', color: 0x42a5f5, size: 32 },
};

const FRAMES = 600;
const TARGET_AVG_MS = 16.67;
const TARGET_P95_MS = 22;
const DT = 1 / 60;

const VIEWPORT_W = 1344;

function spawnTower(game: Game, x: number, y: number): void {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Attack, eid);
  addComponent(game.world, Health, eid);
  addComponent(game.world, UnitTag, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Player;
  UnitTag.category[eid] = UnitCategory.Tower;
  Attack.damage[eid] = 10;
  Attack.range[eid] = 150;
  Attack.cooldown[eid] = 1;
  Attack.cooldownLeft[eid] = 0;
  Attack.projectileSpeed[eid] = 400;
  Health.current[eid] = 100;
  Health.max[eid] = 100;
}

function run(): void {
  const game = new Game();
  const economy = new EconomySystem();
  game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
    const amount = typeof params['amount'] === 'number' ? params['amount'] : 0;
    if (amount > 0) economy.addGold(amount);
  });

  const path = [
    { x: 0, y: 288 },
    { x: VIEWPORT_W, y: 288 },
  ];

  const waves: WaveConfig[] = Array.from({ length: 10 }, (_, i) => ({
    waveNumber: i + 1,
    spawnDelayMs: 0,
    groups: [{ enemyId: 'grunt', count: 5, intervalMs: 200 }],
  }));
  const spawns: SpawnConfig[] = [{ id: 's1', x: 0, y: 288 }];
  const unitConfigs = new Map([['grunt', GRUNT]]);

  const waveSystem = createWaveSystem({ waves, spawns, unitConfigs });
  game.pipeline.register(waveSystem);
  game.pipeline.register(createMovementSystem({ path }));
  game.pipeline.register(createAttackSystem());
  game.pipeline.register(createProjectileSystem());
  game.pipeline.register(createCrystalSystem());
  game.pipeline.register(createHealthSystem());
  game.pipeline.register(createLifecycleSystem());

  const towerXPositions = [200, 400, 600, 800, 1000];
  for (const x of towerXPositions) {
    spawnTower(game, x, 288 - 80);
  }
  for (let i = 0; i < 50; i++) {
    spawnUnit(game.world, GRUNT, { x: -64 - i * 16, y: 288 });
  }

  waveSystem.start();

  const frameTimes: number[] = [];
  for (let f = 0; f < FRAMES; f++) {
    const t0 = performance.now();
    game.tick(DT);
    frameTimes.push(performance.now() - t0);
  }

  frameTimes.sort((a, b) => a - b);
  const avg = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
  const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)]!;
  const p99 = frameTimes[Math.floor(frameTimes.length * 0.99)]!;
  const maxT = frameTimes[frameTimes.length - 1]!;

  console.log(`\n=== Wave 7 性能基线 (${FRAMES} frames @ 60fps) ===`);
  console.log(`avg  : ${avg.toFixed(3)} ms  [target ≤ ${TARGET_AVG_MS} ms]  ${avg <= TARGET_AVG_MS ? '✅' : '❌ OVER'}`);
  console.log(`p95  : ${p95.toFixed(3)} ms  [target ≤ ${TARGET_P95_MS} ms]  ${p95 <= TARGET_P95_MS ? '✅' : '❌ OVER'}`);
  console.log(`p99  : ${p99.toFixed(3)} ms`);
  console.log(`max  : ${maxT.toFixed(3)} ms`);
  console.log(`economy.gold: ${economy.gold}`);

  if (avg > TARGET_AVG_MS || p95 > TARGET_P95_MS) {
    console.log('\n⚠️  性能未达目标，建议 Wave 8 跟进 hot spot 分析');
    console.log('   典型疑似: bitecs query 重建 / Renderer drawRect 数量 / LifecycleSystem 遍历');
    process.exit(1);
  }
}

run();
