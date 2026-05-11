// ============================================================
// Tower Defender — ScreenShakeSystem
//
// Processes ScreenShake component to apply screen-space offset
// to the canvas transform. Consumed by RenderSystem before
// rendering each frame.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { ScreenShake } from '../core/components.js';

// ============================================================
// Query
// ============================================================

const shakeQuery = defineQuery([ScreenShake]);

// ============================================================
// Public interface for RenderSystem
// ============================================================

export interface ScreenShakeState {
  offsetX: number;
  offsetY: number;
}

// ============================================================
// ScreenShakeSystem
// ============================================================

export class ScreenShakeSystem implements System {
  readonly name = 'ScreenShakeSystem';

  /** Current frame shake offset — read by RenderSystem */
  state: ScreenShakeState = { offsetX: 0, offsetY: 0 };

  update(world: TowerWorld, dt: number): void {
    const entities = shakeQuery(world.world);

    // Only one shake entity should exist at a time; take the first
    if (entities.length === 0) {
      this.state = { offsetX: 0, offsetY: 0 };
      return;
    }

    const eid = entities[0]!;
    const elapsed = ScreenShake.elapsed[eid]!;
    const duration = ScreenShake.duration[eid]!;
    const intensity = ScreenShake.intensity[eid]!;
    const frequency = ScreenShake.frequency[eid]!;

    // Advance elapsed
    ScreenShake.elapsed[eid] = elapsed + dt;

    if (ScreenShake.elapsed[eid]! >= duration) {
      world.destroyEntity(eid);
      this.state = { offsetX: 0, offsetY: 0 };
      return;
    }

    const t = ScreenShake.elapsed[eid]!;
    // Ease-out decay: amplitude decreases exponentially
    const decay = Math.exp(-5.0 * t / duration);
    const rawAmplitude = intensity * decay;

    // Sine wave oscillation
    const phase = 2.0 * Math.PI * frequency * t;
    const rawOffset = rawAmplitude * Math.sin(phase);

    // Randomize direction each frame (±30° from vertical)
    const angle = (Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
    this.state = {
      offsetX: rawOffset * Math.cos(angle),
      offsetY: rawOffset * Math.sin(angle),
    };
  }

  /** Spawn a screen shake effect (call from other systems) */
  static triggerShake(world: TowerWorld, intensity: number, duration: number, frequency: number): void {
    // Remove existing shake entities first
    for (const eid of shakeQuery(world.world)) {
      world.destroyEntity(eid);
    }

    const eid = world.createEntity();
    world.addComponent(eid, ScreenShake, {
      intensity,
      duration,
      elapsed: 0,
      frequency,
    });
  }
}
