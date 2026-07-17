import {
  Bank,
  Color,
  GameState,
  Move,
  Piece,
  PlayerId,
  Size,
  System,
  fullBank,
  pieceKey,
} from '../engine';

export type ScenarioResult = 'won' | 'lost' | null;

export interface Scenario {
  id: string;
  kind: 'tutorial' | 'puzzle';
  title: string;
  blurb: string;
  /** Shown in the in-game banner while playing. */
  objective: string;
  setup: () => GameState;
  /**
   * Judge the position. `moves` is everything the player has done this
   * attempt. Return 'won'/'lost' to end the scenario, null to continue.
   */
  goal: (state: GameState, moves: Move[]) => ScenarioResult;
}

const p = (color: Color, size: Size): Piece => ({ color, size });

/** Build a scenario state; the human is always player 0 and to move. */
function mk(
  systems: {
    id: number;
    name?: string;
    stars: Piece[];
    ships0?: Piece[];
    ships1?: Piece[];
    home?: PlayerId;
  }[]
): GameState {
  const bank: Bank = fullBank();
  const sys: System[] = systems.map((s) => {
    for (const piece of [...s.stars, ...(s.ships0 ?? []), ...(s.ships1 ?? [])]) {
      if (bank[pieceKey(piece)] <= 0) throw new Error(`scenario uses >3 of ${pieceKey(piece)}`);
      bank[pieceKey(piece)]--;
    }
    return {
      id: s.id,
      name: s.name ?? (s.home === 0 ? 'Home 1' : s.home === 1 ? 'Home 2' : `Sector ${s.id}`),
      stars: s.stars,
      ships: [s.ships0 ?? [], s.ships1 ?? []] as [Piece[], Piece[]],
      home: s.home,
    };
  });
  return {
    bank,
    systems: sys,
    current: 0,
    phase: 'main',
    setupDone: 2,
    sacrifice: null,
    winner: null,
    nextSystemId: Math.max(...sys.map((s) => s.id)) + 1,
    turn: 10,
  };
}

/** The player's turn is over (passed to the opponent or the game ended). */
const turnOver = (state: GameState): boolean =>
  state.winner !== null || state.current === 1;

/** Tutorial goal: win as soon as `did` is satisfied; lose if the turn ends without it. */
function teach(did: (moves: Move[]) => boolean) {
  return (state: GameState, moves: Move[]): ScenarioResult => {
    if (did(moves)) return 'won';
    if (turnOver(state)) return 'lost';
    return null;
  };
}

/** Puzzle goal: player 0 must have won by the time their turn is over. */
const mustWin = (state: GameState): ScenarioResult => {
  if (state.winner === 0) return 'won';
  if (turnOver(state)) return 'lost';
  return null;
};

export const SCENARIOS: Scenario[] = [
  // ----- tutorial ----------------------------------------------------------
  {
    id: 'tut-build',
    kind: 'tutorial',
    title: 'Lesson 1 · Build',
    blurb: 'Green power: grow your fleet',
    objective: 'Build a new ship. Tap a ship at your homeworld, then choose Build.',
    setup: () =>
      mk([
        { id: 0, stars: [p('g', 1), p('b', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('r', 2), p('y', 1)], ships1: [p('y', 3)], home: 1 },
      ]),
    goal: teach((moves) => moves.some((m) => m.type === 'build')),
  },
  {
    id: 'tut-trade',
    kind: 'tutorial',
    title: 'Lesson 2 · Trade',
    blurb: 'Blue power: swap colors',
    objective: 'Trade a ship into a new color. Tap a ship, then pick a Trade option.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('r', 2), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ]),
    goal: teach((moves) => moves.some((m) => m.type === 'trade')),
  },
  {
    id: 'tut-move',
    kind: 'tutorial',
    title: 'Lesson 3 · Travel',
    blurb: 'Yellow power: move & discover',
    objective:
      'Move a ship to another system, or Discover a brand new one. Sizes connect when they differ from every star at your current system.',
    setup: () =>
      mk([
        { id: 0, stars: [p('y', 1), p('b', 2)], ships0: [p('y', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('r', 2), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('b', 3)], ships1: [p('g', 2)] },
      ]),
    goal: teach((moves) => moves.some((m) => m.type === 'move' || m.type === 'discover')),
  },
  {
    id: 'tut-attack',
    kind: 'tutorial',
    title: 'Lesson 4 · Capture',
    blurb: 'Red power: take their ships',
    objective:
      'Capture the enemy ship at the contested sector. Your ship must be at least as large as the target.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('g', 2), p('y', 1)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships0: [p('r', 2)], ships1: [p('g', 1)] },
      ]),
    goal: teach((moves) => moves.some((m) => m.type === 'attack')),
  },
  {
    id: 'tut-sacrifice',
    kind: 'tutorial',
    title: 'Lesson 5 · Sacrifice',
    blurb: 'Trade a ship for 1-3 actions',
    objective:
      'Sacrifice a ship (tap it, then ⚡ Sacrifice), use at least one of the granted actions, then end your turn.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('r', 2), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ]),
    goal: (state, moves) => {
      const sacrificed = moves.some((m) => m.type === 'sacrifice');
      const acted =
        sacrificed &&
        moves.some(
          (m, i) =>
            i > moves.findIndex((x) => x.type === 'sacrifice') &&
            ['build', 'trade', 'move', 'discover', 'attack'].includes(m.type)
        );
      if (acted && turnOver(state)) return 'won';
      if (turnOver(state)) return 'lost';
      return null;
    },
  },
  {
    id: 'tut-catastrophe',
    kind: 'tutorial',
    title: 'Lesson 6 · Catastrophe',
    blurb: '4 of a color = annihilation',
    objective:
      'Four same-color pieces at one system may be destroyed. Build a green ship at Sector 2 to make four greens, then declare the catastrophe.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3)], home: 0 },
        { id: 1, stars: [p('r', 2), p('b', 3)], ships1: [p('y', 1)], home: 1 },
        { id: 2, stars: [p('g', 3)], ships0: [p('g', 2), p('g', 1)], ships1: [] },
      ]),
    goal: teach((moves) => moves.some((m) => m.type === 'catastrophe')),
  },

  // ----- puzzles -----------------------------------------------------------
  {
    id: 'pz-boarding',
    kind: 'puzzle',
    title: 'Puzzle · Boarding action',
    blurb: 'Win this turn',
    objective:
      'Win THIS turn. Their homeworld garrison is thin — a red sacrifice lets you capture more than once.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('r', 2)], home: 0 },
        {
          id: 1,
          stars: [p('b', 3), p('g', 2)],
          ships0: [p('r', 3)],
          ships1: [p('y', 2), p('g', 1)],
          home: 1,
        },
      ]),
    goal: mustWin,
  },
  {
    id: 'pz-nova',
    kind: 'puzzle',
    title: 'Puzzle · Nova trap',
    blurb: 'Win this turn',
    objective:
      'Win THIS turn. Their homeworld burns green — one more green piece makes four, and stars burn too.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3)], home: 0 },
        {
          id: 1,
          stars: [p('g', 3), p('g', 2)],
          ships0: [p('g', 1)],
          ships1: [p('y', 1)],
          home: 1,
        },
      ]),
    goal: mustWin,
  },
  {
    id: 'pz-supply',
    kind: 'puzzle',
    title: 'Puzzle · Cut the supply',
    blurb: 'Win this turn',
    objective:
      'Win THIS turn. Their homeworld garrison is all yellow — one more yellow piece makes four. Your scout can be the spark.',
    setup: () =>
      mk([
        { id: 0, stars: [p('b', 1), p('g', 2)], ships0: [p('g', 3)], home: 0 },
        {
          id: 1,
          stars: [p('b', 3), p('r', 2)],
          ships1: [p('y', 3), p('y', 1), p('y', 1)],
          home: 1,
        },
        { id: 2, stars: [p('g', 1)], ships0: [p('y', 2)] },
      ]),
    goal: mustWin,
  },
];

export const scenarioById = (id: string | null | undefined): Scenario | undefined =>
  SCENARIOS.find((s) => s.id === id);
