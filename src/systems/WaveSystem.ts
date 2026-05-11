import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position,
  Health,
  Movement,
  UnitTag,
  Visual,
  AI,
  Boss,
  Attack,
  Category,
  CategoryVal,
  Layer,
  LayerVal,
  Faction,
  FactionVal,
  MoveModeVal,
  DamageTypeVal,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { GamePhase, EnemyType, type WaveConfig, type MapConfig } from '../types/index.js';
import { generateEndlessWave } from './EndlessWaveGenerator.js';
import { RenderSystem } from './RenderSystem.js';
import { Sound } from '../utils/Sound.js';

// ---- bitecs query for alive enemy check ----

const aliveEnemyQuery = defineQuery([Health, UnitTag]);

// ---- AI config string → numeric index mapping ----

const ENEMY_AI_IDS: Record<string, number> = {
  enemy_basic: 0,
  enemy_ranged: 1,
  enemy_boss: 2,
  enemy_shaman: 3,
  enemy_balloon: 4,
};

// ---- hex color → RGB helper ----

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** Manages wave progression and enemy spawning */
export class WaveSystem implements System {
  readonly name = 'WaveSystem';

  private world: TowerWorld;
  private waves: WaveConfig[];
  private currentWaveIndex: number = 0;
  private spawnQueue: { enemyType: EnemyType; count: number; interval: number }[] = [];
  private spawnTimer: number = 0;
  private spawnIntervalTimer: number = 0;
  private spawnedInWave: number = 0;
  private totalInWave: number = 0;
  private waveActive: boolean = false;
  private isBossWave: boolean = false;
  private isEndless: boolean = false;

  /** Auto-countdown timer — ticks down to 0 then starts next wave */
  countdown: number = 0;
  private countdownDuration: number = 5;

  /** Tracks last integer-second value of countdown for tick sound */
  private lastCountdownInt: number = 0;

  /** Throttle counter for enemy spawn sounds */
  private spawnSoundCounter: number = 0;

  constructor(
    world: TowerWorld,
    private map: MapConfig,
    waves: WaveConfig[],
    private getPhase: () => GamePhase,
    private setPhase: (phase: GamePhase) => void,
    private onWaveComplete?: () => void,
  ) {
    this.world = world;
    this.waves = waves;
  }

  get currentWave(): number {
    return this.currentWaveIndex + 1;
  }

  get totalWaves(): number {
    return this.isEndless ? -1 : this.waves.length;
  }

  get isActive(): boolean {
    return this.waveActive;
  }

  get totalSpawned(): number {
    return this.totalInWave;
  }

  get currentIsBossWave(): boolean {
    return this.isBossWave;
  }

  get isEndlessMode(): boolean {
    return this.isEndless;
  }

  startEndlessMode(): void {
    this.isEndless = true;
    this.waves = [];
    this.currentWaveIndex = 0;
    this.spawnQueue = [];
    this.waveActive = false;
    this.isBossWave = false;
  }

  /** Start auto-countdown before next wave. Call on phase transitions. */
  startAutoCountdown(seconds?: number): void {
    this.countdown = seconds ?? this.countdownDuration;
    this.countdownDuration = seconds ?? 5;
  }

  /** Skip countdown and start the wave immediately */
  skipCountdown(): void {
    this.countdown = 0;
    this.startWave();
  }

  /** Player clicks "start wave" — begin spawning */
  startWave(): void {
    if (this.isEndless) {
      Sound.play('wave_start');
      const wave = generateEndlessWave(this.currentWaveIndex + 1);
      this.isBossWave = wave.isBossWave ?? false;
      if (this.isBossWave) Sound.play('wave_boss');
      this.spawnQueue = wave.enemies.map((g) => ({
        enemyType: g.enemyType,
        count: g.count,
        interval: g.spawnInterval,
      }));
      this.spawnTimer = wave.spawnDelay;
      this.spawnIntervalTimer = 0;
      this.spawnedInWave = 0;
      this.totalInWave = wave.enemies.reduce((sum, g) => sum + g.count, 0);
      this.waveActive = true;
      this.setPhase(GamePhase.Battle);
      return;
    }

    if (this.currentWaveIndex >= this.waves.length) return;

    Sound.play('wave_start');
    const wave = this.waves[this.currentWaveIndex]!;
    this.isBossWave = wave.isBossWave ?? false;
    if (this.isBossWave) Sound.play('wave_boss');
    this.spawnQueue = wave.enemies.map((g) => ({
      enemyType: g.enemyType,
      count: g.count,
      interval: g.spawnInterval,
    }));
    this.spawnTimer = wave.spawnDelay;
    this.spawnIntervalTimer = 0;
    this.spawnedInWave = 0;
    this.totalInWave = wave.enemies.reduce((sum, g) => sum + g.count, 0);
    this.waveActive = true;
    this.setPhase(GamePhase.Battle);
  }

  update(world: TowerWorld, dt: number): void {
    // Store world reference for use in helper methods
    this.world = world;

    // Auto-countdown (ticks regardless of wave state)
    if (this.countdown > 0) {
      this.countdown -= dt;

      // Countdown tick sound at integer boundaries when <= 3s remain
      const currentCeil = Math.ceil(this.countdown);
      if (currentCeil !== this.lastCountdownInt && currentCeil <= 3) {
        Sound.play('countdown_tick');
      }
      this.lastCountdownInt = currentCeil;

      if (this.countdown <= 0) {
        this.countdown = 0;
        this.lastCountdownInt = 0;
        Sound.play('countdown_go');
        this.startWave();
        return;
      }
    }

    if (!this.waveActive) return;

    // Wait for initial spawn delay
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      return;
    }

    // Spawn enemies from queue
    if (this.spawnQueue.length > 0) {
      this.spawnIntervalTimer -= dt;
      if (this.spawnIntervalTimer <= 0) {
        const group = this.spawnQueue[0]!;
        this.spawnEnemy(group.enemyType);
        group.count--;
        this.spawnedInWave++;

        if (group.count <= 0) {
          this.spawnQueue.shift(); // move to next group
        }
        this.spawnIntervalTimer = group.interval;
      }
    }

    // Check if wave is complete (all enemies spawned AND all dead)
    if (
      this.spawnedInWave >= this.totalInWave &&
      this.spawnQueue.length === 0
    ) {
      const hasAliveEnemies = this.hasAliveEnemies();
      if (!hasAliveEnemies) {
        this.waveActive = false;
        Sound.play('wave_clear');
        this.isBossWave = false;
        this.currentWaveIndex++;

        if (this.isEndless) {
          this.onWaveComplete?.();
          this.setPhase(GamePhase.WaveBreak);
          this.startAutoCountdown(3); // 3s between endless waves
        } else if (this.currentWaveIndex >= this.waves.length) {
          this.setPhase(GamePhase.Victory);
        } else {
          this.onWaveComplete?.();
          this.setPhase(GamePhase.WaveBreak);
          this.startAutoCountdown(3); // 3s between waves
        }
      }
    }
  }

  /** Check if any enemy entities are still alive using bitecs query */
  private hasAliveEnemies(): boolean {
    const enemies = aliveEnemyQuery(this.world.world);
    for (const eid of enemies) {
      if (UnitTag.isEnemy[eid] === 1 && Health.current[eid]! > 0) {
        return true;
      }
    }
    return false;
  }

  private spawnEnemy(type: EnemyType): void {
    const config = ENEMY_CONFIGS[type];
    if (!config) return;

    const spawn = this.map.enemyPath[0]!;
    const ts = this.map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const x = spawn.col * ts + ts / 2 + ox;
    const y = spawn.row * ts + ts / 2 + oy;

    const eid = this.world.createEntity();
    const rgb = hexToRGB(config.color);

    this.world.addComponent(eid, Position, { x, y });
    this.world.addComponent(eid, Health, {
      current: config.hp,
      max: config.hp,
      armor: config.defense,
      magicResist: config.magicResist,
    });
    this.world.addComponent(eid, Movement, {
      speed: config.speed,
      moveMode: MoveModeVal.FollowPath,
    });
    this.world.addComponent(eid, UnitTag, {
      isEnemy: 1,
      rewardGold: config.rewardGold,
      canAttackBuildings: config.canAttackBuildings ? 1 : 0,
    });
    this.world.addComponent(eid, Visual, {
      shape: 1, // ShapeVal.Circle
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: config.radius * 2,
      alpha: 1,
    });
    this.world.addComponent(eid, Category, {
      value: CategoryVal.Enemy,
    });

    // HotAirBalloon uses LowAir layer (flies over ground)
    if (type === EnemyType.HotAirBalloon) {
      this.world.addComponent(eid, Layer, {
        value: LayerVal.LowAir,
      });
      // Add Attack component for bomb dropping
      this.world.addComponent(eid, Attack, {
        damage: config.bombDamage ?? config.atk,
        attackSpeed: 1 / (config.bombInterval ?? 3.5),
        range: 32, // checks directly below
        damageType: DamageTypeVal.Physical,
        isRanged: 1,
      });
    } else {
      this.world.addComponent(eid, Layer, {
        value: LayerVal.Ground,
      });
    }
    this.world.addComponent(eid, Faction, {
      value: FactionVal.Enemy,
    });

    // Ranged attackers get an Attack component (replaces old EnemyAttacker)
    if (config.attackRange > 0) {
      this.world.addComponent(eid, Attack, {
        damage: config.atk,
        attackSpeed: config.attackSpeed,
        range: config.attackRange,
        damageType: DamageTypeVal.Physical,
        isRanged: 0,  // default enemies are melee (ranged enemies TBD via config)
      });
    }

    // Boss component
    if (config.isBoss) {
      this.world.addComponent(eid, Boss, {
        phase: 1,
        phase2HpRatio: config.bossPhase2HpRatio ?? 0.5,
      });
    }

    // AI component
    const aiConfigId = this.getEnemyAIConfig(type);
    this.world.addComponent(eid, AI, {
      configId: ENEMY_AI_IDS[aiConfigId] ?? 0,
      active: 1,
      updateInterval: 0.1,
    });

    // Display name for overhead HUD
    this.world.setDisplayName(eid, config.name);

    // Throttled spawn sound — roughly 1 in 3 spawns
    this.spawnSoundCounter++;
    if (this.spawnSoundCounter % 3 === 0) {
      Sound.play('enemy_spawn');
    }
  }

  private getEnemyAIConfig(enemyType: EnemyType): string {
    switch (enemyType) {
      case EnemyType.Grunt:
      case EnemyType.Runner:
      case EnemyType.Heavy:
      case EnemyType.Exploder:
        return 'enemy_basic';
      case EnemyType.Mage:
        return 'enemy_ranged';
      case EnemyType.BossCommander:
      case EnemyType.BossBeast:
        return 'enemy_boss';
      case EnemyType.Shaman:
        return 'enemy_shaman';
      case EnemyType.HotAirBalloon:
        return 'enemy_balloon';
      case EnemyType.Juggernaut:
        return 'enemy_basic';
      default:
        return 'enemy_basic';
    }
  }
}
