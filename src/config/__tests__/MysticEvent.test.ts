import { describe, it, expect } from 'vitest';

import { parseMysticEventConfig } from '../loader.js';

const VALID = `
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

describe('parseMysticEventConfig', () => {
  it('parses a well-formed mystic event with two choices', () => {
    const cfg = parseMysticEventConfig(VALID);
    expect(cfg.id).toBe('lucky_merchant');
    expect(cfg.title).toBe('Lucky Merchant');
    expect(cfg.choices).toHaveLength(2);
    expect(cfg.choices[0]!.effects).toHaveLength(2);
    expect(cfg.choices[1]!.effects).toEqual([]);
  });

  it('preserves effect.type and additional fields per effect', () => {
    const cfg = parseMysticEventConfig(VALID);
    const accept = cfg.choices[0]!;
    expect(accept.effects[0]).toMatchObject({ type: 'spend_gold', amount: 30 });
    expect(accept.effects[1]).toMatchObject({ type: 'grant_card', cardId: 'arrow_tower' });
  });

  it('throws when a required top-level field is missing', () => {
    const missing = `
title: No ID
choices:
  - id: a
    label: A
    effects: []
`;
    expect(() => parseMysticEventConfig(missing)).toThrow();
  });

  it('throws when choices array is empty', () => {
    const empty = `
id: x
title: X
description: x
choices: []
`;
    expect(() => parseMysticEventConfig(empty)).toThrow();
  });
});
