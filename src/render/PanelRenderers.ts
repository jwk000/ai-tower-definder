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
