import { describe, expect, it } from 'vitest';
import { deriveSeed, makeRng } from '../../src/sim/rng';

describe('rng', () => {
  it('same seed produces identical sequences', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds diverge', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('range stays within bounds', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('pickWeighted roughly follows weights over 100k draws', () => {
    const rng = makeRng(99);
    const counts = [0, 0, 0];
    for (let i = 0; i < 100_000; i++) {
      counts[rng.pickWeighted([1, 2, 7])]++;
    }
    expect(counts[2] / 100_000).toBeGreaterThan(0.65);
    expect(counts[2] / 100_000).toBeLessThan(0.75);
    expect(counts[0] / 100_000).toBeGreaterThan(0.07);
    expect(counts[0] / 100_000).toBeLessThan(0.13);
  });

  it('deriveSeed is deterministic and tag-sensitive', () => {
    expect(deriveSeed(5, 'a', 1)).toBe(deriveSeed(5, 'a', 1));
    expect(deriveSeed(5, 'a', 1)).not.toBe(deriveSeed(5, 'a', 2));
    expect(deriveSeed(5, 'a', 1)).not.toBe(deriveSeed(5, 'b', 1));
  });
});
