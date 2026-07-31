import type { ManagerState } from '../../types';

export function StandingsTable({ managers }: { managers: ManagerState[] }) {
  const sorted = [...managers].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return b.hp - a.hp;
  });
  return (
    <div className="overflow-hidden rounded-lg bg-black/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-emerald-400/60">
            <th className="px-3 py-2">Manager</th>
            <th className="px-2 py-2 text-right">HP</th>
            <th className="px-2 py-2 text-right">Streak</th>
            <th className="px-3 py-2 text-right">Place</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr
              key={m.id}
              className={`border-t border-emerald-900/50 ${
                m.id === 'player' ? 'bg-emerald-800/40 font-semibold' : ''
              } ${m.eliminated ? 'opacity-40' : ''}`}
            >
              <td className="px-3 py-1.5">
                {m.name}
                {m.id === 'player' ? ' (you)' : ''}
              </td>
              <td className="px-2 py-1.5 text-right">{m.hp}</td>
              <td className="px-2 py-1.5 text-right">
                {m.winStreak > 1 ? `🔥${m.winStreak}` : '—'}
              </td>
              <td className="px-3 py-1.5 text-right">
                {m.placement ? `#${m.placement}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
