import type { ComboState } from '../../types';
import { Flag } from './Flag';

const FAMILY_LABEL: Record<string, string> = {
  NationalPride: 'National Pride',
  SambaFlair: 'Samba Flair',
  DefensiveWall: 'Defensive Wall',
  TargetMen: 'Target Men',
};

const FAMILY_THRESHOLD: Record<string, number[]> = {
  NationalPride: [2, 3],
  SambaFlair: [2, 3],
  DefensiveWall: [2, 3],
  TargetMen: [2],
};

export function ComboPanel({ combos }: { combos: ComboState[] }) {
  const visible = combos.filter((c) => c.count > 0);
  if (visible.length === 0) {
    return (
      <div className="rounded-lg bg-black/30 p-3 text-xs text-emerald-300/60">
        Field players to reveal combinations — same nationality, defensive lines,
        Brazilian flair, poachers up top…
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((c, i) => {
        const thresholds = FAMILY_THRESHOLD[c.family];
        const next = thresholds[Math.min(c.tier, thresholds.length - 1)];
        const atMax = c.tier >= thresholds.length;
        return (
          <span
            key={`${c.family}-${c.key ?? ''}-${i}`}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              c.tier > 0
                ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50'
                : 'bg-black/30 text-emerald-200/70'
            }`}
            title={c.tier > 0 ? `Tier ${c.tier} active` : 'Inactive'}
          >
            {c.family === 'NationalPride' && c.key ? (
              <>
                <Flag nationality={c.key} />{' '}
              </>
            ) : null}
            {FAMILY_LABEL[c.family]} {c.count}
            {!atMax ? `/${next}` : ''}
            {c.tier > 0 ? ` ★${c.tier}` : ''}
          </span>
        );
      })}
    </div>
  );
}
