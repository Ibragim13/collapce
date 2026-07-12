import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono } from '../ui.js';

export default function Chat() {
  const { state, patch, setChannel, sendMsg } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const listRef = useRef(null);
  const [showChannelBox, setShowChannelBox] = useState(false);
  const [channelInput, setChannelInput] = useState(state.channelCode);

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [state.msgs.length]);

  const chatMsgs = state.msgs.map(m => ({
    ...m,
    align: m.me ? 'flex-end' : 'flex-start',
    bg: m.me ? 'var(--fg)' : 'var(--card)', color: m.me ? 'var(--bg)' : 'var(--fg)',
    meta: (m.me ? (ru ? 'вы' : 'you') : m.from) + ' · ' + new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (m.hops ? ' · ' + m.hops + (ru ? ' хоп' : ' hop') : '')
  }));

  const applyChannel = () => {
    const code = channelInput.trim().toUpperCase();
    if (code) setChannel(code);
    setShowChannelBox(false);
  };

  const connectedPeers = state.peers.filter(p => p.connected).length;

  return (
    <div data-screen-label="Mesh chat" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: 1.5 }}>{T.channel} · {state.channelCode}</span>
          <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{T.e2eOn} · {connectedPeers} {T.peers}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => patch({ screen: 'pair' })} style={{ fontFamily: mono, fontSize: 10, background: 'none', border: '1px solid var(--line)', color: 'var(--fg)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>{T.pairDevice}</button>
          <button onClick={() => setShowChannelBox(s => !s)} style={{ fontFamily: mono, fontSize: 10, background: 'none', border: '1px solid var(--line)', color: 'var(--fg)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>{T.channelBtn}</button>
        </div>
      </div>
      {showChannelBox && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8 }}>
          <input value={channelInput} onChange={e => setChannelInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyChannel(); }}
            style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: '9px 12px', fontSize: 12, fontFamily: mono, outline: 'none' }} />
          <button onClick={applyChannel} style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 14px', fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>OK</button>
        </div>
      )}
      <div ref={listRef} className="beacon-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {chatMsgs.map(m => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: m.align }}>
            <div style={{ maxWidth: '80%', background: m.bg, color: m.color, border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 13, lineHeight: 1.45 }}>{m.text}</div>
            <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{m.meta}</span>
          </div>
        ))}
        {state.msgs.length === 0 && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)', textAlign: 'center', margin: 'auto', maxWidth: 240, lineHeight: 1.6 }}>{T.chatEmpty}</span>}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', gap: 8 }}>
        <input value={state.chatInput} onChange={e => patch({ chatInput: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') sendMsg(); }} placeholder={T.msgPlaceholder}
          style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: '11px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={sendMsg} style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 16px', fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{T.send}</button>
      </div>
    </div>
  );
}
