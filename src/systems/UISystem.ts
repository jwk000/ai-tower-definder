// ============================================================
// Tower Defender — UISystem (bitecs migration)
//
// HUD, tooltips, buttons, overlays — the largest UI system.
// Canvas 2D drawing code preserved; data access migrated to
// bitecs SoA stores and defineQuery.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS, ENEMY_CONFIGS } from '../data/gameData.js';
import { GamePhase, TowerType, UnitType, ProductionType, type ShapeType } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { FONTS, getFont } from '../config/fonts.js';
import {
  Position,
  Health,
  Tower,
  Attack,
  UnitTag,
  Visual,
  Production,
  Category,
  CategoryVal,
  Trap,
  Movement,
  Boss,
} from '../core/components.js';

// ============================================================
// TowerType numeric ID → enum mapping (matches BuildSystem)
// ============================================================

const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
];

// ============================================================
// Interface types (unchanged from original)
// ============================================================

interface UIButton {
  x: number; y: number; w: number; h: number;
  label: string;
  color: string; textColor: string;
  subLabel?: string;
  iconShape?: { shape: string; color: string };
  onClick: () => void;
  enabled: boolean | (() => boolean);
}

interface UIInfo {
  x: number; y: number;
  text: string; color: string; size: number;
  align?: CanvasTextAlign;
}

interface UIOverlay {
  phase: GamePhase;
  color: string;
  title: string;
  subtext: string;
}

interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'production' | 'trap';
  towerType?: TowerType;
  unitType?: UnitType;
  productionType?: ProductionType;
}

// ============================================================
// bitecs query — alive enemy count (replaces world.query(CType.Enemy))
// ============================================================

const aliveEnemyQuery = defineQuery([Health, UnitTag]);

// ============================================================
// UISystem
// ============================================================

export class UISystem implements System {
  readonly name = 'UISystem';
  // requiredComponents removed — no entity iteration; queries run inline

  static readonly TOP_H = 36;
  static readonly BTN_W = 120;
  static readonly BTN_H = 80;
  static readonly BTN_GAP = 8;

  private buttons: UIButton[] = [];
  private infos: UIInfo[] = [];
  private overlay: UIOverlay | null = null;

  public selectedEntityId: number | null = null;
  public selectedEntityType: 'tower' | 'unit' | 'trap' | null = null;

  public enemyEntityId: number | null = null;
  private enemySelectTimer: number = 0;

  /** Cached world reference — set at beginning of each update() call */
  private _world: TowerWorld | null = null;

  selectEnemy(id: number): void {
    this.selectedEntityId = null;
    this.selectedEntityType = null;
    this.enemyEntityId = id;
    this.enemySelectTimer = 3;
  }

  constructor(
    private renderer: Renderer,
    private getPhase: () => GamePhase,
    private getGold: () => number,
    private getWave: () => number,
    private getTotalWaves: () => number,
    private getWaveActive: () => boolean,
    private getSelectedTower: () => TowerType | null,
    private selectTower: (type: TowerType) => void,
    private startWave: () => void,
    private getEnergy: () => number,
    private getPopulation: () => number,
    private getMaxPopulation: () => number,
    private onUpgradeTower: ((entityId: number) => void) | null = null,
    private onStartDrag: ((entityType: string, towerType?: TowerType, unitType?: UnitType, productionType?: ProductionType) => void) | null = null,
    private getDragState: (() => DragState | null) | null = null,
    private getPointerPosition: (() => { x: number; y: number }) | null = null,
    private getEndlessScore: (() => number) | null = null,
    private isEndlessMode: (() => boolean) | null = null,
    private onSkipCountdown: (() => void) | null = null,
    private onToggleSpeed: (() => void) | null = null,
    private onPause: (() => void) | null = null,
    private onResume: (() => void) | null = null,
    private onRestart: (() => void) | null = null,
    private onExit: (() => void) | null = null,
    private getCountdown: (() => number) | null = null,
    private getSpeed: (() => number) | null = null,
    private isPaused: (() => boolean) | null = null,
    private getTotalSpawned: (() => number) | null = null,
    private onRecycleEntity: ((entityId: number) => void) | null = null,
    private getWeatherName: (() => string) | null = null,
  ) {}

  // ---- Selection getter/setter helpers (unchanged) ----

  get selectedTowerEntityId(): number | null {
    return this.selectedEntityType === 'tower' ? this.selectedEntityId : null;
  }
  set selectedTowerEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'tower' : null;
  }

  get selectedUnitEntityId(): number | null {
    return this.selectedEntityType === 'unit' ? this.selectedEntityId : null;
  }
  set selectedUnitEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'unit' : null;
  }

  get selectedTrapEntityId(): number | null {
    return this.selectedEntityType === 'trap' ? this.selectedEntityId : null;
  }
  set selectedTrapEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'trap' : null;
  }

  // ============================================================
  // System.update — cache world, build UI state
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    this._world = world;
    const phase = this.getPhase();

    this.buttons = [];
    this.infos = [];
    this.overlay = null;

    if (this.enemyEntityId !== null) {
      this.enemySelectTimer -= dt;
      if (this.enemySelectTimer <= 0) {
        this.enemyEntityId = null;
      }
    }

    if (this.isPaused?.()) {
      this.buildTopHUD(phase);
      this.buildBottomPanel(phase);
      this.buildPauseOverlay();
      return;
    }

    if (this.selectedEntityId !== null && this.selectedEntityType === 'tower') {
      this.drawRangePreview();
    }

    this.buildTopHUD(phase);
    this.buildBottomPanel(phase);
    this.buildOverlay(phase);

    if (this.selectedEntityId !== null) {
      this.buildEntityTooltip();
    }
    if (this.enemyEntityId !== null) {
      this.buildEnemyTooltip();
    }

    this.buildDragGhost();
  }

  // ============================================================
  // Range Preview (tower / trap)
  // ============================================================

  private drawRangePreview(): void {
    const id = this.selectedEntityId;
    if (id === null || !this._world) return;

    const px = Position.x[id];
    const py = Position.y[id];
    if (px === undefined) return;

    let diameter = 0;
    let color = '#ffffff';

    if (this.selectedEntityType === 'tower') {
      const atkRange = Attack.range[id];
      const towerTypeVal = Tower.towerType[id];
      if (atkRange === undefined || towerTypeVal === undefined) return;

      const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal];
      const config = towerTypeEnum ? TOWER_CONFIGS[towerTypeEnum] : undefined;
      diameter = atkRange * 2;
      color = config?.color ?? '#ffffff';
    } else if (this.selectedEntityType === 'trap') {
      const trapRadius = Trap.radius[id];
      if (trapRadius === undefined) return;
      diameter = trapRadius * 2;
      color = '#e53935';
    } else {
      return;
    }

    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter,
      color,
      alpha: 0.15,
    });
    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter,
      color,
      alpha: 0.4,
      stroke: color,
      strokeWidth: 2,
    });
  }

  // ============================================================
  // renderUI — direct Canvas 2D text overlay (called from onPostRender)
  // ============================================================

  renderUI(): void {
    const ctx = this.renderer.context;

    for (const btn of this.buttons) {
      this.drawButton(btn);
    }

    for (const info of this.infos) {
      ctx.save();
      ctx.fillStyle = info.color;
      ctx.font = getFont(info.size, true);
      ctx.textAlign = info.align ?? 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.text, info.x, info.y);
      ctx.restore();
    }

    if (this.overlay) {
      const cx = 1920 / 2;
      const cy = 1080 / 2;
      ctx.save();
      ctx.fillStyle = this.overlay.color;
      ctx.font = FONTS.title;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.overlay.title, cx, cy);
      ctx.font = FONTS.subtitle;
      ctx.fillText(this.overlay.subtext, cx, cy + 50);
      ctx.restore();
    }
  }

  // ---- Button drawing ----

  private drawButton(btn: UIButton): void {
    const ctx = this.renderer.context;
    const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;
    const lines = btn.label.split('\n');
    const lineH = 16;
    const startY = btn.y + btn.h / 2 - ((lines.length - 1) * lineH) / 2;

    ctx.save();
    ctx.fillStyle = enabled ? btn.textColor : '#888888';
    ctx.font = FONTS.body;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, btn.x + btn.w / 2, startY + i * lineH);
    }
    ctx.restore();
  }

  // ============================================================
  // Top HUD (compact single line)
  // ============================================================

  private buildTopHUD(phase: GamePhase): void {
    const world = this._world;
    const gold = this.getGold();
    const energy = this.getEnergy();
    const population = this.getPopulation();
    const maxPop = this.getMaxPopulation();
    const wave = this.getWave();
    const total = this.getTotalWaves();

    this.renderer.push({
      shape: 'rect',
      x: 960, y: UISystem.TOP_H / 2,
      size: 1920, h: UISystem.TOP_H,
      color: '#0d1b2a',
      alpha: 0.9,
    });

    this.infos.push({
      x: 20, y: UISystem.TOP_H / 2,
      text: `💰${gold} ⚡${energy} 👥${population}/${maxPop}`,
      color: '#ffd54f', size: 20,
    });

    if (phase === GamePhase.Battle && world) {
      // Count alive enemies via bitecs query
      let aliveCount = 0;
      const enemies = aliveEnemyQuery(world.world);
      for (const eid of enemies) {
        if (UnitTag.isEnemy[eid] === 1 && Health.current[eid] > 0) {
          aliveCount++;
        }
      }

      const totalSpawned = this.getTotalSpawned?.() ?? 0;
      const weatherName = this.getWeatherName?.() ?? '';
      this.infos.push({
        x: 800, y: UISystem.TOP_H / 2,
        text: `波次 ${wave}/${total > 0 ? total : '∞'}`,
        color: '#ffffff', size: 20,
      });
      this.infos.push({
        x: 1000, y: UISystem.TOP_H / 2,
        text: `敌军:${aliveCount}/${totalSpawned}`,
        color: '#ef5350', size: 20,
      });
      if (weatherName) {
        this.infos.push({
          x: 1200, y: UISystem.TOP_H / 2,
          text: `🌤${weatherName}`,
          color: '#ffcc80', size: 18,
        });
      }
    } else {
      const weatherName = this.getWeatherName?.() ?? '';
      this.infos.push({
        x: 800, y: UISystem.TOP_H / 2,
        text: `波次 ${wave}/${total > 0 ? total : '∞'}`,
        color: '#ffffff', size: 20,
      });
      this.infos.push({
        x: 1000, y: UISystem.TOP_H / 2,
        text: '敌军:0/0',
        color: '#aaaaaa', size: 20,
      });
      if (weatherName) {
        this.infos.push({
          x: 1200, y: UISystem.TOP_H / 2,
          text: `🌤${weatherName}`,
          color: '#ffcc80', size: 18,
        });
      }
    }

    const currentlyPaused = this.isPaused?.() ?? false;

    if (!currentlyPaused && this.getCountdown && this.getCountdown() > 0) {
      const cd = this.getCountdown();
      this.infos.push({
        x: 1650, y: UISystem.TOP_H / 2,
        text: `⏱${cd.toFixed(1)}s`,
        color: '#ffd54f', size: 20,
      });

      const skipBtnX = 1780;
      const skipBtnW = 50;
      const skipBtnH = 28;
      const skipBtnY = (UISystem.TOP_H - skipBtnH) / 2;

      this.renderer.push({
        shape: 'rect',
        x: skipBtnX + skipBtnW / 2, y: skipBtnY + skipBtnH / 2,
        size: skipBtnW, h: skipBtnH,
        color: '#2e7d32',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: skipBtnX, y: skipBtnY, w: skipBtnW, h: skipBtnH,
        label: '▶',
        color: '#2e7d32',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onSkipCountdown?.(); },
      });
    }

    const speedX = 1850;
    const speedBtnW = 30;
    const speedBtnH = 28;
    const speedBtnY = (UISystem.TOP_H - speedBtnH) / 2;
    const currentSpeed = this.getSpeed?.() ?? 1.0;
    const speedLabel = currentSpeed === 2.0 ? '2x' : '1x';
    const speedColor = currentSpeed === 2.0 ? '#c62828' : '#1565c0';

    this.renderer.push({
      shape: 'rect',
      x: speedX + speedBtnW / 2, y: speedBtnY + speedBtnH / 2,
      size: speedBtnW, h: speedBtnH,
      color: speedColor,
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
    });

    this.buttons.push({
      x: speedX, y: speedBtnY, w: speedBtnW, h: speedBtnH,
      label: speedLabel,
      color: speedColor,
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onToggleSpeed?.(); },
    });

    const pauseBtnX = 1891;
    const pauseBtnW = 29;
    const pauseBtnH = 28;
    const pauseBtnY = (UISystem.TOP_H - pauseBtnH) / 2;

    this.renderer.push({
      shape: 'rect',
      x: pauseBtnX + pauseBtnW / 2, y: pauseBtnY + pauseBtnH / 2,
      size: pauseBtnW, h: pauseBtnH,
      color: '#37474f',
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
    });

    this.buttons.push({
      x: pauseBtnX, y: pauseBtnY, w: pauseBtnW, h: pauseBtnH,
      label: '⏸',
      color: '#37474f',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => {
        if (currentlyPaused) {
          this.onResume?.();
        } else {
          this.onPause?.();
        }
      },
    });
  }

  // ============================================================
  // Bottom Panel (unified toolbar)
  // ============================================================

  private getSceneBottom(): number {
    return RenderSystem.sceneOffsetY + RenderSystem.sceneH;
  }

  private buildBottomPanel(phase: GamePhase): void {
    const sceneBottom = this.getSceneBottom();
    const panelY = sceneBottom + 8;
    const panelH = 160;
    const available = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;

    if (panelY + panelH > 1080) return;

    this.renderer.push({
      shape: 'rect',
      x: 960, y: panelY + panelH / 2,
      size: 1920, h: panelH,
      color: '#0d1b2a',
      alpha: 0.9,
    });

    const btnY = panelY + 18;
    const bw = UISystem.BTN_W;
    const bh = UISystem.BTN_H;

    // ---- Tower buttons (6) ----
    this.infos.push({ x: 210, y: panelY + 6, text: '防御塔', color: '#aaaaaa', size: 14, align: 'center' });

    const towerTypes = [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning, TowerType.Laser, TowerType.Bat];
    const selected = this.getSelectedTower();

    for (let i = 0; i < towerTypes.length; i++) {
      const type = towerTypes[i]!;
      const config = TOWER_CONFIGS[type];
      if (!config) continue;

      const cx = 160 + i * (bw + UISystem.BTN_GAP) + bw / 2;
      const canAfford = this.getGold() >= config.cost;
      const isSel = selected === type;

      this.renderer.push({
        shape: 'rect',
        x: cx, y: btnY + bh / 2,
        size: bw, h: bh,
        color: isSel ? '#1e88e5' : canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: cx - bw / 2, y: btnY, w: bw, h: bh,
        label: `${config.name}\n${config.cost}G`,
        color: isSel ? '#1e88e5' : '#37474f',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: available,
        onClick: () => {
          this.selectTower(type);
          if (available && this.onStartDrag) {
            this.onStartDrag('tower', type);
          }
        },
      });
    }

    // ---- Divider ----
    const divX1 = 160 + towerTypes.length * (bw + UISystem.BTN_GAP);
    this.renderer.push({
      shape: 'rect',
      x: divX1, y: btnY + bh / 2,
      size: 2, h: bh + 16,
      color: '#444444',
      alpha: 1,
    });

    // ---- Unit buttons (2) + Trap (1) ----
    const unitStartX = divX1 + 20;
    this.infos.push({ x: unitStartX + bw, y: panelY + 6, text: '单位/陷阱', color: '#aaaaaa', size: 14, align: 'center' });

    const unitTypes = [UnitType.ShieldGuard, UnitType.Swordsman];

    for (let i = 0; i < unitTypes.length; i++) {
      const utype = unitTypes[i]!;
      const uconfig = UNIT_CONFIGS[utype];
      if (!uconfig) continue;

      const cx = unitStartX + i * (bw + UISystem.BTN_GAP) + bw / 2;
      const canAffordGold = this.getGold() >= uconfig.cost;
      const hasPop = this.getPopulation() + uconfig.popCost <= this.getMaxPopulation();
      const canAfford = canAffordGold && hasPop;

      this.renderer.push({
        shape: 'rect',
        x: cx, y: btnY + bh / 2,
        size: bw, h: bh,
        color: canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: cx - bw / 2, y: btnY, w: bw, h: bh,
        label: `${uconfig.name}\n${uconfig.cost}G`,
        color: '#37474f',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: available && canAfford,
        onClick: () => {
          if (available && canAfford && this.onStartDrag) {
            this.onStartDrag('unit', undefined, utype);
          }
        },
      });
    }

    // Trap button
    const trapCost = 40;
    const trapAffordable = this.getGold() >= trapCost;
    const trapX = unitStartX + 2 * (bw + UISystem.BTN_GAP) + bw / 2;

    this.renderer.push({
      shape: 'rect',
      x: trapX, y: btnY + bh / 2,
      size: bw, h: bh,
      color: trapAffordable ? '#4a0000' : '#444444',
      alpha: 0.9,
      stroke: '#e53935', strokeWidth: 1,
    });

    this.buttons.push({
      x: trapX - bw / 2, y: btnY, w: bw, h: bh,
      label: `地刺\n${trapCost}G`,
      color: '#4a0000',
      textColor: trapAffordable ? '#ffffff' : '#888888',
      enabled: available && trapAffordable,
      onClick: () => {
        if (available && trapAffordable && this.onStartDrag) {
          this.onStartDrag('trap');
        }
      },
    });

    // ---- Divider ----
    const divX2 = unitStartX + 3 * (bw + UISystem.BTN_GAP) - UISystem.BTN_GAP + 10;
    this.renderer.push({
      shape: 'rect',
      x: divX2, y: btnY + bh / 2,
      size: 2, h: bh + 16,
      color: '#444444',
      alpha: 1,
    });

    // ---- Production buttons (2) ----
    const prodStartX = divX2 + 20;
    this.infos.push({ x: prodStartX + bw, y: panelY + 6, text: '生产', color: '#aaaaaa', size: 14, align: 'center' });

    const prodTypes = [ProductionType.GoldMine, ProductionType.EnergyTower];

    for (let i = 0; i < prodTypes.length; i++) {
      const ptype = prodTypes[i]!;
      const pconfig = PRODUCTION_CONFIGS[ptype];
      if (!pconfig) continue;

      const cx = prodStartX + i * (bw + UISystem.BTN_GAP) + bw / 2;
      const canAfford = this.getGold() >= pconfig.cost;

      this.renderer.push({
        shape: 'rect',
        x: cx, y: btnY + bh / 2,
        size: bw, h: bh,
        color: canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: cx - bw / 2, y: btnY, w: bw, h: bh,
        label: `${pconfig.name}\n${pconfig.cost}G`,
        color: '#37474f',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: available && canAfford,
        onClick: () => {
          if (available && canAfford && this.onStartDrag) {
            this.onStartDrag('production', undefined, undefined, ptype);
          }
        },
      });
    }

    // ---- Divider ----
    const divX3 = prodStartX + 2 * (bw + UISystem.BTN_GAP) - UISystem.BTN_GAP + 10;
    this.renderer.push({
      shape: 'rect',
      x: divX3, y: btnY + bh / 2,
      size: 2, h: bh + 16,
      color: '#444444',
      alpha: 1,
    });

    // ---- Selected entity info (bitecs stores) ----
    this.infos.push({ x: divX3 + 80, y: panelY + 6, text: '选中信息', color: '#aaaaaa', size: 14, align: 'center' });

    if (this.selectedEntityId !== null) {
      const id = this.selectedEntityId;
      const infoX = divX3 + 20;

      if (this.selectedEntityType === 'tower') {
        const towerTypeVal = Tower.towerType[id];
        const atkDamage = Attack.damage[id];
        const hpCurrent = Health.current[id];
        const hpMax = Health.max[id];

        if (towerTypeVal !== undefined) {
          const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal];
          const cfg = towerTypeEnum ? TOWER_CONFIGS[towerTypeEnum] : undefined;
          const towerLevel = Tower.level[id] ?? 1;

          if (cfg) {
            this.infos.push({ x: infoX, y: btnY + 26, text: `${cfg.name} Lv.${towerLevel}`, color: '#ffffff', size: 20 });

            const displayHp = hpCurrent !== undefined && hpMax !== undefined ? Math.ceil(hpCurrent) : cfg.hp;
            const displayMax = hpMax !== undefined ? hpMax : cfg.hp;
            const displayAtk = atkDamage !== undefined ? atkDamage : cfg.atk;
            this.infos.push({ x: infoX, y: btnY + 50, text: `HP: ${displayHp}/${displayMax} ATK: ${displayAtk}`, color: '#ffffff', size: 16 });

            if (hpCurrent !== undefined && hpMax !== undefined && hpMax > 0) {
              const ratio = hpCurrent / hpMax;
              const barW2 = 160;
              this.renderer.push({ shape: 'rect', x: infoX + barW2 / 2, y: btnY + 68, size: barW2, h: 8, color: '#222222', alpha: 0.9 });
              const fillW = Math.max(barW2 * ratio, 0);
              const barColor = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ffc107' : '#f44336';
              if (fillW > 0) {
                this.renderer.push({ shape: 'rect', x: infoX + fillW / 2, y: btnY + 68, size: fillW, h: 8, color: barColor, alpha: 0.95 });
              }
            }
          }
        }
      } else if (this.selectedEntityType === 'unit') {
        const hpCurrent = Health.current[id];
        const hpMax = Health.max[id];
        const atkDamage = Attack.damage[id];
        const unitCost = UnitTag.cost[id];

        // Use available bitecs data — unitType config lookup not available in bitecs
        if (unitCost !== undefined) {
          // Try to identify unit type by config lookup (reverse lookup from cost)
          let unitName = '单位';
          let cfgHp = 150;
          let cfgAtk = 15;

          for (const utype of unitTypes) {
            const uc = UNIT_CONFIGS[utype];
            if (uc && Math.abs(uc.cost - unitCost) < 1) {
              unitName = uc.name;
              cfgHp = uc.hp;
              cfgAtk = uc.atk;
              break;
            }
          }

          this.infos.push({ x: infoX, y: btnY + 26, text: unitName, color: '#ffffff', size: 20 });

          const displayHp = hpCurrent !== undefined && hpMax !== undefined ? Math.ceil(hpCurrent) : cfgHp;
          const displayMax = hpMax !== undefined ? hpMax : cfgHp;
          const displayAtk = atkDamage !== undefined ? atkDamage : cfgAtk;
          this.infos.push({ x: infoX, y: btnY + 50, text: `HP: ${displayHp}/${displayMax} ATK: ${displayAtk}`, color: '#ffffff', size: 16 });
        }
      } else if (this.selectedEntityType === 'trap') {
        const trapDps = Trap.damagePerSecond[id];
        const trapRadius = Trap.radius[id];

        if (trapDps !== undefined && trapRadius !== undefined) {
          this.infos.push({ x: infoX, y: btnY + 26, text: '地刺', color: '#ffffff', size: 20 });
          this.infos.push({ x: infoX, y: btnY + 50, text: `DPS: ${trapDps}  范围: ${trapRadius}px`, color: '#ffffff', size: 16 });
        }
      }
    }
  }

  // ============================================================
  // Entity Tooltip (above selected entity)
  // ============================================================

  private buildEntityTooltip(): void {
    const id = this.selectedEntityId;
    if (id === null) return;

    const px = Position.x[id];
    const py = Position.y[id];
    if (px === undefined) return;

    const tw = 230;
    const th = 110;
    const tx = px;
    const ty = py - 110;

    this.renderer.push({
      shape: 'rect',
      x: tx, y: ty,
      size: tw, h: th,
      color: '#1a1a2e',
      alpha: 0.9,
      stroke: '#555555',
      strokeWidth: 1,
    });

    if (this.selectedEntityType === 'tower') {
      const towerTypeVal = Tower.towerType[id];
      const atkDamage = Attack.damage[id];
      const hpCurrent = Health.current[id];
      const hpMax = Health.max[id];

      if (towerTypeVal !== undefined) {
        const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal];
        const config = towerTypeEnum ? TOWER_CONFIGS[towerTypeEnum] : undefined;
        const towerLevel = Tower.level[id] ?? 1;

        if (config) {
          this.infos.push({
            x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
            text: `${config.name} Lv.${towerLevel}`,
            color: '#ffffff', size: 18,
          });
          this.infos.push({
            x: tx - tw / 2 + 10, y: ty - th / 2 + 36,
            text: `HP: ${hpCurrent !== undefined && hpMax !== undefined ? `${Math.ceil(hpCurrent)}/${hpMax}` : `${config.hp}/${config.hp}`}  ATK: ${atkDamage !== undefined ? atkDamage : config.atk}`,
            color: '#ffffff', size: 16,
          });

          // Upgrade button
          const isMaxLevel = towerLevel >= 5;
          const costIdx = towerLevel - 1;
          const upgradeCost = towerLevel <= config.upgradeCosts.length
            ? config.upgradeCosts[costIdx]
            : undefined;
          if (!isMaxLevel && upgradeCost !== undefined) {
            const canAfford = this.getGold() >= upgradeCost;
            const ubw = 55;
            const ubh = 20;
            const ubx = tx - tw / 2 + 10;
            const uby = ty - th / 2 + 52;
            this.renderer.push({
              shape: 'rect',
              x: ubx + ubw / 2, y: uby + ubh / 2,
              size: ubw, h: ubh,
              color: canAfford ? '#2e7d32' : '#555555',
              alpha: 0.9,
              stroke: '#ffffff', strokeWidth: 1,
            });
            this.buttons.push({
              x: ubx, y: uby, w: ubw, h: ubh,
              label: `${upgradeCost}G`,
              color: canAfford ? '#2e7d32' : '#555555',
              textColor: canAfford ? '#ffffff' : '#888888',
              enabled: canAfford,
              onClick: () => { if (this.onUpgradeTower) this.onUpgradeTower(id); },
            });
          }

          // Recycle button
          const totalInvested = Tower.totalInvested[id] ?? config.cost;
          const refund = Math.floor(totalInvested * 0.5);
          const rbw = 65;
          const rbh = 20;
          const rbx = tx + tw / 2 - rbw - 10;
          const rby = ty - th / 2 + 52;
          this.renderer.push({
            shape: 'rect',
            x: rbx + rbw / 2, y: rby + rbh / 2,
            size: rbw, h: rbh,
            color: '#c62828',
            alpha: 0.9,
            stroke: '#ffffff', strokeWidth: 1,
          });
          this.buttons.push({
            x: rbx, y: rby, w: rbw, h: rbh,
            label: `回收${refund}G`,
            color: '#c62828',
            textColor: '#ffffff',
            enabled: true,
            onClick: () => { this.onRecycleEntity?.(id); },
          });

          // HP bar
          if (hpCurrent !== undefined && hpMax !== undefined && hpMax > 0) {
            const ratio = hpCurrent / hpMax;
            const barX = tx - tw / 2 + 10;
            const barW = 120;
            this.renderer.push({ shape: 'rect', x: barX + barW / 2, y: ty + th / 2 - 12, size: barW, h: 6, color: '#222222', alpha: 0.9 });
            const fillW = Math.max(barW * ratio, 0);
            if (fillW > 0) {
              const barColor = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ffc107' : '#f44336';
              this.renderer.push({ shape: 'rect', x: barX + fillW / 2, y: ty + th / 2 - 12, size: fillW, h: 6, color: barColor, alpha: 0.95 });
            }
          }
        }
      }
    } else if (this.selectedEntityType === 'unit') {
      const hpCurrent = Health.current[id];
      const hpMax = Health.max[id];
      const atkDamage = Attack.damage[id];
      const unitCost = UnitTag.cost[id];

      if (unitCost !== undefined) {
        let unitName = '单位';
        let cfgHp = 150;
        let cfgAtk = 15;

        for (const utype of [UnitType.ShieldGuard, UnitType.Swordsman]) {
          const uc = UNIT_CONFIGS[utype];
          if (uc && Math.abs(uc.cost - unitCost) < 1) {
            unitName = uc.name;
            cfgHp = uc.hp;
            cfgAtk = uc.atk;
            break;
          }
        }

        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
          text: unitName,
          color: '#ffffff', size: 18,
        });
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 36,
          text: `HP: ${hpCurrent !== undefined && hpMax !== undefined ? `${Math.ceil(hpCurrent)}/${hpMax}` : `${cfgHp}/${cfgHp}`}  ATK: ${atkDamage !== undefined ? atkDamage : cfgAtk}`,
          color: '#ffffff', size: 16,
        });

        // Recycle button
        const refund = Math.floor(unitCost * 0.5);
        const rbw = 65;
        const rbh = 20;
        const rbx = tx - tw / 2 + 10;
        const rby = ty - th / 2 + 52;
        this.renderer.push({
          shape: 'rect',
          x: rbx + rbw / 2, y: rby + rbh / 2,
          size: rbw, h: rbh,
          color: '#c62828',
          alpha: 0.9,
          stroke: '#ffffff', strokeWidth: 1,
        });
        this.buttons.push({
          x: rbx, y: rby, w: rbw, h: rbh,
          label: `回收${refund}G`,
          color: '#c62828',
          textColor: '#ffffff',
          enabled: true,
          onClick: () => { this.onRecycleEntity?.(id); },
        });
      }
    } else if (this.selectedEntityType === 'trap') {
      const trapDps = Trap.damagePerSecond[id];
      const trapRadius = Trap.radius[id];

      if (trapDps !== undefined && trapRadius !== undefined) {
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
          text: '地刺',
          color: '#ffffff', size: 18,
        });
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 36,
          text: `DPS: ${trapDps}  范围: ${trapRadius}px`,
          color: '#ffffff', size: 16,
        });

        const refund = 20;
        const rbw = 65;
        const rbh = 20;
        const rbx = tx - tw / 2 + 10;
        const rby = ty - th / 2 + 52;
        this.renderer.push({
          shape: 'rect',
          x: rbx + rbw / 2, y: rby + rbh / 2,
          size: rbw, h: rbh,
          color: '#c62828',
          alpha: 0.9,
          stroke: '#ffffff', strokeWidth: 1,
        });
        this.buttons.push({
          x: rbx, y: rby, w: rbw, h: rbh,
          label: `回收${refund}G`,
          color: '#c62828',
          textColor: '#ffffff',
          enabled: true,
          onClick: () => { this.onRecycleEntity?.(id); },
        });
      }
    }
  }

  // ============================================================
  // Enemy Tooltip
  // ============================================================

  private buildEnemyTooltip(): void {
    const id = this.enemyEntityId;
    if (id === null) return;

    const px = Position.x[id];
    const py = Position.y[id];
    const hpCurrent = Health.current[id];
    const hpMax = Health.max[id];
    const moveSpeed = Movement.speed[id];
    const isBoss = UnitTag.isBoss[id] === 1;

    if (px === undefined) return;

    const tw = 200;
    const th = 100;
    const tx = px;
    const ty = py - 100;

    this.renderer.push({
      shape: 'rect',
      x: tx, y: ty,
      size: tw, h: th,
      color: '#1a1a2e',
      alpha: 0.9,
      stroke: '#e53935',
      strokeWidth: 1,
    });

    const enemyName = isBoss ? 'Boss' : '敌人';
    this.infos.push({
      x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
      text: enemyName,
      color: '#ef5350', size: 18,
    });

    if (hpCurrent !== undefined && hpMax !== undefined) {
      this.infos.push({
        x: tx - tw / 2 + 10, y: ty - th / 2 + 36,
        text: `HP: ${Math.ceil(hpCurrent)}/${hpMax}`,
        color: '#ffffff', size: 16,
      });
    }

    if (moveSpeed !== undefined) {
      this.infos.push({
        x: tx - tw / 2 + 10, y: ty - th / 2 + 56,
        text: `速度: ${moveSpeed}`,
        color: '#ffffff', size: 16,
      });
    }

    if (isBoss) {
      const bossPhase = Boss.phase[id];
      const bossTimer = Boss.transitionTimer[id];
      if (bossPhase !== undefined) {
        const phaseText = bossPhase === 2 ? '形态 2' : bossTimer && bossTimer > 0 ? '转换中...' : '形态 1';
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 76,
          text: phaseText,
          color: '#aaaaaa', size: 16,
        });
      }
    }
  }

  // ============================================================
  // Drag Ghost (unchanged — no component access)
  // ============================================================

  private buildDragGhost(): void {
    const ds = this.getDragState?.();
    if (!ds || !ds.active) return;
    const ptr = this.getPointerPosition?.();
    if (!ptr) return;

    let color = '#ffffff';
    let shape: ShapeType = 'circle';
    let size = 32;
    let label = '';

    switch (ds.entityType) {
      case 'tower': {
        const tt = ds.towerType ?? this.getSelectedTower();
        if (tt) {
          const cfg = TOWER_CONFIGS[tt];
          if (cfg) {
            color = cfg.color;
            shape = 'circle';
            size = 32;
            label = cfg.name;
          }
        }
        break;
      }
      case 'unit': {
        const ut = ds.unitType;
        if (ut) {
          const cfg = UNIT_CONFIGS[ut];
          if (cfg) {
            color = cfg.color;
            shape = 'circle';
            size = cfg.size;
            label = cfg.name;
          }
        }
        break;
      }
      case 'production': {
        const pt = ds.productionType;
        if (pt) {
          const cfg = PRODUCTION_CONFIGS[pt];
          if (cfg) {
            color = cfg.color;
            shape = 'circle';
            size = 30;
            label = cfg.name;
          }
        }
        break;
      }
      case 'trap': {
        color = '#e53935';
        shape = 'triangle';
        size = 24;
        label = '陷阱';
        break;
      }
    }

    this.renderer.push({
      shape,
      x: ptr.x, y: ptr.y,
      size,
      color,
      alpha: 0.5,
      label,
      labelColor: '#ffffff',
      labelSize: 14,
    });
  }

  // ============================================================
  // Overlays (Victory / Defeat)
  // ============================================================

  private buildOverlay(phase: GamePhase): void {
    if (phase === GamePhase.Victory) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.renderer.push({
        shape: 'rect', x: 1920 / 2, y: 1080 / 2,
        size: 1600, h: 400, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#4caf50', title: '胜利!', subtext: '刷新页面重新开始' };
    } else if (phase === GamePhase.Defeat) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.renderer.push({
        shape: 'rect', x: 1920 / 2, y: 1080 / 2,
        size: 1600, h: 400, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#f44336', title: '失败!', subtext: '刷新页面重新开始' };
    }
  }

  // ============================================================
  // Pause Overlay
  // ============================================================

  private buildPauseOverlay(): void {
    const mapCenterX = RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2;
    const mapCenterY = RenderSystem.sceneOffsetY + RenderSystem.sceneH / 2;

    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: mapCenterY,
      size: RenderSystem.sceneW,
      h: RenderSystem.sceneH,
      color: '#000000',
      alpha: 0.6,
    });

    const menuW = 500;
    const menuH = 380;
    const menuX = mapCenterX - menuW / 2;
    const menuY = mapCenterY - menuH / 2;

    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: mapCenterY,
      size: menuW,
      h: menuH,
      color: '#1a1a2e',
      alpha: 0.95,
      stroke: '#555555',
      strokeWidth: 2,
    });

    this.infos.push({
      x: mapCenterX,
      y: menuY + 50,
      text: '游 戏 暂 停',
      color: '#ffffff',
      size: 40,
      align: 'center',
    });

    const btnW = 200;
    const btnH = 50;
    const btnX = mapCenterX - btnW / 2;

    const continueY = menuY + 110;
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: continueY + btnH / 2,
      size: btnW,
      h: btnH,
      color: '#2e7d32',
      alpha: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1,
    });
    this.buttons.push({
      x: btnX, y: continueY, w: btnW, h: btnH,
      label: '继 续',
      color: '#2e7d32',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onResume?.(); },
    });

    const restartY = menuY + 180;
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: restartY + btnH / 2,
      size: btnW,
      h: btnH,
      color: '#f9a825',
      alpha: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1,
    });
    this.buttons.push({
      x: btnX, y: restartY, w: btnW, h: btnH,
      label: '重新开始',
      color: '#f9a825',
      textColor: '#000000',
      enabled: true,
      onClick: () => { this.onRestart?.(); },
    });

    const exitY = menuY + 250;
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: exitY + btnH / 2,
      size: btnW,
      h: btnH,
      color: '#c62828',
      alpha: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1,
    });
    this.buttons.push({
      x: btnX, y: exitY, w: btnW, h: btnH,
      label: '退 出',
      color: '#c62828',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onExit?.(); },
    });

    const wave = this.getWave();
    const total = this.getTotalWaves();
    this.infos.push({
      x: mapCenterX,
      y: menuY + 320,
      text: total === -1 ? `当前波次: ${wave}` : `当前波次: ${wave} / ${total}`,
      color: '#aaaaaa',
      size: 24,
      align: 'center',
    });
  }

  // ============================================================
  // Input — button hit-testing (unchanged)
  // ============================================================

  handleClick(x: number, y: number): boolean {
    for (const btn of this.buttons) {
      const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;
      if (enabled && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.onClick();
        return true;
      }
    }
    return false;
  }
}
