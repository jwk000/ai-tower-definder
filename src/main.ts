import { Container } from 'pixi.js';

import { Game } from './core/Game.js';
import { LevelState } from './core/LevelState.js';
import { RunController } from './core/RunController.js';
import { Renderer } from './render/Renderer.js';
import { UIPresenter } from './ui/UIPresenter.js';
import { MainMenu, type MainMenuAction } from './ui/MainMenu.js';
import { HandPanel, type PlayCardIntent } from './ui/HandPanel.js';
import { InterLevelPanel, type InterLevelIntent } from './ui/InterLevelPanel.js';
import { RunResultPanel } from './ui/RunResultPanel.js';
import { createAttackSystem } from './systems/AttackSystem.js';
import { createCrystalSystem } from './systems/CrystalSystem.js';
import { createHealthSystem } from './systems/HealthSystem.js';
import { createLifecycleSystem } from './systems/LifecycleSystem.js';
import { createMovementSystem } from './systems/MovementSystem.js';
import { createProjectileSystem } from './systems/ProjectileSystem.js';
import {
  createWaveSystem,
  type SpawnConfig,
  type WaveConfig,
  type WaveSystem,
} from './systems/WaveSystem.js';
import { CardRegistry } from './unit-system/CardRegistry.js';
import { CardSpawnSystem } from './unit-system/CardSpawnSystem.js';
import { DeckSystem } from './unit-system/DeckSystem.js';
import { EnergySystem } from './unit-system/EnergySystem.js';
import { HandSystem } from './unit-system/HandSystem.js';
import { RunManager } from './unit-system/RunManager.js';
import {
  loadCardConfigsForLevel,
  loadUnitConfigsForLevel,
  parseLevelConfig,
} from './config/loader.js';
import type { HandCard, HandState } from './ui/HandPanel.js';
import type { RunState } from './ui/HUD.js';

import level01Yaml from './config/levels/level-01.yaml?raw';
import enemiesYaml from './config/units/enemies.yaml?raw';
import towerUnitsYaml from './config/units/towers.yaml?raw';
import towerCardsYaml from './config/cards/towers.yaml?raw';

const GRID_COLS = 21;
const GRID_ROWS = 9;
const CELL_SIZE = 64;
const VIEWPORT_WIDTH = GRID_COLS * CELL_SIZE;
const VIEWPORT_HEIGHT = GRID_ROWS * CELL_SIZE;
const WAVE_COMPLETE_GOLD = 20;

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found in index.html');
  }

  const level = parseLevelConfig(level01Yaml);
  const unitYamlFiles = new Map<string, string>([
    ['units/enemies.yaml', enemiesYaml],
    ['units/towers.yaml', towerUnitsYaml],
  ]);
  const cardYamlFiles = new Map<string, string>([
    ['cards/towers.yaml', towerCardsYaml],
  ]);
  const unitConfigs = loadUnitConfigsForLevel(level, unitYamlFiles);
  const cardConfigs = loadCardConfigsForLevel(level, cardYamlFiles);

  const renderer = new Renderer({
    canvas,
    worldWidth: VIEWPORT_WIDTH,
    worldHeight: VIEWPORT_HEIGHT,
    cellSize: CELL_SIZE,
  });
  await renderer.init();

  const mainMenuContainer = new Container();
  const battleContainer = new Container();
  const interLevelContainer = new Container();
  const runResultContainer = new Container();
  renderer.uiLayer.addChild(
    mainMenuContainer,
    battleContainer,
    interLevelContainer,
    runResultContainer,
  );

  const cardRegistry = new CardRegistry();
  for (const unit of unitConfigs.values()) {
    cardRegistry.registerUnit(unit);
  }
  for (const card of cardConfigs) {
    cardRegistry.registerCard(card);
  }

  const cardIds = cardConfigs.map((c) => c.id);
  const deckSystem = new DeckSystem({ pool: cardIds, deckSize: 5, rng: Math.random });
  const handSystem = new HandSystem({ maxSize: 3 });
  const energySystem = new EnergySystem({
    regenPerSecond: 1,
    max: 10,
    startWith: level.startingEnergy ?? 3,
  });
  const cardSpawnSystem = new CardSpawnSystem(cardRegistry);

  const levelState = new LevelState();
  levelState.reset(level.waves.length);

  const waveConfigs: WaveConfig[] = level.waves.map((w) => ({
    waveNumber: w.waveNumber,
    spawnDelayMs: w.startDelay * 1000,
    groups: w.groups.map((g) => ({
      enemyId: g.enemyId,
      count: g.count,
      intervalMs: g.interval * 1000,
    })),
  }));

  const spawnConfigs: SpawnConfig[] = level.spawns.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
  }));

  const game = new Game();

  const runManager = new RunManager({
    totalLevels: 1,
    initialGold: level.startingGold ?? 200,
  });

  game.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
    const amount = typeof params?.amount === 'number' ? params.amount : 0;
    if (amount > 0) runManager.addGold(amount);
  });

  let runController!: RunController;
  const waveSystem: WaveSystem = createWaveSystem({
    waves: waveConfigs,
    spawns: spawnConfigs,
    unitConfigs,
    onWaveComplete: () => {
      runManager.addGold(WAVE_COMPLETE_GOLD);
    },
    onAllWavesComplete: () => {
      runController.completeCurrentLevel();
    },
  });

  game.pipeline.register(waveSystem);
  game.pipeline.register(createMovementSystem({ path: level.path }));
  game.pipeline.register(createAttackSystem());
  game.pipeline.register(createProjectileSystem());
  game.pipeline.register(createCrystalSystem());
  game.pipeline.register(createHealthSystem());
  game.pipeline.register(createLifecycleSystem());

  runController = new RunController({
    game,
    runManager,
    scenes: {
      mainMenu: mainMenuContainer,
      battle: battleContainer,
      interLevel: interLevelContainer,
      runResult: runResultContainer,
    },
    waveSystem,
    levelState,
  });

  const presenter = new UIPresenter({
    battleContainer,
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
  });

  const mainMenu = new MainMenu({ hasSavedRun: false });
  mainMenu.setHandler((action: MainMenuAction) => {
    if (action === 'start-run') {
      runController.startRun();
      handSystem.clear();
      handSystem.drawTo(deckSystem);
      energySystem.reset();
      waveSystem.start();
    }
  });

  const handPanel = new HandPanel({
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
  });
  handPanel.setHandler((intent: PlayCardIntent) => {
    if (intent.kind !== 'play') return;
    const card = cardRegistry.getCard(intent.cardId);
    if (!card) return;
    if (!energySystem.spend(card.energyCost)) return;
    cardSpawnSystem.play(game.world, intent.cardId, { x: intent.targetX, y: intent.targetY });
    handSystem.playCard(intent.slot);
    deckSystem.discard(intent.cardId);
    handSystem.drawTo(deckSystem);
  });

  const interLevelPanel = new InterLevelPanel();
  interLevelPanel.setHandler((intent: InterLevelIntent) => {
    if (intent.kind !== 'enter-node') return;
    const choice = intent.node === 'skilltree' ? 'skip' : intent.node;
    runController.pickInterLevel(choice);
  });

  const runResultPanel = new RunResultPanel();
  runResultPanel.setHandler(() => {
    runController.returnToMainMenu();
  });

  const devHooks = (globalThis as Record<string, unknown>);
  devHooks['__td'] = { mainMenu, handPanel, interLevelPanel, runResultPanel, runController, waveSystem };

  let lastTime = performance.now();
  renderer.app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt <= 0) return;

    runController.tick(dt);

    if (runController.phase === 'Battle') {
      if (levelState.phase === 'battle' || levelState.phase === 'wave-break') {
        energySystem.tick(dt);
      }
      presenter.present(
        projectUIFrame(runManager, levelState, handSystem, energySystem, cardRegistry),
      );
    }
  });
}

function projectUIFrame(
  run: RunManager,
  level: LevelState,
  hand: HandSystem,
  energy: EnergySystem,
  registry: CardRegistry,
): { run: RunState; hand: HandState } {
  const handCards: HandCard[] = hand.cards.map((cardId, i) => {
    const cfg = registry.getCard(cardId);
    const cost = cfg?.energyCost ?? 0;
    return {
      slot: i,
      cardId,
      cost,
      playable: energy.canAfford(cost),
    };
  });
  return {
    run: {
      gold: run.gold,
      crystalHp: run.crystalHp,
      crystalHpMax: run.crystalHpMax,
      waveIndex: level.waveIndex + 1,
      waveTotal: level.waveTotal,
      phase: level.phase,
    },
    hand: {
      cards: handCards,
      energy: energy.current,
    },
  };
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
});
