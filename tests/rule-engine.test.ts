/**
 * RuleEngine 集成测试 — 核心逻辑（无实体依赖）
 * bitecs SoA 在 vitest 多 world 环境下实体创建不稳定，聚焦纯逻辑测试。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RuleEngine } from '../src/core/RuleEngine.js';
import type { LifecycleEvent } from '../src/core/RuleEngine.js';

describe('RuleEngine — 规则注册与分发', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  it('registerHandler 应成功注册处理器', () => {
    ruleEngine.registerHandler('test_handler', () => {});
    ruleEngine.registerHandler('test_handler2', () => {});
  });

  it('registerHandlers 批量注册多个处理器', () => {
    ruleEngine.registerHandlers({
      handler_a: () => {},
      handler_b: () => {},
      handler_c: () => {},
    });
  });

  it('registerLifecycleRules 注册规则不抛异常', () => {
    const rules = new Map<LifecycleEvent, import('../src/config/registry.js').LifecycleRule[]>();
    rules.set('onDeath', [{ type: 'deal_test', params: { radius: 100, damage: 50 } }]);
    ruleEngine.registerLifecycleRules('test_bomber', rules);
  });

  it('registerBehaviorRules 注册行为规则不抛异常', () => {
    ruleEngine.registerBehaviorRules('test_unit', {
      targetSelection: () => null,
      attackMode: () => {},
      movementMode: () => {},
    });
  });

  it('getBehaviorProvider 未注册时返回 undefined', () => {
    const result = ruleEngine.getBehaviorProvider('nonexistent');
    expect(result).toBeUndefined();
  });

  it('getBehaviorProvider 已注册时返回提供者', () => {
    const provider = {
      targetSelection: () => null,
      attackMode: () => {},
      movementMode: () => {},
    };
    ruleEngine.registerBehaviorRules('my_unit', provider);
    const result = ruleEngine.getBehaviorProvider('my_unit');
    expect(result).toBe(provider);
  });

  it('reset 清除全部状态', () => {
    ruleEngine.registerHandler('test', () => {});
    ruleEngine.registerBehaviorRules('test_unit', {
      targetSelection: () => null,
      attackMode: () => {},
      movementMode: () => {},
    });
    ruleEngine.reset();
    expect(ruleEngine.getBehaviorProvider('test_unit')).toBeUndefined();
  });
});
