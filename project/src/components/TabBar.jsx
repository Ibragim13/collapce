import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono } from '../ui.js';
import { IconHome, IconMap, IconChat, IconAi } from './Icons.jsx';

const tabBtn = { padding: '15px 4px 17px', background: 'none', border: 'none', fontFamily: mono, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 };

export default function TabBar() {
  const { state, patch } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const scr = state.screen;
  const color = (on) => on ? 'var(--fg)' : 'var(--mut)';
  const sosOn = state.sosActive || scr === 'sos';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr 1fr 1fr', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', alignItems: 'stretch', paddingBottom: 4 }}>
      <button onClick={() => patch({ screen: 'home' })} style={{ ...tabBtn, color: color(scr === 'home') }}>
        <IconHome /><span style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 600 }}>{T.tabHome}</span>
      </button>
      <button onClick={() => patch({ screen: 'map' })} style={{ ...tabBtn, color: color(scr === 'map') }}>
        <IconMap /><span style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 600 }}>{T.tabMap}</span>
      </button>
      <button onClick={() => patch({ screen: 'sos' })} style={{ margin: '9px 6px 11px', background: sosOn ? 'var(--fg)' : 'transparent', color: sosOn ? 'var(--bg)' : 'var(--fg)', border: '1.5px solid var(--fg)', borderRadius: 12, fontFamily: mono, fontSize: 16, letterSpacing: 3, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SOS</button>
      <button onClick={() => patch({ screen: 'chat' })} style={{ ...tabBtn, color: color(scr === 'chat') }}>
        <IconChat /><span style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 600 }}>{T.tabChat}</span>
      </button>
      <button onClick={() => patch({ screen: 'ai' })} style={{ ...tabBtn, color: color(scr === 'ai') }}>
        <IconAi /><span style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 600 }}>{T.tabAi}</span>
      </button>
    </div>
  );
}
