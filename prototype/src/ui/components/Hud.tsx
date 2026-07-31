import type { GameState, ManagerState } from '../../types';
import { PLAYER_ID } from '../../sim/tournament';

/** Persistent top bar on every in-game screen (TFT-style): round, HP,
 *  credits, streak, and what's next. Numbers use tabular figures. */
export function Hud({ game }: { game: GameState }) {
  const player = game.managers.find((m) => m.id === PLAYER_ID)!;
  const alive = game.managers.filter((m) => !m.eliminated).length;
  const opponent = nextOpponentName(game);

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-emerald-800/60 bg-emerald-950/95 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-black uppercase tracking-wider text-emerald-100">
          R<span className="tabular-nums">{game.round}</span>
        </span>
        <span className="flex items-center gap-1 font-bold text-rose-300" title="Your health — hit 0 and you're out">
          <span className="text-xs">HP</span>
          <span className="tabular-nums">{player.hp}</span>
        </span>
        <span className="flex items-center gap-1 font-bold text-amber-300" title="Credits for the transfer market">
          <span className="text-xs">CR</span>
          <span className="tabular-nums">{player.credits}</span>
        </span>
        {player.winStreak > 1 && (
          <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs font-bold text-orange-300" title="Win streak — your wins deal bonus damage">
            W<span className="tabular-nums">{player.winStreak}</span>
          </span>
        )}
      </div>
      <div className="text-right text-xs text-emerald-300/70">
        {opponent ? (
          <>
            next: <span className="font-bold text-emerald-100">{opponent}</span>
          </>
        ) : (
          <span>{alive} managers left</span>
        )}
      </div>
    </div>
  );
}

export function nextOpponentName(game: GameState): string | null {
  if (!game.currentPairing) return null;
  const other =
    game.currentPairing.home === PLAYER_ID
      ? game.currentPairing.away
      : game.currentPairing.home;
  return game.managers.find((m) => m.id === other)?.name ?? null;
}

export function playerManager(game: GameState): ManagerState {
  return game.managers.find((m) => m.id === PLAYER_ID)!;
}
