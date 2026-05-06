import { Game } from './core/Game.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { AttackSystem } from './systems/AttackSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { EconomySystem } from './systems/EconomySystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { UISystem } from './systems/UISystem.js';
import { MAP_01, MVP_WAVES } from './data/gameData.js';
import { GamePhase, type InputEvent } from './types/index.js';
import { Position } from './components/Position.js';
import { Health } from './components/Health.js';
import { Render } from './components/Render.js';

class TowerDefenderGame extends Game {
  private phase: GamePhase = GamePhase.Deployment;

  private economy!: EconomySystem;
  private waveSystem!: WaveSystem;
  private buildSystem!: BuildSystem;
  private uiSystem!: UISystem;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.init();
  }

  private init(): void {
    const map = MAP_01;

    // Create base entity
    const basePath = map.enemyPath[map.enemyPath.length - 1]!;
    const ts = map.tileSize;
    const baseX = basePath.col * ts + ts / 2;
    const baseY = basePath.row * ts + ts / 2;
    const baseId = this.world.createEntity();
    this.world.addComponent(baseId, new Position(baseX, baseY));
    this.world.addComponent(baseId, new Health(100));
    this.world.addComponent(baseId, new Render('hexagon', '#42a5f5', ts * 0.6));

    // --- Systems ---

    this.economy = new EconomySystem(this.world);
    this.economy.gold = 200;

    this.waveSystem = new WaveSystem(
      this.world, map, MVP_WAVES,
      () => this.phase,
      (p) => { this.phase = p; },
    );

    this.buildSystem = new BuildSystem(
      this.world, map,
      () => this.phase,
      (amount) => this.economy.spendGold(amount),
    );

    this.uiSystem = new UISystem(
      this.world, this.renderer,
      () => this.phase,
      () => this.economy.gold,
      () => this.waveSystem.currentWave,
      () => this.waveSystem.totalWaves,
      () => this.waveSystem.isActive,
      () => this.buildSystem.selectedTower,
      (type) => this.buildSystem.selectTower(type),
      () => this.waveSystem.startWave(),
    );

    const healthSystem = new HealthSystem(
      this.world,
      () => this.phase,
      (p) => { this.phase = p; },
      (enemyId) => this.economy.rewardForEnemy(enemyId),
    );

    const renderSystem = new RenderSystem(this.world, this.renderer, map);
    const movementSystem = new MovementSystem(this.world, map);
    const attackSystem = new AttackSystem(this.world);

    // UI overlay — rendered AFTER scene buffer flush
    this.onPostRender = () => this.uiSystem.renderUI();

    // ---- Input Dispatch ----
    this.input.onPointerDown = (e: InputEvent) => {
      // 1. Check UI buttons first
      this.uiSystem.handleClick(e.x, e.y);
      // 2. If not on UI, try building
      this.handleBuildClick(e);
    };

    // ---- Register systems ----
    this.world.registerSystem(movementSystem);
    this.world.registerSystem(attackSystem);
    this.world.registerSystem(this.waveSystem);
    this.world.registerSystem(healthSystem);
    this.world.registerSystem(this.economy);
    this.world.registerSystem(this.buildSystem);
    this.world.registerSystem(renderSystem);   // draw map + entities first (bottom layer)
    this.world.registerSystem(this.uiSystem);  // draw UI shapes on top
  }

  private handleBuildClick(e: InputEvent): void {
    // Don't build on UI panels
    if (e.x < 160 || e.y < 60) return;
    this.buildSystem.tryBuild(e.x, e.y);
  }
}

// ---- Entry ----

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const game = new TowerDefenderGame(canvas);
game.start();

window.addEventListener('resize', () => game.resize());
(window as unknown as Record<string, unknown>).game = game;
