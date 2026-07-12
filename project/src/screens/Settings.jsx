import { useRef, useState } from 'react';
import QRious from 'qrious';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, backBtn, card } from '../ui.js';

export default function Settings() {
  const { state, patch, sv, setSetting, toggleDeadman } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const idn = state.identity;
  const qrRef = useRef(null);
  const [hasExport, setHasExport] = useState(false);

  const toggles = [
    { k: 'siren', label: ru ? 'Сирена (звук)' : 'Siren (sound)' },
    { k: 'strobe', label: ru ? 'Световой маяк (SOS морзе)' : 'Light beacon (SOS morse)' },
    { k: 'vibrate', label: ru ? 'Вибро-сигнал' : 'Vibration' },
    { k: 'mapDark', label: ru ? 'Тёмная карта ночью' : 'Dark map at night' }
  ];

  const deadmanMin = sv('deadmanMin') ?? 30;

  const exportData = () => {
    const bundle = { v: 1, identity: idn ? { name: idn.name, nodeId: idn.nodeId, entropyHex: idn.entropyHex } : null, markers: state.markers, settings: state.settings };
    const str = JSON.stringify(bundle);
    setHasExport(true);
    setTimeout(() => {
      if (qrRef.current) {
        try {
          const d = new QRious({ value: str.slice(0, 900), size: 150, level: 'L', background: '#ffffff', foreground: '#000000' }).toDataURL('image/png');
          qrRef.current.innerHTML = '<img src="' + d + '" style="width:100%;height:100%">';
        } catch (e) {}
      }
    }, 60);
  };

  return (
    <div data-screen-label="Settings" style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => patch({ screen: 'home' })} style={backBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{T.settings}</span>
      </div>
      <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.identity}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{idn ? idn.name : '—'}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)' }}>{idn ? idn.nodeId : ''}</span>
      </div>
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: 'var(--mut)', marginTop: 2 }}>{T.sosSection}</span>
      <div style={{ ...card, overflow: 'hidden' }}>
        {toggles.map(tg => {
          const on = !!sv(tg.k);
          return (
            <button key={tg.k} onClick={() => setSetting(tg.k, !on)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--fg)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 13 }}>{tg.label}</span>
              <span style={{ width: 40, height: 23, borderRadius: 99, border: '1.5px solid var(--fg)', background: on ? 'var(--fg)' : 'transparent', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 16, height: 16, borderRadius: '50%', background: on ? 'var(--bg)' : 'var(--fg)' }} />
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>{T.deadmanTimer}</span>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600 }}>{deadmanMin} {T.min}</span>
        </div>
        <input type="range" min={5} max={120} step={5} value={deadmanMin} onChange={e => setSetting('deadmanMin', +e.target.value)} style={{ width: '100%', accentColor: 'var(--fg)' }} />
        <button onClick={toggleDeadman} style={{ background: state.dmArmed ? 'var(--fg)' : 'transparent', color: state.dmArmed ? 'var(--bg)' : 'var(--fg)', border: '1.5px solid var(--fg)', borderRadius: 8, padding: 11, fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          {state.dmArmed ? (ru ? 'ВЗВЕДЁН · ОТМЕНИТЬ' : 'ARMED · CANCEL') : (ru ? 'ВЗВЕСТИ ТАЙМЕР' : 'ARM TIMER')}
        </button>
        <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)', lineHeight: 1.5 }}>{T.deadmanNote}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <button onClick={exportData} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 13, color: 'var(--fg)', fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>{T.exportData}</button>
        {hasExport && <div ref={qrRef} style={{ alignSelf: 'center', width: 150, height: 150, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />}
      </div>
    </div>
  );
}
