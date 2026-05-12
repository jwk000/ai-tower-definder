// ============================================================
// Tower Defender — Deterministic PRNG (P2-#16)
//
// Mulberry32 - 32-bit deterministic seeded PRNG.
// Replaces Math.random() in all gameplay logic to ensure
// reproducibility (replay, shared seeds, speedruns, tests).
//
// Design ref:
//   - design/07-map-level-system.md §2.3 (seed sources + multi-stream)
//   - design/13-save-system.md §3 (PRNG state in save data)
//
// Multi-stream isolation:
//   - mapRandom   — map gen, weather pool, neutral units, banned towers
//   - waveRandom  — enemy selection within waves, special rule triggers
//   - dropRandom  — kill drops, treasure chests, bounty rewards
//   - decorRandom — decoration positions (visual-only, may be omitted from save)
//
// Player actions MUST NOT influence other streams; e.g. firing a missile
// (consumes dropRandom) must not shift waveRandom outcomes.
// ============================================================

const WAVE_MASK = 0x57415645 | 0;  // 'WAVE'
const DROP_MASK = 0x44524f50 | 0;  // 'DROP'
const DECO_MASK = 0x4445434f | 0;  // 'DECO'

/** Deterministic 32-bit PRNG (Mulberry32). */
export class GameRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /** Float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Picks a random element. Caller ensures arr.length > 0. */
  pick<T>(arr: readonly T[]): T {
    const idx = this.nextInt(0, arr.length);
    return arr[idx] as T;
  }

  /** Picks a weighted element. `weights[i]` corresponds to `items[i]`. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0) throw new Error('pickWeighted: empty items');
    if (items.length !== weights.length) throw new Error('pickWeighted: length mismatch');
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Fisher-Yates shuffle in place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }

  /** Get internal state (for save/restore). */
  getState(): number {
    return this.state;
  }

  /** Restore internal state (from save). */
  setState(state: number): void {
    this.state = state | 0;
  }
}

/** Registry of multi-stream PRNGs for a game run. */
export interface RandomStreams {
  seed: number;
  map: GameRandom;
  wave: GameRandom;
  drop: GameRandom;
  decor: GameRandom;
}

/** Creates a full multi-stream PRNG bundle from a single seed. */
export function createRandomStreams(seed: number): RandomStreams {
  return {
    seed: seed | 0,
    map: new GameRandom(seed),
    wave: new GameRandom(seed ^ WAVE_MASK),
    drop: new GameRandom(seed ^ DROP_MASK),
    decor: new GameRandom(seed ^ DECO_MASK),
  };
}

/** Generates a non-deterministic 32-bit seed from time + math.random. */
export function generateSeed(): number {
  // Bootstrap seed: combines time + crypto-grade random when available.
  // This is the ONLY place Math.random() is allowed in game logic.
  // eslint-disable-next-line no-restricted-syntax
  const a = (Date.now() & 0xffffffff) | 0;
  // eslint-disable-next-line no-restricted-syntax
  const b = (Math.floor(Math.random() * 0xffffffff)) | 0;
  return (a ^ b) | 0;
}

/** Captures the state of all streams (for save). */
export function captureStreamState(streams: RandomStreams): {
  seed: number;
  map: number;
  wave: number;
  drop: number;
  decor: number;
} {
  return {
    seed: streams.seed,
    map: streams.map.getState(),
    wave: streams.wave.getState(),
    drop: streams.drop.getState(),
    decor: streams.decor.getState(),
  };
}

/** Restores stream states (from save). */
export function restoreStreamState(
  streams: RandomStreams,
  state: { map: number; wave: number; drop: number; decor: number },
): void {
  streams.map.setState(state.map);
  streams.wave.setState(state.wave);
  streams.drop.setState(state.drop);
  streams.decor.setState(state.decor);
}

// ============================================================
// Global game-streams singleton
// ============================================================
//
// Most legacy call sites (`Math.random()`) need a quick, drop-in
// replacement. Until each call site is wired through a `RandomStreams`
// reference, we expose a global default bundle keyed off a session seed.
//
// New code SHOULD prefer dependency injection (pass streams explicitly).
// ============================================================

let _globalStreams: RandomStreams | null = null;

/** Initialise (or reset) the global random streams from a seed. */
export function initGlobalRandom(seed?: number): RandomStreams {
  const s = seed ?? generateSeed();
  _globalStreams = createRandomStreams(s);
  return _globalStreams;
}

/** Returns the global random streams. Initialises with a fresh seed if missing. */
export function getGlobalRandom(): RandomStreams {
  if (_globalStreams === null) {
    _globalStreams = createRandomStreams(generateSeed());
  }
  return _globalStreams;
}

/** Convenience wrappers — pick a stream and call .next(). */
export const Rand = {
  map: () => getGlobalRandom().map.next(),
  wave: () => getGlobalRandom().wave.next(),
  drop: () => getGlobalRandom().drop.next(),
  decor: () => getGlobalRandom().decor.next(),
};
