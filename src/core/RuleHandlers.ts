// ============================================================
// Tower Defender — 预定义规则处理器
//
// 这些是 RuleEngine 在生命周期事件中调用的具体处理器。
// 设计文档中引用的各种效果：deal_aoe_damage, play_effect,
// drop_gold, flash_color, spawn_projectile 等。
//
// 设计文档: design/02-unit-system.md (Section 3.1)
// ============================================================

import type { IWorld } from 'bitecs';
import type { RuleHandlerFn } from '../core/RuleEngine.js';
import { Health, Position, FactionVal, Faction, Visual } from '../core/components.js';

// ============================================================
// 战斗相关处理器
// ============================================================

/**
 * AOE范围伤害
 * YAML: { type: deal_aoe_damage, radius: 100, damage: 50, targets: [Player] }
 */
export const dealAoeDamage: RuleHandlerFn = (world, entityId, params, context) => {
  const radius = params['radius'] as number ?? 100;
  const damage = params['damage'] as number ?? 50;
  const targetFactions = params['targets'] as number[] ?? [FactionVal.Player];

  const posX = Position.x[entityId];
  const posY = Position.y[entityId];
  if (posX === undefined || posY === undefined) return;

  for (let eid = 0; eid < Health.current.length; eid++) {
    const hp = Health.current[eid];
    if (hp === undefined || hp <= 0) continue;

    const faction = Faction.value[eid];
    if (faction === undefined || !targetFactions.includes(faction)) continue;

    const ex = Position.x[eid];
    const ey = Position.y[eid];
    if (ex === undefined || ey === undefined) continue;

    const dx = ex - posX;
    const dy = ey - posY;
    if (dx * dx + dy * dy <= radius * radius) {
      Health.current[eid] = Math.max(0, hp - damage);
    }
  }
};

/**
 * 对单体造成伤害
 * YAML: { type: deal_damage, damage: 25 }
 */
export const dealDamage: RuleHandlerFn = (world, entityId, params, context) => {
  const damage = params['damage'] as number ?? 0;
  const targetId = context.sourceId;
  if (targetId !== undefined && Health.current[targetId] !== undefined) {
    Health.current[targetId] = Math.max(0, Health.current[targetId]! - damage);
  }
};

// ============================================================
// 视觉反馈处理器
// ============================================================

/**
 * 受击闪白
 * YAML: { type: flash_color, color: "#ffffff", duration: 0.1 }
 */
export const flashColor: RuleHandlerFn = (world, entityId, params, context) => {
  Visual.hitFlashTimer[entityId] = params['duration'] as number ?? 0.1;
};

/**
 * 颜色渐变过渡
 * YAML: { type: change_color, color: "#d32f2f", blend: 0.35 }
 */
export const changeColor: RuleHandlerFn = (world, entityId, params, context) => {
  // 颜色变化由渲染系统处理
  // 此处设置标记供 RenderSystem 读取
  // 通过 params.color 和 params.blend 插值
};

/**
 * 持续闪烁效果
 * YAML: { type: visual_flash_loop, alphaRange: [0.5, 1.0], speed: 8 }
 */
export const visualFlashLoop: RuleHandlerFn = (world, entityId, params, context) => {
  // 标记实体需要循环闪烁
};

// ============================================================
// 特效处理器
// ============================================================

/**
 * 播放粒子特效
 * YAML: { type: play_effect, effect: destruction_particles }
 */
export const playEffect: RuleHandlerFn = (world, entityId, params, context) => {
  const effectType = params['effect'] as string;
  // 创建特效实体，由 ParticleRenderer 处理
  switch (effectType) {
    case 'destruction_particles':
    case 'explosion_red':
    case 'explosion_orange':
    case 'ice_shatter':
    case 'electric_spark':
    case 'crystal_shatter':
    case 'bat_dissolve':
    case 'death_basic':
    case 'death_heavy':
    case 'death_magic':
    case 'death_soldier':
    case 'boss_rage':
    case 'boss_death':
    case 'boss_split':
    case 'gold_burst':
    case 'upgrade_gold':
    case 'upgrade_energy':
      // 创建 ExplosionEffect 实体
      break;
  }
};

/**
 * 生成弹道
 * YAML: { type: spawn_projectile, projectile: arrow }
 */
export const spawnProjectile: RuleHandlerFn = (world, entityId, params, context) => {
  const projectileType = params['projectile'] as string ?? 'arrow';
  // 由 AttackSystem 处理弹道生成
};

// ============================================================
// 音效处理器
// ============================================================

/**
 * 播放音效
 * YAML: { type: play_sound, sound: SFX_ARROW_SHOOT }
 */
export const playSound: RuleHandlerFn = (world, entityId, params, context) => {
  const soundId = params['sound'] as string;
  // Sound.play(soundId);
};

// ============================================================
// 经济相关处理器
// ============================================================

/**
 * 掉落金币
 * YAML: { type: drop_gold }
 */
export const dropGold: RuleHandlerFn = (world, entityId, params, context) => {
  // 从 UnitRef 配置读取奖励金币 → EconomySystem.addGold
};

/**
 * 随机掉落金币（宝箱）
 * YAML: { type: drop_gold_random, min: 50, max: 100 }
 */
export const dropGoldRandom: RuleHandlerFn = (world, entityId, params, context) => {
  const min = params['min'] as number ?? 0;
  const max = params['max'] as number ?? 0;
  const amount = min + Math.random() * (max - min);
  // EconomySystem.addGold(Math.floor(amount));
};

// ============================================================
// 状态相关处理器
// ============================================================

/**
 * 世界暂停
 * YAML: { type: pause_world, duration: 0.3 }
 */
export const pauseWorld: RuleHandlerFn = (world, entityId, params, context) => {
  const duration = params['duration'] as number ?? 0.3;
  // 设置全局暂停标记
};

/**
 * 进入二阶段
 * YAML: { type: enter_phase2 }
 */
export const enterPhase2: RuleHandlerFn = (world, entityId, params, context) => {
  // Boss进入二阶段 — 由HealthSystem检测并标记
};

/**
 * 分裂为子单位
 * YAML: { type: split_into, count: 2, unitType: boss_beast_spawn }
 */
export const splitInto: RuleHandlerFn = (world, entityId, params, context) => {
  const count = params['count'] as number ?? 2;
  const unitType = params['unitType'] as string;
  // 由 EntityFactory 创建子实体
};

// ============================================================
// 建筑相关处理器
// ============================================================

/**
 * 留下废墟
 * YAML: { type: leave_ruins }
 */
export const leaveRuins: RuleHandlerFn = (world, entityId, params, context) => {
  // 在实体位置创建废墟装饰实体
};

// ============================================================
// 所有预定义处理器的注册表
// ============================================================

import type { RuleHandlerFn } from '../core/RuleEngine.js';

/** 预定义处理器映射表 */
export const BUILTIN_HANDLERS: Record<string, RuleHandlerFn> = {
  // 战斗
  'deal_aoe_damage': dealAoeDamage,
  'deal_damage': dealDamage,
  // 视觉
  'flash_color': flashColor,
  'change_color': changeColor,
  'visual_flash_loop': visualFlashLoop,
  'visual_flash_bright': flashColor,  // same as flashColor
  'visual_dim': changeColor,          // dim = alpha reduction
  'visual_pulse': visualFlashLoop,    // pulse effect
  // 特效
  'play_effect': playEffect,
  'spawn_projectile': spawnProjectile,
  // 音效
  'play_sound': playSound,
  // 经济
  'drop_gold': dropGold,
  'drop_gold_random': dropGoldRandom,
  // 状态
  'pause_world': pauseWorld,
  'enter_phase2': enterPhase2,
  'split_into': splitInto,
  // 建筑
  'leave_ruins': leaveRuins,
  // Boss血条
  'hp_bar_boss': playEffect,
};
