import { useStore } from '../../state/store';
import { PLAYER_ID } from '../../sim/tournament';
import {
  DAMAGE_BASE,
  DRAW_DAMAGE,
  PRIZE_BASE,
  PRIZE_GOAL_CAP,
  PRIZE_PER_GOAL,
  PRIZE_WIN,
  WIN_STREAK_DAMAGE_CAP,
} from '../../sim/config';
import { StandingsTable } from '../components/StandingsTable';

export function Results() {
  const { game, nextRound, rematch, abandonRun } = useStore();
  if (!game) return null;
  const player = game.managers.find((m) => m.id === PLAYER_ID)!;
  const match = game.lastMatch;
  const runOver = game.phase === 'RUN_OVER';

  let headline = 'Bye round — free prize money!';
  let detail = `+${PRIZE_BASE}💰`;
  if (match) {
    const isHome = match.home.managerId === PLAYER_ID;
    const myGoals = isHome ? match.homeGoals : match.awayGoals;
    const theirGoals = isHome ? match.awayGoals : match.homeGoals;
    const opp = game.managers.find(
      (m) => m.id === (isHome ? match.away.managerId : match.home.managerId),
    );
    const prize =
      PRIZE_BASE +
      Math.min(myGoals, PRIZE_GOAL_CAP) * PRIZE_PER_GOAL +
      (myGoals > theirGoals ? PRIZE_WIN : 0);

    if (myGoals > theirGoals) {
      const gd = myGoals - theirGoals;
      const streakBonus = Math.min(Math.max(player.winStreak - 1, 0), WIN_STREAK_DAMAGE_CAP);
      headline = `🎉 You beat ${opp?.name ?? 'them'} ${myGoals}–${theirGoals}!`;
      detail = `They took ${DAMAGE_BASE + gd + streakBonus} damage · +${prize}💰${
        player.winStreak > 1 ? ` · 🔥 ${player.winStreak} wins in a row` : ''
      }`;
    } else if (myGoals === theirGoals) {
      headline = `🤝 ${myGoals}–${theirGoals} vs ${opp?.name ?? 'them'}`;
      detail = `Both managers take ${DRAW_DAMAGE} damage · +${prize}💰`;
    } else {
      const gd = theirGoals - myGoals;
      headline = `💔 Lost ${myGoals}–${theirGoals} to ${opp?.name ?? 'them'}`;
      detail = `You took at least ${DAMAGE_BASE + gd} damage · +${prize}💰`;
    }
  }

  if (runOver) {
    const place = player.placement ?? 8;
    const won = place === 1;
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="text-6xl">{won ? '🏆' : place <= 3 ? '🥈' : '⚽'}</div>
        <h1 className="text-4xl font-black">
          {won ? 'CHAMPIONS!' : `Finished #${place} of 8`}
        </h1>
        <p className="text-emerald-300/80">
          {won
            ? 'Your combinations conquered all seven rivals. Beautiful football.'
            : `Eliminated in round ${game.round}. The transfer market never sleeps — run it back.`}
        </p>
        <StandingsTable managers={game.managers} />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={rematch}
            className="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400"
          >
            🔄 Rematch
          </button>
          <button
            type="button"
            onClick={abandonRun}
            className="rounded-xl bg-black/40 px-6 py-3 font-semibold hover:bg-black/60"
          >
            Main Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4">
      <header>
        <h2 className="text-xl font-bold">Round {game.round} · Results</h2>
      </header>
      <div className="rounded-xl bg-black/30 p-4">
        <p className="text-lg font-bold">{headline}</p>
        <p className="mt-1 text-sm text-emerald-300/80">{detail}</p>
        <p className="mt-2 text-sm">
          Your HP: <span className="font-bold text-rose-300">{player.hp}</span> · Credits:{' '}
          <span className="font-bold text-amber-300">{player.credits}💰</span>
        </p>
      </div>
      <StandingsTable managers={game.managers} />
      <button
        type="button"
        onClick={nextRound}
        className="mt-auto rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400"
      >
        Next Round →
      </button>
    </div>
  );
}
