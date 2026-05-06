import { System, GamePhase, TowerType } from '../types/index.js';
import { World } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { TOWER_CONFIGS } from '../data/gameData.js';

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
  ) {}

  /** Build UI data + push shape commands to buffer */
  update(_entities: number[], _dt: number): void {
    const phase = this.getPhase();
    this.buttons = [];
    this.infos = [];
    this.overlay = null;

    this.buildTopHUD(phase);
    this.buildLeftPanel(phase);
    this.buildOverlay(phase);
  }

  /** Draw text UI on top (called AFTER endFrame) */
  renderUI(): void {
    const ctx = this.renderer.context;

    // Draw button labels
    for (const btn of this.buttons) {
      this.drawButton(btn);
    }

    // Draw info text
    for (const info of this.infos) {
      ctx.save();
      ctx.fillStyle = info.color;
      ctx.font = `${info.size}px monospace`;
      ctx.textAlign = info.align ?? 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.text, info.x, info.y);
      ctx.restore();
    }

    // Draw overlay text
    if (this.overlay) {
      const cx = 1920 / 2;
      const cy = 1080 / 2;
      ctx.save();
      ctx.fillStyle = this.overlay.color;
      ctx.font = 'bold 60px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.overlay.title, cx, cy);
      ctx.font = '28px monospace';
      ctx.fillText(this.overlay.subtext, cx, cy + 50);
      ctx.restore();
    }
  }

  private drawButton(btn: UIButton): void {
    const ctx = this.renderer.context;
    const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;

    // Draw label (split by \n)
    const lines = btn.label.split('\n');
    const lineH = 24;
    const startY = btn.y + btn.h / 2 - ((lines.length - 1) * lineH) / 2;

    ctx.save();
    ctx.fillStyle = enabled ? btn.textColor : '#888888';
    ctx.font = '20px monospace';
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
    const wave = this.getWave();
    const total = this.getTotalWaves();
    const waveActive = this.getWaveActive();

    this.infos.push({
      x: 20, y: UISystem.TOP_H / 2,
      text: `金币: ${gold}`, color: '#ffd54f', size: 26,
    });

    const phaseLabels: Record<GamePhase, string> = {
      [GamePhase.Deployment]: '部署阶段',
      [GamePhase.Battle]: '战斗中...',
      [GamePhase.WaveBreak]: '波次结束',
      [GamePhase.Victory]: '胜利!',
      [GamePhase.Defeat]: '失败!',
    };
    this.infos.push({
      x: 200, y: UISystem.TOP_H / 2,
      text: phaseLabels[phase], color: '#ffffff', size: 22,
    });

    this.infos.push({
      x: 1920 - 300, y: UISystem.TOP_H / 2,
      text: `波次 ${wave} / ${total}`, color: '#ffffff', size: 26,
    });

    const canStart = (phase === GamePhase.Deployment || phase === GamePhase.WaveBreak) && !waveActive;
    const btnX = 1920 - 150;
    const btnY = 8;
    const btnW = 130;
    const btnH = 44;

    // Push button background
    this.renderer.push({
      shape: 'rect',
      x: btnX + btnW / 2, y: btnY + btnH / 2,
      size: btnW,
      color: canStart ? '#2e7d32' : '#555555',
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
    });

    this.buttons.push({
      x: btnX, y: btnY, w: btnW, h: btnH,
      label: phase === GamePhase.WaveBreak ? '下一波' : '开始',
      color: canStart ? '#2e7d32' : '#555555',
      textColor: '#ffffff',
      enabled: canStart,
      onClick: () => { if (canStart) this.startWave(); },
    });
  }

  private buildLeftPanel(phase: GamePhase): void {
    const selected = this.getSelectedTower();
    const towerTypes = [TowerType.Arrow];
    const panelX = 10;
    let panelY = UISystem.TOP_H + 20;

    for (const type of towerTypes) {
      const config = TOWER_CONFIGS[type];
      if (!config) continue;

      const isSelected = selected === type;
      const canAfford = this.getGold() >= config.cost;
      const available = phase === GamePhase.Deployment || phase === GamePhase.WaveBreak;
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
          shape: 'diamond',
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

    if (selected) {
      const config = TOWER_CONFIGS[selected];
      if (config) {
        this.infos.push({ x: 10, y: panelY + 10, text: `ATK: ${config.atk}`, color: '#ffffff', size: 18 });
        this.infos.push({ x: 10, y: panelY + 28, text: `范围: ${config.range}px`, color: '#ffffff', size: 18 });
        this.infos.push({ x: 10, y: panelY + 46, text: `攻速: ${config.attackSpeed}/s`, color: '#ffffff', size: 18 });
      }
    }
  }

  private buildOverlay(phase: GamePhase): void {
    if (phase === GamePhase.Victory) {
      this.renderer.push({
        shape: 'rect', x: 1920 / 2, y: 1080 / 2,
        size: 800, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#4caf50', title: '胜利!', subtext: '刷新页面重新开始' };
    } else if (phase === GamePhase.Defeat) {
      this.renderer.push({
        shape: 'rect', x: 1920 / 2, y: 1080 / 2,
        size: 800, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#f44336', title: '失败!', subtext: '刷新页面重新开始' };
    }
  }

  // ---- Input ----

  handleClick(x: number, y: number): void {
    for (const btn of this.buttons) {
      const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;
      if (enabled && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.onClick();
        return;
      }
    }
  }
}
