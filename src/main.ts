import { Game } from './core/Game.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { EnemyAttackSystem } from './systems/EnemyAttackSystem.js';
import { AttackSystem } from './systems/AttackSystem.js';
import { UnitSystem } from './systems/UnitSystem.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { BuffSystem } from './systems/BuffSystem.js';
import { ProductionSystem } from './systems/ProductionSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { EconomySystem } from './systems/EconomySystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { UISystem } from './systems/UISystem.js';
import { LevelSelectUI } from './systems/LevelSelectUI.js';
import { TrapSystem } from './systems/TrapSystem.js';
import { HealingSystem } from './systems/HealingSystem.js';
import { SaveManager } from './utils/SaveManager.js';
import { LEVELS } from './data/levels/index.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, SKILL_CONFIGS } from './data/gameData.js';
import { GamePhase, GameScreen, CType, TileType, type InputEvent, type MapConfig, type LevelConfig } from './types/index.js';
import { Position, GridOccupant } from './components/Position.js';
import { Health } from './components/Health.js';
import { Attack } from './components/Attack.js';
import { Render } from './components/Render.js';
import { Unit } from './components/Unit.js';
import { PlayerControllable } from './components/PlayerControllable.js';
import { Skill } from './components/Skill.js';
import { Tower } from './components/Tower.js';
import { PlayerOwned } from './components/PlayerOwned.js';
import { Enemy } from './components/Enemy.js';

class TowerDefenderGame extends Game {
  private currentScreen: GameScreen = GameScreen.LevelSelect;
  private phase: GamePhase = GamePhase.Deployment;

  private levelSelectUI: LevelSelectUI;
  private currentLevelId: number = 1;
  private currentMap: MapConfig | null = null;

  private economy!: EconomySystem;
  private waveSystem!: WaveSystem;
  private buildSystem!: BuildSystem;
  private uiSystem!: UISystem;
  private skillSystem!: SkillSystem;
  private buffSystem!: BuffSystem;
  private healthSystem!: HealthSystem;
  private baseHealth: Health | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.levelSelectUI = new LevelSelectUI(
      this.renderer,
      (levelId) => this.startLevel(levelId),
      () => this.startEndless(),
    );

    this.enterLevelSelect();
  }

  // ---- Screen Management ----

  private enterLevelSelect(): void {
    this.currentScreen = GameScreen.LevelSelect;
    this.world.clear();
    this.onUpdate = (dt) => this.levelSelectUI.update(dt);
    this.onPostRender = null;
    this.onAfterUpdate = null;
    this.input.onPointerDown = (e: InputEvent) => {
      this.levelSelectUI.handleClick(e.x, e.y);
    };
    this.input.onPointerMove = null;
    this.input.onPointerUp = null;
  }

  startLevel(levelId: number): void {
    const config = LEVELS[levelId - 1];
    if (!config) return;

    this.currentLevelId = levelId;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;

    this.world.clear();
    this.initBattle(config);
  }

  startEndless(): void {
    const config = LEVELS[0];
    if (!config) return;

    this.currentLevelId = 1;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;

    this.world.clear();
    this.initBattle(config);
  }

  // ---- Battle Init ----

  private initBattle(config: LevelConfig): void {
    const map = config.map;
    this.currentMap = map;

    // Create base entity
    const basePath = map.enemyPath[map.enemyPath.length - 1]!;
    const ts = map.tileSize;
    const baseX = basePath.col * ts + ts / 2;
    const baseY = basePath.row * ts + ts / 2;
    const baseId = this.world.createEntity();
    this.world.addComponent(baseId, new Position(baseX, baseY));
    this.baseHealth = new Health(100);
    this.world.addComponent(baseId, this.baseHealth);
    const baseRender = new Render('hexagon', '#42a5f5', ts * 0.6);
    baseRender.label = '基地';
    baseRender.labelColor = '#ffffff';
    baseRender.labelSize = 16;
    this.world.addComponent(baseId, baseRender);

    // Spawn neutral units from map config (stub)
    this.spawnNeutralUnits(map);

    // Economy
    this.economy = new EconomySystem(this.world);
    this.economy.gold = config.startingGold;

    // Wave system
    this.waveSystem = new WaveSystem(
      this.world, map, config.waves,
      () => this.phase,
      (p) => { this.phase = p; },
    );

    // Build system
    this.buildSystem = new BuildSystem(
      this.world, map,
      () => this.phase,
      (amount) => this.economy.spendGold(amount),
    );

    if (config.availableTowers.length > 0 && config.availableTowers[0]) {
      this.buildSystem.selectTower(config.availableTowers[0]);
    }

    // Callbacks
    const upgradeTower = (entityId: number) => {
      const tower = this.world.getComponent<Tower>(entityId, CType.Tower);
      const atk = this.world.getComponent<Attack>(entityId, CType.Attack);
      const render = this.world.getComponent<Render>(entityId, CType.Render);
      if (!tower || !atk) return;
      if (tower.level >= 5) return;

      const towerCfg = TOWER_CONFIGS[tower.towerType];
      if (!towerCfg) return;

      const costIdx = tower.level - 1;
      const cost = towerCfg.upgradeCosts[costIdx];
      if (cost === undefined) return;

      if (!this.economy.spendGold(cost)) return;

      tower.level++;
      atk.atk += towerCfg.upgradeAtkBonus[costIdx] ?? 0;
      atk.range += towerCfg.upgradeRangeBonus[costIdx] ?? 0;
      if (render) {
        render.label = `${towerCfg.name} Lv.${tower.level}`;
      }
    };

    this.uiSystem = new UISystem(
      this.world, this.renderer,
      () => this.phase,
      () => this.economy.gold,
      () => this.waveSystem.currentWave,
      () => this.waveSystem.totalWaves,
      () => this.waveSystem.isActive,
      () => this.buildSystem.selectedTower,
      (type) => {
        this.buildSystem.selectTower(type);
        this.uiSystem.selectedTowerEntityId = null;
      },
      () => this.waveSystem.startWave(),
      () => this.economy.energy,
      () => this.economy.population,
      () => this.economy.maxPopulation,
      upgradeTower,
      (entityType, towerType, unitType, productionType) => {
        this.buildSystem.startDrag(entityType as 'tower' | 'unit' | 'production' | 'trap', {
          towerType: towerType ?? undefined,
          unitType: unitType ?? undefined,
          productionType: productionType ?? undefined,
        });
      },
      () => this.buildSystem.dragState,
      () => this.input.pointerPosition,
      () => this.economy.endlessScore,
      () => this.economy.isEndless,
      () => this.waveSystem.skipCountdown(),
      () => { this.gameSpeed = this.gameSpeed === 1.0 ? 2.0 : 1.0; },
      () => { this.paused = true; },
      () => { this.paused = false; },
      () => { location.reload(); },
      () => { this.paused = false; this.enterLevelSelect(); },
      () => this.waveSystem.countdown,
      () => this.gameSpeed,
      () => this.paused,
      () => this.waveSystem.totalSpawned,
    );

    this.healthSystem = new HealthSystem(
      this.world,
      () => this.phase,
      (p) => { this.phase = p; },
      (enemyId) => this.economy.rewardForEnemy(enemyId),
      (unitId) => {
        const unit = this.world.getComponent<Unit>(unitId, CType.Unit);
        if (unit) {
          this.economy.releaseUnit(unit.popCost);
        }
      },
    );

    const renderSystem = new RenderSystem(
      this.world, this.renderer, map,
      () => this.uiSystem.selectedTowerEntityId,
    );
    const movementSystem = new MovementSystem(this.world, map);
    const enemyAttackSystem = new EnemyAttackSystem(this.world);
    const attackSystem = new AttackSystem(this.world);
    const unitSystem = new UnitSystem(this.world);
    const projectileSystem = new ProjectileSystem(this.world);

    this.skillSystem = new SkillSystem(
      this.world,
      (amount) => this.economy.spendEnergy(amount),
    );

    this.buffSystem = new BuffSystem(this.world);

    const productionSystem = new ProductionSystem(this.world, this.economy);
    const trapSystem = new TrapSystem(this.world);
    const healingSystem = new HealingSystem(this.world);

    // UI overlay
    this.onPostRender = () => this.uiSystem.renderUI();

    // Input dispatch for battle
    this.input.onPointerDown = (e: InputEvent) => {
      if (this.buildSystem.dragState?.active) return;
      const handledByUI = this.uiSystem.handleClick(e.x, e.y);
      if (!handledByUI && !this.paused) {
        // Guard: don't pass bottom panel or left panel clicks to map
        if (e.y >= 900) return;
        if (e.x <= 160) return;
        this.handleMapClick(e);
      }
    };

    this.input.onPointerMove = (_e: InputEvent) => {
      // Drag ghost is rendered by UISystem via getPointerPosition
    };

    this.input.onPointerUp = (e: InputEvent) => {
      const ds = this.buildSystem.dragState;
      if (ds?.active) {
        if (e.y >= 900 || e.x <= 160) {
          this.buildSystem.cancelDrag();
          return;
        }
        if (ds.entityType === 'unit') {
          this.spawnUnitAt(e.x, e.y);
          this.buildSystem.cancelDrag();
        } else {
          const result = this.buildSystem.tryDrop(e.x, e.y);
          if (result !== false && result !== null) {
            this.uiSystem.selectedEntityId = result;
            this.uiSystem.selectedEntityType = ds.entityType === 'tower' ? 'tower' : null;
          }
        }
      }
    };

    // Phase transition watcher
    this.onUpdate = null;
    this.onAfterUpdate = () => {
      if (this.currentScreen !== GameScreen.Battle) return;
      if (this.phase === GamePhase.Victory) {
        this.handleVictory();
      } else if (this.phase === GamePhase.Defeat) {
        this.handleDefeat();
      }
    };

    // Register systems
    this.world.registerSystem(movementSystem);
    this.world.registerSystem(enemyAttackSystem);
    this.world.registerSystem(attackSystem);
    this.world.registerSystem(unitSystem);
    this.world.registerSystem(projectileSystem);
    this.world.registerSystem(this.skillSystem);
    this.world.registerSystem(this.buffSystem);
    this.world.registerSystem(productionSystem);
    this.world.registerSystem(this.waveSystem);
    this.world.registerSystem(trapSystem);
    this.world.registerSystem(healingSystem);
    this.world.registerSystem(this.healthSystem);
    this.world.registerSystem(this.economy);
    this.world.registerSystem(this.buildSystem);
    this.world.registerSystem(renderSystem);
    this.world.registerSystem(this.uiSystem);

    // Start auto-countdown for first wave
    this.waveSystem.startAutoCountdown(5);
  }

  // ---- Victory / Defeat ----

  private handleVictory(): void {
    this.phase = GamePhase.Victory;
    const baseHpRatio = this.baseHealth ? this.baseHealth.ratio : 0;
    let stars = 1;
    if (baseHpRatio > 0.6) stars = 2;
    if (baseHpRatio >= 1.0) stars = 3;

    SaveManager.setStars(this.currentLevelId, stars);
    if (this.currentLevelId < 5) {
      SaveManager.unlockLevel(this.currentLevelId + 1);
    }

    this.levelSelectUI.refresh();
    setTimeout(() => this.enterLevelSelect(), 1500);
  }

  private handleDefeat(): void {
    this.phase = GamePhase.Defeat;
    this.levelSelectUI.refresh();
    setTimeout(() => this.enterLevelSelect(), 1500);
  }

  // ---- Neutral Units (stub) ----

  private spawnNeutralUnits(_map: MapConfig): void {
    // Phase 3 neutral units — stub for now
  }

  // ---- Map Click ----

  private handleMapClick(e: InputEvent): void {
    // Try clicking on an enemy first
    const enemies = this.world.query(CType.Position, CType.Enemy, CType.Render);
    for (const id of enemies) {
      const pos = this.world.getComponent<Position>(id, CType.Position);
      const render = this.world.getComponent<Render>(id, CType.Render);
      if (!pos || !render) continue;
      const r = render.size * 0.65;
      if (Math.abs(e.x - pos.x) < r && Math.abs(e.y - pos.y) < r) {
        this.uiSystem.selectEnemy(id);
        return;
      }
    }

    // Try clicking on a tower
    const towers = this.world.query(CType.Position, CType.Tower, CType.Render);
    for (const id of towers) {
      const pos = this.world.getComponent<Position>(id, CType.Position);
      const render = this.world.getComponent<Render>(id, CType.Render);
      if (!pos || !render) continue;
      const r = render.size * 0.65;
      if (Math.abs(e.x - pos.x) < r && Math.abs(e.y - pos.y) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = id;
        this.uiSystem.selectedEntityType = 'tower';
        return;
      }
    }

    // Try clicking on a placed unit
    const units = this.world.query(CType.Position, CType.Unit, CType.Render);
    for (const id of units) {
      const pos = this.world.getComponent<Position>(id, CType.Position);
      const render = this.world.getComponent<Render>(id, CType.Render);
      if (!pos || !render) continue;
      const r = render.size * 0.65;
      if (Math.abs(e.x - pos.x) < r && Math.abs(e.y - pos.y) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = id;
        this.uiSystem.selectedEntityType = 'unit';
        return;
      }
    }

    // Deselect everything
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
    this.uiSystem.enemyEntityId = null;
  }

  private spawnUnitAt(px: number, py: number): void {
    const unitType = this.buildSystem.dragState?.unitType;
    if (!unitType) return;

    const config = UNIT_CONFIGS[unitType];
    if (!config) return;

    const map = this.currentMap;
    if (!map) return;

    const ts = map.tileSize;
    const col = Math.floor(px / ts);
    const row = Math.floor(py / ts);

    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return;

    const tile = map.tiles[row]![col]!;
    if (tile !== TileType.Empty && tile !== TileType.Path) return;

    const occupants = this.world.query(CType.GridOccupant);
    for (const id of occupants) {
      const grid = this.world.getComponent<GridOccupant>(id, CType.GridOccupant);
      if (grid && grid.gridPos.row === row && grid.gridPos.col === col) return;
    }

    if (!this.economy.canDeployUnit(config.popCost)) return;

    if (!this.economy.spendGold(config.cost)) return;

    this.economy.deployUnit(config.popCost);

    const skillCfg = SKILL_CONFIGS[config.skillId];
    const energyCost = skillCfg ? skillCfg.energyCost : 0;
    const cooldown = skillCfg ? skillCfg.cooldown : 0;

    const x = col * ts + ts / 2;
    const y = row * ts + ts / 2;

    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(x, y));
    this.world.addComponent(id, new Health(config.hp));
    this.world.addComponent(id, new Attack(config.atk, config.attackRange, config.attackSpeed));
    this.world.addComponent(id, new Unit(config.type, config.popCost, config.skillId, config.speed));
    this.world.addComponent(id, new PlayerControllable());
    this.world.addComponent(id, new Skill(config.skillId, cooldown, energyCost));
    this.world.addComponent(id, new PlayerOwned());

    const render = new Render('circle', config.color, config.size);
    render.outline = true;
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 16;
    this.world.addComponent(id, render);
  }
}

// ---- Entry ----

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const game = new TowerDefenderGame(canvas);
game.start();

window.addEventListener('resize', () => game.resize());
(window as unknown as Record<string, unknown>).game = game;
