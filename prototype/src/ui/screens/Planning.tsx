import { useState } from 'react';
import { useStore } from '../../state/store';
import { detectCombos } from '../../sim/combos';
import { positionFit, REROLL_COST } from '../../sim/config';
import { sellValue } from '../../sim/shop';
import type { PlayerCard, PositionLine } from '../../types';
import { NATIONALITY_COLOR, NATIONALITY_FLAG } from '../../sim/players.data';
import { Hud, nextOpponentName, playerManager } from '../components/Hud';
import { PlayerCardView } from '../components/PlayerCardView';
import { ComboPanel } from '../components/ComboPanel';

// ─── TFT-style planning screen: combos, pitch board, bench, shop, one CTA ───

const ZONES: { slot: PositionLine; label: string }[] = [
  { slot: 'FWD', label: 'FWD' },
  { slot: 'MID', label: 'MID' },
  { slot: 'DEF', label: 'DEF' },
  { slot: 'GK', label: 'GK' },
];

function PlayerChip({
  card,
  slot,
  onClick,
  title,
}: {
  card: PlayerCard;
  slot?: PositionLine;
  onClick: () => void;
  title?: string;
}) {
  const outOfPosition = slot !== undefined && positionFit(card.naturalPosition, slot) < 1;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ backgroundColor: `${NATIONALITY_COLOR[card.nationality]}30` }}
      className={`rounded-md px-2 py-1 text-xs font-semibold shadow-sm transition hover:brightness-125 ${
        outOfPosition ? 'ring-2 ring-rose-400' : 'ring-1 ring-white/20'
      }`}
    >
      <span className="text-sm leading-none">{NATIONALITY_FLAG[card.nationality]}</span>
      <span className="rounded bg-black/40 px-1 py-px text-[10px] font-black uppercase tracking-wide text-white/70">
        {card.naturalPosition}
      </span>
      {card.name}
      <span className={`ml-0.5 tracking-tight ${card.star > 1 ? 'text-amber-300' : 'text-white/45'}`}>
        {'★'.repeat(card.star)}
      </span>
      {outOfPosition ? ' ⚠' : ''}
    </button>
  );
}

export function Planning() {
  const { game, buyCard, sellCard, rerollShop, placePlayer, unplacePlayer, kickOff } =
    useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [sellMode, setSellMode] = useState(false);
  if (!game) return null;

  const player = playerManager(game);
  const { squad, squadCap } = player;
  const fieldedIds = new Set(squad.lineup.map((l) => l.cardId));
  const bench = squad.cards.filter((c) => !fieldedIds.has(c.id));
  const gkCount = squad.lineup.filter((l) => l.slot === 'GK').length;
  const valid = gkCount === 1 && squad.lineup.length >= 2;
  const combos = detectCombos(squad);
  const opponent = nextOpponentName(game);
  const canReroll = player.credits >= REROLL_COST;

  const onBenchTap = (c: PlayerCard) => {
    if (sellMode) {
      sellCard(c.id);
      return;
    }
    setSelected(selected === c.id ? null : c.id);
  };

  const placeIn = (slot: PositionLine) => {
    if (!selected) return;
    placePlayer(selected, slot);
    setSelected(null);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <Hud game={game} />

      {/* Combos */}
      <div className="px-3 pt-2">
        <ComboPanel combos={combos} />
      </div>

      {/* Pitch board */}
      <div className="px-3 pt-2">
        <div
          className="overflow-hidden rounded-md border border-emerald-700/70"
          style={{
            background:
              'repeating-linear-gradient(180deg, #065f46 0px, #065f46 22px, #047857 22px, #047857 44px)',
          }}
        >
          {ZONES.map(({ slot, label }, zi) => {
            const inLine = squad.lineup.filter((l) => l.slot === slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => placeIn(slot)}
                className={`relative flex w-full items-center gap-2 border-b border-white/10 px-2 py-2.5 text-left last:border-b-0 ${
                  selected ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'
                }`}
              >
                <span className="w-10 shrink-0 text-[11px] font-black uppercase tracking-widest text-white/50">
                  {label}
                </span>
                {zi === 0 && (
                  <span className="pointer-events-none absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-white/10" />
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {inLine.length === 0 && (
                    <span className="text-xs text-white/35">
                      {selected ? 'tap to place here' : '·'}
                    </span>
                  )}
                  {inLine.map((l) => {
                    const c = squad.cards.find((x) => x.id === l.cardId)!;
                    return (
                      <PlayerChip
                        key={l.cardId}
                        card={c}
                        slot={slot}
                        title="Tap to send to bench"
                        onClick={() => {
                          unplacePlayer(l.cardId);
                        }}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-emerald-300/60">
          {selected
            ? 'Now tap a line on the pitch to place them.'
            : `Fielded ${squad.lineup.length}/${squadCap} · tap a bench player, then a line.`}
        </p>
      </div>

      {/* Bench */}
      <div className="px-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300/60">
            Squad ({squad.cards.length})
          </span>
          <button
            type="button"
            onClick={() => setSellMode((v) => !v)}
            className={`rounded-md px-2 py-1 text-xs font-bold ${
              sellMode ? 'bg-rose-500/80 text-white' : 'bg-black/30 text-emerald-200 hover:bg-black/50'
            }`}
          >
            {sellMode ? 'Done selling' : 'Sell mode'}
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {bench.length === 0 && (
            <span className="text-xs text-emerald-300/50">
              {squad.cards.length === 0
                ? 'No players yet — sign some from the shop below.'
                : 'Everyone is on the pitch.'}
            </span>
          )}
          {bench.map((c) => (
            <PlayerChip
              key={c.id}
              card={c}
              title={sellMode ? `Sell for +${sellValue(c)} CR` : 'Tap to select, then tap a line'}
              onClick={() => onBenchTap(c)}
            />
          ))}
          {selected && !sellMode && (
            <span className="self-center text-xs font-bold text-amber-300">
              → placing…
            </span>
          )}
        </div>
        {sellMode && (
          <p className="mt-1 text-[11px] text-rose-300/80">
            Sell mode: tap a benched player to sell at full value.
          </p>
        )}
      </div>

      {/* Shop — TFT bottom bar */}
      <div className="mt-2 border-t border-emerald-800/60 bg-emerald-950/60 px-3 pb-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300/60">
            Transfer Market
          </span>
          <button
            type="button"
            onClick={rerollShop}
            disabled={!canReroll}
            className="rounded-md bg-sky-700 px-2.5 py-1 text-xs font-bold text-sky-100 hover:bg-sky-600 disabled:opacity-40"
            title="Fresh 5 cards"
          >
            Reroll · {REROLL_COST}
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {game.currentShop.map((c) => {
            const owned = squad.cards.filter(
              (o) => o.templateId === c.templateId && o.star === c.star,
            ).length;
            return (
              <PlayerCardView
                key={c.id}
                card={c}
                compact
                onClick={player.credits >= c.tier ? () => buyCard(c.id) : undefined}
                mergeBadge={
                  owned > 0 ? (owned === 2 ? '✨ merge → ★★' : `own ×${owned}`) : undefined
                }
              />
            );
          })}
        </div>
      </div>

      {/* Primary CTA */}
      <div className="sticky bottom-0 mt-auto border-t border-emerald-800/60 bg-emerald-950/95 p-3">
        {!valid && (
          <p className="mb-1.5 text-center text-xs font-semibold text-amber-300">
            {gkCount !== 1
              ? 'You need exactly 1 goalkeeper on the pitch.'
              : 'Field at least 2 players.'}
          </p>
        )}
        <button
          type="button"
          onClick={kickOff}
          disabled={!valid}
          className="w-full rounded-md bg-amber-400 px-6 py-3.5 text-lg font-black uppercase tracking-wide text-emerald-950 transition hover:bg-amber-300 disabled:opacity-40"
        >
          {opponent ? `Kick Off vs ${opponent}` : 'Collect bye prize'}
        </button>
      </div>
    </div>
  );
}
