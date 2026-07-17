import {
  Color,
  GameState,
  Move,
  Piece,
  PlayerId,
  applyMove,
  pieceKey,
  samePiece,
} from '../engine';

/** The ship the player has tapped, if any. */
export interface Selection {
  system: number;
  ship: Piece;
}

/** Everything the game screen may offer, derived purely from getLegalMoves output. */
export interface Derived {
  /** Legal move destinations for the selected ship. */
  moveTargets: Set<number>;
  moveMoves: Extract<Move, { type: 'move' }>[];
  /** Capturable enemy pieces (by key) at the selected ship's system. */
  attackTargets: Set<string>;
  attackMoves: Extract<Move, { type: 'attack' }>[];
  buildMoves: Extract<Move, { type: 'build' }>[];
  tradeMoves: Extract<Move, { type: 'trade' }>[];
  discoverMoves: Extract<Move, { type: 'discover' }>[];
  sacrificeMove: Extract<Move, { type: 'sacrifice' }> | undefined;
  /** Independent of selection: */
  catastropheMoves: Extract<Move, { type: 'catastrophe' }>[];
  endMove: Move | undefined;
  /** True when a selection exists but offers nothing at all. */
  selectionIsDead: boolean;
}

export function derive(legal: Move[], sel: Selection | null): Derived {
  const catastropheMoves = legal.filter(
    (m): m is Extract<Move, { type: 'catastrophe' }> => m.type === 'catastrophe'
  );
  const endMove = legal.find((m) => m.type === 'end');

  const empty: Derived = {
    moveTargets: new Set(),
    moveMoves: [],
    attackTargets: new Set(),
    attackMoves: [],
    buildMoves: [],
    tradeMoves: [],
    discoverMoves: [],
    sacrificeMove: undefined,
    catastropheMoves,
    endMove,
    selectionIsDead: false,
  };
  if (!sel) return empty;

  const atSystem = legal.filter(
    (m): m is Exclude<Move, { type: 'end' } | { type: 'setup' } | { type: 'catastrophe' }> =>
      m.type !== 'end' &&
      m.type !== 'setup' &&
      m.type !== 'catastrophe' &&
      m.system === sel.system
  );

  const moveMoves = atSystem.filter(
    (m): m is Extract<Move, { type: 'move' }> =>
      m.type === 'move' && samePiece(m.ship, sel.ship)
  );
  const attackMoves = atSystem.filter(
    (m): m is Extract<Move, { type: 'attack' }> => m.type === 'attack'
  );
  const buildMoves = atSystem.filter(
    (m): m is Extract<Move, { type: 'build' }> => m.type === 'build'
  );
  const tradeMoves = atSystem.filter(
    (m): m is Extract<Move, { type: 'trade' }> =>
      m.type === 'trade' && samePiece(m.ship, sel.ship)
  );
  const discoverMoves = atSystem.filter(
    (m): m is Extract<Move, { type: 'discover' }> =>
      m.type === 'discover' && samePiece(m.ship, sel.ship)
  );
  const sacrificeMove = atSystem.find(
    (m): m is Extract<Move, { type: 'sacrifice' }> =>
      m.type === 'sacrifice' && samePiece(m.ship, sel.ship)
  );

  const selectionIsDead =
    moveMoves.length === 0 &&
    attackMoves.length === 0 &&
    buildMoves.length === 0 &&
    tradeMoves.length === 0 &&
    discoverMoves.length === 0 &&
    sacrificeMove === undefined;

  return {
    moveTargets: new Set(moveMoves.map((m) => m.to)),
    moveMoves,
    attackTargets: new Set(attackMoves.map((m) => pieceKey(m.target))),
    attackMoves,
    buildMoves,
    tradeMoves,
    discoverMoves,
    sacrificeMove,
    catastropheMoves,
    endMove,
    selectionIsDead,
  };
}

/** True when applying `move` immediately ends the game with `player` not winning. */
export function moveLosesGame(state: GameState, move: Move, player: PlayerId): boolean {
  try {
    const after = applyMove(state, move);
    return after.winner !== null && after.winner !== player;
  } catch {
    return false;
  }
}

/** What the player should do next during a sacrifice of the given color. */
export function sacrificeHint(color: Color): string {
  switch (color) {
    case 'g':
      return 'Tap one of your ships, then Build.';
    case 'b':
      return 'Tap one of your ships, then pick a color to Trade into.';
    case 'y':
      return 'Tap a ship, then a highlighted system — or Discover a new one.';
    case 'r':
      return 'Tap your ship at a contested system, then tap the enemy ship to capture.';
  }
}
