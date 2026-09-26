/** mulberry32: small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs `fn` with Math.random temporarily replaced by a seeded PRNG, so that
 * all randomness inside a playout (determinization, BotArbiter coin flips and
 * shuffles, which call Math.random directly) is reproducible. Used for
 * "common random numbers": every candidate of a round sees the same draws,
 * which removes most of the luck from the comparison between candidates.
 * Safe because the whole playout is synchronous; restored in `finally`.
 */
export function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
