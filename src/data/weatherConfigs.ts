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
};
