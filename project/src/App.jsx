import { Suspense, lazy } from 'react';
import { useApp } from './context/AppContext.jsx';
import { Boot, Welcome, CreateIdentity, RecoveryPhrase, Unlock, Restore } from './screens/Auth.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import Home from './screens/Home.jsx';
import Sos from './screens/Sos.jsx';
import Chat from './screens/Chat.jsx';
import Pair from './screens/Pair.jsx';
import Ai from './screens/Ai.jsx';
import Knowledge from './screens/Knowledge.jsx';
import Settings from './screens/Settings.jsx';
import Barter from './screens/Barter.jsx';
import Monitor from './screens/Monitor.jsx';

// maplibre-gl is a large dependency (~1MB+ minified) only needed on the Map
// screen — code-split it into its own chunk instead of the initial bundle.
const MapScreen = lazy(() => import('./screens/MapScreen.jsx'));

const SCREENS = { home: Home, map: MapScreen, sos: Sos, chat: Chat, pair: Pair, ai: Ai, knowledge: Knowledge, settings: Settings, barter: Barter, monitor: Monitor };

export default function App() {
  const { state } = useApp();
  const theme = state.settings?.theme ?? 'night';
  const auth = state.auth;
  const Screen = SCREENS[state.screen] || Home;

  return (
    <div data-theme={theme} className="beacon-app" style={{
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)'
    }}>
      {auth === 'boot' && <Boot />}
      {auth === 'welcome' && <Welcome />}
      {auth === 'create' && <CreateIdentity />}
      {auth === 'phrase' && <RecoveryPhrase />}
      {auth === 'unlock' && <Unlock />}
      {auth === 'restore' && <Restore />}
      {auth === 'app' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <TopBar />
          <div className="beacon-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <Suspense fallback={null}>
              <Screen />
            </Suspense>
          </div>
          <TabBar />
        </div>
      )}
      {state.strobeOn && <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 60, pointerEvents: 'none' }} />}
    </div>
  );
}
