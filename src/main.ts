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
import { DeathEffectSystem } from './systems/DeathEffectSystem.js';
import { ExplosionEffectSystem } from './systems/ExplosionEffectSystem.js';
import { LightningBoltSystem } from './systems/LightningBoltSystem.js';
import { SaveManager } from './utils/SaveManager.js';
import { LEVELS } from './data/levels/index.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, SKILL_CONFIGS, PRODUCTION_CONFIGS } from './data/gameData.js';
import { GamePhase, GameScreen, CType, TileType, UnitType, type InputEvent, type MapConfig, type LevelConfig } from './types/index.js';
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
import { Production } from './components/Production.js';
import { DeathEffect } from './components/DeathEffect.js';
import { AI } from './components/AI.js';

// New unit system imports
import { AISystem } from './systems/AISystem.js';
import { LifecycleSystem } from './systems/LifecycleSystem.js';
import { UnitFactory } from './systems/UnitFactory.js';
import { ALL_AI_CONFIGS } from './ai/presets/aiConfigs.js';

// Debug system imports
import { DebugManager } from './debug/DebugManager.js';

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

  // New unit system
  private aiSystem!: AISystem;
  private lifecycleSystem!: LifecycleSystem;
  private unitFactory!: UnitFactory;

  // Debug system
  private debugManager!: DebugManager;

  private unitDragId: number | null = null;

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
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const baseX = basePath.col * ts + ts / 2 + ox;
    const baseY = basePath.row * ts + ts / 2 + oy;
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
      tower.totalInvested += cost;
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
      (entityId) => this.recycleEntity(entityId),
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
        const unitPos = this.world.getComponent<Position>(unitId, CType.Position);
        if (unitPos) {
          const effectId = this.world.createEntity();
          this.world.addComponent(effectId, new Position(unitPos.x, unitPos.y));
          this.world.addComponent(effectId, new Render('circle', '#f44336', 24));
          this.world.addComponent(effectId, new DeathEffect(0.3));
        }
      },
    );

    const renderSystem = new RenderSystem(
      this.world, this.renderer, map,
      () => this.uiSystem.selectedTowerEntityId,
      () => this.uiSystem.selectedUnitEntityId,
    );
    const movementSystem = new MovementSystem(this.world, map);
    const enemyAttackSystem = new EnemyAttackSystem(this.world);
    const attackSystem = new AttackSystem(this.world);
    const unitSystem = new UnitSystem(this.world, map);
    const projectileSystem = new ProjectileSystem(this.world);

    this.skillSystem = new SkillSystem(
      this.world,
      (amount) => this.economy.spendEnergy(amount),
    );

    this.buffSystem = new BuffSystem(this.world);

    const productionSystem = new ProductionSystem(this.world, this.economy);
    const trapSystem = new TrapSystem(this.world, map.tileSize);
    const healingSystem = new HealingSystem(this.world);
    const deathEffectSystem = new DeathEffectSystem(this.world);
    const explosionEffectSystem = new ExplosionEffectSystem(this.world);
    const lightningBoltSystem = new LightningBoltSystem(this.world, this.renderer);

    // Initialize new unit system
    this.aiSystem = new AISystem(this.world);
    this.lifecycleSystem = new LifecycleSystem(this.world);
    this.unitFactory = new UnitFactory(this.world);

    // Register AI configurations
    this.aiSystem.registerAIConfigs(ALL_AI_CONFIGS);

    // Initialize debug manager
    this.debugManager = new DebugManager(this.world);
    this.debugManager.registerAIConfigs(ALL_AI_CONFIGS);

    // UI overlay
    this.onPostRender = () => {
      lightningBoltSystem.renderBolts();
      this.uiSystem.renderUI();
    };

    // Input dispatch for battle
    this.input.onPointerDown = (e: InputEvent) => {
      if (this.buildSystem.dragState?.active) return;
      if (this.unitDragId !== null) return;
      const handledByUI = this.uiSystem.handleClick(e.x, e.y);
      if (handledByUI) return;
      if (this.paused) return;
      const sceneBottom = RenderSystem.sceneOffsetY + RenderSystem.sceneH;
      if (e.y >= sceneBottom + 8) return;

      const unitId = this.findUnitAt(e.x, e.y);
      if (unitId !== null) {
        this.unitDragId = unitId;
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = unitId;
        this.uiSystem.selectedEntityType = 'unit';
        const pos = this.world.getComponent<Position>(unitId, CType.Position);
        const ctrl = this.world.getComponent<PlayerControllable>(unitId, CType.PlayerControllable);
        if (pos && ctrl) {
          ctrl.targetX = pos.x;
          ctrl.targetY = pos.y;
        }
        return;
      }

      this.handleMapClick(e);
    };

    this.input.onPointerMove = (e: InputEvent) => {
      if (this.unitDragId !== null) {
        const ctrl = this.world.getComponent<PlayerControllable>(this.unitDragId, CType.PlayerControllable);
        if (ctrl) {
          ctrl.targetX = e.x;
          ctrl.targetY = e.y;
        }
      }
    };

    this.input.onPointerUp = (e: InputEvent) => {
      if (this.unitDragId !== null) {
        this.unitDragId = null;
        return;
      }

      const ds = this.buildSystem.dragState;
      if (ds?.active) {
        const sceneBottom = RenderSystem.sceneOffsetY + RenderSystem.sceneH;
        if (e.y >= sceneBottom + 8) {
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
      
      // Update debug manager
      this.debugManager.update();
      
      if (this.phase === GamePhase.Victory) {
        this.handleVictory();
      } else if (this.phase === GamePhase.Defeat) {
        this.handleDefeat();
      }
    };

    // Register systems
    this.world.registerSystem(this.lifecycleSystem);  // Lifecycle first
    this.world.registerSystem(this.aiSystem);         // AI system
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
    this.world.registerSystem(deathEffectSystem);
    this.world.registerSystem(explosionEffectSystem);
    this.world.registerSystem(this.healthSystem);
    this.world.registerSystem(this.economy);
    this.world.registerSystem(this.buildSystem);
    this.world.registerSystem(renderSystem);
    this.world.registerSystem(lightningBoltSystem); // direct canvas draw — after buffered render
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

  private findUnitAt(x: number, y: number): number | null {
    const units = this.world.query(CType.Position, CType.Unit, CType.Render);
    for (const id of units) {
      const pos = this.world.getComponent<Position>(id, CType.Position);
      const render = this.world.getComponent<Render>(id, CType.Render);
      if (!pos || !render) continue;
      const r = render.size * 0.65;
      if (Math.abs(x - pos.x) < r && Math.abs(y - pos.y) < r) return id;
    }
    return null;
  }

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
        this.debugManager.selectEntity(id);
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
        this.debugManager.selectEntity(id);
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
        this.debugManager.selectEntity(id);
        return;
      }
    }

    // Deselect everything
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
    this.uiSystem.enemyEntityId = null;
    this.debugManager.selectEntity(null);
  }

  private spawnUnitAt(px: number, py: number): void {
    const unitType = this.buildSystem.dragState?.unitType;
    if (!unitType) return;

    const config = UNIT_CONFIGS[unitType];
    if (!config) return;

    const map = this.currentMap;
    if (!map) return;

    const ts = map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const col = Math.floor((px - ox) / ts);
    const row = Math.floor((py - oy) / ts);

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

    const x = col * ts + ts / 2 + ox;
    const y = row * ts + ts / 2 + oy;

    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(x, y));
    this.world.addComponent(id, new Health(config.hp));
    this.world.addComponent(id, new Attack(config.atk, config.attackRange, config.attackSpeed));
    this.world.addComponent(id, new Unit(config.type, config.popCost, config.skillId, config.speed, config.cost, x, y, config.moveRange));
    this.world.addComponent(id, new PlayerControllable());
    this.world.addComponent(id, new Skill(config.skillId, cooldown, energyCost));
    this.world.addComponent(id, new PlayerOwned());

    const render = new Render('circle', config.color, config.size);
    render.outline = true;
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 16;
    this.world.addComponent(id, render);
    
    // 添加AI组件 - 根据单位类型选择AI配置
    const aiConfigId = this.getUnitAIConfig(unitType);
    const ai = new AI(aiConfigId);
    ai.setBlackboard('home_x', x);
    ai.setBlackboard('home_y', y);
    this.world.addComponent(id, ai);
  }
  
  private getUnitAIConfig(unitType: UnitType): string {
    switch (unitType) {
      case UnitType.ShieldGuard:
        return 'soldier_tank';
      case UnitType.Swordsman:
        return 'soldier_dps';
      default:
        return 'soldier_basic';
    }
  }

  private recycleEntity(entityId: number): void {
    const tower = this.world.getComponent<Tower>(entityId, CType.Tower);
    const unit = this.world.getComponent<Unit>(entityId, CType.Unit);
    const prod = this.world.getComponent<Production>(entityId, CType.Production);

    let refund = 0;

    if (tower) {
      refund = Math.floor(tower.totalInvested * 0.5);
    } else if (unit) {
      refund = Math.floor(unit.cost * 0.5);
    } else if (this.world.hasComponent(entityId, CType.Trap)) {
      refund = Math.floor(40 * 0.5);
    } else if (prod) {
      const cfg = PRODUCTION_CONFIGS[prod.productionType];
      if (cfg) {
        let invested = cfg.cost;
        for (let i = 0; i < prod.level - 1; i++) {
          invested += cfg.upgradeCosts[i] ?? 0;
        }
        refund = Math.floor(invested * 0.5);
      }
    }

    this.economy.addGold(refund);

    if (unit) {
      this.economy.releaseUnit(unit.popCost);
    }

    this.world.destroyEntity(entityId);
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
  }
}

// ---- Entry ----

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const game = new TowerDefenderGame(canvas);
game.start();

window.addEventListener('resize', () => game.resize());
(window as unknown as Record<string, unknown>).game = game;
