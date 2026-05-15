import type { TowerWorld } from './World.js';

export type SystemPhase =
  | 'managers'
  | 'vfx'
  | 'modifiers'
  | 'gameplay'
  | 'lifecycle'
  | 'creation'
  | 'ai'
  | 'render';

export const PHASE_ORDER = [
  'managers',
  'vfx',
  'modifiers',
  'gameplay',
  'lifecycle',
  'creation',
  'ai',
  'render',
] as const satisfies readonly SystemPhase[];

const VALID_PHASES: ReadonlySet<SystemPhase> = new Set(PHASE_ORDER);

export interface System {
  readonly name: string;
  readonly phase: SystemPhase;
  update(world: TowerWorld, dt: number): void;
}

export class Pipeline {
  private readonly buckets: Map<SystemPhase, System[]> = new Map(
    PHASE_ORDER.map((phase) => [phase, []]),
  );
  private readonly names: Set<string> = new Set();

  register(system: System): void {
    if (!VALID_PHASES.has(system.phase)) {
      throw new Error(`[Pipeline] unknown phase: "${system.phase}" (system "${system.name}")`);
    }
    if (this.names.has(system.name)) {
      throw new Error(`[Pipeline] duplicate system name: "${system.name}"`);
    }
    this.names.add(system.name);
    this.buckets.get(system.phase)!.push(system);
  }

  execute(world: TowerWorld, dt: number): void {
    for (const phase of PHASE_ORDER) {
      const systems = this.buckets.get(phase)!;
      for (const system of systems) {
        system.update(world, dt);
      }
    }
    world.flushDeferred();
  }
}
