import { describe, it, expect } from 'vitest';

import {
  ARROW_TOWER_SKILL_TREE,
  attemptPurchaseSkill,
  layoutSkillTree,
  type SkillTreeState,
} from '../SkillTreePanel.js';

function state(overrides: Partial<SkillTreeState> = {}): SkillTreeState {
  return {
    config: ARROW_TOWER_SKILL_TREE,
    sp: 5,
    purchased: new Set<string>(),
    ...overrides,
  };
}

describe('attemptPurchaseSkill', () => {
  it('grants the boost_attack_speed effect with cost deducted', () => {
    const result = attemptPurchaseSkill(state(), 'arrow_tower.boost_attack_speed');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.unitId).toBe('arrow_tower');
      expect(result.newSp).toBe(3);
      expect(result.effect).toEqual({ type: 'boost_attack_speed', multiplier: 1.3 });
      expect(result.newPurchased.has('arrow_tower.boost_attack_speed')).toBe(true);
    }
  });

  it('grants the add_extra_target effect with the configured count', () => {
    const result = attemptPurchaseSkill(state({ sp: 3 }), 'arrow_tower.add_extra_target');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.effect).toEqual({ type: 'add_extra_target', count: 1 });
      expect(result.newSp).toBe(0);
    }
  });

  it('rejects insufficient-sp when sp below cost', () => {
    const result = attemptPurchaseSkill(state({ sp: 1 }), 'arrow_tower.boost_attack_speed');
    expect(result).toEqual({ kind: 'rejected', reason: 'insufficient-sp' });
  });

  it('rejects already-purchased when node already in purchased set', () => {
    const result = attemptPurchaseSkill(
      state({ purchased: new Set(['arrow_tower.boost_attack_speed']) }),
      'arrow_tower.boost_attack_speed',
    );
    expect(result).toEqual({ kind: 'rejected', reason: 'already-purchased' });
  });

  it('rejects no-such-node for unknown id', () => {
    const result = attemptPurchaseSkill(state(), 'nope');
    expect(result).toEqual({ kind: 'rejected', reason: 'no-such-node' });
  });
});

describe('layoutSkillTree', () => {
  it('marks purchased and affordable flags per node', () => {
    const layout = layoutSkillTree(
      state({ sp: 2, purchased: new Set(['arrow_tower.boost_attack_speed']) }),
      1920,
      1080,
    );
    expect(layout.headerLabel).toBe('Skill Tree — arrow_tower');
    expect(layout.spLabel).toBe('SP: 2');
    const quickDraw = layout.nodes.find((n) => n.id === 'arrow_tower.boost_attack_speed')!;
    const multiShot = layout.nodes.find((n) => n.id === 'arrow_tower.add_extra_target')!;
    expect(quickDraw.purchased).toBe(true);
    expect(quickDraw.affordable).toBe(true);
    expect(multiShot.purchased).toBe(false);
    expect(multiShot.affordable).toBe(false);
  });
});
