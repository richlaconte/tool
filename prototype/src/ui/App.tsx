import { useStore } from '../state/store';
import { Landing } from './screens/Landing';
import { TransferWindow } from './screens/TransferWindow';
import { TacticsBoard } from './screens/TacticsBoard';
import { MatchView } from './screens/MatchView';
import { Results } from './screens/Results';

export function App() {
  const { screen, game, watchingMatch } = useStore();

  if (screen === 'LANDING' || !game) return <Landing />;

  if (watchingMatch) return <MatchView />;

  switch (game.phase) {
    case 'TRANSFER_WINDOW':
      return <TransferWindow />;
    case 'TACTICS':
      return <TacticsBoard />;
    case 'MATCH': // defensive: resolveRound moves past this; if restored mid-match, show results
    case 'RESULTS':
    case 'RUN_OVER':
      return <Results />;
    default:
      return <Landing />;
  }
}
