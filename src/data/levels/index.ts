import type { LevelConfig } from '../../types/index.js';
import { loadLevelsFromYaml } from './yamlBridge.js';

let levels: LevelConfig[];
try {
  levels = loadLevelsFromYaml();
  if (levels.length === 0) {
    throw new Error('[levels] yamlBridge returned 0 levels');
  }
} catch (err) {
  console.error('[levels] Failed to load levels from YAML, runtime will have no levels:', err);
  levels = [];
}

export const LEVELS: LevelConfig[] = levels;
