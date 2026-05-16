// MVP-SIMPLIFICATION: 秘境仅 1 事件「获得 10 金币」+ 零成本退出，完整事件池见 design/50-mda/50-mda.md §14
import type { MysticChoice, MysticEventConfig } from '../config/loader.js';

export interface MysticPanelLayoutChoice {
  readonly choiceId: string;
  readonly label: string;
  readonly effectSummary: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MysticPanelLayout {
  readonly titleLabel: string;
  readonly descriptionLabel: string;
  readonly choices: readonly MysticPanelLayoutChoice[];
}

export type MysticPanelIntent =
  | { readonly kind: 'resolve'; readonly eventId: string; readonly choiceId: string; readonly effects: MysticChoice['effects'] }
  | { readonly kind: 'invalid'; readonly reason: 'no-such-choice' };

export function layoutMysticEvent(event: MysticEventConfig, viewportWidth: number, viewportHeight: number): MysticPanelLayout {
  const choiceW = 360;
  const choiceH = 80;
  const gap = 16;
  const totalH = event.choices.length * choiceH + Math.max(0, event.choices.length - 1) * gap;
  const startY = (viewportHeight - totalH) / 2 + 80;
  const x = (viewportWidth - choiceW) / 2;
  return {
    titleLabel: event.title,
    descriptionLabel: event.description,
    choices: event.choices.map((c, i) => ({
      choiceId: c.id,
      label: c.label,
      effectSummary: summarizeEffects(c),
      x,
      y: startY + i * (choiceH + gap),
      width: choiceW,
      height: choiceH,
    })),
  };
}

function summarizeEffects(choice: MysticChoice): string {
  if (choice.effects.length === 0) return 'no effect';
  return choice.effects.map((e) => e.type).join(', ');
}

export function resolveMysticChoice(event: MysticEventConfig, choiceId: string): MysticPanelIntent {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) return { kind: 'invalid', reason: 'no-such-choice' };
  return { kind: 'resolve', eventId: event.id, choiceId, effects: choice.effects };
}

export type MysticExitHandler = (intent: MysticIntent) => void;

export type MysticIntent =
  | { readonly kind: 'resolve'; readonly eventId: string; readonly choiceId: string; readonly effects: MysticChoice['effects'] }
  | { readonly kind: 'exit' }
  | { readonly kind: 'invalid'; readonly reason: 'no-such-choice' | 'no-event' };

export class MysticPanel {
  private event: MysticEventConfig | null = null;
  private handler: MysticExitHandler | null = null;

  setHandler(handler: MysticExitHandler): void {
    this.handler = handler;
  }

  refresh(event: MysticEventConfig): void {
    this.event = event;
  }

  triggerChoice(choiceId: string): void {
    if (!this.event) {
      this.handler?.({ kind: 'invalid', reason: 'no-event' });
      return;
    }
    const intent = resolveMysticChoice(this.event, choiceId);
    this.handler?.(intent);
  }

  triggerExit(): void {
    this.handler?.({ kind: 'exit' });
  }
}
