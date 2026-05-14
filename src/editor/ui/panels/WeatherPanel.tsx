import type { LevelFormModel, WeatherSection } from '../../state/levelModel.js';
import { WeatherType } from '../../../types/index.js';

export interface WeatherPanelProps {
  model: LevelFormModel;
  onChange: (next: LevelFormModel) => void;
}

const WEATHER_OPTIONS: ReadonlyArray<string> = Object.values(WeatherType);
const RANDOM = 'random_from_pool';

function toggle(list: string[], value: string, checked: boolean): string[] {
  if (checked) return list.includes(value) ? list : [...list, value];
  return list.filter((v) => v !== value);
}

function emptySection(): WeatherSection {
  return { pool: [], initial: RANDOM };
}

function patchPool(model: LevelFormModel, value: string, checked: boolean): LevelFormModel {
  const current = model.weather ?? emptySection();
  const weather: WeatherSection = {
    ...current,
    pool: toggle(current.pool, value, checked),
  };
  return { ...model, weather };
}

function patchInitial(model: LevelFormModel, initial: string): LevelFormModel {
  const current = model.weather ?? emptySection();
  return { ...model, weather: { ...current, initial } };
}

export function WeatherPanel({ model, onChange }: WeatherPanelProps) {
  const pool = model.weather?.pool ?? [];
  const initial = model.weather?.initial ?? RANDOM;

  return (
    <fieldset class="editor-panel editor-panel-weather">
      <legend>天气</legend>

      <div class="editor-subsection">
        <h4>天气池</h4>
        <div class="editor-checkbox-grid">
          {WEATHER_OPTIONS.map((t) => (
            <label key={t} class="editor-checkbox-item">
              <input
                type="checkbox"
                data-testid={`weather-pool-${t}`}
                checked={pool.includes(t)}
                onChange={(e) => onChange(patchPool(model, t, (e.currentTarget as HTMLInputElement).checked))}
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </div>

      <div class="editor-subsection">
        <h4>初始天气</h4>
        <div class="editor-radio-grid">
          <label class="editor-radio-item">
            <input
              type="radio"
              name="weather-initial"
              data-testid={`weather-initial-${RANDOM}`}
              checked={initial === RANDOM}
              onChange={(e) => {
                if ((e.currentTarget as HTMLInputElement).checked) onChange(patchInitial(model, RANDOM));
              }}
            />
            <span>从池中随机</span>
          </label>
          {WEATHER_OPTIONS.map((t) => (
            <label key={t} class="editor-radio-item">
              <input
                type="radio"
                name="weather-initial"
                data-testid={`weather-initial-${t}`}
                checked={initial === t}
                onChange={(e) => {
                  if ((e.currentTarget as HTMLInputElement).checked) onChange(patchInitial(model, t));
                }}
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
