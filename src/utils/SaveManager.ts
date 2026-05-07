interface SaveData {
  version: number;
  unlockedLevels: number;
  levelStars: Record<number, number>;
  highScores: Record<number, number>;
  totalGold: number;
}

export class SaveManager {
  static readonly KEY = 'tower-defender-save';

  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SaveManager.KEY);
      if (!raw) return SaveManager.getDefaults();
      const data = JSON.parse(raw) as Partial<SaveData>;
      const defaults = SaveManager.getDefaults();

      if (data.version !== 1) return defaults;

      return {
        version: data.version ?? defaults.version,
        unlockedLevels: data.unlockedLevels ?? defaults.unlockedLevels,
        levelStars: { ...defaults.levelStars, ...data.levelStars },
        highScores: { ...defaults.highScores, ...data.highScores },
        totalGold: data.totalGold ?? defaults.totalGold,
      };
    } catch {
      return SaveManager.getDefaults();
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SaveManager.KEY, JSON.stringify(data));
    } catch {
      console.warn('[SaveManager] Failed to write save data');
    }
  }

  static unlockLevel(levelId: number): void {
    const data = SaveManager.load();
    if (levelId > data.unlockedLevels) {
      data.unlockedLevels = levelId;
    }
    SaveManager.save(data);
  }

  static setStars(levelId: number, stars: number): void {
    const data = SaveManager.load();
    const prev = data.levelStars[levelId] ?? 0;
    if (stars > prev) {
      data.levelStars[levelId] = stars;
    }
    SaveManager.save(data);
  }

  static resetAll(): void {
    SaveManager.save(SaveManager.getDefaults());
  }

  static getDefaults(): SaveData {
    return { version: 1, unlockedLevels: 1, levelStars: {}, highScores: {}, totalGold: 0 };
  }
}
