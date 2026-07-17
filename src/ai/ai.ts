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

export type Difficulty = 'easy' | 'lessEasy' | 'medium' | 'hard' | 'masterful';

const WIN = 1_000_000;

// ---------------------------------------------------------------------------
// Personalities
// ---------------------------------------------------------------------------

/** Multipliers on evaluation terms; 1 everywhere = the balanced baseline. */
export interface PersonaWeights {
  /** Hurting the enemy: their material, and my invasion force at their home. */
  aggression: number;
  /** Keeping my own homeworld garrisoned and healthy. */
  defense: number;
  /** Growing my own fleet's material. */
  material: number;
  /** Fear of catastrophe exposure (lower = reckless). */
  caution: number;
}

export interface Persona {
  id: string;
  name: string;
  /** Short flavor line shown in the menu / thinking banner. */
  blurb: string;
  difficulty: Difficulty;
  weights: PersonaWeights;
  /** Extra move-choice noise on top of the tier's base (greedy tiers only). */
  noise?: number;
}

const W = (
  aggression: number,
  defense: number,
  material: number,
  caution: number
): PersonaWeights => ({ aggression, defense, material, caution });

export const PERSONAS: Persona[] = [
  // easy — loose, distractible
  { id: 'bloop', name: 'Ensign Bloop', blurb: 'Enthusiastic, easily distracted', difficulty: 'easy', weights: W(0.8, 0.8, 1.2, 0.6), noise: 20 },
  { id: 'mira', name: 'Cadet Mira', blurb: 'Timid — hides at home', difficulty: 'easy', weights: W(0.5, 1.6, 1.0, 1.3), noise: 10 },
  // lessEasy — starting to focus
  { id: 'jax', name: 'Scrapper Jax', blurb: 'Picks fights early', difficulty: 'lessEasy', weights: W(1.6, 0.7, 0.9, 0.7) },
  { id: 'yun', name: 'Prospector Yun', blurb: 'Hoards ships, avoids trouble', difficulty: 'lessEasy', weights: W(0.7, 1.1, 1.6, 1.2) },
  // medium
  { id: 'sorrel', name: 'Captain Sorrel', blurb: 'By-the-book tactician', difficulty: 'medium', weights: W(1.0, 1.0, 1.0, 1.0) },
  { id: 'krayt', name: 'Warlord Krayt', blurb: 'Reckless raider', difficulty: 'medium', weights: W(1.7, 0.7, 0.9, 0.5) },
  // hard
  { id: 'vex', name: 'Admiral Vex', blurb: 'Relentless pressure', difficulty: 'hard', weights: W(1.4, 0.9, 1.0, 0.9) },
  { id: 'ilm', name: 'Strategos Ilm', blurb: 'Patient — waits for your mistake', difficulty: 'hard', weights: W(0.9, 1.4, 1.1, 1.2) },
  // masterful
  { id: 'archivist', name: 'The Archivist', blurb: 'Has read every recorded game', difficulty: 'masterful', weights: W(1.0, 1.0, 1.0, 1.0) },
  { id: 'nyx', name: 'Empress Nyx', blurb: 'Ends duels quickly and cruelly', difficulty: 'masterful', weights: W(1.5, 0.8, 1.0, 0.8) },
];

export function personasFor(difficulty: Difficulty): Persona[] {
  return PERSONAS.filter((p) => p.difficulty === difficulty);
}

export function personaById(id: string | null | undefined): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

export function randomPersona(difficulty: Difficulty): Persona {
  const pool = personasFor(difficulty);
  return pool[Math.floor(Math.random() * pool.length)];
}

const BALANCED: PersonaWeights = W(1, 1, 1, 1);

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
export function evaluate(state: GameState, me: PlayerId, w: PersonaWeights = BALANCED): number {
  if (state.winner !== null) {
    if (state.winner === 'draw') return 0;
    return state.winner === me ? WIN : -WIN;
  }

  const you = otherPlayer(me);
  let score = 0;

  const myHome = homeworld(state, me);
  const yourHome = homeworld(state, you);

  for (const sys of state.systems) {
    for (const p of sys.ships[me]) score += w.material * 10 * shipValue(p);
    for (const p of sys.ships[you]) score -= w.aggression * 10 * shipValue(p);

    // Catastrophe exposure: 3+ of one color where I have pieces is fragile.
    for (const c of COLORS) {
      let mine = 0;
      let total = 0;
      for (const p of sys.stars) if (p.color === c) total++;
      for (const p of sys.ships[me]) if (p.color === c) { total++; mine++; }
      for (const p of sys.ships[you]) if (p.color === c) total++;
      if (total >= 3 && mine > 0) score -= w.caution * 15 * mine;
      if (sys.home === me && total >= 3 && sys.stars.some((s) => s.color === c))
        score -= w.caution * 40;
    }
  }

  // Homeworld safety.
  if (myHome) {
    const defenders = myHome.ships[me];
    score += w.defense * 25 * Math.min(defenders.length, 3);
    score += w.defense * 20 * Math.max(0, ...defenders.map((p) => p.size));
    for (const p of myHome.ships[you]) score -= w.defense * 60 * p.size; // invaders are scary
    score += w.defense * 10 * myHome.stars.length;
    score += 5 * colorsAt(myHome, me).size;
  }
  if (yourHome) {
    const defenders = yourHome.ships[you];
    score -= w.aggression * 25 * Math.min(defenders.length, 3);
    for (const p of yourHome.ships[me]) score += w.aggression * 55 * p.size; // my invasion force
    score -= w.aggression * 10 * yourHome.stars.length;
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
  weights: PersonaWeights;
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
    return evaluate(state, ctx.me, ctx.weights);
  }
  const maximizing = state.current === ctx.me;
  const moves = orderedMoves(state, ctx);
  if (moves.length === 0) return evaluate(state, ctx.me, ctx.weights);

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

interface TierConfig {
  /** Greedy tiers pick the best one-ply move with noise; search tiers run alpha-beta. */
  kind: 'greedy' | 'search';
  /** Greedy: random noise amplitude; more noise = sloppier play. */
  noise?: number;
  /** Greedy: how much the one-ply evaluation counts. */
  evalWeight?: number;
  depth?: number;
  maxBranch?: number;
  timeMs?: number;
}

const TIERS: Record<Difficulty, TierConfig> = {
  easy: { kind: 'greedy', noise: 55, evalWeight: 0.15 },
  lessEasy: { kind: 'greedy', noise: 25, evalWeight: 0.35 },
  medium: { kind: 'search', depth: 2, maxBranch: 16, timeMs: 1500 },
  hard: { kind: 'search', depth: 3, maxBranch: 26, timeMs: 2000 },
  masterful: { kind: 'search', depth: 4, maxBranch: 20, timeMs: 2600 },
};

/**
 * Choose a move for the current player using only the public engine API.
 * Async and chunked (yields between root moves) so the UI thread stays live;
 * search tiers are time-capped (1.5–2.6s by difficulty). An optional persona
 * skews the evaluation (aggression/defense/material/caution) so opponents of
 * the same rank feel different.
 */
export async function chooseMove(
  state: GameState,
  difficulty: Difficulty,
  persona?: Persona
): Promise<Move> {
  const legal = getLegalMoves(state);
  if (legal.length === 0) throw new Error('no legal moves');
  if (legal.length === 1) return legal[0];
  const me = state.current;
  const tier = TIERS[difficulty] ?? TIERS.easy;
  const weights = persona?.weights ?? BALANCED;

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

  if (tier.kind === 'greedy') {
    // Light heuristics: one-ply greedy with noise, never pick instant self-harm.
    const noise = (tier.noise ?? 55) + (persona?.noise ?? 0);
    let best = legal[0];
    let bestScore = -Infinity;
    for (const move of legal) {
      let s = Math.random() * noise;
      try {
        const after = applyMove(state, move);
        s += evaluate(after, me, weights) * (tier.evalWeight ?? 0.15);
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
    deadline: Date.now() + (tier.timeMs ?? 1500),
    maxBranch: tier.maxBranch ?? 16,
    nodes: 0,
    weights,
  };
  const depth = tier.depth ?? 2;

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
