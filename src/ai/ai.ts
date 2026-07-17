import {
  COLORS,
  GameState,
  Move,
  PlayerId,
  Piece,
  System,
  applyMove,
  getLegalMoves,
  homeworld,
  otherPlayer,
} from '../engine';

export type Difficulty = 'easy' | 'medium' | 'hard';

const WIN = 1_000_000;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function shipValue(p: Piece): number {
  return p.size * p.size; // larges matter disproportionately
}

function colorsAt(sys: System, player: PlayerId): Set<string> {
  const set = new Set<string>();
  for (const p of sys.ships[player]) set.add(p.color);
  for (const p of sys.stars) set.add(p.color);
  return set;
}

/** Static evaluation from `me`'s perspective. Higher is better for `me`. */
export function evaluate(state: GameState, me: PlayerId): number {
  if (state.winner !== null) {
    if (state.winner === 'draw') return 0;
    return state.winner === me ? WIN : -WIN;
  }

  const you = otherPlayer(me);
  let score = 0;

  const myHome = homeworld(state, me);
  const yourHome = homeworld(state, you);

  for (const sys of state.systems) {
    for (const p of sys.ships[me]) score += 10 * shipValue(p);
    for (const p of sys.ships[you]) score -= 10 * shipValue(p);

    // Catastrophe exposure: 3+ of one color where I have pieces is fragile.
    for (const c of COLORS) {
      let mine = 0;
      let total = 0;
      for (const p of sys.stars) if (p.color === c) total++;
      for (const p of sys.ships[me]) if (p.color === c) { total++; mine++; }
      for (const p of sys.ships[you]) if (p.color === c) total++;
      if (total >= 3 && mine > 0) score -= 15 * mine;
      if (sys.home === me && total >= 3 && sys.stars.some((s) => s.color === c)) score -= 40;
    }
  }

  // Homeworld safety.
  if (myHome) {
    const defenders = myHome.ships[me];
    score += 25 * Math.min(defenders.length, 3);
    score += 20 * Math.max(0, ...defenders.map((p) => p.size));
    for (const p of myHome.ships[you]) score -= 60 * p.size; // invaders are scary
    score += 10 * myHome.stars.length;
    score += 5 * colorsAt(myHome, me).size;
  }
  if (yourHome) {
    const defenders = yourHome.ships[you];
    score -= 25 * Math.min(defenders.length, 3);
    for (const p of yourHome.ships[me]) score += 55 * p.size; // my invasion force
    score -= 10 * yourHome.stars.length;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Setup heuristic (all difficulties)
// ---------------------------------------------------------------------------

function scoreSetup(state: GameState, move: Extract<Move, { type: 'setup' }>): number {
  let score = Math.random() * 4; // tie-break variety
  const sizes = [move.star1.size, move.star2.size];
  if (sizes[0] !== sizes[1]) score += 40; // same-size stars waste connectivity
  const starColors = new Set([move.star1.color, move.star2.color]);
  if (starColors.has('b')) score += 20; // trade access
  if (starColors.has('y')) score += 12; // move access
  if (starColors.has('g')) score += 10;
  if (starColors.size === 2) score += 10;
  if (move.ship.color === 'g') score += 25; // green ship enables growth
  score += 8 * move.ship.size;

  // Second player: prefer stars overlapping one of the opponent's sizes is a
  // known strategic choice question; prefer the "small universe" (overlap) at
  // one size to keep the enemy at distance 2.
  const enemyHome = state.systems.find((s) => s.home !== undefined);
  if (enemyHome) {
    const enemySizes = new Set(enemyHome.stars.map((p) => p.size));
    const overlap = sizes.filter((s) => enemySizes.has(s)).length;
    if (overlap === 1) score += 15;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Quick move ordering / light heuristics
// ---------------------------------------------------------------------------

function quickScore(state: GameState, move: Move, me: PlayerId): number {
  switch (move.type) {
    case 'attack':
      return 100 + 10 * move.target.size;
    case 'build':
      return 60;
    case 'trade':
      return 40;
    case 'discover':
      return 25;
    case 'move':
      return 30;
    case 'sacrifice':
      return 20 - 5 * move.ship.size;
    case 'catastrophe': {
      // Only attractive if it hurts the opponent more than me.
      const after = applyMove(state, move);
      return evaluate(after, me) - evaluate(state, me);
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Search (medium/hard)
// ---------------------------------------------------------------------------

interface SearchCtx {
  me: PlayerId;
  deadline: number;
  maxBranch: number;
  nodes: number;
}

function orderedMoves(state: GameState, ctx: SearchCtx): Move[] {
  const moves = getLegalMoves(state);
  const scored = moves.map((m) => ({ m, s: quickScore(state, m, state.current) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, ctx.maxBranch).map((x) => x.m);
}

function alphabeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx
): number {
  ctx.nodes++;
  if (state.winner !== null || depth === 0 || Date.now() > ctx.deadline) {
    return evaluate(state, ctx.me);
  }
  const maximizing = state.current === ctx.me;
  const moves = orderedMoves(state, ctx);
  if (moves.length === 0) return evaluate(state, ctx.me);

  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    let child: GameState;
    try {
      child = applyMove(state, move);
    } catch {
      continue; // defensive: engine legal moves should never throw
    }
    // Only count depth on turn changes so sacrifice chains are searched whole.
    const nextDepth = child.current === state.current ? depth : depth - 1;
    const v = alphabeta(child, nextDepth, alpha, beta, ctx);
    if (maximizing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha || Date.now() > ctx.deadline) break;
  }
  return best;
}

const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Choose a move for the current player using only the public engine API.
 * Async and chunked (yields between root moves) so the UI thread stays live;
 * total thinking time is capped (~1.5s on medium/hard).
 */
export async function chooseMove(
  state: GameState,
  difficulty: Difficulty
): Promise<Move> {
  const legal = getLegalMoves(state);
  if (legal.length === 0) throw new Error('no legal moves');
  if (legal.length === 1) return legal[0];
  const me = state.current;

  if (state.phase === 'setup') {
    const setups = legal as Extract<Move, { type: 'setup' }>[];
    let best = setups[0];
    let bestScore = -Infinity;
    for (const m of setups) {
      const s = scoreSetup(state, m);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    return best;
  }

  if (difficulty === 'easy') {
    // Light heuristics: one-ply greedy with noise, never pick instant self-harm.
    let best = legal[0];
    let bestScore = -Infinity;
    for (const move of legal) {
      let s = Math.random() * 60;
      try {
        const after = applyMove(state, move);
        s += evaluate(after, me) * 0.15;
        if (after.winner === me) s += WIN;
        if (after.winner === otherPlayer(me)) s -= WIN;
      } catch {
        continue;
      }
      if (s > bestScore) {
        bestScore = s;
        best = move;
      }
    }
    return best;
  }

  const ctx: SearchCtx = {
    me,
    deadline: Date.now() + 1500,
    maxBranch: difficulty === 'hard' ? 24 : 14,
    nodes: 0,
  };
  const depth = difficulty === 'hard' ? 3 : 2;

  const roots = orderedMoves(state, ctx);
  let best = roots[0];
  let bestScore = -Infinity;
  let sinceYield = 0;
  for (const move of roots) {
    let child: GameState;
    try {
      child = applyMove(state, move);
    } catch {
      continue;
    }
    const nextDepth = child.current === state.current ? depth : depth - 1;
    const v = alphabeta(child, nextDepth, -Infinity, Infinity, ctx);
    if (v > bestScore) {
      bestScore = v;
      best = move;
    }
    if (Date.now() > ctx.deadline) break;
    if (++sinceYield >= 3) {
      sinceYield = 0;
      await yieldToUI();
    }
  }
  return best;
}
