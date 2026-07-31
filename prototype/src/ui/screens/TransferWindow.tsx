import { useStore } from '../../state/store';
import { PLAYER_ID } from '../../sim/tournament';
import { detectCombos } from '../../sim/combos';
import { REROLL_COST } from '../../sim/config';
import { sellValue } from '../../sim/shop';
import { PlayerCardView } from '../components/PlayerCardView';
import { ComboPanel } from '../components/ComboPanel';

export function TransferWindow() {
  const { game, buyCard, sellCard, rerollShop, confirmTransfer } = useStore();
  if (!game) return null;
  const player = game.managers.find((m) => m.id === PLAYER_ID)!;
  const combos = detectCombos(player.squad);
  const canReroll = player.credits >= REROLL_COST;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Round {game.round} · Transfer Window
        </h2>
        <div className="rounded-lg bg-black/40 px-3 py-1.5 font-bold text-amber-300">
          {player.credits}💰
        </div>
      </header>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300/70">
            Shop
          </h3>
          <button
            type="button"
            onClick={rerollShop}
            disabled={!canReroll}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold hover:bg-sky-500 disabled:opacity-40"
          >
            🔄 Reroll ({REROLL_COST}💰)
          </button>
        </div>
        {game.currentShop.length === 0 ? (
          <p className="rounded-lg bg-black/30 p-3 text-sm text-emerald-300/60">
            Shop is empty — reroll for fresh faces.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {game.currentShop.map((c) => {
              const owned = player.squad.cards.filter(
                (o) => o.templateId === c.templateId && o.star === c.star,
              ).length;
              return (
                <PlayerCardView
                  key={c.id}
                  card={c}
                  onClick={player.credits >= c.tier ? () => buyCard(c.id) : undefined}
                  mergeBadge={
                    owned > 0
                      ? owned === 2
                        ? '✨ Buy to merge → ★★'
                        : `you own ×${owned}`
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
        <p className="mt-1 text-xs text-emerald-400/50">
          Tap a card to sign it. 3 copies of the same player auto-merge into a ★★ (then ★★★).
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300/70">
          Your Squad ({player.squad.cards.length}) · tap to sell for full refund
        </h3>
        {player.squad.cards.length === 0 ? (
          <p className="rounded-lg bg-black/30 p-3 text-sm text-amber-200/80">
            No players yet — sign at least a goalkeeper and an attacker!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {player.squad.cards.map((c) => (
              <PlayerCardView
                key={c.id}
                card={c}
                compact
                onClick={() => sellCard(c.id)}
                footer={
                  <span className="mt-1 block text-center text-xs text-rose-300/80">
                    Sell +{sellValue(c)}💰
                  </span>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300/70">
          Combinations
        </h3>
        <ComboPanel combos={combos} />
      </section>

      <button
        type="button"
        onClick={confirmTransfer}
        disabled={player.squad.cards.length === 0}
        className="mt-auto rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
      >
        Confirm & Continue →
      </button>
    </div>
  );
}
