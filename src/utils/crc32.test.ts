/**
 * CRC32 (IEEE 802.3) — golden-vector verification.
 *
 * Reference values from standard CRC32 calculators (zlib / Python binascii.crc32).
 */
import { describe, it, expect } from 'vitest';
import { crc32 } from './crc32.js';

describe('crc32', () => {
  it('empty string → 0', () => {
    expect(crc32('')).toBe(0);
  });

  it('"a" → 0xe8b7be43', () => {
    expect(crc32('a')).toBe(0xe8b7be43);
  });

  it('"abc" → 0x352441c2', () => {
    expect(crc32('abc')).toBe(0x352441c2);
  });

  it('"123456789" → 0xcbf43926 (canonical CRC-32 test vector)', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
  });

  it('deterministic — same input produces same output', () => {
    expect(crc32('hello world')).toBe(crc32('hello world'));
  });

  it('different inputs produce different outputs (collision-free for short strings)', () => {
    expect(crc32('foo')).not.toBe(crc32('bar'));
    expect(crc32('foo')).not.toBe(crc32('Foo'));
  });

  it('output is non-negative 32-bit unsigned integer', () => {
    const result = crc32('any-string-with-special-chars-!@#$%');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(result)).toBe(true);
  });
});
