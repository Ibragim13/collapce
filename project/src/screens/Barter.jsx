import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, backBtn, card } from '../ui.js';

export default function Barter() {
  const { state, patch } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const offers = (ru
    ? [['Аккумулятор 20 000 мАч', 'Антибиотики', 'Сергей', '1.4 км'], ['Крупа 5 кг', 'Батарейки AA', 'Пост №3', '2.1 км'], ['Фильтр воды', 'Куртка L', 'Ольга', '600 м'], ['Инструменты', 'Топливо 5 л', 'Мастерская', '3.2 км']]
    : [['Power bank 20Ah', 'Antibiotics', 'Sergey', '1.4 km'], ['Grain 5 kg', 'AA batteries', 'Post #3', '2.1 km'], ['Water filter', 'Jacket L', 'Olga', '600 m'], ['Tools', 'Fuel 5 L', 'Workshop', '3.2 km']]
  ).map(o => ({ have: o[0], want: o[1], who: o[2], dist: o[3] }));

  return (
    <div data-screen-label="Barter" style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => patch({ screen: 'home' })} style={backBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{T.barter}</span>
      </div>
      {offers.map((of, i) => (
        <div key={i} style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{of.have}</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)' }}>⇄</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mut)' }}>{of.want}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{of.who}</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{of.dist}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
