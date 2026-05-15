import type { LevelFormModel, MapModel } from './levelModel.js';
import {
  LevelTheme, TowerType, UnitType, WeatherType, EnemyType,
  type LevelConfig, type MapConfig, type WaveConfig, type WaveEnemyGroup,
} from '../../types/index.js';

const ALL_TOWER_TYPES = Object.values(TowerType);

const THEME_MAP: Record<string, LevelTheme> = {
  plains: LevelTheme.Plains,
  desert: LevelTheme.Desert,
  tundra: LevelTheme.Tundra,
  volcano: LevelTheme.Volcano,
  castle: LevelTheme.Castle,
};

const WEATHER_MAP: Record<string, WeatherType> = {
  sunny: WeatherType.Sunny,
  rain: WeatherType.Rain,
  fog: WeatherType.Fog,
  snow: WeatherType.Snow,
  night: WeatherType.Night,
};

function adaptMap(m: MapModel): MapConfig {
  return {
    name: m.__extras?.['name'] as string | undefined ?? '',
    cols: m.cols,
    rows: m.rows,
    tileSize: m.tileSize,
    tiles: m.tiles as MapConfig['tiles'],
    spawns: m.spawns,
    pathGraph: m.pathGraph,
    tileColors: m.tileColors as MapConfig['tileColors'] | undefined,
  };
}

function adaptWave(w: LevelFormModel['waves'][number]): WaveConfig {
  const enemies: WaveEnemyGroup[] = w.enemies.map((e) => ({
    enemyType: e.enemyType as EnemyType,
    count: e.count,
    spawnInterval: e.spawnInterval,
    spawnId: e.spawnId,
  }));
  const wave: WaveConfig = { waveNumber: w.waveNumber, spawnDelay: w.spawnDelay, enemies };
  if (w.isBossWave) wave.isBossWave = true;
  return wave;
}

export function modelToLevelConfig(model: LevelFormModel): LevelConfig {
  const theme: LevelTheme = (model.theme ? THEME_MAP[model.theme] : undefined) ?? LevelTheme.Plains;

  const availableTowers: TowerType[] = model.available?.towers?.length
    ? (model.available.towers as TowerType[])
    : ALL_TOWER_TYPES;

  const availableUnits: UnitType[] = (model.available?.units ?? []) as UnitType[];

  const weatherPool = model.weather?.pool
    ?.map((w) => WEATHER_MAP[w])
    .filter((w): w is WeatherType => w !== undefined);

  const config: LevelConfig = {
    id: model.id,
    name: model.name,
    theme,
    description: model.description ?? '',
    map: adaptMap(model.map),
    waves: model.waves.map(adaptWave),
    startingGold: model.starting?.gold ?? 200,
    availableTowers,
    availableUnits,
    unlockStarsRequired: 0,
    unlockPrevLevelId: null,
  };

  if (model.sceneDescription) config.sceneDescription = model.sceneDescription;
  if (weatherPool?.length) config.weatherPool = weatherPool;
  if (model.weather?.changeInterval !== undefined) config.weatherChangeInterval = model.weather.changeInterval;

  return config;
}
