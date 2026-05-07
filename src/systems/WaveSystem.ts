import { System, GamePhase, EnemyType, CType, type WaveConfig } from '../types/index.js';
import { World } from '../core/World.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Movement } from '../components/Movement.js';
import { Enemy } from '../components/Enemy.js';
import { Render } from '../components/Render.js';
import { Boss } from '../components/Boss.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import type { MapConfig } from '../types/index.js';
import { generateEndlessWave } from './EndlessWaveGenerator.js';

/** Manages wave progression and enemy spawning */
export class WaveSystem implements System {
  readonly name = 'WaveSystem';
  readonly requiredComponents = [] as const; // No entities needed — this is a manager system

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

  constructor(
    private world: World,
    private map: MapConfig,
    waves: WaveConfig[],
    private getPhase: () => GamePhase,
    private setPhase: (phase: GamePhase) => void,
  ) {
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
      const wave = generateEndlessWave(this.currentWaveIndex + 1);
      this.isBossWave = wave.isBossWave ?? false;
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

    const wave = this.waves[this.currentWaveIndex]!;
    this.isBossWave = wave.isBossWave ?? false;
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

  update(_entities: number[], dt: number): void {
    // Auto-countdown (ticks regardless of wave state)
    if (this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
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
      const aliveEnemies = this.world.query(CType.Enemy, CType.Health);
      if (aliveEnemies.length === 0) {
        this.waveActive = false;
        this.isBossWave = false;
        this.currentWaveIndex++;

        if (this.isEndless) {
          this.setPhase(GamePhase.WaveBreak);
          this.startAutoCountdown(3); // 3s between endless waves
        } else if (this.currentWaveIndex >= this.waves.length) {
          this.setPhase(GamePhase.Victory);
        } else {
          this.setPhase(GamePhase.WaveBreak);
          this.startAutoCountdown(3); // 3s between waves
        }
      }
    }
  }

  private spawnEnemy(type: EnemyType): void {
    const config = ENEMY_CONFIGS[type];
    if (!config) return;

    const spawn = this.map.enemyPath[0]!;
    const ts = this.map.tileSize;
    const x = spawn.col * ts + ts / 2;
    const y = spawn.row * ts + ts / 2;

    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(x, y));
    this.world.addComponent(id, new Health(config.hp));
    this.world.addComponent(id, new Movement(config.speed));
    this.world.addComponent(id, new Enemy(config.type, config.defense, config.atk, config.speed));

    const render = new Render('circle', config.color, config.radius * 2);
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 12;
    this.world.addComponent(id, render);

    if (config.isBoss) {
      this.world.addComponent(id, new Boss([], config.bossPhase2HpRatio ?? 0.5));
    }
  }
}
