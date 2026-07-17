import {
  Bank,
  Color,
  GameState,
  Move,
  Piece,
  PlayerId,
  Size,
  System,
  applyMove,
  fullBank,
  getLegalMoves,
  pieceKey,
} from '../src/engine';

export const p = (color: Color, size: Size): Piece => ({ color, size });

/** Build a mid-game state from a compact spec; bank = 36 minus pieces on the board. */
export function makeState(spec: {
  systems: {
    id: number;
    name?: string;
    stars: Piece[];
    ships0?: Piece[];
    ships1?: Piece[];
    home?: PlayerId;
  }[];
  current?: PlayerId;
  phase?: GameState['phase'];
  sacrifice?: { color: Color; actionsLeft: number; total?: number } | null;
}): GameState {
  const bank: Bank = fullBank();
  const take = (piece: Piece) => {
    const k = pieceKey(piece);
    if (bank[k] <= 0) throw new Error(`spec uses more than 3 of ${k}`);
    bank[k]--;
  };
  const systems: System[] = spec.systems.map((s) => {
    for (const piece of [...s.stars, ...(s.ships0 ?? []), ...(s.ships1 ?? [])]) take(piece);
    return {
      id: s.id,
      name: s.name ?? (s.home !== undefined ? `Home ${s.home + 1}` : `Sys${s.id}`),
      stars: s.stars,
      ships: [s.ships0 ?? [], s.ships1 ?? []] as [Piece[], Piece[]],
      home: s.home,
    };
  });
  return {
    bank,
    systems,
    current: spec.current ?? 0,
    phase: spec.phase ?? 'main',
    setupDone: 2,
    sacrifice: spec.sacrifice
      ? { ...spec.sacrifice, total: spec.sacrifice.total ?? spec.sacrifice.actionsLeft }
      : null,
    winner: null,
    nextSystemId: Math.max(...systems.map((s) => s.id)) + 1,
    turn: 10,
  };
}

/** Standard two-homeworld opening position used by many tests. */
export function basicPosition(): GameState {
  return makeState({
    systems: [
      { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
      { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
    ],
  });
}

export function findMoves<T extends Move['type']>(
  state: GameState,
  type: T
): Extract<Move, { type: T }>[] {
  return getLegalMoves(state).filter((m) => m.type === type) as Extract<Move, { type: T }>[];
}

/** Order-insensitive equality for setup star pairs; deep equality otherwise. */
function movesEqual(a: Move, b: Move): boolean {
  if (a.type === 'setup' && b.type === 'setup') {
    const key = (x: Piece) => pieceKey(x);
    const starsA = [key(a.star1), key(a.star2)].sort();
    const starsB = [key(b.star1), key(b.star2)].sort();
    return (
      starsA[0] === starsB[0] && starsA[1] === starsB[1] && key(a.ship) === key(b.ship)
    );
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Assert the move is legal per getLegalMoves, then apply it. */
export function playLegal(state: GameState, move: Move): GameState {
  const legal = getLegalMoves(state);
  const found = legal.some((m) => movesEqual(m, move));
  if (!found) {
    throw new Error(
      `move not in getLegalMoves: ${JSON.stringify(move)}\nlegal: ${legal
        .map((m) => JSON.stringify(m))
        .join('\n')}`
    );
  }
  return applyMove(state, move);
}

export function bankCount(state: GameState, piece: Piece): number {
  return state.bank[pieceKey(piece)];
}

/** Total pieces in bank + on board must always be 36. */
export function totalPieces(state: GameState): number {
  let n = 0;
  for (const k of Object.keys(state.bank)) n += state.bank[k];
  for (const sys of state.systems) n += sys.stars.length + sys.ships[0].length + sys.ships[1].length;
  return n;
}
