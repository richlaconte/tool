import { describe, expect, it } from 'vitest';
import { atob, btoa } from 'node:buffer';
import { generateRunPool, generateShop } from '../../src/sim/players';
import { makeRng } from '../../src/sim/rng';
import type { Squad } from '../../src/types';

// jsdom-free btoa/atob shim for the encoding module
globalThis.btoa = globalThis.btoa ?? ((s: string) => btoa(s));
globalThis.atob = globalThis.atob ?? ((s: string) => atob(s));

const { encodeChallenge, readChallengeFromHash } = await import(
  '../../src/state/challenge'
);

describe('friend challenge (US-11)', () => {
  it('encodes and decodes a squad + seed round-trip via URL hash', () => {
    const rng = makeRng(7);
    const cards = generateShop(rng, 3, generateRunPool(3));
    const squad: Squad = {
      cards,
      lineup: [
        { cardId: cards[0].id, slot: 'GK' },
        { cardId: cards[1].id, slot: 'FWD' },
      ],
    };
    const hash = `#challenge=${encodeChallenge(squad, 987654)}`;
    const decoded = readChallengeFromHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.seed).toBe(987654);
    expect(decoded!.squad.cards).toEqual(cards);
    expect(decoded!.squad.lineup).toEqual(squad.lineup);
  });

  it('rejects garbage hashes', () => {
    expect(readChallengeFromHash('#challenge=not-valid!!!')).toBeNull();
    expect(readChallengeFromHash('#other=abc')).toBeNull();
    expect(readChallengeFromHash('')).toBeNull();
  });
});
