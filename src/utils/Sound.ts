export type SfxKey =
  | 'tower_shoot'
  | 'enemy_death'
  | 'build_place'
  | 'wave_start'
  | 'defeat';

const SFX_PATH: Record<SfxKey, string> = {
  tower_shoot: '/sfx/tower_shoot.mp3',
  enemy_death: '/sfx/enemy_death.mp3',
  build_place: '/sfx/build_place.mp3',
  wave_start: '/sfx/wave_start.mp3',
  defeat: '/sfx/defeat.mp3',
};

const PER_KEY_THROTTLE_MS: Record<SfxKey, number> = {
  tower_shoot: 40,
  enemy_death: 30,
  build_place: 0,
  wave_start: 0,
  defeat: 0,
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
    const throttle = PER_KEY_THROTTLE_MS[key];
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
