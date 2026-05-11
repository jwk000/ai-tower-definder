import { Game } from './core/Game.js';
import { LayoutManager } from './ui/LayoutManager.js';
import { RenderSystem, computeSceneLayout } from './systems/RenderSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { EnemyAttackSystem } from './systems/EnemyAttackSystem.js';
import { AttackSystem } from './systems/AttackSystem.js';
import { BatSwarmSystem } from './systems/BatSwarmSystem.js';
import { LaserBeamSystem } from './systems/LaserBeamSystem.js';
import { UnitSystem } from './systems/UnitSystem.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { BuffSystem } from './systems/BuffSystem.js';
import { WeatherSystem } from './systems/WeatherSystem.js';
import { ProductionSystem } from './systems/ProductionSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { EconomySystem } from './systems/EconomySystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { UISystem } from './systems/UISystem.js';
import { LevelSelectUI } from './systems/LevelSelectUI.js';
import { TrapSystem } from './systems/TrapSystem.js';
import { ShamanSystem } from './systems/ShamanSystem.js';
import { CommandTowerSystem } from './systems/CommandTowerSystem.js';
import { HealingSystem } from './systems/HealingSystem.js';
import { HotAirBalloonSystem } from './systems/HotAirBalloonSystem.js';
import { DeathEffectSystem } from './systems/DeathEffectSystem.js';
import { ExplosionEffectSystem } from './systems/ExplosionEffectSystem.js';
import { BloodParticleSystem } from './systems/BloodParticleSystem.js';
import { FadingMarkSystem } from './systems/FadingMarkSystem.js';
import { ScreenShakeSystem } from './systems/ScreenShakeSystem.js';
import { TileDamageSystem } from './systems/TileDamageSystem.js';
import { LightningBoltSystem } from './systems/LightningBoltSystem.js';
import { DecorationSystem } from './systems/DecorationSystem.js';
import { ScreenFXSystem } from './systems/ScreenFXSystem.js';
import { SaveManager } from './utils/SaveManager.js';
import { Sound } from './utils/Sound.js';
import { Music } from './utils/Music.js';
import { LEVELS } from './data/levels/index.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, SKILL_CONFIGS, PRODUCTION_CONFIGS } from './data/gameData.js';
import { GamePhase, GameScreen, TileType, UnitType, TowerType, WeatherType, ProductionType, type InputEvent, type MapConfig, type LevelConfig } from './types/index.js';

// ---- bitecs component stores ----
import {
  Position, Health, Attack, Visual, Tower, PlayerControllable, PlayerOwned,
  Skill, UnitTag, AI, BatTower, Production, Trap, GridOccupant,
  DeathEffect, ExplosionEffect, Category, CategoryVal, Boss,
  Movement, ShapeVal, Layer, LayerVal, Faction, FactionVal,
  DamageTypeVal, TargetSelectionVal, AttackModeVal,
  BatSwarmMember,
  defineQuery,
} from './core/components.js';

import { hasComponent } from './core/World.js';

// ---- New unit system imports ----
import { AISystem } from './systems/AISystem.js';
import { LifecycleSystem } from './systems/LifecycleSystem.js';
import { UnitFactory } from './systems/UnitFactory.js';
import { ALL_AI_CONFIGS } from './ai/presets/aiConfigs.js';

// ---- Debug system imports ----
import { DebugManager } from './debug/DebugManager.js';

// ---- TowerType numeric ID → enum mapping (matches AttackSystem/BuildSystem) ----
const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
  TowerType.Missile,   // 6
  TowerType.Vine,      // 7
  TowerType.Command,   // 8
  TowerType.Ballista,  // 9
];

/** TowerType enum → bitecs ui8 */
const TOWER_TYPE_ID: Record<TowerType, number> = {
  [TowerType.Arrow]: 0,
  [TowerType.Cannon]: 1,
  [TowerType.Ice]: 2,
  [TowerType.Lightning]: 3,
  [TowerType.Laser]: 4,
  [TowerType.Bat]: 5,
  [TowerType.Missile]: 6,
  [TowerType.Vine]: 7,
  [TowerType.Command]: 8,
  [TowerType.Ballista]: 9,
};

// ---- Utility: hex color → RGB ----
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

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
  private weatherSystem!: WeatherSystem;
  private healthSystem!: HealthSystem;
  /** Entity ID of the base (for checking HP ratio on victory) */
  private baseEntityId: number | null = null;
  private batSwarmSystem!: BatSwarmSystem;
  private laserBeamSystem!: LaserBeamSystem;

  // ---- Scene decoration ----
  private decorationSystem!: DecorationSystem;
  private screenFXSystem!: ScreenFXSystem;
  private screenShakeSystem!: ScreenShakeSystem;
  private tileDamageSystem!: TileDamageSystem;

  // ---- New unit system ----
  private aiSystem!: AISystem;
  private lifecycleSystem!: LifecycleSystem;
  private unitFactory!: UnitFactory;

  // ---- Debug system ----
  private debugManager!: DebugManager;

  private unitDragId: number | null = null;
  private defeatSfxPlayed = false;
  private previousPhase: GamePhase = GamePhase.Deployment;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    Sound.preload();
    Sound.initUnlock(canvas);

    this.levelSelectUI = new LevelSelectUI(
      this.renderer,
      (levelId) => this.startLevel(levelId),
      () => this.startEndless(),
    );

    this.enterLevelSelect();
  }

  // ================================================================
  // Screen Management
  // ================================================================

  private enterLevelSelect(): void {
    this.currentScreen = GameScreen.LevelSelect;
    this.world.reset();
    Music.play('main_menu');
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

    this.world.reset();
    this.initBattle(config);
  }

  startEndless(): void {
    const config = LEVELS[0];
    if (!config) return;

    this.currentLevelId = 1;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;

    this.world.reset();
    this.initBattle(config);
  }

  // ================================================================
  // Battle Init
  // ================================================================

  private initBattle(config: LevelConfig): void {
    const map = config.map;
    this.currentMap = map;
    this.defeatSfxPlayed = false;
    this.previousPhase = GamePhase.Deployment;
    Music.play('battle_default');

    // ---- Create base entity ----
    const basePath = map.enemyPath[map.enemyPath.length - 1]!;
    const ts = map.tileSize;
    const layout = computeSceneLayout(map, LayoutManager.DESIGN_W, LayoutManager.DESIGN_H);
    const ox = layout.offsetX;
    const oy = layout.offsetY;
    const baseX = basePath.col * ts + ts / 2 + ox;
    const baseY = basePath.row * ts + ts / 2 + oy;
    this.baseEntityId = this.world.createEntity();
    this.world.addComponent(this.baseEntityId, Position, { x: baseX, y: baseY });
    this.world.addComponent(this.baseEntityId, Health, { current: 100, max: 100 });
    const baseRgb = hexToRgb('#42a5f5');
    this.world.addComponent(this.baseEntityId, Visual, {
      shape: ShapeVal.Hexagon,
      colorR: baseRgb.r,
      colorG: baseRgb.g,
      colorB: baseRgb.b,
      size: ts * 0.6,
    });
    this.world.addComponent(this.baseEntityId, Faction, { value: FactionVal.Player });
    this.world.addComponent(this.baseEntityId, Category, { value: CategoryVal.Objective });
    this.world.addComponent(this.baseEntityId, PlayerOwned);

    // Spawn neutral units from map config (stub)
    this.spawnNeutralUnits(map);

    // ---- Economy ----
    this.economy = new EconomySystem();
    this.economy.gold = config.startingGold;

    // ---- Wave system ----
    this.waveSystem = new WaveSystem(
      this.world, map, config.waves,
      () => this.phase,
      (p) => { this.phase = p; },
      () => {
        this.weatherSystem.onWaveEnd();
      },
    );

    // ---- Weather system — init with level config ----
    this.weatherSystem = new WeatherSystem();
    if (config.weatherPool && config.weatherPool.length > 0) {
      const randomIdx = Math.floor(Math.random() * config.weatherPool.length);
      const initialWeather = config.weatherPool[randomIdx]!;
      this.weatherSystem.init(
        config.weatherPool,
        config.weatherFixed,
        config.weatherChangeInterval,
      );
      this.weatherSystem.setWeather(initialWeather);
    } else {
      this.weatherSystem.init([WeatherType.Sunny]);
    }

    // ---- Build system ----
    this.buildSystem = new BuildSystem(
      map,
      () => this.phase,
      (amount) => this.economy.spendGold(amount),
    );

    if (config.availableTowers.length > 0 && config.availableTowers[0]) {
      this.buildSystem.selectTower(config.availableTowers[0]);
    }

    // ---- Upgrade tower callback (bitecs component access) ----
    const upgradeTower = (entityId: number) => {
      const towerTypeNum = Tower.towerType[entityId];
      if (towerTypeNum === undefined) return;
      const towerLevel = Tower.level[entityId]!;
      if (towerLevel >= 5) return;

      const tt = TOWER_TYPE_BY_ID[towerTypeNum];
      if (tt === undefined) return;
      const towerCfg = TOWER_CONFIGS[tt];
      if (!towerCfg) return;

      const costIdx = towerLevel - 1;
      const cost = towerCfg.upgradeCosts[costIdx];
      if (cost === undefined) return;

      if (!this.economy.spendGold(cost)) return;

      Tower.level[entityId] = towerLevel + 1;
      Tower.totalInvested[entityId]! += cost;

      // Upgrade visual flash
      Visual.hitFlashTimer[entityId] = 0.2;

      // Bat towers have BatTower component instead of Attack
      if (tt === TowerType.Bat) {
        this.batSwarmSystem.upgradeBatTowerStats(entityId, Tower.level[entityId]!);
      } else {
        const atkDamage = Attack.damage[entityId];
        if (atkDamage !== undefined) {
          Attack.damage[entityId]! += towerCfg.upgradeAtkBonus[costIdx] ?? 0;
          Attack.range[entityId]! += towerCfg.upgradeRangeBonus[costIdx] ?? 0;
        }
        this.weatherSystem.onTowerUpgraded(entityId);
        Sound.play('upgrade');
      }
    };

    // ---- UI system ----
    this.uiSystem = new UISystem(
      this.renderer,
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
      () => this.weatherSystem.weatherName,
    );

    // ---- Health system ----
    this.healthSystem = new HealthSystem(
      () => this.phase,
      (p) => { this.phase = p; },
      (enemyId) => {
        Sound.play('enemy_death');
        this.economy.rewardForEnemy(enemyId);
        Sound.play('gold_earn');
      },
      (unitId) => {
        const popCost = UnitTag.popCost[unitId];
        if (popCost !== undefined) {
          this.economy.releaseUnit(popCost);
        }
        // Death effect for player units
        const posX = Position.x[unitId];
        const posY = Position.y[unitId];
        if (posX !== undefined && posY !== undefined) {
          const effectId = this.world.createEntity();
          this.world.addComponent(effectId, Position, { x: posX, y: posY });
          this.world.addComponent(effectId, Visual, {
            shape: ShapeVal.Circle,
            colorR: 0xf4, colorG: 0x43, colorB: 0x36,
            size: 24,
          });
          this.world.addComponent(effectId, DeathEffect, { duration: 0.3 });
        }
      },
      (batId) => {
        this.batSwarmSystem.onBatDied(batId);
      },
    );

    // ---- Core systems ----
    const renderSystem = new RenderSystem(
      this.renderer, map,
      () => this.uiSystem.selectedTowerEntityId,
      () => this.uiSystem.selectedUnitEntityId,
      () => this.uiSystem.selectedTrapEntityId,
      () => this.uiSystem.selectedProductionEntityId,
      this.screenShakeSystem,
    );

    // ---- Scene decoration ----
    this.decorationSystem = new DecorationSystem(
      this.renderer, map,
      () => this.weatherSystem.currentWeather,
    );
    this.screenFXSystem = new ScreenFXSystem();
    this.screenShakeSystem = new ScreenShakeSystem();
    this.tileDamageSystem = new TileDamageSystem(map);

    const movementSystem = new MovementSystem(map);
    const shamanSystem = new ShamanSystem();
    const commandTowerSystem = new CommandTowerSystem();
    const enemyAttackSystem = new EnemyAttackSystem();
    const attackSystem = new AttackSystem(this.weatherSystem);
    const hotAirBalloonSystem = new HotAirBalloonSystem();
    this.batSwarmSystem = new BatSwarmSystem(this.weatherSystem, this.renderer);
    const unitSystem = new UnitSystem(map);
    const projectileSystem = new ProjectileSystem(map);

    this.skillSystem = new SkillSystem(
      (amount) => this.economy.spendEnergy(amount),
    );

    this.buffSystem = new BuffSystem();

    const productionSystem = new ProductionSystem(this.economy);
    const trapSystem = new TrapSystem(map.tileSize);
    const healingSystem = new HealingSystem();
    const deathEffectSystem = new DeathEffectSystem();
    const explosionEffectSystem = new ExplosionEffectSystem();
    const bloodParticleSystem = new BloodParticleSystem();
    const fadingMarkSystem = new FadingMarkSystem();
    const lightningBoltSystem = new LightningBoltSystem(this.renderer);
    this.laserBeamSystem = new LaserBeamSystem(this.renderer);

    // ---- New unit system ----
    this.aiSystem = new AISystem();
    this.lifecycleSystem = new LifecycleSystem();
    this.unitFactory = new UnitFactory(this.world);

    // Register AI configurations
    this.aiSystem.registerAIConfigs(ALL_AI_CONFIGS);

    // Initialize debug manager
    this.debugManager = new DebugManager(this.world);
    this.debugManager.registerAIConfigs(ALL_AI_CONFIGS);

    // ---- UI overlay (onPostRender) ----
    this.onPostRender = () => {
      lightningBoltSystem.renderBolts(this.world);
      this.laserBeamSystem.renderBeams(this.world);
      this.tileDamageSystem.render(this.renderer, this.world);
      // Weather screen tint (viewport-space — covers entire window)
      if (this.currentScreen === GameScreen.Battle) {
        const tint = this.weatherSystem.screenTint;
        const ctx = this.renderer.context;
        if (ctx && tint !== 'rgba(0,0,0,0)') {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to viewport space
          ctx.fillStyle = tint;
          ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
          ctx.restore();
        }
        // Screen FX overlay (design-space — transform maps to design area)
        this.screenFXSystem.render(ctx, 1 / 60, this.weatherSystem.currentWeather);
      }
      this.uiSystem.renderUI();
    };

    // ---- Input dispatch for battle ----
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
        const posX = Position.x[unitId];
        const posY = Position.y[unitId];
        if (posX !== undefined && posY !== undefined) {
          const ctrlTargetX = PlayerControllable.targetX[unitId];
          const ctrlTargetY = PlayerControllable.targetY[unitId];
          if (ctrlTargetX !== undefined && ctrlTargetY !== undefined) {
            PlayerControllable.targetX[unitId] = posX;
            PlayerControllable.targetY[unitId] = posY;
          }
        }
        return;
      }

      this.handleMapClick(e);
    };

    this.input.onPointerMove = (e: InputEvent) => {
      if (this.unitDragId !== null) {
        const ctrlTargetX = PlayerControllable.targetX[this.unitDragId];
        if (ctrlTargetX !== undefined) {
          PlayerControllable.targetX[this.unitDragId] = e.x;
          PlayerControllable.targetY[this.unitDragId] = e.y;
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
            Sound.play('build_place');
            this.uiSystem.selectedEntityId = result;
            this.uiSystem.selectedEntityType = ds.entityType === 'tower' ? 'tower' :
              ds.entityType === 'trap' ? 'trap' :
              ds.entityType === 'production' ? 'production' : null;
          } else if (result === false) {
            Sound.play('build_deny');
          }
        }
      }
    };

    // ---- Phase transition watcher ----
    this.onUpdate = null;
    this.onAfterUpdate = () => {
      if (this.currentScreen !== GameScreen.Battle) return;

      // Update debug manager
      this.debugManager.update();

      // BGM: switch on phase change
      if (this.phase !== this.previousPhase) {
        this.previousPhase = this.phase;
        if (this.phase === GamePhase.WaveBreak) {
          Music.play('wave_break');
        } else if (this.phase === GamePhase.Deployment) {
          Music.play('battle_default');
        }
      }

      if (this.phase === GamePhase.Victory) {
        this.handleVictory();
      } else if (this.phase === GamePhase.Defeat) {
        if (!this.defeatSfxPlayed) {
          Sound.play('defeat');
          this.defeatSfxPlayed = true;
        }
        this.handleDefeat();
      }
    };

    // ---- Register systems ----
    this.world.registerSystem(this.lifecycleSystem);  // Lifecycle first
    this.world.registerSystem(this.aiSystem);         // AI system
    this.world.registerSystem(movementSystem);
    this.world.registerSystem(shamanSystem);
    this.world.registerSystem(enemyAttackSystem);
    this.world.registerSystem(attackSystem);
    this.world.registerSystem(commandTowerSystem);
    this.world.registerSystem(hotAirBalloonSystem);
    this.world.registerSystem(this.weatherSystem);
    this.world.registerSystem(this.batSwarmSystem);
    this.world.registerSystem(unitSystem);
    this.world.registerSystem(projectileSystem);
    this.world.registerSystem(this.laserBeamSystem);
    this.world.registerSystem(this.skillSystem);
    this.world.registerSystem(this.buffSystem);
    this.world.registerSystem(productionSystem);
    this.world.registerSystem(this.waveSystem);
    this.world.registerSystem(trapSystem);
    this.world.registerSystem(healingSystem);
    this.world.registerSystem(deathEffectSystem);
    this.world.registerSystem(explosionEffectSystem);
    this.world.registerSystem(bloodParticleSystem);
    this.world.registerSystem(fadingMarkSystem);
    this.world.registerSystem(this.tileDamageSystem);  // tile damage marks from missile explosions
    this.world.registerSystem(this.healthSystem);
    this.world.registerSystem(this.economy);
    this.world.registerSystem(this.buildSystem);
    this.world.registerSystem(this.decorationSystem);  // background + decorations — before entity render
    this.world.registerSystem(this.screenShakeSystem);  // screen shake offset — before render
    this.world.registerSystem(renderSystem);
    this.world.registerSystem(lightningBoltSystem); // direct canvas draw — after buffered render
    this.world.registerSystem(this.uiSystem);

    // Start auto-countdown for first wave
    this.waveSystem.startAutoCountdown(5);
  }

  // ================================================================
  // Victory / Defeat
  // ================================================================

  private handleVictory(): void {
    Sound.play('victory');
    Music.play('victory', 0.5);   // BGM: victory fanfare via cross-fade
    this.phase = GamePhase.Victory;
    let baseHpRatio = 0;
    if (this.baseEntityId !== null) {
      const cur = Health.current[this.baseEntityId];
      const max = Health.max[this.baseEntityId];
      if (cur !== undefined && max !== undefined && max > 0) {
        baseHpRatio = cur / max;
      }
    }
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
    Music.play('defeat', 0.5);    // BGM: defeat melody via cross-fade
    this.phase = GamePhase.Defeat;
    this.levelSelectUI.refresh();
    setTimeout(() => this.enterLevelSelect(), 1500);
  }

  // ================================================================
  // Neutral Units (stub)
  // ================================================================

  private spawnNeutralUnits(_map: MapConfig): void {
    // Phase 3 neutral units — stub for now
  }

  // ================================================================
  // Map Click (bitecs query-based)
  // ================================================================

  private findUnitAt(x: number, y: number): number | null {
    // Use bitecs: entities with Position + UnitTag (player units) + Visual + PlayerOwned
    const w = this.world.world;
    for (let eid = 1; eid < Position.x.length; eid++) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      // Check if it's a player unit (UnitTag exists, isEnemy === 0, PlayerOwned, and has Visual)
      if (!hasComponent(w, UnitTag, eid)) continue;
      if (UnitTag.isEnemy[eid] !== 0) continue;
      if (!hasComponent(w, PlayerOwned, eid)) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(x - px) < r && Math.abs(y - py) < r) return eid;
    }
    return null;
  }

  private handleMapClick(e: InputEvent): void {
    const w = this.world.world;

    // Try clicking on an enemy first
    for (let eid = 1; eid < Position.x.length; eid++) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.selectEnemy(eid);
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a tower
    for (let eid = 1; eid < Tower.towerType.length; eid++) {
      if (!hasComponent(w, Tower, eid)) continue;
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'tower';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a trap
    for (let eid = 1; eid < Trap.damagePerSecond.length; eid++) {
      if (!hasComponent(w, Trap, eid)) continue;
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'trap';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a production building
    for (let eid = 1; eid < Production.rate.length; eid++) {
      if (!hasComponent(w, Production, eid)) continue;
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'production';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a placed unit
    for (let eid = 1; eid < Position.x.length; eid++) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      if (UnitTag.isEnemy[eid] !== 0) continue;
      if (!hasComponent(w, PlayerOwned, eid)) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'unit';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Deselect everything
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
    this.uiSystem.enemyEntityId = null;
    this.debugManager.selectEntity(null);
  }

  // ================================================================
  // spawnUnitAt — bitecs version
  // ================================================================

  private spawnUnitAt(px: number, py: number): void {
    const dragUnitType = this.buildSystem.dragState?.unitType;
    if (!dragUnitType) return;

    const config = UNIT_CONFIGS[dragUnitType];
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

    // Check grid occupancy via GridOccupant SoA
    for (let eid = 1; eid < GridOccupant.row.length; eid++) {
      if (GridOccupant.row[eid] === undefined) continue;
      if (GridOccupant.row[eid] === row && GridOccupant.col[eid] === col) return;
    }

    if (!this.economy.canDeployUnit(config.popCost)) return;
    if (!this.economy.spendGold(config.cost)) return;

    this.economy.deployUnit(config.popCost);
    Sound.play('build_place');

    const skillCfg = SKILL_CONFIGS[config.skillId];
    const energyCost = skillCfg ? skillCfg.energyCost : 0;
    const cooldown = skillCfg ? skillCfg.cooldown : 0;

    const x = col * ts + ts / 2 + ox;
    const y = row * ts + ts / 2 + oy;

    const id = this.world.createEntity();

    // Position
    this.world.addComponent(id, Position, { x, y });

    // GridOccupant
    this.world.addComponent(id, GridOccupant, { row, col });

    // Health
    this.world.addComponent(id, Health, {
      current: config.hp,
      max: config.hp,
    });

    // Attack (player units are physical damage by default)
    this.world.addComponent(id, Attack, {
      damageType: DamageTypeVal.Physical,
      damage: config.atk,
      attackSpeed: config.attackSpeed,
      range: config.attackRange,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: TargetSelectionVal.Nearest,
      attackMode: AttackModeVal.SingleTarget,
      isRanged: 0,  // ShieldGuard/Swordsman are melee
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
    });

    // UnitTag (player unit)
    this.world.addComponent(id, UnitTag, {
      isEnemy: 0,
      popCost: config.popCost,
      cost: config.cost,
    });

    // Movement
    this.world.addComponent(id, Movement, {
      speed: config.speed,
      currentSpeed: config.speed,
      targetX: x,
      targetY: y,
      pathIndex: 0,
      progress: 0,
      moveMode: 5, // MoveModeVal.PlayerDirected
      homeX: x,
      homeY: y,
      moveRange: config.moveRange,
    });

    // PlayerControllable
    this.world.addComponent(id, PlayerControllable);

    // Skill
    const skillId = config.skillId === 'taunt' ? 0 : config.skillId === 'whirlwind' ? 1 : 0;
    this.world.addComponent(id, Skill, {
      skillId,
      cooldown,
      currentCooldown: 0,
      energyCost,
    });

    // PlayerOwned (tag)
    this.world.addComponent(id, PlayerOwned);

    // Visual
    const rgb = hexToRgb(config.color);
    this.world.addComponent(id, Visual, {
      shape: ShapeVal.Circle,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: config.size,
      alpha: 1,
      outline: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    // AI component — based on unit type
    const aiConfigId = this.getUnitAIConfig(dragUnitType);
    // Map AI config string to numeric ID (hardcoded for player units)
    const AI_NUM_IDS: Record<string, number> = {
      soldier_tank: 6,
      soldier_dps: 7,
      soldier_basic: 8,
    };
    this.world.addComponent(id, AI, {
      configId: AI_NUM_IDS[aiConfigId] ?? 8,
      targetId: 0,
      lastUpdateTime: 0,
      updateInterval: 0.1,
      active: 1,
    });

    // Category: Soldier
    this.world.addComponent(id, Category, { value: CategoryVal.Soldier });

    // Layer: Ground
    this.world.addComponent(id, Layer, { value: LayerVal.Ground });

    // Faction: Player
    this.world.addComponent(id, Faction, { value: FactionVal.Player });

    // Display name for overhead HUD
    this.world.setDisplayName(id, config.name);
  }

  // ================================================================
  // AI config mapping
  // ================================================================

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

  // ================================================================
  // recycleEntity — bitecs component access
  // ================================================================

  private recycleEntity(entityId: number): void {
    const tw = this.world.world;
    let refund = 0;

    // Check if it's a tower
    const towerTypeNum = Tower.towerType[entityId];
    if (towerTypeNum !== undefined) {
      const tt = TOWER_TYPE_BY_ID[towerTypeNum];
      const towerCfg = tt ? TOWER_CONFIGS[tt] : undefined;
      const invested = Tower.totalInvested[entityId] ?? towerCfg?.cost ?? 0;
      refund = Math.floor(invested * 0.5);
      // If bat tower, destroy all its bats first
      if (BatTower.maxBats[entityId] !== undefined) {
        // Iterate all entities and check BatSwarmMember.parentId
        for (let eid = 1; eid < Position.x.length; eid++) {
          if (BatSwarmMember.parentId[eid] === entityId) {
            this.world.destroyEntity(eid);
          }
        }
      }
    }
    // Check if it's a player unit
    else if (UnitTag.isEnemy[entityId] === 0 && UnitTag.popCost[entityId] !== undefined) {
      refund = Math.floor((UnitTag.cost[entityId] ?? 0) * 0.5);
    }
    // Check if it's a trap
    else if (Trap.damagePerSecond[entityId] !== undefined) {
      refund = Math.floor(40 * 0.5);
    }
    // Check if it's a production building
    else if (Production.rate[entityId] !== undefined) {
      const prodLevel = Production.level[entityId] ?? 1;
      const cfg = PRODUCTION_CONFIGS[
        Production.resourceType[entityId] === 0 ? ProductionType.GoldMine : ProductionType.EnergyTower
      ];
      if (cfg) {
        let invested = cfg.cost;
        for (let i = 0; i < prodLevel - 1; i++) {
          invested += cfg.upgradeCosts[i] ?? 0;
        }
        refund = Math.floor(invested * 0.5);
      }
    }

    this.economy.addGold(refund);

    // Release population for units
    if (UnitTag.isEnemy[entityId] === 0 && UnitTag.popCost[entityId] !== undefined) {
      this.economy.releaseUnit(UnitTag.popCost[entityId]!);
    }

    Sound.play('sell');
    this.world.destroyEntity(entityId);
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
  }
}

// ================================================================
// Entry
// ================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

const game = new TowerDefenderGame(canvas);
game.start();

window.addEventListener('resize', () => game.resize());
(window as unknown as Record<string, unknown>).game = game;
(window as unknown as Record<string, unknown>).Sound = Sound;
