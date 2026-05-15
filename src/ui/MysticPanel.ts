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
