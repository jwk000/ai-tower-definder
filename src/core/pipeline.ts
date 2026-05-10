// ============================================================
// Tower Defender — System Pipeline
//
// 定义系统注册顺序和依赖关系。
// 注册顺序基于拓扑排序：
//   1. 纯管理器（无requiredComponents）
//   2. 视觉效果/临时系统
//   3. Buff/技能系统
//   4. 核心游戏系统（移动、攻击、弹道）
//   5. 实体生命周期（死亡检测）
//   6. 实体创建（建造、波次）
//   7. 渲染（始终最后）
// ============================================================

import type { System } from './World.js';

/**
 * Phase 1 — 独立管理器（无 entity 依赖）
 * 必须在所有数据系统之前运行，因为其他系统依赖它们的状态
 */
export const PHASE_MANAGERS: System[] = [
  // EconomySystem   — 累积金币/能量，刷新 pending 值
  // WaveSystem      — 可按需生成敌人
  // WeatherSystem   — 对所有单位的属性修改
];

/**
 * Phase 2 — 视觉效果/临时系统（仅读/写自身计时器）
 */
export const PHASE_VFX: System[] = [
  // DeathEffectSystem     — 死亡特效计时 → 到期销毁
  // ExplosionEffectSystem — 爆炸特效计时 → 视觉更新 → 到期销毁
  // LightningBoltSystem   — 闪电特效计时 → 到期销毁
  // LaserBeamSystem       — 激光束计时 → 持续伤害 → 到期销毁
];

/**
 * Phase 3 — Buff & 治疗（修改辅助状态）
 */
export const PHASE_MODIFIERS: System[] = [
  // BuffSystem    — Buff 持续时间 tick，过期移除
  // HealingSystem — 治疗泉水范围治疗
];

/**
 * Phase 4 — 核心游戏逻辑（场景状态的主要驱动者）
 * 顺序重要：先移动，再攻击（因为攻击依赖位置），弹道最后
 */
export const PHASE_GAMEPLAY: System[] = [
  // MovementSystem      — 敌人沿路径移动，碰撞检测
  // UnitSystem          — 玩家单位移动和目标选择
  // EnemyAttackSystem   — 敌人选择和攻击塔/单位
  // AttackSystem        — 塔选择目标，发射弹道
  // BatSwarmSystem      — 蝙蝠群 boid AI 和攻击
  // ProjectileSystem    — 弹道移动、命中、Buff 应用
  // SkillSystem         — 玩家技能执行
  // TrapSystem          — 陷阱范围伤害
  // ProductionSystem    — 资源产出累积
];

/**
 * Phase 5 — 实体生命周期（死亡检测必须在所有伤害之后）
 */
export const PHASE_LIFECYCLE: System[] = [
  // LifecycleSystem  — 生命周期事件分发 (onDeath → 爆炸等)
  // HealthSystem     — 检测死亡，调用 destroyEntity，设置阶段
];

/**
 * Phase 6 — 实体创建（在伤害/死亡之后）
 */
export const PHASE_CREATION: System[] = [
  // BuildSystem — 处理建造和拖拽放置
];

/**
 * Phase 7 — AI 系统
 */
export const PHASE_AI: System[] = [
  // AISystem — 行为树执行
];

/**
 * Phase 8 — 渲染（始终最后，读取所有组件的最新状态）
 */
export const PHASE_RENDER: System[] = [
  // RenderSystem — PixiJS渲染同步
  // UISystem     — HUD + 工具栏 + 信息面板
];

/**
 * 获取完整管线（按执行顺序排列）
 */
export function getPipeline(): System[] {
  return [
    ...PHASE_MANAGERS,
    ...PHASE_VFX,
    ...PHASE_MODIFIERS,
    ...PHASE_GAMEPLAY,
    ...PHASE_LIFECYCLE,
    ...PHASE_CREATION,
    ...PHASE_AI,
    ...PHASE_RENDER,
  ];
}

/**
 * Post-render hook（在 endFrame() 之后）
 * 用于需要在缓冲渲染完成后直接绘制 Canvas 的效果
 */
export const POST_RENDER_SYSTEMS: string[] = [
  // 'LightningBoltSystem.renderBolts()',
  // 'LaserBeamSystem.renderBeams()',
  // 'UISystem.renderUI()',
];
