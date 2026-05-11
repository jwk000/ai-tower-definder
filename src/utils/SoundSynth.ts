/**
 * SoundSynth — Procedural WAV generator for placeholder SFX.
 *
 * Generates simple synthetic sounds (electronic / 8-bit style) and
 * returns them as Blob URLs compatible with HTMLAudioElement.
 * All sounds are generated once at preload time and cached.
 */

import type { SfxKey } from './Sound.js';

// ─── WAV helpers ─────────────────────────────────────────────

const SAMPLE_RATE = 22050; // 22kHz — compact, good enough for SFX

function wavHeader(dataLen: number): ArrayBuffer {
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const pcmLen = dataLen * 2; // 16-bit mono
  writeStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + pcmLen, true);
  writeStr(v, 8, 'WAVE');
  writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true);         // chunk size
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

// ─── Oscillator / envelope ────────────────────────────────────

function tone(freq: number, dur: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine'): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const phase = (freq * t) % 1;
    const env = envelope(t, dur);
    out[i] = osc(phase, type) * env * 0.35;
  }
  return out;
}

function noise(dur: number, color: 'white' | 'pinkish' = 'white'): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, dur);
    if (color === 'pinkish') {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      out[i] = ((b0 + b1 + b2 + w * 0.5362) * 0.11) * env * 0.3;
    } else {
      out[i] = (Math.random() * 2 - 1) * env * 0.25;
    }
  }
  return out;
}

function sweep(freqStart: number, freqEnd: number, dur: number, type: 'sine' | 'sawtooth' = 'sine'): Float32Array {
  const len = Math.ceil(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const ratio = t / dur;
    const freq = freqStart + (freqEnd - freqStart) * ratio;
    phase += freq / SAMPLE_RATE;
    const env = envelope(t, dur);
    out[i] = osc(phase % 1, type) * env * 0.35;
  }
  return out;
}

function sequence(notes: Array<{ freq: number; dur: number }>): Float32Array {
  const totalDur = notes.reduce((s, n) => s + n.dur, 0);
  const len = Math.ceil(SAMPLE_RATE * totalDur);
  const out = new Float32Array(len);
  let cursor = 0;
  for (const note of notes) {
    const noteLen = Math.ceil(SAMPLE_RATE * note.dur);
    for (let i = 0; i < noteLen; i++) {
      const t = i / SAMPLE_RATE;
      const phase = (note.freq * t) % 1;
      const env = Math.max(0, 1 - t / note.dur);
      out[cursor + i] = osc(phase, 'sine') * env * 0.3;
    }
    cursor += noteLen;
  }
  return out;
}

function envelope(t: number, total: number): number {
  const atk = 0.01; // 10ms attack
  const rel = total * 0.3; // last 30% is release
  if (t < atk) return t / atk;
  const susStart = atk;
  const susEnd = total - rel;
  if (t < susStart) return 1;
  if (t < susEnd) return 1;
  return Math.max(0, 1 - (t - susEnd) / rel);
}

function osc(phase: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle'): number {
  switch (type) {
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * phase - 1;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    default: return Math.sin(2 * Math.PI * phase);
  }
}

// ─── Mix helpers ──────────────────────────────────────────────

function mix(a: Float32Array, b: Float32Array, aVol = 0.5, bVol = 0.5): Float32Array {
  const len = Math.max(a.length, b.length);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = (a[i] ?? 0) * aVol + (b[i] ?? 0) * bVol;
  }
  return out;
}

// ─── Sound generators per key ──────────────────────────────────

const generators: Partial<Record<SfxKey, () => Float32Array>> = {
  // ── UI ──────────────────────────────────────────────
  ui_click: () => tone(1200, 0.05, 'square'),
  ui_error: () => tone(200, 0.18, 'sawtooth'),
  build_deny: () => tone(150, 0.2, 'square'),

  upgrade: () => sweep(440, 880, 0.35, 'sine'),
  sell: () => sweep(880, 220, 0.3, 'sawtooth'),

  // ── Tower attacks ───────────────────────────────────
  tower_arrow: () => tone(1100, 0.15, 'triangle'),
  tower_cannon: () => mix(tone(80, 0.25, 'sine'), noise(0.25, 'pinkish'), 0.7, 0.3),
  tower_ice: () => mix(tone(1600, 0.15, 'sine'), noise(0.1, 'white'), 0.6, 0.2),
  tower_lightning: () => noise(0.2, 'pinkish'),
  tower_laser: () => tone(800, 0.25, 'sawtooth'),
  tower_bat: () => sweep(600, 300, 0.2, 'sawtooth'),
  tower_missile: () => sweep(100, 40, 0.4, 'sine'),

  // ── Hit impacts ─────────────────────────────────────
  arrow_hit: () => tone(300, 0.08, 'triangle'),
  cannon_hit: () => mix(tone(60, 0.2, 'sine'), noise(0.3, 'pinkish'), 0.4, 0.6),
  ice_hit: () => tone(2000, 0.12, 'sine'),
  lightning_hit: () => noise(0.15, 'pinkish'),
  missile_impact: () => mix(sweep(80, 30, 0.6, 'sine'), noise(0.6, 'pinkish'), 0.4, 0.6),
  enemy_hit: () => tone(400, 0.06, 'square'),

  // ── Game phase ──────────────────────────────────────
  victory: () => sequence([
    { freq: 523, dur: 0.15 }, { freq: 659, dur: 0.15 },
    { freq: 784, dur: 0.15 }, { freq: 1047, dur: 0.4 },
  ]),
  wave_clear: () => sequence([
    { freq: 784, dur: 0.12 }, { freq: 1047, dur: 0.2 },
  ]),
  wave_boss: () => mix(tone(120, 0.6, 'sawtooth'), tone(80, 0.6, 'square'), 0.5, 0.5),
  countdown_tick: () => tone(1000, 0.06, 'square'),
  countdown_go: () => sweep(400, 800, 0.25, 'sawtooth'),

  // ── Enemy ───────────────────────────────────────────
  enemy_spawn: () => sweep(200, 100, 0.25, 'sawtooth'),
  boss_phase2: () => mix(sweep(60, 120, 0.7, 'sawtooth'), tone(40, 0.7, 'square'), 0.6, 0.4),
  exploder_boom: () => mix(noise(0.5, 'pinkish'), sweep(120, 30, 0.5, 'sine'), 0.5, 0.5),
  base_hit: () => mix(tone(180, 0.25, 'square'), noise(0.2, 'white'), 0.6, 0.2),

  // ── Economy ─────────────────────────────────────────
  gold_earn: () => tone(1500, 0.12, 'triangle'),
  gold_spend: () => sweep(800, 200, 0.15, 'sawtooth'),

  // ── Skills ──────────────────────────────────────────
  skill_taunt: () => mix(tone(150, 0.4, 'square'), sweep(300, 150, 0.3, 'sawtooth'), 0.5, 0.5),
  skill_whirlwind: () => mix(
    sweep(600, 300, 0.4, 'sawtooth'),
    noise(0.3, 'white'), 0.5, 0.3,
  ),

  // ── Weather ─────────────────────────────────────────
  weather_change: () => sweep(300, 600, 0.8, 'sine'),

  // ── Enemy attack ────────────────────────────────────
  enemy_attack: () => tone(350, 0.15, 'sawtooth'),
  mage_attack: () => sweep(400, 200, 0.25, 'sine'),
};

// ─── Public API ────────────────────────────────────────────────

const urlCache: Partial<Record<SfxKey, string>> = {};

/** Get a Blob URL for a synthesized SFX (cached).  Returns null if no synth defined. */
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
