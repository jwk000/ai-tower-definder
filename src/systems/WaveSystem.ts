import { defineQuery } from 'bitecs';

import { Faction, FactionTeam, Health } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';
import { spawnUnit, type SpawnPosition, type UnitConfig } from '../factories/UnitFactory.js';

export interface WaveGroupConfig {
  readonly enemyId: string;
  readonly count: number;
  readonly spawnId?: string;
  readonly intervalMs: number;
}

export interface WaveConfig {
  readonly waveNumber: number;
  readonly spawnDelayMs: number;
  readonly groups: readonly WaveGroupConfig[];
  readonly isBossWave?: boolean;
}

export interface SpawnConfig {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export type WavePhase = 'deployment' | 'battle' | 'wave-break' | 'completed';

export interface WaveSystemConfig {
  readonly waves: readonly WaveConfig[];
  readonly spawns: readonly SpawnConfig[];
  readonly unitConfigs: ReadonlyMap<string, UnitConfig>;
  readonly waveBreakMs?: number;
  readonly onWaveComplete?: (waveIndex: number) => void;
  readonly onAllWavesComplete?: () => void;
  readonly spawn?: (world: TowerWorld, config: UnitConfig, at: SpawnPosition) => number;
}

export interface WaveSystem extends System {
  readonly currentWaveIndex: number;
  readonly currentPhase: WavePhase;
  aliveEnemyCount(world: TowerWorld): number;
  start(): void;
}

const DEFAULT_WAVE_BREAK_MS = 1000;

interface WaveRuntimeState {
  timer: number;
  groupIndex: number;
  spawnedInGroup: number;
  totalSpawnedInWave: number;
}

function freshRuntime(): WaveRuntimeState {
  return { timer: 0, groupIndex: 0, spawnedInGroup: 0, totalSpawnedInWave: 0 };
}

function resolveSpawnPosition(
  spawns: readonly SpawnConfig[],
  spawnId: string | undefined,
): SpawnPosition {
  if (spawns.length === 0) {
    throw new Error('[WaveSystem] no spawns configured');
  }
  if (!spawnId) {
    return { x: spawns[0]!.x, y: spawns[0]!.y };
  }
  const found = spawns.find((s) => s.id === spawnId);
  if (!found) {
    throw new Error(`[WaveSystem] unknown spawnId "${spawnId}"`);
  }
  return { x: found.x, y: found.y };
}

export function createWaveSystem(cfg: WaveSystemConfig): WaveSystem {
  const waves = cfg.waves;
  const spawns = cfg.spawns;
  const unitConfigs = cfg.unitConfigs;
  const spawnFn = cfg.spawn ?? spawnUnit;
  const breakMs = cfg.waveBreakMs ?? DEFAULT_WAVE_BREAK_MS;

  const enemyQuery = defineQuery([Faction, Health]);

  let waveIndex = 0;
  let phase: WavePhase = 'deployment';
  let started = false;
  let runtime = freshRuntime();
  let totalRequiredInWave = 0;
  let anySpawnedThisWave = false;

  function totalUnitsInWave(wave: WaveConfig): number {
    return wave.groups.reduce((sum, g) => sum + g.count, 0);
  }

  function aliveEnemyCount(world: TowerWorld): number {
    const ents = enemyQuery(world);
    let n = 0;
    for (let i = 0; i < ents.length; i += 1) {
      const eid = ents[i]!;
      if (Faction.team[eid] === FactionTeam.Enemy && Health.current[eid]! > 0) {
        n += 1;
      }
    }
    return n;
  }

  function performSpawn(world: TowerWorld, group: WaveGroupConfig): void {
    const unitConfig = unitConfigs.get(group.enemyId);
    if (!unitConfig) {
      throw new Error(`[WaveSystem] unknown enemyId "${group.enemyId}"`);
    }
    const pos = resolveSpawnPosition(spawns, group.spawnId);
    spawnFn(world, unitConfig, pos);
  }

  function advanceToNextWave(): void {
    if (waveIndex + 1 >= waves.length) {
      phase = 'completed';
      cfg.onAllWavesComplete?.();
      return;
    }
    waveIndex += 1;
    phase = 'deployment';
    runtime = freshRuntime();
    totalRequiredInWave = totalUnitsInWave(waves[waveIndex]!);
    anySpawnedThisWave = false;
  }

  return {
    name: 'WaveSystem',
    phase: 'gameplay',

    get currentWaveIndex(): number {
      return waveIndex;
    },
    get currentPhase(): WavePhase {
      return phase;
    },

    aliveEnemyCount,

    start(): void {
      if (started) return;
      started = true;
      waveIndex = 0;
      phase = 'deployment';
      runtime = freshRuntime();
      totalRequiredInWave = waves.length > 0 ? totalUnitsInWave(waves[0]!) : 0;
      anySpawnedThisWave = false;
    },

    update(world: TowerWorld, dt: number): void {
      if (!started) return;
      if (phase === 'completed') return;
      if (waves.length === 0) {
        phase = 'completed';
        cfg.onAllWavesComplete?.();
        return;
      }

      const dtMs = dt * 1000;
      const wave = waves[waveIndex]!;

      if (phase === 'deployment') {
        runtime.timer += dtMs;
        if (runtime.timer >= wave.spawnDelayMs) {
          runtime.timer = 0;
          phase = 'battle';
        } else {
          return;
        }
      }

      if (phase === 'battle') {
        while (runtime.groupIndex < wave.groups.length) {
          const group = wave.groups[runtime.groupIndex]!;

          if (runtime.spawnedInGroup === 0) {
            performSpawn(world, group);
            runtime.spawnedInGroup += 1;
            runtime.totalSpawnedInWave += 1;
            anySpawnedThisWave = true;
            if (runtime.spawnedInGroup >= group.count) {
              runtime.groupIndex += 1;
              runtime.spawnedInGroup = 0;
              runtime.timer = 0;
              continue;
            }
            return;
          }

          runtime.timer += dtMs;
          if (runtime.timer < group.intervalMs) {
            return;
          }
          runtime.timer -= group.intervalMs;
          performSpawn(world, group);
          runtime.spawnedInGroup += 1;
          runtime.totalSpawnedInWave += 1;
          anySpawnedThisWave = true;

          if (runtime.spawnedInGroup >= group.count) {
            runtime.groupIndex += 1;
            runtime.spawnedInGroup = 0;
            runtime.timer = 0;
          }
        }

        if (
          anySpawnedThisWave &&
          runtime.totalSpawnedInWave >= totalRequiredInWave &&
          aliveEnemyCount(world) === 0
        ) {
          cfg.onWaveComplete?.(waveIndex);
          phase = 'wave-break';
          runtime.timer = 0;
        }
        return;
      }

      if (phase === 'wave-break') {
        runtime.timer += dtMs;
        if (runtime.timer >= breakMs) {
          advanceToNextWave();
        }
      }
    },
  };
}
