# Tower Defender — Buff Visual Effects Design

> 版本：v0.2 | 日期：2026-05-07

## Overview

Comprehensive list of all buff/debuff visual effects with their visual representation.

## Buff Visual Effects Table

| Buff | Visual Effect | Status |
|------|--------------|--------|
| Taunt (enemy on unit) | Enemy gets red glow/outline; unit gets shield icon above | Design |
| Ice Slow | Enemy tinted blue (lerp #4488cc); frost particles (future) | Implemented |
| Frozen | Enemy becomes bright cyan (#00bcd4); stop animation | Implemented |
| Whirlwind | Swordsman spins (rotate render); white slash lines | Design |
| Gold income | Gold sparkle particles at Gold Mine | Design |
| Energy income | Small blue pulse at Energy Tower | Design |
| Phase 2 (Boss) | Boss size 1.3x, color shift to redder (#d32f2f), crown appears | Implemented |
| Heal (future) | Green flash overlay | Planned |
| Poison (future) | Green tint + floating damage numbers | Planned |
| Speed Boost | Yellow tint + trail effect | Design |
| Hit Flash | White flash (#ffffff) on damage for 1 frame | Implemented |

## Implementation Notes

### Ice Slow
- In `RenderSystem.drawEntities()`, check for `BuffContainer` with `ice_slow` buff
- Blend original color toward `#4488cc` based on `currentStacks / maxStacks`
- Lerp factor: `t = min(stacks/5, 1) * 0.7`

### Frozen
- In `RenderSystem.drawEntities()`, check for `BuffContainer` with `ice_frozen` buff
- Override color to `#00bcd4`, set alpha to 1
- Takes priority over ice_slow tint

### Boss Phase 2
- In `RenderSystem.drawEntities()`, check `Boss.phase === 2`
- Size already multiplied by 1.3x
- Tint color toward `#d32f2f` by 35% lerp

### Hit Flash
- `Render.hitFlashTimer` set to 0.12 on damage (ProjectileSystem)
- In `RenderSystem.drawEntities()`, if `hitFlashTimer > 0`, override to `#ffffff`
- Reset `hitFlashTimer` to 0 after consuming (1-frame flash)

### Future Effects
- Particles should use a separate particle system (Phase 4)
- Rotate render for Whirlwind requires `rotation` field on `RenderCommand`
- Trail effects need framebuffer or previous-position rendering
