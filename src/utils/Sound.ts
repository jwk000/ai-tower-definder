export type SfxKey =
  // ═══ Legacy (5 keys — audio files need replacement for style consistency) ═══
  | 'tower_shoot'   // fallback when towerTypeVal out of range (rarely hit)
  | 'enemy_death'   // generic enemy death — synth explosion style
  | 'build_place'   // building/unit placement confirm — mechanical lock clunk
  | 'wave_start'    // wave start alarm/horn
  | 'defeat'        // defeat descending melody
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

/** Vite base URL — adapts to deployment path (/, /repo-name/, etc.) */
const BASE = import.meta.env.BASE_URL;

/** Resolve a relative SFX path to a full URL matching the current base. */
function sfxUrl(key: SfxKey): string {
  return `${BASE}sfx/${key}.ogg`;
}

const SFX_PATH: Record<SfxKey, string> = {
  // Legacy
  tower_shoot: '/sfx/tower_shoot.ogg',
  enemy_death: '/sfx/enemy_death.ogg',
  build_place: '/sfx/build_place.ogg',
  wave_start: '/sfx/wave_start.ogg',
  defeat: '/sfx/defeat.ogg',
  // Tower attack
  tower_arrow: '/sfx/tower_arrow.ogg',
  tower_cannon: '/sfx/tower_cannon.ogg',
  tower_ice: '/sfx/tower_ice.ogg',
  tower_lightning: '/sfx/tower_lightning.ogg',
  tower_laser: '/sfx/tower_laser.ogg',
  tower_bat: '/sfx/tower_bat.ogg',
  tower_missile: '/sfx/tower_missile.ogg',
  // Projectile hits
  arrow_hit: '/sfx/arrow_hit.ogg',
  cannon_hit: '/sfx/cannon_hit.ogg',
  ice_hit: '/sfx/ice_hit.ogg',
  lightning_hit: '/sfx/lightning_hit.ogg',
  missile_impact: '/sfx/missile_impact.ogg',
  // Game phase
  victory: '/sfx/victory.ogg',
  wave_clear: '/sfx/wave_clear.ogg',
  wave_boss: '/sfx/wave_boss.ogg',
  countdown_tick: '/sfx/countdown_tick.ogg',
  countdown_go: '/sfx/countdown_go.ogg',
  // UI & building
  ui_click: '/sfx/ui_click.ogg',
  ui_error: '/sfx/ui_error.ogg',
  build_deny: '/sfx/build_deny.ogg',
  upgrade: '/sfx/upgrade.ogg',
  sell: '/sfx/sell.ogg',
  // Enemy
  enemy_spawn: '/sfx/enemy_spawn.ogg',
  enemy_hit: '/sfx/enemy_hit.ogg',
  boss_phase2: '/sfx/boss_phase2.ogg',
  exploder_boom: '/sfx/exploder_boom.ogg',
  base_hit: '/sfx/base_hit.ogg',
  // Economy
  gold_earn: '/sfx/gold_earn.ogg',
  gold_spend: '/sfx/gold_spend.ogg',
  // Skills
  skill_taunt: '/sfx/skill_taunt.ogg',
  skill_whirlwind: '/sfx/skill_whirlwind.ogg',
  // Weather
  weather_change: '/sfx/weather_change.ogg',
  // Enemy attack
  enemy_attack: '/sfx/enemy_attack.ogg',
  mage_attack: '/sfx/mage_attack.ogg',
};

const PER_KEY_THROTTLE_MS: Partial<Record<SfxKey, number>> = {
  // Tower attacks — increased to reduce density when multiple towers fire
  tower_arrow: 80,
  tower_cannon: 120,
  tower_ice: 80,
  tower_lightning: 120,
  tower_laser: 150,
  tower_bat: 80,
  tower_missile: 250,
  tower_shoot: 80, // legacy
  // Hits — increased to prevent overlapping impact cacophony
  arrow_hit: 60,
  cannon_hit: 100,
  ice_hit: 80,
  lightning_hit: 120,
  missile_impact: 250,
  // Frequent events — increased to tame rapid-fire noise
  enemy_death: 80,
  enemy_hit: 50,
  gold_earn: 60,
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

/** Global concurrent sound cap: sliding-window limit to prevent audio chaos when many units fire simultaneously. */
const GLOBAL_SOUND_WINDOW_MS = 150;
const MAX_SOUNDS_IN_WINDOW = 8;

export class Sound {
  private static buffers: Partial<Record<SfxKey, HTMLAudioElement>> = {};
  private static lastPlayedAt: Partial<Record<SfxKey, number>> = {};
  private static volume = 0.6;
  private static muted = false;
  private static loaded = false;
  private static unlocked = false;
  /** Sliding-window timestamps for global concurrent sound limiting */
  private static recentPlayTimes: number[] = [];

  static preload(): void {
    if (Sound.loaded) return;
    if (typeof Audio === 'undefined') return; // non-browser env
    for (const key of Object.keys(SFX_PATH) as SfxKey[]) {
      const audio = new Audio(sfxUrl(key));
      audio.preload = 'auto';
      audio.volume = Sound.volume;
      Sound.buffers[key] = audio;
    }
    Sound.loaded = true;
  }

  /**
   * Register one-time event listeners on the canvas to unlock audio playback.
   * Browsers block Audio.play() until the first user gesture (click/touch).
   * This plays a silent sound on the first interaction to satisfy the policy,
   * unblocking all future Sound.play() calls.
   */
  static initUnlock(canvas: HTMLCanvasElement): void {
    if (Sound.unlocked) return;
    if (typeof Audio === 'undefined') return; // non-browser env
    const handler = (): void => {
      Sound.unlocked = true;
      // Try a preloaded buffer first; fall back to creating a fresh one
      const first = Object.values(Sound.buffers).find(a => a && a.readyState >= 1);
      const fallbackKey = Object.keys(SFX_PATH)[0] as SfxKey;
      const unlockAudio = first ?? new Audio(sfxUrl(fallbackKey));
      unlockAudio.volume = 0;
      unlockAudio.play().catch(() => {});
      if (!first) {
        // Clean up the temporary element after it plays
        unlockAudio.addEventListener('ended', () => { unlockAudio.remove(); });
      }
      canvas.removeEventListener('pointerdown', handler);
      canvas.removeEventListener('touchstart', handler);
      canvas.removeEventListener('click', handler);
    };
    canvas.addEventListener('pointerdown', handler);
    canvas.addEventListener('touchstart', handler);
    canvas.addEventListener('click', handler);
  }

  static play(key: SfxKey): void {
    if (Sound.muted) return;
    if (!(key in SFX_PATH)) return;
    // Skip in non-browser environments (e.g. Node.js test runner)
    if (typeof Audio === 'undefined') return;

    const now = performance.now();

    // ── Global sliding-window cap: limit total sounds in a short window ──
    // Prune timestamps older than the window
    const cutoff = now - GLOBAL_SOUND_WINDOW_MS;
    Sound.recentPlayTimes = Sound.recentPlayTimes.filter(t => t >= cutoff);
    if (Sound.recentPlayTimes.length >= MAX_SOUNDS_IN_WINDOW) return;
    Sound.recentPlayTimes.push(now);

    // ── Per-key throttle ──
    const last = Sound.lastPlayedAt[key] ?? 0;
    const throttle = PER_KEY_THROTTLE_MS[key] ?? 0;
    if (now - last < throttle) return;
    Sound.lastPlayedAt[key] = now;

    // Create fresh Audio element — more reliable than cloneNode for media elements
    const audio = new Audio(sfxUrl(key));
    audio.volume = Sound.volume;
    void audio.play().catch(() => {});
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

  /**
   * Diagnostic: test audio playback and report status.
   * Call `Sound.verify()` from the browser console to debug sound issues.
   */
  static verify(): void {
    if (typeof Audio === 'undefined') {
      console.error('[Sound] Audio API not available (non-browser environment?)');
      return;
    }
    console.group('[Sound] Diagnostic');
    console.log('muted:', Sound.muted);
    console.log('volume:', Sound.volume);
    console.log('loaded:', Sound.loaded);
    console.log('unlocked:', Sound.unlocked);
    console.log('buffers created:', Object.keys(Sound.buffers).length);
    console.log('OGG supported:', new Audio().canPlayType('audio/ogg'));
    console.log('MP3 supported:', new Audio().canPlayType('audio/mpeg'));

    // Test-play a sound
    const testKey = Object.keys(SFX_PATH)[0] as SfxKey | undefined;
    if (!testKey) {
      console.warn('No SFX keys defined');
      console.groupEnd();
      return;
    }
    const path = sfxUrl(testKey);
    console.log(`Test-playing "${testKey}" from ${path} ...`);
    const test = new Audio(path);
    test.volume = 0.3;
    const promise = test.play();
    if (promise !== undefined) {
      promise
        .then(() => console.log('[Sound] ✅ Play succeeded'))
        .catch((e) => console.error(`[Sound] ❌ Play blocked: ${String(e)}`));
    }
    console.groupEnd();
  }
}
