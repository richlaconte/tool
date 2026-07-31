// Narrative rendering: MatchEvent + snapshot lookups → commentary line.
// Commentary names YOUR players and references causes (US-6).

import type { MatchEvent, SquadSnapshot } from '../types';

function nameOf(snapshots: SquadSnapshot[], id?: string): string {
  if (!id) return '';
  for (const s of snapshots) {
    const p = s.players.find((pl) => pl.card.id === id);
    if (p) return p.card.name;
  }
  return 'the keeper';
}

export function narrate(e: MatchEvent, home: SquadSnapshot, away: SquadSnapshot): string {
  const snaps = [home, away];
  const actor = nameOf(snaps, e.actorId);
  const secondary = nameOf(snaps, e.secondaryId);

  switch (e.narrativeKey) {
    case 'match.kickoff':
      return 'The referee blows the whistle — we are underway!';
    case 'attack.builds':
      return `${actor} drives forward…`;
    case 'counter.breaks':
      return `⚡ Lightning counter-attack!`;
    case 'chance.created':
      return `${secondary} threads it through to ${actor} — big chance!`;
    case 'goal.openPlay':
      return `⚽ GOAL! ${actor} finishes ${secondary ? `from ${secondary}'s pass` : 'brilliantly'}!`;
    case 'goal.counter':
      return `⚽ GOAL on the counter! ${actor} was simply too fast!`;
    case 'goal.penalty':
      return `⚽ PENALTY GOAL! ${actor} keeps their nerve from the spot!`;
    case 'penalty.saved':
      return `PENALTY SAVED! ${secondary} guesses right and denies ${actor}!`;
    case 'shot.saved':
      return `${actor} shoots — ${secondary} with a strong hand! Saved.`;
    case 'shot.blocked':
      return secondary
        ? `${actor}'s effort is blocked by ${secondary}!`
        : `${actor}'s effort is charged down by a wall of defenders!`;
    case 'shot.missed':
      return `${actor} blazes it wide. The fans groan.`;
    case 'setpiece.corner':
      return `Corner kick coming up…`;
    case 'foul.committed':
      return `${actor} goes in late — free kick.`;
    case 'foul.card':
      return `🟨 ${actor} is booked for that one.`;
    case 'match.fulltime':
      return 'The whistle goes — full time!';
    default:
      return '…';
  }
}

/** Which match events are worth precious feed seconds in playback. */
export function isNotable(e: MatchEvent): boolean {
  return e.type !== 'ATTACK';
}

export function minuteOf(e: MatchEvent): string {
  const minute = Math.min(90, Math.max(1, Math.floor((e.tick * 90) / 60)));
  return `${minute}'`;
}
