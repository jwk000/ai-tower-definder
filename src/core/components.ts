import { defineComponent, Types } from 'bitecs';

export const FactionTeam = {
  Player: 1,
  Enemy: 2,
  Neutral: 3,
} as const;
export type FactionTeamValue = (typeof FactionTeam)[keyof typeof FactionTeam];

export const UnitCategory = {
  Tower: 1,
  Soldier: 2,
  Enemy: 3,
  Building: 4,
  Trap: 5,
  Neutral: 6,
  Objective: 7,
} as const;
export type UnitCategoryValue = (typeof UnitCategory)[keyof typeof UnitCategory];

export const VisualShape = {
  Square: 1,
  Circle: 2,
  Triangle: 3,
} as const;
export type VisualShapeValue = (typeof VisualShape)[keyof typeof VisualShape];

export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

export const Health = defineComponent({
  current: Types.i32,
  max: Types.i32,
});

export const Movement = defineComponent({
  speed: Types.f32,
  vx: Types.f32,
  vy: Types.f32,
  pathIndex: Types.ui16,
});

export const Visual = defineComponent({
  shape: Types.ui8,
  color: Types.ui32,
  size: Types.f32,
});

export const Faction = defineComponent({
  team: Types.ui8,
});

export const UnitTag = defineComponent({
  category: Types.ui8,
  unitId: Types.ui16,
});

export const Owner = defineComponent({
  parent: Types.i32,
});

export const Attack = defineComponent({
  damage: Types.i32,
  range: Types.f32,
  cooldown: Types.f32,
  cooldownLeft: Types.f32,
});

export const DeadTag = defineComponent();
export const JustSpawnedTag = defineComponent();
