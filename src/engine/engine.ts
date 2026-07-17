import {
  Bank,
  COLORS,
  Color,
  GameState,
  Move,
  Piece,
  PlayerId,
  SIZES,
  Size,
  System,
  pieceKey,
  samePiece,
} from './types';

// ---------------------------------------------------------------------------
// Construction / helpers
// ---------------------------------------------------------------------------

export function fullBank(): Bank {
  const bank: Bank = {};
  for (const c of COLORS) for (const s of SIZES) bank[`${c}${s}`] = 3;
  return bank;
}

export function initialState(): GameState {
  return {
    bank: fullBank(),
    systems: [],
    current: 0,
    phase: 'setup',
    setupDone: 0,
    sacrifice: null,
    winner: null,
    nextSystemId: 0,
    turn: 0,
  };
}

const clone = (s: GameState): GameState => ({
  bank: { ...s.bank },
  systems: s.systems.map((sys) => ({
    ...sys,
    stars: sys.stars.map((p) => ({ ...p })),
    ships: [
      sys.ships[0].map((p) => ({ ...p })),
      sys.ships[1].map((p) => ({ ...p })),
    ] as [Piece[], Piece[]],
  })),
  current: s.current,
  phase: s.phase,
  setupDone: s.setupDone,
  sacrifice: s.sacrifice ? { ...s.sacrifice } : null,
  winner: s.winner,
  nextSystemId: s.nextSystemId,
  turn: s.turn,
});

export const otherPlayer = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

export const findSystem = (state: GameState, id: number): System | undefined =>
  state.systems.find((s) => s.id === id);

export const homeworld = (state: GameState, player: PlayerId): System | undefined =>
  state.systems.find((s) => s.home === player);

/** Two systems connect iff their stars share no size (both binary star sizes count). */
export function connected(a: System, b: System): boolean {
  const sizesA = new Set(a.stars.map((p) => p.size));
  return !b.stars.some((p) => sizesA.has(p.size));
}

/** A new star of size `size` can form a system reachable from `from`. */
function starConnects(from: System, size: Size): boolean {
  return !from.stars.some((p) => p.size === size);
}

function bankHas(bank: Bank, piece: Piece): boolean {
  return (bank[pieceKey(piece)] ?? 0) > 0;
}

/** Smallest size of `color` available in the bank, or null. */
function smallestInBank(bank: Bank, color: Color): Size | null {
  for (const s of SIZES) if ((bank[`${color}${s}`] ?? 0) > 0) return s;
  return null;
}

/** Colors the acting player can use at a system: own ship colors + star colors. */
function availableColors(sys: System, player: PlayerId): Set<Color> {
  const colors = new Set<Color>();
  for (const p of sys.ships[player]) colors.add(p.color);
  for (const p of sys.stars) colors.add(p.color);
  return colors;
}

function countColorAt(sys: System, color: Color): number {
  let n = 0;
  for (const p of sys.stars) if (p.color === color) n++;
  for (const p of sys.ships[0]) if (p.color === color) n++;
  for (const p of sys.ships[1]) if (p.color === color) n++;
  return n;
}

/** All (system, color) pairs where a catastrophe may be declared. */
export function catastrophesAvailable(
  state: GameState
): { system: number; color: Color }[] {
  const out: { system: number; color: Color }[] = [];
  for (const sys of state.systems) {
    for (const c of COLORS) {
      if (countColorAt(sys, c) >= 4) out.push({ system: sys.id, color: c });
    }
  }
  return out;
}

const dedupePieces = (pieces: Piece[]): Piece[] => {
  const seen = new Set<string>();
  return pieces.filter((p) => {
    const k = pieceKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ---------------------------------------------------------------------------
// Legal moves
// ---------------------------------------------------------------------------

/** Every distinct piece type currently available in the bank. */
function bankPieceTypes(bank: Bank): Piece[] {
  const out: Piece[] = [];
  for (const c of COLORS)
    for (const s of SIZES) if ((bank[`${c}${s}`] ?? 0) > 0) out.push({ color: c, size: s });
  return out;
}

function setupMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const types = bankPieceTypes(state.bank);
  for (let i = 0; i < types.length; i++) {
    for (let j = i; j < types.length; j++) {
      const star1 = types[i];
      const star2 = types[j];
      // Two copies of the same type require at least 2 in the bank.
      if (i === j && state.bank[pieceKey(star1)] < 2) continue;
      const used: Bank = { ...state.bank };
      used[pieceKey(star1)]--;
      used[pieceKey(star2)]--;
      for (const ship of bankPieceTypes(used)) {
        moves.push({ type: 'setup', star1, star2, ship });
      }
    }
  }
  return moves;
}

/**
 * Color-actions available to the current player. With `colorFilter` set
 * (sacrifice mode) only that color's actions are returned and system color
 * access is waived; otherwise the action's color must be available at the
 * system via the player's own ships or the system's stars.
 */
function actionMoves(state: GameState, colorFilter: Color | null): Move[] {
  const moves: Move[] = [];
  const me = state.current;

  for (const sys of state.systems) {
    const myShips = sys.ships[me];
    if (myShips.length === 0) continue;

    const colors = colorFilter
      ? new Set<Color>([colorFilter])
      : availableColors(sys, me);

    // Green: build the smallest bank piece of a color I already have a ship of here.
    if (colors.has('g')) {
      const shipColors = new Set(myShips.map((p) => p.color));
      for (const c of shipColors) {
        if (smallestInBank(state.bank, c) !== null) {
          moves.push({ type: 'build', system: sys.id, color: c });
        }
      }
    }

    // Blue: trade a ship for a same-size, different-color bank piece.
    if (colors.has('b')) {
      for (const ship of dedupePieces(myShips)) {
        for (const c of COLORS) {
          if (c !== ship.color && bankHas(state.bank, { color: c, size: ship.size })) {
            moves.push({ type: 'trade', system: sys.id, ship, toColor: c });
          }
        }
      }
    }

    // Yellow: move to a connected system, or discover a new one.
    if (colors.has('y')) {
      for (const ship of dedupePieces(myShips)) {
        for (const dest of state.systems) {
          if (dest.id !== sys.id && connected(sys, dest)) {
            moves.push({ type: 'move', system: sys.id, ship, to: dest.id });
          }
        }
        for (const star of bankPieceTypes(state.bank)) {
          if (starConnects(sys, star.size)) {
            moves.push({ type: 'discover', system: sys.id, ship, star });
          }
        }
      }
    }

    // Red: capture an enemy ship no bigger than my largest ship here.
    if (colors.has('r')) {
      const myMax = Math.max(...myShips.map((p) => p.size));
      for (const target of dedupePieces(sys.ships[otherPlayer(me)])) {
        if (target.size <= myMax) {
          moves.push({ type: 'attack', system: sys.id, target });
        }
      }
    }
  }
  return moves;
}

export function getLegalMoves(state: GameState): Move[] {
  if (state.phase === 'finished') return [];
  if (state.phase === 'setup') return setupMoves(state);

  const moves: Move[] = [];
  const cats = catastrophesAvailable(state);
  for (const c of cats) moves.push({ type: 'catastrophe', ...c });

  if (state.phase === 'main') {
    const actions = actionMoves(state, null);
    moves.push(...actions);
    // Sacrifice: return any own ship for size-many actions of its color.
    for (const sys of state.systems) {
      for (const ship of dedupePieces(sys.ships[state.current])) {
        moves.push({ type: 'sacrifice', system: sys.id, ship });
      }
    }
    // Stalemate edge case: nothing but (possibly) catastrophes -> allow passing.
    const hasAction = moves.some((m) => m.type !== 'catastrophe');
    if (!hasAction) {
      moves.push({ type: 'end' });
    }
  } else if (state.phase === 'sacrifice') {
    moves.push(...actionMoves(state, state.sacrifice!.color));
    moves.push({ type: 'end' }); // may forgo remaining sacrifice actions
  } else if (state.phase === 'post') {
    moves.push({ type: 'end' });
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Applying moves
// ---------------------------------------------------------------------------

export class IllegalMove extends Error {}

function takeFromBank(bank: Bank, piece: Piece): void {
  const k = pieceKey(piece);
  if ((bank[k] ?? 0) <= 0) throw new IllegalMove(`bank empty: ${k}`);
  bank[k]--;
}

function returnToBank(bank: Bank, piece: Piece): void {
  bank[pieceKey(piece)]++;
}

function removeShip(list: Piece[], piece: Piece): Piece {
  const i = list.findIndex((p) => samePiece(p, piece));
  if (i < 0) throw new IllegalMove(`ship not found: ${pieceKey(piece)}`);
  return list.splice(i, 1)[0];
}

/**
 * Enforce system existence rules, immediately:
 *  - a system whose stars are all gone is destroyed (ships return to the bank);
 *  - a system with no ships at all fades away (stars return to the bank).
 * Both apply to homeworlds too — abandoning your home even briefly destroys it.
 */
function sweepSystems(state: GameState): void {
  state.systems = state.systems.filter((sys) => {
    if (sys.stars.length === 0) {
      for (const side of sys.ships) for (const p of side) returnToBank(state.bank, p);
      return false;
    }
    if (sys.ships[0].length === 0 && sys.ships[1].length === 0) {
      for (const star of sys.stars) returnToBank(state.bank, star);
      return false;
    }
    return true;
  });
}

/** Immediate loss: homeworld no longer exists. */
function checkDestruction(state: GameState): void {
  if (state.phase === 'setup' || state.setupDone < 2) return;
  const destroyed = ([0, 1] as PlayerId[]).map((p) => !homeworld(state, p));
  applyLosses(state, destroyed);
}

/** End-of-turn loss: homeworld gone OR no own ships at own homeworld. */
function checkEndOfTurn(state: GameState): void {
  if (state.setupDone < 2) return;
  const losses = ([0, 1] as PlayerId[]).map((p) => {
    const home = homeworld(state, p);
    return !home || home.ships[p].length === 0;
  });
  applyLosses(state, losses);
}

function applyLosses(state: GameState, losses: boolean[]): void {
  if (losses[0] && losses[1]) state.winner = 'draw';
  else if (losses[0]) state.winner = 1;
  else if (losses[1]) state.winner = 0;
  if (state.winner !== null) {
    state.phase = 'finished';
    state.sacrifice = null;
  }
}

function endTurn(state: GameState): void {
  checkEndOfTurn(state);
  if (state.phase === 'finished') return;
  state.current = otherPlayer(state.current);
  state.phase = state.setupDone < 2 ? 'setup' : 'main';
  state.sacrifice = null;
  state.turn++;
}

/** After a completed color-action: continue sacrifice, pause for catastrophes, or end turn. */
function afterAction(state: GameState): void {
  checkDestruction(state);
  if (state.phase === 'finished') return;

  if (state.phase === 'sacrifice' && state.sacrifice!.actionsLeft > 0) return;

  if (catastrophesAvailable(state).length > 0) {
    state.phase = 'post';
    state.sacrifice = null;
  } else {
    endTurn(state);
  }
}

const GREEK = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
];

function newSystemName(state: GameState): string {
  const used = new Set(state.systems.map((s) => s.name));
  for (const g of GREEK) if (!used.has(g)) return g;
  return `System ${state.nextSystemId}`;
}

export function applyMove(prev: GameState, move: Move): GameState {
  const state = clone(prev);
  const me = state.current;

  if (state.phase === 'finished') throw new IllegalMove('game is over');

  switch (move.type) {
    case 'setup': {
      if (state.phase !== 'setup') throw new IllegalMove('not in setup');
      takeFromBank(state.bank, move.star1);
      takeFromBank(state.bank, move.star2);
      takeFromBank(state.bank, move.ship);
      state.systems.push({
        id: state.nextSystemId++,
        name: me === 0 ? 'Home 1' : 'Home 2',
        stars: [{ ...move.star1 }, { ...move.star2 }],
        ships: me === 0 ? [[{ ...move.ship }], []] : [[], [{ ...move.ship }]],
        home: me,
      });
      state.setupDone++;
      state.current = otherPlayer(me);
      if (state.setupDone === 2) state.phase = 'main';
      state.turn++;
      return state;
    }

    case 'catastrophe': {
      if (state.phase !== 'main' && state.phase !== 'post' && state.phase !== 'sacrifice')
        throw new IllegalMove('cannot declare catastrophe now');
      const sys = findSystem(state, move.system);
      if (!sys || countColorAt(sys, move.color) < 4)
        throw new IllegalMove('no catastrophe available there');
      sys.stars = sys.stars.filter((p) => {
        if (p.color !== move.color) return true;
        returnToBank(state.bank, p);
        return false;
      });
      for (const side of [0, 1] as PlayerId[]) {
        sys.ships[side] = sys.ships[side].filter((p) => {
          if (p.color !== move.color) return true;
          returnToBank(state.bank, p);
          return false;
        });
      }
      sweepSystems(state);
      checkDestruction(state);
      // If the turn's action was already done and no catastrophes remain, end the turn.
      if (state.phase === 'post' && catastrophesAvailable(state).length === 0) {
        endTurn(state);
      }
      return state;
    }

    case 'end': {
      if (state.phase === 'main') {
        // Only legal as a stalemate pass (no actions available).
        const hasAction = getLegalMoves(prev).some(
          (m) => m.type !== 'catastrophe' && m.type !== 'end'
        );
        if (hasAction) throw new IllegalMove('must take an action');
      } else if (state.phase !== 'post' && state.phase !== 'sacrifice') {
        throw new IllegalMove('cannot end turn now');
      }
      endTurn(state);
      return state;
    }

    case 'sacrifice': {
      if (state.phase !== 'main') throw new IllegalMove('sacrifice replaces the free action');
      const sys = findSystem(state, move.system);
      if (!sys) throw new IllegalMove('no such system');
      const ship = removeShip(sys.ships[me], move.ship);
      returnToBank(state.bank, ship);
      state.sacrifice = { color: ship.color, actionsLeft: ship.size };
      state.phase = 'sacrifice';
      sweepSystems(state);
      checkDestruction(state);
      return state;
    }
  }

  // Color-actions (build / trade / move / discover / attack)
  const inSacrifice = state.phase === 'sacrifice';
  if (state.phase !== 'main' && !inSacrifice) throw new IllegalMove('no action allowed now');

  const sys = findSystem(state, move.system);
  if (!sys) throw new IllegalMove('no such system');
  if (sys.ships[me].length === 0) throw new IllegalMove('no ship at that system');

  const needColor: Color = { build: 'g', trade: 'b', move: 'y', discover: 'y', attack: 'r' }[
    move.type
  ] as Color;
  if (inSacrifice) {
    if (state.sacrifice!.color !== needColor || state.sacrifice!.actionsLeft <= 0)
      throw new IllegalMove('wrong sacrifice color or no actions left');
    state.sacrifice!.actionsLeft--;
  } else if (!availableColors(sys, me).has(needColor)) {
    throw new IllegalMove(`${needColor} not available at that system`);
  }

  switch (move.type) {
    case 'build': {
      if (!sys.ships[me].some((p) => p.color === move.color))
        throw new IllegalMove('must already have a ship of that color there');
      const size = smallestInBank(state.bank, move.color);
      if (size === null) throw new IllegalMove('bank has no pieces of that color');
      takeFromBank(state.bank, { color: move.color, size });
      sys.ships[me].push({ color: move.color, size });
      break;
    }
    case 'trade': {
      if (move.toColor === move.ship.color) throw new IllegalMove('must change color');
      const incoming: Piece = { color: move.toColor, size: move.ship.size };
      takeFromBank(state.bank, incoming);
      const old = removeShip(sys.ships[me], move.ship);
      returnToBank(state.bank, old);
      sys.ships[me].push(incoming);
      break;
    }
    case 'move': {
      const dest = findSystem(state, move.to);
      if (!dest) throw new IllegalMove('no such destination');
      if (!connected(sys, dest)) throw new IllegalMove('systems are not connected');
      const ship = removeShip(sys.ships[me], move.ship);
      dest.ships[me].push(ship);
      break;
    }
    case 'discover': {
      if (!starConnects(sys, move.star.size))
        throw new IllegalMove('new star size must differ from all current star sizes');
      takeFromBank(state.bank, move.star);
      const ship = removeShip(sys.ships[me], move.ship);
      state.systems.push({
        id: state.nextSystemId++,
        name: newSystemName(state),
        stars: [{ ...move.star }],
        ships: me === 0 ? [[ship], []] : [[], [ship]],
      });
      break;
    }
    case 'attack': {
      const myMax = Math.max(...sys.ships[me].map((p) => p.size));
      if (move.target.size > myMax) throw new IllegalMove('target larger than your largest ship');
      const captured = removeShip(sys.ships[otherPlayer(me)], move.target);
      sys.ships[me].push(captured);
      break;
    }
  }

  sweepSystems(state);
  afterAction(state);
  return state;
}
