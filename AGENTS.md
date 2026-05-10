# AGENTS.md — Tower Defender

> 设计文档: `design/README.md` | 重构方案: `design/15-refactoring-plan.md`

## ⛔ 核心铁律：每完成一个任务立即提交代码

> **这是最重要的规范，优先级高于一切。违反此规则视为任务未完成。**

- **触发时机**: 每完成一个逻辑任务单元（功能实现/修复/重构完成），不等用户提醒，立即执行 `git add` + `git commit`
- **提交信息**: 使用任务描述作为 commit message，格式：`feat/fix/refactor: <简短描述>`
- **绝不**: 累积多个任务的改动后一并提交
- **绝不**: 等待用户提醒才提交

## ⛔ 回归铁律：新增/修改需求不得破坏已有功能

> **信任基石。违反此规则比代码报错更严重。**

- **禁止行为**: 新增功能或修改需求时，导致其他已有需求对应的功能失效、行为异常或结果错误。
- **允许行为**: 在保持外部行为不变的前提下，等价重构原有功能的内部实现（优化结构、提取公共逻辑、改善可读性等）。
- **变更前检查**: 修改任何已有模块前，必须先理解该模块当前服务的所有需求 —— 不清楚就先查，不要猜。
- **变更后验证**: 修改完成后，必须验证所有关联需求仍然正常工作。不确定影响范围时，主动列出受影响的需求清单向用户确认。
- **提交说明**: 如果某次修改不可避免影响了已有行为，必须在 commit message 中明确说明影响范围和原因。

## ⛔ 测试铁律：测试驱动开发（TDD），每次变更必须全量测试通过

> **质量防线。测试不通过 = 任务未完成。**

- **需求即测试**: 每个需求必须有对应的测试用例，无测试的需求视为未完成。
- **TDD 流程**: 先写测试 → 测试失败（红）→ 实现功能（绿）→ 重构优化（不破绿）。
- **全量通过**: 每次需求变更完成后，必须运行 `npm test` 确保所有已有测试通过。任何测试失败都必须在提交前修复。
- **禁止行为**: 通过删除测试、跳过断言、`test.skip` 等方式"通过"测试。
- **允许行为**: 当需求确实变更导致旧测试不再适用时，可以修改测试以匹配新需求，但必须在 commit message 中说明。
- **提交前检查**: `npm run typecheck && npm test` 均通过后方可提交。

## Build & Run

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # TypeScript only, no emit
npm test             # vitest
npm run release      # clean + typecheck + build
.\build.ps1 <cmd>    # Windows wrapper (or `make <cmd>`)
```

Build pipeline enforces: `typecheck → clean → build`. Broken types = no build.

## Architecture

Custom ECS (Entity-Component-System) with PixiJS WebGL rendering — 100% procedural geometry, composite shape units.

```
src/
  core/         Game.ts (loop + orchestrator), World.ts (entity storage + queries)
  components/   Pure data: Position, Render, Health, Attack, Tower, Enemy, etc.
  systems/      Logic: RenderSystem, MovementSystem, AttackSystem, WaveSystem, etc.
  render/       Renderer.ts — command-buffer pattern, design res 1920×1080
  input/        InputManager.ts — queue-buffered, flushed per frame
  data/         gameData.ts — tower/enemy/wave/map configs
  types/        index.ts — all shared types, CType component constants
  main.ts       Entry — wires game, systems, input dispatch
```

### ECS rules

- Components: `readonly type = CType.Xxx` string tag; rest is mutable state.
- Systems: declare `readonly requiredComponents` array; `update(entities, dt)` called each frame on matching entities.
- `World.query(...types)` returns entities with ALL types (AND logic).
- System registration order matters — update order and render layering are positional.
- Dead entities are batch-cleaned at end of `World.update()`, after all systems run.

### Render layering

1. `RenderSystem` runs last among scene systems — draws map tiles first, then entities (sorted by Y).
2. `UISystem` registered after `RenderSystem` — draws UI shapes on top.
3. `onPostRender` callback draws text overlay **after** `endFrame()` flushes the command buffer.

### Input dispatch

- `InputManager` queues events; `flush()` called each frame.
- `onPointerDown` in main.ts: checks UI buttons first, then build placement.
- Don't route through UI if x < 160 or y < 60 (UI panel zone).

### TypeScript quirks

- `noUncheckedIndexedAccess: true` — every array index returns `T | undefined`. Must handle.
- Imports use `.js` extension (`import { Foo } from './bar.js'`) — required by Vite's `bundler` moduleResolution.
- Path aliases: `@/`, `@core/`, `@components/`, `@systems/`, `@data/`, `@ui/`, `@render/`, `@input/`, `@utils/`, `@types/`.
- `strict: true`, `noImplicitOverride: true`, `forceConsistentCasingInFileNames: true`.

### Game state

`GamePhase` enum drives behavior: `Deployment → Battle → WaveBreak → Victory/Defeat`. Systems read phase via callbacks, not direct state.

### Adding content

- Towers: add to `TowerType` enum → `TOWER_CONFIGS` record → `BuildSystem` UI.
- Enemies: add to `EnemyType` enum → `ENEMY_CONFIGS` record → `WaveSystem` spawning.
- New component: add `CType` key → create component file → add to relevant system's `requiredComponents`.

## Development Workflow

1. **Design first, code second.** Every feature starts with a design document. Code must match the document — document is the source of truth.
2. **Code review against docs.** After writing code, a review agent validates code and document consistency. Document always takes precedence; code must be fixed to match.
3. **Atomic tasks, atomic commits.** Break down all development work into single-purpose tasks. Each task does exactly one thing. Commit immediately after completing a task, with the commit message being the task description.
4. **Change requests go to docs first.** Any acceptance issue or requirement change must be recorded in the document before modifying code.
5. **Always reply in Chinese.** All communication in this project must be in Chinese.
6. **Development log.** An agent must write a development log at the end of each conversation. Logs are kept with full history, organized by date (one file per day).
