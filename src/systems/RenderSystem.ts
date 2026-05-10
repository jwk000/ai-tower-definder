import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { CType, TileType, ObstacleType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Render } from '../components/Render.js';
import { Health } from '../components/Health.js';
import { Projectile } from '../components/Projectile.js';
import { BuffContainer } from '../components/Buff.js';
import { Boss } from '../components/Boss.js';
import { Enemy } from '../components/Enemy.js';
import { Unit } from '../components/Unit.js';
import { Attack } from '../components/Attack.js';
import { Trap } from '../components/Trap.js';
import { Tower } from '../components/Tower.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { UNIT_CONFIGS } from '../data/gameData.js';
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
    private getSelectedUnitEntityId: () => number | null = () => null,
    private getSelectedTrapEntityId: () => number | null = () => null,
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

  private drawEntities(entities: number[]): void {
    const sorted = entities
      .map((id) => ({
        id,
        pos: this.world.getComponent<Position>(id, CType.Position)!,
        render: this.world.getComponent<Render>(id, CType.Render)!,
      }))
      .filter((e) => e.pos && e.render)
      .sort((a, b) => a.pos.y - b.pos.y);

    const selectedTowerId = this.getSelectedTowerEntityId();
    const selectedUnitId = this.getSelectedUnitEntityId();
    const selectedTrapId = this.getSelectedTrapEntityId();

    for (const { id, pos, render: r } of sorted) {
      const isProjectile = this.world.hasComponent(id, CType.Projectile);
      const isEnemy = this.world.hasComponent(id, CType.Enemy);
      const isTower = this.world.hasComponent(id, CType.Tower);
      const isTrap = this.world.hasComponent(id, CType.Trap);
      const isUnit = this.world.hasComponent(id, CType.Unit);

      if (isTrap) {
        const trap = this.world.getComponent<Trap>(id, CType.Trap);
        let spikeOffset = 0;
        let spikeSizeBonus = 0;
        if (trap && trap.spikeAnimTimer > 0) {
          const progress = 1 - trap.spikeAnimTimer / trap.spikeAnimDuration;
          const factor = Math.sin(progress * Math.PI);
          spikeOffset = -factor * 12;
          spikeSizeBonus = factor * 6;
        }
        const tColor = '#f44336';
        const tAlpha = 1;
        for (let o = -1; o <= 1; o++) {
          this.renderer.push({
            shape: 'triangle',
            x: pos.x + o * 8,
            y: pos.y + spikeOffset,
            size: 14 + spikeSizeBonus,
            color: tColor,
            alpha: tAlpha,
          });
        }
        this.renderer.push({
          shape: 'rect',
          x: pos.x,
          y: pos.y + 16,
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

      const isSelected = (selectedTowerId !== null && id === selectedTowerId) || 
                         (selectedUnitId !== null && id === selectedUnitId) ||
                         (selectedTrapId !== null && id === selectedTrapId);
      const strokeColor = isSelected ? '#ffffff' : r.outline ? '#ffffff' : undefined;
      const strokeW = isSelected ? 3 : r.outline ? 2 : undefined;

      if (isUnit && selectedUnitId === id) {
        const unitComp = this.world.getComponent<Unit>(id, CType.Unit);
        if (unitComp) {
          this.renderer.push({
            shape: 'circle',
            x: pos.x,
            y: pos.y,
            size: unitComp.moveRange * 2,
            color: '#4fc3f7',
            alpha: 0.15,
            stroke: '#4fc3f7',
            strokeWidth: 1,
          });
        }
      }

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
        const barW = Math.max(r.size * 1.2, 28);
        this.drawHealthBar(pos.x, pos.y - r.size / 2 - 16, barW, health.ratio);
      }

      pushCmd();

      if (isTower) {
        const tower = this.world.getComponent<Tower>(id, CType.Tower);
        if (tower && tower.level > 0) {
          const diamondSize = 6;
          const gap = 2;
          const totalW = tower.level * diamondSize * 2 + (tower.level - 1) * gap;
          const startX = pos.x - totalW / 2 + diamondSize;
          const diamondY = pos.y - drawSize / 2 - 8;
          for (let i = 0; i < tower.level; i++) {
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

      if (isUnit && selectedUnitId === id) {
        const unitComp = this.world.getComponent<Unit>(id, CType.Unit);
        const attack = this.world.getComponent<Attack>(id, CType.Attack);
        if (unitComp && health && attack) {
          const cfg = UNIT_CONFIGS[unitComp.unitType];
          if (cfg) {
            const infoY = pos.y - r.size / 2 - 30;
            this.renderer.push({
              shape: 'rect',
              x: pos.x,
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
              x: pos.x,
              y: infoY - 25,
              size: 0.1,
              h: 0.1,
              color: '#ffffff',
              alpha: 1,
              label: cfg.name,
              labelColor: '#ffffff',
              labelSize: 14,
            });
            this.renderer.push({
              shape: 'rect',
              x: pos.x,
              y: infoY - 5,
              size: 0.1,
              h: 0.1,
              color: '#ffffff',
              alpha: 1,
              label: `HP:${Math.ceil(health.current)}/${health.max}`,
              labelColor: '#4caf50',
              labelSize: 12,
            });
            this.renderer.push({
              shape: 'rect',
              x: pos.x,
              y: infoY + 12,
              size: 0.1,
              h: 0.1,
              color: '#ffffff',
              alpha: 1,
              label: `ATK:${attack.atk} SPD:${attack.attackSpeed.toFixed(1)}`,
              labelColor: '#ff9800',
              labelSize: 12,
            });
          }
        }
      }

      // Ice particles at feet for slowed/frozen enemies
      if (isEnemy && !flashActive) {
        const bc = this.world.getComponent<BuffContainer>(id, CType.Buff);
        if (bc && (bc.buffs.has('ice_slow') || bc.buffs.has('ice_frozen'))) {
          const slowBuff = bc.buffs.get('ice_slow');
          const stacks = slowBuff?.currentStacks ?? (bc.buffs.has('ice_frozen') ? 5 : 1);
          const particleCount = Math.min(stacks * 2, 10);
          const footY = pos.y + r.size / 2 + 2;
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + (Date.now() % 3000) / 3000 * Math.PI * 2;
            const radius = r.size * 0.4 + (i % 3) * 3;
            const px = pos.x + Math.cos(angle) * radius;
            const py = footY + Math.sin(angle * 2) * 4;
            this.renderer.push({
              shape: 'circle',
              x: px, y: py,
              size: 4 + (i % 2) * 2,
              color: bc.buffs.has('ice_frozen') ? '#e0f7fa' : '#b3e5fc',
              alpha: 0.7 + (i % 3) * 0.1,
            });
          }
        }
      }
    }
  }

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
