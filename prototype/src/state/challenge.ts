// Friend challenge (US-11): squad + seed encoded into the URL hash.
// No server, no storage — the URL is the payload.

import type { ChallengePayload, Squad } from '../types';

function toBase64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeChallenge(squad: Squad, seed: number): string {
  const payload: ChallengePayload = { v: 1, seed, squad };
  return toBase64Url(JSON.stringify(payload));
}

export function challengeLink(squad: Squad, seed: number): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#challenge=${encodeChallenge(squad, seed)}`;
}

export function readChallengeFromHash(hash: string): ChallengePayload | null {
  const m = hash.match(/#challenge=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(m[1])) as ChallengePayload;
    if (parsed.v !== 1 || !parsed.squad || typeof parsed.seed !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
