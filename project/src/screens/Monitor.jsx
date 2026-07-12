import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, backBtn, card } from '../ui.js';

export default function Monitor() {
  const { state, patch, refreshWeather } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const wx = state.wx;
  return (
    <div data-screen-label="Monitoring" style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => patch({ screen: 'home' })} style={backBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{T.monitor}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.weather}</span>
          <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 600 }}>{wx ? Math.round(wx.temperature_2m) + '°C' : '—'}</span>
          <span style={{ fontSize: 11, color: 'var(--mut)' }}>{wx ? ((ru ? 'ветер ' : 'wind ') + Math.round(wx.wind_speed_10m) + ' ' + (ru ? 'м/с' : 'm/s')) : (ru ? 'нет данных' : 'no data')}</span>
        </div>
        <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.air}</span>
          <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 600 }}>AQI 41</span>
          <span style={{ fontSize: 11, color: 'var(--mut)' }}>{T.airNorm}</span>
        </div>
      </div>
      <button onClick={refreshWeather} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 12, color: 'var(--fg)', fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>
        {state.weatherLoading ? '…' : (ru ? 'ОБНОВИТЬ (нужна сеть)' : 'REFRESH (needs network)')}
      </button>
      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)', lineHeight: 1.6 }}>{T.monitorNote}</span>
    </div>
  );
}
