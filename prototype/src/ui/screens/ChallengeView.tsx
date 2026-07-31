import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChallengePayload, MatchResult, Squad } from '../../types';
import { aiSetLineup, aiTakeTransferWindow } from '../../sim/ai';
import { resolveSquad } from '../../sim/combos';
import { simulateMatch } from '../../sim/match';
import { generateRunPool } from '../../sim/players';
import { deriveSeed, makeRng } from '../../sim/rng';
import type { ManagerState } from '../../types';
import { Flag } from '../components/Flag';
import { isNotable, minuteOf, narrate } from '../narratives';
import { concedeSound, goalSound, whistleSound } from '../sound';

function buildChallengerSquad(seed: number, variant: number): Squad {
  const rng = makeRng(deriveSeed(seed, 'challenger', variant));
  let m: ManagerState = {
    id: `challenger-${variant}`,
    name: 'Challenger',
    hp: 20,
    credits: 14,
    squad: { cards: [], lineup: [] },
    squadCap: 5,
    winStreak: 0,
    eliminated: false,
  };
  m = aiTakeTransferWindow(rng, m, 4, generateRunPool(deriveSeed(seed, 'pool', variant)));
  m = aiSetLineup(m);
  return m.squad;
}

export function ChallengeView({ payload }: { payload: ChallengePayload }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [idx, setIdx] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(
    () => [0, 1, 2].map((v) => buildChallengerSquad(payload.seed, v)),
    [payload.seed],
  );

  const events = useMemo(
    () => (match ? match.events.filter(isNotable) : []),
    [match],
  );
  const done = match !== null && idx >= events.length;
  const current = idx > 0 ? events[idx - 1] : null;

  useEffect(() => {
    if (!match || done) return;
    const t = setTimeout(() => setIdx((v) => v + 1), 1800);
    return () => clearTimeout(t);
  }, [match, done, idx]);

  useEffect(() => {
    if (!current) return;
    if (current.type === 'GOAL' || current.narrativeKey === 'goal.penalty') {
      if (current.team === 'HOME') goalSound(); else concedeSound();
    }
    if (current.type === 'FULLTIME') whistleSound();
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [current]);

  const pick = (i: number) => {
    setChoice(i);
    const result = simulateMatch(
      resolveSquad('you', candidates[i]),
      resolveSquad('challenger', payload.squad),
      payload.seed,
    );
    setMatch(result);
  };

  const snapshotPlayers = payload.squad.lineup.flatMap((l) => {
    const c = payload.squad.cards.find((x) => x.id === l.cardId);
    return c ? [{ c, slot: l.slot }] : [];
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4">
      <header className="text-center">
        <div className="text-3xl">⚔️</div>
        <h1 className="text-2xl font-black">Squad Challenge</h1>
        <p className="text-sm text-emerald-300/80">
          A friend dares you to beat this squad:
        </p>
      </header>

      <div className="rounded-xl bg-black/30 p-3">
        <div className="flex flex-wrap gap-1.5">
          {snapshotPlayers.map(({ c, slot }) => (
            <span
              key={c.id}
              className="rounded-full bg-emerald-700/50 px-2.5 py-1 text-xs font-medium"
            >
              <Flag nationality={c.nationality} /> {c.name} · {slot}
            </span>
          ))}
        </div>
      </div>

      {!match && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300/70">
            Pick your squad to face them
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {candidates.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(i)}
                disabled={choice !== null}
                className="rounded-xl border-2 border-emerald-600/50 bg-emerald-900/50 p-3 text-left hover:border-amber-400"
              >
                <div className="mb-1 text-sm font-bold">Squad {String.fromCharCode(65 + i)}</div>
                <div className="flex flex-wrap gap-1">
                  {s.lineup.map((l) => {
                    const c = s.cards.find((x) => x.id === l.cardId)!;
                    return (
                      <span key={l.cardId} className="rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
                        <Flag nationality={c.nationality} /> {c.name}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {match && (
        <>
          <header className="flex items-center justify-between rounded-xl bg-black/40 px-4 py-3">
            <span className="text-sm font-bold">You</span>
            <span className="text-2xl font-black tracking-widest">
              {current ? current.homeScore : 0} – {current ? current.awayScore : 0}
            </span>
            <span className="text-sm font-bold">Challenger</span>
          </header>
          <div
            ref={feedRef}
            className="flex-1 space-y-1.5 overflow-y-auto rounded-xl bg-black/30 p-3"
            style={{ maxHeight: '45vh' }}
          >
            {events.slice(0, idx).map((e, i) => (
              <div key={i} className={`flex gap-2 text-sm ${e.type === 'GOAL' ? 'font-semibold text-amber-300' : 'text-emerald-200/80'}`}>
                <span className="w-8 shrink-0 text-right text-xs text-emerald-400/50">
                  {minuteOf(e)}
                </span>
                <span>{narrate(e, match.home, match.away)}</span>
              </div>
            ))}
          </div>
          {done && (
            <div className="space-y-3 text-center">
              <p className="text-2xl font-black">
                {match.homeGoals > match.awayGoals
                  ? '🎉 You beat their squad!'
                  : match.homeGoals === match.awayGoals
                    ? "🤝 A draw — honors even."
                    : '💔 Their squad wins this one.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400"
              >
                ▶ Play Tactics FC yourself
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
