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
  AlertMark,
  AlertMarkVal,
  Frozen,
  Stunned,
  Production,
  Layer,
  LayerVal,
  TargetingMark,
  TileDamageMark,
  MissileCharge,
} from '../core/components.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { UNIT_CONFIGS, UPGRADE_VISUALS } from '../data/gameData.js';
import { formatNumber } from '../utils/formatNumber.js';
import { ScreenShakeSystem } from '../systems/ScreenShakeSystem.js';

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

// ---- Query: targeting marks + tile damage ----
const targetingMarkQuery = defineQuery([TargetingMark, Position]);
const tileDamageMarkQuery = defineQuery([TileDamageMark, Position]);

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

const HEALTH_BAR_HEIGHT = 6;
const HEALTH_BAR_HALF_H = HEALTH_BAR_HEIGHT / 2;
const CD_BAR_HEIGHT = 3;
const CD_BAR_HALF_H = CD_BAR_HEIGHT / 2;
const CD_BAR_GAP = 1;
const CD_BAR_COLOR = '#2196f3';

const RANK_CHEVRON_THICKNESS = 2;
const RANK_CHEVRON_ARM_LEN = 7;
const RANK_CHEVRON_ROW_GAP = 1;
const RANK_CHEVRON_ANGLE = Math.PI / 6;
const RANK_CHEVRON_FILL = '#e0e0e0';
const RANK_CHEVRON_STROKE = '#ffd700';
const RANK_STAR_SIZE = 5;
const RANK_STAR_COLOR = '#ffd700';
const RANK_STAR_GAP = 2;
const RANK_STAR_ROW_GAP = 2;

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
    private getSelectedProductionId: () => number | null = () => null,
    private screenShakeSystem?: ScreenShakeSystem,
  ) {
    const layout = computeSceneLayout(map, LayoutManager.DESIGN_W, LayoutManager.DESIGN_H);
    RenderSystem.sceneOffsetX = layout.offsetX;
    RenderSystem.sceneOffsetY = layout.offsetY;
    RenderSystem.sceneW = layout.mapPixelW;
    RenderSystem.sceneH = layout.mapPixelH;
  }

  update(world: TowerWorld, dt: number): void {
    // Apply screen shake offset (composes on top of design transform from beginFrame)
    if (this.screenShakeSystem) {
      const state = this.screenShakeSystem.state;
      if (state.offsetX !== 0 || state.offsetY !== 0) {
        this.renderer.context.translate(state.offsetX, state.offsetY);
      }
    }
    this.drawMap(this.map);
    this.drawTargetingMarks(world, dt);
    this.drawTileDamageMarks(world);
    this.drawEntities(world, dt);
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

  // ============================================
  // TargetingMark rendering (red crosshair + rotating ring on ground)
  // ============================================
  private drawTargetingMarks(world: TowerWorld, dt: number): void {
    const entities = targetingMarkQuery(world.world);
    for (const eid of entities) {
      const px = Position.x[eid]!;
      const py = Position.y[eid]!;
      const blastRadius = TargetingMark.blastRadius[eid]!;

      // Advance timing
      TargetingMark.pulsePhase[eid]! += dt;
      TargetingMark.ringRotation[eid]! += dt * (2 * Math.PI / 1.2);

      const pulsePhase = TargetingMark.pulsePhase[eid]!;
      const ringRot = TargetingMark.ringRotation[eid]!;

      // Pulsing alpha: oscillates between 0.5 – 1.0
      const pulseAlpha = 0.75 + 0.25 * Math.sin(pulsePhase * 12);

      // ---- Red crosshair (two lines crossing at center) ----
      // Vertical line
      this.renderer.push({ shape: 'rect', x: px, y: py, size: 2, h: 24, color: '#ff1744', alpha: pulseAlpha, z: 4 });
      // Horizontal line
      this.renderer.push({ shape: 'rect', x: px, y: py, size: 24, h: 2, color: '#ff1744', alpha: pulseAlpha, z: 4 });

      // ---- Center dot ----
      this.renderer.push({ shape: 'circle', x: px, y: py, size: 8, color: '#ff0000', alpha: 1, z: 4 });

      // ---- Rotating ring ----
      if (blastRadius > 0) {
        // Ring outline (stroke only, no fill)
        this.renderer.push({
          shape: 'circle', x: px, y: py, size: blastRadius * 2,
          color: 'transparent', alpha: 0.6, stroke: '#d50000', strokeWidth: 2, z: 4,
        });
        // Ring tick marks (4 dots rotating around the ring)
        for (let i = 0; i < 4; i++) {
          const angle = ringRot + (i * Math.PI) / 2;
          const tx = px + Math.cos(angle) * blastRadius;
          const ty = py + Math.sin(angle) * blastRadius;
          this.renderer.push({
            shape: 'circle', x: tx, y: ty, size: 5,
            color: '#d50000', alpha: 0.9, z: 4,
          });
        }
      }
    }
  }

  // ============================================
  // TileDamageMark rendering (dark overlay + crack pattern on damaged tiles)
  // ============================================
  private drawTileDamageMarks(world: TowerWorld): void {
    const entities = tileDamageMarkQuery(world.world);
    const ts = this.map.tileSize;

    for (const eid of entities) {
      const row = TileDamageMark.row[eid]!;
      const col = TileDamageMark.col[eid]!;
      const duration = TileDamageMark.duration[eid]!;
      const elapsed = TileDamageMark.elapsed[eid]!;
      const crackSeed = TileDamageMark.crackSeed[eid]!;
      const maxAlpha = TileDamageMark.maxAlpha[eid]!;

      // Fade out in last 1.0 second
      let fadeFactor: number;
      if (elapsed < duration - 1.0) {
        fadeFactor = 1.0;
      } else {
        fadeFactor = Math.max(0, 1.0 - (elapsed - (duration - 1.0)) / 1.0);
      }
      const alpha = maxAlpha * fadeFactor;

      // Tile center position (matches drawMap tile positioning)
      const tileX = RenderSystem.sceneOffsetX + col * ts + ts / 2;
      const tileY = RenderSystem.sceneOffsetY + row * ts + ts / 2;

      // ---- Dark overlay ----
      this.renderer.push({
        shape: 'rect', x: tileX, y: tileY, size: ts,
        color: '#000000', alpha: alpha * 0.4, z: 1,
      });

      // ---- Crack dots (scattered dots from center, seeded PRNG) ----
      const rand = simplePRNG(crackSeed);
      const numDots = 10 + (crackSeed % 6); // 10–15 dots
      for (let i = 0; i < numDots; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = ts * 0.1 + rand() * ts * 0.4;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        this.renderer.push({
          shape: 'circle',
          x: tileX + dx, y: tileY + dy,
          size: 1.5 + rand() * 3,
          color: '#3e2723',
          alpha: alpha * (0.5 + rand() * 0.5),
          z: 2,
        });
      }
    }
  }

  private drawEntities(world: TowerWorld, dt: number): void {
    const entities = renderableQuery(world.world);

    // Build sorted array: entity id + position for Y-sorting
    const sorted = (entities as number[])
      .filter((eid: number) => typeof Position.x[eid]! === 'number' && typeof Position.y[eid]! === 'number')
      .sort((a: number, b: number) => Position.y[a]! - Position.y[b]!);

    const selectedTowerId = this.getSelectedTowerId();
    const selectedUnitId = this.getSelectedUnitId();
    const selectedTrapId = this.getSelectedTrapId();
    const selectedProductionId = this.getSelectedProductionId();

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
        (selectedTrapId !== null && eid === selectedTrapId) ||
        (selectedProductionId !== null && eid === selectedProductionId);
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
      // MissileCharge visual (pulsing red glow + alpha flicker)
      // ========================================
      if (isTower && hasComponent(world.world, MissileCharge, eid)) {
        const chargeElapsed = MissileCharge.chargeElapsed[eid]!;
        const glowAlpha = 0.15 + 0.25 * Math.sin(chargeElapsed * 10);
        this.renderer.push({
          shape: 'circle',
          x: posX,
          y: posY,
          size: drawSize * 2 + 16,
          color: '#ff1744',
          alpha: glowAlpha,
          z: renderZ,
        });
        displayAlpha *= (0.85 + 0.15 * Math.sin(chargeElapsed * 10));
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
      // Alert mark (red ! above soldier head)
      // ========================================
      if (hasComponent(world.world, AlertMark, eid)) {
        const visible = AlertMark.visible[eid]!;
        if (visible === AlertMarkVal.Blinking || visible === AlertMarkVal.Solid) {
          let show = true;
          if (visible === AlertMarkVal.Blinking) {
            // Blink: visible 0.3s, hidden 0.3s
            AlertMark.timer[eid]! += dt;
            if (AlertMark.timer[eid]! >= 0.3) AlertMark.timer[eid] = 0;
            show = AlertMark.timer[eid]! < 0.15;
          }
          if (show) {
            const markY = posY - drawSize / 2 - 12;
            this.renderer.push({
              shape: 'triangle',
              x: posX,
              y: markY,
              size: 14,
              color: '#ff1744',
              alpha: 0.95,
              z: renderZ + 1,
            });
            // Vertical bar of the "!" mark
            this.renderer.push({
              shape: 'rect',
              x: posX,
              y: markY + 3,
              size: 2,
              h: 6,
              color: '#ff1744',
              alpha: 0.95,
              z: renderZ + 1,
            });
          }
        }
      }

      // ========================================
      // 2. Health bar (always visible above entity)
      // ========================================
      const entityTop = posY - drawSize / 2;
      const healthBarY = entityTop - 8;  // bar center, 6px height

      const hasHealth = hasComponent(world.world, Health, eid);
      const barW = Math.max(drawSize * 1.2, 28);
      if (hasHealth && !isProjectile && drawSize > 0 && isFinite(entityTop)) {
        const hpCurrent = Health.current[eid]!;
        const hpMax = Health.max[eid]!;
        const ratio = hpMax > 0 ? hpCurrent / hpMax : 0;
        this.drawHealthBar(posX, healthBarY, barW, ratio, renderZ);
      }

      // ========================================
      // 2.5. Cooldown bar (thin blue bar below health bar, towers only)
      // ========================================
      if (isTower && hasComponent(world.world, Attack, eid) && drawSize > 0 && isFinite(entityTop)) {
        const atkSpeed = Attack.attackSpeed[eid]!;
        const cdTimer = Attack.cooldownTimer[eid]!;
        // fillRatio: 0 = just fired (empty), 1 = ready to fire (full)
        const fillRatio = Math.max(0, Math.min(1, 1 - cdTimer * atkSpeed));
        const cdBarY = healthBarY + HEALTH_BAR_HALF_H + CD_BAR_GAP + CD_BAR_HALF_H;
        this.drawCooldownBar(posX, cdBarY, barW, fillRatio, renderZ);
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
      // 4a. Tower rank insignia (chevron shoulder marks, replaces diamond row)
      // ========================================
      if (isTower && isFinite(entityTop)) {
        const towerLevel = Tower.level[eid]!;
        if (towerLevel >= 1) {
          this.drawTowerRankInsignia(posX, entityTop - 22, towerLevel, renderZ);
        }
      }

      // ========================================
      // 4b. Production building level diamonds (kept as-is)
      // ========================================
      if (isProduction && isFinite(entityTop)) {
        const prodLevel = Production.level[eid]!;
        if (prodLevel > 1) {
          const diamondSize = 6;
          const gap = 2;
          const totalW = prodLevel * diamondSize * 2 + (prodLevel - 1) * gap;
          const startX = posX - totalW / 2 + diamondSize;
          const diamondY = entityTop - 30;
          for (let i = 0; i < prodLevel; i++) {
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
  // Tower rank insignia — chevron stripes + star pips (military-style epaulette)
  // L1: 1 chevron; L2: 2; L3: 3; L4: 3 chevrons + 1 star; L5: 3 chevrons + 2 stars
  // (x, y) = bottom-center anchor (typically just above tower's top edge)
  // ============================================
  private drawTowerRankInsignia(
    x: number, y: number, level: number, z: number,
  ): void {
    const clampedLevel = Math.max(1, Math.min(5, level));
    const chevronCount = Math.min(clampedLevel, 3);
    const starCount = Math.max(0, clampedLevel - 3);

    const rowH = RANK_CHEVRON_THICKNESS + RANK_CHEVRON_ROW_GAP;
    for (let i = 0; i < chevronCount; i++) {
      // Stack chevrons upward from anchor; row 0 is the bottom-most stripe
      const chevronY = y - i * rowH;
      this.drawSingleChevron(x, chevronY, z);
    }

    if (starCount > 0) {
      const starsTotalW = starCount * RANK_STAR_SIZE + (starCount - 1) * RANK_STAR_GAP;
      const starsStartX = x - starsTotalW / 2 + RANK_STAR_SIZE / 2;
      const starsY = y + RANK_STAR_ROW_GAP + RANK_STAR_SIZE / 2;
      for (let i = 0; i < starCount; i++) {
        this.renderer.push({
          shape: 'diamond',
          x: starsStartX + i * (RANK_STAR_SIZE + RANK_STAR_GAP),
          y: starsY,
          size: RANK_STAR_SIZE,
          color: RANK_STAR_COLOR,
          alpha: 0.95,
          z,
        });
      }
    }
  }

  // ---- Draw one chevron stripe centered on (x, y), apex pointing up ----
  private drawSingleChevron(x: number, y: number, z: number): void {
    const armLen = RANK_CHEVRON_ARM_LEN;
    const thickness = RANK_CHEVRON_THICKNESS;
    const angle = RANK_CHEVRON_ANGLE;
    // Each arm's center sits halfway along the arm from the apex
    const armCenterDX = Math.sin(angle) * armLen / 2;
    const armCenterDY = Math.cos(angle) * armLen / 2;

    this.renderer.push({
      shape: 'rect',
      x: x - armCenterDX,
      y: y + armCenterDY,
      size: armLen,
      h: thickness,
      color: RANK_CHEVRON_FILL,
      stroke: RANK_CHEVRON_STROKE,
      strokeWidth: 0.5,
      rotation: -angle,
      alpha: 0.95,
      z,
    });

    this.renderer.push({
      shape: 'rect',
      x: x + armCenterDX,
      y: y + armCenterDY,
      size: armLen,
      h: thickness,
      color: RANK_CHEVRON_FILL,
      stroke: RANK_CHEVRON_STROKE,
      strokeWidth: 0.5,
      rotation: angle,
      alpha: 0.95,
      z,
    });
  }

  // ============================================
  // Cooldown bar — thin blue progress bar (rendered below health bar)
  // ============================================
  private drawCooldownBar(
    x: number, y: number, width: number, ratio: number, z: number,
  ): void {
    const barH = CD_BAR_HEIGHT;
    const barW = width;
    const halfW = barW / 2;

    this.renderer.push({
      shape: 'rect', x, y, size: barW, h: barH,
      color: '#222222', alpha: 0.7,
      z,
    });

    const fillW = Math.max(barW * ratio, 0);
    if (fillW > 0) {
      this.renderer.push({
        shape: 'rect',
        x: x - halfW + fillW / 2,
        y,
        size: fillW,
        h: barH,
        color: CD_BAR_COLOR,
        alpha: 0.95,
        z,
      });
    }
  }

  // ============================================
  // Health bar
  // ============================================
  private drawHealthBar(
    x: number, y: number, width: number, ratio: number,
    z: number = 5,
  ): void {
    const barH = HEALTH_BAR_HEIGHT;
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

// ---- Helper: seeded PRNG for deterministic crack patterns ----
function simplePRNG(seed: number): () => number {
  let state = seed * 12345 + 67890;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
