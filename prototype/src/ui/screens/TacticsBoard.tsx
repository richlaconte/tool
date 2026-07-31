import { useState } from 'react';
import { useStore } from '../../state/store';
import { PLAYER_ID } from '../../sim/tournament';
import { detectCombos } from '../../sim/combos';
import type { PositionLine } from '../../types';
import { NATIONALITY_FLAG } from '../../sim/players.data';
import { ComboPanel } from '../components/ComboPanel';

const LINES: { slot: PositionLine; label: string }[] = [
  { slot: 'FWD', label: 'Forwards' },
  { slot: 'MID', label: 'Midfield' },
  { slot: 'DEF', label: 'Defense' },
  { slot: 'GK', label: 'Goalkeeper' },
];

export function TacticsBoard() {
  const { game, placePlayer, unplacePlayer, kickOff } = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  if (!game) return null;
  const player = game.managers.find((m) => m.id === PLAYER_ID)!;
  const { squad, squadCap } = player;

  const fieldedIds = new Set(squad.lineup.map((l) => l.cardId));
  const bench = squad.cards.filter((c) => !fieldedIds.has(c.id));
  const gkCount = squad.lineup.filter((l) => l.slot === 'GK').length;
  const valid = gkCount === 1 && squad.lineup.length >= 2;
  const combos = detectCombos(squad);

  const opponentName = game.currentPairing
    ? game.managers.find(
        (m) =>
          m.id ===
          (game.currentPairing!.home === PLAYER_ID
            ? game.currentPairing!.away
            : game.currentPairing!.home),
      )?.name
    : null;

  const placeIn = (slot: PositionLine) => {
    if (!selected) return;
    placePlayer(selected, slot);
    setSelected(null);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tactics</h2>
        <span className="rounded-lg bg-black/40 px-3 py-1.5 text-sm font-semibold">
          {squad.lineup.length}/{squadCap} fielded
        </span>
      </header>

      {opponentName ? (
        <p className="rounded-lg bg-black/30 px-3 py-2 text-sm">
          Next opponent: <span className="font-bold text-rose-300">{opponentName}</span>
        </p>
      ) : (
        <p className="rounded-lg bg-black/30 px-3 py-2 text-sm text-emerald-300/80">
          Bye round — no opponent. Free prize money, enjoy.
        </p>
      )}

      {/* Pitch */}
      <div className="overflow-hidden rounded-xl border-2 border-emerald-700/60 bg-emerald-800/40">
        {LINES.map(({ slot, label }) => {
          const inLine = squad.lineup.filter((l) => l.slot === slot);
          return (
            <button
              key={slot}
              type="button"
              onClick={() => placeIn(slot)}
              className={`flex w-full items-center gap-2 border-b border-emerald-700/40 px-3 py-3 text-left last:border-b-0 ${
                selected ? 'hover:bg-emerald-700/40 cursor-pointer' : 'cursor-default'
              }`}
            >
              <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-emerald-300/70">
                {label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {inLine.length === 0 && (
                  <span className="text-xs text-emerald-400/40">
                    {selected ? 'Tap to place here' : '—'}
                  </span>
                )}
                {inLine.map((l) => {
                  const c = squad.cards.find((x) => x.id === l.cardId)!;
                  const outOfPosition =
                    c.naturalPosition !== slot &&
                    !(slot === 'DEF' && c.naturalPosition === 'MID') &&
                    !(slot === 'MID' && (c.naturalPosition === 'DEF' || c.naturalPosition === 'FWD')) &&
                    !(slot === 'FWD' && c.naturalPosition === 'MID');
                  return (
                    <span
                      key={l.cardId}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        unplacePlayer(l.cardId);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && unplacePlayer(l.cardId)}
                      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${
                        outOfPosition
                          ? 'bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/60'
                          : 'bg-emerald-600/50 text-emerald-100'
                      }`}
                      title={outOfPosition ? 'Out of position! Tap to bench' : 'Tap to bench'}
                    >
                      {NATIONALITY_FLAG[c.nationality]} {c.name}
                      {outOfPosition ? ' ⚠️' : ''}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bench */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300/70">
          Squad — tap a player, then tap a line
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {bench.length === 0 && (
            <span className="text-xs text-emerald-400/50">Everyone is fielded.</span>
          )}
          {bench.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(selected === c.id ? null : c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                selected === c.id
                  ? 'bg-amber-400 text-emerald-950'
                  : 'bg-black/40 text-emerald-100 hover:bg-black/60'
              }`}
            >
              {NATIONALITY_FLAG[c.nationality]} {c.name} · {c.naturalPosition}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300/70">
          Combinations
        </h3>
        <ComboPanel combos={combos} />
      </section>

      {!valid && (
        <p className="text-center text-sm text-amber-300">
          You need exactly 1 goalkeeper and at least 2 players fielded.
        </p>
      )}
      <button
        type="button"
        onClick={kickOff}
        disabled={!valid}
        className="mt-auto rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
      >
        {opponentName ? '⚽ Kick Off' : 'Collect Bye Prize →'}
      </button>
    </div>
  );
}
