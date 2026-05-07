import { System, GamePhase, TowerType, UnitType, ProductionType, CType } from '../types/index.js';
import { World } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS } from '../data/gameData.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Health } from '../components/Health.js';

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

export class UISystem implements System {
  readonly name = 'UISystem';
  readonly requiredComponents = [] as const;

  private static readonly TOP_H = 60;
  private static readonly LEFT_W = 160;

  private buttons: UIButton[] = [];
  private infos: UIInfo[] = [];
  private overlay: UIOverlay | null = null;

  /** Currently selected tower entity on the map (for range preview + info panel) */
  public selectedTowerEntityId: number | null = null;

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
    private onDeployUnit: ((unitType: UnitType) => void) | null = null,
    private onSelectProduction: ((type: ProductionType) => void) | null = null,
    private onSelectTrap: (() => void) | null = null,
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
  ) {}

  /** Build UI data + push shape commands to buffer */
  update(_entities: number[], _dt: number): void {
    const phase = this.getPhase();
    this.buttons = [];
    this.infos = [];
    this.overlay = null;

    if (this.isPaused?.()) {
      this.buildTopHUD(phase);
      this.buildPauseOverlay();
      return;
    }

    if (this.selectedTowerEntityId !== null) {
      this.drawRangePreview();
      this.drawTowerInfoPanel();
    }

    this.buildTopHUD(phase);
    this.buildLeftPanel(phase);
    this.buildRightPanel(phase);
    this.buildOverlay(phase);
  }

  private drawRangePreview(): void {
    const id = this.selectedTowerEntityId;
    if (id === null) return;

    const pos = this.world.getComponent<Position>(id, CType.Position);
    const atk = this.world.getComponent<Attack>(id, CType.Attack);
    const tower = this.world.getComponent<Tower>(id, CType.Tower);
    if (!pos || !atk || !tower) return;

    const config = TOWER_CONFIGS[tower.towerType];
    const color = config?.color ?? '#ffffff';
    const diameter = atk.range * 2;

    // Fill circle
    this.renderer.push({
      shape: 'circle',
      x: pos.x, y: pos.y,
      size: diameter,
      color,
      alpha: 0.15,
    });
    // Stroke circle
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

  private drawTowerInfoPanel(): void {
    const id = this.selectedTowerEntityId;
    if (id === null) return;

    const tower = this.world.getComponent<Tower>(id, CType.Tower);
    const atk = this.world.getComponent<Attack>(id, CType.Attack);
    const health = this.world.getComponent<Health>(id, CType.Health);
    if (!tower || !atk) return;

    const config = TOWER_CONFIGS[tower.towerType];
    if (!config) return;

    const panelX = 160;
    const panelY = 940;
    const panelW = 1600;
    const panelH = 100;

    this.renderer.push({
      shape: 'rect',
      x: panelX + panelW / 2,
      y: panelY + panelH / 2,
      size: panelW,
      h: panelH,
      color: '#1a1a2e',
      alpha: 0.85,
      stroke: '#555555',
      strokeWidth: 1,
    });

    const nextLevel = tower.level + 1;
    const upgradeCostIdx = tower.level - 1;
    const upgradeCost = tower.level <= config.upgradeCosts.length
      ? config.upgradeCosts[upgradeCostIdx]
      : null;
    const isMaxLevel = tower.level >= 5;
    const canAfford = !isMaxLevel && upgradeCost !== undefined && upgradeCost !== null
      && this.getGold() >= upgradeCost;

    const infoLines: string[] = [
      `${config.name}  Lv.${tower.level}`,
      `ATK: ${atk.atk}  范围: ${atk.range}px  攻速: ${atk.attackSpeed.toFixed(1)}/s`,
      isMaxLevel ? '已满级' : `升级费用: ${upgradeCost}G`,
      `HP: ${health ? `${Math.ceil(health.current)}/${health.max}` : `${config.hp}/${config.hp}`}`,
    ];

    this.infos.push(
      ...infoLines.map((text, i) => ({
        x: panelX + 20,
        y: panelY + 18 + i * 22,
        text,
        color: '#ffffff',
        size: 22,
      })),
    );

    if (!isMaxLevel && upgradeCost !== undefined && upgradeCost !== null) {
      const btnW = 100;
      const btnH = 36;
      const btnX = panelX + panelW - btnW - 30;
      const btnY = panelY + panelH / 2 - btnH / 2;

      this.renderer.push({
        shape: 'rect',
        x: btnX + btnW / 2,
        y: btnY + btnH / 2,
        size: btnW,
        h: btnH,
        color: canAfford ? '#2e7d32' : '#555555',
        alpha: 0.9,
        stroke: '#ffffff',
        strokeWidth: 1,
      });

      this.buttons.push({
        x: btnX, y: btnY, w: btnW, h: btnH,
        label: '升级',
        color: canAfford ? '#2e7d32' : '#555555',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: canAfford,
        onClick: () => {
          if (this.onUpgradeTower) this.onUpgradeTower(id);
        },
      });
    }
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
    const wave = this.getWave();
    const total = this.getTotalWaves();

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

    const currentlyPaused = this.isPaused?.() ?? false;

    // Countdown display + skip button (hidden when paused)
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
        text: `波次 ${wave} / ${total}`, color: '#ffffff', size: 28,
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

  private buildLeftPanel(phase: GamePhase): void {
    const selected = this.getSelectedTower();
    const towerTypes = [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning];
    const panelX = 10;
    let panelY = UISystem.TOP_H + 20;

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
        onClick: () => this.selectTower(type),
      });

      panelY += 80;
    }

    // Tower info section — always reserved at y=410-500
    if (selected) {
      const config = TOWER_CONFIGS[selected];
      if (config) {
        const damageTypeLabel = config.damageType === 'physical' ? '物理' : '魔法';
        this.infos.push({ x: 10, y: 410, text: config.name, color: '#ffffff', size: 22 });
        this.infos.push({ x: 10, y: 428, text: `造价: ${config.cost}G`, color: '#ffd54f', size: 22 });
        this.infos.push({ x: 10, y: 446, text: `ATK: ${config.atk}`, color: '#ffffff', size: 22 });
        this.infos.push({ x: 10, y: 464, text: `范围: ${config.range}px`, color: '#ffffff', size: 22 });
        this.infos.push({ x: 10, y: 482, text: `攻速: ${config.attackSpeed}/s`, color: '#ffffff', size: 22 });
        this.infos.push({ x: 10, y: 500, text: `伤害: ${damageTypeLabel}`, color: '#ffffff', size: 22 });
      }
    }

    // Production section — always at fixed positions
    this.infos.push({ x: 10, y: 520, text: '--- 生产 ---', color: '#aaaaaa', size: 20 });

    const productionTypes = [ProductionType.GoldMine, ProductionType.EnergyTower];
    const prodPositions = [545, 625];

    for (let i = 0; i < productionTypes.length; i++) {
      const ptype = productionTypes[i]!;
      const pconfig = PRODUCTION_CONFIGS[ptype];
      if (!pconfig) continue;

      const canAfford = this.getGold() >= pconfig.cost;
      const available = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;
      const btnW = 140;
      const btnH = 60;
      const prodBtnY = prodPositions[i]!;

      this.renderer.push({
        shape: 'rect',
        x: panelX + btnW / 2, y: prodBtnY + btnH / 2,
        size: btnW,
        color: canAfford ? '#37474f' : '#444444',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: panelX, y: prodBtnY, w: btnW, h: btnH,
        label: `${pconfig.name}\n${pconfig.cost}G`,
        color: '#37474f',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: available && canAfford,
        onClick: () => {
          if (this.onSelectProduction) this.onSelectProduction(ptype);
        },
      });
    }

    // Trap button
    if (this.onSelectTrap) {
      const trapCost = 40;
      const trapAffordable = this.getGold() >= trapCost;
      const trapAvailable = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;
      const trapBtnW = 140;
      const trapBtnH = 60;
      const trapBtnY = 705;

      this.renderer.push({
        shape: 'rect',
        x: panelX + trapBtnW / 2, y: trapBtnY + trapBtnH / 2,
        size: trapBtnW,
        color: trapAffordable ? '#4a0000' : '#444444',
        alpha: 0.9,
        stroke: '#e53935', strokeWidth: 1,
      });

      this.buttons.push({
        x: panelX, y: trapBtnY, w: trapBtnW, h: trapBtnH,
        label: `尖刺陷阱\n${trapCost}G`,
        color: '#4a0000',
        textColor: trapAffordable ? '#ffffff' : '#888888',
        enabled: trapAvailable && trapAffordable,
        onClick: () => this.onSelectTrap?.(),
      });
    }
  }

  private buildRightPanel(phase: GamePhase): void {
    const unitTypes = [UnitType.ShieldGuard, UnitType.Swordsman];
    const panelX = 1780;
    let panelY = 80;
    const btnW = 135;
    const btnH = 70;

    this.infos.push({
      x: panelX + btnW / 2, y: panelY - 10,
      text: '部署单位', color: '#ffffff', size: 22, align: 'center',
    });
    panelY += 20;

    for (const utype of unitTypes) {
      const config = UNIT_CONFIGS[utype];
      if (!config) continue;

      const canAffordGold = this.getGold() >= config.cost;
      const hasPop = this.getPopulation() + config.popCost <= this.getMaxPopulation();
      const available = (phase !== GamePhase.Victory && phase !== GamePhase.Defeat)
        && canAffordGold && hasPop;
      const canAfford = canAffordGold && hasPop;

      this.renderer.push({
        shape: 'rect',
        x: panelX + btnW / 2, y: panelY + btnH / 2,
        size: btnW,
        h: btnH,
        color: canAfford ? '#37474f' : '#444444',
        alpha: 0.85,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: panelX, y: panelY, w: btnW, h: btnH,
        label: `${config.name}\n${config.cost}G | 人口${config.popCost}`,
        color: '#37474f',
        textColor: canAfford ? '#ffffff' : '#888888',
        enabled: available,
        onClick: () => {
          if (this.onDeployUnit) this.onDeployUnit(utype);
        },
      });

      panelY += btnH + 15;
    }
  }

  private buildOverlay(phase: GamePhase): void {
    if (phase === GamePhase.Victory) {
      this.selectedTowerEntityId = null;
      this.renderer.push({
        shape: 'rect', x: 1920 / 2, y: 1080 / 2,
        size: 1600, h: 400, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#4caf50', title: '胜利!', subtext: '刷新页面重新开始' };
    } else if (phase === GamePhase.Defeat) {
      this.selectedTowerEntityId = null;
      this.renderer.push({
        shape: 'rect', x: 1920 / 2, y: 1080 / 2,
        size: 1600, h: 400, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#f44336', title: '失败!', subtext: '刷新页面重新开始' };
    }
  }

  private buildPauseOverlay(): void {
    const mapLeft = 160;
    const mapRight = 1780;
    const mapTop = 60;
    const mapBottom = 940;
    const mapCenterX = (mapLeft + mapRight) / 2;
    const mapCenterY = (mapTop + mapBottom) / 2;

    // Semi-transparent dark backdrop covering map area
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: mapCenterY,
      size: mapRight - mapLeft,
      h: mapBottom - mapTop,
      color: '#000000',
      alpha: 0.6,
    });

    // Menu box
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

    // Title
    this.infos.push({
      x: mapCenterX,
      y: menuY + 50,
      text: '游 戏 暂 停',
      color: '#ffffff',
      size: 40,
      align: 'center',
    });

    // Buttons
    const btnW = 200;
    const btnH = 50;
    const btnX = mapCenterX - btnW / 2;

    // Continue button
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

    // Restart button
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

    // Exit button
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

    // Wave info
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
