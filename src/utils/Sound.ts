export type SfxKey =
  // Legacy (kept for backward compat, maps to specific tower sound)
  | 'tower_shoot'
  | 'enemy_death'
  | 'build_place'
  | 'wave_start'
  | 'defeat'
  // Tower attack sounds (7 types)
  | 'tower_arrow'
  | 'tower_cannon'
  | 'tower_ice'
  | 'tower_lightning'
  | 'tower_laser'
  | 'tower_bat'
  | 'tower_missile'
  // Projectile hit sounds
  | 'arrow_hit'
  | 'cannon_hit'
  | 'ice_hit'
  | 'lightning_hit'
  | 'missile_impact'
  // Game phase events
  | 'victory'
  | 'wave_clear'
  | 'wave_boss'
  | 'countdown_tick'
  | 'countdown_go'
  // UI & building
  | 'ui_click'
  | 'ui_error'
  | 'build_deny'
  | 'upgrade'
  | 'sell'
  // Enemy events
  | 'enemy_spawn'
  | 'enemy_hit'
  | 'boss_phase2'
  | 'exploder_boom'
  | 'base_hit'
  // Economy
  | 'gold_earn'
  | 'gold_spend'
  // Skills
  | 'skill_taunt'
  | 'skill_whirlwind'
  // Weather
  | 'weather_change'
  // Enemy attack
  | 'enemy_attack'
  | 'mage_attack';

const SFX_PATH: Record<SfxKey, string> = {
  // Legacy
  tower_shoot: '/sfx/tower_shoot.mp3',
  enemy_death: '/sfx/enemy_death.mp3',
  build_place: '/sfx/build_place.mp3',
  wave_start: '/sfx/wave_start.mp3',
  defeat: '/sfx/defeat.mp3',
  // Tower attack
  tower_arrow: '/sfx/tower_arrow.mp3',
  tower_cannon: '/sfx/tower_cannon.mp3',
  tower_ice: '/sfx/tower_ice.mp3',
  tower_lightning: '/sfx/tower_lightning.mp3',
  tower_laser: '/sfx/tower_laser.mp3',
  tower_bat: '/sfx/tower_bat.mp3',
  tower_missile: '/sfx/tower_missile.mp3',
  // Projectile hits
  arrow_hit: '/sfx/arrow_hit.mp3',
  cannon_hit: '/sfx/cannon_hit.mp3',
  ice_hit: '/sfx/ice_hit.mp3',
  lightning_hit: '/sfx/lightning_hit.mp3',
  missile_impact: '/sfx/missile_impact.mp3',
  // Game phase
  victory: '/sfx/victory.mp3',
  wave_clear: '/sfx/wave_clear.mp3',
  wave_boss: '/sfx/wave_boss.mp3',
  countdown_tick: '/sfx/countdown_tick.mp3',
  countdown_go: '/sfx/countdown_go.mp3',
  // UI & building
  ui_click: '/sfx/ui_click.mp3',
  ui_error: '/sfx/ui_error.mp3',
  build_deny: '/sfx/build_deny.mp3',
  upgrade: '/sfx/upgrade.mp3',
  sell: '/sfx/sell.mp3',
  // Enemy
  enemy_spawn: '/sfx/enemy_spawn.mp3',
  enemy_hit: '/sfx/enemy_hit.mp3',
  boss_phase2: '/sfx/boss_phase2.mp3',
  exploder_boom: '/sfx/exploder_boom.mp3',
  base_hit: '/sfx/base_hit.mp3',
  // Economy
  gold_earn: '/sfx/gold_earn.mp3',
  gold_spend: '/sfx/gold_spend.mp3',
  // Skills
  skill_taunt: '/sfx/skill_taunt.mp3',
  skill_whirlwind: '/sfx/skill_whirlwind.mp3',
  // Weather
  weather_change: '/sfx/weather_change.mp3',
  // Enemy attack
  enemy_attack: '/sfx/enemy_attack.mp3',
  mage_attack: '/sfx/mage_attack.mp3',
};

const PER_KEY_THROTTLE_MS: Partial<Record<SfxKey, number>> = {
  // Tower attacks — throttle to avoid ear fatigue
  tower_arrow: 40,
  tower_cannon: 80,
  tower_ice: 40,
  tower_lightning: 60,
  tower_laser: 100,
  tower_bat: 50,
  tower_missile: 200,
  tower_shoot: 40, // legacy
  // Hits
  arrow_hit: 20,
  cannon_hit: 60,
  ice_hit: 30,
  lightning_hit: 30,
  missile_impact: 200,
  // Frequent events
  enemy_death: 30,
  enemy_hit: 20,
  gold_earn: 30,
  // Never throttle
  ui_click: 0,
  ui_error: 0,
  build_place: 0,
  build_deny: 0,
  upgrade: 0,
  sell: 0,
  wave_start: 0,
  wave_clear: 0,
  wave_boss: 0,
  countdown_tick: 0,
  countdown_go: 0,
  victory: 0,
  defeat: 0,
  enemy_spawn: 0,
  boss_phase2: 0,
  exploder_boom: 0,
  base_hit: 0,
  gold_spend: 0,
  skill_taunt: 0,
  skill_whirlwind: 0,
  weather_change: 0,
  enemy_attack: 0,
  mage_attack: 0,
};

export class Sound {
  private static buffers: Partial<Record<SfxKey, HTMLAudioElement>> = {};
  private static lastPlayedAt: Partial<Record<SfxKey, number>> = {};
  private static volume = 0.6;
  private static muted = false;
  private static loaded = false;

  static preload(): void {
    if (Sound.loaded) return;
    for (const key of Object.keys(SFX_PATH) as SfxKey[]) {
      const audio = new Audio(SFX_PATH[key]);
      audio.preload = 'auto';
      audio.volume = Sound.volume;
      Sound.buffers[key] = audio;
    }
    Sound.loaded = true;
  }

  static play(key: SfxKey): void {
    if (Sound.muted) return;
    const template = Sound.buffers[key];
    if (!template) return;

    const now = performance.now();
    const last = Sound.lastPlayedAt[key] ?? 0;
    const throttle = PER_KEY_THROTTLE_MS[key] ?? 0;
    if (now - last < throttle) return;
    Sound.lastPlayedAt[key] = now;

    const node = template.cloneNode(true) as HTMLAudioElement;
    node.volume = Sound.volume;
    void node.play().catch(() => {});
  }

  static setVolume(v: number): void {
    Sound.volume = Math.max(0, Math.min(1, v));
    for (const audio of Object.values(Sound.buffers)) {
      if (audio) audio.volume = Sound.volume;
    }
  }

  static setMuted(m: boolean): void {
    Sound.muted = m;
  }

  static isMuted(): boolean {
    return Sound.muted;
  }
}
