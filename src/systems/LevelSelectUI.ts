import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { LEVELS } from '../data/levels/index.js';
import { SaveManager } from '../utils/SaveManager.js';
import { LevelTheme } from '../types/index.js';

interface CardRect {
  x: number; y: number; w: number; h: number;
  levelId: number;
}

export class LevelSelectUI {
  private cards: CardRect[] = [];
  private saveData = SaveManager.load();

  private readonly CARD_W = 400;
  private readonly CARD_H = 280;
  private readonly CARD_GAP = 60;

  constructor(
    private renderer: Renderer,
    private onSelectLevel: (levelId: number) => void,
    private onStartEndless: () => void,
  ) {
    this.saveData = SaveManager.load();
    this.layoutCards();
  }

  refresh(): void {
    this.saveData = SaveManager.load();
  }

  get isEndlessUnlocked(): boolean {
    return this.saveData.unlockedLevels >= 3;
  }

  private layoutCards(): void {
    this.cards = [];

    const dw = LayoutManager.DESIGN_W;
    const totalTopW = 3 * this.CARD_W + 2 * this.CARD_GAP;
    const startTopX = (dw - totalTopW) / 2;
    const topY = 160;

    for (let i = 0; i < 3; i++) {
      this.cards.push({
        x: startTopX + i * (this.CARD_W + this.CARD_GAP),
        y: topY,
        w: this.CARD_W,
        h: this.CARD_H,
        levelId: i + 1,
      });
    }

    const totalBotW = 2 * this.CARD_W + this.CARD_GAP;
    const startBotX = (dw - totalBotW) / 2;
    const botY = 500;

    for (let i = 0; i < 2; i++) {
      this.cards.push({
        x: startBotX + i * (this.CARD_W + this.CARD_GAP),
        y: botY,
        w: this.CARD_W,
        h: this.CARD_H,
        levelId: i + 4,
      });
    }
  }

  update(_dt: number): void {
    this.cards = [];
    this.layoutCards();
    this.draw();
  }

  private draw(): void {
    // Full-viewport background
    const barLeft = LayoutManager.toDesignX(0);
    const barRight = LayoutManager.toDesignX(LayoutManager.viewportW);
    const bgCenterX = (barLeft + barRight) / 2;
    const bgWidth = barRight - barLeft;
    const bgHeight = LayoutManager.DESIGN_H;  // full design height

    this.renderer.push({
      shape: 'rect', x: bgCenterX, y: bgHeight / 2,
      size: bgWidth, color: '#0d1317', h: bgHeight, alpha: 1,
    });

    const dw = LayoutManager.DESIGN_W;

    this.renderer.push({
      shape: 'rect', x: dw / 2, y: 50,
      size: 400, color: 'transparent',
      label: '选择关卡', labelSize: 40, labelColor: '#ffd54f', h: 50,
    });

    for (const card of this.cards) {
      this.drawLevelCard(card);
    }

    this.drawEndlessButton();

    this.renderer.push({
      shape: 'rect', x: 170, y: 1030,
      size: 140, color: '#37474f', h: 40,
      label: '← 返回', labelSize: 14, labelColor: '#aaa',
    });
    this.renderer.push({
      shape: 'rect', x: 1750, y: 1030,
      size: 140, color: '#b71c1c', h: 40,
      label: '重置进度', labelSize: 14, labelColor: '#e0e0e0',
    });
  }

  private drawLevelCard(card: CardRect): void {
    const config = LEVELS[card.levelId - 1];
    if (!config) return;

    const unlocked = card.levelId <= this.saveData.unlockedLevels;
    const stars = this.saveData.levelStars[card.levelId] ?? 0;
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;

    this.renderer.push({
      shape: 'rect', x: cx, y: cy,
      size: card.w, color: unlocked ? '#1a2530' : '#121820',
      alpha: 0.92, h: card.h,
      stroke: unlocked ? '#455a64' : '#263238',
      strokeWidth: 2,
    });

    const themeColors: Record<LevelTheme, string> = {
      [LevelTheme.Plains]: '#7cb342',
      [LevelTheme.Desert]: '#e6c44d',
      [LevelTheme.Tundra]: '#90a4ae',
      [LevelTheme.Volcano]: '#ff5722',
      [LevelTheme.Castle]: '#546e7a',
    };
    this.renderer.push({
      shape: 'rect', x: cx, y: card.y + 8,
      size: card.w - 8, color: themeColors[config.theme], h: 12, alpha: 0.8,
    });

    this.renderer.push({
      shape: 'rect', x: cx, y: card.y + 50,
      size: 80, color: 'transparent',
      label: `第${card.levelId}关`, labelSize: 20, labelColor: '#fff', h: 28,
    });

    this.renderer.push({
      shape: 'rect', x: cx, y: card.y + 80,
      size: card.w - 40, color: 'transparent',
      label: config.name, labelSize: 24, labelColor: '#ffd54f', h: 30,
    });

    const themeNames: Record<LevelTheme, string> = {
      [LevelTheme.Plains]: '草原', [LevelTheme.Desert]: '沙漠',
      [LevelTheme.Tundra]: '冰原', [LevelTheme.Volcano]: '火山',
      [LevelTheme.Castle]: '城堡',
    };
    this.renderer.push({
      shape: 'rect', x: cx, y: card.y + 108,
      size: card.w - 40, color: 'transparent',
      label: `主题: ${themeNames[config.theme]}`, labelSize: 12, labelColor: '#8899aa', h: 20,
    });

    const descText = config.sceneDescription ?? config.description;
    if (descText && descText.length > 0) {
      const clipped = descText.length > 36 ? descText.slice(0, 36) + '...' : descText;
      this.renderer.push({
        shape: 'rect', x: cx, y: card.y + 128,
        size: card.w - 40, color: 'transparent',
        label: clipped, labelSize: 10, labelColor: '#778899', h: 20,
      });
    }

    if (!unlocked) {
      this.renderer.push({
        shape: 'rect', x: cx, y: card.y + 155,
        size: 72, color: 'transparent',
        label: '未解锁', labelSize: 22, labelColor: '#757575', h: 40,
      });
      this.renderer.push({
        shape: 'rect', x: cx, y: card.y + 200,
        size: card.w - 40, color: 'transparent',
        label: '需通过前置关卡', labelSize: 12, labelColor: '#666', h: 20,
      });
      return;
    }

    for (let i = 0; i < 3; i++) {
      const starColor = i < stars ? '#ffd54f' : '#424242';
      this.renderer.push({
        shape: 'diamond',
        x: cx - 36 + i * 36,
        y: card.y + 165,
        size: 24,
        color: starColor,
        alpha: 1,
      });
    }

    this.renderer.push({
      shape: 'rect', x: cx, y: card.y + 200,
      size: card.w - 40, color: 'transparent',
      label: `波数: ${config.waves.length}`, labelSize: 12, labelColor: '#aab', h: 20,
    });

    this.renderer.push({
      shape: 'rect', x: cx, y: card.y + 238,
      size: 160, color: '#2e7d32', h: 36,
      label: '开始游戏', labelSize: 14, labelColor: '#fff',
      stroke: '#4caf50', strokeWidth: 1,
    });
  }

  private drawEndlessButton(): void {
    const endlessW = 600;
    const endlessH = 80;
    const endlessX = (LayoutManager.DESIGN_W - endlessW) / 2;
    const endlessY = 840;

    const unlocked = this.isEndlessUnlocked;
    const color = unlocked ? '#4a148c' : '#1a1a2e';
    const labelColor = unlocked ? '#e1bee7' : '#555555';
    const subLabel = unlocked ? '无限波次，挑战极限' : '(通关第3关解锁)';

    this.renderer.push({
      shape: 'rect', x: endlessX + endlessW / 2, y: endlessY + endlessH / 2,
      size: endlessW, color, h: endlessH, alpha: 0.9,
      stroke: unlocked ? '#9c27b0' : '#333',
      strokeWidth: 2,
    });

    this.renderer.push({
      shape: 'rect', x: endlessX + endlessW / 2, y: endlessY + 26,
      size: endlessW, color: 'transparent',
      label: '无尽模式', labelSize: 22, labelColor, h: 30,
    });

    this.renderer.push({
      shape: 'rect', x: endlessX + endlessW / 2, y: endlessY + 56,
      size: endlessW, color: 'transparent',
      label: subLabel, labelSize: 12,
      labelColor: unlocked ? '#9c27b0' : '#555', h: 20,
    });
  }

  handleClick(x: number, y: number): boolean {
    for (const card of this.cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        if (card.levelId <= this.saveData.unlockedLevels) {
          this.onSelectLevel(card.levelId);
          return true;
        }
        return false;
      }
    }

    const endlessW = 600;
    const endlessH = 80;
    const endlessX = (LayoutManager.DESIGN_W - endlessW) / 2;
    const endlessY = 840;
    if (x >= endlessX && x <= endlessX + endlessW && y >= endlessY && y <= endlessY + endlessH) {
      if (this.isEndlessUnlocked) {
        this.onStartEndless();
        return true;
      }
      return false;
    }

    if (x >= 100 && x <= 240 && y >= 1010 && y <= 1050) {
      return true;
    }

    if (x >= 1680 && x <= 1820 && y >= 1010 && y <= 1050) {
      SaveManager.resetAll();
      this.refresh();
      return true;
    }

    return false;
  }
}
