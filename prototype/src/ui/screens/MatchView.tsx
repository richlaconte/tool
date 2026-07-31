import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { PLAYER_ID } from '../../sim/tournament';
import type { MatchEvent } from '../../types';
import { isNotable, minuteOf, narrate } from '../narratives';
import { concedeSound, goalSound, whistleSound } from '../sound';

type Speed = 'normal' | 'fast' | 'turbo';

function dwellFor(e: MatchEvent, speed: Speed, turboDwell: number): number {
  if (speed === 'turbo') return turboDwell;
  const scale = speed === 'fast' ? 0.5 : 1;
  switch (e.type) {
    case 'GOAL':
    case 'PENALTY':
      return 4000 * scale;
    case 'CHANCE':
    case 'SAVED':
    case 'BLOCKED':
      return 2600 * scale;
    default:
      return 1700 * scale;
  }
}

const OUTCOME_TYPES = new Set(['GOAL', 'SAVED', 'BLOCKED', 'MISSED', 'PENALTY']);

// ─── Ball trajectory ────────────────────────────────────────────────
// Deterministic per-event ball positions: build-up uses midfield lanes,
// chances push into the box, goals hit the net, misses go wide, corners
// reach the flag. The ball glides between positions at narration speed.

interface BallPos {
  x: number; // 0–100, HOME attacks toward 100
  y: number; // 0–100, 50 = center lane
}

function hash01(n: number): number {
  let h = Math.imul(n >>> 0, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0;
  return ((h ^ (h >>> 7)) >>> 0) / 4294967296;
}

function positionFor(e: MatchEvent, prev: BallPos): BallPos {
  const towardHome = e.team === 'HOME';
  const depth = (d: number): number => (towardHome ? d : 100 - d);
  const lane = 20 + hash01(e.tick * 31 + 7) * 60;
  const wide = hash01(e.tick * 17 + 3) > 0.5 ? 7 : 93;
  switch (e.type) {
    case 'KICKOFF':
    case 'FULLTIME':
      return { x: 50, y: 50 };
    case 'COUNTER':
      return { x: depth(48 + hash01(e.tick) * 10), y: lane };
    case 'ATTACK':
      return { x: depth(56 + hash01(e.tick) * 12), y: lane };
    case 'CHANCE':
      return { x: depth(74 + hash01(e.tick * 3) * 12), y: 35 + hash01(e.tick * 5) * 30 };
    case 'GOAL':
      return { x: depth(96), y: 44 + hash01(e.tick * 11) * 12 };
    case 'PENALTY':
      return { x: depth(89), y: 50 };
    case 'SAVED':
      return { x: depth(90), y: 42 + hash01(e.tick * 11) * 16 };
    case 'BLOCKED':
      return { x: depth(80), y: lane };
    case 'MISSED':
      return { x: depth(92), y: wide };
    case 'CORNER':
      return { x: depth(97), y: wide };
    case 'FOUL':
    case 'CARD':
      return { x: depth(38 + hash01(e.tick) * 22), y: lane };
    default:
      return prev;
  }
}

function ballPath(events: MatchEvent[]): BallPos[] {
  const path: BallPos[] = [];
  let prev: BallPos = { x: 50, y: 50 };
  for (const e of events) {
    prev = positionFor(e, prev);
    path.push(prev);
  }
  return path;
}

export function MatchView() {
  const { game, finishMatch } = useStore();
  const match = game?.lastMatch ?? null;

  const events = useMemo(
    () => (match ? match.events.filter(isNotable) : []),
    [match],
  );
  const turboDwell = events.length > 0 ? 15000 / events.length : 400;

  const [idx, setIdx] = useState(0); // number of events revealed
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>('normal');
  const feedRef = useRef<HTMLDivElement>(null);

  const done = idx >= events.length;
  const current = idx > 0 ? events[idx - 1] : null;

  useEffect(() => {
    if (!match || !playing || done) return;
    const next = events[idx];
    const t = setTimeout(() => setIdx((v) => v + 1), dwellFor(next, speed, turboDwell));
    return () => clearTimeout(t);
  }, [match, playing, done, idx, events, speed, turboDwell]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [idx]);

  // Sound effects keyed to revealed events (US-13).
  const playerTeam = match?.home.managerId === PLAYER_ID ? 'HOME' : 'AWAY';
  useEffect(() => {
    if (!current) return;
    if (current.type === 'GOAL' || current.narrativeKey === 'goal.penalty') {
      if (current.team === playerTeam) goalSound(); else concedeSound();
    }
    if (current.type === 'FULLTIME') whistleSound();
  }, [idx]);

  // Ball trajectory: deterministic per-event positions, glided at narration speed.
  const path = useMemo(() => ballPath(events), [events]);

  if (!game || !match) return null;

  const homeName =
    game.managers.find((m) => m.id === match.home.managerId)?.name ?? 'Home';
  const awayName =
    game.managers.find((m) => m.id === match.away.managerId)?.name ?? 'Away';

  const ball: BallPos = idx > 0 ? path[idx - 1] : { x: 50, y: 50 };
  const glideMs = current ? dwellFor(current, speed, turboDwell) : 700;
  const trail = path.slice(Math.max(0, idx - 5), Math.max(0, idx - 1));
  const isGoal = current?.type === 'GOAL' || current?.narrativeKey === 'goal.penalty';
  const playerScored = isGoal && current?.team === playerTeam;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-3 p-4">
      {/* Scoreboard */}
      <header className="flex items-center justify-between rounded-xl bg-black/40 px-4 py-3">
        <div className="w-24 truncate text-sm font-bold">{homeName}</div>
        <div className="text-center">
          <div className="text-2xl font-black tracking-widest">
            {current ? current.homeScore : 0} – {current ? current.awayScore : 0}
          </div>
          <div className="text-xs text-amber-300">{current ? minuteOf(current) : "0'"}</div>
        </div>
        <div className="w-24 truncate text-right text-sm font-bold">{awayName}</div>
      </header>

      {/* Pitch strip */}
      <div className="relative h-28 overflow-hidden rounded-xl border-2 border-emerald-700/60 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800">
        <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-100/20" />
        <div className="absolute inset-y-2 left-2 w-10 border border-emerald-100/20" />
        <div className="absolute inset-y-2 right-2 w-10 border border-emerald-100/20" />
        {trail.map((p, i) => (
          <div
            key={i}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: 0.15 + (0.35 * (i + 1)) / trail.length,
            }}
          />
        ))}
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-all ease-in-out"
          style={{
            left: `${ball.x}%`,
            top: `${ball.y}%`,
            transitionDuration: `${glideMs}ms`,
          }}
        />
        {isGoal && (
          <div
            className={`goal-flash absolute inset-0 flex items-center justify-center text-3xl font-black ${
              playerScored ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            ⚽ GOAL!
          </div>
        )}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-black">
            FULL TIME · {match.homeGoals} – {match.awayGoals}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          disabled={done}
          className="rounded-lg bg-black/40 px-3 py-1.5 text-sm font-semibold hover:bg-black/60 disabled:opacity-40"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        {(['normal', 'fast'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              speed === s ? 'bg-emerald-500 text-emerald-950' : 'bg-black/40 hover:bg-black/60'
            }`}
          >
            {s === 'normal' ? '1×' : '2×'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSpeed('turbo');
            setPlaying(true);
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            speed === 'turbo' ? 'bg-amber-400 text-emerald-950' : 'bg-black/40 hover:bg-black/60'
          }`}
        >
          ⚡ Turbo
        </button>
        <button
          type="button"
          onClick={() => {
            setIdx(events.length);
            setPlaying(false);
          }}
          disabled={done}
          className="rounded-lg bg-black/40 px-3 py-1.5 text-sm font-semibold hover:bg-black/60 disabled:opacity-40"
        >
          ⏭ Skip
        </button>
      </div>

      {/* Event feed */}
      <div
        ref={feedRef}
        className="flex-1 space-y-1.5 overflow-y-auto rounded-xl bg-black/30 p-3"
        style={{ maxHeight: '40vh' }}
      >
        {events.slice(0, idx).map((e, i) => {
          const mine = e.team === playerTeam;
          const prob =
            OUTCOME_TYPES.has(e.type) && e.probability !== undefined
              ? ` (${Math.round(e.probability * 100)}%)`
              : '';
          return (
            <div
              key={i}
              className={`flex gap-2 text-sm ${
                i === idx - 1 ? 'font-semibold text-emerald-50' : 'text-emerald-200/70'
              } ${e.type === 'GOAL' ? (mine ? 'text-amber-300' : 'text-rose-300') : ''}`}
            >
              <span className="w-8 shrink-0 text-right text-xs text-emerald-400/50">
                {minuteOf(e)}
              </span>
              <span>
                {narrate(e, match.home, match.away)}
                <span className="text-xs text-emerald-400/40">{prob}</span>
              </span>
            </div>
          );
        })}
        {idx === 0 && (
          <p className="text-sm text-emerald-300/60">Match starting…</p>
        )}
      </div>

      {done && (
        <button
          type="button"
          onClick={finishMatch}
          className="rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400"
        >
          Continue →
        </button>
      )}
    </div>
  );
}
