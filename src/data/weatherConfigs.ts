import { WeatherType, BuffAttribute, type WeatherConfig } from '../types/index.js';

export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  [WeatherType.Sunny]: {
    type: WeatherType.Sunny,
    name: '晴天',
    modifiers: [
      { targetType: 'laser_tower', attribute: BuffAttribute.ATK, value: -30, isPercent: true },
      { targetType: 'cannon_tower', attribute: BuffAttribute.ATK, value: 20, isPercent: true },
      { targetType: 'ice_tower', attribute: BuffAttribute.ATK, value: -10, isPercent: true },
    ],
    screenTint: 'rgba(255,255,200,0.05)',
    screenAlpha: 0.05,
  },

  [WeatherType.Rain]: {
    type: WeatherType.Rain,
    name: '下雨',
    modifiers: [
      { targetType: 'cannon_tower', attribute: BuffAttribute.ATK, value: -30, isPercent: true },
      { targetType: 'lightning_tower', attribute: BuffAttribute.ATK, value: 30, isPercent: true },
      { targetType: 'arrow_tower', attribute: BuffAttribute.ATK, value: -10, isPercent: true },
      { targetType: 'laser_tower', attribute: BuffAttribute.ATK, value: 10, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -5, isPercent: true },
    ],
    screenTint: 'rgba(30,60,120,0.18)',
    screenAlpha: 0.18,
  },

  [WeatherType.Snow]: {
    type: WeatherType.Snow,
    name: '下雪',
    modifiers: [
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -25, isPercent: true },
      { targetType: 'ice_tower', attribute: BuffAttribute.ATK, value: 30, isPercent: true },
      { targetType: 'cannon_tower', attribute: BuffAttribute.ATK, value: 10, isPercent: true },
      { targetType: 'lightning_tower', attribute: BuffAttribute.ATK, value: -10, isPercent: true },
    ],
    screenTint: 'rgba(200,220,240,0.10)',
    screenAlpha: 0.10,
  },

  [WeatherType.Fog]: {
    type: WeatherType.Fog,
    name: '下雾',
    modifiers: [
      { targetType: 'arrow_tower', attribute: BuffAttribute.AttackSpeed, value: -30, isPercent: true },
      { targetType: 'laser_tower', attribute: BuffAttribute.ATK, value: 30, isPercent: true },
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -15, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -10, isPercent: true },
    ],
    screenTint: 'rgba(180,190,200,0.30)',
    screenAlpha: 0.30,
  },

  [WeatherType.Night]: {
    type: WeatherType.Night,
    name: '夜晚',
    modifiers: [
      { targetType: 'bat_tower', attribute: BuffAttribute.ATK, value: 50, isPercent: true },
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -20, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: 18, isPercent: true },
      { targetType: 'laser_tower', attribute: BuffAttribute.Range, value: 10, isPercent: true },
      { targetType: 'lightning_tower', attribute: BuffAttribute.AttackSpeed, value: 15, isPercent: true },
    ],
    screenTint: 'rgba(10,15,40,0.45)',
    screenAlpha: 0.45,
  },

  [WeatherType.Sandstorm]: {
    type: WeatherType.Sandstorm,
    name: '沙暴',
    modifiers: [
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -20, isPercent: true },
      { targetType: 'arrow_tower', attribute: BuffAttribute.AttackSpeed, value: -20, isPercent: true },
      { targetType: 'cannon_tower', attribute: BuffAttribute.ATK, value: 10, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -8, isPercent: true },
    ],
    screenTint: 'rgba(210,170,90,0.28)',
    screenAlpha: 0.28,
  },

  [WeatherType.Blizzard]: {
    type: WeatherType.Blizzard,
    name: '暴风雪',
    modifiers: [
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -30, isPercent: true },
      { targetType: 'ice_tower', attribute: BuffAttribute.ATK, value: 40, isPercent: true },
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -10, isPercent: true },
      { targetType: 'lightning_tower', attribute: BuffAttribute.ATK, value: -10, isPercent: true },
    ],
    screenTint: 'rgba(220,235,250,0.22)',
    screenAlpha: 0.22,
  },

  [WeatherType.Storm]: {
    type: WeatherType.Storm,
    name: '暴雨',
    modifiers: [
      { targetType: 'cannon_tower', attribute: BuffAttribute.ATK, value: -40, isPercent: true },
      { targetType: 'lightning_tower', attribute: BuffAttribute.ATK, value: 50, isPercent: true },
      { targetType: 'arrow_tower', attribute: BuffAttribute.ATK, value: -15, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -8, isPercent: true },
    ],
    screenTint: 'rgba(20,40,80,0.30)',
    screenAlpha: 0.30,
  },

  [WeatherType.Smog]: {
    type: WeatherType.Smog,
    name: '煤烟',
    modifiers: [
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -15, isPercent: true },
      { targetType: 'laser_tower', attribute: BuffAttribute.ATK, value: 15, isPercent: true },
      { targetType: 'arrow_tower', attribute: BuffAttribute.AttackSpeed, value: -15, isPercent: true },
    ],
    screenTint: 'rgba(60,55,50,0.32)',
    screenAlpha: 0.32,
  },

  [WeatherType.SporeMist]: {
    type: WeatherType.SporeMist,
    name: '孢子雾',
    modifiers: [
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -10, isPercent: true },
      { targetType: 'soldier', attribute: BuffAttribute.HP, value: -10, isPercent: true },
      { targetType: 'vine_tower', attribute: BuffAttribute.ATK, value: 25, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: -5, isPercent: true },
    ],
    screenTint: 'rgba(150,80,160,0.28)',
    screenAlpha: 0.28,
  },

  [WeatherType.Void]: {
    type: WeatherType.Void,
    name: '虚空',
    modifiers: [
      { targetType: 'tower', attribute: BuffAttribute.Range, value: -10, isPercent: true },
      { targetType: 'laser_tower', attribute: BuffAttribute.ATK, value: 20, isPercent: true },
      { targetType: 'lightning_tower', attribute: BuffAttribute.AttackSpeed, value: 20, isPercent: true },
      { targetType: 'enemy', attribute: BuffAttribute.Speed, value: 10, isPercent: true },
    ],
    screenTint: 'rgba(60,20,90,0.40)',
    screenAlpha: 0.40,
  },
};
