import { EnemyType, type WaveConfig, type WaveEnemyGroup } from '../types/index.js';

function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const STATIC_ENEMY_COSTS = {
  [EnemyType.Grunt]: 10,
  [EnemyType.Runner]: 12,
  [EnemyType.Heavy]: 25,
  [EnemyType.Mage]: 22,
  [EnemyType.Exploder]: 18,
  [EnemyType.BossCommander]: 80,
  [EnemyType.BossBeast]: 100,
  [EnemyType.HotAirBalloon]: 28,
  [EnemyType.Shaman]: 25,
  [EnemyType.Juggernaut]: 40,
} satisfies Partial<Record<EnemyType, number>>;

const ENEMY_COSTS: Record<EnemyType, number> = (() => {
  const merged = { ...STATIC_ENEMY_COSTS } as Record<EnemyType, number>;
  for (const type of Object.values(EnemyType)) {
    if (!(type in merged)) merged[type] = 15;
  }
  return merged;
})();

export function generateEndlessWave(waveNumber: number): WaveConfig {
  const hpMultiplier = 1 + (waveNumber - 1) * 0.15;
  const enemyTypes: EnemyType[] = [];

  if (waveNumber >= 1) enemyTypes.push(EnemyType.Grunt);
  if (waveNumber >= 3) enemyTypes.push(EnemyType.Runner);
  if (waveNumber >= 5) enemyTypes.push(EnemyType.Heavy);
  if (waveNumber >= 8) enemyTypes.push(EnemyType.Mage);
  if (waveNumber >= 10) enemyTypes.push(EnemyType.Exploder);

  const isBossWave = waveNumber % 5 === 0;
  const enemyCount = Math.floor(4 + waveNumber * 1.5);

  const enemies: WaveEnemyGroup[] = [];

  if (isBossWave) {
    const r = hash(waveNumber * 1000 + 1);
    const bossType = r < 0.5 ? EnemyType.BossCommander : EnemyType.BossBeast;
    enemies.push({ enemyType: bossType, count: 1, spawnInterval: 0 });
  }

  let remainingBudget = enemyCount * 10;

  interface WeightGroup {
    type: EnemyType;
    weight: number;
  }

  let weights: WeightGroup[];

  if (waveNumber <= 5) {
    weights = [
      { type: EnemyType.Grunt, weight: 60 },
      { type: EnemyType.Runner, weight: 30 },
      { type: EnemyType.Exploder, weight: 10 },
    ];
  } else if (waveNumber <= 10) {
    weights = [
      { type: EnemyType.Grunt, weight: 30 },
      { type: EnemyType.Runner, weight: 25 },
      { type: EnemyType.Heavy, weight: 15 },
      { type: EnemyType.Mage, weight: 15 },
      { type: EnemyType.Exploder, weight: 15 },
    ];
  } else if (waveNumber <= 20) {
    weights = [
      { type: EnemyType.Grunt, weight: 15 },
      { type: EnemyType.Runner, weight: 20 },
      { type: EnemyType.Heavy, weight: 25 },
      { type: EnemyType.Mage, weight: 25 },
      { type: EnemyType.Exploder, weight: 15 },
    ];
  } else {
    weights = [
      { type: EnemyType.Grunt, weight: 5 },
      { type: EnemyType.Runner, weight: 10 },
      { type: EnemyType.Heavy, weight: 35 },
      { type: EnemyType.Mage, weight: 35 },
      { type: EnemyType.Exploder, weight: 15 },
    ];
  }

  weights = weights.filter((w) => enemyTypes.includes(w.type));
  const totalWeight = weights.reduce((s, g) => s + g.weight, 0);

  if (totalWeight > 0 && remainingBudget > 0) {
    for (let i = 0; i < weights.length && remainingBudget > 0; i++) {
      const g = weights[i]!;
      const cost = ENEMY_COSTS[g.type] ?? 10;
      const count = Math.max(1, Math.floor((g.weight / totalWeight) * remainingBudget / cost));
      const capped = Math.min(count, 40);
      enemies.push({
        enemyType: g.type,
        count: capped,
        spawnInterval: Math.max(0.3, 2.0 - waveNumber * 0.02),
      });
      remainingBudget -= capped * cost;
    }
  }

  if (enemies.length === 0) {
    enemies.push({ enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.0 });
  }

  const spawnDelay = Math.max(0.5, 3.0 - waveNumber * 0.1);

  return {
    waveNumber,
    enemies,
    spawnDelay,
    isBossWave,
  };
}
