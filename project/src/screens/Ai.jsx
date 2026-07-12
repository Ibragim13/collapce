import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, card } from '../ui.js';
import { IconMic } from '../components/Icons.jsx';
import { MODEL_CATALOG } from '../ai/webllm.js';

export default function Ai() {
  const { state, patch, sendAi, micToggle, loadAiModel, unloadAiModel } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const listRef = useRef(null);
  const [view, setView] = useState('chat');

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [state.aiMsgs.length, state.aiMsgs[state.aiMsgs.length - 1]?.ru]);

  const aiMsgs = state.aiMsgs.map(m => ({
    text: ru ? m.ru : m.en, align: m.me ? 'flex-end' : 'flex-start',
    bg: m.me ? 'var(--fg)' : 'var(--card)', color: m.me ? 'var(--bg)' : 'var(--fg)',
    meta: m.me ? (ru ? 'вы' : 'you') : (state.webllmTier ? ('МАЯК-ИИ · ' + state.webllmTier.toUpperCase() + (m.streaming ? '…' : '')) : (ru ? 'МАЯК-ИИ · офлайн (база знаний)' : 'BEACON-AI · offline (knowledge base)'))
  }));
  const chipData = ru ? ['Остановить кровотечение', 'Очистить воду', 'Радиация'] : ['Stop a bleed', 'Purify water', 'Radiation'];

  const dev = state.device || {};
  const tierRank = { nano: 0, base: 1, full: 2 };
  const modelRows = MODEL_CATALOG.map(m => {
    const eligible = dev.webgpu && (dev.ram == null || dev.ram >= m.minRamGB);
    const isLoaded = state.webllmTier === m.tier;
    const isLoading = state.webllmLoading && !state.webllmTier;
    return { ...m, eligible, isLoaded };
  });

  return (
    <div data-screen-label="AI assistant" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        <button onClick={() => setView('chat')} style={{ flex: 1, padding: 11, background: 'none', border: 'none', borderBottom: '2px solid ' + (view === 'chat' ? 'var(--fg)' : 'transparent'), color: view === 'chat' ? 'var(--fg)' : 'var(--mut)', fontFamily: mono, fontSize: 11, letterSpacing: 1.5, cursor: 'pointer' }}>{T.aiTabChat}</button>
        <button onClick={() => setView('model')} style={{ flex: 1, padding: 11, background: 'none', border: 'none', borderBottom: '2px solid ' + (view === 'model' ? 'var(--fg)' : 'transparent'), color: view === 'model' ? 'var(--fg)' : 'var(--mut)', fontFamily: mono, fontSize: 11, letterSpacing: 1.5, cursor: 'pointer' }}>{T.aiTabModel}</button>
      </div>

      {view === 'chat' ? (
        <>
          <div ref={listRef} className="beacon-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {aiMsgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: m.align }}>
                <div style={{ maxWidth: '86%', background: m.bg, color: m.color, border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{m.text}</div>
                <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{m.meta}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {chipData.map((c, i) => (
              <button key={i} onClick={() => sendAi(c)} style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--fg)', borderRadius: 99, padding: '6px 11px', fontSize: 11, fontFamily: mono, cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', gap: 8 }}>
            <input value={state.aiInput} onChange={e => patch({ aiInput: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') sendAi(); }} placeholder={T.aiPlaceholder}
              style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: '11px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={micToggle} style={{ background: 'none', border: '1px solid var(--line)', color: state.micOn ? 'var(--fg)' : 'var(--mut)', borderRadius: 8, padding: '0 12px', fontFamily: mono, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconMic /></button>
            <button onClick={() => sendAi()} style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 16px', fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{T.send}</button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.yourDevice}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{dev.ram ? ('RAM ' + dev.ram + ' ГБ · ' + (dev.cores || '?') + (ru ? ' ядер' : ' cores')) : (ru ? 'характеристики скрыты браузером' : 'specs hidden by browser')}</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)' }}>{(dev.webgpu ? 'WebGPU ✓' : 'WebGPU ✗') + ' · ' + (ru ? 'офлайн-движок' : 'offline engine')}</span>
            {!dev.webgpu && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{T.aiNoWebgpu}</span>}
          </div>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.availModels} · {T.recommended}: {dev.recommendedTier || 'nano'}</span>
          {modelRows.map(m => (
            <div key={m.tier} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, opacity: m.eligible ? 1 : 0.45 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{m.approxSizeGB ? m.approxSizeGB + ' GB' : ''}</span>
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{m.eligible ? '✓ ' + (ru ? 'совместима' : 'compatible') : '✗ ' + (ru ? 'не тянет' : 'insufficient')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {m.isLoaded ? (
                  <button onClick={unloadAiModel} style={{ flex: 1, background: 'transparent', color: 'var(--mut)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 14px', fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{T.aiModelLoaded} · {T.aiUnload}</button>
                ) : (
                  <button disabled={!m.eligible || state.webllmLoading} onClick={() => loadAiModel(m.tier)} style={{ flex: 1, background: m.eligible ? 'var(--fg)' : 'transparent', color: m.eligible ? 'var(--bg)' : 'var(--mut)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 14px', fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {state.webllmLoading ? T.aiModelLoading : T.aiLoadModel}
                  </button>
                )}
              </div>
              {state.webllmLoading && !state.webllmTier && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ height: 4, background: 'var(--card2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--fg)', width: Math.round((state.webllmProgress || 0) * 100) + '%' }} />
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{state.webllmProgressText}</span>
                </div>
              )}
            </div>
          ))}
          {!!state.webllmError && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{state.webllmError}</span>}
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)', lineHeight: 1.6 }}>{T.modelNote}</span>
        </div>
      )}
    </div>
  );
}
