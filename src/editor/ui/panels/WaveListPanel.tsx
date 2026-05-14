import { useState } from 'preact/hooks';
import type { LevelFormModel, WaveSpec, WaveEnemyGroup } from '../../state/levelModel.js';

export interface WaveListPanelProps {
  model: LevelFormModel;
  onChange: (next: LevelFormModel) => void;
}

const NON_NEG_INT = /^\d+$/;
const NON_NEG_NUM = /^\d+(\.\d+)?$/;

function parseNonNegInt(value: string): number | null {
  if (!NON_NEG_INT.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseNonNegNum(value: string): number | null {
  if (!NON_NEG_NUM.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function replaceWave(model: LevelFormModel, idx: number, patch: Partial<WaveSpec>): LevelFormModel {
  const waves = model.waves.map((w, i) => (i === idx ? { ...w, ...patch } : w));
  return { ...model, waves };
}

function replaceEnemy(
  model: LevelFormModel,
  waveIdx: number,
  enemyIdx: number,
  patch: Partial<WaveEnemyGroup>,
): LevelFormModel {
  const wave = model.waves[waveIdx];
  if (!wave) return model;
  const enemies = wave.enemies.map((e, i) => (i === enemyIdx ? { ...e, ...patch } : e));
  return replaceWave(model, waveIdx, { enemies });
}

export function WaveListPanel({ model, onChange }: WaveListPanelProps) {
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const setError = (key: string, bad: boolean): void => {
    setErrors((prev) => {
      if (bad === !!prev[key]) return prev;
      const next = { ...prev };
      if (bad) next[key] = true;
      else delete next[key];
      return next;
    });
  };

  const handleAddWave = (): void => {
    const nextNum = model.waves.length === 0
      ? 1
      : Math.max(...model.waves.map((w) => w.waveNumber)) + 1;
    const wave: WaveSpec = { waveNumber: nextNum, spawnDelay: 0, enemies: [] };
    onChange({ ...model, waves: [...model.waves, wave] });
  };

  const handleRemoveWave = (idx: number): void => {
    onChange({ ...model, waves: model.waves.filter((_, i) => i !== idx) });
  };

  const handleWaveNumber = (idx: number, value: string): void => {
    const key = `wave-${idx}-waveNumber`;
    const n = parseNonNegInt(value);
    if (n === null) {
      setError(key, true);
      return;
    }
    setError(key, false);
    onChange(replaceWave(model, idx, { waveNumber: n }));
  };

  const handleSpawnDelay = (idx: number, value: string): void => {
    const key = `wave-${idx}-spawnDelay`;
    const n = parseNonNegNum(value);
    if (n === null) {
      setError(key, true);
      return;
    }
    setError(key, false);
    onChange(replaceWave(model, idx, { spawnDelay: n }));
  };

  const handleBossToggle = (idx: number, checked: boolean): void => {
    const wave = model.waves[idx];
    if (!wave) return;
    const patch: Partial<WaveSpec> = checked
      ? { isBossWave: true }
      : { isBossWave: undefined };
    const updated: WaveSpec = { ...wave, ...patch };
    if (!checked) delete updated.isBossWave;
    const waves = model.waves.map((w, i) => (i === idx ? updated : w));
    onChange({ ...model, waves });
  };

  const handleAddEnemy = (waveIdx: number): void => {
    const wave = model.waves[waveIdx];
    if (!wave) return;
    const empty: WaveEnemyGroup = { enemyType: '', count: 0, spawnInterval: 0 };
    const enemies = [...wave.enemies, empty];
    onChange(replaceWave(model, waveIdx, { enemies }));
  };

  const handleRemoveEnemy = (waveIdx: number, enemyIdx: number): void => {
    const wave = model.waves[waveIdx];
    if (!wave) return;
    const enemies = wave.enemies.filter((_, i) => i !== enemyIdx);
    onChange(replaceWave(model, waveIdx, { enemies }));
  };

  const handleEnemyType = (waveIdx: number, enemyIdx: number, value: string): void => {
    onChange(replaceEnemy(model, waveIdx, enemyIdx, { enemyType: value }));
  };

  const handleEnemyCount = (waveIdx: number, enemyIdx: number, value: string): void => {
    const key = `wave-${waveIdx}-enemy-${enemyIdx}-count`;
    const n = parseNonNegInt(value);
    if (n === null) {
      setError(key, true);
      return;
    }
    setError(key, false);
    onChange(replaceEnemy(model, waveIdx, enemyIdx, { count: n }));
  };

  const handleEnemySpawnInterval = (waveIdx: number, enemyIdx: number, value: string): void => {
    const key = `wave-${waveIdx}-enemy-${enemyIdx}-spawnInterval`;
    const n = parseNonNegNum(value);
    if (n === null) {
      setError(key, true);
      return;
    }
    setError(key, false);
    onChange(replaceEnemy(model, waveIdx, enemyIdx, { spawnInterval: n }));
  };

  return (
    <fieldset class="editor-panel editor-panel-waves">
      <legend>波次</legend>

      <button type="button" data-testid="wave-add" onClick={handleAddWave}>
        + 添加波
      </button>

      {model.waves.map((wave, wi) => (
        <div key={wi} class="editor-wave-row" data-testid={`wave-row-${wi}`}>
          <div class="editor-wave-header">
            <label>
              <span>波号</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                data-testid={`wave-${wi}-waveNumber`}
                value={String(wave.waveNumber)}
                aria-invalid={errors[`wave-${wi}-waveNumber`] ? 'true' : undefined}
                onInput={(e) => handleWaveNumber(wi, (e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label>
              <span>出怪延迟 (秒)</span>
              <input
                type="text"
                inputMode="decimal"
                data-testid={`wave-${wi}-spawnDelay`}
                value={String(wave.spawnDelay)}
                aria-invalid={errors[`wave-${wi}-spawnDelay`] ? 'true' : undefined}
                onInput={(e) => handleSpawnDelay(wi, (e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                data-testid={`wave-${wi}-isBossWave`}
                checked={!!wave.isBossWave}
                onChange={(e) => handleBossToggle(wi, (e.currentTarget as HTMLInputElement).checked)}
              />
              <span>Boss 波</span>
            </label>
            <button
              type="button"
              data-testid={`wave-${wi}-remove`}
              onClick={() => handleRemoveWave(wi)}
            >
              删除波
            </button>
          </div>

          <div class="editor-enemy-list">
            <button
              type="button"
              data-testid={`wave-${wi}-enemy-add`}
              onClick={() => handleAddEnemy(wi)}
            >
              + 添加敌人编组
            </button>
            {wave.enemies.map((enemy, ei) => (
              <div key={ei} class="editor-enemy-row" data-testid={`wave-${wi}-enemy-${ei}`}>
                <label>
                  <span>敌人类型</span>
                  <input
                    type="text"
                    data-testid={`wave-${wi}-enemy-${ei}-enemyType`}
                    value={enemy.enemyType}
                    onInput={(e) => handleEnemyType(wi, ei, (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>数量</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    data-testid={`wave-${wi}-enemy-${ei}-count`}
                    value={String(enemy.count)}
                    aria-invalid={errors[`wave-${wi}-enemy-${ei}-count`] ? 'true' : undefined}
                    onInput={(e) => handleEnemyCount(wi, ei, (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>出怪间隔 (秒)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid={`wave-${wi}-enemy-${ei}-spawnInterval`}
                    value={String(enemy.spawnInterval)}
                    aria-invalid={errors[`wave-${wi}-enemy-${ei}-spawnInterval`] ? 'true' : undefined}
                    onInput={(e) => handleEnemySpawnInterval(wi, ei, (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <button
                  type="button"
                  data-testid={`wave-${wi}-enemy-${ei}-remove`}
                  onClick={() => handleRemoveEnemy(wi, ei)}
                >
                  删除编组
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
