import type { LevelConfig } from '../../types/index.js';
import { parseYamlToModel } from '../../editor/state/levelModel.js';
import { modelToLevelConfig } from '../../editor/state/modelToLevelConfig.js';

const levelYamlModules = import.meta.glob('../../config/levels/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function loadLevelsFromYaml(): LevelConfig[] {
  const entries = Object.entries(levelYamlModules).sort(([a], [b]) => a.localeCompare(b));
  const levels: LevelConfig[] = [];

  for (const [path, content] of entries) {
    try {
      const model = parseYamlToModel(content);
      const config = modelToLevelConfig(model);
      levels.push(config);
    } catch (err) {
      console.error(`[yamlBridge] Failed to load level from ${path}:`, err);
      throw new Error(
        `[yamlBridge] Failed to load level YAML "${path}": ${(err as Error).message}`,
      );
    }
  }

  return levels;
}
