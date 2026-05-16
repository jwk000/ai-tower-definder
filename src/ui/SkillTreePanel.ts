export interface SkillNode {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly costSP: number;
  readonly effect: SkillEffect;
}

export type SkillEffect =
  | { readonly type: 'boost_attack_speed'; readonly multiplier: number }
  | { readonly type: 'add_extra_target'; readonly count: number };

export interface SkillTreeConfig {
  readonly unitId: string;
  readonly nodes: readonly SkillNode[];
}

export interface SkillTreeState {
  readonly config: SkillTreeConfig;
  readonly sp: number;
  readonly purchased: ReadonlySet<string>;
}

export type SkillPurchaseResult =
  | { readonly kind: 'success'; readonly unitId: string; readonly nodeId: string; readonly effect: SkillEffect; readonly newSp: number; readonly newPurchased: ReadonlySet<string> }
  | { readonly kind: 'rejected'; readonly reason: 'no-such-node' | 'already-purchased' | 'insufficient-sp' };

export function attemptPurchaseSkill(state: SkillTreeState, nodeId: string): SkillPurchaseResult {
  const node = state.config.nodes.find((n) => n.id === nodeId);
  if (!node) return { kind: 'rejected', reason: 'no-such-node' };
  if (state.purchased.has(nodeId)) return { kind: 'rejected', reason: 'already-purchased' };
  if (state.sp < node.costSP) return { kind: 'rejected', reason: 'insufficient-sp' };
  const newPurchased = new Set(state.purchased);
  newPurchased.add(nodeId);
  return {
    kind: 'success',
    unitId: state.config.unitId,
    nodeId,
    effect: node.effect,
    newSp: state.sp - node.costSP,
    newPurchased,
  };
}

export interface SkillTreeLayoutNode extends SkillNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly purchased: boolean;
  readonly affordable: boolean;
}

export function layoutSkillTree(state: SkillTreeState, viewportWidth: number, viewportHeight: number): {
  readonly headerLabel: string;
  readonly spLabel: string;
  readonly nodes: readonly SkillTreeLayoutNode[];
} {
  const nodeW = 280;
  const nodeH = 180;
  const gap = 32;
  const totalW = state.config.nodes.length * nodeW + Math.max(0, state.config.nodes.length - 1) * gap;
  const startX = (viewportWidth - totalW) / 2;
  const y = (viewportHeight - nodeH) / 2;
  return {
    headerLabel: `Skill Tree — ${state.config.unitId}`,
    spLabel: `SP: ${state.sp}`,
    nodes: state.config.nodes.map((n, i) => ({
      ...n,
      x: startX + i * (nodeW + gap),
      y,
      width: nodeW,
      height: nodeH,
      purchased: state.purchased.has(n.id),
      affordable: state.sp >= n.costSP,
    })),
  };
}

// MVP-SIMPLIFICATION: 技能树仅箭塔 2 节点（Quick Draw 2SP + Multi-Shot 3SP），完整技能树见 design/20-units/22-skill-tree-overview.md
export const ARROW_TOWER_SKILL_TREE: SkillTreeConfig = {
  unitId: 'arrow_tower',
  nodes: [
    {
      id: 'arrow_tower.boost_attack_speed',
      label: 'Quick Draw',
      description: 'Attack speed +30%',
      costSP: 2,
      effect: { type: 'boost_attack_speed', multiplier: 1.3 },
    },
    {
      id: 'arrow_tower.add_extra_target',
      label: 'Multi-Shot',
      description: 'Hit one extra target',
      costSP: 3,
      effect: { type: 'add_extra_target', count: 1 },
    },
  ],
};

export type SkillTreeHandler = (intent: SkillTreeIntent) => void;

export type SkillTreeIntent =
  | { readonly kind: 'unlock'; readonly result: SkillPurchaseResult }
  | { readonly kind: 'exit' };

export class SkillTreePanel {
  private state: SkillTreeState | null = null;
  private handler: SkillTreeHandler | null = null;

  setHandler(handler: SkillTreeHandler): void {
    this.handler = handler;
  }

  refresh(state: SkillTreeState): void {
    this.state = state;
  }

  triggerUnlock(nodeId: string): void {
    if (!this.state) return;
    const result = attemptPurchaseSkill(this.state, nodeId);
    this.handler?.({ kind: 'unlock', result });
  }

  triggerExit(): void {
    this.handler?.({ kind: 'exit' });
  }
}
