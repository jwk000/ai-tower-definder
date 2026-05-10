// ============================================================
// Tower Defender — RenderSystem (bitecs migration)
//
// Canvas 2D map + entity rendering.
// Data access migrated from class-based components to bitecs SoA stores.
// All Canvas 2D drawing logic preserved as-is.
// ============================================================

import { TowerWorld, System, defineQuery, hasComponent } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { TileType, ObstacleType } from '../types/index.js';
import type { MapConfig, SceneLayout, ShapeType } from '../types/index.js';
import {
  Position,
  Visual,
  Health,
  UnitTag,
  Tower,
  Attack,
  Projectile,
  BuffContainer,
  Boss,
  Category,
  CategoryVal,
  Movement,
  Trap,
  GridOccupant,
  ShapeVal,
  Slowed,
  Frozen,
  Stunned,
} from '../core/components.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { UNIT_CONFIGS } from '../data/gameData.js';

// ---- Query: all entities with position + visual ----
const renderableQuery = defineQuery([Position, Visual]);

// ---- ShapeVal numeric -> string mapping ----
function shapeValToString(v: number): ShapeType {
  switch (v) {
    case ShapeVal.Rect:     return 'rect';
    case ShapeVal.Circle:   return 'circle';
    case ShapeVal.Triangle: return 'triangle';
    case ShapeVal.Diamond:  return 'diamond';
    case ShapeVal.Hexagon:  return 'hexagon';
    case ShapeVal.Arrow:    return 'arrow';
    default:                return 'rect';
  }
}

export function computeSceneLayout(map: MapConfig, canvasW: number, canvasH: number): SceneLayout {
  const mapPixelW = map.cols * map.tileSize;
  const mapPixelH = map.rows * map.tileSize;
  const offsetX = (canvasW - mapPixelW) / 2;
  const offsetY = 50;
  return { offsetX, offsetY, cols: map.cols, rows: map.rows, tileSize: map.tileSize, mapPixelW, mapPixelH };
}

export class RenderSystem implements System {
  readonly name = 'RenderSystem';

  static sceneOffsetX = 0;
  static sceneOffsetY = 0;
  static sceneW = 0;
  static sceneH = 0;

  constructor(
    private renderer: Renderer,
    private map: MapConfig,
    private getSelectedTowerId: () => number | null = () => null,
    private getSelectedUnitId: () => number | null = () => null,
    private getSelectedTrapId: () => number | null = () => null,
  ) {
    const layout = computeSceneLayout(map, 1920, 1080);
    RenderSystem.sceneOffsetX = layout.offsetX;
    RenderSystem.sceneOffsetY = layout.offsetY;
    RenderSystem.sceneW = layout.mapPixelW;
    RenderSystem.sceneH = layout.mapPixelH;
  }

  update(world: TowerWorld, _dt: number): void {
    this.drawMap(this.map);
    this.drawEntities(world);
  }

  private static readonly OBSTACLE_VISUALS: Record<ObstacleType, { shape: 'circle' | 'triangle' | 'diamond'; color: string; size: number; alpha?: number }> = {
    [ObstacleType.Tree]:          { shape: 'triangle', color: '#2e7d32', size: 14 },
    [ObstacleType.Bush]:          { shape: 'circle',   color: '#388e3c', size: 8 },
    [ObstacleType.Flower]:        { shape: 'circle',   color: '#e91e63', size: 5 },
    [ObstacleType.Rock]:          { shape: 'diamond',  color: '#6d4c41', size: 12 },
    [ObstacleType.Cactus]:        { shape: 'triangle', color: '#558b2f', size: 10 },
    [ObstacleType.Bones]:         { shape: 'circle',   color: '#d7ccc8', size: 7, alpha: 0.7 },
    [ObstacleType.IceCrystal]:    { shape: 'diamond',  color: '#80deea', size: 11 },
    [ObstacleType.SnowTree]:      { shape: 'triangle', color: '#b0bec5', size: 13 },
    [ObstacleType.FrozenRock]:    { shape: 'circle',   color: '#90a4ae', size: 10 },
    [ObstacleType.LavaVent]:      { shape: 'circle',   color: '#ff3d00', size: 9 },
    [ObstacleType.ScorchedTree]:  { shape: 'triangle', color: '#3e2723', size: 12 },
    [ObstacleType.VolcanicRock]:  { shape: 'circle',   color: '#424242', size: 10 },
    [ObstacleType.Pillar]:        { shape: 'circle',   color: '#757575', size: 13 },
    [ObstacleType.Brazier]:       { shape: 'circle',   color: '#ff8f00', size: 8 },
    [ObstacleType.Rubble]:        { shape: 'circle',   color: '#616161', size: 7, alpha: 0.6 },
  };

  private drawMap(map: MapConfig): void {
    const ts = map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = map.cols * ts;
    const mapH = map.rows * ts;
    const tc = map.tileColors ?? {};

    const defaults: Partial<Record<TileType, string>> = {
      [TileType.Empty]: '#3a7d44',
      [TileType.Path]: '#a1887f',
      [TileType.Blocked]: '#546e7a',
      [TileType.Spawn]: '#ff8f00',
      [TileType.Base]: '#1e88e5',
    };
    const emptyAdjacentColor = '#5a9e5f';

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const x = c * ts + ts / 2 + ox;
        const y = r * ts + ts / 2 + oy;
        let color: string;

        switch (tile) {
          case TileType.Empty: {
            const adjacent = isAdjacentToPath(r, c, map);
            if (tc[TileType.Empty]) {
              color = tc[TileType.Empty]!;
            } else {
              color = adjacent ? emptyAdjacentColor : defaults[TileType.Empty]!;
            }
            break;
          }
          default:
            color = tc[tile] ?? defaults[tile] ?? '#333333';
            break;
        }

        this.renderer.push({ shape: 'rect', x, y, size: ts - 2, color, alpha: 1 });

        if (tile === TileType.Empty && isAdjacentToPath(r, c, map) && !tc[TileType.Empty]) {
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

    if (map.obstaclePlacements) {
      for (const obs of map.obstaclePlacements) {
        const x = obs.col * ts + ts / 2 + ox;
        const y = obs.row * ts + ts / 2 + oy;
        const vis = RenderSystem.OBSTACLE_VISUALS[obs.type];
        if (vis) {
          this.renderer.push({ shape: vis.shape, x, y, size: vis.size, color: vis.color, alpha: vis.alpha ?? 1 });
        }
      }
    }

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        if (tile !== TileType.Spawn) continue;
        const sx = c * ts + ts / 2 + ox;
        const sy = r * ts + ts / 2 + oy;
        // Flag pole
        this.renderer.push({ shape: 'rect', x: sx, y: sy - 6, size: 2, h: 22, color: '#e0e0e0', alpha: 0.9 });
        // Flag banner (small red rect)
        this.renderer.push({ shape: 'rect', x: sx + 7, y: sy - 12, size: 14, h: 8, color: '#ff1744', alpha: 0.95 });
      }
    }

    // Scene border (4 thin rects — top, bottom, left, right)
    const borderW = 3;
    // Top
    this.renderer.push({ shape: 'rect', x: ox + mapW / 2, y: oy - borderW / 2, size: mapW + borderW * 2, h: borderW, color: '#111111', alpha: 1 });
    // Bottom
    this.renderer.push({ shape: 'rect', x: ox + mapW / 2, y: oy + mapH + borderW / 2, size: mapW + borderW * 2, h: borderW, color: '#111111', alpha: 1 });
    // Left
    this.renderer.push({ shape: 'rect', x: ox - borderW / 2, y: oy + mapH / 2, size: borderW, h: mapH, color: '#111111', alpha: 1 });
    // Right
    this.renderer.push({ shape: 'rect', x: ox + mapW + borderW / 2, y: oy + mapH / 2, size: borderW, h: mapH, color: '#111111', alpha: 1 });
  }

  private drawEntities(world: TowerWorld): void {
    const entities = renderableQuery(world.world);

    // Build sorted array: entity id + position for Y-sorting
    const sorted = (entities as number[])
      .filter((eid: number) => typeof Position.x[eid]! === 'number' && typeof Position.y[eid]! === 'number')
      .sort((a: number, b: number) => Position.y[a]! - Position.y[b]!);

    const selectedTowerId = this.getSelectedTowerId();
    const selectedUnitId = this.getSelectedUnitId();
    const selectedTrapId = this.getSelectedTrapId();

    for (const eid of sorted) {
      const posX = Position.x[eid]!;
      const posY = Position.y[eid]!;

      // ---- Type identification ----
      const isProjectile = hasComponent(world.world, eid, Projectile);
      const isEnemy = hasComponent(world.world, eid, Category) && Category.value[eid] === CategoryVal.Enemy;
      const isTower = hasComponent(world.world, eid, Tower);
      const isTrap = hasComponent(world.world, eid, Trap);
      const isUnit = hasComponent(world.world, eid, Category) && Category.value[eid] === CategoryVal.Soldier;

      // ---- Buff/status flags (computed once) ----
      const hasFrozen = hasComponent(world.world, eid, Frozen);
      const hasSlowed = hasComponent(world.world, eid, Slowed);
      const hasStunnedComponent = hasComponent(world.world, eid, Stunned);

      // ========================================
      // TRAP rendering
      // ========================================
      if (isTrap) {
        const animTimer = Trap.animTimer[eid]!;
        const animDuration = Trap.animDuration[eid]!;
        let spikeOffset = 0;
        let spikeSizeBonus = 0;
        if (animTimer > 0) {
          const progress = 1 - animTimer / animDuration;
          const factor = Math.sin(progress * Math.PI);
          spikeOffset = -factor * 12;
          spikeSizeBonus = factor * 6;
        }
        const tColor = '#f44336';
        const tAlpha = 1;
        for (let o = -1; o <= 1; o++) {
          this.renderer.push({
            shape: 'triangle',
            x: posX + o * 8,
            y: posY + spikeOffset,
            size: 14 + spikeSizeBonus,
            color: tColor,
            alpha: tAlpha,
          });
        }
        this.renderer.push({
          shape: 'rect',
          x: posX,
          y: posY + 16,
          size: 0.1,
          h: 0.1,
          color: '#f44336',
          alpha: 1,
          label: '地刺',
          labelColor: '#ffffff',
          labelSize: 12,
        });
        continue;
      }

      // ========================================
      // Hit flash
      // ========================================
      const flashActive = Visual.hitFlashTimer[eid]! > 0;
      let displayColor = rgbFromVisual(eid);
      let displayAlpha = Visual.alpha[eid]!;
      if (flashActive) {
        displayColor = '#ffffff';
        displayAlpha = 1;
        Visual.hitFlashTimer[eid]! = 0;
      }

      // ========================================
      // Buff visual effects (frozen / slow)
      // ========================================
      if (!flashActive) {
        if (hasFrozen) {
          displayColor = '#00bcd4';
          displayAlpha = 1;
        } else if (hasSlowed) {
          const stacks = Slowed.stacks[eid]!;
          const t = Math.min(stacks / 5, 1);
          displayColor = this.lerpColorRGB(
            Visual.colorR[eid]!, Visual.colorG[eid]!, Visual.colorB[eid]!,
            '#4488cc', t * 0.7,
          );
        }
      }

      // ========================================
      // Enemy stun visual
      // ========================================
      if (isEnemy && !flashActive) {
        if (hasStunnedComponent && Stunned.timer[eid]! > 0) {
          displayColor = '#ffd700';
          displayAlpha = 0.9;
        }
      }

      // ========================================
      // Boss rendering
      // ========================================
      const isBossEntity = hasComponent(world.world, eid, Boss);
      let drawSize = Visual.size[eid]!;
      if (isBossEntity) {
        drawSize = Visual.size[eid]! * 1.3;
        if (Boss.phase[eid]! === 2 && !flashActive) {
          if (Boss.transitionTimer[eid]! > 0) {
            const cycle = Math.floor(Boss.transitionTimer[eid]! / 0.1) % 2;
            displayColor = cycle === 0 ? '#ffffff' : '#d32f2f';
            displayAlpha = 1;
          } else {
            displayColor = this.lerpColorRGB(
              Visual.colorR[eid]!, Visual.colorG[eid]!, Visual.colorB[eid]!,
              '#d32f2f', 0.35,
            );
          }
        }
      }

      // ========================================
      // Selection highlight
      // ========================================
      const isSelected = (selectedTowerId !== null && eid === selectedTowerId) ||
                         (selectedUnitId !== null && eid === selectedUnitId) ||
                         (selectedTrapId !== null && eid === selectedTrapId);
      const strokeColor = isSelected ? '#ffffff' : (Visual.outline[eid] ? '#ffffff' : undefined);
      const strokeW = isSelected ? 3 : (Visual.outline[eid] ? 2 : undefined);

      // ========================================
      // Unit move-range circle (when selected)
      // ========================================
      if (isUnit && selectedUnitId === eid) {
        if (hasComponent(world.world, eid, Movement)) {
          const moveRange = Movement.moveRange[eid]!;
          this.renderer.push({
            shape: 'circle',
            x: posX,
            y: posY,
            size: moveRange * 2,
            color: '#4fc3f7',
            alpha: 0.15,
            stroke: '#4fc3f7',
            strokeWidth: 1,
          });
        }
      }

      // ========================================
      // Main render command builder
      // ========================================
      const pushCmd = (extras: Partial<Parameters<typeof this.renderer.push>[0]> = {}) => {
        let shape: ShapeType = shapeValToString(Visual.shape[eid]!);
        let targetX: number | undefined;
        let targetY: number | undefined;

        if (isProjectile) {
          shape = 'arrow';
          const projTargetId = Projectile.targetId[eid]!;
          if (projTargetId > 0 && typeof Position.x[projTargetId] === 'number') {
            targetX = Position.x[projTargetId];
            targetY = Position.y[projTargetId];
          }
        }

        this.renderer.push({
          shape,
          x: posX, y: posY,
          size: drawSize,
          color: displayColor,
          alpha: displayAlpha,
          stroke: strokeColor,
          strokeWidth: strokeW,
          targetX,
          targetY,
          ...extras,
        });

        // Boss crown
        if (isBossEntity) {
          const crownSize = Visual.size[eid]! * 0.4;
          this.renderer.push({
            shape: 'triangle',
            x: posX,
            y: posY - drawSize / 2 - crownSize / 2 - 2,
            size: crownSize,
            color: '#ffd700',
            alpha: 0.95,
          });
        }
      };

      // ========================================
      // Health bar (below entity)
      // ========================================
      const hasHealth = hasComponent(world.world, eid, Health);
      if (hasHealth && !isProjectile) {
        const hpCurrent = Health.current[eid]!;
        const hpMax = Health.max[eid]!;
        const ratio = hpMax > 0 ? hpCurrent / hpMax : 0;
        if (ratio < 1) {
          const barW = Math.max(Visual.size[eid]! * 1.2, 28);
          this.drawHealthBar(posX, posY - Visual.size[eid]! / 2 - 16, barW, ratio);
        }
      }

      pushCmd();

      // ========================================
      // Tower level diamonds
      // ========================================
      if (isTower) {
        const towerLevel = Tower.level[eid]!;
        if (towerLevel > 0) {
          const diamondSize = 6;
          const gap = 2;
          const totalW = towerLevel * diamondSize * 2 + (towerLevel - 1) * gap;
          const startX = posX - totalW / 2 + diamondSize;
          const diamondY = posY - drawSize / 2 - 8;
          for (let i = 0; i < towerLevel; i++) {
            this.renderer.push({
              shape: 'diamond',
              x: startX + i * (diamondSize * 2 + gap),
              y: diamondY,
              size: diamondSize,
              color: '#ffd700',
              alpha: 0.95,
            });
          }
        }
      }

      // ========================================
      // Unit info panel (when selected)
      // ========================================
      if (isUnit && selectedUnitId === eid) {
        const hasAttack = hasComponent(world.world, eid, Attack);
        if (hasHealth && hasAttack) {
          const hpCurrent = Math.ceil(Health.current[eid]!);
          const hpMax = Health.max[eid]!;
          const atkDmg = Attack.damage[eid]!;
          const atkSpd = Attack.attackSpeed[eid]!;
          const entitySize = Visual.size[eid]!;

          const infoY = posY - entitySize / 2 - 30;
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 12,
            size: 120,
            h: 45,
            color: '#1a1a2e',
            alpha: 0.85,
            stroke: '#555555',
            strokeWidth: 1,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 25,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: '士兵',
            labelColor: '#ffffff',
            labelSize: 14,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 5,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: `HP:${hpCurrent}/${hpMax}`,
            labelColor: '#4caf50',
            labelSize: 12,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY + 12,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: `ATK:${atkDmg} SPD:${atkSpd.toFixed(1)}`,
            labelColor: '#ff9800',
            labelSize: 12,
          });
        }
      }

      // ========================================
      // Ice particles at feet (slowed/frozen enemies)
      // ========================================
      if (isEnemy && !flashActive) {
        if (hasFrozen || hasSlowed) {
          const stacks = hasSlowed ? Slowed.stacks[eid]! : (hasFrozen ? 5 : 1);
          const particleCount = Math.min(stacks * 2, 10);
          const footY = posY + Visual.size[eid]! / 2 + 2;
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + (Date.now() % 3000) / 3000 * Math.PI * 2;
            const radius = Visual.size[eid]! * 0.4 + (i % 3) * 3;
            const px = posX + Math.cos(angle) * radius;
            const py = footY + Math.sin(angle * 2) * 4;
            this.renderer.push({
              shape: 'circle',
              x: px, y: py,
              size: 4 + (i % 2) * 2,
              color: hasFrozen ? '#e0f7fa' : '#b3e5fc',
              alpha: 0.7 + (i % 3) * 0.1,
            });
          }
        }
      }
    }
  }

  // ============================================
  // Health bar
  // ============================================
  private drawHealthBar(
    x: number, y: number, width: number, ratio: number,
  ): void {
    const barH = 6;
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

  // ============================================
  // Color utilities
  // ============================================

  /** Lerp from RGB components (entity base color) toward a target hex color */
  private lerpColorRGB(r1: number, g1: number, b1: number, hex2: string, t: number): string {
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }
}

// ---- Helper: convert Visual RGB components to CSS rgb string ----
function rgbFromVisual(eid: number): string {
  const r = Visual.colorR[eid]!;
  const g = Visual.colorG[eid]!;
  const b = Visual.colorB[eid]!;
  return `rgb(${r},${g},${b})`;
}
