import type { TowerWorld } from './World.js';

export const LIFECYCLE_EVENTS = [
  'onCreate',
  'onDeath',
  'onHit',
  'onAttack',
  'onKill',
  'onUpgrade',
  'onDestroy',
  'onEnter',
  'onLeave',
] as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

const VALID_EVENTS: ReadonlySet<string> = new Set(LIFECYCLE_EVENTS);

export type RuleParams = Readonly<Record<string, unknown>>;

export type RuleHandler = (eid: number, params: RuleParams, world: TowerWorld) => void;

export interface Rule {
  readonly handler: string;
  readonly params: RuleParams;
}

export class RuleEngine {
  private readonly handlers: Map<string, RuleHandler> = new Map();
  private readonly entityRules: Map<number, Map<LifecycleEvent, Rule[]>> = new Map();

  registerHandler(name: string, fn: RuleHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`[RuleEngine] duplicate handler registration: "${name}"`);
    }
    this.handlers.set(name, fn);
  }

  getHandler(name: string): RuleHandler | undefined {
    return this.handlers.get(name);
  }

  attachRules(eid: number, event: LifecycleEvent, rules: readonly Rule[]): void {
    if (!VALID_EVENTS.has(event)) {
      throw new Error(`[RuleEngine] unknown lifecycle event: "${event}"`);
    }
    for (const rule of rules) {
      if (!this.handlers.has(rule.handler)) {
        throw new Error(
          `[RuleEngine] rule references handler not registered: "${rule.handler}"`,
        );
      }
    }
    let byEvent = this.entityRules.get(eid);
    if (!byEvent) {
      byEvent = new Map();
      this.entityRules.set(eid, byEvent);
    }
    byEvent.set(event, [...rules]);
  }

  getRules(eid: number, event: LifecycleEvent): readonly Rule[] {
    return this.entityRules.get(eid)?.get(event) ?? [];
  }

  dispatch(event: LifecycleEvent, eid: number, world: TowerWorld): void {
    const rules = this.entityRules.get(eid)?.get(event);
    if (!rules || rules.length === 0) return;
    for (const rule of rules) {
      const fn = this.handlers.get(rule.handler);
      if (!fn) continue;
      fn(eid, rule.params, world);
    }
  }

  clearRules(eid: number): void {
    this.entityRules.delete(eid);
  }
}
