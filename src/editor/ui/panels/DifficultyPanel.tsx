import { useState } from 'preact/hooks';
import type { LevelFormModel, DifficultyMultipliers } from '../../state/levelModel.js';

const MULT_MIN = 0.1;
const MULT_MAX = 5.0;
const MULT_STEP = 0.1;
const MULT_DEFAULT = 1.0;

type MultField = keyof DifficultyMultipliers;

const FIELDS: ReadonlyArray<{ key: MultField; label: string }> = [
  { key: 'enemyHpMult', label: '敌人血量倍率' },
  { key: 'enemyDmgMult', label: '敌人伤害倍率' },
  { key: 'enemySpeedMult', label: '敌人速度倍率' },
  { key: 'goldRewardMult', label: '金币奖励倍率' },
];

export interface DifficultyPanelProps {
  model: LevelFormModel;
  onChange: (next: LevelFormModel) => void;
}

function patchDifficulty(model: LevelFormModel, field: MultField, value: number): LevelFormModel {
  const current = model.difficulty ?? {};
  const next: DifficultyMultipliers = { ...current, [field]: value };
  return { ...model, difficulty: next };
}

export function DifficultyPanel({ model, onChange }: DifficultyPanelProps) {
  const [errors, setErrors] = useState<Partial<Record<MultField, boolean>>>({});

  const getValue = (field: MultField): number =>
    model.difficulty?.[field] ?? MULT_DEFAULT;

  const handleChange = (field: MultField, raw: string): void => {
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < MULT_MIN || v > MULT_MAX) {
      setErrors((prev) => ({ ...prev, [field]: true }));
      return;
    }
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    onChange(patchDifficulty(model, field, Math.round(v * 10) / 10));
  };

  return (
    <fieldset data-testid="difficulty-panel" style={panelStyle}>
      <legend style={legendStyle}>难度乘数</legend>
      {FIELDS.map(({ key, label }) => {
        const val = getValue(key);
        const invalid = !!errors[key];
        return (
          <div key={key} style={rowStyle}>
            <label style={labelStyle}>{label}</label>
            <input
              type="range"
              data-testid={`difficulty-${key}-slider`}
              min={MULT_MIN}
              max={MULT_MAX}
              step={MULT_STEP}
              value={val}
              style={sliderStyle}
              onInput={(e) => handleChange(key, (e.currentTarget as HTMLInputElement).value)}
            />
            <input
              type="number"
              data-testid={`difficulty-${key}-input`}
              min={MULT_MIN}
              max={MULT_MAX}
              step={MULT_STEP}
              value={val}
              aria-invalid={invalid ? 'true' : undefined}
              style={{ ...numberInputStyle, borderColor: invalid ? '#c0392b' : '#2a2a3a' }}
              onInput={(e) => handleChange(key, (e.currentTarget as HTMLInputElement).value)}
            />
            <span style={unitStyle}>×</span>
          </div>
        );
      })}
    </fieldset>
  );
}

const panelStyle = {
  border: '1px solid #2a2a3a',
  borderRadius: 4,
  padding: '12px 16px',
  margin: '8px 0',
  background: '#15151e',
};

const legendStyle = {
  color: '#a0a0b0',
  fontSize: 12,
  padding: '0 6px',
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 8,
};

const labelStyle = {
  fontSize: 12,
  color: '#c0c0d0',
  minWidth: 100,
};

const sliderStyle = {
  flex: 1,
  accentColor: '#2a6a9a',
};

const numberInputStyle = {
  width: 64,
  background: '#0e0e16',
  border: '1px solid #2a2a3a',
  borderRadius: 3,
  color: '#d0d0e0',
  fontSize: 12,
  padding: '2px 6px',
  textAlign: 'right' as const,
};

const unitStyle = {
  fontSize: 12,
  color: '#666',
  minWidth: 12,
};
