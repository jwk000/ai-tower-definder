import { useState } from 'preact/hooks';
import type { LevelFormModel, StartingResources } from '../../state/levelModel.js';

export interface StartingPanelProps {
  model: LevelFormModel;
  onChange: (next: LevelFormModel) => void;
}

type FieldKey = 'gold' | 'energy' | 'maxPopulation';

const FIELDS: ReadonlyArray<{ key: FieldKey; label: string }> = [
  { key: 'gold', label: '起始金币' },
  { key: 'energy', label: '起始能量' },
  { key: 'maxPopulation', label: '人口上限' },
];

function parseIntStrict(raw: string): number | null {
  if (raw === '') return null;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  return Number(raw);
}

function patchStarting(
  model: LevelFormModel,
  key: FieldKey,
  value: number | null,
): LevelFormModel {
  const current: StartingResources = model.starting ?? {};
  const nextStarting: StartingResources = { ...current };
  if (value === null) {
    delete nextStarting[key];
  } else {
    nextStarting[key] = value;
  }
  const isEmpty = nextStarting.gold === undefined
    && nextStarting.energy === undefined
    && nextStarting.maxPopulation === undefined;
  const next: LevelFormModel = { ...model };
  if (isEmpty) {
    delete next.starting;
  } else {
    next.starting = nextStarting;
  }
  return next;
}

export function StartingPanel({ model, onChange }: StartingPanelProps) {
  const [invalid, setInvalid] = useState<Record<FieldKey, boolean>>({
    gold: false,
    energy: false,
    maxPopulation: false,
  });

  const handleInput = (key: FieldKey, raw: string): void => {
    const parsed = parseIntStrict(raw);
    if (Number.isNaN(parsed)) {
      setInvalid((prev) => ({ ...prev, [key]: true }));
      return;
    }
    setInvalid((prev) => ({ ...prev, [key]: false }));
    onChange(patchStarting(model, key, parsed));
  };

  return (
    <fieldset class="editor-panel editor-panel-starting">
      <legend>起始资源</legend>
      {FIELDS.map(({ key, label }) => {
        const current = model.starting?.[key];
        const displayValue = current === undefined ? '' : String(current);
        const isInvalid = invalid[key];
        return (
          <label key={key} class="editor-field">
            <span class="editor-field-label">{label}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              data-testid={`starting-${key}`}
              aria-invalid={isInvalid ? 'true' : 'false'}
              value={displayValue}
              onInput={(e) => handleInput(key, (e.currentTarget as HTMLInputElement).value)}
            />
            {isInvalid && (
              <span class="editor-field-error" data-testid={`starting-${key}-error`}>
                请输入非负整数
              </span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
