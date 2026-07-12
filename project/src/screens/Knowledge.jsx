import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono, backBtn, primaryBtn, card } from '../ui.js';
import { BeaconKB } from '../lib/kb.js';
import { downloadZim, listDownloadedZims, deleteZim, getZimFile } from '../kiwix/download.js';
import { openZimArchive } from '../kiwix/zim.js';

export default function Knowledge() {
  const { state, patch } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const [tab, setTab] = useState('builtin'); // 'builtin' | 'wiki'
  const [zimList, setZimList] = useState([]);
  const [zimUrl, setZimUrl] = useState('');
  const [dl, setDl] = useState(null); // {pct, receivedBytes, totalBytes}
  const [dlErr, setDlErr] = useState('');
  const [archives, setArchives] = useState({}); // id -> ZimArchive
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiResults, setWikiResults] = useState([]);
  const [wikiArticle, setWikiArticle] = useState(null); // { html, resolveResource }
  const articleHostRef = useRef(null);
  const abortRef = useRef(null);

  const refreshZimList = () => listDownloadedZims().then(setZimList).catch(() => setZimList([]));
  useEffect(() => { refreshZimList(); }, []);

  const kbArt = state.kbArticle;

  const back = () => {
    if (wikiArticle) { setWikiArticle(null); return; }
    if (kbArt) { patch({ kbArticle: null }); return; }
    patch({ screen: 'home' });
  };

  const kbResultsRaw = state.kbQuery.trim() ? BeaconKB.search(state.kbQuery, ru ? 'ru' : 'en') : [];
  const kbResults = kbResultsRaw.map(r => ({ title: r.title, cat: r.cat, art: r.art }));

  const startDownload = async () => {
    const url = zimUrl.trim(); if (!url) return;
    setDlErr(''); setDl({ pct: 0 });
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      await downloadZim(url, {
        signal: ctrl.signal,
        onProgress: ({ receivedBytes, totalBytes }) => setDl({ pct: totalBytes ? Math.round(receivedBytes / totalBytes * 100) : null, receivedBytes, totalBytes })
      });
      setDl(null); setZimUrl(''); refreshZimList();
    } catch (e) { setDlErr(String(e.message || e)); setDl(null); }
  };

  const openArchive = async (id) => {
    if (archives[id]) return archives[id];
    const file = await getZimFile(id);
    const arc = await openZimArchive(file);
    setArchives(a => ({ ...a, [id]: arc }));
    return arc;
  };

  const runWikiSearch = async (q) => {
    setWikiQuery(q);
    if (!q.trim()) { setWikiResults([]); return; }
    const all = [];
    for (const meta of zimList) {
      try {
        const arc = await openArchive(meta.id);
        const hits = await arc.searchTitles(q, 15);
        hits.forEach(h => all.push({ ...h, zimId: meta.id, zimName: meta.name }));
      } catch (e) { /* archive unreadable, skip */ }
    }
    setWikiResults(all.slice(0, 30));
  };

  const openWikiEntry = async (zimId, entry) => {
    try {
      const arc = archives[zimId] || await openArchive(zimId);
      const { html, resolveResource } = await arc.readArticleHtml(entry);
      setWikiArticle({ html, resolveResource, title: entry.title || entry.url });
    } catch (e) { setWikiArticle({ html: '<p>' + (ru ? 'Не удалось открыть статью' : 'Failed to open article') + '</p>', resolveResource: async () => null, title: '' }); }
  };

  // rewrite <img src="..."> / <link href="..."> inside the fetched article to blob: URLs
  useEffect(() => {
    if (!wikiArticle || !articleHostRef.current) return;
    const host = articleHostRef.current;
    let revoke = [];
    (async () => {
      const imgs = host.querySelectorAll('img[src]');
      for (const img of imgs) {
        const src = img.getAttribute('src');
        if (!src || /^(https?:|data:|blob:)/.test(src)) continue;
        const blob = await wikiArticle.resolveResource(src.replace(/^\.?\//, ''));
        if (blob) { const u = URL.createObjectURL(blob); revoke.push(u); img.src = u; }
        else img.style.display = 'none';
      }
    })();
    return () => revoke.forEach(u => URL.revokeObjectURL(u));
  }, [wikiArticle]);

  return (
    <div data-screen-label="Knowledge base" style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={back} style={backBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{kbArt ? (ru ? 'Статья' : 'Article') : wikiArticle ? wikiArticle.title : T.knowledge}</span>
      </div>

      {kbArt ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{kbArt.title}</span>
          {kbArt.body.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: 'var(--mut)', minWidth: 18 }}>{i + 1}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55 }}>{s}</span>
            </div>
          ))}
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)', marginTop: 6 }}>{T.storedLocal}</span>
        </div>
      ) : wikiArticle ? (
        <div ref={articleHostRef} className="beacon-scroll" style={{ fontSize: 14, lineHeight: 1.6, overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: wikiArticle.html }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
            <button onClick={() => setTab('builtin')} style={{ flex: 1, padding: 10, background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === 'builtin' ? 'var(--fg)' : 'transparent'), color: tab === 'builtin' ? 'var(--fg)' : 'var(--mut)', fontFamily: mono, fontSize: 11, letterSpacing: 1.2, cursor: 'pointer' }}>{T.kbBuiltin}</button>
            <button onClick={() => setTab('wiki')} style={{ flex: 1, padding: 10, background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === 'wiki' ? 'var(--fg)' : 'transparent'), color: tab === 'wiki' ? 'var(--fg)' : 'var(--mut)', fontFamily: mono, fontSize: 11, letterSpacing: 1.2, cursor: 'pointer' }}>{T.kbWiki}</button>
          </div>

          {tab === 'builtin' ? (
            <>
              <input value={state.kbQuery} onChange={e => patch({ kbQuery: e.target.value })} placeholder={T.searchKb}
                style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: 12, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              {kbResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)' }}>
                  {kbResults.map((r, i) => (
                    <button key={i} onClick={() => patch({ kbArticle: { title: r.art[ru ? 'ru' : 'en'].t, body: r.art[ru ? 'ru' : 'en'].b } })} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--fg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{r.cat}</span>
                    </button>
                  ))}
                </div>
              ) : (
                BeaconKB.CATS.map(c => (
                  <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontFamily: mono, fontSize: 11, letterSpacing: 1, color: 'var(--mut)' }}>{c[ru ? 'ru' : 'en']}</div>
                    {c.articles.map(a => (
                      <button key={a.id} onClick={() => patch({ kbArticle: { title: a[ru ? 'ru' : 'en'].t, body: a[ru ? 'ru' : 'en'].b } })} style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--fg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ fontSize: 13 }}>{a[ru ? 'ru' : 'en'].t}</span><span style={{ color: 'var(--mut)' }}>→</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{T.kbAddZim}</span>
                <input value={zimUrl} onChange={e => setZimUrl(e.target.value)} placeholder={T.kbZimUrlPh}
                  style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: 10, fontSize: 11, fontFamily: mono, outline: 'none' }} />
                <button onClick={startDownload} disabled={!!dl} style={primaryBtn}>{T.kbDownload}</button>
                {dl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ height: 4, background: 'var(--card2)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', background: 'var(--fg)', width: (dl.pct ?? 0) + '%' }} /></div>
                    <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--mut)' }}>{dl.pct != null ? dl.pct + '%' : Math.round((dl.receivedBytes || 0) / 1e6) + ' MB'}</span>
                  </div>
                )}
                {!!dlErr && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{dlErr}</span>}
              </div>

              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: 'var(--mut)' }}>{T.kbDownloads}</span>
              {zimList.length === 0 ? (
                <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--mut)', lineHeight: 1.6 }}>{T.kbNoZim}</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {zimList.map(z => (
                    <div key={z.id} style={{ ...card, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{Math.round(z.sizeBytes / 1e6)} MB</span>
                      </div>
                      <button onClick={() => deleteZim(z.id).then(refreshZimList)} style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--mut)', borderRadius: 6, padding: '6px 10px', fontFamily: mono, fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>{T.kbDelete}</button>
                    </div>
                  ))}
                </div>
              )}

              {zimList.length > 0 && (
                <>
                  <input value={wikiQuery} onChange={e => runWikiSearch(e.target.value)} placeholder={T.searchKb}
                    style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: 12, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  {wikiResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--card)' }}>
                      {wikiResults.map((r, i) => (
                        <button key={i} onClick={() => openWikiEntry(r.zimId, r)} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--fg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--mut)' }}>{r.zimName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
