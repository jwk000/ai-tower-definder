// ============================================================
// Tower Defender — UISystem (bitecs migration)
//
// HUD, tooltips, buttons, overlays — the largest UI system.
// Canvas 2D drawing code preserved; data access migrated to
// bitecs SoA stores and defineQuery.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager, AnchorX, AnchorY, type AnchorConfig } from '../ui/LayoutManager.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS, ENEMY_CONFIGS, UNIT_TYPE_BY_ID } from '../data/gameData.js';
import { GamePhase, TowerType, UnitType, ProductionType, type ShapeType } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { FONTS, getFont } from '../config/fonts.js';
import { formatNumber } from '../utils/formatNumber.js';
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
  PlayerOwned,
} from '../core/components.js';

export function computeEnergyBarRatio(current: number, max: number): number {
  if (max <= 0) return 0;
  if (current <= 0) return 0;
  if (current >= max) return 1;
  return current / max;
}

/**
 * v3.0 roguelike — 手牌槽位水平居中布局。
 * design/20 §4.5.2：单卡 120×168，卡间距 16px，最多 8 张，水平居中。
 * 返回每张卡左上角相对手牌区原点 (x, y) 坐标，y=0（区内顶部对齐，调用方再做垂直居中）。
 * 8 张溢出 800 宽时 startX 为负、视觉可越界（design 已知约束）。
 */
export function computeCardSlotsLayout(
  handCount: number,
  regionWidth: number,
  cardWidth: number,
  gap: number,
): { x: number; y: number }[] {
  if (handCount <= 0) return [];
  const step = cardWidth + gap;
  const totalWidth = handCount * cardWidth + (handCount - 1) * gap;
  const startX = (regionWidth - totalWidth) / 2;
  const slots: { x: number; y: number }[] = [];
  for (let i = 0; i < handCount; i++) {
    slots.push({ x: startX + i * step, y: 0 });
  }
  return slots;
}

/** design/09 §3.2 卡牌稀有度边框色 */
export const RARITY_BORDER_COLORS = {
  common: '#ffffff',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ffc107',
} as const;

/**
 * v3.0 roguelike — 手牌区几何边界（design space），renderHandZone 与命中判定共用。
 * 与 design/20 §4.5.2 一致：bottom-center offset(0,-130), size 800×180。
 */
export function getHandZoneBounds(): {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  left: number;
  top: number;
} {
  const width = 800;
  const height = 180;
  const centerX = 1920 / 2;
  const centerY = 1080 - 130;
  return {
    width,
    height,
    centerX,
    centerY,
    left: centerX - width / 2,
    top: centerY - height / 2,
  };
}

/**
 * v3.0 roguelike — 手牌槽命中判定（design space 坐标）。
 * 返回被点击的卡 slot index，未命中返 -1。
 * 与 renderHandZone 的 computeCardSlotsLayout 布局严格对齐，gap 内不命中。
 */
export function hitTestHandCard(
  px: number,
  py: number,
  handCount: number,
): number {
  if (handCount <= 0) return -1;
  const bounds = getHandZoneBounds();
  const CARD_W = 120;
  const CARD_H = 168;
  const GAP = 16;

  const cardTop = bounds.top + (bounds.height - CARD_H) / 2;
  const cardBottom = cardTop + CARD_H;
  if (py < cardTop || py >= cardBottom) return -1;

  const slots = computeCardSlotsLayout(handCount, bounds.width, CARD_W, GAP);
  for (let i = 0; i < slots.length; i++) {
    const cardLeft = bounds.left + slots[i]!.x;
    const cardRight = cardLeft + CARD_W;
    if (px >= cardLeft && px < cardRight) return i;
  }
  return -1;
}

/**
 * v3.0 roguelike — 把 CardConfig.unitConfigId 映射成可被 BuildSystem.startDrag 消费的实体描述。
 *
 * 当前覆盖范围（A4-UI 阶段）：
 *   - `<X>_tower` → entityType='tower', towerType=TowerType.X
 *   - 已知 UnitType 值 → entityType='unit', unitType=UnitType.X
 *
 * 其他卡（archer/priest/engineer 等尚无对应 ECS 单位实现）返回 null，
 * 调用方应拒绝出卡并保留能量。Phase B 引入新单位时此映射会随 enum 自动扩展。
 */
export function resolveCardToEntityType(
  unitConfigId: string | undefined,
):
  | { entityType: 'tower'; towerType: TowerType }
  | { entityType: 'unit'; unitType: UnitType }
  | null {
  if (!unitConfigId) return null;

  if (unitConfigId.endsWith('_tower')) {
    const stem = unitConfigId.slice(0, -'_tower'.length);
    const towerValues = Object.values(TowerType) as string[];
    if (towerValues.includes(stem)) {
      return { entityType: 'tower', towerType: stem as TowerType };
    }
    return null;
  }

  const unitValues = Object.values(UnitType) as string[];
  if (unitValues.includes(unitConfigId)) {
    return { entityType: 'unit', unitType: unitConfigId as UnitType };
  }
  return null;
}

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
  TowerType.Missile,   // 6
  TowerType.Vine,      // 7
  TowerType.Command,   // 8
  TowerType.Ballista,  // 9
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
  static readonly BTN_W = 80;
  static readonly BTN_H = 80;
  static readonly BTN_GAP = 8;

  /** Bottom panel layout constants */
  static readonly PANEL_W = 1344;   // matches map width (21×64=1344)
  static readonly PANEL_H = 100;    // compact, holds single row of 80×80 buttons
  static readonly PANEL_LEFT = (LayoutManager.DESIGN_W - 1344) / 2; // 288 — centered horizontally
  static readonly PANEL_BTN_START_X = UISystem.PANEL_LEFT + 20; // 308 — inner margin

  private buttons: UIButton[] = [];
  private infos: UIInfo[] = [];
  private overlay: UIOverlay | null = null;

  public selectedEntityId: number | null = null;
  public selectedEntityType: 'tower' | 'unit' | 'trap' | 'production' | null = null;

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
    /**
     * Live refund quote — P1-#11. UISystem uses this to display the *actual* refund
     * amount and to disable the button when EconomySystem rejects (cooldown/combat).
     * If null/undefined, falls back to a 50% estimate (legacy behaviour).
     * Reason codes match EconomySystem.RefundReason ('ok' | 'misbuild' | 'cooldown'
     * | 'combat_damage' | 'combat_attack').
     */
    private getRefundQuote: ((entityId: number) => { amount: number; reason: string } | null) | null = null,
    private onUpgradeUnit: ((entityId: number) => void) | null = null,
  ) {}

  // ---- Selection getter/setter helpers (unchanged) ----

  /**
   * Resolve refund button display + enable state.
   * P1-#11: prefer live quote from EconomySystem; fall back to 50% estimate when
   * the quote callback isn't wired (e.g. legacy callers or unit-test harnesses).
   *
   * Reason → UI mapping:
   *   'ok' / 'misbuild'  → enabled, show amount
   *   'cooldown'         → disabled, show "建造中" (just built, too soon)
   *   'combat_damage'    → disabled, show "受击中"
   *   'combat_attack'    → disabled, show "战斗中"
   *   null fallback      → enabled, show 50% estimate (legacy)
   */
  private resolveRefund(id: number, fallbackCost: number): { label: string; enabled: boolean; color: string } {
    const quote = this.getRefundQuote?.(id) ?? null;
    if (quote === null) {
      const refund = Math.floor(fallbackCost * 0.5);
      return { label: `回收${refund}G`, enabled: true, color: '#c62828' };
    }
    if (quote.reason === 'ok' || quote.reason === 'misbuild') {
      return { label: `回收${quote.amount}G`, enabled: true, color: '#c62828' };
    }
    const reasonText: Record<string, string> = {
      'cooldown': '建造中',
      'combat_damage': '受击中',
      'combat_attack': '战斗中',
    };
    return {
      label: reasonText[quote.reason] ?? '不可回收',
      enabled: false,
      color: '#555555',
    };
  }

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

  get selectedProductionEntityId(): number | null {
    return this.selectedEntityType === 'production' ? this.selectedEntityId : null;
  }
  set selectedProductionEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'production' : null;
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
    const py = Position.y[id]!;
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
      size: diameter!,
      color,
      alpha: 0.15,
    });
    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter!,
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
      const cx = LayoutManager.DESIGN_W / 2;
      const cy = LayoutManager.DESIGN_H / 2;
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

  /** Design-space X of viewport right edge (for right-anchored elements) */
  private viewportRightDesignX(): number {
    return LayoutManager.toDesignX(LayoutManager.viewportW);
  }

  /** Design-space X of viewport left edge */
  private viewportLeftDesignX(): number {
    return LayoutManager.toDesignX(0);
  }

  /** Design-space X of viewport horizontal center */
  private viewportCenterDesignX(): number {
    return LayoutManager.toDesignX(LayoutManager.viewportW / 2);
  }

  /**
   * v3.0 roguelike — 手牌区渲染（design/20 §4.5.2）。
   *   - 锚点 bottom-center offset(0, -130)，size 800×180
   *   - 单卡 120×168，水平居中排列，卡间距 16px，最多 8 张
   *   - 边框 2px 稀有度色（design/09 §3.2）
   *   - 主图区 96×80 放占位符号（type 字母 + 卡名首字）
   *   - 底部：◇ 能量消耗（蓝色菱形）；persistAcrossWaves=true 名字旁画 ✦
   *   - 能量不足整卡 alpha=0.4 并叠加"能量不足"红字
   *   - runContext 未装配时静默跳过（主菜单/编辑器流程）
   */
  private renderHandZone(): void {
    const runContext = this._world?.runContext;
    if (!runContext) return;

    const cards = runContext.hand.state.hand;
    if (cards.length === 0) return;

    const REGION_W = 800;
    const REGION_H = 180;
    const CARD_W = 120;
    const CARD_H = 168;
    const GAP = 16;

    const regionCenterX = LayoutManager.DESIGN_W / 2;
    const regionCenterY = LayoutManager.DESIGN_H - 130;
    const regionLeft = regionCenterX - REGION_W / 2;
    const regionTop = regionCenterY - REGION_H / 2;

    const slots = computeCardSlotsLayout(cards.length, REGION_W, CARD_W, GAP);
    const currentEnergy = runContext.energy.current;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      const slot = slots[i]!;
      const config = runContext.registry.get(card.cardId);
      if (!config) continue;

      const cardLeft = regionLeft + slot.x;
      const cardTop = regionTop + (REGION_H - CARD_H) / 2;
      const cardCenterX = cardLeft + CARD_W / 2;
      const cardCenterY = cardTop + CARD_H / 2;

      const affordable = currentEnergy >= config.energyCost;
      const cardAlpha = affordable ? 1 : 0.4;
      const borderColor = RARITY_BORDER_COLORS[config.rarity];

      this.renderer.push({
        shape: 'rect',
        x: cardCenterX, y: cardCenterY,
        size: CARD_W, h: CARD_H,
        color: '#1a2332',
        alpha: cardAlpha * 0.95,
        stroke: borderColor, strokeWidth: 2,
      });

      const artW = 96;
      const artH = 80;
      const artCenterY = cardTop + 12 + artH / 2;
      this.renderer.push({
        shape: 'rect',
        x: cardCenterX, y: artCenterY,
        size: artW, h: artH,
        color: '#0d1b2a',
        alpha: cardAlpha,
        stroke: '#37474f', strokeWidth: 1,
      });

      const glyph = config.type === 'unit' ? '⚔' : '✦';
      this.infos.push({
        x: cardCenterX, y: artCenterY,
        text: glyph,
        color: borderColor, size: 36, align: 'center',
      });

      const namePersistMark = config.persistAcrossWaves ? '✦ ' : '';
      this.infos.push({
        x: cardCenterX, y: cardTop + 12 + artH + 14,
        text: `${namePersistMark}${config.name}`,
        color: affordable ? '#ffffff' : '#888888',
        size: 12, align: 'center',
      });

      this.infos.push({
        x: cardLeft + 10, y: cardTop + CARD_H - 14,
        text: `◇ ${config.energyCost}`,
        color: affordable ? '#bbdefb' : '#5e6a78', size: 14,
      });

      if (!affordable) {
        this.infos.push({
          x: cardCenterX, y: cardTop + CARD_H - 14,
          text: '能量不足',
          color: '#ef5350', size: 12, align: 'center',
        });
      }
    }
  }

  /**
   * v3.0 roguelike — 牌堆 / 弃牌堆计数图标。
   *   - 牌堆图标 bottom-right offset(-200,-160), size 50×70（design/20 §4.5.1）
   *   - 弃牌堆图标 bottom-right offset(-140,-160), size 50×70
   *   - 数据源 runContext.deck.state.{drawPile,discardPile}.length
   *   - runContext 未装配时静默跳过
   */
  private renderDeckCounter(): void {
    const runContext = this._world?.runContext;
    if (!runContext) return;

    const drawCount = runContext.deck.state.drawPile.length;
    const discardCount = runContext.deck.state.discardPile.length;

    const ICON_W = 50;
    const ICON_H = 70;
    const rightX = LayoutManager.DESIGN_W;
    const bottomY = LayoutManager.DESIGN_H;

    const drawIconCenterX = rightX - 200 + ICON_W / 2;
    const drawIconCenterY = bottomY - 160 + ICON_H / 2;
    const discardIconCenterX = rightX - 140 + ICON_W / 2;
    const discardIconCenterY = bottomY - 160 + ICON_H / 2;

    this.renderer.push({
      shape: 'rect',
      x: drawIconCenterX, y: drawIconCenterY,
      size: ICON_W, h: ICON_H,
      color: '#1a2332', alpha: 0.9,
      stroke: '#1e88e5', strokeWidth: 2,
    });
    this.infos.push({
      x: drawIconCenterX, y: drawIconCenterY - 6,
      text: '📚', color: '#bbdefb', size: 22, align: 'center',
    });
    this.infos.push({
      x: drawIconCenterX, y: drawIconCenterY + 18,
      text: String(drawCount),
      color: '#ffffff', size: 14, align: 'center',
    });

    this.renderer.push({
      shape: 'rect',
      x: discardIconCenterX, y: discardIconCenterY,
      size: ICON_W, h: ICON_H,
      color: '#1a2332', alpha: 0.9,
      stroke: '#6d4c41', strokeWidth: 2,
    });
    this.infos.push({
      x: discardIconCenterX, y: discardIconCenterY - 6,
      text: '🗑', color: '#ffccbc', size: 22, align: 'center',
    });
    this.infos.push({
      x: discardIconCenterX, y: discardIconCenterY + 18,
      text: String(discardCount),
      color: '#ffffff', size: 14, align: 'center',
    });
  }

  private renderEnergyBar(): void {
    const runContext = this._world?.runContext;
    if (!runContext) return;
    const energy = runContext.energy;
    const current = energy.current;
    const max = energy.max;
    const ratio = computeEnergyBarRatio(current, max);

    const barX = 20;
    const barY = 50;
    const barW = 200;
    const barH = 24;

    this.renderer.push({
      shape: 'rect',
      x: barX + barW / 2, y: barY + barH / 2,
      size: barW, h: barH,
      color: '#0d1b2a',
      alpha: 0.85,
      stroke: '#1e88e5', strokeWidth: 1,
    });

    const fillW = barW * ratio;
    if (fillW > 0) {
      this.renderer.push({
        shape: 'rect',
        x: barX + fillW / 2, y: barY + barH / 2,
        size: fillW, h: barH,
        color: '#1e88e5',
        alpha: 0.9,
      });
    }

    this.infos.push({
      x: barX + barW + 10, y: barY + barH / 2,
      text: `◇ ${current}/${max}`,
      color: '#bbdefb', size: 16,
    });
  }

  private buildTopHUD(phase: GamePhase): void {
    const world = this._world;
    const gold = this.getGold();
    const energy = this.getEnergy();
    const population = this.getPopulation();
    const maxPop = this.getMaxPopulation();
    const wave = this.getWave();
    const total = this.getTotalWaves();

    // Full-viewport HUD background bar
    const barLeft = this.viewportLeftDesignX();
    const barRight = this.viewportRightDesignX();
    const barCenterX = (barLeft + barRight) / 2;
    const barWidth = barRight - barLeft;

    this.renderer.push({
      shape: 'rect',
      x: barCenterX, y: UISystem.TOP_H / 2,
      size: barWidth, h: UISystem.TOP_H,
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
        if (UnitTag.isEnemy[eid] === 1 && Health.current[eid]! > 0) {
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

    // v3.0 roguelike: 顶部能量条（手牌系统能量资源）
    // 锚点 top-left offset(20,50), size 200×24（design/20 §4.5.1）
    // 数据源 world.runContext.energy.{current,cap}；runContext 未装配时静默跳过
    this.renderEnergyBar();

    const currentlyPaused = this.isPaused?.() ?? false;

    // Viewport-right-anchored button positions (design-space)
    const rightEdgeD = this.viewportRightDesignX();

    if (!currentlyPaused && this.getCountdown && this.getCountdown() > 0) {
      const cd = this.getCountdown();
      this.infos.push({
        x: rightEdgeD - 270, y: UISystem.TOP_H / 2,
        text: `⏱${formatNumber(cd)}s`,
        color: '#ffd54f', size: 20,
      });

      const skipBtnX = rightEdgeD - 133;  // 12(gap) + 50(btnW) + 12(gap) + 30(btnW) + 12(gap) + 29(btnW) = 133
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

    const speedBtnX = rightEdgeD - 71;    // 12(gap) + 30(btnW) + 12(gap) + 29(btnW) = 71
    const speedBtnW = 30;
    const speedBtnH = 28;
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

    const pauseBtnX = rightEdgeD - 29;    // touches viewport right edge
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
    const panelH = UISystem.PANEL_H;   // 100
    const panelCenterX = LayoutManager.DESIGN_W / 2;     // design center
    const panelW = UISystem.PANEL_W;   // 1344
    const available = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;

    if (available) {
      this.renderHandZone();
      this.renderDeckCounter();
    }

    if (panelY + panelH > LayoutManager.DESIGN_H) return;

    // Panel background — centered, narrower than full width
    this.renderer.push({
      shape: 'rect',
      x: panelCenterX, y: panelY + panelH / 2,
      size: panelW, h: panelH,
      color: '#0d1b2a',
      alpha: 0.9,
    });

    const btnY = panelY + 10;
    const bw = UISystem.BTN_W;   // 80
    const bh = UISystem.BTN_H;   // 80
    const gap = UISystem.BTN_GAP; // 8
    const step = bw + gap;       // 88
    const btnStartX = UISystem.PANEL_BTN_START_X; // 308

    // ---- Tower buttons (7) ----
    const towerTypes = [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning, TowerType.Laser, TowerType.Bat, TowerType.Missile, TowerType.Vine, TowerType.Ballista];
    const towerLabelX = btnStartX + towerTypes.length * step / 2 - step / 2;
    this.infos.push({ x: towerLabelX, y: panelY + 6, text: '防御塔', color: '#aaaaaa', size: 14, align: 'center' });

    const selected = this.getSelectedTower();

    for (let i = 0; i < towerTypes.length; i++) {
      const type = towerTypes[i]!;
      const config = TOWER_CONFIGS[type];
      if (!config) continue;

      const cx = btnStartX + i * step + bw / 2;
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
    const divX1 = btnStartX + towerTypes.length * step;
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

      const cx = unitStartX + i * step + bw / 2;
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
    const trapX = unitStartX + 2 * step + bw / 2;

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
    const divX2 = unitStartX + 3 * step - gap + 10;
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

      const cx = prodStartX + i * step + bw / 2;
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
    const divX3 = prodStartX + 2 * step - gap + 10;
    this.renderer.push({
      shape: 'rect',
      x: divX3, y: btnY + bh / 2,
      size: 2, h: bh + 16,
      color: '#444444',
      alpha: 1,
    });

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
    let th = 110;
    const tx = px;

    // Use taller panel for units (extra stat line + HP bar)
    if (this.selectedEntityType === 'unit') th = 140;
    // Production needs space for rate info
    if (this.selectedEntityType === 'production') th = 120;

    const ty = py! - (th + 10);

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
            text: `HP: ${hpCurrent !== undefined && hpMax !== undefined ? `${Math.ceil(hpCurrent)}/${hpMax}` : `${config.hp}/${config.hp}`}  ATK: ${atkDamage !== undefined ? formatNumber(atkDamage) : config.atk}`,
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

          // Recycle button — P1-#11 live quote
          const totalInvested = Tower.totalInvested[id] ?? config.cost;
          const refundInfo = this.resolveRefund(id, totalInvested);
          const rbw = 65;
          const rbh = 20;
          const rbx = tx + tw / 2 - rbw - 10;
          const rby = ty - th / 2 + 52;
          this.renderer.push({
            shape: 'rect',
            x: rbx + rbw / 2, y: rby + rbh / 2,
            size: rbw, h: rbh,
            color: refundInfo.color,
            alpha: 0.9,
            stroke: '#ffffff', strokeWidth: 1,
          });
          this.buttons.push({
            x: rbx, y: rby, w: rbw, h: rbh,
            label: refundInfo.label,
            color: refundInfo.color,
            textColor: refundInfo.enabled ? '#ffffff' : '#aaaaaa',
            enabled: refundInfo.enabled,
            onClick: () => { if (refundInfo.enabled) this.onRecycleEntity?.(id); },
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
      const atkSpeed = Attack.attackSpeed[id];
      const atkRange = Attack.range[id];
      const unitCost = UnitTag.cost[id];

      const unitName = this._world?.getDisplayName(id) || '单位';

      if (unitCost !== undefined || unitName !== '单位') {
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
          text: unitName,
          color: '#ffffff', size: 18,
        });
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 34,
          text: `HP: ${hpCurrent !== undefined && hpMax !== undefined ? `${Math.ceil(hpCurrent)}/${hpMax}` : '?'}  ATK: ${atkDamage !== undefined ? formatNumber(atkDamage) : '?'}`,
          color: '#ffffff', size: 16,
        });
        const curLevel = UnitTag.level[id] ?? 1;
        const maxUnitLevel = UnitTag.maxLevel[id] ?? 3;
        const typeIdx = UnitTag.unitTypeNum[id];
        const unitTypeKey = typeIdx !== undefined ? UNIT_TYPE_BY_ID[typeIdx] : undefined;
        const unitCfg = unitTypeKey ? UNIT_CONFIGS[unitTypeKey] : undefined;
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 52,
          text: `Lv.${curLevel}/${maxUnitLevel}  攻速: ${atkSpeed !== undefined ? formatNumber(atkSpeed) + '/s' : '?'}  范围: ${atkRange !== undefined ? formatNumber(atkRange) + 'px' : '?'}`,
          color: '#aaaaaa', size: 14,
        });

        const isMaxUnitLevel = curLevel >= maxUnitLevel;
        const unitCostIdx = curLevel - 1;
        const unitUpgradeCost = unitCfg?.upgradeCosts?.[unitCostIdx];
        if (!isMaxUnitLevel && unitUpgradeCost !== undefined) {
          const canAffordUnit = this.getGold() >= unitUpgradeCost;
          const uubw = 55;
          const uubh = 20;
          const uubx = tx - tw / 2 + 10;
          const uuby = ty - th / 2 + 72;
          this.renderer.push({
            shape: 'rect',
            x: uubx + uubw / 2, y: uuby + uubh / 2,
            size: uubw, h: uubh,
            color: canAffordUnit ? '#2e7d32' : '#555555',
            alpha: 0.9,
            stroke: '#ffffff', strokeWidth: 1,
          });
          this.buttons.push({
            x: uubx, y: uuby, w: uubw, h: uubh,
            label: `${unitUpgradeCost}G`,
            color: canAffordUnit ? '#2e7d32' : '#555555',
            textColor: canAffordUnit ? '#ffffff' : '#888888',
            enabled: canAffordUnit,
            onClick: () => { if (this.onUpgradeUnit) this.onUpgradeUnit(id); },
          });
        }

        const totalUnitInvested = UnitTag.totalInvested[id] ?? (unitCost ?? 100);
        const refundInfo = this.resolveRefund(id, totalUnitInvested);
        const rbw = 65;
        const rbh = 20;
        const rbx = tx - tw / 2 + 10;
        const rby = ty - th / 2 + 96;
        this.renderer.push({
          shape: 'rect',
          x: rbx + rbw / 2, y: rby + rbh / 2,
          size: rbw, h: rbh,
          color: refundInfo.color,
          alpha: 0.9,
          stroke: '#ffffff', strokeWidth: 1,
        });
        this.buttons.push({
          x: rbx, y: rby, w: rbw, h: rbh,
          label: refundInfo.label,
          color: refundInfo.color,
          textColor: refundInfo.enabled ? '#ffffff' : '#aaaaaa',
          enabled: refundInfo.enabled,
          onClick: () => { if (refundInfo.enabled) this.onRecycleEntity?.(id); },
        });

        if (hpCurrent !== undefined && hpMax !== undefined && hpMax > 0) {
          const ratio = hpCurrent / hpMax;
          const barX = tx - tw / 2 + rbx + rbw + 10;
          const barW = tw - 20 - rbw - 10;
          this.renderer.push({ shape: 'rect', x: barX + barW / 2, y: rby + rbh / 2, size: barW, h: 6, color: '#222222', alpha: 0.9 });
          const fillW = Math.max(barW * ratio, 0);
          if (fillW > 0) {
            const barColor = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ffc107' : '#f44336';
            this.renderer.push({ shape: 'rect', x: barX + fillW / 2, y: rby + rbh / 2, size: fillW, h: 6, color: barColor, alpha: 0.95 });
          }
        }
      }
    } else if (this.selectedEntityType === 'production') {
      const prodResourceType = Production.resourceType[id];
      const prodRate = Production.rate[id];
      const prodLevel = Production.level[id];
      const hpCurrent = Health.current[id];
      const hpMax = Health.max[id];

      if (prodRate !== undefined && prodLevel !== undefined) {
        const prodName = this._world?.getDisplayName(id) || '生产建筑';
        const resourceLabel = prodResourceType === 0 ? '金' : '能';

        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 14,
          text: `${prodName} Lv.${prodLevel}`,
          color: '#ffffff', size: 18,
        });
        this.infos.push({
          x: tx - tw / 2 + 10, y: ty - th / 2 + 34,
          text: `HP: ${hpCurrent !== undefined && hpMax !== undefined ? `${Math.ceil(hpCurrent)}/${hpMax}` : '?'}  产出: +${formatNumber(prodRate)}${resourceLabel}/s`,
          color: '#ffffff', size: 16,
        });

        // Recycle button — P1-#11 live quote
        const cfg = PRODUCTION_CONFIGS[prodResourceType === 0 ? ProductionType.GoldMine : ProductionType.EnergyTower];
        const prodCost = cfg?.cost ?? 65;
        const refundInfo = this.resolveRefund(id, prodCost);
        const rbw = 65;
        const rbh = 20;
        const rbx = tx - tw / 2 + 10;
        const rby = ty - th / 2 + 52;
        this.renderer.push({
          shape: 'rect',
          x: rbx + rbw / 2, y: rby + rbh / 2,
          size: rbw, h: rbh,
          color: refundInfo.color,
          alpha: 0.9,
          stroke: '#ffffff', strokeWidth: 1,
        });
        this.buttons.push({
          x: rbx, y: rby, w: rbw, h: rbh,
          label: refundInfo.label,
          color: refundInfo.color,
          textColor: refundInfo.enabled ? '#ffffff' : '#aaaaaa',
          enabled: refundInfo.enabled,
          onClick: () => { if (refundInfo.enabled) this.onRecycleEntity?.(id); },
        });

        // HP bar
        if (hpCurrent !== undefined && hpMax !== undefined && hpMax > 0) {
          const ratio = hpCurrent / hpMax;
          const barX = tx - tw / 2 + rbx + rbw + 10;
          const barW = tw - 20 - rbw - 10;
          this.renderer.push({ shape: 'rect', x: barX + barW / 2, y: rby + rbh / 2, size: barW, h: 6, color: '#222222', alpha: 0.9 });
          const fillW = Math.max(barW * ratio, 0);
          if (fillW > 0) {
            const barColor = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ffc107' : '#f44336';
            this.renderer.push({ shape: 'rect', x: barX + fillW / 2, y: rby + rbh / 2, size: fillW, h: 6, color: barColor, alpha: 0.95 });
          }
        }
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
          text: `DPS: ${formatNumber(trapDps)}  范围: ${formatNumber(trapRadius)}px`,
          color: '#ffffff', size: 16,
        });

        // Recycle button — P1-#11 live quote (trap default cost=40)
        const refundInfo = this.resolveRefund(id, 40);
        const rbw = 65;
        const rbh = 20;
        const rbx = tx - tw / 2 + 10;
        const rby = ty - th / 2 + 52;
        this.renderer.push({
          shape: 'rect',
          x: rbx + rbw / 2, y: rby + rbh / 2,
          size: rbw, h: rbh,
          color: refundInfo.color,
          alpha: 0.9,
          stroke: '#ffffff', strokeWidth: 1,
        });
        this.buttons.push({
          x: rbx, y: rby, w: rbw, h: rbh,
          label: refundInfo.label,
          color: refundInfo.color,
          textColor: refundInfo.enabled ? '#ffffff' : '#aaaaaa',
          enabled: refundInfo.enabled,
          onClick: () => { if (refundInfo.enabled) this.onRecycleEntity?.(id); },
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
    const ty = py! - 100;

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
        text: `速度: ${formatNumber(moveSpeed)}`,
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
        shape: 'rect', x: LayoutManager.DESIGN_W / 2, y: LayoutManager.DESIGN_H / 2,
        size: 1600, h: 400, color: '#000000', alpha: 0.6,
      });
      this.overlay = { phase, color: '#4caf50', title: '胜利!', subtext: '刷新页面重新开始' };
    } else if (phase === GamePhase.Defeat) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.renderer.push({
        shape: 'rect', x: LayoutManager.DESIGN_W / 2, y: LayoutManager.DESIGN_H / 2,
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
