import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useApp } from '../context/AppContext.jsx';
import { dict } from '../i18n.js';
import { mono } from '../ui.js';

function osmStyle() {
  return { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] };
}

export default function MapScreen() {
  const { state, patch, locate, geoSearch, addMarkerAt } = useApp();
  const ru = (state.settings?.lang ?? 'ru') === 'ru';
  const T = dict(ru);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const isNight = (state.settings?.theme ?? 'night') === 'night';
  const mapDark = state.settings?.mapDark ?? true;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({ container: containerRef.current, style: osmStyle(), center: [30.5234, 50.4501], zoom: 12, attributionControl: { compact: true } });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('click', (ev) => addMarkerAt(ev.lngLat.lng, ev.lngLat.lat));
    map.on('load', () => { applyTheme(); renderMarkers(); });
    mapRef.current = map;
    patch({ mapStatus: ru ? 'OSM · офлайн-кэш' : 'OSM · offline cache' });
    return () => { try { map.remove(); } catch (e) {} mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTheme() {
    if (!containerRef.current) return;
    const dark = mapDark && isNight;
    containerRef.current.style.filter = dark ? 'invert(1) hue-rotate(180deg) brightness(.95) contrast(.9)' : 'none';
  }
  useEffect(() => { applyTheme(); }, [isNight, mapDark]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderMarkers() {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    for (const mk of state.markers) {
      const el = document.createElement('div');
      el.style.cssText = 'width:12px;height:12px;background:#fff;border:2px solid #000;box-shadow:0 0 0 1px #fff;' + (mk.kind === 'me' ? 'border-radius:50%;' : 'border-radius:2px;');
      const m = new maplibregl.Marker({ element: el }).setLngLat([mk.lng, mk.lat]).addTo(mapRef.current);
      markersRef.current.push(m);
    }
  }
  useEffect(() => { renderMarkers(); }, [state.markers]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocate = () => {
    locate();
  };
  useEffect(() => {
    if (state.coords && mapRef.current) mapRef.current.flyTo({ center: [state.coords.lng, state.coords.lat], zoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.coords?.lat, state.coords?.lng]);

  const handleGeoSearch = async () => {
    const loc = await geoSearch();
    if (loc && mapRef.current) mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 13 });
  };

  const headingLabel = state.heading != null ? 'HDG ' + state.heading + '°' : (ru ? 'компас: —' : 'compass: —');
  const markerCount = state.markers.filter(m => m.id !== 'me').length;

  return (
    <div data-screen-label="Map" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: 'var(--card2)' }} />
        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5 }}>
          <button onClick={handleLocate} style={{ fontFamily: mono, fontSize: 11, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 11px', cursor: 'pointer' }}>◎ {T.locateMe}</button>
          <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--fg)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 9px' }}>{headingLabel}</span>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 12, fontFamily: mono, fontSize: 9, color: 'var(--fg)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 9px', maxWidth: 150, textAlign: 'right', zIndex: 5 }}>{state.mapStatus}</div>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', background: 'var(--card)', padding: '11px 16px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <input value={state.geoQuery} onChange={e => patch({ geoQuery: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') handleGeoSearch(); }} placeholder={T.searchPlace}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={handleGeoSearch} style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '0 15px', height: 38, fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>→</button>
      </div>
      <div style={{ padding: '8px 16px 12px', fontFamily: mono, fontSize: 9, color: 'var(--mut)', flexShrink: 0 }}>{T.mapTapHint} · {markerCount} {T.savedPins}</div>
    </div>
  );
}
