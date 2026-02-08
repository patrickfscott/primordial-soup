// ============================================================================
// Shared CSS-in-JS styles
// ============================================================================

import type { CSSProperties } from 'react';

export const colors = {
  bg: '#0a0a0f',
  bgLight: '#141420',
  bgPanel: '#1a1a2e',
  bgInput: '#0e0e1a',
  border: '#2a2a40',
  borderLight: '#3a3a55',
  text: '#e0e0e0',
  textDim: '#8888aa',
  textBright: '#ffffff',
  accent: '#4488ff',
  accentDim: '#3366cc',
  danger: '#ff4444',
  success: '#44ff66',
  warning: '#ffaa44',
};

export const panel: CSSProperties = {
  background: colors.bgPanel,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  padding: 12,
};

export const button: CSSProperties = {
  background: colors.accent,
  color: colors.textBright,
  border: 'none',
  borderRadius: 4,
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
  fontWeight: 500,
};

export const buttonDanger: CSSProperties = {
  ...button,
  background: colors.danger,
};

export const buttonOutline: CSSProperties = {
  ...button,
  background: 'transparent',
  border: `1px solid ${colors.border}`,
  color: colors.text,
};

export const input: CSSProperties = {
  background: colors.bgInput,
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  color: colors.text,
  padding: '4px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
};

export const label: CSSProperties = {
  fontSize: 11,
  color: colors.textDim,
  marginBottom: 2,
};

export const h3: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: colors.textBright,
  margin: '0 0 8px 0',
};
