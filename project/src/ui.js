export const mono = "'IBM Plex Mono', monospace";

export const primaryBtn = {
  background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: 14,
  fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: 'pointer'
};
export const outlineBtn = {
  background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 13,
  color: 'var(--fg)', fontFamily: mono, fontSize: 12, letterSpacing: 1, cursor: 'pointer'
};
export const textInput = {
  width: '100%', boxSizing: 'border-box', background: 'var(--card)', border: '1px solid var(--line)',
  borderRadius: 8, color: 'var(--fg)', padding: '13px 14px', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', textAlign: 'center'
};
export const pinInput = { ...textInput, fontFamily: mono, letterSpacing: 6 };
export const errBox = {
  fontFamily: mono, fontSize: 11, background: 'var(--card2)', border: '1px solid var(--line)',
  borderRadius: 6, padding: '9px 10px', textAlign: 'center'
};
export const backBtn = {
  background: 'none', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg)',
  padding: '7px 11px', fontFamily: mono, fontSize: 13, cursor: 'pointer'
};
export const card = { border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)' };
export const label9 = { fontFamily: mono, fontSize: 9, letterSpacing: 1.5, color: 'var(--mut)' };
