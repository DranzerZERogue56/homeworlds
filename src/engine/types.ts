export type Color = 'r' | 'y' | 'g' | 'b';
export type Size = 1 | 2 | 3;
export type PlayerId = 0 | 1;

export const COLORS: Color[] = ['r', 'y', 'g', 'b'];
export const SIZES: Size[] = [1, 2, 3];

export interface Piece {
  color: Color;
  size: Size;
}

/** Bank keyed by "r1".."b3" -> remaining count (0..3). */
export type Bank = Record<string, number>;

export interface System {
  id: number;
  /** Display name: "Home 1" / "Home 2" for homeworlds, greek letters for colonies. */
  name: string;
  stars: Piece[];
  /** ships[0] = player 0's ships, ships[1] = player 1's ships. */
  ships: [Piece[], Piece[]];
  /** Set if this system is a player's homeworld. */
  home?: PlayerId;
}

export type Phase =
  /** Players are choosing homeworld stars + first ship. */
  | 'setup'
  /** Current player has not yet taken their free action or sacrificed. */
  | 'main'
  /** Free action (or all sacrifice actions) done; catastrophes may still be declared. */
  | 'post'
  /** A ship was sacrificed; sacrifice.actionsLeft color-actions remain. */
  | 'sacrifice'
  | 'finished';

export interface SacrificeInfo {
  color: Color;
  actionsLeft: number;
  /** Size of the sacrificed ship = total actions granted (for "action 2 of 3" UI). */
  total: number;
}

export type Winner = PlayerId | 'draw';

export interface GameState {
  bank: Bank;
  systems: System[];
  current: PlayerId;
  phase: Phase;
  /** How many players have completed homeworld setup (0..2). */
  setupDone: number;
  sacrifice: SacrificeInfo | null;
  winner: Winner | null;
  nextSystemId: number;
  /** Full-turn counter (increments when a turn ends). */
  turn: number;
}

export type Move =
  | { type: 'setup'; star1: Piece; star2: Piece; ship: Piece }
  | { type: 'build'; system: number; color: Color }
  | { type: 'trade'; system: number; ship: Piece; toColor: Color }
  | { type: 'move'; system: number; ship: Piece; to: number }
  | { type: 'discover'; system: number; ship: Piece; star: Piece }
  | { type: 'attack'; system: number; target: Piece }
  | { type: 'sacrifice'; system: number; ship: Piece }
  | { type: 'catastrophe'; system: number; color: Color }
  | { type: 'end' };

export const pieceKey = (p: Piece): string => `${p.color}${p.size}`;

export const samePiece = (a: Piece, b: Piece): boolean =>
  a.color === b.color && a.size === b.size;

export const COLOR_NAMES: Record<Color, string> = {
  r: 'red',
  y: 'yellow',
  g: 'green',
  b: 'blue',
};
