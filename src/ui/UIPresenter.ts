import { Container, Graphics, Text } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';

import type { HandPanel, HandState } from './HandPanel.js';
import { hitTestHandSlot, layoutHand } from './HandPanel.js';
import type { RunState } from './HUD.js';
import { projectHUD } from './HUD.js';

export interface UIPresenterConfig {
  readonly battleContainer: Container;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly handPanel?: HandPanel;
}

export interface UIFrame {
  readonly run: RunState;
  readonly hand: HandState;
}

/**
 * UIPresenter — Wave 6 HUD + HandPanel 的运行时呈现器。
 *
 * 设计取舍：不进 Pipeline（Pipeline 系统签名是 update(world, dt)，但 HUD/Hand
 * 数据来自 RunManager + 单关 LevelState，与 ECS world 解耦）。由
 * RunController 在 Battle 相位每帧调一次 present(frame)。
 *
 * 仅同步 HUD（金币/水晶/波次）+ HandPanel（卡牌槽 + 能量）。其余面板
 * （MainMenu / InterLevel / RunResult / Shop / Mystic / SkillTree）由
 * RunController 按 phase 切换容器显隐，不走 UIPresenter（Wave 7 视情况补）。
 */
export class UIPresenter {
  private readonly battleContainer: Container;
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;

  private readonly hudContainer: Container;
  private readonly handContainer: Container;
  private readonly goldText: Text;
  private readonly crystalText: Text;
  private readonly waveText: Text;
  private readonly phaseText: Text;
  private readonly energyText: Text;
  private readonly slotGraphics: Graphics;
  private readonly slotLabels: Text[] = [];

  private readonly handPanel: HandPanel | null;
  private lastHandState: HandState = { cards: [], energy: 0 };
  private dragSlot: number | null = null;

  constructor(config: UIPresenterConfig) {
    this.battleContainer = config.battleContainer;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.handPanel = config.handPanel ?? null;

    this.hudContainer = new Container();
    this.handContainer = new Container();
    this.battleContainer.addChild(this.hudContainer, this.handContainer);

    this.goldText = new Text({ text: '', style: { fill: 0xffd54f, fontSize: 18 } });
    this.goldText.position.set(12, 12);
    this.crystalText = new Text({ text: '', style: { fill: 0x4fc3f7, fontSize: 18 } });
    this.crystalText.position.set(12, 36);
    this.waveText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 18 } });
    this.waveText.position.set(12, 60);
    this.phaseText = new Text({ text: '', style: { fill: 0xb0bec5, fontSize: 16 } });
    this.phaseText.position.set(12, 84);
    this.hudContainer.addChild(this.goldText, this.crystalText, this.waveText, this.phaseText);

    this.energyText = new Text({ text: '', style: { fill: 0x80cbc4, fontSize: 18 } });
    this.energyText.position.set(12, this.viewportHeight - 24);
    this.slotGraphics = new Graphics();
    this.handContainer.addChild(this.slotGraphics, this.energyText);

    if (this.handPanel) this.bindHandEvents();
  }

  private bindHandEvents(): void {
    this.battleContainer.eventMode = 'static';
    this.battleContainer.hitArea = { contains: () => true };
    this.battleContainer.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
    this.battleContainer.on('pointerup', (e: FederatedPointerEvent) => this.onPointerUp(e));
    this.battleContainer.on('pointerupoutside', () => {
      this.dragSlot = null;
    });
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    const local = this.battleContainer.toLocal(e.global);
    const layout = layoutHand(this.lastHandState, this.viewportWidth, this.viewportHeight);
    this.dragSlot = hitTestHandSlot(layout, local.x, local.y);
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    if (this.dragSlot === null || !this.handPanel) return;
    const local = this.battleContainer.toLocal(e.global);
    this.handPanel.trigger(this.dragSlot, local.x, local.y);
    this.dragSlot = null;
  }

  present(frame: UIFrame): void {
    this.lastHandState = frame.hand;
    const hud = projectHUD(frame.run);
    this.goldText.text = hud.gold;
    this.crystalText.text = hud.crystal;
    this.crystalText.style.fill = hud.crystalLowAlarm ? 0xff5252 : 0x4fc3f7;
    this.waveText.text = hud.waveLabel;
    this.phaseText.text = hud.phaseLabel;

    const layout = layoutHand(frame.hand, this.viewportWidth, this.viewportHeight);
    this.energyText.text = layout.energyLabel;
    this.slotGraphics.clear();
    while (this.slotLabels.length < layout.slots.length) {
      const label = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14 } });
      this.handContainer.addChild(label);
      this.slotLabels.push(label);
    }
    for (let i = layout.slots.length; i < this.slotLabels.length; i++) {
      this.slotLabels[i]!.text = '';
    }
    for (let i = 0; i < layout.slots.length; i++) {
      const s = layout.slots[i]!;
      const fillColor = s.playable ? 0x37474f : 0x263238;
      this.slotGraphics.rect(s.x, s.y, s.width, s.height).fill({ color: fillColor, alpha: 0.92 });
      this.slotGraphics.rect(s.x, s.y, s.width, s.height).stroke({ width: 2, color: s.playable ? 0x80cbc4 : 0x455a64 });
      const label = this.slotLabels[i]!;
      label.text = `${s.cardId}\nCost ${s.cost}`;
      label.position.set(s.x + 8, s.y + 8);
    }
  }
}
