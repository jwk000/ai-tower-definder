# AGENTS.md — Tower Defender

> 设计文档: `design/README.md` | 重构方案: `design/17-refactoring-plan.md`

## Build & Run

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # TypeScript only, no emit
npm test             # vitest (no tests written yet)
npm run release      # clean + typecheck + build
.\build.ps1 <cmd>    # Windows wrapper (or `make <cmd>`)
```

Build pipeline enforces: `typecheck → clean → build`. Broken types = no build.

## Architecture

Custom ECS (Entity-Component-System) with pure Canvas 2D — no game frameworks.

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
