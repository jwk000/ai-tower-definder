import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { CType, TileType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Render } from '../components/Render.js';
import { Health } from '../components/Health.js';
import { Projectile } from '../components/Projectile.js';
import { BuffContainer } from '../components/Buff.js';
import { Boss } from '../components/Boss.js';
import { Enemy } from '../components/Enemy.js';
import { isAdjacentToPath } from './BuildSystem.js';
import type { MapConfig, SceneLayout } from '../types/index.js';

export function computeSceneLayout(map: MapConfig, canvasW: number, canvasH: number): SceneLayout {
  const mapPixelW = map.cols * map.tileSize;
  const mapPixelH = map.rows * map.tileSize;
  const offsetX = (canvasW - mapPixelW) / 2;
  const offsetY = 50;
  return { offsetX, offsetY, cols: map.cols, rows: map.rows, tileSize: map.tileSize, mapPixelW, mapPixelH };
}

export class RenderSystem implements System {
  readonly name = 'RenderSystem';
  readonly requiredComponents = [CType.Render] as const;

  static sceneOffsetX = 0;
  static sceneOffsetY = 0;
  static sceneW = 0;
  static sceneH = 0;

  constructor(
    private world: World,
    private renderer: Renderer,
    private map: MapConfig,
    private getSelectedTowerEntityId: () => number | null = () => null,
  ) {
    const layout = computeSceneLayout(map, 1920, 1080);
    RenderSystem.sceneOffsetX = layout.offsetX;
    RenderSystem.sceneOffsetY = layout.offsetY;
    RenderSystem.sceneW = layout.mapPixelW;
    RenderSystem.sceneH = layout.mapPixelH;
  }

  update(entities: number[], _dt: number): void {
    this.drawMap(this.map);
    this.drawEntities(entities);
  }

  private drawMap(map: MapConfig): void {
    const ts = map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = map.cols * ts;
    const mapH = map.rows * ts;

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const x = c * ts + ts / 2 + ox;
        const y = r * ts + ts / 2 + oy;
        let color: string;

        switch (tile) {
          case TileType.Empty: {
            const adjacent = isAdjacentToPath(r, c, map);
            color = adjacent ? '#5a9e5f' : '#3a7d44';
            break;
          }
          case TileType.Path:   color = '#a1887f'; break;
          case TileType.Blocked: color = '#546e7a'; break;
          case TileType.Spawn:  color = '#ff8f00'; break;
          case TileType.Base:   color = '#1e88e5'; break;
        }

        this.renderer.push({ shape: 'rect', x, y, size: ts - 2, color, alpha: 1 });

        if (tile === TileType.Empty && isAdjacentToPath(r, c, map)) {
          this.renderer.push({
            shape: 'rect', x, y, size: ts - 2,
            color: '#4caf50',
            alpha: 0.3,
            stroke: '#81c784',
            strokeWidth: 1,
          });
        }
      }
    }

    this.renderer.push({
      shape: 'rect',
      x: ox + mapW / 2,
      y: oy + mapH / 2,
      size: mapW + 4,
      h: mapH + 4,
      color: '#000000',
      alpha: 1,
      stroke: '#000000',
      strokeWidth: 2,
    });
  }

  private drawEntities(entities: number[]): void {
    const sorted = entities
      .map((id) => ({
        id,
        pos: this.world.getComponent<Position>(id, CType.Position)!,
        render: this.world.getComponent<Render>(id, CType.Render)!,
      }))
      .filter((e) => e.pos && e.render)
      .sort((a, b) => a.pos.y - b.pos.y);

    const selectedId = this.getSelectedTowerEntityId();

    for (const { id, pos, render: r } of sorted) {
      const isProjectile = this.world.hasComponent(id, CType.Projectile);
      const isEnemy = this.world.hasComponent(id, CType.Enemy);
      const isTower = this.world.hasComponent(id, CType.Tower);

      const flashActive = r.hitFlashTimer > 0;
      let displayColor = r.color;
      let displayAlpha = r.alpha;
      if (flashActive) {
        displayColor = '#ffffff';
        displayAlpha = 1;
        r.hitFlashTimer = 0;
      }

      const buffContainer = this.world.getComponent<BuffContainer>(id, CType.Buff);
      if (buffContainer && !flashActive) {
        if (buffContainer.buffs.has('ice_frozen')) {
          displayColor = '#00bcd4';
          displayAlpha = 1;
        } else if (buffContainer.buffs.has('ice_slow')) {
          const slowBuff = buffContainer.buffs.get('ice_slow')!;
          const t = Math.min(slowBuff.currentStacks / 5, 1);
          displayColor = this.lerpColor(r.color, '#4488cc', t * 0.7);
        }
      }

      if (isEnemy && !flashActive) {
        const enemy = this.world.getComponent<Enemy>(id, CType.Enemy);
        if (enemy && enemy.stunTimer > 0) {
          displayColor = '#ffd700';
          displayAlpha = 0.9;
        }
      }

      const boss = this.world.getComponent<Boss>(id, CType.Boss);
      const isBossEntity = boss !== undefined;
      let drawSize = r.size;
      if (isBossEntity) {
        drawSize = r.size * 1.3;
        if (boss.phase === 2 && !flashActive) {
          if (boss.phaseTransitionTimer > 0) {
            const cycle = Math.floor(boss.phaseTransitionTimer / 0.1) % 2;
            displayColor = cycle === 0 ? '#ffffff' : '#d32f2f';
            displayAlpha = 1;
          } else {
            displayColor = this.lerpColor(r.color, '#d32f2f', 0.35);
          }
        }
      }

      const isSelected = selectedId !== null && id === selectedId;
      const strokeColor = isSelected ? '#ffffff' : r.outline ? '#ffffff' : undefined;
      const strokeW = isSelected ? 3 : r.outline ? 2 : undefined;

      const pushCmd = (extras: Partial<Parameters<typeof this.renderer.push>[0]> = {}) => {
        let shape = r.shape;
        let targetX: number | undefined;
        let targetY: number | undefined;

        if (isProjectile) {
          shape = 'arrow';
          const proj = this.world.getComponent<Projectile>(id, CType.Projectile);
          if (proj) {
            const tp = this.world.getComponent<Position>(proj.targetId, CType.Position);
            if (tp) { targetX = tp.x; targetY = tp.y; }
          }
        }

        this.renderer.push({
          shape,
          x: pos.x, y: pos.y,
          size: drawSize,
          color: displayColor,
          alpha: displayAlpha,
          stroke: strokeColor,
          strokeWidth: strokeW,
          label: r.label ?? undefined,
          labelColor: r.labelColor,
          labelSize: r.labelSize,
          targetX,
          targetY,
          ...extras,
        });

        if (isBossEntity) {
          const crownSize = r.size * 0.4;
          this.renderer.push({
            shape: 'triangle',
            x: pos.x,
            y: pos.y - drawSize / 2 - crownSize / 2 - 2,
            size: crownSize,
            color: '#ffd700',
            alpha: 0.95,
          });
        }
      };

      const health = this.world.getComponent<Health>(id, CType.Health);
      if (health && !isProjectile && health.ratio < 1) {
        this.drawHealthBar(pos.x, pos.y - r.size / 2 - 14, r.size * 0.9, health.ratio, isEnemy, isTower);
      }

      pushCmd();
    }
  }

  private drawHealthBar(
    x: number, y: number, width: number, ratio: number,
    _isEnemy: boolean, _isTower: boolean,
  ): void {
    const barH = 4;
    const barW = width;
    const halfW = barW / 2;

    this.renderer.push({
      shape: 'rect', x, y: y, size: barW, h: barH,
      color: '#222222', alpha: 0.8,
    });

    let fillColor: string;
    if (ratio > 0.6) {
      fillColor = '#4caf50';
    } else if (ratio > 0.3) {
      fillColor = '#ffc107';
    } else {
      fillColor = '#f44336';
    }

    const fillW = Math.max(barW * ratio, 0);
      if (fillW > 0) {
      this.renderer.push({
        shape: 'rect',
        x: x - halfW + fillW / 2,
        y: y,
        size: fillW,
        h: barH,
        color: fillColor,
        alpha: 0.95,
      });
    }
  }

  private lerpColor(c1: string, c2: string, t: number): string {
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
}
