import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, card, label9 } from '../ui.js';
import { BeaconKB } from '../lib/kb.js';

const tile = { textAlign: 'left', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--fg)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer', fontFamily: 'inherit' };

export default function Home() {
  const { state, patch, doInstall } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  // Distinct senders seen in chat and currently-connected WebRTC peers overlap once a
  // paired peer sends a message (the mesh doesn't correlate its pairing id with the
  // sender's crypto node id), so take the max of the two signals rather than summing them.
  const distinctSenders = new Set(state.msgs.filter(m => !m.me).map(m => m.nodeId)).size;
  const connectedPeers = state.peers.filter(p => p.connected).length;
  const peerCount = Math.max(distinctSenders, connectedPeers) + 1;
  const c = state.coords;
  const posShort = c ? (c.lat.toFixed(2) + ',' + c.lng.toFixed(2)) : '—';
  const kbCount = BeaconKB.CATS.reduce((n, cc) => n + cc.articles.length, 0);
  const members = [
    { name: ru ? 'Анна (жена)' : 'Anna (wife)', dist: '120 ' + (ru ? 'м' : 'm') },
    { name: ru ? 'Максим (сын)' : 'Maxim (son)', dist: '120 ' + (ru ? 'м' : 'm') },
    { name: ru ? 'Сергей (сосед)' : 'Sergey (neighbor)', dist: '1.4 ' + (ru ? 'км' : 'km') }
  ];

  return (
    <div data-screen-label="Dashboard" style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      {!!state.installEvt && (
        <button onClick={doInstall} style={{ textAlign: 'left', background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600 }}>{T.installMsg}</span><span>↓</span>
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 10px', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={label9}>{T.mesh}</span>
          <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 600 }}>{peerCount}</span>
          <span style={{ fontSize: 10, color: 'var(--mut)' }}>{T.nodesOnline}</span>
        </div>
        <div style={{ padding: '12px 10px', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={label9}>{T.battery}</span>
          <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 600 }}>{state.battery != null ? state.battery + '%' : '—'}</span>
          <span style={{ fontSize: 10, color: 'var(--mut)' }}>{state.battery != null ? (ru ? 'реальный датчик' : 'live sensor') : (ru ? 'нет данных' : 'no data')}</span>
        </div>
        <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={label9}>{T.position}</span>
          <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, marginTop: 3 }}>{posShort}</span>
          <span style={{ fontSize: 10, color: 'var(--mut)' }}>{c ? '±' + c.acc + ' ' + (ru ? 'м' : 'm') : (ru ? 'нажмите ГДЕ Я' : 'tap LOCATE')}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={() => patch({ screen: 'knowledge', kbArticle: null, kbQuery: '' })} style={tile}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{T.knowledge}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{kbCount} {T.articles} · {T.offline}</span>
        </button>
        <button onClick={() => patch({ screen: 'barter' })} style={tile}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{T.barter}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>7 {T.offersNear}</span>
        </button>
        <button onClick={() => patch({ screen: 'monitor' })} style={tile}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{T.monitor}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{T.monitorSub}</span>
        </button>
        <button onClick={() => patch({ screen: 'settings' })} style={tile}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{T.settings}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{T.settingsSub}</span>
        </button>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)', fontFamily: mono, fontSize: 11, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.myGroup}</div>
        {members.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg)', border: '1px solid var(--fg)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{m.name}</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)' }}>{m.dist}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 2px 0' }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1, color: 'var(--mut)' }}>IndexedDB ✓</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{('serviceWorker' in navigator) ? 'SW ✓ · PWA' : 'no SW'}</span>
      </div>
    </div>
  );
}
