import type { RunState } from '../ui/HUD.js';

/**
 * HudPhase — HUD 可识别的所有相位标签。
 *
 * 与 WaveSystem 的 `WavePhase` 取交集 + HUD 独有：
 *   - 共享: 'deployment' | 'battle' | 'wave-break'
 *   - WaveSystem 独有: 'completed' （由 RunController 映射成 'victory'）
 *   - HUD 独有:   'victory' | 'defeat' （RunController 在通关/失败时直接 set）
 */
export type HudPhase = RunState['phase'];

export class LevelState {
  waveIndex = 0;
  waveTotal = 0;
  phase: HudPhase = 'deployment';

  reset(waveTotal: number): void {
    this.waveIndex = 0;
    this.waveTotal = waveTotal;
    this.phase = 'deployment';
  }
}
