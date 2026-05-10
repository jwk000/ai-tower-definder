/**
 * 表现层审计日志测试
 * 
 * 验证 VisualAudit 的记录和查询功能是否正常，
 * 确保视觉/音效API调用可以被正确追踪和验证。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as VisualAudit from './VisualAudit.js';

beforeEach(() => {
  VisualAudit.reset();
  VisualAudit.enable();
});

describe('VisualAudit — 渲染调用记录', () => {
  it('记录并查询渲染调用', () => {
    VisualAudit.recordDrawCall({
      entityId: 1,
      shape: 'rect',
      x: 100,
      y: 200,
      color: '#4fc3f7',
      size: 36,
      alpha: 1.0,
      source: 'RenderSystem',
    });

    const calls = VisualAudit.getDrawCalls();
    expect(calls.length).toBe(1);
    expect(calls[0]!.shape).toBe('rect');
    expect(calls[0]!.entityId).toBe(1);
    expect(calls[0]!.color).toBe('#4fc3f7');
  });

  it('帧号随帧递增', () => {
    VisualAudit.tickFrame();
    expect(VisualAudit.getFrame()).toBe(1);
    VisualAudit.tickFrame();
    expect(VisualAudit.getFrame()).toBe(2);
  });

  it('渲染调用自动记录帧号', () => {
    VisualAudit.tickFrame();
    VisualAudit.recordDrawCall({
      entityId: 1,
      shape: 'circle',
      x: 0, y: 0,
      color: '#fff',
      size: 10,
      alpha: 1,
      source: 'Test',
    });

    const calls = VisualAudit.getDrawCallsByFrame(1);
    expect(calls.length).toBe(1);
  });

  it('按形状过滤', () => {
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'circle', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'rect',   x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'circle', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });

    expect(VisualAudit.getDrawCallsByShape('circle').length).toBe(2);
    expect(VisualAudit.getDrawCallsByShape('rect').length).toBe(1);
    expect(VisualAudit.getDrawCallsByShape('triangle').length).toBe(0);
  });

  it('按实体ID过滤', () => {
    VisualAudit.recordDrawCall({ entityId: 42, shape: 'rect', x: 0, y: 0, color: '#f00', size: 20, alpha: 1, source: 'R' });
    VisualAudit.recordDrawCall({ entityId: 99, shape: 'rect', x: 0, y: 0, color: '#0f0', size: 20, alpha: 1, source: 'R' });

    expect(VisualAudit.getDrawCallsByEntity(42).length).toBe(1);
    expect(VisualAudit.getDrawCallsByEntity(99).length).toBe(1);
    expect(VisualAudit.getDrawCallsByEntity(0).length).toBe(0);
  });

  it('关闭审计后不记录', () => {
    VisualAudit.disable();
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'rect', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'T' });
    expect(VisualAudit.getDrawCalls().length).toBe(0);
  });

  it('达到上限后不再记录', () => {
    for (let i = 0; i < 6000; i++) {
      VisualAudit.recordDrawCall({ entityId: i, shape: 'dot', x: i, y: i, color: '#000', size: 1, alpha: 1, source: 'T' });
    }
    // MAX_RECORDS = 5000
    expect(VisualAudit.getDrawCalls().length).toBe(5000);
  });
});

describe('VisualAudit — 音效调用记录', () => {
  it('记录音效播放', () => {
    VisualAudit.recordSoundPlay('tower_shoot', 'AttackSystem');
    expect(VisualAudit.getSoundCalls().length).toBe(1);
    expect(VisualAudit.getSoundCalls()[0]!.key).toBe('tower_shoot');
  });

  it('记录节流跳过', () => {
    VisualAudit.recordSoundPlay('tower_shoot', 'AttackSystem', true);
    const calls = VisualAudit.getSoundCalls();
    expect(calls[0]!.throttled).toBe(true);
  });

  it('按key过滤', () => {
    VisualAudit.recordSoundPlay('tower_shoot', 'A');
    VisualAudit.recordSoundPlay('enemy_death', 'A');
    VisualAudit.recordSoundPlay('tower_shoot', 'A');

    expect(VisualAudit.getSoundCallsByKey('tower_shoot').length).toBe(2);
    expect(VisualAudit.getSoundCallsByKey('enemy_death').length).toBe(1);
    expect(VisualAudit.getSoundCallsByKey('defeat').length).toBe(0);
  });

  it('assertSoundPlayed 验证', () => {
    VisualAudit.recordSoundPlay('wave_start', 'WaveSystem');
    const result = VisualAudit.assertSoundPlayed('wave_start', 1);
    expect(result.pass).toBe(true);
  });

  it('assertSoundPlayed 未播放时失败', () => {
    const result = VisualAudit.assertSoundPlayed('defeat', 1);
    expect(result.pass).toBe(false);
  });
});

describe('VisualAudit — 特效记录', () => {
  it('记录特效触发', () => {
    VisualAudit.recordEffect(1, 'explosion', 'ProjectileSystem', { radius: 80 });
    const triggers = VisualAudit.getEffectTriggers();
    expect(triggers.length).toBe(1);
    expect(triggers[0]!.effectType).toBe('explosion');
    expect(triggers[0]!.params).toEqual({ radius: 80 });
  });
});

describe('VisualAudit — 统计功能', () => {
  it('绘制统计', () => {
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'circle',   x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'rect',     x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'circle',   x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'triangle', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });

    const stats = VisualAudit.getDrawStatistics();
    expect(stats.circle).toBe(2);
    expect(stats.rect).toBe(1);
    expect(stats.triangle).toBe(1);
  });

  it('音效统计', () => {
    VisualAudit.recordSoundPlay('tower_shoot', 'A');
    VisualAudit.recordSoundPlay('tower_shoot', 'A');
    VisualAudit.recordSoundPlay('enemy_death', 'A');

    const stats = VisualAudit.getSoundStatistics();
    expect(stats.tower_shoot).toBe(2);
    expect(stats.enemy_death).toBe(1);
  });

  it('快照导出', () => {
    VisualAudit.recordDrawCall({ entityId: 1, shape: 'rect', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'T' });
    VisualAudit.recordSoundPlay('build_place', 'T');
    VisualAudit.recordEffect(1, 'flash', 'T');

    const snap = VisualAudit.snapshot();
    expect(snap.drawCalls.length).toBe(1);
    expect(snap.soundCalls.length).toBe(1);
    expect(snap.effectTriggers.length).toBe(1);
    expect(snap.statistics.draws.rect).toBe(1);
    expect(snap.statistics.sounds.build_place).toBe(1);
  });
});

describe('VisualAudit — UI事件记录', () => {
  it('记录UI事件', () => {
    VisualAudit.recordUiEvent('click', 'start_wave_btn', 'UISystem', { wave: 3 });
    const events = VisualAudit.getUiEvents();
    expect(events.length).toBe(1);
    expect(events[0]!.event).toBe('click');
    expect(events[0]!.elementId).toBe('start_wave_btn');
  });
});

describe('VisualAudit — 帧内计数', () => {
  it('countDrawCallsInFrame', () => {
    VisualAudit.tickFrame(); // frame 1
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'circle', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'rect',   x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'A' });
    VisualAudit.tickFrame(); // frame 2
    VisualAudit.recordDrawCall({ entityId: 0, shape: 'circle', x: 0, y: 0, color: '#fff', size: 10, alpha: 1, source: 'B' });

    expect(VisualAudit.countDrawCallsInFrame(1)).toBe(2);
    expect(VisualAudit.countDrawCallsInFrame(1, 'circle')).toBe(1);
    expect(VisualAudit.countDrawCallsInFrame(2)).toBe(1);
  });
});
