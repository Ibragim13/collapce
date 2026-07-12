const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconHome({ size = 26, strokeWidth = 1.9 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <path d="M3 10.4 L12 3.3 L21 10.4" /><path d="M5.4 8.7 V20.2 H18.6 V8.7" />
  </svg>;
}
export function IconMap({ size = 26, strokeWidth = 1.9 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <path d="M9 3.6 L3.6 5.6 V20.4 L9 18.4 L15 20.4 L20.4 18.4 V3.6 L15 5.6 Z" /><path d="M9 3.6 V18.4" /><path d="M15 5.6 V20.4" />
  </svg>;
}
export function IconChat({ size = 26, strokeWidth = 1.9 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <path d="M4 5.4 H20 A0.8 0.8 0 0 1 20.8 6.2 V15.4 A0.8 0.8 0 0 1 20 16.2 H9.4 L5.2 20 V16.2 H4 A0.8 0.8 0 0 1 3.2 15.4 V6.2 A0.8 0.8 0 0 1 4 5.4 Z" />
  </svg>;
}
export function IconAi({ size = 26, strokeWidth = 1.9 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <rect x="7.5" y="7.5" width="9" height="9" rx="1.6" /><path d="M10 3.8 V7.5 M14 3.8 V7.5 M10 16.5 V20.2 M14 16.5 V20.2 M3.8 10 H7.5 M3.8 14 H7.5 M16.5 10 H20.2 M16.5 14 H20.2" />
  </svg>;
}
export function IconTheme({ size = 14, strokeWidth = 1.9, isNight }) {
  const d = isNight
    ? 'M20 14.5 A8 8 0 0 1 9.5 4 A7 7 0 1 0 20 14.5 Z'
    : 'M12 4 V2 M12 22 V20 M4 12 H2 M22 12 H20 M6 6 L4.5 4.5 M18 18 L19.5 19.5 M6 18 L4.5 19.5 M18 6 L19.5 4.5 M12 7.5 A4.5 4.5 0 1 0 12 16.5 A4.5 4.5 0 0 0 12 7.5 Z';
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}><path d={d} /></svg>;
}
export function IconGear({ size = 14, strokeWidth = 1.8 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <circle cx="12" cy="12" r="3" /><path d="M12 2.6 V5 M12 19 V21.4 M4.2 7 L6.3 8.2 M17.7 15.8 L19.8 17 M4.2 17 L6.3 15.8 M17.7 8.2 L19.8 7 M2.6 12 H5 M19 12 H21.4" />
  </svg>;
}
export function IconLock({ size = 14, strokeWidth = 2 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="1.6" /><path d="M7.8 10.5 V7.4 A4.2 4.2 0 0 1 16.2 7.4 V10.5" />
  </svg>;
}
export function IconMic({ size = 15, strokeWidth = 1.9 }) {
  return <svg viewBox="0 0 24 24" style={{ ...base, width: size, height: size, strokeWidth }}>
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11 A6 6 0 0 0 18 11 M12 17 V21" />
  </svg>;
}
