// ============================================================
// Tower Defender — TileDamageSystem
//
// Manages TileDamageMark entities that show cracked/damaged tile
// visuals after missile explosions. Each mark tracks a specific
// grid cell, showing irregular crack lines that fade over time.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { TileDamageMark, Position } from '../core/components.js';
import { Renderer } from '../render/Renderer.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';

// ============================================================
// Query
// ============================================================

const damageQuery = defineQuery([TileDamageMark, Position]);

// ============================================================
// Constants
// ============================================================

const TILE_SIZE = 64;

// ============================================================
// TileDamageSystem
// ============================================================

export class TileDamageSystem implements System {
  readonly name = 'TileDamageSystem';

  private map: MapConfig;

  constructor(map: MapConfig) {
    this.map = map;
  }

  update(world: TowerWorld, dt: number): void {
    const entities = damageQuery(world.world);

    for (const eid of entities) {
      TileDamageMark.elapsed[eid]! += dt;

      if (TileDamageMark.elapsed[eid]! >= TileDamageMark.duration[eid]!) {
        world.destroyEntity(eid);
      }
    }
  }

  /** Render all tile damage marks */
  render(renderer: Renderer, world: TowerWorld): void {
    const entities = damageQuery(world.world);
    if (entities.length === 0) return;

    const ctx = renderer.context;
    if (!ctx) return;

    const offsetX = RenderSystem.sceneOffsetX;
    const offsetY = RenderSystem.sceneOffsetY;

    ctx.save();

    for (const eid of entities) {
      const row = TileDamageMark.row[eid]!;
      const col = TileDamageMark.col[eid]!;
      const elapsed = TileDamageMark.elapsed[eid]!;
      const duration = TileDamageMark.duration[eid]!;
      const maxAlpha = TileDamageMark.maxAlpha[eid]!;
      const seed = TileDamageMark.crackSeed[eid]!;

      const cx = offsetX + col * TILE_SIZE;
      const cy = offsetY + row * TILE_SIZE;

      // Calculate alpha: full alpha during most of duration, fade out in last 1s
      const fadeStart = duration - 1.0;
      let alpha: number;
      if (elapsed >= fadeStart) {
        alpha = maxAlpha * (1.0 - (elapsed - fadeStart) / 1.0);
      } else {
        alpha = maxAlpha;
      }
      if (alpha <= 0) continue;

      // Dark overlay on tile
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.4})`;
      ctx.fillRect(cx, cy, TILE_SIZE, TILE_SIZE);

      // Crack lines using seed-based pseudo-random generation
      const rng = seededRandom(seed);
      const crackCount = 3 + (seed % 3); // 3-5 cracks
      const centerX = cx + TILE_SIZE / 2;
      const centerY = cy + TILE_SIZE / 2;

      ctx.strokeStyle = `rgba(62, 39, 35, ${alpha})`; // #3e2723
      ctx.lineWidth = 1.5;

      for (let i = 0; i < crackCount; i++) {
        ctx.beginPath();
        const angle = (i / crackCount) * Math.PI * 2 + rng() * 0.8;
        const len1 = 8 + rng() * 20;
        const len2 = 10 + rng() * 18;

        // Start from center
        const startX = centerX + rng() * 12 - 6;
        const startY = centerY + rng() * 12 - 6;

        const midX = startX + Math.cos(angle) * len1;
        const midY = startY + Math.sin(angle) * len1;
        const endX = midX + Math.cos(angle + rng() * 1.2 - 0.6) * len2;
        const endY = midY + Math.sin(angle + rng() * 1.2 - 0.6) * len2;

        ctx.moveTo(startX, startY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /** Spawn tile damage marks for all tiles within blast radius */
  static spawnTileDamage(
    world: TowerWorld,
    hitX: number,
    hitY: number,
    blastRadius: number,
    map: MapConfig,
  ): void {
    const layout = {
      offsetX: 0,
      offsetY: 0,
      cols: map.cols,
      rows: map.rows,
      tileSize: TILE_SIZE,
    };

    // Calculate scene offset from map config
    // We need to compute this; for now use the standard offset
    const SCENE_OFFSET_X = 288;
    const SCENE_OFFSET_Y = 216;

    // Collect all tile damage marks to deduplicate
    const damagedTiles = new Set<string>();

    // Check all tiles within blast radius
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const tileCenterX = SCENE_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
        const tileCenterY = SCENE_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;

        const dx = tileCenterX - hitX;
        const dy = tileCenterY - hitY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= blastRadius) {
          damagedTiles.add(`${row},${col}`);
        }
      }
    }

    // Remove any existing damage marks on the same tiles (refresh duration)
    const existingEntities = damageQuery(world.world);
    for (const eid of existingEntities) {
      const er = TileDamageMark.row[eid]!;
      const ec = TileDamageMark.col[eid]!;
      if (damagedTiles.has(`${er},${ec}`)) {
        TileDamageMark.elapsed[eid] = 0; // reset timer
        damagedTiles.delete(`${er},${ec}`);
      }
    }

    // Create new damage marks for remaining tiles
    for (const key of damagedTiles) {
      const [rowStr, colStr] = key.split(',');
      const row = parseInt(rowStr!, 10);
      const col = parseInt(colStr!, 10);

      const eid = world.createEntity();
      const tileCenterX = SCENE_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
      const tileCenterY = SCENE_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;

      world.addComponent(eid, Position, { x: tileCenterX, y: tileCenterY });
      world.addComponent(eid, TileDamageMark, {
        row,
        col,
        duration: 3.0,
        elapsed: 0,
        crackSeed: Math.floor(Math.random() * 256),
        maxAlpha: 0.4 + Math.random() * 0.3, // 0.4-0.7 random variation
      });
    }
  }
}

// ============================================================
// Seeded PRNG (simple linear congruential generator)
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
