import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { CType } from '../types/index.js';
import { Position, GridOccupant } from '../components/Position.js';
import { Render } from '../components/Render.js';
import { Health } from '../components/Health.js';
import type { MapConfig } from '../types/index.js';
import { TileType } from '../types/index.js';

export class RenderSystem implements System {
  readonly name = 'RenderSystem';
  readonly requiredComponents = [CType.Render] as const;

  constructor(
    private world: World,
    private renderer: Renderer,
    private map: MapConfig,
  ) {}

  update(entities: number[], _dt: number): void {
    this.drawMap(this.map);
    this.drawEntities(entities);
  }

  private drawMap(map: MapConfig): void {
    const ts = map.tileSize;

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const x = c * ts + ts / 2;
        const y = r * ts + ts / 2;
        let color: string;

        switch (tile) {
          case TileType.Empty:
            color = '#3a7d44'; // medium green
            break;
          case TileType.Path:
            color = '#a1887f'; // lighter brown
            break;
          case TileType.Blocked:
            color = '#546e7a'; // blue-gray
            break;
          case TileType.Spawn:
            color = '#ff8f00'; // amber
            break;
          case TileType.Base:
            color = '#1e88e5'; // blue
            break;
        }

        this.renderer.push({
          shape: 'rect',
          x,
          y,
          size: ts - 2,
          color,
          alpha: 1,
        });
      }
    }
  }

  private drawEntities(entities: number[]): void {
    // Sort by Y for simple depth ordering
    const sorted = entities
      .map((id) => ({
        id,
        pos: this.world.getComponent<Position>(id, CType.Position)!,
        render: this.world.getComponent<Render>(id, CType.Render)!,
      }))
      .filter((e) => e.pos && e.render)
      .sort((a, b) => a.pos.y - b.pos.y);

    for (const { id, pos, render: r } of sorted) {
      // Draw health bar above entity
      const health = this.world.getComponent<Health>(id, CType.Health);
      if (health && health.ratio < 1) {
        this.drawHealthBar(pos.x, pos.y - r.size / 2 - 6, r.size, health.ratio);
      }

      this.renderer.push({
        shape: r.shape,
        x: pos.x,
        y: pos.y,
        size: r.size,
        color: r.color,
        alpha: r.alpha,
        stroke: r.outline ? '#ffffff' : undefined,
        strokeWidth: r.outline ? 1 : undefined,
      });
    }
  }

  private drawHealthBar(x: number, y: number, width: number, ratio: number): void {
    const h = 4;
    const barW = width;

    // Background
    this.renderer.push({ shape: 'rect', x, y: y + h / 2, size: barW, color: '#333333', alpha: 0.8 });

    // Fill
    const fillColor = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336';
    const fillW = barW * ratio;
    this.renderer.push({
      shape: 'rect',
      x: x - barW / 2 + fillW / 2,
      y: y + h / 2,
      size: fillW,
      color: fillColor,
      alpha: 0.9,
    });
  }
}
