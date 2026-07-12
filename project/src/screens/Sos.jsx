import { useEffect, useRef } from 'react';
import QRious from 'qrious';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono } from '../ui.js';

export default function Sos() {
  const { state, toggleSos, resetDeadman } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const qrRef = useRef(null);
  const qrFor = useRef(null);
  const c = state.coords;

  useEffect(() => {
    if (!state.sosActive || !c || !qrRef.current) return;
    const tag = c.lat + ',' + c.lng;
    if (qrFor.current === tag) return;
    qrFor.current = tag;
    const url = 'https://www.openstreetmap.org/?mlat=' + c.lat + '&mlon=' + c.lng + '#map=17/' + c.lat + '/' + c.lng;
    try {
      const d = new QRious({ value: url, size: 132, level: 'M', background: '#ffffff', foreground: '#000000' }).toDataURL('image/png');
      qrRef.current.innerHTML = '<img src="' + d + '" style="width:100%;height:100%">';
    } catch (e) {}
  }, [state.sosActive, c]);

  const mm = Math.floor(state.sosT / 60), ss = state.sosT % 60;
  const dmM = Math.floor(state.dmLeft / 60), dmS = state.dmLeft % 60;
  const active = state.sosActive;

  const sv = (k) => (state.settings || {})[k];
  const sosChannels = [
    { label: sv('siren') ? (ru ? 'СИРЕНА ✓' : 'SIREN ✓') : (ru ? 'сирена' : 'siren'), on: sv('siren') },
    { label: sv('strobe') ? (ru ? 'СВЕТ ✓' : 'LIGHT ✓') : (ru ? 'свет' : 'light'), on: sv('strobe') },
    { label: sv('vibrate') ? (ru ? 'ВИБРО ✓' : 'VIBRATE ✓') : (ru ? 'вибро' : 'vibrate'), on: sv('vibrate') },
    { label: 'GPS + QR', on: true }
  ];

  return (
    <div data-screen-label="SOS" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: mono, fontSize: 13, letterSpacing: 3, fontWeight: 600 }}>{active ? (ru ? 'СИГНАЛ ПЕРЕДАЁТСЯ' : 'BROADCASTING') : (ru ? 'РЕЖИМ ОЖИДАНИЯ' : 'STANDBY')}</span>
        <span style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          {active ? (ru ? 'сирена · свет · вибро · координаты по mesh' : 'siren · light · vibrate · coordinates over mesh') : (ru ? 'Нажмите — включатся сигналы по вашим настройкам и передача координат.' : 'Tap — enabled signals fire per your settings and coordinates broadcast.')}
        </span>
      </div>
      <button onClick={toggleSos} style={{ position: 'relative', width: 178, height: 178, borderRadius: '50%', background: active ? 'var(--fg)' : 'transparent', color: active ? 'var(--bg)' : 'var(--fg)', border: '2px solid var(--fg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
        {active && <>
          <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid var(--fg)', animation: 'sospulse 1.6s ease-out infinite' }} />
          <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid var(--fg)', animation: 'sospulse 1.6s ease-out .8s infinite' }} />
        </>}
        <span style={{ fontFamily: mono, fontSize: 32, fontWeight: 600, letterSpacing: 6 }}>SOS</span>
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1 }}>{active ? (ru ? 'ОТМЕНА' : 'CANCEL') : (ru ? 'НАЖАТЬ' : 'TAP')}</span>
      </button>
      {active ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: mono, fontSize: 24, fontWeight: 600 }}>{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)' }}>{c ? (c.lat.toFixed(4) + ' N · ' + c.lng.toFixed(4) + ' E · ±' + c.acc + (ru ? ' м' : ' m')) : (ru ? 'поиск GPS…' : 'locating…')}</span>
          <div ref={qrRef} style={{ width: 132, height: 132, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} />
          <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{ru ? 'сканируйте — откроется точка на карте' : 'scan to open the location'}</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300 }}>
            {sosChannels.map((ch, i) => (
              <span key={i} style={{ fontFamily: mono, fontSize: 10, color: 'var(--fg)', border: '1px solid var(--line)', borderRadius: 99, padding: '6px 11px', opacity: ch.on ? 1 : 0.4 }}>{ch.label}</span>
            ))}
          </div>
          {state.dmArmed && (
            <button onClick={resetDeadman} style={{ background: 'none', border: '1px solid var(--fg)', borderRadius: 8, padding: '11px 18px', color: 'var(--fg)', fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {T.imOk} · {String(dmM).padStart(2, '0')}:{String(dmS).padStart(2, '0')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
