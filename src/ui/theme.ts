import { Color } from '../engine';

export const theme = {
  bg: '#060913',
  panel: 'rgba(20, 26, 43, 0.78)',
  panelHi: 'rgba(29, 37, 60, 0.88)',
  panelSolid: '#141a2b',
  border: '#2c3550',
  text: '#dce3f2',
  textDim: '#8b96b3',
  accent: '#6ea8fe',
  danger: '#e5484d',
  ok: '#46a758',
  highlight: '#f5d90a',
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
