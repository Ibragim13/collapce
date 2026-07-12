import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, primaryBtn, outlineBtn, textInput, pinInput, errBox } from '../ui.js';

function OnlinePill() {
  const { state, patch } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  return (
    <button onClick={() => patch({ online: !state.online })} style={{
      fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: 'var(--mut)', background: 'none',
      border: '1px solid var(--line)', borderRadius: 99, padding: '6px 13px', cursor: 'pointer'
    }}>
      {state.online ? (ru ? 'ONLINE · СИНХРОНИЗАЦИЯ ДОСТУПНА' : 'ONLINE · SYNC AVAILABLE') : (ru ? 'OFFLINE · ЛОКАЛЬНЫЙ РЕЖИМ' : 'OFFLINE · LOCAL MODE')}
    </button>
  );
}

export function Boot() {
  const { state } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg)' }}>
      <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 28, letterSpacing: 8 }}>{T.brand}</span>
      <span style={{ width: 20, height: 20, border: '2px solid var(--line)', borderTopColor: 'var(--fg)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.booting}</span>
    </div>
  );
}

export function Welcome() {
  const { state, patch } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const features = ru
    ? ['Личность на устройстве — без телефона и почты', 'Вход по PIN, работает без сети', 'Восстановление по секретной фразе']
    : ['On-device identity — no phone or email', 'PIN unlock, works with no network', 'Recovery via a secret phrase'];
  return (
    <div data-screen-label="Welcome" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '96px 30px 32px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 30, letterSpacing: 8 }}>{T.brand}</span>
      <OnlinePill />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, textAlign: 'center' }}>{T.welcomeTitle}</span>
        <span style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'center', maxWidth: 290, lineHeight: 1.55 }}>{T.welcomeSub}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', maxWidth: 290, marginTop: 12 }}>
        <button onClick={() => patch({ auth: 'create', aErr: '', aPin: '', aPin2: '', aName: '' })} style={primaryBtn}>{T.createId}</button>
        <button onClick={() => patch({ auth: 'restore', aErr: '', aPin: '', aRestore: '' })} style={outlineBtn}>{T.restoreId}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', maxWidth: 290, marginTop: 12 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: mono, color: 'var(--mut)', fontSize: 11 }}>—</span>
            <span style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreateIdentity() {
  const { state, patch, submitCreate } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  return (
    <div data-screen-label="Create identity" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '90px 30px 32px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 2, color: 'var(--mut)' }}>{T.step1}</span>
      <span style={{ fontSize: 17, fontWeight: 600 }}>{T.createTitle}</span>
      <span style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>{T.createSub}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', maxWidth: 290, marginTop: 6 }}>
        <input value={state.aName} onChange={e => patch({ aName: e.target.value, aErr: '' })} placeholder={T.namePh} style={textInput} />
        <input type="password" inputMode="numeric" value={state.aPin} onChange={e => patch({ aPin: e.target.value.replace(/\D/g, '').slice(0, 8), aErr: '' })} placeholder={T.pinPh} style={pinInput} />
        <input type="password" inputMode="numeric" value={state.aPin2} onChange={e => patch({ aPin2: e.target.value.replace(/\D/g, '').slice(0, 8), aErr: '' })} placeholder={T.pin2Ph} style={pinInput} />
        {!!state.aErr && <span style={errBox}>{state.aErr}</span>}
        <button onClick={submitCreate} style={{ ...primaryBtn, marginTop: 4 }}>{T.next}</button>
        <button onClick={() => patch({ auth: 'welcome', aErr: '' })} style={{ background: 'none', border: 'none', color: 'var(--mut)', fontFamily: mono, fontSize: 11, cursor: 'pointer', padding: 6 }}>← {T.back}</button>
      </div>
    </div>
  );
}

export function RecoveryPhrase() {
  const { state, patch, finalizeId } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const words = state.aPhrase ? state.aPhrase.split(' ').map((w, i) => ({ n: i + 1, word: w })) : [];
  const confirmed = state.aConfirm;
  return (
    <div data-screen-label="Recovery phrase" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '80px 26px 28px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 2, color: 'var(--mut)' }}>{T.step2}</span>
      <span style={{ fontSize: 17, fontWeight: 600 }}>{T.phraseTitle}</span>
      <span style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'center', maxWidth: 290, lineHeight: 1.5 }}>{T.phraseSub}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, width: '100%', maxWidth: 300, marginTop: 4 }}>
        {words.map(w => (
          <div key={w.n} style={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--card)', padding: '9px 6px', display: 'flex', gap: 5, alignItems: 'baseline', justifyContent: 'center' }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{w.n}.</span>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600 }}>{w.word}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{T.nodeId}: {state.pendingNodeId}</div>
      <button onClick={() => patch(s => ({ aConfirm: !s.aConfirm }))} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'none', border: 'none', color: 'var(--fg)', cursor: 'pointer', padding: 6, fontFamily: 'inherit', maxWidth: 300 }}>
        <span style={{ width: 20, height: 20, border: '1.5px solid var(--fg)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: confirmed ? 'var(--fg)' : 'transparent', color: 'var(--bg)', fontSize: 13 }}>{confirmed ? '✓' : ''}</span>
        <span style={{ fontSize: 12, textAlign: 'left', lineHeight: 1.4 }}>{T.phraseConfirm}</span>
      </button>
      <button onClick={finalizeId} disabled={!confirmed} style={{
        background: confirmed ? 'var(--fg)' : 'var(--card2)', color: confirmed ? 'var(--bg)' : 'var(--mut)',
        border: 'none', borderRadius: 8, padding: 14, fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: 2,
        cursor: 'pointer', width: '100%', maxWidth: 300
      }}>{T.enterApp}</button>
    </div>
  );
}

export function Unlock() {
  const { state, patch, doUnlock, guestSos } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const idn = state.identity;
  return (
    <div data-screen-label="Unlock" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '100px 30px 32px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 26, letterSpacing: 7 }}>{T.brand}</span>
      <OnlinePill />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{(ru ? 'С возвращением' : 'Welcome back') + (idn ? ', ' + idn.name : '')}</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{idn ? idn.nodeId : ''}</span>
        <span style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5, marginTop: 4 }}>{T.unlockSub}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', maxWidth: 280, marginTop: 8 }}>
        <input type="password" inputMode="numeric" value={state.aPin} onChange={e => patch({ aPin: e.target.value.replace(/\D/g, '').slice(0, 8), aErr: '' })}
          onKeyDown={e => { if (e.key === 'Enter') doUnlock(); }} placeholder={T.pinPh}
          style={{ ...pinInput, padding: 14, fontSize: 16, letterSpacing: 8 }} />
        {!!state.aErr && <span style={errBox}>{state.aErr}</span>}
        <button onClick={doUnlock} style={primaryBtn}>{T.unlock}</button>
        <button onClick={() => patch({ auth: 'restore', aErr: '', aPin: '', aRestore: '' })} style={{ background: 'none', border: 'none', color: 'var(--mut)', fontFamily: mono, fontSize: 11, cursor: 'pointer', padding: 6 }}>{T.forgotPin}</button>
      </div>
      <button onClick={guestSos} style={{ marginTop: 'auto', background: 'none', border: '1.5px solid var(--fg)', borderRadius: 8, padding: '13px 22px', color: 'var(--fg)', fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: 2, cursor: 'pointer' }}>{T.guestSos}</button>
    </div>
  );
}

export function Restore() {
  const { state, patch, doRestore } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  return (
    <div data-screen-label="Restore" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '84px 30px 28px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <span style={{ fontSize: 17, fontWeight: 600 }}>{T.restoreTitle}</span>
      <span style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'center', maxWidth: 290, lineHeight: 1.5 }}>{T.restoreSub}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', maxWidth: 290, marginTop: 6 }}>
        <textarea value={state.aRestore} onChange={e => patch({ aRestore: e.target.value, aErr: '' })} placeholder={T.phrasePh}
          style={{ width: '100%', boxSizing: 'border-box', height: 80, resize: 'none', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: 12, fontSize: 13, fontFamily: mono, lineHeight: 1.6, outline: 'none' }} />
        <input value={state.aName} onChange={e => patch({ aName: e.target.value, aErr: '' })} placeholder={T.namePh} style={textInput} />
        <input type="password" inputMode="numeric" value={state.aPin} onChange={e => patch({ aPin: e.target.value.replace(/\D/g, '').slice(0, 8), aErr: '' })} placeholder={T.pinPh} style={pinInput} />
        {!!state.aErr && <span style={errBox}>{state.aErr}</span>}
        <button onClick={doRestore} style={primaryBtn}>{T.restoreBtn}</button>
        <button onClick={() => patch({ auth: 'welcome', aErr: '' })} style={{ background: 'none', border: 'none', color: 'var(--mut)', fontFamily: mono, fontSize: 11, cursor: 'pointer', padding: 6 }}>← {T.back}</button>
      </div>
    </div>
  );
}
