import { describe, it, expect } from 'vitest';

import { parseMysticEventConfig } from '../../config/loader.js';
import { layoutMysticEvent, resolveMysticChoice } from '../MysticPanel.js';

const EVENT_YAML = `
id: lucky_merchant
title: Lucky Merchant
description: A peddler offers a deal.
choices:
  - id: accept
    label: Pay 30 gold
    effects:
      - type: spend_gold
        amount: 30
      - type: grant_card
        cardId: arrow_tower
  - id: decline
    label: Walk past
    effects: []
`;

const event = parseMysticEventConfig(EVENT_YAML);

describe('layoutMysticEvent', () => {
  it('lays out choices vertically centered with title and description', () => {
    const layout = layoutMysticEvent(event, 1920, 1080);
    expect(layout.titleLabel).toBe('Lucky Merchant');
    expect(layout.descriptionLabel).toBe('A peddler offers a deal.');
    expect(layout.choices).toHaveLength(2);
    expect(layout.choices[0]!.x).toBe((1920 - 360) / 2);
    expect(layout.choices[1]!.y).toBeGreaterThan(layout.choices[0]!.y);
  });

  it('summarizes effects per choice (joined types) and no-effect string', () => {
    const layout = layoutMysticEvent(event, 1920, 1080);
    expect(layout.choices[0]!.effectSummary).toBe('spend_gold, grant_card');
    expect(layout.choices[1]!.effectSummary).toBe('no effect');
  });
});

describe('resolveMysticChoice', () => {
  it('returns resolve intent with the effects when choiceId matches', () => {
    const intent = resolveMysticChoice(event, 'accept');
    expect(intent.kind).toBe('resolve');
    if (intent.kind === 'resolve') {
      expect(intent.eventId).toBe('lucky_merchant');
      expect(intent.effects).toHaveLength(2);
      expect(intent.effects[0]).toMatchObject({ type: 'spend_gold' });
    }
  });

  it('returns invalid intent for unknown choiceId', () => {
    expect(resolveMysticChoice(event, 'nope')).toEqual({
      kind: 'invalid', reason: 'no-such-choice',
    });
  });
});
