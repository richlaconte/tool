// Seeded PRNG (mulberry32) — the sole entropy source for the whole game.
// No Math.random(), no Date.now() anywhere in src/sim/.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number;
  /** Roll a probability. */
  chance(p: number): boolean;
  /** Pick an index by weights (need not sum to 1). */
  pickWeighted(weights: number[]): number;
  /** Pick an element by weights. */
  pickWeightedItem<T>(items: readonly T[], weights: number[]): T;
  /** Uniformly pick one element. */
  pick<T>(items: readonly T[]): T;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pickWeighted(weights) {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    pickWeightedItem(items, weights) {
      return items[this.pickWeighted(weights)];
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}

/** Deterministically derive a child seed from a run seed + tags. */
export function deriveSeed(seed: number, ...tags: (string | number)[]): number {
  let h = seed >>> 0;
  for (const tag of tags) {
    const s = String(tag);
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
    }
    h = Math.imul(h ^ 0x9e3779b9, 2246822519);
  }
  return h >>> 0;
}

let counter = 0;
/** Sim-internal unique id, deterministic per seed+counter sequence. */
export function makeId(rng: Rng, prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Math.floor(rng.next() * 1e9).toString(36)}-${counter.toString(36)}`;
}
