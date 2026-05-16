# dev-log: Wave 7 性能基线 — 2026-05-16

## 测量环境

- 运行环境: Node.js / tsx（无 Pixi / DOM，纯逻辑层）
- 脚本: `debug/perf-baseline.ts`
- 帧数: 600 frames @ DT=1/60s（模拟 10s@60fps）
- 场景规模: 5 塔 + 50 预生成敌人 + WaveSystem（10 wave × 5 grunt，intervalMs=200）

## 结果

| 指标 | 实测 | 目标 | 状态 |
|------|------|------|------|
| avg  | 0.010 ms | ≤ 16.67 ms | ✅ |
| p95  | 0.027 ms | ≤ 22 ms    | ✅ |
| p99  | 0.079 ms | — | — |
| max  | 0.749 ms | — | — |

## 结论

逻辑层（ECS pipeline：WaveSystem + Movement + Attack + Projectile + Crystal + Health + Lifecycle）在当前规模下**远低于帧时目标**。avg/p95 均比目标低 2-3 个数量级，Node.js 内纯逻辑无瓶颈。

## 说明

测量不含 Pixi WebGL 渲染开销（Renderer.app 不存在于 Node.js）。实际浏览器帧时主要由：

1. PixiJS 渲染（WebGL batch draw）
2. EntityViewSink 的 Graphics/Text 更新
3. JS GC（Pixi Sprite pool）

上述三项在浏览器 devtools 中用帧率监控（F12 → Performance tab）评估更直接。当前阶段无 Renderer 接入性能回路，不需要 Wave 8 跟进逻辑层优化。

## Wave 8 跟进项（渲染层，非逻辑层）

- 如出现 FPS 抖动，优先检查 EntityViewSink 每帧 Graphics.clear()+redraw 数量
- 考虑 Sprite pool（batch renderer）替代 drawRect 调用（Wave 8 可选）
