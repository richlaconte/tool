import type { Nationality } from '../../types';
import { NATIONALITY_FLAG, NATIONALITY_NAME } from '../../sim/players.data';

// England's St George's Cross is a subdivision flag with no reliable emoji:
// Apple and Windows render it as a plain black flag 🏴. Draw it as an inline
// SVG instead so every nationality has a recognizable flag everywhere.
export function Flag({
  nationality,
  size = 'sm',
}: {
  nationality: Nationality;
  size?: 'sm' | 'lg';
}) {
  if (nationality === 'ENG') {
    return (
      <svg
        viewBox="0 0 20 14"
        role="img"
        aria-label={NATIONALITY_NAME.ENG}
        className={`inline-block shrink-0 rounded-[2px] ring-1 ring-white/25 ${
          size === 'lg' ? 'h-[18px] w-[26px]' : 'h-[12px] w-[17px]'
        }`}
      >
        <rect width="20" height="14" fill="#f8fafc" />
        <rect x="8.5" width="3" height="14" fill="#ce1124" />
        <rect y="5.5" width="20" height="3" fill="#ce1124" />
      </svg>
    );
  }
  return (
    <span
      role="img"
      aria-label={NATIONALITY_NAME[nationality]}
      className={`shrink-0 ${size === 'lg' ? 'text-xl' : 'text-sm'} leading-none`}
    >
      {NATIONALITY_FLAG[nationality]}
    </span>
  );
}
