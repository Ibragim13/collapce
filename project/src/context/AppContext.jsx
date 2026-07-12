import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { BeaconDB } from '../lib/db.js';
import * as Crypto from '../lib/crypto.js';
import { BeaconKB } from '../lib/kb.js';
import { Mesh } from '../mesh/mesh.js';
import { detectDeviceCapability, LocalAI } from '../ai/webllm.js';

const DEFAULTS = { theme: null, lang: null, siren: true, vibrate: true, strobe: true, torch: true, deadman: false, deadmanMin: 30, mapDark: true };

const SOS_SEQ = [['on', 200], ['off', 200], ['on', 200], ['off', 200], ['on', 200], ['off', 500], ['on', 600], ['off', 200], ['on', 600], ['off', 200], ['on', 600], ['off', 500], ['on', 200], ['off', 200], ['on', 200], ['off', 200], ['on', 200], ['off', 1400]];

const AppCtx = createContext(null);
export function useApp() { return useContext(AppCtx); }

export function AppProvider({ children }) {
  const [state, setState] = useState({
    ready: false, auth: 'boot', screen: 'home',
    identity: null, settings: null,
    aName: '', aPin: '', aPin2: '', aErr: '', aPhrase: '', aEntropyHex: '', aConfirm: false, aRestore: '', pendingNodeId: '',
    online: (typeof navigator !== 'undefined' && navigator.onLine),
    sosActive: false, sosT: 0, coords: null,
    strobeOn: false, dmArmed: false, dmLeft: 0,
    msgs: [], chatInput: '', channelCode: 'OPEN', peers: [],
    aiMsgs: [], aiInput: '', aiView: 'chat', device: null, aiBusy: false,
    webllmTier: null, webllmLoading: false, webllmProgress: 0, webllmProgressText: '', webllmError: '',
    markers: [], heading: null, mapStatus: '', geoQuery: '',
    kbQuery: '', kbArticle: null,
    battery: null, installEvt: null, hasExport: false, micOn: false, weatherLoading: false, wx: null
  });

  const patch = useCallback((p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })), []);
  const ref = useRef(state);
  ref.current = state;

  const mesh = useRef(null);
  const localAI = useRef(null);
  const rec = useRef(null); // SpeechRecognition instance

  // ── boot ──
  useEffect(() => {
    (async () => {
      const idn = await BeaconDB.get('kv', 'identity').catch(() => null);
      const settings = (await BeaconDB.get('kv', 'settings').catch(() => null)) || { ...DEFAULTS };
      const msgs = ((await BeaconDB.all('messages').catch(() => [])) || []).sort((a, b) => a.ts - b.ts);
      const markers = (await BeaconDB.all('markers').catch(() => [])) || [];
      patch({
        ready: true, settings, identity: idn || null, markers, msgs,
        auth: idn ? 'unlock' : 'welcome', aName: idn ? idn.name : '',
        aiMsgs: [{ me: false, ru: 'Я работаю полностью офлайн на вашем устройстве. Спросите про первую помощь, воду, укрытие, радиацию — или используйте подсказки ниже. Во вкладке «Модель» можно скачать настоящую локальную LLM.', en: 'I run fully offline on your device. Ask about first aid, water, shelter, radiation — or use the chips below. The "Model" tab lets you download a real local LLM.' }]
      });
      const dev = await detectDeviceCapability();
      patch({ device: dev });
    })();

    const net = () => patch({ online: navigator.onLine });
    window.addEventListener('online', net); window.addEventListener('offline', net);
    const inst = (e) => { e.preventDefault(); patch({ installEvt: e }); };
    window.addEventListener('beforeinstallprompt', inst);
    const tick = setInterval(() => {
      if (ref.current.sosActive) patch(s => ({ sosT: s.sosT + 1 }));
      if (ref.current.dmArmed) tickDeadman();
    }, 1000);
    const orient = (e) => {
      if (e.alpha == null) return;
      const h = Math.round((360 - e.alpha) % 360);
      if (ref.current.heading == null || Math.abs(h - ref.current.heading) >= 2) patch({ heading: h });
    };
    window.addEventListener('deviceorientationabsolute', orient, true);
    window.addEventListener('deviceorientation', orient, true);
    if (navigator.getBattery) navigator.getBattery().then(b => {
      const upd = () => patch({ battery: Math.round(b.level * 100) });
      upd(); b.addEventListener('levelchange', upd);
    }).catch(() => {});

    return () => {
      window.removeEventListener('online', net); window.removeEventListener('offline', net);
      window.removeEventListener('beforeinstallprompt', inst);
      window.removeEventListener('deviceorientation', orient, true);
      window.removeEventListener('deviceorientationabsolute', orient, true);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── mesh (chat) ──
  useEffect(() => {
    if (!state.ready || mesh.current) return;
    const nodeId = state.identity ? state.identity.nodeId : 'guest-' + Math.random().toString(36).slice(2, 8);
    const nodeName = state.identity ? state.identity.name : 'guest';
    const m = new Mesh({ nodeId, nodeName });
    mesh.current = m;
    m.setChannel(state.channelCode);
    m.addEventListener('message', (ev) => {
      const msg = { ...ev.detail, me: false };
      BeaconDB.set('messages', msg).catch(() => {});
      patch(s => ({ msgs: [...s.msgs, msg] }));
    });
    m.addEventListener('peers', (ev) => patch({ peers: ev.detail }));
    return () => { m.close(); mesh.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ready]);

  const setChannel = useCallback((code) => {
    patch({ channelCode: code });
    if (mesh.current) mesh.current.setChannel(code);
  }, [patch]);

  const sendMsg = useCallback(async () => {
    const t = ref.current.chatInput.trim(); if (!t || !mesh.current) return;
    patch({ chatInput: '' });
    const mine = await mesh.current.broadcast(t);
    const rec2 = { ...mine, me: true };
    await BeaconDB.set('messages', rec2).catch(() => {});
    patch(s => ({ msgs: [...s.msgs, rec2] }));
  }, [patch]);

  // ── settings ──
  const sv = useCallback((k) => (ref.current.settings || DEFAULTS)[k], []);
  const setSetting = useCallback((k, v) => {
    const s = { ...(ref.current.settings || DEFAULTS), [k]: v };
    patch({ settings: s });
    BeaconDB.set('kv', 'settings', s).catch(() => {});
  }, [patch]);
  const lang = useCallback(() => sv('lang') ?? 'ru', [sv]);
  const theme = useCallback(() => sv('theme') ?? 'night', [sv]);

  // ── identity ──
  const genPhrase = useCallback(() => {
    const e = Crypto.newEntropy();
    patch({ aEntropyHex: Crypto.hex(e), aPhrase: Crypto.phraseFromEntropy(e) });
    Crypto.nodeIdFromEntropy(e).then(id => patch({ pendingNodeId: id }));
  }, [patch]);

  const submitCreate = useCallback(() => {
    const ru = lang() === 'ru'; const s = ref.current;
    if (!s.aName.trim()) return patch({ aErr: ru ? 'Введите имя' : 'Enter a name' });
    if (!/^\d{4,8}$/.test(s.aPin)) return patch({ aErr: ru ? 'PIN — 4–8 цифр' : 'PIN — 4–8 digits' });
    if (s.aPin !== s.aPin2) return patch({ aErr: ru ? 'PIN не совпадает' : 'PINs do not match' });
    patch({ aErr: '' }); genPhrase(); patch({ auth: 'phrase' });
  }, [lang, patch, genPhrase]);

  const finalizeId = useCallback(async () => {
    const s = ref.current; if (!s.aConfirm) return;
    const entropy = Crypto.hexToBytes(s.aEntropyHex);
    const nodeId = await Crypto.nodeIdFromEntropy(entropy);
    const salt = Crypto.randSalt();
    const pinHash = await Crypto.derivePin(s.aPin, salt);
    const idn = { name: s.aName.trim(), nodeId, saltHex: Crypto.hex(salt), pinHash, entropyHex: s.aEntropyHex, createdAt: Date.now() };
    await BeaconDB.set('kv', 'identity', idn);
    patch({ identity: idn, auth: 'app', screen: 'home', aPin: '', aPin2: '', aPhrase: '', aEntropyHex: '', aConfirm: false, aErr: '' });
  }, [patch]);

  const doUnlock = useCallback(async () => {
    const ru = lang() === 'ru'; const s = ref.current; const idn = s.identity;
    const h = await Crypto.derivePin(s.aPin, Crypto.hexToBytes(idn.saltHex));
    if (h === idn.pinHash) patch({ auth: 'app', screen: 'home', aPin: '', aErr: '' });
    else patch({ aErr: ru ? 'Неверный PIN' : 'Wrong PIN', aPin: '' });
  }, [lang, patch]);

  const doRestore = useCallback(async () => {
    const ru = lang() === 'ru'; const s = ref.current;
    const entropy = Crypto.entropyFromPhrase(s.aRestore);
    if (!entropy) return patch({ aErr: ru ? 'Фраза: ровно 12 слов из списка' : 'Phrase: exactly 12 words from the list' });
    if (!s.aName.trim()) return patch({ aErr: ru ? 'Введите имя' : 'Enter a name' });
    if (!/^\d{4,8}$/.test(s.aPin)) return patch({ aErr: ru ? 'PIN — 4–8 цифр' : 'PIN — 4–8 digits' });
    const nodeId = await Crypto.nodeIdFromEntropy(entropy);
    const salt = Crypto.randSalt();
    const pinHash = await Crypto.derivePin(s.aPin, salt);
    const idn = { name: s.aName.trim(), nodeId, saltHex: Crypto.hex(salt), pinHash, entropyHex: Crypto.hex(entropy), createdAt: Date.now(), restored: true };
    await BeaconDB.set('kv', 'identity', idn);
    patch({ identity: idn, auth: 'app', screen: 'home', aPin: '', aRestore: '', aErr: '' });
  }, [lang, patch]);

  const lockApp = useCallback(() => patch(s => ({ auth: s.identity ? 'unlock' : 'welcome', aPin: '', aErr: '', screen: 'home' })), [patch]);
  const guestSos = useCallback(() => patch({ auth: 'app', screen: 'sos' }), [patch]);

  // ── map ──
  const locate = useCallback(() => {
    const ru = lang() === 'ru';
    if (!navigator.geolocation) return patch({ mapStatus: ru ? 'GPS недоступен' : 'GPS unavailable' });
    patch({ mapStatus: ru ? 'поиск GPS…' : 'locating…' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude, accuracy } = p.coords;
        patch({ coords: { lat: latitude, lng: longitude, acc: Math.round(accuracy) }, mapStatus: 'GPS ✓' });
        const me = { id: 'me', lng: longitude, lat: latitude, kind: 'me', ts: Date.now() };
        BeaconDB.set('markers', me).catch(() => {});
        patch(s => ({ markers: [...s.markers.filter(x => x.id !== 'me'), me] }));
      },
      (err) => patch({ mapStatus: 'GPS: ' + err.message.slice(0, 30) }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [lang, patch]);

  const geoSearch = useCallback(async () => {
    const q = ref.current.geoQuery.trim(); if (!q) return null;
    const ru = lang() === 'ru';
    patch({ mapStatus: ru ? 'поиск места…' : 'searching…' });
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'Accept': 'application/json' } });
      const j = await r.json();
      if (j && j[0]) { patch({ mapStatus: j[0].display_name.split(',')[0] }); return { lat: +j[0].lat, lng: +j[0].lon }; }
      patch({ mapStatus: ru ? 'не найдено (нужна сеть)' : 'not found (needs network)' });
    } catch (e) { patch({ mapStatus: ru ? 'нужен интернет для поиска' : 'search needs internet' }); }
    return null;
  }, [lang, patch]);

  const addMarkerAt = useCallback(async (lng, lat) => {
    const mk = { id: 'm' + Date.now(), lng, lat, kind: 'pin', ts: Date.now() };
    await BeaconDB.set('markers', mk);
    patch(s => ({ markers: [...s.markers, mk] }));
  }, [patch]);

  // ── SOS ──
  const audio = useRef({});
  const startSiren = useCallback(() => {
    if (audio.current.ac) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth'; o.connect(g); g.connect(ac.destination); g.gain.value = 0.0001; o.start();
      g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.15);
      const sweep = setInterval(() => { const t = ac.currentTime; o.frequency.setValueAtTime(600, t); o.frequency.linearRampToValueAtTime(1300, t + 0.6); }, 1200);
      const t0 = ac.currentTime; o.frequency.setValueAtTime(600, t0); o.frequency.linearRampToValueAtTime(1300, t0 + 0.6);
      audio.current = { ac, o, g, sweep };
    } catch (e) {}
  }, []);
  const stopSiren = useCallback(() => {
    const a = audio.current; if (a.sweep) clearInterval(a.sweep);
    try { if (a.g && a.ac) a.g.gain.exponentialRampToValueAtTime(0.0001, a.ac.currentTime + 0.1); const ac = a.ac, o = a.o; setTimeout(() => { try { o.stop(); ac.close(); } catch (e) {} }, 200); } catch (e) {}
    audio.current = {};
  }, []);
  const strobeState = useRef({ stop: true, to: null });
  const startStrobe = useCallback(() => {
    strobeState.current.stop = false; let i = 0;
    const step = () => {
      if (strobeState.current.stop) { patch({ strobeOn: false }); return; }
      const [st, dur] = SOS_SEQ[i % SOS_SEQ.length];
      patch({ strobeOn: st === 'on' }); i++;
      strobeState.current.to = setTimeout(step, dur);
    };
    step();
  }, [patch]);
  const stopStrobe = useCallback(() => { strobeState.current.stop = true; clearTimeout(strobeState.current.to); patch({ strobeOn: false }); }, [patch]);
  const vib = useRef(null);
  const vibrateSos = useCallback(() => {
    if (!navigator.vibrate) return;
    const pat = SOS_SEQ.map(x => x[1]); navigator.vibrate(pat);
    vib.current = setInterval(() => navigator.vibrate(pat), pat.reduce((a, b) => a + b, 0) + 400);
  }, []);
  const stopVibrate = useCallback(() => { if (vib.current) clearInterval(vib.current); vib.current = null; if (navigator.vibrate) navigator.vibrate(0); }, []);

  const toggleSos = useCallback(() => {
    if (!ref.current.sosActive) {
      patch({ sosActive: true, sosT: 0, screen: 'sos' });
      locate();
      if (sv('siren')) startSiren();
      if (sv('strobe')) startStrobe();
      if (sv('vibrate')) vibrateSos();
      const s = ref.current;
      const recSos = { id: 's' + Date.now(), ts: Date.now(), coords: s.coords || null };
      BeaconDB.set('sos', recSos).catch(() => {});
      if (mesh.current) mesh.current.broadcast('[SOS] ' + (s.identity ? s.identity.name : 'guest') + ' — ' + (lang() === 'ru' ? 'нужна помощь' : 'needs help'));
    } else {
      patch({ sosActive: false });
      stopSiren(); stopStrobe(); stopVibrate();
    }
  }, [patch, locate, sv, startSiren, startStrobe, vibrateSos, stopSiren, stopStrobe, stopVibrate, lang]);

  // ── dead-man ──
  const toggleDeadman = useCallback(() => {
    if (ref.current.dmArmed) patch({ dmArmed: false, dmLeft: 0 });
    else patch({ dmArmed: true, dmLeft: sv('deadmanMin') * 60 });
  }, [patch, sv]);
  const resetDeadman = useCallback(() => patch({ dmLeft: sv('deadmanMin') * 60 }), [patch, sv]);
  function tickDeadman() {
    setState(s => {
      const n = s.dmLeft - 1;
      if (n <= 0) { setTimeout(() => { if (!ref.current.sosActive) toggleSos(); }, 0); return { ...s, dmLeft: 0, dmArmed: false }; }
      return { ...s, dmLeft: n };
    });
  }

  // ── AI ──
  const aiAnswer = useCallback((q) => {
    const ru = lang() === 'ru';
    const hits = BeaconKB.search(q, ru ? 'ru' : 'en');
    if (hits.length) { const a = hits[0].art[ru ? 'ru' : 'en']; return a.t + ':\n' + a.b.map((s, i) => (i + 1) + '. ' + s).join('\n'); }
    const s = q.toLowerCase();
    if (/кров|bleed|рана|wound/.test(s)) return ru ? 'Кровотечение: прямое давление 10–15 мин, конечность выше сердца, жгут выше раны при пульсирующей крови (запишите время).' : 'Bleed: direct pressure 10–15 min, limb above heart, tourniquet above wound if pulsing (note the time).';
    return ru ? 'Уточните: что случилось, есть ли пострадавшие, что под рукой? Помогу с первой помощью, водой, укрытием, радиацией, ориентированием.' : 'Tell me more: what happened, injuries, supplies? I help with first aid, water, shelter, radiation, navigation.';
  }, [lang]);

  const loadAiModel = useCallback(async (tier) => {
    if (!localAI.current) localAI.current = new LocalAI();
    const ai = localAI.current;
    patch({ webllmLoading: true, webllmError: '', webllmProgress: 0, webllmProgressText: '' });
    const onProg = (ev) => patch({ webllmProgress: ev.detail.progress, webllmProgressText: ev.detail.text });
    ai.addEventListener('progress', onProg);
    try {
      await ai.loadModel(tier);
      patch({ webllmTier: tier, webllmLoading: false });
    } catch (e) {
      patch({ webllmError: String(e && e.message || e), webllmLoading: false });
    } finally {
      ai.removeEventListener('progress', onProg);
    }
  }, [patch]);

  const unloadAiModel = useCallback(() => { if (localAI.current) localAI.current.unload(); patch({ webllmTier: null }); }, [patch]);

  const sendAi = useCallback(async (preset) => {
    const s = ref.current;
    const txt = (preset || s.aiInput).trim(); if (!txt) return;
    patch(st => ({ aiMsgs: [...st.aiMsgs, { me: true, ru: txt, en: txt }], aiInput: '' }));
    const ai = localAI.current;
    if (ai && ai.loadedTier) {
      patch(st => ({ aiMsgs: [...st.aiMsgs, { me: false, ru: '', en: '', streaming: true }] }));
      try {
        const history = ref.current.aiMsgs.filter(m => !m.streaming).slice(-8).map(m => ({ role: m.me ? 'user' : 'assistant', content: lang() === 'ru' ? m.ru : m.en }));
        history.push({ role: 'user', content: txt });
        let acc = '';
        const full = await ai.chat(history, { onToken: (delta) => { acc += delta; patch(st => { const arr = [...st.aiMsgs]; arr[arr.length - 1] = { me: false, ru: acc, en: acc, streaming: true }; return { aiMsgs: arr }; }); } });
        patch(st => { const arr = [...st.aiMsgs]; arr[arr.length - 1] = { me: false, ru: full || acc, en: full || acc }; return { aiMsgs: arr }; });
      } catch (e) {
        const ans = aiAnswer(txt);
        patch(st => { const arr = [...st.aiMsgs]; arr[arr.length - 1] = { me: false, ru: ans, en: ans }; return { aiMsgs: arr }; });
      }
      return;
    }
    setTimeout(() => { const ans = aiAnswer(txt); patch(st => ({ aiMsgs: [...st.aiMsgs, { me: false, ru: ans, en: ans }] })); }, 400);
  }, [patch, aiAnswer, lang]);

  const micToggle = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { patch({ micOn: false }); window.alert(lang() === 'ru' ? 'Голосовой ввод недоступен на этом устройстве' : 'Voice input unavailable on this device'); return; }
    if (rec.current) { rec.current.stop(); rec.current = null; patch({ micOn: false }); return; }
    const r = new SR(); r.lang = lang() === 'ru' ? 'ru-RU' : 'en-US'; r.interimResults = false;
    r.onresult = (e) => patch({ aiInput: e.results[0][0].transcript });
    r.onend = () => { rec.current = null; patch({ micOn: false }); };
    r.start(); rec.current = r; patch({ micOn: true });
  }, [lang, patch]);

  // ── PWA / data ──
  const doInstall = useCallback(() => { const e = ref.current.installEvt; if (e) { e.prompt(); patch({ installEvt: null }); } }, [patch]);

  const refreshWeather = useCallback(() => {
    const c = ref.current.coords; if (!c) { locate(); return; }
    patch({ weatherLoading: true });
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lng + '&current=temperature_2m,wind_speed_10m')
      .then(r => r.json()).then(j => patch({ wx: j && j.current ? j.current : null, weatherLoading: false }))
      .catch(() => patch({ weatherLoading: false }));
  }, [locate, patch]);

  const value = {
    state, patch, ref,
    mesh: mesh.current, setChannel, sendMsg,
    sv, setSetting, lang, theme,
    genPhrase, submitCreate, finalizeId, doUnlock, doRestore, lockApp, guestSos,
    locate, geoSearch, addMarkerAt,
    toggleSos, toggleDeadman, resetDeadman,
    aiAnswer, sendAi, micToggle, loadAiModel, unloadAiModel,
    doInstall, refreshWeather
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
