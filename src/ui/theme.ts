import { Color } from '../engine';

export const theme = {
  bg: '#050810',
  panel: 'rgba(16, 24, 38, 0.78)',
  panelHi: 'rgba(22, 33, 52, 0.9)',
  panelSolid: '#101826',
  border: '#24344d',
  text: '#d8e6f2',
  textDim: '#7e93ad',
  /** HUD primary: signal cyan. */
  accent: '#4fd1e8',
  danger: '#ff5c5c',
  ok: '#46c77a',
  /** HUD warning/target: amber. */
  highlight: '#ffb454',
  /** Monospace face for data readouts (SYS/FLT/TRN). */
  mono: 'monospace',
  /** Sharp HUD corner radius. */
  radius: 4,
};

export const pieceColors: Record<Color, string> = {
  r: '#e5484d',
  y: '#e8c33b',
  g: '#46a758',
  b: '#4f9cf0',
};

export const colorNames: Record<Color, string> = {
  r: 'Red',
  y: 'Yellow',
  g: 'Green',
  b: 'Blue',
};
