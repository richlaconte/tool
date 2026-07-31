import { useState } from 'react';
import { useStore } from '../../state/store';

export function Landing() {
  const { newRun, continueRun, saveAvailable } = useStore();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <div className="text-5xl">⚽</div>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Tactics FC</h1>
        <p className="mt-2 text-emerald-300/80">
          Build your squad. Find the combos. Watch them win — or fall apart.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {saveAvailable && (
          <button
            type="button"
            onClick={continueRun}
            className="rounded-xl bg-amber-400 px-6 py-3 text-lg font-bold text-emerald-950 hover:bg-amber-300"
          >
            ▶ Continue Run
          </button>
        )}
        <button
          type="button"
          onClick={newRun}
          className="rounded-xl bg-emerald-500 px-6 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400"
        >
          New Run
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="rounded-xl bg-black/30 px-6 py-2.5 font-medium text-emerald-200 hover:bg-black/40"
        >
          How to Play
        </button>
      </div>

      {showHelp && (
        <div className="w-full space-y-3 rounded-xl bg-black/30 p-4 text-left text-sm">
          <div>
            <span className="font-bold text-amber-300">1 · Transfer Window</span>
            <p className="text-emerald-200/80">
              Buy footballers from the shop. Sell anyone for a full refund. Reroll
              for 1💰 if nothing fits.
            </p>
          </div>
          <div>
            <span className="font-bold text-amber-300">2 · Tactics</span>
            <p className="text-emerald-200/80">
              Place players in their lines — out-of-position players are worse.
              Stack nationalities, defenders, Brazilian flair, or poachers to
              unlock powerful combos.
            </p>
          </div>
          <div>
            <span className="font-bold text-amber-300">3 · Match</span>
            <p className="text-emerald-200/80">
              Your squad plays automatically against a rival manager. Lose and you
              take damage — last manager standing out of 8 wins.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-emerald-400/50">Prototype · all players fictional</p>
    </div>
  );
}
