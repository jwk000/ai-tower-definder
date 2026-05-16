import { Container, Graphics, Text } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';

import {
  hitTestMainMenu,
  layoutMainMenu,
  type MainMenu,
  type MainMenuState,
} from '../ui/MainMenu.js';
import {
  hitTestInterLevel,
  layoutInterLevel,
  type InterLevelPanel,
  type InterLevelState,
} from '../ui/InterLevelPanel.js';
import {
  hitTestRunResultFooter,
  projectRunResult,
  type RunResultPanel,
  type RunResultState,
} from '../ui/RunResultPanel.js';
import type { ShopPanel, ShopState } from '../ui/ShopPanel.js';
import type { MysticEventConfig } from '../config/loader.js';
import type { MysticPanel } from '../ui/MysticPanel.js';
import { layoutSkillTree, type SkillTreePanel, type SkillTreeState } from '../ui/SkillTreePanel.js';

export interface PanelRendererConfig {
  readonly container: Container;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

const DIM_BG = 0x0a0e16;
const BUTTON_ENABLED = 0x37474f;
const BUTTON_DISABLED = 0x263238;
const BUTTON_BORDER = 0x80cbc4;
const BUTTON_BORDER_DISABLED = 0x455a64;
const TEXT_PRIMARY = 0xffffff;
const TEXT_DIM = 0x90a4ae;
const TITLE_COLOR = 0xffd54f;

export class MainMenuRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly buttonsGraphics: Graphics;
  private readonly titleText: Text;
  private readonly buttonLabels: Text[] = [];
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly menu: MainMenu;
  private state: MainMenuState = { hasSavedRun: false };

  constructor(config: PanelRendererConfig, menu: MainMenu, initial: MainMenuState = { hasSavedRun: false }) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.menu = menu;
    this.state = initial;

    this.bg = new Graphics();
    this.buttonsGraphics = new Graphics();
    this.titleText = new Text({
      text: '',
      style: { fill: TITLE_COLOR, fontSize: 36, fontWeight: 'bold', align: 'center' },
    });
    this.titleText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.titleText, this.buttonsGraphics);

    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));

    this.render();
  }

  refresh(state: MainMenuState): void {
    this.state = state;
    this.menu.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    const layout = layoutMainMenu(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    const action = hitTestMainMenu(layout, local.x, local.y);
    if (action) this.menu.trigger(action);
  }

  private render(): void {
    const layout = layoutMainMenu(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.92 });

    this.titleText.text = layout.titleLabel;
    this.titleText.position.set(layout.titleX, layout.titleY);

    this.buttonsGraphics.clear();
    while (this.buttonLabels.length < layout.buttons.length) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
      t.anchor.set(0.5, 0.5);
      this.container.addChild(t);
      this.buttonLabels.push(t);
    }
    for (let i = layout.buttons.length; i < this.buttonLabels.length; i += 1) {
      this.buttonLabels[i]!.text = '';
    }
    for (let i = 0; i < layout.buttons.length; i += 1) {
      const b = layout.buttons[i]!;
      const fill = b.enabled ? BUTTON_ENABLED : BUTTON_DISABLED;
      const border = b.enabled ? BUTTON_BORDER : BUTTON_BORDER_DISABLED;
      this.buttonsGraphics.rect(b.x, b.y, b.width, b.height).fill({ color: fill, alpha: 0.95 });
      this.buttonsGraphics.rect(b.x, b.y, b.width, b.height).stroke({ width: 2, color: border });
      const label = this.buttonLabels[i]!;
      label.text = b.label;
      label.style.fill = b.enabled ? TEXT_PRIMARY : TEXT_DIM;
      label.position.set(b.x + b.width / 2, b.y + b.height / 2);
    }
  }
}

export class InterLevelRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly cardsGraphics: Graphics;
  private readonly headerText: Text;
  private readonly cardTitleTexts: Text[] = [];
  private readonly cardDescTexts: Text[] = [];
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly panel: InterLevelPanel;
  private state: InterLevelState | null = null;

  constructor(config: PanelRendererConfig, panel: InterLevelPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.cardsGraphics = new Graphics();
    this.headerText = new Text({
      text: '',
      style: { fill: TEXT_PRIMARY, fontSize: 28, fontWeight: 'bold', align: 'center' },
    });
    this.headerText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.cardsGraphics);

    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  refresh(state: InterLevelState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const layout = layoutInterLevel(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    const offerId = hitTestInterLevel(layout, local.x, local.y);
    if (offerId) this.panel.trigger(offerId);
  }

  private render(): void {
    if (!this.state) return;
    const layout = layoutInterLevel(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.92 });

    this.headerText.text = layout.headerLabel;
    this.headerText.position.set(this.viewportWidth / 2, 60);

    this.cardsGraphics.clear();
    while (this.cardTitleTexts.length < layout.items.length) {
      const title = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 22, fontWeight: 'bold' } });
      const desc = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 16, wordWrap: true, wordWrapWidth: 280 } });
      this.container.addChild(title, desc);
      this.cardTitleTexts.push(title);
      this.cardDescTexts.push(desc);
    }
    for (let i = layout.items.length; i < this.cardTitleTexts.length; i += 1) {
      this.cardTitleTexts[i]!.text = '';
      this.cardDescTexts[i]!.text = '';
    }
    for (let i = 0; i < layout.items.length; i += 1) {
      const item = layout.items[i]!;
      this.cardsGraphics.rect(item.x, item.y, item.width, item.height).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
      this.cardsGraphics.rect(item.x, item.y, item.width, item.height).stroke({ width: 2, color: BUTTON_BORDER });
      const title = this.cardTitleTexts[i]!;
      title.text = item.title;
      title.position.set(item.x + 20, item.y + 20);
      const desc = this.cardDescTexts[i]!;
      desc.text = item.description;
      desc.position.set(item.x + 20, item.y + 60);
    }
  }
}

export class RunResultRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly footerGraphics: Graphics;
  private readonly headerText: Text;
  private readonly footerText: Text;
  private readonly lineTexts: Text[] = [];
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly panel: RunResultPanel;
  private state: RunResultState | null = null;

  constructor(config: PanelRendererConfig, panel: RunResultPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.footerGraphics = new Graphics();
    this.headerText = new Text({
      text: '',
      style: { fill: TEXT_PRIMARY, fontSize: 48, fontWeight: 'bold', align: 'center' },
    });
    this.headerText.anchor.set(0.5, 0.5);
    this.footerText = new Text({
      text: '',
      style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' },
    });
    this.footerText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.footerGraphics, this.footerText);

    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  refresh(state: RunResultState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const layout = projectRunResult(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    if (hitTestRunResultFooter(layout, local.x, local.y)) this.panel.trigger();
  }

  private render(): void {
    if (!this.state) return;
    const layout = projectRunResult(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.92 });

    this.headerText.text = layout.headerLabel;
    this.headerText.style.fill = layout.headerColor;
    this.headerText.position.set(this.viewportWidth / 2, 80);

    while (this.lineTexts.length < layout.lines.length) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 22 } });
      this.container.addChild(t);
      this.lineTexts.push(t);
    }
    for (let i = layout.lines.length; i < this.lineTexts.length; i += 1) {
      this.lineTexts[i]!.text = '';
    }
    const lineStartY = 180;
    const lineGap = 36;
    const lineX = this.viewportWidth / 2 - 200;
    for (let i = 0; i < layout.lines.length; i += 1) {
      const l = layout.lines[i]!;
      const t = this.lineTexts[i]!;
      t.text = `${l.label}: ${l.value}`;
      t.position.set(lineX, lineStartY + i * lineGap);
    }

    this.footerGraphics.clear();
    const f = layout.footer;
    this.footerGraphics.rect(f.x, f.y, f.width, f.height).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.footerGraphics.rect(f.x, f.y, f.width, f.height).stroke({ width: 2, color: BUTTON_BORDER });
    this.footerText.text = f.label;
    this.footerText.position.set(f.x + f.width / 2, f.y + f.height / 2);
  }
}

const GOLD_COLOR = 0xffd740;
const SP_COLOR = 0xb2ebf2;
const NODE_PURCHASED = 0x1b5e20;
const NODE_AFFORDABLE = 0x1565c0;
const NODE_LOCKED = 0x37474f;

export class ShopRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly itemsGraphics: Graphics;
  private readonly headerText: Text;
  private readonly goldText: Text;
  private readonly closeText: Text;
  private readonly itemLabelTexts: Text[] = [];
  private readonly itemCostTexts: Text[] = [];
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly panel: ShopPanel;
  private state: ShopState | null = null;

  constructor(config: PanelRendererConfig, panel: ShopPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.itemsGraphics = new Graphics();
    this.headerText = new Text({ text: 'Shop', style: { fill: TITLE_COLOR, fontSize: 32, fontWeight: 'bold', align: 'center' } });
    this.headerText.anchor.set(0.5, 0.5);
    this.goldText = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 22 } });
    this.goldText.anchor.set(0.5, 0.5);
    this.closeText = new Text({ text: 'Leave Shop', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.goldText, this.itemsGraphics, this.closeText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  refresh(state: ShopState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private get closeBtn() {
    const w = 260;
    const h = 56;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - 100, w, h };
  }

  private itemRect(index: number) {
    const itemW = 280;
    const itemH = 140;
    const gap = 40;
    const count = this.state?.items.length ?? 0;
    const totalW = count * itemW + Math.max(0, count - 1) * gap;
    const startX = (this.viewportWidth - totalW) / 2;
    return { x: startX + index * (itemW + gap), y: (this.viewportHeight - itemH) / 2, w: itemW, h: itemH };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerClose();
      return;
    }
    for (let i = 0; i < this.state.items.length; i += 1) {
      const r = this.itemRect(i);
      if (local.x >= r.x && local.x <= r.x + r.w && local.y >= r.y && local.y <= r.y + r.h) {
        this.panel.triggerPurchase(this.state.items[i]!.id);
        return;
      }
    }
  }

  private render(): void {
    if (!this.state) return;
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.95 });

    this.headerText.position.set(this.viewportWidth / 2, 60);
    this.goldText.text = `Gold: ${this.state.gold}  SP: ${this.state.sp}`;
    this.goldText.position.set(this.viewportWidth / 2, 110);

    this.itemsGraphics.clear();
    while (this.itemLabelTexts.length < this.state.items.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' } });
      const cost = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 16 } });
      this.container.addChild(lbl, cost);
      this.itemLabelTexts.push(lbl);
      this.itemCostTexts.push(cost);
    }
    for (let i = 0; i < this.state.items.length; i += 1) {
      const item = this.state.items[i]!;
      const r = this.itemRect(i);
      const canBuy = this.state.gold >= item.costGold && item.stock > 0;
      const fillColor = canBuy ? BUTTON_ENABLED : BUTTON_DISABLED;
      const borderColor = canBuy ? BUTTON_BORDER : BUTTON_BORDER_DISABLED;
      this.itemsGraphics.rect(r.x, r.y, r.w, r.h).fill({ color: fillColor, alpha: 0.95 });
      this.itemsGraphics.rect(r.x, r.y, r.w, r.h).stroke({ width: 2, color: borderColor });
      this.itemLabelTexts[i]!.text = item.label;
      this.itemLabelTexts[i]!.position.set(r.x + 16, r.y + 16);
      this.itemCostTexts[i]!.text = `${item.costGold}G  (stock: ${item.stock})`;
      this.itemCostTexts[i]!.position.set(r.x + 16, r.y + 52);
    }

    const cb = this.closeBtn;
    this.itemsGraphics.rect(cb.x, cb.y, cb.w, cb.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.itemsGraphics.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 2, color: BUTTON_BORDER });
    this.closeText.position.set(cb.x + cb.w / 2, cb.y + cb.h / 2);
  }
}

export class MysticRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly choicesGraphics: Graphics;
  private readonly headerText: Text;
  private readonly descText: Text;
  private readonly closeText: Text;
  private readonly choiceLabelTexts: Text[] = [];
  private readonly choiceEffectTexts: Text[] = [];
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly panel: MysticPanel;
  private event: MysticEventConfig | null = null;

  constructor(config: PanelRendererConfig, panel: MysticPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.choicesGraphics = new Graphics();
    this.headerText = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 28, fontWeight: 'bold', align: 'center' } });
    this.headerText.anchor.set(0.5, 0.5);
    this.descText = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 18, align: 'center', wordWrap: true, wordWrapWidth: 600 } });
    this.descText.anchor.set(0.5, 0);
    this.closeText = new Text({ text: 'Exit Mystic', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.descText, this.choicesGraphics, this.closeText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  refresh(event: MysticEventConfig): void {
    this.event = event;
    this.panel.refresh(event);
    this.render();
  }

  private get closeBtn() {
    const w = 260;
    const h = 56;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - 100, w, h };
  }

  private choiceRect(index: number) {
    const choiceW = 360;
    const choiceH = 80;
    const gap = 16;
    const count = this.event?.choices.length ?? 0;
    const totalH = count * choiceH + Math.max(0, count - 1) * gap;
    const startY = (this.viewportHeight - totalH) / 2 + 60;
    return { x: (this.viewportWidth - choiceW) / 2, y: startY + index * (choiceH + gap), w: choiceW, h: choiceH };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.event) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerExit();
      return;
    }
    for (let i = 0; i < this.event.choices.length; i += 1) {
      const r = this.choiceRect(i);
      if (local.x >= r.x && local.x <= r.x + r.w && local.y >= r.y && local.y <= r.y + r.h) {
        this.panel.triggerChoice(this.event.choices[i]!.id);
        return;
      }
    }
  }

  private render(): void {
    if (!this.event) return;
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.95 });

    this.headerText.text = this.event.title;
    this.headerText.position.set(this.viewportWidth / 2, 60);
    this.descText.text = this.event.description;
    this.descText.position.set(this.viewportWidth / 2, 100);

    this.choicesGraphics.clear();
    while (this.choiceLabelTexts.length < this.event.choices.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' } });
      const eff = new Text({ text: '', style: { fill: SP_COLOR, fontSize: 14 } });
      this.container.addChild(lbl, eff);
      this.choiceLabelTexts.push(lbl);
      this.choiceEffectTexts.push(eff);
    }
    for (let i = 0; i < this.event.choices.length; i += 1) {
      const choice = this.event.choices[i]!;
      const r = this.choiceRect(i);
      this.choicesGraphics.rect(r.x, r.y, r.w, r.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
      this.choicesGraphics.rect(r.x, r.y, r.w, r.h).stroke({ width: 2, color: BUTTON_BORDER });
      this.choiceLabelTexts[i]!.text = choice.label;
      this.choiceLabelTexts[i]!.position.set(r.x + 16, r.y + 12);
      const effectStr = choice.effects.map((ef) => ef.type).join(', ') || 'no effect';
      this.choiceEffectTexts[i]!.text = effectStr;
      this.choiceEffectTexts[i]!.position.set(r.x + 16, r.y + 44);
    }

    const cb = this.closeBtn;
    this.choicesGraphics.rect(cb.x, cb.y, cb.w, cb.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.choicesGraphics.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 2, color: BUTTON_BORDER });
    this.closeText.position.set(cb.x + cb.w / 2, cb.y + cb.h / 2);
  }
}

export class SkillTreeRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly nodesGraphics: Graphics;
  private readonly headerText: Text;
  private readonly spText: Text;
  private readonly closeText: Text;
  private readonly nodeLabelTexts: Text[] = [];
  private readonly nodeDescTexts: Text[] = [];
  private readonly nodeCostTexts: Text[] = [];
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly panel: SkillTreePanel;
  private state: SkillTreeState | null = null;

  constructor(config: PanelRendererConfig, panel: SkillTreePanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.nodesGraphics = new Graphics();
    this.headerText = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 28, fontWeight: 'bold', align: 'center' } });
    this.headerText.anchor.set(0.5, 0.5);
    this.spText = new Text({ text: '', style: { fill: SP_COLOR, fontSize: 22 } });
    this.spText.anchor.set(0.5, 0.5);
    this.closeText = new Text({ text: 'Exit Skill Tree', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.spText, this.nodesGraphics, this.closeText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  refresh(state: SkillTreeState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private get closeBtn() {
    const w = 260;
    const h = 56;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - 100, w, h };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerExit();
      return;
    }
    const layout = layoutSkillTree(this.state, this.viewportWidth, this.viewportHeight);
    for (const node of layout.nodes) {
      if (local.x >= node.x && local.x <= node.x + node.width && local.y >= node.y && local.y <= node.y + node.height) {
        this.panel.triggerUnlock(node.id);
        return;
      }
    }
  }

  private render(): void {
    if (!this.state) return;
    const layout = layoutSkillTree(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.95 });

    this.headerText.text = layout.headerLabel;
    this.headerText.position.set(this.viewportWidth / 2, 60);
    this.spText.text = layout.spLabel;
    this.spText.position.set(this.viewportWidth / 2, 110);

    this.nodesGraphics.clear();
    while (this.nodeLabelTexts.length < layout.nodes.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' } });
      const desc = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 14, wordWrap: true, wordWrapWidth: 240 } });
      const cost = new Text({ text: '', style: { fill: SP_COLOR, fontSize: 15 } });
      this.container.addChild(lbl, desc, cost);
      this.nodeLabelTexts.push(lbl);
      this.nodeDescTexts.push(desc);
      this.nodeCostTexts.push(cost);
    }
    for (let i = 0; i < layout.nodes.length; i += 1) {
      const node = layout.nodes[i]!;
      const fillColor = node.purchased ? NODE_PURCHASED : node.affordable ? NODE_AFFORDABLE : NODE_LOCKED;
      const borderColor = node.purchased ? 0x69f0ae : node.affordable ? BUTTON_BORDER : BUTTON_BORDER_DISABLED;
      this.nodesGraphics.rect(node.x, node.y, node.width, node.height).fill({ color: fillColor, alpha: 0.95 });
      this.nodesGraphics.rect(node.x, node.y, node.width, node.height).stroke({ width: 2, color: borderColor });
      this.nodeLabelTexts[i]!.text = node.purchased ? `✓ ${node.label}` : node.label;
      this.nodeLabelTexts[i]!.position.set(node.x + 16, node.y + 16);
      this.nodeDescTexts[i]!.text = node.description;
      this.nodeDescTexts[i]!.position.set(node.x + 16, node.y + 52);
      this.nodeCostTexts[i]!.text = node.purchased ? 'Purchased' : `${node.costSP} SP`;
      this.nodeCostTexts[i]!.position.set(node.x + 16, node.y + 140);
    }

    const cb = this.closeBtn;
    this.nodesGraphics.rect(cb.x, cb.y, cb.w, cb.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.nodesGraphics.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 2, color: BUTTON_BORDER });
    this.closeText.position.set(cb.x + cb.w / 2, cb.y + cb.h / 2);
  }
}
