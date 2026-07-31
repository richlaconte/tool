import type { PlayerCard } from '../../types';
import {
  ARCHETYPE_LABEL,
  NATIONALITY_COLOR,
  NATIONALITY_FLAG,
  NATIONALITY_NAME,
  POSITION_LABEL,
} from '../../sim/players.data';

interface Props {
  card: PlayerCard;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
  mergeBadge?: string;
}

const TIER_COLOR: Record<number, string> = {
  1: 'border-zinc-500',
  2: 'border-emerald-500',
  3: 'border-sky-500',
  4: 'border-violet-500',
  5: 'border-amber-400',
};

export function PlayerCardView({ card, onClick, selected, compact, footer, mergeBadge }: Props) {
  // Nationality tint at ~20% alpha over the dark tile: redundant preattentive
  // cue alongside the (larger) flag — never the only encoding (WCAG 1.4.1).
  const tint = `${NATIONALITY_COLOR[card.nationality]}22`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${card.name} — ${NATIONALITY_NAME[card.nationality]} ${POSITION_LABEL[card.naturalPosition]} (${ARCHETYPE_LABEL[card.archetype]})`}
      style={{ backgroundColor: tint }}
      className={`w-full rounded-lg border-2 bg-emerald-900/60 p-2 text-left transition
        ${TIER_COLOR[card.tier]} ${selected ? 'ring-2 ring-amber-300' : ''}
        ${onClick ? 'hover:bg-emerald-800/70 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <span className="shrink-0 text-xl leading-none" role="img" aria-label={NATIONALITY_NAME[card.nationality]}>
            {NATIONALITY_FLAG[card.nationality]}
          </span>
          <span className="truncate">
            {card.name}
            {card.star > 1 && (
              <span className="ml-1 text-amber-300">{'★'.repeat(card.star)}</span>
            )}
          </span>
        </span>
        <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-xs font-bold text-amber-300">
          {card.tier}💰
        </span>
      </div>
      {mergeBadge && (
        <div className="mt-0.5 text-xs font-semibold text-sky-300">{mergeBadge}</div>
      )}
      <div className="mt-0.5 text-xs text-emerald-100/80">
        {card.naturalPosition} · {ARCHETYPE_LABEL[card.archetype]} · {NATIONALITY_NAME[card.nationality]}
      </div>
      {!compact && (
        <div className="mt-1 grid grid-cols-4 gap-1 text-center text-xs">
          {(['PAC', 'TEC', 'DEF', 'PHY'] as const).map((k) => (
            <div key={k} className="rounded bg-black/40 px-1 py-0.5">
              <span className="block text-[10px] text-emerald-300/70">{k}</span>
              <span className="font-bold">{card.stats[k]}</span>
            </div>
          ))}
        </div>
      )}
      {footer}
    </button>
  );
}
