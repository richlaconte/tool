import { useState } from 'react';
import { useStore } from '../../state/store';

export function Landing() {
  const { newRun, continueRun, saveAvailable } = useStore();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">
          8 managers enter · 1 survives
        </p>
        <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-tight">
          Tactics
          <span className="block text-emerald-400">FC</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-emerald-200/80">
          Sign footballers. Stack nationalities, lines and flair into combos.
          Then watch your squad win — or fall apart — on the pitch.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {saveAvailable && (
          <button
            type="button"
            onClick={continueRun}
            className="rounded-md bg-amber-400 px-6 py-3.5 text-lg font-black uppercase tracking-wide text-emerald-950 hover:bg-amber-300"
          >
            Continue Run
          </button>
        )}
        <button
          type="button"
          onClick={newRun}
          className={`rounded-md px-6 py-3.5 text-lg font-black uppercase tracking-wide ${
            saveAvailable
              ? 'bg-black/30 text-emerald-100 hover:bg-black/50'
              : 'bg-amber-400 text-emerald-950 hover:bg-amber-300'
          }`}
        >
          New Run
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="rounded-md px-6 py-2 text-xs font-bold uppercase tracking-widest text-emerald-300/70 hover:text-emerald-100"
        >
          {showHelp ? 'Hide guide' : 'How to play'}
        </button>
      </div>

      {showHelp && (
        <div className="w-full space-y-3 rounded-md border border-emerald-800/60 bg-black/30 p-4 text-left text-sm">
          {[
            ['1 · Sign players', 'Buy from the transfer market. Duplicates merge: 3 copies of the same player become a ★★, nine become a ★★★.'],
            ['2 · Set your lines', 'Place players on the pitch in their natural lines. Stack nationalities, defenders, Brazilian flair or poachers to unlock combo bonuses.'],
            ['3 · Watch the match', 'Your squad plays automatically against a rival. Lose and you take damage — last manager standing wins.'],
          ].map(([title, body]) => (
            <div key={title}>
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-300">
                {title}
              </span>
              <p className="mt-0.5 text-emerald-200/80">{body}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-emerald-400/40">Prototype · all players fictional</p>
    </div>
  );
}
