import { useStore } from '../state/store';
import { readChallengeFromHash } from '../state/challenge';
import { Landing } from './screens/Landing';
import { Planning } from './screens/Planning';
import { MatchView } from './screens/MatchView';
import { Results } from './screens/Results';
import { ChallengeView } from './screens/ChallengeView';

export function App() {
  const { screen, game, watchingMatch } = useStore();

  // Friend challenge links bypass the run flow entirely (US-11).
  const challenge =
    typeof window !== 'undefined'
      ? readChallengeFromHash(window.location.hash)
      : null;
  if (challenge) return <ChallengeView payload={challenge} />;

  if (screen === 'LANDING' || !game) return <Landing />;

  if (watchingMatch) return <MatchView />;

  switch (game.phase) {
    // TRANSFER_WINDOW and TACTICS are one TFT-style planning screen (docs/mvp/06).
    case 'TRANSFER_WINDOW':
    case 'TACTICS':
      return <Planning />;
    case 'MATCH':
    case 'RESULTS':
    case 'RUN_OVER':
      return <Results />;
    default:
      return <Landing />;
  }
}
