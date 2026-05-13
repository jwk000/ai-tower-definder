// ============================================================
// Tower Defender — Configuration Loader
// ============================================================
// Loads YAML config files (bundled by Vite via import.meta.glob)
// and populates the unit config registry.
// ============================================================

import { load as parseYaml } from 'js-yaml';
import type { UnitConfig } from './registry.js';
import { unitConfigRegistry } from './registry.js';
import type { CardConfig } from './cardRegistry.js';
import { cardConfigRegistry } from './cardRegistry.js';

// ---- Bundled YAML modules ----
// Vite bundles all *.yaml files in config/ as raw strings at build time.
// Eager loading: all files are available synchronously — no runtime fetch.
const yamlModules = import.meta.glob('./**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// ---- Level Config (minimal — full spec in Phase 3) ----

export interface LevelConfig {
  id: string;
  name: string;
  theme?: string;
  description?: string;
  [extras: string]: unknown;
}

// ---- Public API ----

/**
 * Load and parse a single YAML config file by its path (relative to loader.ts).
 *
 * @example
 *   const data = await loadYamlConfig<MyConfig>('./units/towers.yaml');
 *
 * @throws If the path is not found in the bundled modules.
 */
export async function loadYamlConfig<T>(path: string): Promise<T> {
  const content = yamlModules[path];
  if (content === undefined) {
    throw new Error(
      `[ConfigLoader] Config not found: "${path}". ` +
        `Available: ${Object.keys(yamlModules).join(', ') || '(none)'}`,
    );
  }
  try {
    return parseYaml(content) as T;
  } catch (err) {
    throw new Error(
      `[ConfigLoader] Failed to parse YAML in "${path}": ${(err as Error).message}`,
    );
  }
}

/**
 * Load all unit configs from `src/config/units/*.yaml` and register them.
 *
 * Each YAML file may contain multiple units keyed by ID:
 * ```yaml
 * arrow_tower:
 *   category: Tower
 *   ...
 * cannon_tower:
 *   category: Tower
 *   ...
 * ```
 *
 * @returns All loaded unit configs (also available via unitConfigRegistry).
 */
export async function loadAllUnitConfigs(): Promise<UnitConfig[]> {
  const configs: UnitConfig[] = [];

  const unitPaths = Object.keys(yamlModules).filter((p) => p.startsWith('./units/'));

  for (const path of unitPaths) {
    const content = yamlModules[path]!;
    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (err) {
      throw new Error(
        `[ConfigLoader] Failed to parse unit config "${path}": ${(err as Error).message}`,
      );
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(
        `[ConfigLoader] Unit config "${path}" must be a YAML mapping with unit IDs as keys.`,
      );
    }

    const record = parsed as Record<string, Record<string, unknown>>;

    for (const [id, rawConfig] of Object.entries(record)) {
      if (typeof rawConfig !== 'object' || rawConfig === null) {
        throw new Error(
          `[ConfigLoader] Unit "${id}" in "${path}" must be a YAML mapping.`,
        );
      }

      const config: UnitConfig = {
        id,
        ...rawConfig,
      } as UnitConfig;

      // Register immediately so it's available to later steps
      unitConfigRegistry.register(config);
      configs.push(config);
    }
  }

  return configs;
}

/**
 * Load all level configs from `src/config/levels/*.yaml`.
 *
 * Each file may contain either:
 * - A single level mapping (keyed by level ID)
 * - An array of level mappings
 *
 * @returns All loaded level configs.
 */
export async function loadLevelConfigs(): Promise<LevelConfig[]> {
  const configs: LevelConfig[] = [];

  const levelPaths = Object.keys(yamlModules).filter((p) => p.startsWith('./levels/'));

  for (const path of levelPaths) {
    const content = yamlModules[path]!;
    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (err) {
      throw new Error(
        `[ConfigLoader] Failed to parse level config "${path}": ${(err as Error).message}`,
      );
    }

    if (Array.isArray(parsed)) {
      // File contains a list of levels
      for (const item of parsed) {
        configs.push(item as LevelConfig);
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      // File contains one or more levels keyed by ID
      const record = parsed as Record<string, Record<string, unknown>>;
      for (const [id, rawConfig] of Object.entries(record)) {
        configs.push({ id, ...rawConfig } as LevelConfig);
      }
    }
  }

  return configs;
}

/**
 * Load all card configs from `src/config/cards/**\/*.yaml` and register them.
 *
 * Each YAML file may contain multiple cards keyed by ID, same shape as units:
 * ```yaml
 * card_arrow_tower:
 *   name: 箭塔
 *   type: unit
 *   energyCost: 3
 *   rarity: common
 *   unitConfigId: arrow_tower
 *   placement:
 *     targetType: tile
 * ```
 *
 * Returns an empty array if no card YAMLs are present (Phase A1.1 placeholder).
 */
export async function loadAllCardConfigs(): Promise<CardConfig[]> {
  const configs: CardConfig[] = [];

  const cardPaths = Object.keys(yamlModules).filter((p) => p.startsWith('./cards/'));

  for (const path of cardPaths) {
    const content = yamlModules[path]!;
    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (err) {
      throw new Error(
        `[ConfigLoader] Failed to parse card config "${path}": ${(err as Error).message}`,
      );
    }

    if (parsed === null || parsed === undefined) {
      continue;
    }

    if (typeof parsed !== 'object') {
      throw new Error(
        `[ConfigLoader] Card config "${path}" must be a YAML mapping with card IDs as keys.`,
      );
    }

    const record = parsed as Record<string, Record<string, unknown>>;

    for (const [id, rawConfig] of Object.entries(record)) {
      if (typeof rawConfig !== 'object' || rawConfig === null) {
        throw new Error(
          `[ConfigLoader] Card "${id}" in "${path}" must be a YAML mapping.`,
        );
      }

      const config: CardConfig = {
        id,
        ...rawConfig,
      } as CardConfig;

      cardConfigRegistry.register(config);
      configs.push(config);
    }
  }

  return configs;
}
