import { Container, Text } from 'pixi.js';

export interface HUDState {
  readonly gold: number;
  readonly crystalHp: number;
  readonly waveLabel: string;
}

export class HUDRenderer {
  readonly container: Container;
  private readonly goldText: Text;
  private readonly crystalText: Text;
  private readonly waveText: Text;

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);

    const style = { fill: 0xffffff, fontSize: 18, fontFamily: 'Exo 2, monospace' } as const;
    this.goldText = new Text({ text: '', style });
    this.crystalText = new Text({ text: '', style });
    this.waveText = new Text({ text: '', style });
    this.goldText.x = 16;
    this.goldText.y = 16;
    this.crystalText.x = 16;
    this.crystalText.y = 40;
    this.waveText.x = 16;
    this.waveText.y = 64;
    this.container.addChild(this.goldText, this.crystalText, this.waveText);
  }

  sync(state: HUDState): void {
    this.goldText.text = `Gold: ${state.gold}`;
    this.crystalText.text = `Crystal: ${state.crystalHp}`;
    this.waveText.text = state.waveLabel;
  }
}
