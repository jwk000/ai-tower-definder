import type { LevelConfig } from '../../types/index.js';
import { LEVEL_01 } from './level-01.js';
import { LEVEL_02 } from './level-02.js';
import { LEVEL_03 } from './level-03.js';
import { LEVEL_04 } from './level-04.js';
import { LEVEL_05 } from './level-05.js';

export const LEVELS: LevelConfig[] = [LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04, LEVEL_05];

export const LEVEL_CONFIGS: Record<string, LevelConfig> = {
  [LEVEL_01.id]: LEVEL_01,
  [LEVEL_02.id]: LEVEL_02,
  [LEVEL_03.id]: LEVEL_03,
  [LEVEL_04.id]: LEVEL_04,
  [LEVEL_05.id]: LEVEL_05,
};

export const LEVEL_ORDER = [LEVEL_01.id, LEVEL_02.id, LEVEL_03.id, LEVEL_04.id, LEVEL_05.id] as const;
