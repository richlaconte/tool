import { useState } from 'react';
import { useStore } from '../../state/store';
import { detectCombos } from '../../sim/combos';
import { positionFit, REROLL_COST } from '../../sim/config';
import { sellValue } from '../../sim/shop';
import type { PlayerCard, PositionLine } from '../../types';
import { NATIONALITY_COLOR } from '../../sim/players.data';
import { Hud, nextOpponentName, playerManager } from '../components/Hud';
import { PlayerCardView, TIER_COLOR } from '../components/PlayerCardView';
import { Flag } from '../components/Flag';
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
  highlighted,
}: {
  card: PlayerCard;
  slot?: PositionLine;
  onClick: () => void;
  title?: string;
  highlighted?: boolean;
}) {
  const fit = slot !== undefined ? positionFit(card.naturalPosition, slot) : 1;
  const outOfPosition = fit < 1;
  const ring = highlighted
    ? 'ring-2 ring-amber-300 brightness-110'
    : outOfPosition
      ? 'ring-2 ring-rose-400'
      : '';
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        outOfPosition
          ? `${card.name} is a ${card.naturalPosition} playing ${slot} — stats ×${fit}. Tap to send to bench.`
          : title
      }
      style={{ backgroundColor: `${NATIONALITY_COLOR[card.nationality]}30` }}
      className={`inline-flex items-center gap-1 rounded-md border-2 px-2 py-1 text-xs font-semibold shadow-sm transition hover:brightness-125 ${TIER_COLOR[card.tier]} ${ring}`}
    >
      <span className="text-sm leading-none">
        <Flag nationality={card.nationality} />
      </span>
      <span className="rounded bg-black/40 px-1 py-px text-[10px] font-black uppercase leading-tight tracking-wide text-white/70">
        {card.naturalPosition}
      </span>
      <span>{card.name}</span>
      <span className={`tracking-tight ${card.star > 1 ? 'text-amber-300' : 'text-white/45'}`}>
        {'★'.repeat(card.star)}
      </span>
      {outOfPosition ? (
        <span className="font-black text-rose-300">×{fit}</span>
      ) : null}
    </button>
  );
}

export function Planning() {
  const { game, buyCard, sellCard, rerollShop, placePlayer, unplacePlayer, kickOff } =
    useStore();
  const [selected, setSelected] = useState<string | null>(null);
  if (!game) return null;

  const player = playerManager(game);
  const { squad, squadCap } = player;
  const fieldedIds = new Set(squad.lineup.map((l) => l.cardId));
  const bench = squad.cards.filter((c) => !fieldedIds.has(c.id));
  const gkCount = squad.lineup.filter((l) => l.slot === 'GK').length;
  const valid = gkCount === 1 && squad.lineup.length >= 2;
  const outOfPosition = squad.lineup.flatMap((l) => {
    const card = squad.cards.find((c) => c.id === l.cardId);
    if (!card) return [];
    const fit = positionFit(card.naturalPosition, l.slot);
    return fit < 1 ? [{ card, slot: l.slot, fit }] : [];
  });
  const combos = detectCombos(squad);
  const opponent = nextOpponentName(game);
  const canReroll = player.credits >= REROLL_COST;
  const selectedCard = selected ? squad.cards.find((c) => c.id === selected) : undefined;

  const onBenchTap = (c: PlayerCard) => {
    setSelected(selected === c.id ? null : c.id);
  };

  const sellSelected = () => {
    if (!selectedCard) return;
    sellCard(selectedCard.id);
    setSelected(null);
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
        <div className="overflow-hidden rounded-md border border-emerald-700/70">
          {ZONES.map(({ slot, label }, zi) => {
            const inLine = squad.lineup.filter((l) => l.slot === slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => placeIn(slot)}
                className={`flex min-h-[48px] w-full items-center gap-2 border-b border-white/10 px-2 py-2 text-left last:border-b-0 ${
                  zi % 2 === 0 ? 'bg-emerald-800' : 'bg-emerald-700'
                } ${selected ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
              >
                <span className="w-10 shrink-0 text-[11px] font-black uppercase tracking-widest text-white/50">
                  {label}
                </span>
                <div className="flex flex-1 flex-wrap items-center justify-start gap-x-1.5 gap-y-1.5">
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
        {outOfPosition.length > 0 && (
          <p className="mt-1 text-[11px] font-semibold text-rose-300">
            Out of position:{' '}
            {outOfPosition
              .map(
                ({ card, slot, fit }) =>
                  `${card.name} (${card.naturalPosition} at ${slot} — stats ×${fit})`,
              )
              .join(' · ')}
          </p>
        )}
      </div>

      {/* Bench */}
      <div className="px-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300/60">
            Squad ({squad.cards.length})
          </span>
          {selectedCard ? (
            <button
              type="button"
              onClick={sellSelected}
              title={`Sell ${selectedCard.name} for +${sellValue(selectedCard)} CR`}
              className="rounded-md bg-rose-500/80 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-400"
            >
              Sell {selectedCard.name} · +{sellValue(selectedCard)} CR
            </button>
          ) : (
            <span className="text-[11px] text-emerald-300/50">
              tap a player to field or sell
            </span>
          )}
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
              highlighted={selected === c.id}
              title={
                selected === c.id
                  ? 'Selected — tap a line on the pitch to field, or Sell above'
                  : 'Tap to select, then tap a line on the pitch'
              }
              onClick={() => onBenchTap(c)}
            />
          ))}
        </div>
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
