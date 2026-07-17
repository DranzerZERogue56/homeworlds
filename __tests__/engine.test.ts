import {
  applyMove,
  connected,
  getLegalMoves,
  initialState,
  moveToNotation,
  Move,
  System,
} from '../src/engine';
import {
  bankCount,
  basicPosition,
  findMoves,
  makeState,
  p,
  playLegal,
  totalPieces,
} from './helpers';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('setup', () => {
  test('initial bank holds 36 pyramids', () => {
    const s = initialState();
    expect(totalPieces(s)).toBe(36);
    expect(Object.values(s.bank).every((n) => n === 3)).toBe(true);
  });

  test('setup moves choose two stars and a ship from the bank', () => {
    const s = initialState();
    const moves = findMoves(s, 'setup');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.type === 'setup')).toBe(true);

    const next = playLegal(s, {
      type: 'setup',
      star1: p('b', 1),
      star2: p('y', 2),
      ship: p('g', 3),
    });
    expect(next.systems).toHaveLength(1);
    expect(next.systems[0].home).toBe(0);
    expect(next.systems[0].stars).toEqual([p('b', 1), p('y', 2)]);
    expect(next.systems[0].ships[0]).toEqual([p('g', 3)]);
    expect(bankCount(next, p('b', 1))).toBe(2);
    expect(next.current).toBe(1);
    expect(next.phase).toBe('setup');
    expect(totalPieces(next)).toBe(36);
  });

  test('both setups complete -> main phase, player 0 to act', () => {
    let s = initialState();
    s = playLegal(s, { type: 'setup', star1: p('b', 1), star2: p('y', 2), ship: p('g', 3) });
    s = playLegal(s, { type: 'setup', star1: p('b', 3), star2: p('g', 2), ship: p('y', 3) });
    expect(s.phase).toBe('main');
    expect(s.current).toBe(0);
    expect(s.systems).toHaveLength(2);
    expect(totalPieces(s)).toBe(36);
  });

  test('duplicate star piece requires two copies in the bank', () => {
    const s = initialState();
    const moves = findMoves(s, 'setup');
    // 3 copies exist, so a double star of the same type is offered.
    expect(
      moves.some(
        (m) => m.star1.color === 'r' && m.star1.size === 1 && m.star2.color === 'r' && m.star2.size === 1
      )
    ).toBe(true);
    // Exhaust r1 down to 1 copy: no double-r1 homeworld may be offered.
    const drained = { ...s, bank: { ...s.bank, r1: 1 } };
    expect(
      findMoves(drained, 'setup').some(
        (m) =>
          m.star1.color === 'r' && m.star1.size === 1 && m.star2.color === 'r' && m.star2.size === 1
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

const sys = (id: number, stars: [string, number][]): System => ({
  id,
  name: `S${id}`,
  stars: stars.map(([c, s]) => p(c as any, s as any)),
  ships: [[], []],
});

describe('star connectivity', () => {
  test('systems connect iff stars share no size', () => {
    expect(connected(sys(0, [['r', 1]]), sys(1, [['b', 2]]))).toBe(true);
    expect(connected(sys(0, [['r', 1]]), sys(1, [['b', 1]]))).toBe(false); // same size never connects
    expect(connected(sys(0, [['r', 2]]), sys(1, [['r', 2]]))).toBe(false);
  });

  test('both binary homeworld star sizes count', () => {
    const home = sys(0, [['b', 1], ['y', 3]]);
    expect(connected(home, sys(1, [['g', 2]]))).toBe(true);
    expect(connected(home, sys(1, [['g', 1]]))).toBe(false);
    expect(connected(home, sys(1, [['g', 3]]))).toBe(false);
    expect(connected(home, sys(1, [['g', 2], ['r', 3]]))).toBe(false);
  });

  test('same-size binary homeworlds never connect to each other', () => {
    // Bluebird-style edge: hw stars sizes {1,2} vs {2,3} share size 2 -> no connection.
    expect(connected(sys(0, [['b', 1], ['y', 2]]), sys(1, [['b', 3], ['g', 2]]))).toBe(false);
    // Sizes {1,2} vs {3,3}: disjoint -> connected.
    expect(connected(sys(0, [['b', 1], ['y', 2]]), sys(1, [['r', 3], ['g', 3]]))).toBe(true);
  });

  test('move offers only connected destinations; discover only size-disjoint stars', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 1)], home: 1 }, // shares size 2
        { id: 2, stars: [p('r', 3)], ships1: [p('g', 1)] }, // disjoint from {1,2}
      ],
    });
    const moves = findMoves(s, 'move');
    expect(moves).toEqual([{ type: 'move', system: 0, ship: p('y', 3), to: 2 }]);
    const discoveries = findMoves(s, 'discover');
    expect(discoveries.length).toBeGreaterThan(0);
    expect(discoveries.every((m) => m.star.size === 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The four actions
// ---------------------------------------------------------------------------

describe('build (green)', () => {
  test('builds smallest available bank piece of a color you have a ship of', () => {
    const s = basicPosition(); // p0 at home: g3 ship, stars b1/y2 -> green via ship
    const builds = findMoves(s, 'build');
    expect(builds).toEqual([{ type: 'build', system: 0, color: 'g' }]);
    const next = playLegal(s, builds[0]);
    expect(next.systems[0].ships[0]).toContainEqual(p('g', 1)); // smallest green
    expect(totalPieces(next)).toBe(36);
  });

  test('smallest-in-bank respects depletion', () => {
    const s = basicPosition();
    s.bank.g1 = 0;
    s.bank.g2 = 0;
    const next = playLegal(s, { type: 'build', system: 0, color: 'g' });
    expect(next.systems[0].ships[0].filter((x) => x.color === 'g')).toHaveLength(2);
    expect(next.systems[0].ships[0]).toContainEqual(p('g', 3));
  });

  test('no green access -> no build offered', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('r', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    expect(findMoves(s, 'build')).toHaveLength(0);
    expect(() => applyMove(s, { type: 'build', system: 0, color: 'r' })).toThrow();
  });

  test('color exhausted in bank -> build of that color not offered', () => {
    const s = basicPosition();
    s.bank.g1 = 0;
    s.bank.g2 = 0;
    s.bank.g3 = 0;
    expect(findMoves(s, 'build')).toHaveLength(0);
  });
});

describe('trade (blue)', () => {
  test('swaps a ship for a same-size different-color bank piece', () => {
    const s = basicPosition(); // b1 star grants blue at home 0
    const trades = findMoves(s, 'trade');
    expect(trades).toContainEqual({ type: 'trade', system: 0, ship: p('g', 3), toColor: 'r' });
    expect(trades.every((m) => m.toColor !== 'g')).toBe(true);
    const next = playLegal(s, { type: 'trade', system: 0, ship: p('g', 3), toColor: 'r' });
    expect(next.systems[0].ships[0]).toEqual([p('r', 3)]);
    expect(bankCount(next, p('g', 3))).toBe(3); // returned
    expect(totalPieces(next)).toBe(36);
  });

  test('cannot trade into a color exhausted at that size', () => {
    const s = basicPosition();
    s.bank.r3 = 0;
    expect(findMoves(s, 'trade')).not.toContainEqual({
      type: 'trade',
      system: 0,
      ship: p('g', 3),
      toColor: 'r',
    });
  });
});

describe('move & discover (yellow)', () => {
  test('moving a ship relocates it; discovering creates a new system from a bank star', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    const next = playLegal(s, { type: 'discover', system: 0, ship: p('y', 3), star: p('r', 3) });
    const created = next.systems.find((x) => x.home === undefined)!;
    expect(created.stars).toEqual([p('r', 3)]);
    expect(created.ships[0]).toEqual([p('y', 3)]);
    expect(totalPieces(next)).toBe(36);

    // Opponent (yellow ship) moves to the new colony? Home1 sizes {3,2}, new star size 3 -> blocked.
    expect(findMoves(next, 'move')).toHaveLength(0);
  });

  test('moving your last ship out of a colony fades the colony (star to bank)', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3), p('g', 1)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships0: [p('y', 1)] },
      ],
    });
    // p0 ship y1 at colony 2 (star r3, size 3) moves to home 0 (sizes 1,2): connected.
    const next = playLegal(s, { type: 'move', system: 2, ship: p('y', 1), to: 0 });
    expect(next.systems.find((x) => x.id === 2)).toBeUndefined();
    expect(bankCount(next, p('r', 3))).toBe(3);
    expect(totalPieces(next)).toBe(36);
  });

  test('abandoning your homeworld destroys it immediately (loss)', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3), p('g', 1)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships1: [p('g', 2)] },
      ],
    });
    const next = playLegal(s, { type: 'move', system: 0, ship: p('y', 3), to: 2 });
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe(1);
  });
});

describe('attack (red)', () => {
  test('captures an enemy ship of equal or smaller size', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships0: [p('g', 2)], ships1: [p('y', 2), p('y', 3)] },
      ],
    });
    const attacks = findMoves(s, 'attack');
    expect(attacks).toEqual([{ type: 'attack', system: 2, target: p('y', 2) }]); // y3 too big
    const next = playLegal(s, attacks[0]);
    const colony = next.systems.find((x) => x.id === 2)!;
    expect(colony.ships[0]).toContainEqual(p('y', 2));
    expect(colony.ships[1]).toEqual([p('y', 3)]);
    expect(totalPieces(next)).toBe(36);
  });

  test('red access can come from a star, not just a ship', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 1)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships0: [p('g', 3)], ships1: [p('b', 3)] },
      ],
    });
    expect(findMoves(s, 'attack')).toContainEqual({ type: 'attack', system: 2, target: p('b', 3) });
  });

  test('no red access and no ship large enough -> no attack', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 1)], home: 1 },
        { id: 2, stars: [p('g', 3)], ships0: [p('r', 1)], ships1: [p('b', 2)] },
      ],
    });
    expect(findMoves(s, 'attack')).toHaveLength(0); // r1 < b2
  });
});

// ---------------------------------------------------------------------------
// Sacrifice
// ---------------------------------------------------------------------------

describe('sacrifice', () => {
  test('sacrificing a g3 grants exactly three build actions', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('r', 1), p('y', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 3) });
    expect(s.phase).toBe('sacrifice');
    expect(s.sacrifice).toEqual({ color: 'g', actionsLeft: 3 });
    expect(bankCount(s, p('g', 3))).toBe(3);

    // Only green actions (plus end) are offered; the system has no green star/ship
    // anymore, proving sacrifice waives color access.
    const legal = getLegalMoves(s);
    expect(legal.filter((m) => m.type !== 'end').every((m) => m.type === 'build')).toBe(true);

    s = playLegal(s, { type: 'build', system: 0, color: 'r' });
    expect(s.sacrifice!.actionsLeft).toBe(2);
    s = playLegal(s, { type: 'build', system: 0, color: 'r' });
    expect(s.sacrifice!.actionsLeft).toBe(1);
    s = playLegal(s, { type: 'build', system: 0, color: 'y' });
    // Third action consumed: turn passes to opponent automatically.
    expect(s.phase).toBe('main');
    expect(s.current).toBe(1);
    // Two red builds (both r1, the smallest in bank) plus one yellow build.
    expect(s.systems[0].ships[0].filter((x) => x.color === 'r')).toHaveLength(3);
    expect(s.systems[0].ships[0].filter((x) => x.color === 'y')).toHaveLength(2);
    expect(totalPieces(s)).toBe(36);
  });

  test('sacrifice actions are restricted to the sacrificed color', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 2), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('y', 2) });
    expect(s.sacrifice).toEqual({ color: 'y', actionsLeft: 2 });
    expect(() => applyMove(s, { type: 'build', system: 0, color: 'g' })).toThrow();
    const legal = getLegalMoves(s);
    expect(
      legal.every((m) => m.type === 'move' || m.type === 'discover' || m.type === 'end')
    ).toBe(true);
  });

  test('a sacrifice turn may be ended early, forfeiting remaining actions', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('r', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 3) });
    s = playLegal(s, { type: 'build', system: 0, color: 'r' });
    s = playLegal(s, { type: 'end' });
    expect(s.phase).toBe('main');
    expect(s.current).toBe(1);
  });

  test('sacrificing your only homeworld ship destroys the homeworld', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    const next = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 3) });
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Catastrophes
// ---------------------------------------------------------------------------

describe('catastrophe', () => {
  test('offered only when 4+ pieces of one color share a system', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        {
          id: 2,
          stars: [p('g', 3)],
          ships0: [p('g', 1), p('g', 1)],
          ships1: [p('g', 2)],
        },
      ],
    });
    expect(findMoves(s, 'catastrophe')).toEqual([{ type: 'catastrophe', system: 2, color: 'g' }]);
    const next = playLegal(s, { type: 'catastrophe', system: 2, color: 'g' });
    // All four green pieces return; the star is gone so the system is destroyed.
    expect(next.systems.find((x) => x.id === 2)).toBeUndefined();
    expect(totalPieces(next)).toBe(36);
    // Declaring a catastrophe does not consume the free action.
    expect(next.phase).toBe('main');
    expect(next.current).toBe(0);
  });

  test('three pieces of a color is safe', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('g', 3)], ships0: [p('g', 1), p('g', 1)] },
      ],
    });
    expect(findMoves(s, 'catastrophe')).toHaveLength(0);
  });

  test('destroys one homeworld star; the homeworld survives on the other', () => {
    const s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('r', 1), p('b', 2)],
          ships0: [p('r', 2), p('r', 3), p('r', 3), p('g', 1)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
      current: 1,
    });
    const next = playLegal(s, { type: 'catastrophe', system: 0, color: 'r' });
    const home = next.systems.find((x) => x.home === 0)!;
    expect(home.stars).toEqual([p('b', 2)]); // r1 star destroyed
    expect(home.ships[0]).toEqual([p('g', 1)]); // red ships gone, green survives
    expect(next.winner).toBeNull();
    expect(totalPieces(next)).toBe(36);
  });

  test('destroying both homeworld stars destroys the homeworld -> immediate loss', () => {
    const s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('b', 1), p('b', 2)],
          ships0: [p('b', 3), p('g', 1)],
          ships1: [p('b', 3)],
          home: 0,
        },
        { id: 1, stars: [p('r', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
      current: 1,
    });
    const next = playLegal(s, { type: 'catastrophe', system: 0, color: 'b' });
    expect(next.systems.find((x) => x.home === 0)).toBeUndefined();
    expect(next.winner).toBe(1);
    expect(next.phase).toBe('finished');
    expect(totalPieces(next)).toBe(36);
  });

  test("catastrophe wiping a player's home ships loses at end of turn", () => {
    // Opponent's g1 keeps the system occupied, so home 0 survives the
    // catastrophe with one star — but player 0 has no ships there.
    let s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('r', 1), p('b', 2)],
          ships0: [p('r', 2), p('r', 3), p('r', 3)],
          ships1: [p('g', 1)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3), p('g', 1)], home: 1 },
      ],
      current: 1,
    });
    s = playLegal(s, { type: 'catastrophe', system: 0, color: 'r' });
    expect(s.winner).toBeNull(); // not evaluated until end of turn
    expect(s.systems.find((x) => x.home === 0)!.stars).toEqual([p('b', 2)]);
    s = playLegal(s, { type: 'build', system: 1, color: 'g' });
    expect(s.phase).toBe('finished');
    expect(s.winner).toBe(1);
  });

  test('catastrophe emptying a homeworld of all ships destroys it immediately', () => {
    let s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('r', 1), p('b', 2)],
          ships0: [p('r', 2), p('r', 3), p('r', 3)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3), p('g', 1)], home: 1 },
      ],
      current: 1,
    });
    s = playLegal(s, { type: 'catastrophe', system: 0, color: 'r' });
    // No ships remain at home 0 at all -> the system fades -> immediate loss.
    expect(s.systems.find((x) => x.home === 0)).toBeUndefined();
    expect(s.winner).toBe(1);
    expect(totalPieces(s)).toBe(36);
  });

  test('catastrophe can be declared mid-sacrifice, including on a homeworld star', () => {
    let s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('g', 3), p('y', 2)],
          ships0: [p('g', 2), p('g', 1), p('g', 1), p('r', 1)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    // Sacrifice g2 (2 actions); one green build makes 4 green pieces at home
    // (g3 star + three g1 ships); declare the catastrophe mid-sacrifice.
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 2) });
    s = playLegal(s, { type: 'build', system: 0, color: 'g' });
    expect(findMoves(s, 'catastrophe')).toContainEqual({ type: 'catastrophe', system: 0, color: 'g' });
    s = playLegal(s, { type: 'catastrophe', system: 0, color: 'g' });
    expect(s.phase).toBe('sacrifice'); // one green action still pending
    expect(s.sacrifice!.actionsLeft).toBe(1);
    const home = s.systems.find((x) => x.home === 0)!;
    expect(home.stars).toEqual([p('y', 2)]); // g3 homeworld star destroyed
    expect(home.ships[0]).toEqual([p('r', 1)]);
    expect(totalPieces(s)).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// Win / loss / edge cases
// ---------------------------------------------------------------------------

describe('win, loss, draw', () => {
  test('capturing the last home ship wins at end of turn', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 1)], home: 0 },
        {
          id: 1,
          stars: [p('b', 3), p('g', 2)],
          ships0: [p('r', 3)],
          ships1: [p('y', 2)],
          home: 1,
        },
      ],
      current: 0,
    });
    const next = playLegal(s, { type: 'attack', system: 1, target: p('y', 2) });
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe(0);
  });

  test('finished game offers no legal moves', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships0: [p('r', 3)], ships1: [p('y', 2)], home: 1 },
      ],
    });
    const done = playLegal(s, { type: 'attack', system: 1, target: p('y', 2) });
    expect(getLegalMoves(done)).toHaveLength(0);
    expect(() => applyMove(done, { type: 'end' })).toThrow();
  });

  test('a player can always act while they still have a ship (sacrifice fallback)', () => {
    // Red-only ship at home with no red access elsewhere: build/trade/move all
    // impossible, but sacrifice is still offered, so no stalemate.
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('r', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s.bank = Object.fromEntries(Object.entries(s.bank).map(([k]) => [k, 0])) as any;
    const legal = getLegalMoves(s);
    expect(legal.some((m) => m.type === 'sacrifice')).toBe(true);
    expect(legal.some((m) => m.type === 'end')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Notation & invariants
// ---------------------------------------------------------------------------

describe('notation', () => {
  test('renders standard forms', () => {
    const s = basicPosition();
    expect(moveToNotation(s, { type: 'build', system: 0, color: 'g' })).toBe('build g1 Home 1');
    expect(
      moveToNotation(s, { type: 'trade', system: 0, ship: p('g', 3), toColor: 'r' })
    ).toBe('trade g3 r3 Home 1');
    expect(
      moveToNotation(s, { type: 'discover', system: 0, ship: p('g', 3), star: p('r', 3) })
    ).toBe('discover g3 Home 1 r3 (new)');
    expect(moveToNotation(s, { type: 'sacrifice', system: 0, ship: p('g', 3) })).toBe(
      'sacrifice g3 Home 1'
    );
    expect(moveToNotation(s, { type: 'catastrophe', system: 0, color: 'b' })).toBe(
      'catastrophe Home 1 blue'
    );
  });
});

describe('invariants over random play', () => {
  test('random legal self-play conserves 36 pieces and never crashes', () => {
    let rngState = 42;
    const rng = () => {
      rngState = (rngState * 1103515245 + 12345) % 2147483648;
      return rngState / 2147483648;
    };
    for (let game = 0; game < 5; game++) {
      let s = initialState();
      for (let step = 0; step < 400 && s.phase !== 'finished'; step++) {
        const legal = getLegalMoves(s);
        expect(legal.length).toBeGreaterThan(0);
        const move: Move = legal[Math.floor(rng() * legal.length)];
        s = applyMove(s, move);
        expect(totalPieces(s)).toBe(36);
      }
    }
  });
});
