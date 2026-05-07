import { System, GamePhase, TowerType, UnitType, ProductionType, CType, type ShapeType } from '../types/index.js';
import { World } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS, ENEMY_CONFIGS } from '../data/gameData.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Health } from '../components/Health.js';
import { Enemy } from '../components/Enemy.js';
import { Unit } from '../components/Unit.js';

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

export class UISystem implements System {
  readonly name = 'UISystem';
  readonly requiredComponents = [] as const;

  private static readonly TOP_H = 60;
  private static readonly LEFT_W = 160;
  private static readonly BOTTOM_Y = 900;
  private static readonly BOTTOM_H = 180;

  private buttons: UIButton[] = [];
  private infos: UIInfo[] = [];
  private overlay: UIOverlay | null = null;

  /** Currently selected entity on the map (tower or unit) */
  public selectedEntityId: number | null = null;
  public selectedEntityType: 'tower' | 'unit' | null = null;

  /** Enemy tooltip */
  public enemyEntityId: number | null = null;
  private enemySelectTimer: number = 0;

  /** Select an enemy for info tooltip, deselects after 3s */
  selectEnemy(id: number): void {
    this.selectedEntityId = null;
    this.selectedEntityType = null;
    this.enemyEntityId = id;
    this.enemySelectTimer = 3;
  }

  constructor(
    private world: World,
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
  ) {}

  get selectedTowerEntityId(): number | null {
    return this.selectedEntityType === 'tower' ? this.selectedEntityId : null;
  }
  set selectedTowerEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'tower' : null;
  }

  /** Build UI data + push shape commands to buffer */
  update(_entities: number[], dt: number): void {
    const phase = this.getPhase();
    this.buttons = [];
    this.infos = [];
    this.overlay = null;

    // Enemy tooltip timer
    if (this.enemyEntityId !== null) {
      this.enemySelectTimer -= dt;
      if (this.enemySelectTimer <= 0) {
        this.enemyEntityId = null;
      }
    }

    if (this.isPaused?.()) {
      this.buildTopHUD(phase);
      this.buildPauseOverlay();
      return;
    }

    if (this.selectedEntityId !== null && this.selectedEntityType === 'tower') {
      this.drawRangePreview();
    }

    this.buildTopHUD(phase);
    this.buildLeftPanel(phase);
    this.buildBottomPanel(phase);
    this.buildOverlay(phase);

    // Tooltips
    if (this.selectedEntityId !== null) {
      this.buildEntityTooltip();
    }
    if (this.enemyEntityId !== null) {
      this.buildEnemyTooltip();
    }

    // Drag ghost
    this.buildDragGhost();
  }

  private drawRangePreview(): void {
    const id = this.selectedEntityId;
    if (id === null || this.selectedEntityType !== 'tower') return;

    const pos = this.world.getComponent<Position>(id, CType.Position);
    const atk = this.world.getComponent<Attack>(id, CType.Attack);
    const tower = this.world.getComponent<Tower>(id, CType.Tower);
    if (!pos || !atk || !tower) return;

    const config = TOWER_CONFIGS[tower.towerType];
    const color = config?.color ?? '#ffffff';
    const diameter = atk.range * 2;

    this.renderer.push({
      shape: 'circle',
      x: pos.x, y: pos.y,
      size: diameter,
      color,
      alpha: 0.15,
    });
    this.renderer.push({
      shape: 'circle',
      x: pos.x, y: pos.y,
      size: diameter,
      color,
      alpha: 0.4,
      stroke: color,
      strokeWidth: 2,
    });
  }

  /** Draw text UI on top (called AFTER endFrame) */
  renderUI(): void {
    const ctx = this.renderer.context;

    for (const btn of this.buttons) {
      this.drawButton(btn);
    }

    for (const info of this.infos) {
      ctx.save();
      ctx.fillStyle = info.color;
      ctx.font = `${info.size}px monospace`;
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
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.overlay.title, cx, cy);
      ctx.font = '32px monospace';
      ctx.fillText(this.overlay.subtext, cx, cy + 50);
      ctx.restore();
    }
  }

  private drawButton(btn: UIButton): void {
    const ctx = this.renderer.context;
    const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;

    const lines = btn.label.split('\n');
    const lineH = 24;
    const startY = btn.y + btn.h / 2 - ((lines.length - 1) * lineH) / 2;

    ctx.save();
    ctx.fillStyle = enabled ? btn.textColor : '#888888';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, btn.x + btn.w / 2, startY + i * lineH);
    }
    ctx.restore();
  }

  // ---- Build UI Data ----

  private buildTopHUD(phase: GamePhase): void {
    const gold = this.getGold();
    const energy = this.getEnergy();
    const population = this.getPopulation();
    const maxPop = this.getMaxPopulation();

    this.renderer.push({
      shape: 'rect',
      x: 960, y: 30,
      size: 1920, h: 60,
      color: '#0d1b2a',
      alpha: 0.85,
    });

    this.infos.push({
      x: 20, y: UISystem.TOP_H / 2,
      text: `💰${gold}  ⚡${energy}  👥${population}/${maxPop}`,
      color: '#ffd54f', size: 30,
    });

    if (this.isEndlessMode?.()) {
      const score = this.getEndlessScore?.() ?? 0;
      const wave = this.getWave();
      this.infos.push({
        x: 960, y: UISystem.TOP_H / 2,
        text: `♾ 第 ${wave} 波  ⭐ ${score}`,
        color: '#ffd54f', size: 28,
      });
    }

    const phaseLabels: Record<GamePhase, string> = {
      [GamePhase.Deployment]: '部署阶段',
      [GamePhase.Battle]: '战斗中...',
      [GamePhase.WaveBreak]: '波次结束',
      [GamePhase.Victory]: '胜利!',
      [GamePhase.Defeat]: '失败!',
    };
    this.infos.push({
      x: 200, y: UISystem.TOP_H / 2,
      text: phaseLabels[phase], color: '#ffffff', size: 26,
    });

    // Wave enemy counter — during Battle phase
    if (phase === GamePhase.Battle) {
      const alive = this.world.query(CType.Enemy).length;
      const total = this.getTotalSpawned?.() ?? 0;
      this.infos.push({
        x: 960, y: UISystem.TOP_H / 2,
        text: `敌军: 存活 ${alive} / 总数 ${total}`,
        color: '#ef5350', size: 24,
        align: 'center',
      });
    }

    const currentlyPaused = this.isPaused?.() ?? false;

    if (!currentlyPaused && this.getCountdown && this.getCountdown() > 0) {
      const countdownVal = this.getCountdown();
      this.infos.push({
        x: 1420, y: UISystem.TOP_H / 2,
        text: `⏱ 下一波: ${countdownVal.toFixed(1)}s`,
        color: '#ffd54f', size: 26,
      });

      const skipBtnX = 1770;
      const skipBtnW = 60;
      const skipBtnH = 36;
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
        label: '▶立即',
        color: '#2e7d32',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onSkipCountdown?.(); },
      });
    } else if (!this.isEndlessMode?.()) {
      this.infos.push({
        x: 1550, y: UISystem.TOP_H / 2,
        text: `波次 ${this.getWave()} / ${this.getTotalWaves()}`, color: '#ffffff', size: 28,
      });
    }

    // Speed toggle button
    const speedBtnX = 1855;
    const speedBtnW = 36;
    const speedBtnH = 36;
    const speedBtnY = (UISystem.TOP_H - speedBtnH) / 2;
    const currentSpeed = this.getSpeed?.() ?? 1.0;
    const speedLabel = currentSpeed === 2.0 ? '2x' : '1x';
    const speedColor = currentSpeed === 2.0 ? '#c62828' : '#1565c0';

    this.renderer.push({
      shape: 'rect',
      x: speedBtnX + speedBtnW / 2, y: speedBtnY + speedBtnH / 2,
      size: speedBtnW, h: speedBtnH,
      color: speedColor,
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
    });

    this.buttons.push({
      x: speedBtnX, y: speedBtnY, w: speedBtnW, h: speedBtnH,
      label: speedLabel,
      color: speedColor,
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onToggleSpeed?.(); },
    });

    // Pause button
    const pauseBtnX = 1891;
    const pauseBtnW = 29;
    const pauseBtnH = 36;
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

  // ---- Left Panel (towers only) ----

  private buildLeftPanel(phase: GamePhase): void {
    const selected = this.getSelectedTower();
    const towerTypes = [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning];
    const panelX = 10;
    let panelY = UISystem.TOP_H + 20;

    // Panel background
    this.renderer.push({
      shape: 'rect',
      x: UISystem.LEFT_W / 2, y: (UISystem.TOP_H + (900 - UISystem.TOP_H)) / 2 + UISystem.TOP_H,
      size: UISystem.LEFT_W, h: 900 - UISystem.TOP_H,
      color: '#0d1b2a',
      alpha: 0.7,
    });

    this.infos.push({
      x: panelX + 70, y: panelY - 10,
      text: '防御塔', color: '#ffffff', size: 22, align: 'center',
    });
    panelY += 10;

    for (const type of towerTypes) {
      const config = TOWER_CONFIGS[type];
      if (!config) continue;

      const isSelected = selected === type;
      const canAfford = this.getGold() >= config.cost;
      const available = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;
      const btnW = 140;
      const btnH = 60;

      this.renderer.push({
        shape: 'rect',
        x: panelX + btnW / 2, y: panelY + btnH / 2,
        size: btnW,
        color: isSelected ? '#1e88e5' : canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      if (isSelected) {
        this.renderer.push({
          shape: 'circle',
          x: panelX + 28, y: panelY + 30,
          size: 18, color: config.color, alpha: 1,
        });
      }

      this.buttons.push({
        x: panelX, y: panelY, w: btnW, h: btnH,
        label: config.name, subLabel: `${config.cost}G`,
        color: isSelected ? '#1e88e5' : '#37474f',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: available,
        onClick: () => {
          this.selectTower(type);
          if (available && this.onStartDrag) {
            this.onStartDrag('tower', type);
          }
        },
      });

      panelY += 80;
    }

    // Tower info section
    if (selected) {
      const config = TOWER_CONFIGS[selected];
      if (config) {
        const damageTypeLabel = config.damageType === 'physical' ? '物理' : '魔法';
        this.infos.push({ x: 10, y: panelY + 5, text: config.name, color: '#ffffff', size: 22 });
        this.infos.push({ x: 10, y: panelY + 25, text: `造价: ${config.cost}G`, color: '#ffd54f', size: 20 });
        this.infos.push({ x: 10, y: panelY + 47, text: `ATK: ${config.atk}`, color: '#ffffff', size: 20 });
        this.infos.push({ x: 10, y: panelY + 69, text: `范围: ${config.range}px`, color: '#ffffff', size: 20 });
        this.infos.push({ x: 10, y: panelY + 91, text: `攻速: ${config.attackSpeed}/s`, color: '#ffffff', size: 20 });
        this.infos.push({ x: 10, y: panelY + 113, text: `伤害: ${damageTypeLabel}`, color: '#ffffff', size: 20 });
      }
    }
  }

  // ---- Bottom Panel (Production + Units + Traps) ----

  private buildBottomPanel(phase: GamePhase): void {
    const by = UISystem.BOTTOM_Y;
    const bh = UISystem.BOTTOM_H;
    const cy = by + bh / 2; // center y

    // Panel background
    this.renderer.push({
      shape: 'rect',
      x: 960, y: cy,
      size: 1920, h: bh,
      color: '#0d1b2a',
      alpha: 0.9,
    });

    const available = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;

    // --- Left: Production ---
    const prodTypes = [ProductionType.GoldMine, ProductionType.EnergyTower];
    const prodX = [130, 390];
    const btnW = 200;
    const btnH = 70;
    const btnY = cy - btnH / 2;

    this.infos.push({
      x: 20, y: by + 16,
      text: '生产建筑', color: '#aaaaaa', size: 18,
    });

    for (let i = 0; i < prodTypes.length; i++) {
      const ptype = prodTypes[i]!;
      const pconfig = PRODUCTION_CONFIGS[ptype];
      if (!pconfig) continue;

      const canAfford = this.getGold() >= pconfig.cost;
      const px = prodX[i]!;

      this.renderer.push({
        shape: 'rect',
        x: px, y: cy,
        size: btnW, h: btnH,
        color: canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: px - btnW / 2, y: btnY, w: btnW, h: btnH,
        label: `${pconfig.name} ${pconfig.cost}G`,
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

    // --- Center: Units ---
    const unitTypes = [UnitType.ShieldGuard, UnitType.Swordsman];
    const unitX = [760, 990];

    this.infos.push({
      x: 640, y: by + 16,
      text: '部署单位', color: '#aaaaaa', size: 18,
    });

    for (let i = 0; i < unitTypes.length; i++) {
      const utype = unitTypes[i]!;
      const uconfig = UNIT_CONFIGS[utype];
      if (!uconfig) continue;

      const canAffordGold = this.getGold() >= uconfig.cost;
      const hasPop = this.getPopulation() + uconfig.popCost <= this.getMaxPopulation();
      const canAfford = canAffordGold && hasPop;
      const ux = unitX[i]!;
      const ubw = 180;

      this.renderer.push({
        shape: 'rect',
        x: ux, y: cy,
        size: ubw, h: btnH,
        color: canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: ux - ubw / 2, y: btnY, w: ubw, h: btnH,
        label: `${uconfig.name} ${uconfig.cost}G`,
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
    const trapX = 1220;
    const trapW = 180;

    this.renderer.push({
      shape: 'rect',
      x: trapX, y: cy,
      size: trapW, h: btnH,
      color: trapAffordable ? '#4a0000' : '#444444',
      alpha: 0.9,
      stroke: '#e53935', strokeWidth: 1,
    });

    this.buttons.push({
      x: trapX - trapW / 2, y: btnY, w: trapW, h: btnH,
      label: `尖刺陷阱 ${trapCost}G`,
      color: '#4a0000',
      textColor: trapAffordable ? '#ffffff' : '#888888',
      enabled: available && trapAffordable,
      onClick: () => {
        if (available && trapAffordable && this.onStartDrag) {
          this.onStartDrag('trap');
        }
      },
    });

    // --- Right: Unit info ---
    if (this.selectedEntityId !== null && this.selectedEntityType === 'unit') {
      const unitComp = this.world.getComponent<Unit>(this.selectedEntityId, CType.Unit);
      const health = this.world.getComponent<Health>(this.selectedEntityId, CType.Health);
      const atk = this.world.getComponent<Attack>(this.selectedEntityId, CType.Attack);
      if (unitComp) {
        const cfg = UNIT_CONFIGS[unitComp.unitType];
        if (cfg) {
          const skillName = cfg.skillId === 'taunt' ? '嘲讽' : cfg.skillId === 'whirlwind' ? '旋风斩' : cfg.skillId;
          this.infos.push({ x: 1340, y: by + 30, text: `${cfg.name}`, color: '#ffffff', size: 24 });
          this.infos.push({ x: 1340, y: by + 55, text: `HP: ${health ? `${Math.ceil(health.current)}/${health.max}` : `${cfg.hp}/${cfg.hp}`}`, color: '#ffffff', size: 20 });
          this.infos.push({ x: 1340, y: by + 80, text: `ATK: ${atk ? atk.atk : cfg.atk}`, color: '#ffffff', size: 20 });
          this.infos.push({ x: 1340, y: by + 105, text: `技能: ${skillName}`, color: '#ffd54f', size: 20 });
          // HP bar
          if (health) {
            this.renderer.push({ shape: 'rect', x: 1340 + 50, y: by + 130, size: 100, h: 8, color: '#222222', alpha: 0.9 });
            const fillW = Math.max(100 * health.ratio, 0);
            if (fillW > 0) {
              this.renderer.push({ shape: 'rect', x: 1340 + fillW / 2, y: by + 130, size: fillW, h: 8, color: '#4caf50', alpha: 0.95 });
            }
          }
        }
      }
    }
  }

  // ---- Entity Tooltip (above selected tower/unit) ----

  private buildEntityTooltip(): void {
    const id = this.selectedEntityId;
    if (id === null) return;

    const pos = this.world.getComponent<Position>(id, CType.Position);
    if (!pos) return;

    const tw = 200;
    const th = 80;
    const tx = pos.x;
    const ty = pos.y - 90;

    // Background
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
      const tower = this.world.getComponent<Tower>(id, CType.Tower);
      const atk = this.world.getComponent<Attack>(id, CType.Attack);
      const health = this.world.getComponent<Health>(id, CType.Health);
      if (tower) {
        const config = TOWER_CONFIGS[tower.towerType];
        if (config) {
          this.infos.push({
            x: tx - tw / 2 + 10, y: ty - th / 2 + 16,
            text: `${config.name} Lv.${tower.level}`,
            color: '#ffffff', size: 20,
          });
          this.infos.push({
            x: tx - tw / 2 + 10, y: ty - th / 2 + 42,
            text: `HP: ${health ? `${Math.ceil(health.current)}/${health.max}` : `${config.hp}/${config.hp}`}  ATK: ${atk ? atk.atk : config.atk}`,
            color: '#ffffff', size: 18,
          });
          // Upgrade button
          const isMaxLevel = tower.level >= 5;
          const costIdx = tower.level - 1;
          const upgradeCost = tower.level <= config.upgradeCosts.length
            ? config.upgradeCosts[costIdx]
            : undefined;
          if (!isMaxLevel && upgradeCost !== undefined) {
            const canAfford = this.getGold() >= upgradeCost;
            const ubw = 50;
            const ubh = 22;
            const ubx = tx + tw / 2 - ubw - 8;
            const uby = ty - th / 2 + 6;
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
          // HP bar
          if (health) {
            this.renderer.push({ shape: 'rect', x: tx - tw / 2 + 10 + 40, y: ty + 10, size: 80, h: 6, color: '#222222', alpha: 0.9 });
            const fillW = Math.max(80 * health.ratio, 0);
            if (fillW > 0) {
              const barColor = health.ratio > 0.6 ? '#4caf50' : health.ratio > 0.3 ? '#ffc107' : '#f44336';
              this.renderer.push({ shape: 'rect', x: tx - tw / 2 + 10 + fillW / 2, y: ty + 10, size: fillW, h: 6, color: barColor, alpha: 0.95 });
            }
          }
        }
      }
    } else if (this.selectedEntityType === 'unit') {
      const unitComp = this.world.getComponent<Unit>(id, CType.Unit);
      const health = this.world.getComponent<Health>(id, CType.Health);
      const atk = this.world.getComponent<Attack>(id, CType.Attack);
      if (unitComp) {
        const cfg = UNIT_CONFIGS[unitComp.unitType];
        if (cfg) {
          this.infos.push({
            x: tx - tw / 2 + 10, y: ty - th / 2 + 16,
            text: cfg.name,
            color: '#ffffff', size: 20,
          });
          this.infos.push({
            x: tx - tw / 2 + 10, y: ty - th / 2 + 42,
            text: `HP: ${health ? `${Math.ceil(health.current)}/${health.max}` : `${cfg.hp}/${cfg.hp}`}  ATK: ${atk ? atk.atk : cfg.atk}`,
            color: '#ffffff', size: 18,
          });
        }
      }
    }
  }

  // ---- Enemy Tooltip ----

  private buildEnemyTooltip(): void {
    const id = this.enemyEntityId;
    if (id === null) return;

    const pos = this.world.getComponent<Position>(id, CType.Position);
    const enemy = this.world.getComponent<Enemy>(id, CType.Enemy);
    const health = this.world.getComponent<Health>(id, CType.Health);
    if (!pos || !enemy) return;

    const config = ENEMY_CONFIGS[enemy.enemyType];
    if (!config) return;

    const tw = 200;
    const th = 100;
    const tx = pos.x;
    const ty = pos.y - 100;

    this.renderer.push({
      shape: 'rect',
      x: tx, y: ty,
      size: tw, h: th,
      color: '#1a1a2e',
      alpha: 0.9,
      stroke: '#e53935',
      strokeWidth: 1,
    });

    this.infos.push({
      x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
      text: config.name,
      color: '#ef5350', size: 20,
    });
    this.infos.push({
      x: tx - tw / 2 + 10, y: ty - th / 2 + 36,
      text: `HP: ${health ? `${Math.ceil(health.current)}/${health.max}` : `${config.hp}/${config.hp}`}`,
      color: '#ffffff', size: 16,
    });
    this.infos.push({
      x: tx - tw / 2 + 10, y: ty - th / 2 + 56,
      text: `速度: ${config.speed}`,
      color: '#ffffff', size: 16,
    });
    if (config.description) {
      this.infos.push({
        x: tx - tw / 2 + 10, y: ty - th / 2 + 76,
        text: config.description,
        color: '#aaaaaa', size: 16,
      });
    }
  }

  // ---- Drag Ghost ----

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

  // ---- Overlays ----

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

  private buildPauseOverlay(): void {
    const mapLeft = 160;
    const mapRight = 1920;
    const mapTop = 60;
    const mapBottom = UISystem.BOTTOM_Y;
    const mapCenterX = (mapLeft + mapRight) / 2;
    const mapCenterY = (mapTop + mapBottom) / 2;

    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: mapCenterY,
      size: mapRight - mapLeft,
      h: mapBottom - mapTop,
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

  // ---- Input ----

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
