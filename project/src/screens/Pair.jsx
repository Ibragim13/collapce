import { useEffect, useRef, useState } from 'react';
import QRious from 'qrious';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, backBtn, primaryBtn, outlineBtn, card } from '../ui.js';
import { startQrScan } from '../mesh/scan.js';

function Qr({ text, size = 180 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !text) return;
    try {
      const d = new QRious({ value: text, size, level: 'L', background: '#ffffff', foreground: '#000000' }).toDataURL('image/png');
      ref.current.innerHTML = '<img src="' + d + '" style="width:100%;height:100%">';
    } catch (e) { ref.current.innerHTML = ''; }
  }, [text, size]);
  return <div ref={ref} style={{ width: size, height: size, background: '#fff', borderRadius: 8, alignSelf: 'center', overflow: 'hidden' }} />;
}

function Scanner({ onDecode }) {
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    stopRef.current = startQrScan(videoRef.current, (text) => { onDecode(text); }, (e) => setErr(String(e && e.message || e)));
    return () => { if (stopRef.current) stopRef.current(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 260, borderRadius: 8, background: '#000' }} />
      {!!err && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{err}</span>}
    </div>
  );
}

export default function Pair() {
  const { state, patch, mesh } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const [role, setRole] = useState(null); // 'host' | 'join'
  const [inviteText, setInviteText] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [status, setStatus] = useState('');
  const [scanning, setScanning] = useState(null); // 'offer' | 'answer' | null
  const [busy, setBusy] = useState(false);

  const back = () => patch({ screen: 'chat' });

  const startHost = async () => {
    if (!mesh) return;
    setRole('host'); setBusy(true); setStatus(ru ? 'создаю приглашение…' : 'creating invite…');
    try {
      const { inviteText } = await mesh.createInvite();
      setInviteText(inviteText); setStatus(ru ? 'покажите этот QR второму устройству' : 'show this QR to the other device');
    } catch (e) { setStatus(String(e.message || e)); }
    setBusy(false);
  };

  const completeAsHost = async (text) => {
    if (!mesh) return;
    setBusy(true); setStatus(ru ? 'подключаюсь…' : 'connecting…');
    try {
      await mesh.completeInvite(text || answerInput);
      setStatus(ru ? 'подключено ✓' : 'connected ✓');
    } catch (e) { setStatus(String(e.message || e)); }
    setBusy(false);
  };

  const startJoin = () => { setRole('join'); setStatus(''); };

  const acceptAsJoiner = async (text) => {
    if (!mesh) return;
    setBusy(true); setStatus(ru ? 'обрабатываю приглашение…' : 'processing invite…');
    try {
      const { answerText } = await mesh.acceptInvite(text || offerInput);
      setAnswerText(answerText); setStatus(ru ? 'покажите этот QR первому устройству' : 'show this QR back to the host device');
    } catch (e) { setStatus(String(e.message || e)); }
    setBusy(false);
  };

  return (
    <div data-screen-label="Pair device" style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={back} style={backBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{T.pairDevice}</span>
      </div>

      {!role && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.5 }}>
            {ru ? 'Работает офлайн между двумя устройствами на одной Wi-Fi сети/точке доступа — без интернета и без сервера. Одно устройство генерирует QR, второе сканирует и отвечает своим QR.' : 'Works fully offline between two devices on the same Wi-Fi/hotspot — no internet, no server. One device generates a QR, the other scans it and answers with its own QR.'}
          </span>
          <button onClick={startHost} style={primaryBtn}>{ru ? 'Я ХОЧУ ПРИГЛАСИТЬ' : 'I WANT TO INVITE'}</button>
          <button onClick={startJoin} style={outlineBtn}>{ru ? 'У МЕНЯ ЕСТЬ ПРИГЛАШЕНИЕ' : 'I HAVE AN INVITE'}</button>
        </div>
      )}

      {role === 'host' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!!inviteText && <Qr text={inviteText} />}
          {!!status && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)', textAlign: 'center' }}>{status}</span>}
          <div style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{ru ? 'Шаг 2: примите ответ второго устройства' : 'Step 2: accept the other device\'s answer'}</span>
            {scanning === 'answer' ? (
              <Scanner onDecode={(t) => { setScanning(null); setAnswerInput(t); completeAsHost(t); }} />
            ) : (
              <button onClick={() => setScanning('answer')} style={outlineBtn}>{ru ? 'СКАНИРОВАТЬ ОТВЕТ' : 'SCAN ANSWER'}</button>
            )}
            <textarea value={answerInput} onChange={e => setAnswerInput(e.target.value)} placeholder={ru ? 'или вставьте текст ответа' : 'or paste the answer text'}
              style={{ width: '100%', boxSizing: 'border-box', height: 60, resize: 'none', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: 10, fontSize: 11, fontFamily: mono, outline: 'none' }} />
            <button disabled={busy || !answerInput} onClick={() => completeAsHost()} style={primaryBtn}>{ru ? 'ЗАВЕРШИТЬ ПОДКЛЮЧЕНИЕ' : 'COMPLETE PAIRING'}</button>
          </div>
        </div>
      )}

      {role === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{ru ? 'Шаг 1: сканируйте приглашение' : 'Step 1: scan the invite'}</span>
            {scanning === 'offer' ? (
              <Scanner onDecode={(t) => { setScanning(null); setOfferInput(t); acceptAsJoiner(t); }} />
            ) : (
              <button onClick={() => setScanning('offer')} style={outlineBtn}>{ru ? 'СКАНИРОВАТЬ ПРИГЛАШЕНИЕ' : 'SCAN INVITE'}</button>
            )}
            <textarea value={offerInput} onChange={e => setOfferInput(e.target.value)} placeholder={ru ? 'или вставьте текст приглашения' : 'or paste the invite text'}
              style={{ width: '100%', boxSizing: 'border-box', height: 60, resize: 'none', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: 10, fontSize: 11, fontFamily: mono, outline: 'none' }} />
            <button disabled={busy || !offerInput} onClick={() => acceptAsJoiner()} style={primaryBtn}>{ru ? 'ПРИНЯТЬ' : 'ACCEPT'}</button>
          </div>
          {!!status && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)', textAlign: 'center' }}>{status}</span>}
          {!!answerText && <Qr text={answerText} />}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {state.peers.map(p => (
          <span key={p.id} style={{ fontFamily: mono, fontSize: 10, border: '1px solid var(--line)', borderRadius: 99, padding: '6px 11px', opacity: p.connected ? 1 : 0.4 }}>{p.id} {p.connected ? '✓' : '—'}</span>
        ))}
      </div>
    </div>
  );
}
