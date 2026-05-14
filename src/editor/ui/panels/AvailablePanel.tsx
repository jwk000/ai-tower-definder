import type { LevelFormModel, AvailableContent } from '../../state/levelModel.js';
import { TowerType, UnitType } from '../../../types/index.js';

export interface AvailablePanelProps {
  model: LevelFormModel;
  onChange: (next: LevelFormModel) => void;
}

const TOWER_OPTIONS: ReadonlyArray<string> = Object.values(TowerType);
const UNIT_OPTIONS: ReadonlyArray<string> = Object.values(UnitType);

function toggle(list: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return list.includes(value) ? list : [...list, value];
  }
  return list.filter((v) => v !== value);
}

function patchAvailable(
  model: LevelFormModel,
  kind: 'towers' | 'units',
  value: string,
  checked: boolean,
): LevelFormModel {
  const current: AvailableContent = model.available ?? { towers: [], units: [] };
  const next: AvailableContent = {
    towers: kind === 'towers' ? toggle(current.towers, value, checked) : current.towers,
    units: kind === 'units' ? toggle(current.units, value, checked) : current.units,
  };
  return { ...model, available: next };
}

export function AvailablePanel({ model, onChange }: AvailablePanelProps) {
  const towers = model.available?.towers ?? [];
  const units = model.available?.units ?? [];

  return (
    <fieldset class="editor-panel editor-panel-available">
      <legend>可用内容</legend>

      <div class="editor-subsection">
        <h4>防御塔</h4>
        <div class="editor-checkbox-grid">
          {TOWER_OPTIONS.map((tower) => (
            <label key={tower} class="editor-checkbox-item">
              <input
                type="checkbox"
                data-testid={`available-tower-${tower}`}
                checked={towers.includes(tower)}
                onChange={(e) => onChange(patchAvailable(model, 'towers', tower, (e.currentTarget as HTMLInputElement).checked))}
              />
              <span>{tower}</span>
            </label>
          ))}
        </div>
      </div>

      <div class="editor-subsection">
        <h4>士兵单位</h4>
        <div class="editor-checkbox-grid">
          {UNIT_OPTIONS.map((unit) => (
            <label key={unit} class="editor-checkbox-item">
              <input
                type="checkbox"
                data-testid={`available-unit-${unit}`}
                checked={units.includes(unit)}
                onChange={(e) => onChange(patchAvailable(model, 'units', unit, (e.currentTarget as HTMLInputElement).checked))}
              />
              <span>{unit}</span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
