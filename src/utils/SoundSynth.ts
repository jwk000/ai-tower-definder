/**
 * SoundSynth — Procedural WAV generator for SFX.
 *
 * Generates epic-style synthetic sounds (inspired by Warcraft 3 aesthetic)
 * featuring deep bass, reverb tails, and warm harmonic character.
 * All sounds are generated once at preload time and cached as Blob URLs.
 */

import type { SfxKey } from './Sound.js';

// ─── WAV helpers ─────────────────────────────────────────────

const SAMPLE_RATE = 22050; // 22kHz — compact, good enough for SFX
const PI2 = Math.PI * 2;

function wavHeader(dataLen: number): ArrayBuffer {
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const pcmLen = dataLen * 2; // 16-bit mono
  writeStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + pcmLen, true);
  writeStr(v, 8, 'WAVE');
  writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);          // PCM
  v.setUint16(22, 1, true);          // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);          // block align
  v.setUint16(34, 16, true);         // bits/sample
  writeStr(v, 36, 'data');
  v.setUint32(40, pcmLen, true);
  return buf;
}

function writeStr(v: DataView, off: number, s: string): void {
  for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
}

function toBlobUrl(samples: Float32Array): string {
  const header = wavHeader(samples.length);
  const full = new Uint8Array(header.byteLength + samples.length * 2);
  full.set(new Uint8Array(header), 0);
  const dv = new DataView(full.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    dv.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return URL.createObjectURL(new Blob([full], { type: 'audio/wav' }));
}

// ─── Oscillators ──────────────────────────────────────────────

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function osc(phase: number, type: WaveType): number {
  switch (type) {
    case 'square':   return phase < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * phase - 1;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    default:         return Math.sin(PI2 * phase);
  }
}

function fillOsc(
  out: Float32Array, start: number, len: number,
  freq: number, type: WaveType, phaseOffset = 0,
): void {
  let phase = phaseOffset;
  for (let i = 0; i < len; i++) {
    out[start + i] = osc(phase % 1, type);
    phase += freq / SAMPLE_RATE;
  }
}

// ─── Envelopes ────────────────────────────────────────────────

/**
 * ADSR envelope.
 * @param t      current time within the sound (seconds)
 * @param a      attack time (seconds)
 * @param d      decay time (seconds)
 * @param s      sustain level (0..1)
 * @param r      release time (seconds)
 * @param total  total duration (seconds)
 */
function adsr(t: number, a: number, d: number, s: number, r: number, total: number): number {
  if (t < a) return t / a;                          // attack
  const decayEnd = a + d;
  if (t < decayEnd) {
    const ratio = (t - a) / d;
    return 1 - (1 - s) * ratio;                      // decay → sustain
  }
  const releaseStart = total - r;
  if (t < releaseStart) return s;                    // sustain
  if (t >= total) return 0;
  return s * (1 - (t - releaseStart) / r);           // release
}

// ─── Filters ──────────────────────────────────────────────────

/**
 * First-order low-pass filter (in-place).
 * @param samples    input/output buffer
 * @param cutoffFreq cutoff frequency in Hz
 */
function lowpass(samples: Float32Array, cutoffFreq: number): void {
  const rc = 1 / (PI2 * cutoffFreq);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i]! - prev);
    samples[i] = prev;
  }
}

/**
 * Band-pass filter via two cascaded low-pass filters (in-place).
 * Simple 2nd-order approximation: lowpass then subtract from original highpass.
 * For noise shaping into a frequency band.
 */
function bandpass(samples: Float32Array, lowCut: number, highCut: number): void {
  // Apply low-pass at highCut first
  const rcHigh = 1 / (PI2 * highCut);
  const alphaHigh = (1 / SAMPLE_RATE) / (rcHigh + 1 / SAMPLE_RATE);
  let prevHigh = 0;
  const afterLow = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    prevHigh = prevHigh + alphaHigh * (samples[i]! - prevHigh);
    afterLow[i] = prevHigh;
  }
  // Subtract low-pass at lowCut (acting as high-pass rejection)
  const rcLow = 1 / (PI2 * lowCut);
  const alphaLow = (1 / SAMPLE_RATE) / (rcLow + 1 / SAMPLE_RATE);
  let prevLow = 0;
  for (let i = 0; i < samples.length; i++) {
    prevLow = prevLow + alphaLow * (afterLow[i]! - prevLow);
    samples[i] = afterLow[i]! - prevLow;
  }
}

// ─── Effects ──────────────────────────────────────────────────

/**
 * Simple feedback reverb via comb filter.
 * @param dry      input samples
 * @param mix      0..1 wet/dry mix ratio
 * @param decay    feedback decay (0..1, lower = shorter tail)
 * @param delayMs  delay line length in ms
 */
function reverb(dry: Float32Array, mix: number, decay: number, delayMs: number): Float32Array {
  const delaySamples = Math.round(SAMPLE_RATE * delayMs / 1000);
  const totalLen = dry.length + delaySamples * 2;
  const out = new Float32Array(totalLen);
  // Copy dry signal
  out.set(dry);
  // Feedback loop
  let feedback = decay;
  for (let tap = 1; tap <= 6; tap++) {
    if (feedback < 0.005) break;
    const offset = delaySamples * tap;
    for (let i = 0; i < dry.length && offset + i < totalLen; i++) {
      out[offset + i]! += dry[i]! * feedback * mix;
    }
    feedback *= decay;
  }
  // Normalize slightly
  const peak = Math.max(1, ...out.map(Math.abs));
  if (peak > 1) {
    for (let i = 0; i < totalLen; i++) out[i]! /= peak;
  }
  return out;
}

// ─── Generators ───────────────────────────────────────────────

function tone(
  freq: number, dur: number, type: WaveType = 'sine',
  vol = 0.4, attack = 0.005, decay = 0.04, sustain = 0.6, release = 0.08,
): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  fillOsc(out, 0, len, freq, type);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    out[i]! *= adsr(t, attack, decay, sustain, release, dur) * vol;
  }
  return out;
}

function noise(dur: number, vol = 0.3): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  // Pink-ish noise via simple IIR
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, 0.003, 0.02, 0.7, 0.06, dur);
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.05;
    b1 = 0.992 * b1 + w * 0.07;
    b2 = 0.965 * b2 + w * 0.15;
    out[i] = (b0 + b1 + b2 + w * 0.5) * 0.2 * env * vol;
  }
  return out;
}

function sweep(
  freqStart: number, freqEnd: number, dur: number,
  type: WaveType = 'sine', vol = 0.4, attack = 0.005, decay = 0.04, sustain = 0.5, release = 0.1,
): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const ratio = t / dur;
    const freq = freqStart + (freqEnd - freqStart) * ratio;
    phase += freq / SAMPLE_RATE;
    const env = adsr(t, attack, decay, sustain, release, dur);
    out[i] = osc(phase % 1, type) * env * vol;
  }
  return out;
}

function sequence(notes: Array<{ freq: number; dur: number }>, type: WaveType = 'sine', vol = 0.35): Float32Array {
  const totalDur = notes.reduce((s, n) => s + n.dur, 0);
  const len = Math.ceil(SAMPLE_RATE * totalDur);
  const out = new Float32Array(len);
  let cursor = 0;
  for (const note of notes) {
    const noteLen = Math.ceil(SAMPLE_RATE * note.dur);
    for (let i = 0; i < noteLen; i++) {
      const t = i / SAMPLE_RATE;
      const phase = (note.freq * t) % 1;
      const env = Math.max(0, 1 - t / note.dur) * 0.85; // smooth decay
      out[cursor + i] = osc(phase, type) * env * vol;
    }
    cursor += noteLen;
  }
  return out;
}

/**
 * Band-limited noise — white noise filtered to a frequency band.
 * Perfect for lightning/electricity sounds.
 */
function bandNoise(dur: number, lowCut: number, highCut: number, vol = 0.35): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  // Fill with white noise
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, 0.002, 0.03, 0.8, 0.12, dur);
    out[i] = (Math.random() * 2 - 1) * env * vol;
  }
  bandpass(out, lowCut, highCut);
  return out;
}

/**
 * Impact-style sound: sub-bass sine + noise burst, fast attack, medium release.
 * Used for cannon, missile explosions, boss phase transitions.
 */
function impact(freq: number, dur: number, noiseMix: number, vol = 0.5): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  // Sub-bass tone
  fillOsc(out, 0, len, freq, 'sine');
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, 0.002, 0.06, 0.3, 0.2, dur);
    out[i]! *= env * vol;
  }
  // Noise layer
  let b0 = 0, b1 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, 0.002, 0.04, 0.2, 0.15, dur);
    const w = Math.random() * 2 - 1;
    b0 = 0.99 * b0 + w * 0.08;
    b1 = 0.97 * b1 + w * 0.12;
    out[i]! += (b0 + b1 + w * 0.3) * 0.18 * env * noiseMix * vol;
  }
  // Clamp
  for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i]!));
  return out;
}

// ─── Mix helpers ──────────────────────────────────────────────

function mix2(a: Float32Array, b: Float32Array, aVol = 0.5, bVol = 0.5): Float32Array {
  const len = Math.max(a.length, b.length);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = (a[i] ?? 0) * aVol + (b[i] ?? 0) * bVol;
  }
  return out;
}

function mix3(
  a: Float32Array, b: Float32Array, c: Float32Array,
  aVol = 0.4, bVol = 0.3, cVol = 0.3,
): Float32Array {
  const len = Math.max(a.length, b.length, c.length);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = (a[i] ?? 0) * aVol + (b[i] ?? 0) * bVol + (c[i] ?? 0) * cVol;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Sound generators per key — Warcraft 3 epic style
// ═══════════════════════════════════════════════════════════════

const generators: Partial<Record<SfxKey, () => Float32Array>> = {
  // ── UI (warm, non-fatiguing) ────────────────────────────
  ui_click: () => tone(1600, 0.04, 'triangle', 0.3, 0.001, 0.01, 0.4, 0.02),
  ui_error: () => {
    const t = tone(180, 0.2, 'triangle', 0.4, 0.01, 0.05, 0.5, 0.1);
    lowpass(t, 400);
    return t;
  },
  build_deny: () => {
    const t = tone(120, 0.22, 'triangle', 0.45, 0.01, 0.06, 0.4, 0.12);
    lowpass(t, 500);
    return t;
  },

  upgrade: () => sweep(350, 700, 0.4, 'triangle', 0.35, 0.01, 0.08, 0.5, 0.15),
  sell: () => {
    const s = sweep(700, 180, 0.3, 'triangle', 0.35, 0.005, 0.05, 0.4, 0.1);
    lowpass(s, 600);
    return s;
  },

  // ── Tower attacks (weighty, epic) ───────────────────────

  // Arrow: mid "whoosh" + low thud
  tower_arrow: () => {
    const whoosh = sweep(900, 400, 0.18, 'triangle', 0.3, 0.003, 0.04, 0.3, 0.08);
    const thud = tone(150, 0.1, 'sine', 0.25, 0.002, 0.03, 0.2, 0.06);
    return mix2(whoosh, thud, 0.7, 0.4);
  },

  // Cannon: deep sub-bass explosion + reverb
  tower_cannon: () => {
    const dry = impact(45, 0.35, 0.6, 0.55);
    return reverb(dry, 0.35, 0.55, 60);
  },

  // Ice: crystalline high sweep + shimmer reverb
  tower_ice: () => {
    const crystal = sweep(2200, 900, 0.22, 'sine', 0.35, 0.005, 0.06, 0.3, 0.12);
    const shimmer = tone(3000, 0.12, 'triangle', 0.2, 0.002, 0.02, 0.1, 0.08);
    const dry = mix2(crystal, shimmer, 0.7, 0.3);
    return reverb(dry, 0.3, 0.4, 40);
  },

  // Lightning: band-limited noise + reverb (electric crackle with tail)
  tower_lightning: () => {
    const crackle = bandNoise(0.35, 500, 2500, 0.4);
    const rumble = tone(60, 0.3, 'sine', 0.25, 0.005, 0.08, 0.3, 0.15);
    lowpass(rumble, 150);
    const dry = mix2(crackle, rumble, 0.65, 0.35);
    return reverb(dry, 0.3, 0.5, 50);
  },

  // Laser: sustained energy beam with depth
  tower_laser: () => {
    const beam = sweep(700, 250, 0.3, 'triangle', 0.35, 0.005, 0.06, 0.5, 0.12);
    const hum = tone(120, 0.3, 'sine', 0.2, 0.01, 0.1, 0.4, 0.15);
    lowpass(hum, 200);
    const dry = mix2(beam, hum, 0.6, 0.4);
    return reverb(dry, 0.25, 0.45, 35);
  },

  // Bat: low flutter sweep
  tower_bat: () => {
    const flutter = sweep(350, 180, 0.22, 'triangle', 0.35, 0.005, 0.05, 0.3, 0.1);
    lowpass(flutter, 500);
    return flutter;
  },

  // Missile: heavy launch rumble
  tower_missile: () => {
    const rumble = sweep(70, 25, 0.5, 'sine', 0.5, 0.01, 0.1, 0.4, 0.2);
    const crackle = noise(0.35, 0.3);
    lowpass(crackle, 300);
    const dry = mix2(rumble, crackle, 0.7, 0.3);
    return reverb(dry, 0.3, 0.4, 70);
  },

  // ── Hit impacts (thud, punch, not sharp) ───────────────

  // Arrow hit: wooden thud
  arrow_hit: () => {
    const thud = tone(160, 0.1, 'triangle', 0.4, 0.001, 0.02, 0.15, 0.06);
    lowpass(thud, 400);
    return thud;
  },

  // Cannon hit: big explosion impact
  cannon_hit: () => {
    const dry = impact(50, 0.3, 0.8, 0.5);
    return reverb(dry, 0.3, 0.5, 50);
  },

  // Ice hit: shattering crystal
  ice_hit: () => {
    const shatter = sweep(3500, 800, 0.15, 'triangle', 0.4, 0.001, 0.02, 0.1, 0.1);
    const tinkle = tone(5000, 0.08, 'triangle', 0.2, 0.001, 0.01, 0.05, 0.05);
    const dry = mix2(shatter, tinkle, 0.6, 0.3);
    return reverb(dry, 0.25, 0.35, 30);
  },

  // Lightning hit: electric zap on flesh
  lightning_hit: () => {
    const zap = bandNoise(0.2, 400, 3000, 0.42);
    const thud = tone(100, 0.12, 'sine', 0.3, 0.001, 0.02, 0.15, 0.08);
    lowpass(thud, 250);
    const dry = mix2(zap, thud, 0.6, 0.4);
    return reverb(dry, 0.25, 0.4, 35);
  },

  // Missile impact: huge explosion with long tail
  missile_impact: () => {
    const dry = impact(35, 0.7, 0.9, 0.6);
    const rumble = tone(25, 0.5, 'sine', 0.3, 0.01, 0.15, 0.3, 0.3);
    lowpass(rumble, 80);
    const full = mix2(dry, rumble, 0.7, 0.35);
    return reverb(full, 0.4, 0.5, 80);
  },

  // Enemy hit: flesh impact
  enemy_hit: () => {
    const thud = tone(200, 0.08, 'triangle', 0.4, 0.001, 0.015, 0.1, 0.05);
    lowpass(thud, 500);
    return thud;
  },

  // ── Game phase ─────────────────────────────────────────

  victory: () => sequence([
    { freq: 392, dur: 0.2 }, { freq: 523, dur: 0.2 },
    { freq: 659, dur: 0.2 }, { freq: 784, dur: 0.5 },
  ], 'triangle', 0.35),

  wave_clear: () => sequence([
    { freq: 659, dur: 0.15 }, { freq: 784, dur: 0.25 },
  ], 'triangle', 0.35),

  // Boss wave: deep horn blast
  wave_boss: () => {
    const horn = tone(80, 0.7, 'triangle', 0.4, 0.02, 0.15, 0.5, 0.3);
    const overtone = tone(160, 0.65, 'sine', 0.2, 0.02, 0.12, 0.3, 0.25);
    const dry = mix2(horn, overtone, 0.6, 0.4);
    return reverb(dry, 0.35, 0.55, 90);
  },

  countdown_tick: () => tone(1100, 0.05, 'triangle', 0.3, 0.001, 0.005, 0.2, 0.03),
  countdown_go: () => sweep(500, 1000, 0.3, 'triangle', 0.35, 0.005, 0.05, 0.3, 0.12),

  // ── Enemy events ───────────────────────────────────────

  // Enemy death: low descending growl
  enemy_death: () => {
    const growl = sweep(250, 60, 0.3, 'triangle', 0.4, 0.005, 0.05, 0.2, 0.15);
    const noiseLayer = noise(0.2, 0.2);
    lowpass(noiseLayer, 300);
    return mix2(growl, noiseLayer, 0.65, 0.3);
  },

  enemy_spawn: () => sweep(180, 350, 0.3, 'triangle', 0.3, 0.01, 0.06, 0.4, 0.1),

  // Boss phase 2: deep menacing rumble
  boss_phase2: () => {
    const rumble = sweep(40, 100, 0.8, 'triangle', 0.45, 0.02, 0.2, 0.4, 0.3);
    const noiseLayer = noise(0.5, 0.25);
    lowpass(noiseLayer, 200);
    const dry = mix2(rumble, noiseLayer, 0.7, 0.3);
    return reverb(dry, 0.3, 0.5, 70);
  },

  // Exploder boom
  exploder_boom: () => {
    const dry = impact(40, 0.5, 0.9, 0.6);
    return reverb(dry, 0.35, 0.5, 60);
  },

  // Base hit: heavy structure impact
  base_hit: () => {
    const thud = tone(100, 0.3, 'triangle', 0.5, 0.002, 0.05, 0.2, 0.2);
    const noiseLayer = noise(0.2, 0.3);
    lowpass(noiseLayer, 300);
    const dry = mix2(thud, noiseLayer, 0.6, 0.4);
    return reverb(dry, 0.3, 0.45, 50);
  },

  // ── Economy ────────────────────────────────────────────
  gold_earn: () => tone(1800, 0.1, 'triangle', 0.3, 0.002, 0.02, 0.3, 0.05),
  gold_spend: () => {
    const s = sweep(600, 200, 0.15, 'triangle', 0.35, 0.003, 0.03, 0.2, 0.08);
    lowpass(s, 500);
    return s;
  },

  // ── Skills ─────────────────────────────────────────────

  // Taunt: deep war horn
  skill_taunt: () => {
    const horn = tone(120, 0.5, 'triangle', 0.4, 0.01, 0.1, 0.5, 0.2);
    const overtone = tone(240, 0.45, 'sine', 0.2, 0.01, 0.08, 0.3, 0.18);
    const dry = mix2(horn, overtone, 0.65, 0.35);
    return reverb(dry, 0.35, 0.6, 80);
  },

  // Whirlwind: spinning sweep with wind noise
  skill_whirlwind: () => {
    const spin = sweep(500, 200, 0.45, 'triangle', 0.35, 0.01, 0.08, 0.3, 0.15);
    const wind = noise(0.35, 0.25);
    bandpass(wind, 200, 800);
    return mix2(spin, wind, 0.55, 0.4);
  },

  // ── Weather ────────────────────────────────────────────
  weather_change: () => {
    const sw = sweep(250, 500, 0.9, 'sine', 0.3, 0.05, 0.3, 0.5, 0.3);
    return reverb(sw, 0.3, 0.45, 60);
  },

  // ── Enemy attacks ──────────────────────────────────────

  // Enemy melee: quick punch
  enemy_attack: () => {
    const punch = tone(220, 0.12, 'triangle', 0.4, 0.001, 0.02, 0.1, 0.08);
    lowpass(punch, 500);
    return punch;
  },

  // Mage attack: arcane bolt with reverb
  mage_attack: () => {
    const bolt = sweep(500, 180, 0.3, 'triangle', 0.35, 0.005, 0.05, 0.3, 0.15);
    const hum = tone(120, 0.3, 'sine', 0.15, 0.01, 0.08, 0.3, 0.12);
    lowpass(hum, 200);
    const dry = mix2(bolt, hum, 0.6, 0.4);
    return reverb(dry, 0.3, 0.45, 45);
  },
};

// ─── Public API ────────────────────────────────────────────────

const urlCache: Partial<Record<SfxKey, string>> = {};

/** Get a Blob URL for a synthesized SFX (cached). Returns null if no synth defined. */
export function getSynthUrl(key: SfxKey): string | null {
  const gen = generators[key];
  if (!gen) return null;
  if (urlCache[key]) return urlCache[key]!;
  const samples = gen();
  const url = toBlobUrl(samples);
  urlCache[key] = url;
  return url;
}

/** Check whether a given SFX key has a synthesizer defined. */
export function hasSynth(key: SfxKey): boolean {
  return key in generators;
}

/** All keys that have synthesizers (for cleanup). */
export function synthKeys(): SfxKey[] {
  return Object.keys(generators) as SfxKey[];
}

/** Revoke all cached Blob URLs (call on page unload if desired). */
export function revokeAll(): void {
  for (const url of Object.values(urlCache)) {
    if (url) URL.revokeObjectURL(url);
  }
}
