// ============================================================
// Tower Defender — RenderSystem (bitecs migration)
//
// Canvas 2D map + entity rendering.
// Data access migrated from class-based components to bitecs SoA stores.
// All Canvas 2D drawing logic preserved as-is.
// ============================================================

import { TowerWorld, System, defineQuery, hasComponent } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { TileType, TowerType } from '../types/index.js';
import type { MapConfig, SceneLayout, ShapeType, CompositePart, UpgradeVisualConfig } from '../types/index.js';
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
  Production,
  Layer,
  LayerVal,
} from '../core/components.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { UNIT_CONFIGS, UPGRADE_VISUALS } from '../data/gameData.js';
import { formatNumber } from '../utils/formatNumber.js';

// ---- TowerType numeric ID → enum mapping ----
const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
];

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

  // Vertical centering: map centered between HUD bottom and bottom panel top
  const topHUD = 36;       // UISystem.TOP_H — must match
  const panelH = 100;      // bottom panel height — must match UISystem
  const mapPanelGap = 8;   // gap between map bottom edge and panel top
  const availableV = canvasH - topHUD - panelH - mapPanelGap;
  const offsetY = topHUD + (availableV - mapPixelH) / 2;

  return { offsetX, offsetY, cols: map.cols, rows: map.rows, tileSize: map.tileSize, mapPixelW, mapPixelH };
}

// ---- Layer → render z-index mapping ----
const LAYER_TO_Z: Record<number, number> = {
  0: 3,  // Abyss → below ground, above decorations
  1: 3,  // BelowGrid
  2: 4,  // AboveGrid (traps) → above ground but below entities
  3: 5,  // Ground → default z
  4: 6,  // LowAir → above ground entities
  5: 7,  // Space → top
};

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
    const layout = computeSceneLayout(map, LayoutManager.DESIGN_W, LayoutManager.DESIGN_H);
    RenderSystem.sceneOffsetX = layout.offsetX;
    RenderSystem.sceneOffsetY = layout.offsetY;
    RenderSystem.sceneW = layout.mapPixelW;
    RenderSystem.sceneH = layout.mapPixelH;
  }

  update(world: TowerWorld, _dt: number): void {
    this.drawMap(this.map);
    this.drawEntities(world);
  }

  private drawMap(map: MapConfig): void {
    const ts = map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = map.cols * ts;
    const mapH = map.rows * ts;
    const tc = map.tileColors ?? {};

    const defaults: Partial<Record<TileType, string>> = {
      [TileType.Empty]: '#7d9b6e',
      [TileType.Path]: '#bfad94',
      [TileType.Blocked]: '#78909c',
      [TileType.Spawn]: '#ff8f00',
      [TileType.Base]: '#1e88e5',
    };
    const emptyAdjacentColor = '#8eaa80';

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

        this.renderer.push({ shape: 'rect', x, y, size: ts - 2, color, alpha: 1, z: 0 });

        if (tile === TileType.Empty && isAdjacentToPath(r, c, map) && !tc[TileType.Empty]) {
          this.renderer.push({
            shape: 'rect', x, y, size: ts - 2,
            color: '#81c784',
            alpha: 0.25,
            stroke: '#a5d6a7',
            strokeWidth: 1,
            z: 0,
          });
        }
      }
    }

    // Obstacle rendering migrated to DecorationSystem

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        if (tile !== TileType.Spawn) continue;
        const sx = c * ts + ts / 2 + ox;
        const sy = r * ts + ts / 2 + oy;
        // Flag pole
        this.renderer.push({ shape: 'rect', x: sx, y: sy - 6, size: 2, h: 22, color: '#e0e0e0', alpha: 0.9, z: 0 });
        // Flag banner (small red rect)
        this.renderer.push({ shape: 'rect', x: sx + 7, y: sy - 12, size: 14, h: 8, color: '#ff1744', alpha: 0.95, z: 0 });
      }
    }

    // Scene border (4 thin rects — top, bottom, left, right)
    const borderW = 3;
    // Top
    this.renderer.push({ shape: 'rect', x: ox + mapW / 2, y: oy - borderW / 2, size: mapW + borderW * 2, h: borderW, color: '#111111', alpha: 1, z: 0 });
    // Bottom
    this.renderer.push({ shape: 'rect', x: ox + mapW / 2, y: oy + mapH + borderW / 2, size: mapW + borderW * 2, h: borderW, color: '#111111', alpha: 1, z: 0 });
    // Left
    this.renderer.push({ shape: 'rect', x: ox - borderW / 2, y: oy + mapH / 2, size: borderW, h: mapH, color: '#111111', alpha: 1, z: 0 });
    // Right
    this.renderer.push({ shape: 'rect', x: ox + mapW + borderW / 2, y: oy + mapH / 2, size: borderW, h: mapH, color: '#111111', alpha: 1, z: 0 });
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
      const isProjectile = hasComponent(world.world, Projectile, eid);
      const isEnemy = hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Enemy;
      const isTower = hasComponent(world.world, Tower, eid);
      const isTrap = hasComponent(world.world, Trap, eid);
      const isUnit = hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Soldier;
      const isProduction = hasComponent(world.world, Production, eid);

      // ---- Buff/status flags (computed once) ----
      const hasFrozen = hasComponent(world.world, Frozen, eid);
      const hasSlowed = hasComponent(world.world, Slowed, eid);
      const hasStunnedComponent = hasComponent(world.world, Stunned, eid);

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
      const isBossEntity = hasComponent(world.world, Boss, eid);
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
        if (hasComponent(world.world, Movement, eid)) {
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
      // Build pushCmd for single-shape entities
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
          z: renderZ,
          ...extras,
        });
      };

      // ========================================
      // Per-level upgrade visuals for towers
      // ========================================
      let upgradeVisual: UpgradeVisualConfig | undefined;
      const towerLevel = Tower.level[eid] ?? 1;
      if (isTower) {
        const towerTypeEnum = TOWER_TYPE_BY_ID[Tower.towerType[eid]!];
        const upgradeKey = towerTypeEnum + '_tower';
        if (towerTypeEnum && UPGRADE_VISUALS[upgradeKey]) {
          const levelConfigs = UPGRADE_VISUALS[upgradeKey]!;
          upgradeVisual = levelConfigs[towerLevel - 1];
          if (upgradeVisual) {
            drawSize = Math.round(drawSize * upgradeVisual.scaleMultiplier);
          }
        }
      }

      // ========================================
      // Layer → render z-index
      // ========================================
      const layerVal = Layer.value[eid] ?? LayerVal.Ground;
      const renderZ = LAYER_TO_Z[layerVal] ?? 5;

      // ========================================
      // Glow rendering (L3+ towers)
      // ========================================
      if (upgradeVisual?.glow) {
        const g = upgradeVisual.glow;
        const pulseMult = g.pulseAmplitude ? 1 + Math.sin(Date.now() * 0.003) * g.pulseAmplitude : 1;
        const glowRadius = Math.round(g.radius * pulseMult);
        this.renderer.push({
          shape: 'circle',
          x: posX,
          y: posY,
          size: glowRadius * 2,
          color: g.color,
          alpha: g.alpha * 0.5,
          z: renderZ,
        });
        // Second glow layer (larger, more transparent)
        if (towerLevel >= 4) {
          this.renderer.push({
            shape: 'circle',
            x: posX,
            y: posY,
            size: glowRadius * 3,
            color: g.color,
            alpha: g.alpha * 0.2,
            z: renderZ,
          });
        }
      }

      // ========================================
      // 1. Entity body (bottom layer — drawn first)
      // ========================================
      pushCmd();

      // ========================================
      // 2. Composite geometry extra parts (L3-L5 towers)
      // ========================================
      if (upgradeVisual && upgradeVisual.extraParts.length > 0) {
        for (const part of upgradeVisual.extraParts) {
          this.renderer.push({
            shape: part.shape,
            x: posX + part.offsetX,
            y: posY + part.offsetY,
            size: part.size,
            color: part.color,
            alpha: part.alpha ?? 1,
            stroke: part.stroke,
            strokeWidth: part.strokeWidth,
            rotation: part.rotation,
            z: renderZ,
          });
        }
      }

      // ========================================
      // Boss crown (keep existing)
      // ========================================
      if (isBossEntity) {
        const crownSize = Visual.size[eid]! * 0.4;
        this.renderer.push({
          shape: 'triangle',
          x: posX,
          y: posY - drawSize / 2 - crownSize / 2 - 2,
          size: crownSize,
          color: '#ffd700',
          alpha: 0.95,
          z: renderZ,
        });
      }

      // ========================================
      // 2. Health bar (always visible above entity)
      // ========================================
      const entityTop = posY - drawSize / 2;
      const healthBarY = entityTop - 8;  // bar center, 6px height

      const hasHealth = hasComponent(world.world, Health, eid);
      if (hasHealth && !isProjectile && drawSize > 0 && isFinite(entityTop)) {
        const hpCurrent = Health.current[eid]!;
        const hpMax = Health.max[eid]!;
        const ratio = hpMax > 0 ? hpCurrent / hpMax : 0;
        const barW = Math.max(drawSize * 1.2, 28);
        this.drawHealthBar(posX, healthBarY, barW, ratio, renderZ);
      }

      // ========================================
      // 3. Display name (above health bar)
      // ========================================
      const displayName = world.getDisplayName(eid);
      if (displayName && isFinite(healthBarY)) {
        const nameY = healthBarY - 10;  // above health bar
        this.renderer.push({
          shape: 'rect',
          x: posX,
          y: nameY,
          size: 0.1,
          h: 0.1,
          color: '#ffffff',
          alpha: 1,
          label: displayName,
          labelColor: '#ffffff',
          labelSize: 12,
          z: renderZ,
        });
      }

      // ========================================
      // 4. Level diamonds (above name, for towers & production buildings)
      // ========================================
      let levelToShow = 0;
      if (isTower) {
        levelToShow = Tower.level[eid]!;
      } else if (isProduction) {
        levelToShow = Production.level[eid]!;
      }

      if (levelToShow > 1 && isFinite(entityTop)) {
        const diamondSize = 6;
        const gap = 2;
        const totalW = levelToShow * diamondSize * 2 + (levelToShow - 1) * gap;
        const startX = posX - totalW / 2 + diamondSize;
        const diamondY = entityTop - 30;
        for (let i = 0; i < levelToShow; i++) {
          this.renderer.push({
            shape: 'diamond',
            x: startX + i * (diamondSize * 2 + gap),
            y: diamondY,
            size: diamondSize,
            color: '#ffd700',
            alpha: 0.95,
            z: renderZ,
          });
        }
      }

      // ========================================
      // 5. Unit info panel (when selected — detailed stats)
      // ========================================
      if (isUnit && selectedUnitId === eid) {
        const hasAttackComp = hasComponent(world.world, Attack, eid);
        if (hasHealth && hasAttackComp) {
          const hpCurrent = Math.ceil(Health.current[eid]!);
          const hpMax = Health.max[eid]!;
          const atkDmg = Attack.damage[eid]!;
          const atkSpd = Attack.attackSpeed[eid]!;

          const infoY = posY - drawSize / 2 - 30;
          const unitName = displayName || '士兵';
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
            z: renderZ,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 25,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: unitName,
            labelColor: '#ffffff',
            labelSize: 14,
            z: renderZ,
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
            z: renderZ,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY + 12,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: `ATK:${formatNumber(atkDmg)} SPD:${formatNumber(atkSpd)}`,
            labelColor: '#ff9800',
            labelSize: 12,
            z: renderZ,
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
              z: renderZ,
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
    z: number = 5,
  ): void {
    const barH = 6;
    const barW = width;
    const halfW = barW / 2;

    this.renderer.push({
      shape: 'rect', x, y: y, size: barW, h: barH,
      color: '#222222', alpha: 0.8,
      z,
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
        z,
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
