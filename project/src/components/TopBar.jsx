import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono } from '../ui.js';
import { IconTheme, IconGear, IconLock } from './Icons.jsx';

const iconBtn = { background: 'none', border: '1px solid var(--line)', color: 'var(--fg)', padding: '6px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' };

export default function TopBar() {
  const { state, patch, setSetting, lockApp } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const isNight = (state.settings?.theme ?? 'night') === 'night';
  const T = dict(ru);
  const idn = state.identity;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 15, letterSpacing: 2 }}>{T.brand}</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idn ? idn.nodeId : (ru ? 'гость' : 'guest')}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => setSetting('lang', ru ? 'en' : 'ru')} style={{ fontFamily: mono, fontSize: 11, background: 'none', border: '1px solid var(--line)', color: 'var(--fg)', padding: '5px 9px', borderRadius: 4, cursor: 'pointer' }}>{ru ? 'RU' : 'EN'}</button>
        <button onClick={() => setSetting('theme', isNight ? 'day' : 'night')} style={iconBtn}><IconTheme isNight={isNight} /></button>
        <button onClick={() => patch({ screen: 'settings' })} style={iconBtn}><IconGear /></button>
        <button onClick={lockApp} style={iconBtn}><IconLock /></button>
      </div>
    </div>
  );
}
