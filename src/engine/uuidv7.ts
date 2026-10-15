/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Monotonically increasing UUIDv7 implementation according to RFC 9562.
 * UUIDv7 embeds a 48-bit millisecond timestamp at the front, guaranteeing
 * temporal natural ordering, index locality, and collision resistance.
 */

let lastTimestamp = -1;
let subMsCounter = 0;

export function generateUUIDv7(customTimestamp?: number): string {
  const now = customTimestamp ?? Date.now();

  if (now === lastTimestamp) {
    subMsCounter = (subMsCounter + 1) & 0x0fff; // 12-bit sequence counter
    if (subMsCounter === 0) {
      // Counter overflow within same millisecond: artificially step timestamp forward
      lastTimestamp++;
    }
  } else {
    lastTimestamp = now;
    // Initialize counter with random 4-bit seed to deter predictability
    subMsCounter = Math.floor(Math.random() * 0x10);
  }

  const effectiveTimestamp = Math.max(now, lastTimestamp);

  // 48-bit timestamp
  const timeHex = effectiveTimestamp.toString(16).padStart(12, '0');
  const timeHigh = timeHex.slice(0, 8);
  const timeMid = timeHex.slice(8, 12);

  // 4-bit version (7) + 12-bit sequence/random counter
  const verAndSeq = ((7 << 12) | (subMsCounter & 0x0fff)).toString(16).padStart(4, '0');

  // 2-bit variant (10xx) + 14-bit random
  const randA = (0x8000 | (Math.floor(Math.random() * 0x3fff))).toString(16).padStart(4, '0');

  // 48-bit trailing randomness
  const randB = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  ).join('');

  return `${timeHigh}-${timeMid}-${verAndSeq}-${randA}-${randB}`.toLowerCase();
}

/**
 * Extracts Unix millisecond timestamp from canonical UUIDv7 string.
 */
export function extractTimestampFromUUIDv7(uuid: string): number {
  const clean = uuid.replace(/-/g, '');
  if (clean.length < 12) return NaN;
  const timeHex = clean.slice(0, 12);
  return parseInt(timeHex, 16);
}
