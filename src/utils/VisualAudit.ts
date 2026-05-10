/**
 * 表现层审计日志 — VisualAudit
 * 
 * 用于追踪和验证视觉/音效API调用。
 * 当 RenderSystem/Sound 等难以在 vitest 中直接测试时，
 * 此模块提供可验证的调用记录供测试断言。
 * 
 * 用法：
 *   VisualAudit.enable();          // 开启审计（测试中自动开启）
 *   ... 运行游戏逻辑 ...
 *   VisualAudit.getDrawCalls();    // 获取所有渲染调用
 *   VisualAudit.getSoundCalls();   // 获取所有音效调用
 *   VisualAudit.reset();           // 清空记录
 * 
 * 对应设计文档：
 * - design/12-visual-effects.md
 * - design/10-audio-system.md
 * - design/16-art-assets-design.md
 */

// ============================================================
// 类型定义
// ============================================================

export interface DrawCallRecord {
  /** 帧编号 */
  frame: number;
  /** 毫秒时间戳 */
  timestamp: number;
  /** 实体ID（0 = 非实体渲染） */
  entityId: number;
  /** 绘制类型 */
  shape: string;
  /** 坐标 */
  x: number;
  y: number;
  /** 颜色 */
  color: string;
  /** 尺寸 */
  size: number;
  /** 透明度 */
  alpha: number;
  /** 旋转角度 */
  rotation?: number;
  /** 来源模块 */
  source: string;
}

export interface SoundCallRecord {
  frame: number;
  timestamp: number;
  key: string;
  /** 来源模块 */
  source: string;
  /** 是否被节流跳过 */
  throttled: boolean;
}

export interface EffectTriggerRecord {
  frame: number;
  timestamp: number;
  entityId: number;
  effectType: string;
  /** 效果参数 */
  params?: Record<string, unknown>;
  source: string;
}

export interface UiEventRecord {
  frame: number;
  timestamp: number;
  event: string;
  /** UI元素ID */
  elementId: string;
  /** 事件数据 */
  data?: Record<string, unknown>;
  source: string;
}

// ============================================================
// 审计存储
// ============================================================

let enabled = false;
let frameCounter = 0;

const MAX_RECORDS = 5000;

const drawCalls: DrawCallRecord[] = [];
const soundCalls: SoundCallRecord[] = [];
const effectTriggers: EffectTriggerRecord[] = [];
const uiEvents: UiEventRecord[] = [];

// ============================================================
// 公共API
// ============================================================

/** 开启审计追踪（默认关闭） */
export function enable(): void {
  enabled = true;
}

/** 关闭审计追踪 */
export function disable(): void {
  enabled = false;
}

/** 是否已启用 */
export function isEnabled(): boolean {
  return enabled;
}

/** 递增帧计数（每个游戏帧调用一次） */
export function tickFrame(): void {
  frameCounter++;
}

/** 获取当前帧编号 */
export function getFrame(): number {
  return frameCounter;
}

/** 重置所有记录 */
export function reset(): void {
  drawCalls.length = 0;
  soundCalls.length = 0;
  effectTriggers.length = 0;
  uiEvents.length = 0;
  frameCounter = 0;
}

// ============================================================
// 记录渲染调用
// ============================================================

/**
 * 记录一次绘制调用。
 * 在 RenderSystem 调用 PixiJS 绘制命令前调用。
 */
export function recordDrawCall(record: Omit<DrawCallRecord, 'frame' | 'timestamp'>): void {
  if (!enabled) return;
  if (drawCalls.length >= MAX_RECORDS) return;

  drawCalls.push({
    ...record,
    frame: frameCounter,
    timestamp: performance.now(),
  });
}

/**
 * 记录一次音效播放。
 * 在 Sound.play() 被调用时记录。
 */
export function recordSoundPlay(
  key: string,
  source: string,
  throttled: boolean = false,
): void {
  if (!enabled) return;
  if (soundCalls.length >= MAX_RECORDS) return;

  soundCalls.push({
    frame: frameCounter,
    timestamp: performance.now(),
    key,
    source,
    throttled,
  });
}

/**
 * 记录一次特效触发。
 * 在粒子/爆炸等特效生成时记录。
 */
export function recordEffect(
  entityId: number,
  effectType: string,
  source: string,
  params?: Record<string, unknown>,
): void {
  if (!enabled) return;
  if (effectTriggers.length >= MAX_RECORDS) return;

  effectTriggers.push({
    frame: frameCounter,
    timestamp: performance.now(),
    entityId,
    effectType,
    params,
    source,
  });
}

/**
 * 记录一次UI事件。
 * 在按钮点击/面板切换时记录。
 */
export function recordUiEvent(
  event: string,
  elementId: string,
  source: string,
  data?: Record<string, unknown>,
): void {
  if (!enabled) return;
  if (uiEvents.length >= MAX_RECORDS) return;

  uiEvents.push({
    frame: frameCounter,
    timestamp: performance.now(),
    event,
    elementId,
    data,
    source,
  });
}

// ============================================================
// 查询API（供测试断言使用）
// ============================================================

/** 获取所有渲染调用 */
export function getDrawCalls(): ReadonlyArray<DrawCallRecord> {
  return drawCalls;
}

/** 获取所有音效调用 */
export function getSoundCalls(): ReadonlyArray<SoundCallRecord> {
  return soundCalls;
}

/** 获取所有特效触发记录 */
export function getEffectTriggers(): ReadonlyArray<EffectTriggerRecord> {
  return effectTriggers;
}

/** 获取所有UI事件记录 */
export function getUiEvents(): ReadonlyArray<UiEventRecord> {
  return uiEvents;
}

// ============================================================
// 过滤查询（测试专用）
// ============================================================

/** 按来源模块过滤 */
export function getDrawCallsBySource(source: string): DrawCallRecord[] {
  return drawCalls.filter((c) => c.source === source);
}

/** 按形状过滤渲染调用 */
export function getDrawCallsByShape(shape: string): DrawCallRecord[] {
  return drawCalls.filter((c) => c.shape === shape);
}

/** 按帧号过滤渲染调用 */
export function getDrawCallsByFrame(frame: number): DrawCallRecord[] {
  return drawCalls.filter((c) => c.frame === frame);
}

/** 按实体ID过滤渲染调用 */
export function getDrawCallsByEntity(entityId: number): DrawCallRecord[] {
  return drawCalls.filter((c) => c.entityId === entityId);
}

/** 按音效Key过滤 */
export function getSoundCallsByKey(key: string): SoundCallRecord[] {
  return soundCalls.filter((c) => c.key === key);
}

/** 按来源模块过滤音效 */
export function getSoundCallsBySource(source: string): SoundCallRecord[] {
  return soundCalls.filter((c) => c.source === source);
}

/** 按帧号过滤音效 */
export function getSoundCallsByFrame(frame: number): SoundCallRecord[] {
  return soundCalls.filter((c) => c.frame === frame);
}

/** 统计特定形状在当前帧的绘制次数 */
export function countDrawCallsInFrame(frame: number, shape?: string): number {
  let calls = drawCalls.filter((c) => c.frame === frame);
  if (shape) calls = calls.filter((c) => c.shape === shape);
  return calls.length;
}

/** 统计特定音效在当前帧的播放次数 */
export function countSoundCallsInFrame(frame: number, key?: string): number {
  let calls = soundCalls.filter((c) => c.frame === frame);
  if (key) calls = calls.filter((c) => c.key === key);
  return calls.length;
}

/** 获取各类型绘制调用的统计摘要 */
export function getDrawStatistics(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const call of drawCalls) {
    stats[call.shape] = (stats[call.shape] ?? 0) + 1;
  }
  return stats;
}

/** 获取音效调用统计摘要 */
export function getSoundStatistics(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const call of soundCalls) {
    stats[call.key] = (stats[call.key] ?? 0) + 1;
  }
  return stats;
}

/** 获取特效触发统计摘要 */
export function getEffectStatistics(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const call of effectTriggers) {
    stats[call.effectType] = (stats[call.effectType] ?? 0) + 1;
  }
  return stats;
}

// ============================================================
// 验证断言（测试专用）
// ============================================================

/**
 * 验证在指定帧内有指定次数某形状的绘制。
 */
export function assertDrawCount(
  frame: number,
  shape: string,
  expectedMin: number,
  expectedMax?: number,
): { pass: boolean; actual: number; message: string } {
  const actual = countDrawCallsInFrame(frame, shape);
  const max = expectedMax ?? expectedMin;
  const pass = actual >= expectedMin && actual <= max;
  const message = pass
    ? `帧${frame}中${shape}绘制${actual}次（期望${expectedMin}-${max}）✅`
    : `帧${frame}中${shape}绘制${actual}次（期望${expectedMin}-${max}）❌`;
  return { pass, actual, message };
}

/**
 * 验证指定音效被播放。
 */
export function assertSoundPlayed(
  key: string,
  expectedMin: number = 1,
): { pass: boolean; actual: number; message: string } {
  const actual = getSoundCallsByKey(key).length;
  const pass = actual >= expectedMin;
  const message = pass
    ? `音效 ${key} 播放${actual}次（期望≥${expectedMin}）✅`
    : `音效 ${key} 播放${actual}次（期望≥${expectedMin}）❌`;
  return { pass, actual, message };
}

// ============================================================
// 快照/导出（调试面板用）
// ============================================================

/**
 * 导出完整的审计快照。
 */
export function snapshot(): {
  drawCalls: DrawCallRecord[];
  soundCalls: SoundCallRecord[];
  effectTriggers: EffectTriggerRecord[];
  uiEvents: UiEventRecord[];
  statistics: {
    draws: Record<string, number>;
    sounds: Record<string, number>;
    effects: Record<string, number>;
  };
} {
  return {
    drawCalls: [...drawCalls],
    soundCalls: [...soundCalls],
    effectTriggers: [...effectTriggers],
    uiEvents: [...uiEvents],
    statistics: {
      draws: getDrawStatistics(),
      sounds: getSoundStatistics(),
      effects: getEffectStatistics(),
    },
  };
}
