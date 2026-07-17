import { GameState, Move, Piece, pieceKey } from './types';
import { findSystem } from './engine';

const pk = (p: Piece) => pieceKey(p);

/**
 * Standard textual Homeworlds notation, e.g.
 *   homeworld r2 b1 g3
 *   build g1 Alpha
 *   trade b2 r2 Alpha
 *   move y1 Alpha Beta
 *   discover y1 Alpha r2 Gamma
 *   attack g2 Alpha
 *   sacrifice y2 Alpha
 *   catastrophe Alpha red
 *   pass
 *
 * `state` must be the state the move is applied TO (names resolve pre-move).
 */
export function moveToNotation(state: GameState, move: Move): string {
  const sysName = (id: number) => findSystem(state, id)?.name ?? `#${id}`;
  switch (move.type) {
    case 'setup':
      return `homeworld ${pk(move.star1)} ${pk(move.star2)} ${pk(move.ship)}`;
    case 'build':
      return `build ${buildPieceKey(state, move)} ${sysName(move.system)}`;
    case 'trade':
      return `trade ${pk(move.ship)} ${move.toColor}${move.ship.size} ${sysName(move.system)}`;
    case 'move':
      return `move ${pk(move.ship)} ${sysName(move.system)} ${sysName(move.to)}`;
    case 'discover':
      return `discover ${pk(move.ship)} ${sysName(move.system)} ${pk(move.star)} (new)`;
    case 'attack':
      return `attack ${pk(move.target)} ${sysName(move.system)}`;
    case 'sacrifice':
      return `sacrifice ${pk(move.ship)} ${sysName(move.system)}`;
    case 'catastrophe': {
      const names = { r: 'red', y: 'yellow', g: 'green', b: 'blue' } as const;
      return `catastrophe ${sysName(move.system)} ${names[move.color]}`;
    }
    case 'end':
      return 'pass';
  }
}

/** The exact piece a build move produces (smallest of that color in the bank). */
function buildPieceKey(state: GameState, move: { color: string }): string {
  for (const s of [1, 2, 3]) {
    if ((state.bank[`${move.color}${s}`] ?? 0) > 0) return `${move.color}${s}`;
  }
  return `${move.color}?`;
}
