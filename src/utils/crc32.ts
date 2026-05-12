/**
 * CRC32 (IEEE 802.3 polynomial 0xEDB88320) — pure-JS table-lookup implementation.
 *
 * Used by SaveManager (design/13 §6.1) for save-file corruption detection.
 * Output is unsigned 32-bit (>>> 0 normalized).
 */

let CRC_TABLE: Uint32Array | null = null;

function buildTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

export function crc32(input: string): number {
  if (!CRC_TABLE) CRC_TABLE = buildTable();
  const table = CRC_TABLE;
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i) & 0xff;
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
